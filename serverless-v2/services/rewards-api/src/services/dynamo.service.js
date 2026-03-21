'use strict';

const crypto = require('crypto');
const { PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../../shared/config/dynamo');

const PLAYERS_TABLE = process.env.REWARDS_PLAYERS_TABLE || 'rewards-players';
const TRANSACTIONS_TABLE = process.env.REWARDS_TRANSACTIONS_TABLE || 'rewards-transactions';
const LEADERBOARD_TABLE = process.env.REWARDS_LEADERBOARD_TABLE || 'rewards-leaderboard';
const NOTIFICATIONS_TABLE = process.env.REWARDS_NOTIFICATIONS_TABLE || 'rewards-notifications';

/**
 * Get a player's rewards profile.
 */
async function getPlayer(playerId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: PLAYERS_TABLE,
      Key: { playerId },
    })
  );
  return result.Item || null;
}

/**
 * Create or update a player's rewards profile.
 */
async function putPlayer(player) {
  await docClient.send(
    new PutCommand({
      TableName: PLAYERS_TABLE,
      Item: player,
    })
  );
}

/**
 * Update specific attributes on a player record.
 */
async function updatePlayer(playerId, updates) {
  const expressions = [];
  const names = {};
  const values = {};

  Object.entries(updates).forEach(([key, value], i) => {
    expressions.push(`#k${i} = :v${i}`);
    names[`#k${i}`] = key;
    values[`:v${i}`] = value;
  });

  await docClient.send(
    new UpdateCommand({
      TableName: PLAYERS_TABLE,
      Key: { playerId },
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

/**
 * Record a point transaction.
 */
async function addTransaction(playerId, transaction) {
  await docClient.send(
    new PutCommand({
      TableName: TRANSACTIONS_TABLE,
      Item: {
        playerId,
        timestamp: Date.now(),
        ...transaction,
      },
    })
  );
}

/**
 * Get a player's transaction history.
 */
async function getTransactions(playerId, limit = 20) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TRANSACTIONS_TABLE,
      KeyConditionExpression: 'playerId = :pid',
      ExpressionAttributeValues: { ':pid': playerId },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return result.Items || [];
}

/**
 * Get all players (for leaderboard).
 */
async function getAllPlayers() {
  const result = await docClient.send(
    new ScanCommand({ TableName: PLAYERS_TABLE })
  );
  return result.Items || [];
}

/**
 * Query the handId-index GSI for idempotency checks.
 * @param {string} handId - The hand ID to look up
 * @returns {Promise<Array>} Matching transaction items
 */
async function queryByHandId(handId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TRANSACTIONS_TABLE,
      IndexName: 'handId-index',
      KeyConditionExpression: 'handId = :hid',
      ExpressionAttributeValues: { ':hid': handId },
    })
  );
  return result.Items || [];
}

/**
 * Create a transaction record in the immutable ledger.
 * @param {object} item - Full transaction item (must include playerId + timestamp as PK/SK)
 */
async function createTransaction(item) {
  await docClient.send(
    new PutCommand({
      TableName: TRANSACTIONS_TABLE,
      Item: item,
    })
  );
}

/**
 * Atomically update player points using DynamoDB ADD (prevents lost updates).
 * @param {string} playerId - Player identifier
 * @param {number} earnedPoints - Points to add
 * @returns {Promise<object>} Updated player record (ALL_NEW)
 */
async function atomicUpdatePlayerPoints(playerId, earnedPoints) {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: PLAYERS_TABLE,
      Key: { playerId },
      UpdateExpression: 'ADD monthlyPoints :pts, lifetimePoints :pts SET updatedAt = :now',
      ExpressionAttributeValues: {
        ':pts': earnedPoints,
        ':now': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes;
}

/**
 * Update a player's current tier level.
 * @param {string} playerId - Player identifier
 * @param {number} newTier - New tier level (1-4)
 */
async function updatePlayerTier(playerId, newTier) {
  await docClient.send(
    new UpdateCommand({
      TableName: PLAYERS_TABLE,
      Key: { playerId },
      UpdateExpression: 'SET currentTier = :tier, lastTierChangeAt = :now, updatedAt = :now',
      ExpressionAttributeValues: {
        ':tier': newTier,
        ':now': new Date().toISOString(),
      },
    })
  );
}

/**
 * Upsert a leaderboard entry for the current month.
 * @param {object} item - Leaderboard item (monthKey, playerId, monthlyPoints, displayName, tier)
 */
async function upsertLeaderboardEntry(item) {
  await docClient.send(
    new PutCommand({
      TableName: LEADERBOARD_TABLE,
      Item: item,
    })
  );
}

/**
 * Create a notification for a player with 30-day TTL.
 * @param {object} notification - Notification object (must include playerId)
 */
async function createNotification(notification) {
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  await docClient.send(
    new PutCommand({
      TableName: NOTIFICATIONS_TABLE,
      Item: {
        ...notification,
        notificationId: notification.notificationId || crypto.randomUUID(),
        dismissed: false,
        ttl,
      },
    })
  );
}

module.exports = {
  getPlayer,
  putPlayer,
  updatePlayer,
  addTransaction,
  getTransactions,
  getAllPlayers,
  queryByHandId,
  createTransaction,
  atomicUpdatePlayerPoints,
  updatePlayerTier,
  upsertLeaderboardEntry,
  createNotification,
};
