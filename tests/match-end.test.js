/**
 * Tests for match-end handling: duplicate / concurrent match-end events must
 * award rewards only once (src/gamestate.js guard + TrophyManager).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { installLocalStorageMock } from './helpers/localstorage-mock.js';
import { GameState, GameMode, GameStatus } from '../src/gamestate.js';
import { TrophyManager } from '../src/trophies.js';
import { WIN_CREDITS } from '../src/economy.js';

beforeEach(() => {
  installLocalStorageMock();
});

test('endGame is idempotent: second call is rejected', () => {
  const state = new GameState();
  state.start(GameMode.VS_AI);
  assert.equal(state.endGame('Spieler 1'), true);
  assert.equal(state.endGame('Spieler 1'), false);   // duplicate event
  assert.equal(state.endGame('KI-Gegner'), false);   // conflicting duplicate
  assert.equal(state.winner, 'Spieler 1');
  assert.equal(state.status, GameStatus.GAME_OVER);
});

test('a double match-end event awards credits only once', () => {
  const state = new GameState();
  const tm    = new TrophyManager();
  state.start(GameMode.VS_AI);

  // Mirrors Game._endGame: rewards only when endGame() actually ended the match
  const onMatchEnd = (winner) => {
    if (!state.endGame(winner)) return;
    tm.addWin();
  };

  onMatchEnd('Spieler 1');
  onMatchEnd('Spieler 1');   // duplicate event (e.g. two win checks same frame)

  assert.equal(tm.coins, WIN_CREDITS);
  assert.equal(tm.lifetimeCoins, WIN_CREDITS);
});

test('a rematch (new start) allows a new reward exactly once', () => {
  const state = new GameState();
  const tm    = new TrophyManager();

  for (let round = 0; round < 2; round++) {
    state.start(GameMode.VS_AI);
    if (state.endGame('Spieler 1')) tm.addWin();
    if (state.endGame('Spieler 1')) tm.addWin();  // duplicate within same match
  }
  assert.equal(tm.coins, 2 * WIN_CREDITS);
});

test('an aborted match (disconnect) awards no credits', () => {
  const state = new GameState();
  const tm    = new TrophyManager();
  state.start(GameMode.ONLINE_VERSUS);

  // Mirrors Game._endGame with { aborted: true }
  if (state.endGame('Spieler 1')) tm.addWin(false);

  assert.equal(tm.coins, 0);
  assert.equal(tm.lifetimeCoins, 0);
});

test('a defeat awards no credits', () => {
  const state = new GameState();
  const tm    = new TrophyManager();
  state.start(GameMode.VS_AI);

  if (state.endGame('KI-Gegner')) tm.addLoss();

  assert.equal(tm.coins, 0);
});
