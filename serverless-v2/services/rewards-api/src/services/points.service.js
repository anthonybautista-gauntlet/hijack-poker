'use strict';

const { TIERS } = require('./tier.service');

/**
 * Stake bracket definitions — continuous ranges, no gaps.
 */
const STAKE_BRACKETS = [
  { min: 10.00, max: Infinity, points: 10, label: 'High' },
  { min: 2.00, max: 9.99, points: 5, label: 'Mid' },
  { min: 0.50, max: 1.99, points: 2, label: 'Low' },
  { min: 0, max: 0.49, points: 1, label: 'Micro' },
];

/**
 * Calculate base points from big blind amount.
 * @param {number} bigBlind - The big blind stake amount
 * @returns {number} Base points before multiplier
 */
function calculateBasePoints(bigBlind) {
  if (bigBlind >= 10.00) return 10;
  if (bigBlind >= 2.00) return 5;
  if (bigBlind >= 0.50) return 2;
  return 1;
}

/**
 * Apply tier multiplier to base points.
 * @param {number} basePoints - Points before multiplier
 * @param {number} tierLevel - Current tier level (1-4)
 * @returns {number} Earned points after multiplier
 */
function applyMultiplier(basePoints, tierLevel) {
  const tier = TIERS.find(t => t.level === tierLevel);
  const multiplier = tier ? tier.multiplier : 1.0;
  return basePoints * multiplier;
}

/**
 * Get the stake bracket label for display.
 * @param {number} bigBlind - The big blind stake amount
 * @returns {string} Bracket label (Micro, Low, Mid, High)
 */
function getStakeBracket(bigBlind) {
  if (bigBlind >= 10.00) return 'High';
  if (bigBlind >= 2.00) return 'Mid';
  if (bigBlind >= 0.50) return 'Low';
  return 'Micro';
}

module.exports = { calculateBasePoints, applyMultiplier, getStakeBracket, STAKE_BRACKETS };
