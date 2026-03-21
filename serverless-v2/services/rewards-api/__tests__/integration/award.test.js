'use strict';

/**
 * Integration tests for POST /api/v1/points/award
 *
 * Mocks DynamoDB and MySQL calls to test the route handler logic
 * without requiring Docker containers running.
 */

// Mock shared config modules to avoid needing actual AWS SDK / MySQL
jest.mock('../../shared/config/dynamo', () => ({
  docClient: { send: jest.fn() },
  ddbClient: {},
}));
jest.mock('../../shared/config/db', () => ({
  sequelize: { query: jest.fn() },
}));

// Mock dynamo.service and player-lookup before any require that loads them
jest.mock('../../src/services/dynamo.service');
jest.mock('../../src/services/player-lookup.service');

const dynamoService = require('../../src/services/dynamo.service');
const playerLookupService = require('../../src/services/player-lookup.service');

// Build a minimal Express app with the points route for testing
const express = require('express');
const { authMiddleware } = require('../../src/middleware/auth');
const pointsRoute = require('../../src/routes/points');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/points', authMiddleware, pointsRoute);
  return app;
}

// Inline supertest-like helper using Node's built-in http
const http = require('http');

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

const VALID_BODY = {
  playerId: 'p1-uuid-0001',
  tableId: 1,
  tableStakes: '2/5',
  bigBlind: 5.0,
  handId: 'hand-test-001',
};

const HEADERS = { 'X-Player-Id': 'p1-uuid-0001' };

const MOCK_PLAYER = {
  playerId: 'p1-uuid-0001',
  displayName: 'Alice',
  currentTier: 1,
  monthlyPoints: 100,
  lifetimePoints: 400,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setupDefaultMocks() {
  dynamoService.queryByHandId.mockResolvedValue([]);
  dynamoService.getPlayer.mockResolvedValue({ ...MOCK_PLAYER });
  dynamoService.createTransaction.mockResolvedValue(undefined);
  dynamoService.atomicUpdatePlayerPoints.mockResolvedValue({
    ...MOCK_PLAYER,
    monthlyPoints: 105,
    lifetimePoints: 405,
    updatedAt: new Date().toISOString(),
  });
  dynamoService.updatePlayerTier.mockResolvedValue(undefined);
  dynamoService.upsertLeaderboardEntry.mockResolvedValue(undefined);
  dynamoService.createNotification.mockResolvedValue(undefined);
  dynamoService.putPlayer.mockResolvedValue(undefined);
  playerLookupService.lookupDisplayName.mockResolvedValue('Alice');
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaultMocks();
});

describe('POST /api/v1/points/award', () => {
  test('valid award request returns 200 with correct response shape', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('playerId', 'p1-uuid-0001');
    expect(res.body).toHaveProperty('basePoints');
    expect(res.body).toHaveProperty('multiplier');
    expect(res.body).toHaveProperty('earnedPoints');
    expect(res.body).toHaveProperty('monthlyPoints');
    expect(res.body).toHaveProperty('currentTier');
    expect(res.body.currentTier).toHaveProperty('level');
    expect(res.body.currentTier).toHaveProperty('name');
    expect(res.body).toHaveProperty('tierChanged');
    expect(typeof res.body.tierChanged).toBe('boolean');
  });

  test('points calculation is correct — base x multiplier', async () => {
    const app = createApp();
    // bigBlind 5.0 → bracket Mid → basePoints 5
    // tier 1 (Bronze) → multiplier 1.0
    // earnedPoints = 5 * 1.0 = 5
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.basePoints).toBe(5);
    expect(res.body.multiplier).toBe(1.0);
    expect(res.body.earnedPoints).toBe(5);
  });

  test('duplicate handId returns 409', async () => {
    dynamoService.queryByHandId.mockResolvedValue([
      { playerId: 'p1-uuid-0001', handId: 'hand-test-001' },
    ]);

    const app = createApp();
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_HAND');
    expect(res.body.error.message).toContain('hand-test-001');
  });

  test('same handId for different player is not a duplicate', async () => {
    // GSI returns a result but for a DIFFERENT player
    dynamoService.queryByHandId.mockResolvedValue([
      { playerId: 'p2-uuid-0002', handId: 'hand-test-001' },
    ]);

    const app = createApp();
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(res.status).toBe(200);
  });

  test('invalid request body returns 400', async () => {
    const app = createApp();

    // Missing required fields
    const res = await request(app).post(
      '/api/v1/points/award',
      { playerId: 'p1' },
      HEADERS
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('player auto-provisioning works when player does not exist', async () => {
    dynamoService.getPlayer.mockResolvedValue(null);
    playerLookupService.lookupDisplayName.mockResolvedValue('NewPlayer');

    const app = createApp();
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(res.status).toBe(200);

    // Verify putPlayer was called with auto-provisioned data
    expect(dynamoService.putPlayer).toHaveBeenCalledTimes(1);
    const createdPlayer = dynamoService.putPlayer.mock.calls[0][0];
    expect(createdPlayer.playerId).toBe('p1-uuid-0001');
    expect(createdPlayer.displayName).toBe('NewPlayer');
    expect(createdPlayer.currentTier).toBe(1);
    expect(createdPlayer.monthlyPoints).toBe(0);
    expect(createdPlayer.lifetimePoints).toBe(0);
  });

  test('auto-provisioning uses "Player" when MySQL lookup fails', async () => {
    dynamoService.getPlayer.mockResolvedValue(null);
    playerLookupService.lookupDisplayName.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(res.status).toBe(200);
    const createdPlayer = dynamoService.putPlayer.mock.calls[0][0];
    expect(createdPlayer.displayName).toBe('Player');
  });

  test('tier advancement triggers when threshold is crossed', async () => {
    // Player is at Bronze (tier 1), after award they'll have 500+ monthly → Silver
    const playerAtBronze = { ...MOCK_PLAYER, currentTier: 1, monthlyPoints: 495, lifetimePoints: 495 };
    dynamoService.getPlayer.mockResolvedValue(playerAtBronze);
    dynamoService.atomicUpdatePlayerPoints.mockResolvedValue({
      ...playerAtBronze,
      monthlyPoints: 500, // Exactly at Silver threshold
      lifetimePoints: 500,
      updatedAt: new Date().toISOString(),
    });

    const app = createApp();
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.tierChanged).toBe(true);
    expect(res.body.currentTier.level).toBe(2);
    expect(res.body.currentTier.name).toBe('Silver');

    // Verify tier update and notification were created
    expect(dynamoService.updatePlayerTier).toHaveBeenCalledWith('p1-uuid-0001', 2);
    expect(dynamoService.createNotification).toHaveBeenCalled();
    const notification = dynamoService.createNotification.mock.calls[0][0];
    expect(notification.type).toBe('tier_upgrade');
  });

  test('milestone notification created when lifetime threshold crossed', async () => {
    // Player lifetime at 95, after earning 5 points crosses 100 milestone
    const player = { ...MOCK_PLAYER, lifetimePoints: 95, monthlyPoints: 95 };
    dynamoService.getPlayer.mockResolvedValue(player);
    dynamoService.atomicUpdatePlayerPoints.mockResolvedValue({
      ...player,
      monthlyPoints: 100,
      lifetimePoints: 100,
      updatedAt: new Date().toISOString(),
    });

    const app = createApp();
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(res.status).toBe(200);

    // Find the milestone notification call (not tier notification)
    const notifCalls = dynamoService.createNotification.mock.calls;
    const milestoneNotif = notifCalls.find((c) => c[0].type === 'milestone');
    expect(milestoneNotif).toBeDefined();
    expect(milestoneNotif[0].title).toBe('First Steps');
  });

  test('leaderboard entry is updated after award', async () => {
    const app = createApp();
    await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(dynamoService.upsertLeaderboardEntry).toHaveBeenCalledTimes(1);
    const entry = dynamoService.upsertLeaderboardEntry.mock.calls[0][0];
    expect(entry.playerId).toBe('p1-uuid-0001');
    expect(entry).toHaveProperty('monthKey');
    expect(entry).toHaveProperty('monthlyPoints');
    expect(entry).toHaveProperty('displayName');
    expect(entry).toHaveProperty('tier');
  });

  test('transaction is written to the immutable ledger', async () => {
    const app = createApp();
    await request(app).post('/api/v1/points/award', VALID_BODY, HEADERS);

    expect(dynamoService.createTransaction).toHaveBeenCalledTimes(1);
    const txn = dynamoService.createTransaction.mock.calls[0][0];
    expect(txn.playerId).toBe('p1-uuid-0001');
    expect(txn.handId).toBe('hand-test-001');
    expect(txn.type).toBe('gameplay');
    expect(txn.basePoints).toBe(5);
    expect(txn.multiplier).toBe(1.0);
    expect(txn.earnedPoints).toBe(5);
    expect(txn.tableId).toBe(1);
    expect(txn.tableStakes).toBe('2/5');
    expect(txn.bigBlind).toBe(5.0);
    expect(txn).toHaveProperty('monthKey');
    expect(txn).toHaveProperty('timestamp');
  });

  test('returns 401 without X-Player-Id header', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/points/award', VALID_BODY, {});

    expect(res.status).toBe(401);
  });
});
