'use strict';

/**
 * Rewards tier definitions.
 * Points thresholds for tier progression.
 */
const TIERS = {
  BRONZE: { name: 'Bronze', minPoints: 0, multiplier: 1.0 },
  SILVER: { name: 'Silver', minPoints: 500, multiplier: 1.25 },
  GOLD: { name: 'Gold', minPoints: 2000, multiplier: 1.5 },
  PLATINUM: { name: 'Platinum', minPoints: 10000, multiplier: 2.0 },
};

/**
 * Point award rules — how points are earned.
 */
const POINT_RULES = {
  HAND_PLAYED: { points: 1, description: 'Played a hand' },
  HAND_WON: { points: 5, description: 'Won a hand' },
  TOURNAMENT_ENTRY: { points: 10, description: 'Entered a tournament' },
  TOURNAMENT_WIN: { points: 50, description: 'Won a tournament' },
  DAILY_LOGIN: { points: 2, description: 'Daily login bonus' },
  REFERRAL: { points: 100, description: 'Referred a friend' },
};

/**
 * Get tier for a given point total.
 */
function getTierForPoints(points) {
  const tiers = Object.values(TIERS).sort((a, b) => b.minPoints - a.minPoints);
  return tiers.find((t) => points >= t.minPoints) || TIERS.BRONZE;
}

/**
 * Get the next tier above the current one (or null if at max).
 */
function getNextTier(currentTierName) {
  const tierOrder = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const currentIndex = tierOrder.indexOf(currentTierName);
  if (currentIndex === -1 || currentIndex === tierOrder.length - 1) return null;
  const nextName = tierOrder[currentIndex + 1];
  return Object.values(TIERS).find((t) => t.name === nextName);
}

/**
 * Milestone definitions — lifetime points thresholds that trigger notifications.
 */
const MILESTONES = [
  { points: 100, name: 'First Steps', message: "You've earned 100 lifetime points!" },
  { points: 500, name: 'Rising Star', message: '500 lifetime points — keep it up!' },
  { points: 1000, name: 'High Roller', message: '1,000 lifetime points earned!' },
  { points: 5000, name: 'Point Master', message: '5,000 lifetime points — impressive!' },
  { points: 10000, name: 'Legend', message: '10,000 lifetime points achieved!' },
];

/**
 * Standard error codes for API responses.
 */
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  DUPLICATE_HAND: 'DUPLICATE_HAND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
};

module.exports = { TIERS, POINT_RULES, getTierForPoints, getNextTier, MILESTONES, ERROR_CODES };
