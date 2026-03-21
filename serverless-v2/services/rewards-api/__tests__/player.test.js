'use strict';

/**
 * Tests for GET /api/v1/player/rewards,
 * GET /api/v1/player/rewards/history,
 * and GET /api/v1/leaderboard
 *
 * Mocks DynamoDB calls to test route handler logic.
 */

jest.mock('../shared/config/dynamo', () => ({
  docClient: { send: jest.fn() },
  ddbClient: {},
}));
jest.mock('../shared/config/db', () => ({
  sequelize: { query: jest.fn() },
}));

jest.mock('../src/services/dynamo.service');
jest.mock('../src/services/player-lookup.service');

const dynamoService = require('../src/services/dynamo.service');

const express = require('express');
const http = require('http');
const { authMiddleware } = require('../src/middleware/auth');
const playerRoute = require('../src/routes/player');
const pointsRoute = require('../src/routes/points');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/player', authMiddleware, playerRoute);
  // Leaderboard mounted at /api/v1 (public, no auth required)
  app.use('/api/v1', pointsRoute);
  return app;
}

function request(app) {
  const server = http.createServer(app);

  function makeRequest(method, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const bodyStr = body ? JSON.stringify(body) : '';
        const reqHeaders = {
          'Content-Type': 'application/json',
          ...headers,
        };

        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path,
            method,
            headers: reqHeaders,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              server.close();
              try {
                resolve({ status: res.statusCode, body: JSON.parse(data) });
              } catch (e) {
                resolve({ status: res.statusCode, body: data });
              }
            });
          }
        );

        req.on('error', (err) => {
          server.close();
          reject(err);
        });

        if (bodyStr) {
          req.write(bodyStr);
        }
        req.end();
      });
    });
  }

  return {
    post: (path, body, headers) => makeRequest('POST', path, body, headers),
    get: (path, headers) => makeRequest('GET', path, null, headers),
  };
}

const HEADERS = { 'X-Player-Id': 'p1-uuid-0001' };

const MOCK_PLAYER = {
  playerId: 'p1-uuid-0001',
  displayName: 'Alice',
  currentTier: 3,
  monthlyPoints: 2500,
  lifetimePoints: 45000,
  lastResetMonth: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-03-21T00:00:00.000Z',
};

const MOCK_TRANSACTIONS = [
  {
    playerId: 'p1-uuid-0001',
    timestamp: '2026-03-21T14:30:00.000Z#a3f2',
    type: 'gameplay',
    basePoints: 5,
    multiplier: 1.5,
    earnedPoints: 7.5,
    handId: 'hand-789',
    tableStakes: '2/5',
    bigBlind: 5,
    monthKey: '2026-03',
  },
  {
    playerId: 'p1-uuid-0001',
    timestamp: '2026-03-21T14:00:00.000Z#b1c4',
    type: 'gameplay',
    basePoints: 2,
    multiplier: 1.5,
    earnedPoints: 3,
    handId: 'hand-788',
    tableStakes: '1/2',
    bigBlind: 1,
    monthKey: '2026-03',
  },
];

const MOCK_LEADERBOARD_ENTRIES = [
  { monthKey: '2026-03', playerId: 'p3-xyz', displayName: 'Charlie', tier: 4, monthlyPoints: 15000 },
  { monthKey: '2026-03', playerId: 'p1-uuid-0001', displayName: 'Alice', tier: 3, monthlyPoints: 2500 },
  { monthKey: '2026-03', playerId: 'p2-abc', displayName: 'Bob', tier: 2, monthlyPoints: 800 },
];

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /api/v1/player/rewards ──────────────────────────────────────────────

describe('GET /api/v1/player/rewards', () => {
  test('returns 200 with correct response shape for Gold player', async () => {
    dynamoService.getPlayer.mockResolvedValue({ ...MOCK_PLAYER });

    const app = createApp();
    const res = await request(app).get('/api/v1/player/rewards', HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.playerId).toBe('p1-uuid-0001');
    expect(res.body.displayName).toBe('Alice');
    expect(res.body.currentTier).toEqual({
      level: 3,
      name: 'Gold',
      multiplier: 1.5,
    });
    expect(res.body.monthlyPoints).toBe(2500);
    expect(res.body.lifetimePoints).toBe(45000);
    expect(res.body.monthKey).toMatch(/^\d{4}-\d{2}$/);
  });

  test('includes nextTier info for non-Platinum players', async () => {
    dynamoService.getPlayer.mockResolvedValue({ ...MOCK_PLAYER });

    const app = createApp();
    const res = await request(app).get('/api/v1/player/rewards', HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.nextTier).toBeDefined();
    expect(res.body.nextTier.level).toBe(4);
    expect(res.body.nextTier.name).toBe('Platinum');
    expect(res.body.nextTier.threshold).toBe(10000);
    expect(res.body.nextTier.pointsNeeded).toBe(7500);
    expect(res.body.nextTier.progressPercent).toBe(25);
  });

  test('nextTier is null for Platinum players', async () => {
    dynamoService.getPlayer.mockResolvedValue({
      ...MOCK_PLAYER,
      currentTier: 4,
      monthlyPoints: 15000,
    });

    const app = createApp();
    const res = await request(app).get('/api/v1/player/rewards', HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.currentTier.level).toBe(4);
    expect(res.body.currentTier.name).toBe('Platinum');
    expect(res.body.nextTier).toBeNull();
  });

  test('returns 404 when player not found', async () => {
    dynamoService.getPlayer.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/api/v1/player/rewards', HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYER_NOT_FOUND');
  });

  test('returns 401 without X-Player-Id header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/player/rewards', {});

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/player/rewards/history ──────────────────────────────────────

describe('GET /api/v1/player/rewards/history', () => {
  test('returns transactions array and pagination', async () => {
    dynamoService.getTransactionsByPlayer.mockResolvedValue([...MOCK_TRANSACTIONS]);

    const app = createApp();
    const res = await request(app).get('/api/v1/player/rewards/history', HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.pagination).toEqual({
      limit: 20,
      offset: 0,
      total: 2,
    });
  });

  test('returns empty transactions array when none found', async () => {
    dynamoService.getTransactionsByPlayer.mockResolvedValue([]);

    const app = createApp();
    const res = await request(app).get('/api/v1/player/rewards/history', HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  test('respects limit and offset query params', async () => {
    // Create 5 mock transactions
    const txns = Array.from({ length: 5 }, (_, i) => ({
      ...MOCK_TRANSACTIONS[0],
      timestamp: `2026-03-21T14:${String(30 - i).padStart(2, '0')}:00.000Z#aaaa`,
    }));
    dynamoService.getTransactionsByPlayer.mockResolvedValue(txns);

    const app = createApp();
    const res = await request(app).get(
      '/api/v1/player/rewards/history?limit=2&offset=1',
      HEADERS
    );

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.pagination).toEqual({
      limit: 2,
      offset: 1,
      total: 5,
    });
  });

  test('returns 400 for invalid limit', async () => {
    const app = createApp();
    const res = await request(app).get(
      '/api/v1/player/rewards/history?limit=200',
      HEADERS
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 401 without X-Player-Id header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/player/rewards/history', {});

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/leaderboard ─────────────────────────────────────────────────

describe('GET /api/v1/leaderboard', () => {
  test('returns sorted leaderboard with ranks', async () => {
    dynamoService.queryLeaderboard.mockResolvedValue([...MOCK_LEADERBOARD_ENTRIES]);
    dynamoService.getFullLeaderboard.mockResolvedValue([...MOCK_LEADERBOARD_ENTRIES]);

    const app = createApp();
    const res = await request(app).get('/api/v1/leaderboard', HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.monthKey).toMatch(/^\d{4}-\d{2}$/);
    expect(res.body.leaderboard).toHaveLength(3);

    // Verify rank ordering
    expect(res.body.leaderboard[0].rank).toBe(1);
    expect(res.body.leaderboard[0].displayName).toBe('Charlie');
    expect(res.body.leaderboard[0].monthlyPoints).toBe(15000);
    expect(res.body.leaderboard[0].tier).toEqual({ level: 4, name: 'Platinum' });

    expect(res.body.leaderboard[1].rank).toBe(2);
    expect(res.body.leaderboard[2].rank).toBe(3);
  });

  test('includes playerRank when X-Player-Id is present', async () => {
    dynamoService.queryLeaderboard.mockResolvedValue([...MOCK_LEADERBOARD_ENTRIES]);
    dynamoService.getFullLeaderboard.mockResolvedValue([...MOCK_LEADERBOARD_ENTRIES]);

    const app = createApp();
    const res = await request(app).get('/api/v1/leaderboard', HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.playerRank).toEqual({
      rank: 2,
      monthlyPoints: 2500,
    });
  });

  test('playerRank is null when player not on leaderboard', async () => {
    dynamoService.queryLeaderboard.mockResolvedValue([...MOCK_LEADERBOARD_ENTRIES]);
    dynamoService.getFullLeaderboard.mockResolvedValue([...MOCK_LEADERBOARD_ENTRIES]);

    const app = createApp();
    const res = await request(app).get('/api/v1/leaderboard', {
      'X-Player-Id': 'p99-not-on-board',
    });

    expect(res.status).toBe(200);
    expect(res.body.playerRank).toBeNull();
  });

  test('playerRank is null when no X-Player-Id header', async () => {
    dynamoService.queryLeaderboard.mockResolvedValue([...MOCK_LEADERBOARD_ENTRIES]);

    const app = createApp();
    const res = await request(app).get('/api/v1/leaderboard', {});

    expect(res.status).toBe(200);
    expect(res.body.playerRank).toBeNull();
  });

  test('accepts monthKey query param', async () => {
    dynamoService.queryLeaderboard.mockResolvedValue([]);

    const app = createApp();
    const res = await request(app).get('/api/v1/leaderboard?monthKey=2026-02', {});

    expect(res.status).toBe(200);
    expect(res.body.monthKey).toBe('2026-02');
    expect(res.body.leaderboard).toEqual([]);
  });

  test('returns 400 for invalid monthKey format', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/leaderboard?monthKey=invalid', {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for limit > 100', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/leaderboard?limit=101', {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
