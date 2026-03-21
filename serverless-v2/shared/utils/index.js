'use strict';

const crypto = require('crypto');

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uuid() {
  return crypto.randomUUID();
}

/**
 * Safe JSON parse — returns null on failure.
 */
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Format a decimal amount to 2 places.
 */
function toMoney(amount) {
  return Math.round(amount * 100) / 100;
}

module.exports = { sleep, uuid, safeJsonParse, toMoney };
