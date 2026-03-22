'use strict';

const { sequelize } = require('../shared/config/db');
const { QueryTypes } = require('sequelize');
const { logger } = require('../shared/config/logger');

/**
 * Fetch the current game and player state for a table from MySQL.
 * Returns { game, players } or null if not found.
 */
async function fetchTable(tableId) {
  try {
    // Get the active game for this table
    const [game] = await sequelize.query(
      `SELECT g.*, gt.small_blind, gt.big_blind, gt.max_seats, gt.name as table_name, gt.game_type
       FROM games g
       JOIN game_tables gt ON g.table_id = gt.id
       WHERE g.table_id = :tableId AND g.status = 'in_progress'
       ORDER BY g.game_no DESC
       LIMIT 1`,
      { replacements: { tableId }, type: QueryTypes.SELECT }
    );

    if (!game) {
      // No active game — create a new one
      return await createNewGame(tableId);
    }

    // Get players in this game
    const players = await sequelize.query(
      `SELECT gp.*, p.guid, p.username
       FROM game_players gp
       JOIN players p ON gp.player_id = p.id
       WHERE gp.game_id = :gameId
       ORDER BY gp.seat`,
      { replacements: { gameId: game.id }, type: QueryTypes.SELECT }
    );

    return {
      game: normalizeGame(game),
      players: players.map(normalizePlayer),
    };
  } catch (err) {
    logger.error(`Failed to fetch table ${tableId}: ${err.message || err}`, { stack: err.stack });
    return null;
  }
}

/**
 * Create a new game for a table with the seeded players.
 */
async function createNewGame(tableId) {
  try {
    const [table] = await sequelize.query(
      `SELECT * FROM game_tables WHERE id = :tableId`,
      { replacements: { tableId }, type: QueryTypes.SELECT }
    );

    if (!table) return null;

    const maxSeats = parseInt(table.max_seats, 10) || 6;

    // Get players (for skeleton, use the seeded players)
    const allPlayers = await sequelize.query(
      `SELECT * FROM players ORDER BY id LIMIT ${maxSeats}`,
      { type: QueryTypes.SELECT }
    );

    if (allPlayers.length < 2) return null;

    // Get next game number and carry over the dealer seat from the last game
    const [lastGame] = await sequelize.query(
      `SELECT COALESCE(MAX(game_no), 0) + 1 as next_no,
              (SELECT dealer_seat FROM games WHERE table_id = :tableId ORDER BY game_no DESC LIMIT 1) as last_dealer
       FROM games WHERE table_id = :tableId`,
      { replacements: { tableId }, type: QueryTypes.SELECT }
    );
    const nextGameNo = lastGame?.next_no || 1;
    const lastDealerSeat = parseInt(lastGame?.last_dealer, 10) || 0;

    // Insert game record — use previous dealer seat so setupDealer rotates correctly
    const [gameId] = await sequelize.query(
      `INSERT INTO games (table_id, game_no, hand_step, dealer_seat, pot, status)
       VALUES (:tableId, :gameNo, 0, :dealerSeat, 0, 'in_progress')`,
      { replacements: { tableId, gameNo: nextGameNo, dealerSeat: lastDealerSeat }, type: QueryTypes.INSERT }
    );

    // Insert game players
    for (let i = 0; i < allPlayers.length; i++) {
      const player = allPlayers[i];
      const buyIn = (parseFloat(table.min_buy_in) + parseFloat(table.max_buy_in)) / 2;
      await sequelize.query(
        `INSERT INTO game_players (game_id, table_id, player_id, seat, stack, status)
         VALUES (:gameId, :tableId, :playerId, :seat, :stack, '1')`,
        {
          replacements: {
            gameId,
            tableId,
            playerId: player.id,
            seat: i + 1,
            stack: buyIn,
          },
          type: QueryTypes.INSERT,
        }
      );
    }

    // Re-fetch the created game
    return fetchTable(tableId);
  } catch (err) {
    logger.error(`Failed to create new game for table ${tableId}: ${err.message}`);
    return null;
  }
}

/**
 * Save updated game state back to MySQL.
 */
async function saveGame(game) {
  try {
    await sequelize.query(
      `UPDATE games SET
        hand_step = :handStep,
        dealer_seat = :dealerSeat,
        small_blind_seat = :smallBlindSeat,
        big_blind_seat = :bigBlindSeat,
        community_cards = :communityCards,
        deck = :deck,
        current_bet = :currentBet,
        winners = :winners,
        low_winners = :lowWinners,
        pot = :pot,
        side_pots = :sidePots,
        move = :move,
        status = :status
       WHERE id = :id`,
      {
        replacements: {
          id: game.id,
          handStep: game.handStep,
          dealerSeat: game.dealerSeat,
          smallBlindSeat: game.smallBlindSeat || 0,
          bigBlindSeat: game.bigBlindSeat || 0,
          communityCards: JSON.stringify(game.communityCards || []),
          deck: JSON.stringify(game.deck || []),
          currentBet: game.currentBet || 0,
          winners: JSON.stringify(game.winners || []),
          lowWinners: JSON.stringify(game.lowWinners || []),
          pot: game.pot,
          sidePots: JSON.stringify(game.sidePots || []),
          move: game.move || 0,
          status: game.status,
        },
        type: QueryTypes.UPDATE,
      }
    );
  } catch (err) {
    logger.error(`Failed to save game ${game.id}: ${err.message}`);
    throw err;
  }
}

/**
 * Save updated player states back to MySQL.
 */
async function savePlayers(players) {
  try {
    for (const player of players) {
      await sequelize.query(
        `UPDATE game_players SET
          stack = :stack,
          bet = :bet,
          total_bet = :totalBet,
          status = :status,
          action = :action,
          cards = :cards,
          hand_rank = :handRank,
          low_hand_rank = :lowHandRank,
          winnings = :winnings
         WHERE id = :id`,
        {
          replacements: {
            id: player.id,
            stack: player.stack,
            bet: player.bet,
            totalBet: player.totalBet,
            status: player.status,
            action: player.action,
            cards: JSON.stringify(player.cards || []),
            handRank: player.handRank || '',
            lowHandRank: player.lowHandRank || '',
            winnings: player.winnings || 0,
          },
          type: QueryTypes.UPDATE,
        }
      );
    }
  } catch (err) {
    logger.error(`Failed to save players: ${err.message}`);
    throw err;
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────

function normalizeGame(row) {
  return {
    id: row.id,
    tableId: row.table_id,
    tableName: row.table_name,
    gameType: row.game_type || 'texas',
    gameNo: row.game_no,
    handStep: row.hand_step,
    dealerSeat: row.dealer_seat,
    smallBlindSeat: row.small_blind_seat || 0,
    bigBlindSeat: row.big_blind_seat || 0,
    communityCards: typeof row.community_cards === 'string'
      ? JSON.parse(row.community_cards || '[]')
      : (row.community_cards || []),
    pot: parseFloat(row.pot) || 0,
    sidePots: typeof row.side_pots === 'string'
      ? JSON.parse(row.side_pots || '[]')
      : (row.side_pots || []),
    move: row.move || 0,
    status: row.status,
    smallBlind: parseFloat(row.small_blind),
    bigBlind: parseFloat(row.big_blind),
    maxSeats: row.max_seats,
    deck: typeof row.deck === 'string'
      ? JSON.parse(row.deck || '[]')
      : (row.deck || []),
    currentBet: parseFloat(row.current_bet) || 0,
    winners: typeof row.winners === 'string'
      ? JSON.parse(row.winners || '[]')
      : (row.winners || []),
    lowWinners: typeof row.low_winners === 'string'
      ? JSON.parse(row.low_winners || '[]')
      : (row.low_winners || []),
  };
}

function normalizePlayer(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    tableId: row.table_id,
    playerId: row.player_id,
    guid: row.guid,
    username: row.username,
    seat: row.seat,
    stack: parseFloat(row.stack) || 0,
    bet: parseFloat(row.bet) || 0,
    totalBet: parseFloat(row.total_bet) || 0,
    status: row.status || '1',
    action: row.action || '',
    cards: typeof row.cards === 'string'
      ? JSON.parse(row.cards || '[]')
      : (row.cards || []),
    handRank: row.hand_rank || '',
    lowHandRank: row.low_hand_rank || '',
    winnings: parseFloat(row.winnings) || 0,
  };
}

module.exports = { fetchTable, saveGame, savePlayers };
