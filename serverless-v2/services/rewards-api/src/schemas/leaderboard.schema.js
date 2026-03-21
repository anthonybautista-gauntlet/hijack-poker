'use strict';

const { z } = require('zod');

const leaderboardQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    monthKey: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'monthKey must be YYYY-MM format')
      .optional(),
  }),
  body: z.object({}),
  params: z.object({}),
});

module.exports = { leaderboardQuerySchema };
