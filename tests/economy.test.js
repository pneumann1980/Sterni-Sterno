/**
 * Tests for the central economy configuration (src/economy.js).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WIN_CREDITS,
  LOOTBOX_COIN_REWARD,
  LOOTBOX_COIN_FALLBACK_MIN,
  LOOTBOX_COIN_FALLBACK_MAX,
  GLORY_TIERS,
  NO_GLORY_LABEL,
  gloryTierForLifetime,
  highestUnlockedTier,
  nextGloryTier,
  aiOpponentProfile,
} from '../src/economy.js';

test('win reward is exactly 100 credits', () => {
  assert.equal(WIN_CREDITS, 100);
});

test('lootbox coin slot pays exactly 50 (instead of the old 1000)', () => {
  assert.equal(LOOTBOX_COIN_REWARD, 50);
  assert.ok(LOOTBOX_COIN_FALLBACK_MIN <= LOOTBOX_COIN_FALLBACK_MAX);
});

test('Kupfer-Ruhm tier requires 100000 lifetime credits', () => {
  const kupfer = GLORY_TIERS.find(t => t.key === 'kupfer');
  assert.ok(kupfer, 'kupfer tier exists');
  assert.equal(kupfer.name, 'Kupfer-Ruhm');
  assert.equal(kupfer.requiredLifetimeCredits, 100_000);
});

test('glory tiers are sorted ascending (extensible config)', () => {
  for (let i = 1; i < GLORY_TIERS.length; i++) {
    assert.ok(
      GLORY_TIERS[i].requiredLifetimeCredits > GLORY_TIERS[i - 1].requiredLifetimeCredits
    );
  }
});

test('gloryTierForLifetime: below threshold → null, at threshold → kupfer', () => {
  assert.equal(gloryTierForLifetime(0), null);
  assert.equal(gloryTierForLifetime(99_999), null);
  assert.equal(gloryTierForLifetime(100_000)?.key, 'kupfer');
  assert.equal(gloryTierForLifetime(250_000)?.key, 'kupfer');
});

test('highestUnlockedTier / nextGloryTier helpers', () => {
  assert.equal(highestUnlockedTier([]), null);
  assert.equal(highestUnlockedTier(['kupfer'])?.key, 'kupfer');
  assert.equal(nextGloryTier([])?.key, 'kupfer');
  assert.equal(nextGloryTier(['kupfer']), null);
});

test('players without a tier get a distinct label', () => {
  assert.equal(NO_GLORY_LABEL, 'Noch kein Ruhm');
});

test('aiOpponentProfile is deterministic and non-negative', () => {
  const a = aiOpponentProfile('KI-Gegner', 'medium');
  const b = aiOpponentProfile('KI-Gegner', 'medium');
  assert.deepEqual(a, b);
  assert.ok(a.trophies >= 0);
  assert.ok(a.lifetimeCredits >= 0);
  // Unknown difficulty falls back gracefully
  const c = aiOpponentProfile('KI-Gegner', 'unknown');
  assert.ok(Number.isFinite(c.trophies));
});
