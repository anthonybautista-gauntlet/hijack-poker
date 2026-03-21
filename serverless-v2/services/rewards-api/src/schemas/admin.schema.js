'use strict';

const { z } = require('zod');

const adjustPointsSchema = z.object({
  body: z.object({
    playerId: z.string().min(1),
    points: z.number().int(),
    reason: z.string().min(1).max(500),
  }),
  query: z.object({}),
  params: z.object({}),
});

const tierOverrideSchema = z.object({
  body: z.object({
    playerId: z.string().min(1),
    tier: z.number().int().min(1).max(4),
    reason: z.string().min(1).max(500),
  }),
  query: z.object({}),
  params: z.object({}),
});

module.exports = { adjustPointsSchema, tierOverrideSchema };
