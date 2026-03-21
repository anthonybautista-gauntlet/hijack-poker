'use strict';

// Mock dynamo.service before anything requires it
jest.mock('../src/services/dynamo.service', () => ({
  getNotifications: jest.fn(),
  dismissNotification: jest.fn(),
}));

const dynamo = require('../src/services/dynamo.service');

// Suppress console.error in tests
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
});

afterEach(() => {
  jest.resetAllMocks();
});

// Build a minimal test app with auth stub + notifications route
function createTestApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());

  // Stub auth middleware
  app.use((req, res, next) => {
    const playerId = req.headers['x-player-id'];
    if (!playerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.playerId = playerId;
    next();
  });

  const notificationsRoute = require('../src/routes/notifications');
  app.use('/api/v1/player/notifications', notificationsRoute);
  return app;
}

/**
 * Helper: make an HTTP request to a test server and return { statusCode, body }
 */
function makeRequest(app, method, path, headers) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = http.createServer(app);

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') });
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

const mockNotifications = [
  {
    playerId: 'player-1',
    notificationId: 'n-1',
    type: 'tier_upgrade',
    title: 'Tier Upgrade!',
    message: 'You reached Silver!',
    dismissed: false,
    createdAt: '2026-03-20T10:00:00.000Z',
  },
  {
    playerId: 'player-1',
    notificationId: 'n-2',
    type: 'milestone',
    title: 'Milestone!',
    message: 'You earned 1000 points!',
    dismissed: true,
    createdAt: '2026-03-21T12:00:00.000Z',
  },
  {
    playerId: 'player-1',
    notificationId: 'n-3',
    type: 'tier_upgrade',
    title: 'Tier Upgrade!',
    message: 'You reached Gold!',
    dismissed: false,
    createdAt: '2026-03-21T14:00:00.000Z',
  },
];

describe('GET /api/v1/player/notifications', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  it('returns all notifications sorted by createdAt descending', async () => {
    dynamo.getNotifications.mockResolvedValue([...mockNotifications]);

    const res = await makeRequest(app, 'GET', '/api/v1/player/notifications', {
      'x-player-id': 'player-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(3);
    // Verify descending order by createdAt
    expect(res.body.notifications[0].notificationId).toBe('n-3');
    expect(res.body.notifications[1].notificationId).toBe('n-2');
    expect(res.body.notifications[2].notificationId).toBe('n-1');
    expect(res.body.unreadCount).toBe(2);
  });

  it('filters to unread only when unread=true', async () => {
    dynamo.getNotifications.mockResolvedValue([...mockNotifications]);

    const res = await makeRequest(app, 'GET', '/api/v1/player/notifications?unread=true', {
      'x-player-id': 'player-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.notifications.every((n) => n.dismissed === false)).toBe(true);
    expect(res.body.unreadCount).toBe(2);
  });

  it('returns all notifications when unread=false', async () => {
    dynamo.getNotifications.mockResolvedValue([...mockNotifications]);

    const res = await makeRequest(app, 'GET', '/api/v1/player/notifications?unread=false', {
      'x-player-id': 'player-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(3);
  });

  it('returns empty array when no notifications exist', async () => {
    dynamo.getNotifications.mockResolvedValue([]);

    const res = await makeRequest(app, 'GET', '/api/v1/player/notifications', {
      'x-player-id': 'player-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications).toHaveLength(0);
    expect(res.body.unreadCount).toBe(0);
  });

  it('includes correct unreadCount', async () => {
    dynamo.getNotifications.mockResolvedValue([...mockNotifications]);

    const res = await makeRequest(app, 'GET', '/api/v1/player/notifications', {
      'x-player-id': 'player-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.unreadCount).toBe(2);
  });

  it('returns 401 without X-Player-Id header', async () => {
    const res = await makeRequest(app, 'GET', '/api/v1/player/notifications', {});

    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/v1/player/notifications/:id/dismiss', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  it('dismisses a notification successfully', async () => {
    dynamo.dismissNotification.mockResolvedValue(true);

    const res = await makeRequest(app, 'PATCH', '/api/v1/player/notifications/n-1/dismiss', {
      'x-player-id': 'player-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(dynamo.dismissNotification).toHaveBeenCalledWith('player-1', 'n-1');
  });

  it('returns 404 when notification not found', async () => {
    dynamo.dismissNotification.mockResolvedValue(false);

    const res = await makeRequest(app, 'PATCH', '/api/v1/player/notifications/nonexistent/dismiss', {
      'x-player-id': 'player-1',
    });

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 without X-Player-Id header', async () => {
    const res = await makeRequest(app, 'PATCH', '/api/v1/player/notifications/n-1/dismiss', {});

    expect(res.statusCode).toBe(401);
  });
});
