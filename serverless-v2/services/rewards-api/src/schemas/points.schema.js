'use strict';

const { z } = require('zod');

const awardPointsSchema = z.object({
  body: z.object({
    playerId: z.string().min(1),
    tableId: z.number().int().positive(),
    tableStakes: z.string().min(1),
    bigBlind: z.number().positive(),
    handId: z.string().min(1),
  }),
  query: z.object({}),
  params: z.object({}),
});

module.exports = { awardPointsSchema };
