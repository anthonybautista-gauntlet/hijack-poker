'use strict';

/**
 * Look up a player's display name from the MySQL players table.
 * @param {string} playerId - The player's GUID
 * @returns {Promise<string|null>} The username or null if not found
 */
async function lookupDisplayName(playerId) {
  try {
    const { sequelize } = require('../../shared/config/db');
    const { QueryTypes } = require('sequelize');
    const results = await sequelize.query(
      'SELECT username FROM players WHERE guid = :playerId LIMIT 1',
      {
        replacements: { playerId },
        type: QueryTypes.SELECT,
      }
    );
    if (results.length > 0) {
      return results[0].username;
    }
    return null;
  } catch (err) {
    // MySQL failure should not block points award — log and return null
    console.warn('MySQL player lookup failed:', err.message);
    return null;
  }
}

module.exports = { lookupDisplayName };
