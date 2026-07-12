/**
 * economy.js
 * Central configuration for all economy values: rewards, prices, glory tiers,
 * and display durations. Pure data + helpers — no DOM, no Three.js, no storage.
 *
 * All balance-relevant numbers live HERE so they can be tuned in one place.
 */

// ── Match rewards ─────────────────────────────────────────────────────────────

export const WIN_TROPHIES = 10;    // trophies gained per win
export const LOSS_TROPHIES = 5;    // trophies lost per defeat (floor 0)

/** Unterseetaler (credits) awarded once per regularly won match. */
export const WIN_CREDITS = 100;

// ── Seesternbox (lootbox) rewards ─────────────────────────────────────────────

/** Standard Unterseetaler payout per coin slot in a Seesternbox. */
export const LOOTBOX_COIN_REWARD = 50;

/** Bonus payout range per slot once the player owns every lootbox skin. */
export const LOOTBOX_COIN_FALLBACK_MIN = 75;
export const LOOTBOX_COIN_FALLBACK_MAX = 100;

// ── Shop prices ───────────────────────────────────────────────────────────────

/** Default price of the "Sterni" shop skin (in Unterseetaler). */
export const STERNI_PRICE = 5000;

// ── Glory ("Ruhm") tiers ──────────────────────────────────────────────────────
//
// Glory is based on LIFETIME earned credits (cumulative), so spending credits
// in the shop never reduces already-achieved glory. Tiers must be listed in
// ascending requiredLifetimeCredits order; append new tiers here to extend.

export const GLORY_TIERS = [
  {
    key:                     'kupfer',
    name:                    'Kupfer-Ruhm',
    icon:                    '🥉',
    requiredLifetimeCredits: 100_000,
  },
];

/** Label shown for players who have not reached any glory tier yet. */
export const NO_GLORY_LABEL = 'Noch kein Ruhm';

/**
 * Highest glory tier reached for a given lifetime-credit total, or null.
 * @param {number} lifetimeCredits
 * @returns {object|null}
 */
export function gloryTierForLifetime(lifetimeCredits) {
  let result = null;
  for (const tier of GLORY_TIERS) {
    if (lifetimeCredits >= tier.requiredLifetimeCredits) result = tier;
  }
  return result;
}

/**
 * Highest tier among a set of unlocked tier keys, or null.
 * @param {string[]} unlockedKeys
 * @returns {object|null}
 */
export function highestUnlockedTier(unlockedKeys) {
  let result = null;
  for (const tier of GLORY_TIERS) {
    if (unlockedKeys.includes(tier.key)) result = tier;
  }
  return result;
}

/**
 * Next tier not yet unlocked (in ascending order), or null if all unlocked.
 * @param {string[]} unlockedKeys
 * @returns {object|null}
 */
export function nextGloryTier(unlockedKeys) {
  return GLORY_TIERS.find(t => !unlockedKeys.includes(t.key)) || null;
}

// ── Post-match opponent info ──────────────────────────────────────────────────

/** How long the opponent-info panel stays visible after a match (ms). */
export const OPPONENT_INFO_DURATION_MS = 4000;

/**
 * Deterministic pseudo-profile for AI opponents so the post-match info panel
 * can show plausible, stable stats. Real player stats come from the server.
 * @param {string} name        AI display name
 * @param {string} difficulty  'easy' | 'medium' | 'hard'
 * @returns {{trophies:number, lifetimeCredits:number}}
 */
export function aiOpponentProfile(name, difficulty = 'medium') {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;

  const ranges = {
    easy:   [40,   400],
    medium: [400,  1600],
    hard:   [1600, 4000],
  };
  const [min, max] = ranges[difficulty] || ranges.medium;
  const trophies        = min + (h % (max - min + 1));
  const lifetimeCredits = trophies * 40 + (h % 1000) * 10;
  return { trophies, lifetimeCredits };
}
