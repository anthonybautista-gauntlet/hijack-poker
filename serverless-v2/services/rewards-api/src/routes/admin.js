'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const { adminAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { adjustPointsSchema, tierOverrideSchema } = require('../schemas/admin.schema');
const { checkTierAdvancement, getTierInfo, calculateResetTier } = require('../services/tier.service');
const { createTierChangeNotification } = require('../services/notification.service');
const dynamo = require('../services/dynamo.service');

const router = Router();

// All admin routes require admin auth
router.use(adminAuth);

/**
 * GET /admin/players/:playerId/rewards
 *
 * Returns full player record, recent 20 transactions, and tier history (last 6 months).
 */
router.get('/players/:playerId/rewards', async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await dynamo.getPlayer(playerId);
    if (!player) {
      return res.status(404).json({
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: `Player ${playerId} not found`,
        },
      });
    }

    const transactions = await dynamo.getTransactions(playerId, 20);
    const tierHistory = await dynamo.getTierHistory(playerId, 6);

    return res.status(200).json({
      player,
      transactions,
      tierHistory,
    });
  } catch (err) {
    console.error('Admin get player rewards error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch player rewards',
      },
    });
  }
});

/**
 * POST /admin/points/adjust
 *
 * Adjust a player's points (positive or negative).
 * Creates an adjustment transaction, updates totals atomically,
 * checks tier advancement, and updates leaderboard.
 */
router.post('/points/adjust', validate(adjustPointsSchema), async (req, res) => {
  try {
    const { playerId, points, reason } = req.validated.body;

    const player = await dynamo.getPlayer(playerId);
    if (!player) {
      return res.status(404).json({
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: `Player ${playerId} not found`,
        },
      });
    }

    const previousTier = player.currentTier;

    // Write adjustment transaction to ledger
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const timestamp = `${now.toISOString()}#${crypto.randomUUID().slice(0, 4)}`;

    await dynamo.createTransaction({
      playerId,
      timestamp,
      type: 'adjustment',
      basePoints: points,
      multiplier: 1,
      earnedPoints: points,
      monthKey,
      reason,
    });

    // Atomic update of player points
    const updatedPlayer = await dynamo.atomicUpdatePlayerPoints(playerId, points);

    // Check tier advancement (only for positive adjustments)
    let currentTier = previousTier;
    if (points > 0) {
      const advancement = checkTierAdvancement(previousTier, updatedPlayer.monthlyPoints);
      if (advancement) {
        currentTier = advancement.newTier;
        await dynamo.updatePlayerTier(playerId, advancement.newTier);
        const notification = createTierChangeNotification(playerId, previousTier, advancement.newTier);
        await dynamo.createNotification(notification);
      }
    }

    // Update leaderboard entry
    await dynamo.upsertLeaderboardEntry({
      monthKey,
      playerId,
      monthlyPoints: updatedPlayer.monthlyPoints,
      displayName: player.displayName,
      tier: currentTier,
    });

    return res.status(200).json({
      playerId,
      previousPoints: {
        monthly: player.monthlyPoints,
        lifetime: player.lifetimePoints,
      },
      adjustment: points,
      currentPoints: {
        monthly: updatedPlayer.monthlyPoints,
        lifetime: updatedPlayer.lifetimePoints,
      },
      currentTier,
    });
  } catch (err) {
    console.error('Admin points adjust error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to adjust points',
      },
    });
  }
});

/**
 * GET /admin/leaderboard
 *
 * Same as player leaderboard but includes playerId in response.
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const now = new Date();
    const defaultMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthKey = req.query.monthKey || defaultMonthKey;

    const entries = await dynamo.queryLeaderboard(monthKey, limit);

    const leaderboard = entries.map((entry, index) => ({
      rank: index + 1,
      playerId: entry.playerId,
      displayName: entry.displayName,
      tier: entry.tier,
      monthlyPoints: entry.monthlyPoints,
    }));

    return res.status(200).json({
      monthKey,
      leaderboard,
    });
  } catch (err) {
    console.error('Admin leaderboard error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch leaderboard',
      },
    });
  }
});

/**
 * POST /admin/tier/override
 *
 * Override a player's tier directly.
 */
router.post('/tier/override', validate(tierOverrideSchema), async (req, res) => {
  try {
    const { playerId, tier, reason } = req.validated.body;

    const player = await dynamo.getPlayer(playerId);
    if (!player) {
      return res.status(404).json({
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: `Player ${playerId} not found`,
        },
      });
    }

    const previousTier = player.currentTier;

    // Update tier directly
    await dynamo.updatePlayerTier(playerId, tier);

    // Create notification about the override
    const tierInfo = getTierInfo(tier);
    const tierName = tierInfo ? tierInfo.name : 'Unknown';
    await dynamo.createNotification({
      playerId,
      type: tier > previousTier ? 'tier_upgrade' : 'tier_downgrade',
      title: 'Tier Override',
      message: `Your tier has been set to ${tierName} by an admin. Reason: ${reason}`,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      playerId,
      previousTier,
      currentTier: tier,
      reason,
    });
  } catch (err) {
    console.error('Admin tier override error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to override tier',
      },
    });
  }
});

/**
 * POST /admin/monthly-reset
 *
 * Process monthly reset for all players:
 * 1. Record tier history for each player
 * 2. Calculate new tier (max(current - 1, 1))
 * 3. Reset monthly points to 0
 * 4. Create downgrade notification if tier changed
 */
router.post('/monthly-reset', async (req, res) => {
  try {
    const players = await dynamo.scanAllPlayers();

    const now = new Date();
    // Previous month's key
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const tierHistoryItems = [];
    const tierChanges = [];

    for (const player of players) {
      // Record tier history for the previous month
      tierHistoryItems.push({
        playerId: player.playerId,
        monthKey: previousMonthKey,
        tier: player.currentTier,
        monthlyPoints: player.monthlyPoints || 0,
        peakTier: player.currentTier,
      });

      // Calculate new tier
      const newTier = calculateResetTier(player.currentTier);
      const tierChanged = newTier !== player.currentTier;

      // Reset player monthly points and update tier
      await dynamo.resetPlayerMonth(player.playerId, newTier);

      if (tierChanged) {
        tierChanges.push({
          playerId: player.playerId,
          from: player.currentTier,
          to: newTier,
        });

        // Create downgrade notification
        const notification = createTierChangeNotification(player.playerId, player.currentTier, newTier);
        await dynamo.createNotification(notification);
      }
    }

    // Batch write tier history
    if (tierHistoryItems.length > 0) {
      await dynamo.batchWriteTierHistory(tierHistoryItems);
    }

    return res.status(200).json({
      playersProcessed: players.length,
      tierChanges,
      month: previousMonthKey,
    });
  } catch (err) {
    console.error('Admin monthly reset error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process monthly reset',
      },
    });
  }
});

module.exports = router;
