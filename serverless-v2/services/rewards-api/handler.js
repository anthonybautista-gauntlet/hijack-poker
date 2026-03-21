'use strict';

const express = require('express');
const serverless = require('serverless-http');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const healthRoute = require('./src/routes/health');
const pointsRoute = require('./src/routes/points');
const playerRoute = require('./src/routes/player');
const notificationsRoute = require('./src/routes/notifications');
const adminRoute = require('./src/routes/admin');
const { authMiddleware } = require('./src/middleware/auth');

const app = express();

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:4000'],
  methods: ['GET', 'POST', 'PATCH', 'PUT'],
  allowedHeaders: ['Content-Type', 'X-Player-Id', 'X-Admin-Key'],
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

// Public routes
app.use('/api/v1/health', healthRoute);

// Leaderboard (public — X-Player-Id optional for rank lookup)
app.use('/api/v1', apiLimiter, pointsRoute);

// Protected routes (require auth header)
app.use('/api/v1/points', apiLimiter, authMiddleware, pointsRoute);
app.use('/api/v1/player/notifications', apiLimiter, authMiddleware, notificationsRoute);
app.use('/api/v1/player', apiLimiter, authMiddleware, playerRoute);

// Admin routes (stricter rate limit, auth handled in router)
app.use('/admin', adminLimiter, adminRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Check if monthly reset is overdue (warning only — does not auto-trigger)
const checkResetStatus = async () => {
  try {
    const dynamo = require('./src/services/dynamo.service');
    const players = await dynamo.getAllPlayers();
    if (players.length === 0) return;

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const overdue = players.filter((p) => p.lastResetMonth && p.lastResetMonth !== currentMonthKey);
    if (overdue.length > 0) {
      console.warn(`[RESET WARNING] ${overdue.length} player(s) may need monthly reset (last reset does not match ${currentMonthKey})`);
    }
  } catch (err) {
    console.warn('[RESET WARNING] Could not check reset status:', err.message);
  }
};

// Fire-and-forget on cold start
checkResetStatus();

module.exports.api = serverless(app);
module.exports._checkResetStatus = checkResetStatus;
