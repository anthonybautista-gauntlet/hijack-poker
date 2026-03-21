'use strict';

const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { getNotificationsSchema, dismissNotificationSchema } = require('../schemas/notifications.schema');
const dynamo = require('../services/dynamo.service');

const router = Router();

/**
 * GET /api/v1/player/notifications
 *
 * Get all notifications for the authenticated player.
 * Query param: unread=true to filter to undismissed only.
 * Returns notifications sorted by createdAt descending with unreadCount.
 */
router.get('/', validate(getNotificationsSchema), async (req, res) => {
  try {
    const playerId = req.playerId;
    const unreadOnly = req.validated.query.unread === 'true';

    let notifications = await dynamo.getNotifications(playerId);

    // Sort by createdAt descending
    notifications.sort((a, b) => {
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    const unreadCount = notifications.filter((n) => n.dismissed === false).length;

    if (unreadOnly) {
      notifications = notifications.filter((n) => n.dismissed === false);
    }

    return res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get notifications',
      },
    });
  }
});

/**
 * PATCH /api/v1/player/notifications/:id/dismiss
 *
 * Dismiss a notification. Verifies ownership via playerId.
 * Returns 404 if notification not found.
 */
router.patch('/:id/dismiss', validate(dismissNotificationSchema), async (req, res) => {
  try {
    const playerId = req.playerId;
    const notificationId = req.validated.params.id;

    const updated = await dynamo.dismissNotification(playerId, notificationId);

    if (!updated) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Dismiss notification error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to dismiss notification',
      },
    });
  }
});

module.exports = router;
