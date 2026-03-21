'use strict';

const { getTierInfo } = require('./tier.service');
const { MILESTONES } = require('../config/constants');

/**
 * Create a notification object for a tier change.
 * @param {string} playerId - Player identifier
 * @param {number} oldTier - Previous tier level
 * @param {number} newTier - New tier level
 * @returns {object} Notification object
 */
function createTierChangeNotification(playerId, oldTier, newTier) {
  const tierInfo = getTierInfo(newTier);
  const tierName = tierInfo ? tierInfo.name : 'Unknown';
  const isUpgrade = newTier > oldTier;

  return {
    playerId,
    type: isUpgrade ? 'tier_upgrade' : 'tier_downgrade',
    title: isUpgrade ? 'Tier Upgrade!' : 'Tier Reset',
    message: isUpgrade
      ? `Congratulations! You've reached ${tierName} tier`
      : `Your tier has been adjusted to ${tierName}`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Check if any milestone thresholds were crossed.
 * @param {number} currentLifetimePoints - Current lifetime point total
 * @param {number} previousLifetimePoints - Previous lifetime point total (before this award)
 * @returns {Array} Array of milestone notification objects
 */
function checkMilestones(currentLifetimePoints, previousLifetimePoints) {
  const crossed = [];

  for (const milestone of MILESTONES) {
    if (previousLifetimePoints < milestone.points && currentLifetimePoints >= milestone.points) {
      crossed.push({
        type: 'milestone',
        title: milestone.name,
        message: milestone.message,
        points: milestone.points,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return crossed;
}

module.exports = { createTierChangeNotification, checkMilestones };
