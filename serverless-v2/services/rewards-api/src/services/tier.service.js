'use strict';

/**
 * Tier definitions — ordered by level.
 * Each tier has: level, name, threshold (monthly points to reach), multiplier.
 */
const TIERS = [
  { level: 1, name: 'Bronze', threshold: 0, multiplier: 1.0 },
  { level: 2, name: 'Silver', threshold: 500, multiplier: 1.25 },
  { level: 3, name: 'Gold', threshold: 2000, multiplier: 1.5 },
  { level: 4, name: 'Platinum', threshold: 10000, multiplier: 2.0 },
];

/**
 * Get tier info for a given tier level.
 * @param {number} tierLevel - Tier level (1-4)
 * @returns {object|null} Tier object or null if invalid
 */
function getTierInfo(tierLevel) {
  return TIERS.find(t => t.level === tierLevel) || null;
}

/**
 * Determine which tier level a player should be at based on monthly points.
 * @param {number} monthlyPoints - Points earned this month
 * @returns {number} Tier level (1-4)
 */
function getTierForPoints(monthlyPoints) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (monthlyPoints >= TIERS[i].threshold) {
      return TIERS[i].level;
    }
  }
  return 1;
}

/**
 * Check if a player should advance to a higher tier.
 * @param {number} currentTier - Current tier level (1-4)
 * @param {number} monthlyPoints - Current monthly points
 * @returns {object|null} { advanced, newTier, tierInfo } or null if no advancement
 */
function checkTierAdvancement(currentTier, monthlyPoints) {
  const deservedTier = getTierForPoints(monthlyPoints);
  if (deservedTier > currentTier) {
    return {
      advanced: true,
      newTier: deservedTier,
      tierInfo: getTierInfo(deservedTier),
    };
  }
  return null;
}

/**
 * Calculate the tier after monthly reset.
 * Floor protection: cannot drop more than 1 tier per reset.
 * @param {number} currentTier - Current tier level (1-4)
 * @returns {number} New tier level after reset
 */
function calculateResetTier(currentTier) {
  return Math.max(currentTier - 1, 1);
}

module.exports = { TIERS, getTierInfo, getTierForPoints, checkTierAdvancement, calculateResetTier };
