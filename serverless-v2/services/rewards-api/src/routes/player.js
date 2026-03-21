'use strict';

const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { historyQuerySchema } = require('../schemas/player.schema');
const { getTierInfo, TIERS } = require('../services/tier.service');
const dynamo = require('../services/dynamo.service');

const router = Router();

/**
 * GET /api/v1/player/rewards
 *
 * Get a player's rewards summary including tier info and progress.
 */
router.get('/rewards', async (req, res) => {
  try {
    const { playerId } = req;

    const player = await dynamo.getPlayer(playerId);
    if (!player) {
      return res.status(404).json({
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: 'Player not found',
        },
      });
    }

    const tierInfo = getTierInfo(player.currentTier);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Build nextTier info
    let nextTier = null;
    if (player.currentTier < 4) {
      const next = TIERS.find((t) => t.level === player.currentTier + 1);
      if (next) {
        const pointsNeeded = Math.max(0, next.threshold - player.monthlyPoints);
        const progressPercent =
          next.threshold > 0
            ? Math.min(100, Math.round((player.monthlyPoints / next.threshold) * 100))
            : 100;
        nextTier = {
          level: next.level,
          name: next.name,
          threshold: next.threshold,
          pointsNeeded,
          progressPercent,
        };
      }
    }

    return res.status(200).json({
      playerId: player.playerId,
      displayName: player.displayName,
      currentTier: {
        level: tierInfo.level,
        name: tierInfo.name,
        multiplier: tierInfo.multiplier,
      },
      monthlyPoints: player.monthlyPoints,
      lifetimePoints: player.lifetimePoints,
      nextTier,
      monthKey,
    });
  } catch (err) {
    console.error('Get player rewards error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get player rewards',
      },
    });
  }
});

/**
 * GET /api/v1/player/rewards/history
 *
 * Get a player's point transaction history with pagination.
 */
router.get('/rewards/history', validate(historyQuerySchema), async (req, res) => {
  try {
    const { playerId } = req;
    const { limit, offset } = req.validated.query;

    // Fetch all transactions for the player (descending by timestamp)
    const allTransactions = await dynamo.getTransactionsByPlayer(playerId);

    // Apply offset/limit in-memory (DynamoDB pagination workaround for demo)
    const paged = allTransactions.slice(offset, offset + limit);

    return res.status(200).json({
      transactions: paged,
      pagination: {
        limit,
        offset,
        total: allTransactions.length,
      },
    });
  } catch (err) {
    console.error('Get player history error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get transaction history',
      },
    });
  }
});

module.exports = router;
