'use strict';

const crypto = require('crypto');

function authMiddleware(req, res, next) {
  const playerId = req.headers['x-player-id'];

  if (!playerId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'X-Player-Id header is required',
    });
  }

  req.playerId = playerId;
  next();
}

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];

  if (!key) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'X-Admin-Key header is required',
    });
  }

  const expected = process.env.ADMIN_API_KEY || '';
  const keyBuf = Buffer.from(key);
  const expectedBuf = Buffer.from(expected);

  if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid admin key',
    });
  }

  next();
}

module.exports = { authMiddleware, adminAuth };
