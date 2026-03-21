#!/usr/bin/env node

/**
 * Seed rewards DynamoDB tables with demo-ready data.
 *
 * Creates 6 players (matching MySQL seeds) across all tiers with realistic
 * transactions, leaderboard entries, tier history, and notifications.
 *
 * Run after `docker compose --profile rewards up`.
 *
 * Usage: node scripts/seed-rewards.js
 */

'use strict';

const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// ─── Table Names ──────────────────────────────────────────────────────
const TABLES = {
  PLAYERS: 'rewards-players',
  TRANSACTIONS: 'rewards-transactions',
  LEADERBOARD: 'rewards-leaderboard',
  TIER_HISTORY: 'rewards-tier-history',
  NOTIFICATIONS: 'rewards-notifications',
};

// ─── Tier Definitions ─────────────────────────────────────────────────
const TIERS = [
  { level: 1, name: 'Bronze', threshold: 0, multiplier: 1.0 },
  { level: 2, name: 'Silver', threshold: 500, multiplier: 1.25 },
  { level: 3, name: 'Gold', threshold: 2000, multiplier: 1.5 },
  { level: 4, name: 'Platinum', threshold: 10000, multiplier: 2.0 },
];

// ─── Stake Brackets ───────────────────────────────────────────────────
const STAKE_BRACKETS = [
  { maxBB: 0.49, basePoints: 1, stakes: '0.10/0.25', bigBlind: 0.25 },
  { maxBB: 1.99, basePoints: 2, stakes: '0.50/1', bigBlind: 1.00 },
  { maxBB: 9.99, basePoints: 5, stakes: '2/5', bigBlind: 5.00 },
  { maxBB: Infinity, basePoints: 10, stakes: '5/10', bigBlind: 10.00 },
];

// ─── Players (matching MySQL 01-schema.sql seeds) ─────────────────────
const PLAYERS = [
  { playerId: 'p1-uuid-0001', displayName: 'Alice', currentTier: 2, monthlyPoints: 750, lifetimePoints: 4200 },
  { playerId: 'p2-uuid-0002', displayName: 'Bob', currentTier: 3, monthlyPoints: 3200, lifetimePoints: 18500 },
  { playerId: 'p3-uuid-0003', displayName: 'Charlie', currentTier: 4, monthlyPoints: 12500, lifetimePoints: 45000 },
  { playerId: 'p4-uuid-0004', displayName: 'Diana', currentTier: 3, monthlyPoints: 2800, lifetimePoints: 9800 },
  { playerId: 'p5-uuid-0005', displayName: 'Eve', currentTier: 2, monthlyPoints: 980, lifetimePoints: 3600 },
  { playerId: 'p6-uuid-0006', displayName: 'Frank', currentTier: 1, monthlyPoints: 120, lifetimePoints: 420 },
];

// ─── Helpers ──────────────────────────────────────────────────────────

function getTierByLevel(level) {
  return TIERS.find((t) => t.level === level);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthKey(monthsAgo) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function randomTimestampThisMonth(dayOfMonth) {
  const now = new Date();
  const ts = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, randomInt(8, 22), randomInt(0, 59), randomInt(0, 59));
  return ts.getTime();
}

// ─── Seed: Players ────────────────────────────────────────────────────

async function seedPlayers() {
  console.log('Seeding players...');
  const now = new Date().toISOString();
  let count = 0;

  for (const p of PLAYERS) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.PLAYERS,
        Item: {
          playerId: p.playerId,
          displayName: p.displayName,
          currentTier: p.currentTier,
          monthlyPoints: p.monthlyPoints,
          lifetimePoints: p.lifetimePoints,
          lastTierChangeAt: now,
          lastResetMonth: getMonthKey(1),
          createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
          updatedAt: now,
        },
      })
    );
    count++;
  }
  console.log(`  Created ${count} players`);
}

// ─── Seed: Transactions ───────────────────────────────────────────────

async function seedTransactions() {
  console.log('Seeding transactions...');
  let count = 0;
  let handCounter = 1;

  for (const p of PLAYERS) {
    const tier = getTierByLevel(p.currentTier);
    const txCount = randomInt(10, 20);

    for (let i = 0; i < txCount; i++) {
      const isAdjustment = i >= txCount - 2 && Math.random() < 0.3;
      const type = isAdjustment ? 'adjustment' : 'gameplay';
      const dayOfMonth = Math.min(randomInt(1, 21), 21);
      const timestamp = randomTimestampThisMonth(dayOfMonth);

      let basePoints, multiplier, earnedPoints, handId, tableId, tableStakes, bigBlind, reason;

      if (type === 'gameplay') {
        const bracket = STAKE_BRACKETS[randomInt(0, STAKE_BRACKETS.length - 1)];
        basePoints = bracket.basePoints;
        multiplier = tier.multiplier;
        earnedPoints = Math.round(basePoints * multiplier * 100) / 100;
        handId = `hand-${String(handCounter++).padStart(3, '0')}`;
        tableId = randomInt(1, 2);
        tableStakes = bracket.stakes;
        bigBlind = bracket.bigBlind;
      } else {
        basePoints = randomInt(10, 50);
        multiplier = 1.0;
        earnedPoints = basePoints;
        reason = 'Tournament bonus credit';
      }

      await docClient.send(
        new PutCommand({
          TableName: TABLES.TRANSACTIONS,
          Item: {
            playerId: p.playerId,
            timestamp,
            handId,
            type,
            basePoints,
            multiplier,
            earnedPoints,
            tableId,
            tableStakes,
            bigBlind,
            monthKey: getCurrentMonthKey(),
            reason,
          },
        })
      );
      count++;
    }
  }
  console.log(`  Created ${count} transactions`);
}

// ─── Seed: Leaderboard ───────────────────────────────────────────────

async function seedLeaderboard() {
  console.log('Seeding leaderboard...');
  const monthKey = getCurrentMonthKey();
  let count = 0;

  for (const p of PLAYERS) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.LEADERBOARD,
        Item: {
          monthKey,
          playerId: p.playerId,
          displayName: p.displayName,
          tier: p.currentTier,
          monthlyPoints: p.monthlyPoints,
        },
      })
    );
    count++;
  }
  console.log(`  Created ${count} leaderboard entries`);
}

// ─── Seed: Tier History ───────────────────────────────────────────────

async function seedTierHistory() {
  console.log('Seeding tier history...');
  let count = 0;

  // Realistic tier progressions over the last 6 months for each player
  const progressions = {
    'p1-uuid-0001': [1, 1, 1, 1, 2, 2],       // Bronze -> Silver
    'p2-uuid-0002': [1, 2, 2, 2, 3, 3],       // Bronze -> Silver -> Gold
    'p3-uuid-0003': [2, 2, 3, 3, 4, 4],       // Silver -> Gold -> Platinum
    'p4-uuid-0004': [1, 1, 2, 2, 3, 3],       // Bronze -> Silver -> Gold
    'p5-uuid-0005': [1, 1, 1, 2, 2, 2],       // Bronze -> Silver
    'p6-uuid-0006': [1, 1, 1, 1, 1, 1],       // Always Bronze
  };

  // Monthly points that correspond to those tiers
  const monthlyPointsHistory = {
    'p1-uuid-0001': [120, 280, 350, 420, 680, 750],
    'p2-uuid-0002': [380, 520, 890, 1200, 2800, 3200],
    'p3-uuid-0003': [600, 950, 2400, 3800, 11000, 12500],
    'p4-uuid-0004': [150, 300, 700, 1100, 2500, 2800],
    'p5-uuid-0005': [80, 200, 350, 550, 720, 980],
    'p6-uuid-0006': [30, 50, 80, 60, 90, 120],
  };

  for (const p of PLAYERS) {
    const progression = progressions[p.playerId];
    const pointsHist = monthlyPointsHistory[p.playerId];

    for (let i = 0; i < 6; i++) {
      const monthsAgo = 5 - i; // 5 months ago to current month
      const monthKey = getMonthKey(monthsAgo);
      const tierLevel = progression[i];

      await docClient.send(
        new PutCommand({
          TableName: TABLES.TIER_HISTORY,
          Item: {
            playerId: p.playerId,
            monthKey,
            tier: tierLevel,
            monthlyPoints: pointsHist[i],
            peakTier: tierLevel,
          },
        })
      );
      count++;
    }
  }
  console.log(`  Created ${count} tier history entries`);
}

// ─── Seed: Notifications ──────────────────────────────────────────────

async function seedNotifications() {
  console.log('Seeding notifications...');
  let count = 0;
  const thirtyDaysFromNow = Math.floor(Date.now() / 1000) + 30 * 86400;

  const notificationTemplates = [
    { type: 'tier_upgrade', title: 'Tier Upgrade!', messageFn: (name) => `Congratulations! You've reached ${name} tier` },
    { type: 'milestone', title: 'Rising Star', messageFn: () => '500 points earned — Silver is within reach!' },
    { type: 'milestone', title: 'High Roller', messageFn: () => "1,000 points! You're on fire!" },
    { type: 'tier_upgrade', title: 'Welcome to Gold!', messageFn: () => "You've unlocked Gold tier — 1.5x multiplier active" },
    { type: 'milestone', title: 'First Steps', messageFn: () => "You've earned your first 100 points!" },
  ];

  for (const p of PLAYERS) {
    const tier = getTierByLevel(p.currentTier);
    const notifCount = randomInt(2, 3);

    for (let i = 0; i < notifCount; i++) {
      const template = notificationTemplates[randomInt(0, notificationTemplates.length - 1)];
      const dismissed = i < notifCount - 1; // last notification is unread
      const createdDaysAgo = randomInt(1, 20);

      await docClient.send(
        new PutCommand({
          TableName: TABLES.NOTIFICATIONS,
          Item: {
            playerId: p.playerId,
            notificationId: crypto.randomUUID(),
            type: template.type,
            title: template.title,
            message: template.messageFn(tier.name),
            dismissed,
            createdAt: new Date(Date.now() - createdDaysAgo * 86400000).toISOString(),
            ttl: thirtyDaysFromNow,
          },
        })
      );
      count++;
    }
  }
  console.log(`  Created ${count} notifications`);
}

// ─── Main ─────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding rewards data to ${ENDPOINT}...`);
  console.log('');

  await seedPlayers();
  await seedTransactions();
  await seedLeaderboard();
  await seedTierHistory();
  await seedNotifications();

  console.log('');
  console.log('Done! All rewards tables seeded with demo data.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
