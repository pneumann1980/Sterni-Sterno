/**
 * Tests for TrophyManager: credits, lifetime tracking, glory, shop purchases,
 * persistence, and profile migration (src/trophies.js).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { installLocalStorageMock } from './helpers/localstorage-mock.js';
import { TrophyManager, SHOP_SKIN_DEFS } from '../src/trophies.js';
import { WIN_CREDITS, WIN_TROPHIES, LOSS_TROPHIES, STERNI_PRICE } from '../src/economy.js';

beforeEach(() => {
  installLocalStorageMock();
});

// ── Credits per match ─────────────────────────────────────────────────────────

test('a win awards exactly 100 credits (once)', () => {
  const tm = new TrophyManager();
  tm.addWin();
  assert.equal(tm.coins, WIN_CREDITS);
  assert.equal(tm.coins, 100);
  assert.equal(tm.lifetimeCoins, 100);
  assert.equal(tm.trophies, WIN_TROPHIES);
});

test('an aborted win (awardCredits=false) gives trophies but no credits', () => {
  const tm = new TrophyManager();
  tm.addWin(false);
  assert.equal(tm.coins, 0);
  assert.equal(tm.lifetimeCoins, 0);
  assert.equal(tm.trophies, WIN_TROPHIES);
});

test('a loss awards no credits', () => {
  const tm = new TrophyManager();
  tm.addWin();               // gain some trophies first
  const coinsBefore = tm.coins;
  tm.addLoss();
  assert.equal(tm.coins, coinsBefore);
  assert.equal(tm.trophies, WIN_TROPHIES - LOSS_TROPHIES);
});

test('trophies never go below zero on losses', () => {
  const tm = new TrophyManager();
  tm.addLoss();
  assert.equal(tm.trophies, 0);
});

// ── Lootbox coin reward ───────────────────────────────────────────────────────

test('lootbox coin slots pay exactly 50 each', async () => {
  const { LootboxGenerator, COIN_REWARD, LOOTBOX_SLOTS } = await import('../src/lootbox.js');
  assert.equal(COIN_REWARD, 50);

  const tm  = new TrophyManager();
  const gen = new LootboxGenerator(tm);

  // Force pure coin drops (skin chance is per-slot Math.random() < 0.04)
  const origRandom = Math.random;
  Math.random = () => 0.99;
  try {
    const rewards = gen.generateRewards();
    assert.equal(rewards.length, LOOTBOX_SLOTS);
    for (const r of rewards) {
      assert.equal(r.type, 'coins');
      assert.equal(r.amount, 50);
    }
  } finally {
    Math.random = origRandom;
  }
});

test('lootbox fallback payout (all skins owned) stays within its range', async () => {
  const { LootboxGenerator, COIN_FALLBACK_MIN, COIN_FALLBACK_MAX } =
    await import('../src/lootbox.js');
  const tm = new TrophyManager();
  const fakeTm = { isLootboxSkinOwned: () => true }; // player owns everything
  const gen = new LootboxGenerator(fakeTm);
  for (const r of gen.generateRewards()) {
    assert.equal(r.type, 'coins');
    assert.ok(r.amount >= COIN_FALLBACK_MIN && r.amount <= COIN_FALLBACK_MAX);
  }
  assert.ok(tm); // silence unused warning
});

// ── Glory ("Ruhm") ────────────────────────────────────────────────────────────

test('Kupfer-Ruhm unlocks at 100000 lifetime credits', () => {
  const tm = new TrophyManager();
  tm.addCoins(99_999);
  assert.equal(tm.getGloryTier(), null);
  tm.addCoins(1);
  assert.equal(tm.getGloryTier()?.key, 'kupfer');
  assert.deepEqual(tm.unlockedGloryTiers, ['kupfer']);
});

test('1000 wins à 100 credits unlock Kupfer-Ruhm', () => {
  const tm = new TrophyManager();
  for (let i = 0; i < 1000; i++) tm.addWin();
  assert.equal(tm.lifetimeCoins, 100_000);
  assert.equal(tm.getGloryTier()?.key, 'kupfer');
});

test('spending credits in the shop never removes achieved glory', () => {
  const tm = new TrophyManager();
  tm.addCoins(100_000);
  assert.equal(tm.getGloryTier()?.key, 'kupfer');

  assert.equal(tm.buyShopSkin('sterni'), 'ok');
  assert.ok(tm.coins < 100_000);
  assert.equal(tm.lifetimeCoins, 100_000);          // lifetime unchanged
  assert.equal(tm.getGloryTier()?.key, 'kupfer');   // glory kept

  // Still kept after a reload (new manager on same storage)
  const tm2 = new TrophyManager();
  assert.equal(tm2.getGloryTier()?.key, 'kupfer');
});

test('glory progress snapshot exposes current, next tier and lifetime total', () => {
  const tm = new TrophyManager();
  tm.addCoins(42_500);
  const p = tm.getGloryProgress();
  assert.equal(p.current, null);
  assert.equal(p.next?.key, 'kupfer');
  assert.equal(p.lifetimeCredits, 42_500);
});

// ── Shop purchases ────────────────────────────────────────────────────────────

test('Sterni skin exists in the shop with a configurable price', () => {
  const sterni = SHOP_SKIN_DEFS.sterni;
  assert.ok(sterni, 'sterni skin is defined');
  assert.equal(sterni.name, 'Sterni');
  assert.equal(sterni.price, STERNI_PRICE);
  assert.ok(sterni.splitColors, 'sterni has split colors');
});

test('Sterni: split colors are hellblau left / dunkelblau right', () => {
  const { left, right } = SHOP_SKIN_DEFS.sterni.splitColors;
  const luminance = (hex) => {
    const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  assert.ok(luminance(left) > luminance(right), 'left half is the light one');
});

test('Sterni: both eyes sit fully on the light LEFT half', () => {
  const { offsets, eyeRadius } = SHOP_SKIN_DEFS.sterni.splitEyes;
  assert.equal(offsets.length, 2);
  for (const x of offsets) {
    // eye center + radius must stay left of the vertical split line (x = 0)
    assert.ok(x + eyeRadius <= 0, `eye at x=${x} is fully on the left half`);
  }
});

test('a skin can only be bought with sufficient balance', () => {
  const tm = new TrophyManager();
  tm.addCoins(STERNI_PRICE - 1);
  assert.equal(tm.buyShopSkin('sterni'), 'insufficient_funds');
  assert.equal(tm.coins, STERNI_PRICE - 1);           // nothing charged
  assert.equal(tm.isShopSkinOwned('sterni'), false);

  tm.addCoins(1);
  assert.equal(tm.buyShopSkin('sterni'), 'ok');
  assert.equal(tm.coins, 0);
  assert.equal(tm.isShopSkinOwned('sterni'), true);
});

test('an owned skin is never charged again and can be re-equipped for free', () => {
  const tm = new TrophyManager();
  tm.addCoins(STERNI_PRICE + 500);
  assert.equal(tm.buyShopSkin('sterni'), 'ok');
  const balance = tm.coins;

  assert.equal(tm.buyShopSkin('sterni'), 'already_owned');
  assert.equal(tm.coins, balance);                    // no double charge

  assert.equal(tm.setShopSkin('sterni'), true);       // equip
  assert.equal(tm.setShopSkin('wrack'), false);       // not owned → rejected
  assert.equal(tm.setSkin('default'), true);          // switch back
  assert.equal(tm.setShopSkin('sterni'), true);       // re-equip, free
  assert.equal(tm.coins, balance);
});

test('purchases and equipped skin survive a restart', () => {
  const tm = new TrophyManager();
  tm.addCoins(STERNI_PRICE);
  tm.buyShopSkin('sterni');
  tm.setShopSkin('sterni');

  const tm2 = new TrophyManager();                    // fresh instance = reload
  assert.equal(tm2.isShopSkinOwned('sterni'), true);
  assert.equal(tm2.activeSkin, 'sterni');
  assert.equal(tm2.getActiveSkinDef().key, 'sterni');
});

// ── Migration / backwards compatibility ───────────────────────────────────────

test('existing profile without new keys migrates safely', () => {
  installLocalStorageMock({
    seestern_trophies:   '250',
    seestern_coins:      '5000',
    seestern_skin:       'default',
    seestern_shop_owned: '["wrack"]',
  });
  const tm = new TrophyManager();
  assert.equal(tm.trophies, 250);
  assert.equal(tm.coins, 5000);
  assert.equal(tm.lifetimeCoins, 5000);   // seeded from current balance
  assert.deepEqual(tm.unlockedGloryTiers, []);
  assert.equal(tm.isShopSkinOwned('wrack'), true);
  assert.equal(tm.getActiveSkinDef().key, 'default');
});

test('corrupt stored data falls back to safe defaults without throwing', () => {
  installLocalStorageMock({
    seestern_shop_owned:    '{not json',
    seestern_lootbox_owned: '42',
    seestern_glory_tiers:   'xxx',
    seestern_skin:          'nonexistent-skin',
  });
  const tm = new TrophyManager();
  assert.equal(tm.coins, 0);
  assert.equal(tm.activeSkin, 'default'); // invalid skin reset
  assert.deepEqual(tm.unlockedGloryTiers, []);
});

test('a legacy profile that already earned 100k+ gets glory on first load', () => {
  installLocalStorageMock({ seestern_coins: '150000' });
  const tm = new TrophyManager();
  assert.equal(tm.getGloryTier()?.key, 'kupfer');
});
