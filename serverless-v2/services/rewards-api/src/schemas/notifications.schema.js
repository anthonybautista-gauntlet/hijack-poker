'use strict';

const { z } = require('zod');

const getNotificationsSchema = z.object({
  body: z.object({}),
  query: z.object({
    unread: z.enum(['true', 'false']).optional(),
  }),
  params: z.object({}),
});

const dismissNotificationSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: z.object({
    id: z.string().min(1),
  }),
});

module.exports = { getNotificationsSchema, dismissNotificationSchema };
