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
    let remainingPoints = p.monthlyPoints;
    const transactions = [];

    // Generate transactions that sum to the player's monthlyPoints
    while (remainingPoints > 0) {
      const bracket = STAKE_BRACKETS[randomInt(0, Math.min(tier.level, STAKE_BRACKETS.length - 1))];
      const basePoints = bracket.basePoints;
      const multiplier = tier.multiplier;
      const earnedPoints = Math.round(basePoints * multiplier * 100) / 100;

      if (earnedPoints > remainingPoints) {
        // Final transaction: use exact remaining points
        const finalBase = Math.round((remainingPoints / multiplier) * 100) / 100;
        transactions.push({
          type: 'gameplay',
          basePoints: finalBase,
          multiplier,
          earnedPoints: remainingPoints,
          handId: `hand-${String(handCounter++).padStart(3, '0')}`,
          tableId: randomInt(1, 2),
          tableStakes: bracket.stakes,
          bigBlind: bracket.bigBlind,
        });
        remainingPoints = 0;
      } else {
        transactions.push({
          type: 'gameplay',
          basePoints,
          multiplier,
          earnedPoints,
          handId: `hand-${String(handCounter++).padStart(3, '0')}`,
          tableId: randomInt(1, 2),
          tableStakes: bracket.stakes,
          bigBlind: bracket.bigBlind,
        });
        remainingPoints -= earnedPoints;
      }

      // Safety: cap at 50 transactions per player
      if (transactions.length >= 50) {
        if (remainingPoints > 0) {
          transactions.push({
            type: 'adjustment',
            basePoints: remainingPoints,
            multiplier: 1.0,
            earnedPoints: remainingPoints,
            reason: 'Points reconciliation',
          });
          remainingPoints = 0;
        }
        break;
      }
    }

    // Write transactions with spread-out timestamps
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const dayOfMonth = Math.max(1, Math.min(21, Math.floor((i / transactions.length) * 20) + 1));
      const timestamp = randomTimestampThisMonth(dayOfMonth);

      await docClient.send(
        new PutCommand({
          TableName: TABLES.TRANSACTIONS,
          Item: {
            playerId: p.playerId,
            timestamp,
            handId: tx.handId,
            type: tx.type,
            basePoints: tx.basePoints,
            multiplier: tx.multiplier,
            earnedPoints: tx.earnedPoints,
            tableId: tx.tableId,
            tableStakes: tx.tableStakes,
            bigBlind: tx.bigBlind,
            monthKey: getCurrentMonthKey(),
            reason: tx.reason,
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

  // Milestones: only include ones the player has actually reached
  const MILESTONES = [
    { threshold: 100, title: 'First Steps', message: "You've earned 100 lifetime points!" },
    { threshold: 500, title: 'Rising Star', message: '500 lifetime points — keep it up!' },
    { threshold: 1000, title: 'High Roller', message: '1,000 lifetime points earned!' },
    { threshold: 5000, title: 'Point Master', message: '5,000 lifetime points — impressive!' },
    { threshold: 10000, title: 'Legend', message: '10,000 lifetime points achieved!' },
  ];

  for (const p of PLAYERS) {
    const notifications = [];

    // Add tier upgrade notification if player is above Bronze
    if (p.currentTier >= 2) {
      const tierName = getTierByLevel(p.currentTier).name;
      notifications.push({
        type: 'tier_upgrade',
        title: 'Tier Upgrade!',
        message: `Congratulations! You've reached ${tierName} tier`,
        daysAgo: randomInt(3, 15),
        dismissed: true,
      });
    }

    // Add milestone notifications only for milestones the player has actually passed
    const reachedMilestones = MILESTONES.filter((m) => p.lifetimePoints >= m.threshold);
    // Pick the most recent 1-2 milestones
    const recentMilestones = reachedMilestones.slice(-2);
    for (const m of recentMilestones) {
      notifications.push({
        type: 'milestone',
        title: m.title,
        message: m.message,
        daysAgo: randomInt(1, 20),
        dismissed: notifications.length > 0, // first one dismissed, last one unread
      });
    }

    // Make sure the last notification is unread
    if (notifications.length > 0) {
      notifications[notifications.length - 1].dismissed = false;
    }

    for (const n of notifications) {
      await docClient.send(
        new PutCommand({
          TableName: TABLES.NOTIFICATIONS,
          Item: {
            playerId: p.playerId,
            notificationId: crypto.randomUUID(),
            type: n.type,
            title: n.title,
            message: n.message,
            dismissed: n.dismissed,
            createdAt: new Date(Date.now() - n.daysAgo * 86400000).toISOString(),
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
