/**
 * lootbox.js
 * Seesternbox — reward generation logic, configurable drop rates.
 *
 * Each box contains LOOTBOX_SLOTS slots.
 * Per slot: ~4 % chance for a new skin, ~96 % for Unterseetaler (50 each,
 * see LOOTBOX_COIN_REWARD in economy.js).
 * No duplicate skin drops within a single box.
 * Falls back to bonus coins when the player already owns all skins.
 */

import { LOOTBOX_SKIN_DEFS } from './trophies.js';
import {
  LOOTBOX_COIN_REWARD,
  LOOTBOX_COIN_FALLBACK_MIN,
  LOOTBOX_COIN_FALLBACK_MAX,
} from './economy.js';

// ── Configuration ─────────────────────────────────────────────────────────────

export const LOOTBOX_PRICE = 2000;   // cost in Unterseetaler
export const LOOTBOX_SLOTS = 6;      // rewards per box

/** Probability per slot (must sum to 1.0). */
export const DROP_RATES = {
  skin:  0.04,   // 4 % → rare exclusive skin
  coins: 0.96,   // 96 % → Unterseetaler
};

// Payout amounts are defined centrally in economy.js; re-exported here so
// existing imports keep working.
export const COIN_REWARD       = LOOTBOX_COIN_REWARD;       // per coin slot
export const COIN_FALLBACK_MIN = LOOTBOX_COIN_FALLBACK_MIN; // all skins owned
export const COIN_FALLBACK_MAX = LOOTBOX_COIN_FALLBACK_MAX;

// ── LootboxGenerator ──────────────────────────────────────────────────────────

export class LootboxGenerator {
  /**
   * @param {import('./trophies.js').TrophyManager} trophyManager
   */
  constructor(trophyManager) {
    this._tm = trophyManager;
  }

  /**
   * Roll rewards for one full Seesternbox (LOOTBOX_SLOTS slots).
   * Guarantees no duplicate skin drops within a single box.
   *
   * @returns {Array<{type:'coins'|'skin', amount?:number, skinKey?:string, skinDef?:object}>}
   */
  generateRewards() {
    const rewards        = [];
    const droppedThisBox = new Set();
    const allSkinKeys    = Object.keys(LOOTBOX_SKIN_DEFS);
    const allOwned       = allSkinKeys.every(k => this._tm.isLootboxSkinOwned(k));

    for (let i = 0; i < LOOTBOX_SLOTS; i++) {
      const available = allSkinKeys.filter(
        k => !this._tm.isLootboxSkinOwned(k) && !droppedThisBox.has(k),
      );
      const canDropSkin = available.length > 0 && !allOwned;

      if (canDropSkin && Math.random() < DROP_RATES.skin) {
        const key = available[Math.floor(Math.random() * available.length)];
        droppedThisBox.add(key);
        rewards.push({ type: 'skin', skinKey: key, skinDef: LOOTBOX_SKIN_DEFS[key] });
      } else {
        const amount = allOwned
          ? COIN_FALLBACK_MIN + Math.floor(
              Math.random() * (COIN_FALLBACK_MAX - COIN_FALLBACK_MIN + 1),
            )
          : COIN_REWARD;
        rewards.push({ type: 'coins', amount });
      }
    }

    return rewards;
  }
}
