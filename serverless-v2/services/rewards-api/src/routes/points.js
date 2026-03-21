'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { awardPointsSchema } = require('../schemas/points.schema');
const { calculateBasePoints, applyMultiplier } = require('../services/points.service');
const { checkTierAdvancement, getTierInfo } = require('../services/tier.service');
const { createTierChangeNotification, checkMilestones } = require('../services/notification.service');
const { lookupDisplayName } = require('../services/player-lookup.service');
const dynamo = require('../services/dynamo.service');

const router = Router();

/**
 * POST /api/v1/points/award
 *
 * Award points to a player for completing a hand.
 * Includes idempotency check via handId GSI, player auto-provisioning,
 * tier advancement, leaderboard updates, and milestone notifications.
 */
router.post('/award', validate(awardPointsSchema), async (req, res) => {
  try {
    const { playerId, tableId, tableStakes, bigBlind, handId } = req.validated.body;

    // 1. Check idempotency — query handId-index GSI
    const existingTxns = await dynamo.queryByHandId(handId);
    const duplicate = existingTxns.find((txn) => txn.playerId === playerId);
    if (duplicate) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_HAND',
          message: `Hand ${handId} already processed for this player`,
        },
      });
    }

    // 2. Get or auto-provision player
    let player = await dynamo.getPlayer(playerId);
    if (!player) {
      const displayName = (await lookupDisplayName(playerId)) || 'Player';
      const now = new Date().toISOString();
      player = {
        playerId,
        displayName,
        currentTier: 1,
        monthlyPoints: 0,
        lifetimePoints: 0,
        lastResetMonth: null,
        createdAt: now,
        updatedAt: now,
      };
      await dynamo.putPlayer(player);
    }

    const previousTier = player.currentTier;
    const previousLifetimePoints = player.lifetimePoints;

    // 3. Calculate points
    const basePoints = calculateBasePoints(bigBlind);
    const tierInfo = getTierInfo(player.currentTier);
    const multiplier = tierInfo ? tierInfo.multiplier : 1.0;
    const earnedPoints = applyMultiplier(basePoints, player.currentTier);

    // 4. Write transaction to immutable ledger
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const timestamp = `${now.toISOString()}#${crypto.randomUUID().slice(0, 4)}`;

    await dynamo.createTransaction({
      playerId,
      timestamp,
      handId,
      type: 'gameplay',
      basePoints,
      multiplier,
      earnedPoints,
      tableId,
      tableStakes,
      bigBlind,
      monthKey,
    });

    // 5. Atomic update player points (prevents lost updates under concurrency)
    const updatedPlayer = await dynamo.atomicUpdatePlayerPoints(playerId, earnedPoints);
    const newMonthlyPoints = updatedPlayer.monthlyPoints;
    const newLifetimePoints = updatedPlayer.lifetimePoints;

    // 6. Check tier advancement
    let tierChanged = false;
    let currentTier = previousTier;
    const advancement = checkTierAdvancement(previousTier, newMonthlyPoints);
    if (advancement) {
      tierChanged = true;
      currentTier = advancement.newTier;
      await dynamo.updatePlayerTier(playerId, advancement.newTier);

      // Create tier upgrade notification
      const tierNotification = createTierChangeNotification(playerId, previousTier, advancement.newTier);
      await dynamo.createNotification(tierNotification);
    }

    // 7. Update leaderboard entry
    await dynamo.upsertLeaderboardEntry({
      monthKey,
      playerId,
      monthlyPoints: newMonthlyPoints,
      displayName: player.displayName,
      tier: currentTier,
    });

    // 8. Check milestones and create notifications
    const milestones = checkMilestones(newLifetimePoints, previousLifetimePoints);
    for (const milestone of milestones) {
      await dynamo.createNotification({
        playerId,
        ...milestone,
      });
    }

    // 9. Return response
    const responseTierInfo = getTierInfo(currentTier);
    return res.status(200).json({
      playerId,
      basePoints,
      multiplier,
      earnedPoints,
      monthlyPoints: newMonthlyPoints,
      currentTier: {
        level: currentTier,
        name: responseTierInfo ? responseTierInfo.name : 'Bronze',
      },
      tierChanged,
    });
  } catch (err) {
    console.error('Award points error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to award points',
      },
    });
  }
});

/**
 * GET /api/v1/points/leaderboard
 *
 * Get the points leaderboard. Candidates implement this.
 */
router.get('/leaderboard', (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    message: 'Implement leaderboard query here. See challenge docs for requirements.',
  });
});

module.exports = router;
