'use strict';

// Manual factory mock for dynamo.service — prevents AWS SDK from loading
jest.mock('../src/services/dynamo.service', () => ({
  getPlayer: jest.fn(),
  putPlayer: jest.fn(),
  updatePlayer: jest.fn(),
  addTransaction: jest.fn(),
  getTransactions: jest.fn(),
  getAllPlayers: jest.fn(),
  queryByHandId: jest.fn(),
  createTransaction: jest.fn(),
  atomicUpdatePlayerPoints: jest.fn(),
  updatePlayerTier: jest.fn(),
  upsertLeaderboardEntry: jest.fn(),
  createNotification: jest.fn(),
  getNotifications: jest.fn(),
  dismissNotification: jest.fn(),
  scanAllPlayers: jest.fn(),
  getTierHistory: jest.fn(),
  batchWriteTierHistory: jest.fn(),
  resetPlayerMonth: jest.fn(),
  queryLeaderboard: jest.fn(),
  getTransactionsByPlayer: jest.fn(),
  getFullLeaderboard: jest.fn(),
}));

const dynamo = require('../src/services/dynamo.service');

describe('Admin Endpoints', () => {
  const TEST_KEY = 'test-admin-key-12345';
  let adminRouter;

  beforeAll(() => {
    process.env.ADMIN_API_KEY = TEST_KEY;
    adminRouter = require('../src/routes/admin');
  });

  afterAll(() => {
    delete process.env.ADMIN_API_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper: create a lightweight Express app with admin routes
  function createTestApp() {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
    return app;
  }

  // Helper: make HTTP request to test app
  function makeRequest(app, method, path, options = {}) {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const port = server.address().port;
        const headers = { ...options.headers };
        if (!options.skipAuth && !('x-admin-key' in headers)) {
          headers['x-admin-key'] = TEST_KEY;
        }
        if (options.body) {
          headers['Content-Type'] = 'application/json';
        }

        const req = http.request(
          { hostname: 'localhost', port, path, method, headers },
          (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              server.close();
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            });
          }
        );
        req.on('error', (err) => {
          server.close();
          reject(err);
        });
        if (options.body) {
          req.write(JSON.stringify(options.body));
        }
        req.end();
      });
    });
  }

  describe('Admin Auth on admin routes', () => {
    it('should return 401 when admin key is missing', async () => {
      const app = createTestApp();
      const result = await makeRequest(app, 'GET', '/admin/leaderboard', {
        skipAuth: true,
      });
      expect(result.status).toBe(401);
    });

    it('should return 403 when admin key is wrong', async () => {
      const app = createTestApp();
      dynamo.queryLeaderboard.mockResolvedValue([]);
      const result = await makeRequest(app, 'GET', '/admin/leaderboard', {
        headers: { 'x-admin-key': 'wrong-key' },
      });
      expect(result.status).toBe(403);
    });

    it('should pass with valid admin key', async () => {
      const app = createTestApp();
      dynamo.queryLeaderboard.mockResolvedValue([]);
      const result = await makeRequest(app, 'GET', '/admin/leaderboard');
      expect(result.status).toBe(200);
    });
  });

  describe('GET /admin/players/:playerId/rewards', () => {
    it('should return player data with transactions and tier history', async () => {
      const mockPlayer = {
        playerId: 'p1',
        displayName: 'Alice',
        currentTier: 3,
        monthlyPoints: 2500,
        lifetimePoints: 45000,
      };
      const mockTransactions = [
        { playerId: 'p1', timestamp: '2026-03-21T10:00:00.000Z', type: 'gameplay', earnedPoints: 10 },
      ];
      const mockTierHistory = [
        { playerId: 'p1', monthKey: '2026-02', tier: 2, monthlyPoints: 800 },
      ];

      dynamo.getPlayer.mockResolvedValue(mockPlayer);
      dynamo.getTransactions.mockResolvedValue(mockTransactions);
      dynamo.getTierHistory.mockResolvedValue(mockTierHistory);

      const app = createTestApp();
      const result = await makeRequest(app, 'GET', '/admin/players/p1/rewards');

      expect(result.status).toBe(200);
      expect(result.body.player).toEqual(mockPlayer);
      expect(result.body.transactions).toEqual(mockTransactions);
      expect(result.body.tierHistory).toEqual(mockTierHistory);
      expect(dynamo.getPlayer).toHaveBeenCalledWith('p1');
      expect(dynamo.getTransactions).toHaveBeenCalledWith('p1', 20);
      expect(dynamo.getTierHistory).toHaveBeenCalledWith('p1', 6);
    });

    it('should return 404 when player not found', async () => {
      dynamo.getPlayer.mockResolvedValue(null);

      const app = createTestApp();
      const result = await makeRequest(app, 'GET', '/admin/players/unknown/rewards');

      expect(result.status).toBe(404);
      expect(result.body.error.code).toBe('PLAYER_NOT_FOUND');
    });
  });

  describe('POST /admin/points/adjust', () => {
    it('should adjust points positively and create ledger entry', async () => {
      const mockPlayer = {
        playerId: 'p1',
        displayName: 'Alice',
        currentTier: 1,
        monthlyPoints: 100,
        lifetimePoints: 500,
      };
      dynamo.getPlayer.mockResolvedValue(mockPlayer);
      dynamo.createTransaction.mockResolvedValue();
      dynamo.atomicUpdatePlayerPoints.mockResolvedValue({
        monthlyPoints: 200,
        lifetimePoints: 600,
      });
      dynamo.upsertLeaderboardEntry.mockResolvedValue();

      const app = createTestApp();
      const result = await makeRequest(app, 'POST', '/admin/points/adjust', {
        body: { playerId: 'p1', points: 100, reason: 'Bonus' },
      });

      expect(result.status).toBe(200);
      expect(result.body.adjustment).toBe(100);
      expect(result.body.currentPoints.monthly).toBe(200);
      expect(result.body.currentPoints.lifetime).toBe(600);

      expect(dynamo.createTransaction).toHaveBeenCalledTimes(1);
      const txn = dynamo.createTransaction.mock.calls[0][0];
      expect(txn.type).toBe('adjustment');
      expect(txn.reason).toBe('Bonus');
      expect(txn.earnedPoints).toBe(100);
      expect(txn.monthKey).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should adjust points negatively', async () => {
      const mockPlayer = {
        playerId: 'p1',
        displayName: 'Alice',
        currentTier: 2,
        monthlyPoints: 600,
        lifetimePoints: 2000,
      };
      dynamo.getPlayer.mockResolvedValue(mockPlayer);
      dynamo.createTransaction.mockResolvedValue();
      dynamo.atomicUpdatePlayerPoints.mockResolvedValue({
        monthlyPoints: 400,
        lifetimePoints: 1800,
      });
      dynamo.upsertLeaderboardEntry.mockResolvedValue();

      const app = createTestApp();
      const result = await makeRequest(app, 'POST', '/admin/points/adjust', {
        body: { playerId: 'p1', points: -200, reason: 'Correction' },
      });

      expect(result.status).toBe(200);
      expect(result.body.adjustment).toBe(-200);
      const txn = dynamo.createTransaction.mock.calls[0][0];
      expect(txn.earnedPoints).toBe(-200);
    });

    it('should return 404 when player not found', async () => {
      dynamo.getPlayer.mockResolvedValue(null);

      const app = createTestApp();
      const result = await makeRequest(app, 'POST', '/admin/points/adjust', {
        body: { playerId: 'unknown', points: 100, reason: 'Test' },
      });

      expect(result.status).toBe(404);
      expect(result.body.error.code).toBe('PLAYER_NOT_FOUND');
    });
  });

  describe('POST /admin/tier/override', () => {
    it('should override tier and create notification', async () => {
      const mockPlayer = {
        playerId: 'p1',
        displayName: 'Alice',
        currentTier: 1,
        monthlyPoints: 100,
      };
      dynamo.getPlayer.mockResolvedValue(mockPlayer);
      dynamo.updatePlayerTier.mockResolvedValue();
      dynamo.createNotification.mockResolvedValue();

      const app = createTestApp();
      const result = await makeRequest(app, 'POST', '/admin/tier/override', {
        body: { playerId: 'p1', tier: 3, reason: 'VIP player' },
      });

      expect(result.status).toBe(200);
      expect(result.body.previousTier).toBe(1);
      expect(result.body.currentTier).toBe(3);
      expect(result.body.reason).toBe('VIP player');
      expect(dynamo.updatePlayerTier).toHaveBeenCalledWith('p1', 3);
      expect(dynamo.createNotification).toHaveBeenCalledTimes(1);

      const notif = dynamo.createNotification.mock.calls[0][0];
      expect(notif.playerId).toBe('p1');
      expect(notif.type).toBe('tier_upgrade');
      expect(notif.message).toContain('Gold');
      expect(notif.message).toContain('VIP player');
    });

    it('should return 404 when player not found', async () => {
      dynamo.getPlayer.mockResolvedValue(null);

      const app = createTestApp();
      const result = await makeRequest(app, 'POST', '/admin/tier/override', {
        body: { playerId: 'unknown', tier: 2, reason: 'Test' },
      });

      expect(result.status).toBe(404);
    });
  });

  describe('POST /admin/monthly-reset', () => {
    it('should process all players, record history, reset points, and notify downgrades', async () => {
      const mockPlayers = [
        { playerId: 'p1', currentTier: 3, monthlyPoints: 2500, displayName: 'Alice' },
        { playerId: 'p2', currentTier: 1, monthlyPoints: 100, displayName: 'Bob' },
        { playerId: 'p3', currentTier: 4, monthlyPoints: 15000, displayName: 'Charlie' },
      ];

      dynamo.scanAllPlayers.mockResolvedValue(mockPlayers);
      dynamo.resetPlayerMonth.mockResolvedValue();
      dynamo.batchWriteTierHistory.mockResolvedValue();
      dynamo.createNotification.mockResolvedValue();

      const app = createTestApp();
      const result = await makeRequest(app, 'POST', '/admin/monthly-reset');

      expect(result.status).toBe(200);
      expect(result.body.playersProcessed).toBe(3);

      // p1: tier 3 -> 2 (downgrade), p2: tier 1 -> 1 (no change), p3: tier 4 -> 3 (downgrade)
      expect(result.body.tierChanges).toHaveLength(2);
      expect(result.body.tierChanges).toEqual(
        expect.arrayContaining([
          { playerId: 'p1', from: 3, to: 2 },
          { playerId: 'p3', from: 4, to: 3 },
        ])
      );

      // resetPlayerMonth called for each player
      expect(dynamo.resetPlayerMonth).toHaveBeenCalledTimes(3);
      expect(dynamo.resetPlayerMonth).toHaveBeenCalledWith('p1', 2);
      expect(dynamo.resetPlayerMonth).toHaveBeenCalledWith('p2', 1);
      expect(dynamo.resetPlayerMonth).toHaveBeenCalledWith('p3', 3);

      // Batch write tier history
      expect(dynamo.batchWriteTierHistory).toHaveBeenCalledTimes(1);
      const historyItems = dynamo.batchWriteTierHistory.mock.calls[0][0];
      expect(historyItems).toHaveLength(3);

      // Notifications for downgrades only (p1 and p3)
      expect(dynamo.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should handle empty player list gracefully', async () => {
      dynamo.scanAllPlayers.mockResolvedValue([]);

      const app = createTestApp();
      const result = await makeRequest(app, 'POST', '/admin/monthly-reset');

      expect(result.status).toBe(200);
      expect(result.body.playersProcessed).toBe(0);
      expect(result.body.tierChanges).toHaveLength(0);
      expect(dynamo.batchWriteTierHistory).not.toHaveBeenCalled();
    });

    it('should not downgrade Bronze players (tier 1 stays at 1)', async () => {
      dynamo.scanAllPlayers.mockResolvedValue([
        { playerId: 'p1', currentTier: 1, monthlyPoints: 50, displayName: 'Bob' },
      ]);
      dynamo.resetPlayerMonth.mockResolvedValue();
      dynamo.batchWriteTierHistory.mockResolvedValue();

      const app = createTestApp();
      const result = await makeRequest(app, 'POST', '/admin/monthly-reset');

      expect(result.status).toBe(200);
      expect(result.body.tierChanges).toHaveLength(0);
      expect(dynamo.resetPlayerMonth).toHaveBeenCalledWith('p1', 1);
      expect(dynamo.createNotification).not.toHaveBeenCalled();
    });
  });
});
