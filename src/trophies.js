/**
 * trophies.js
 * Persistent trophy score and skin selection manager (localStorage-backed).
 *
 * Trophy rules:
 *   +10 on win, −5 on loss (min 0), never resets.
 *
 * Skin definitions:
 *   default   — always unlocked
 *   prestige1 — unlocked at 1000 trophies (hellblau + glitter)
 */

const KEY_TROPHIES = 'seestern_trophies';
const KEY_SKIN     = 'seestern_skin';

// ── Skin catalogue ─────────────────────────────────────────────────────────────
export const SKIN_DEFS = {
  default: {
    key:              'default',
    name:             'Standard Seestern',
    color:            null,         // keeps the character's chosen game color
    requiredTrophies: 0,
    glitter:          false,
    description:      'Der klassische Seestern.',
  },
  prestige1: {
    key:              'prestige1',
    name:             'Prestige 1 Seestern',
    color:            0x66ddff,    // bright aqua-blue
    requiredTrophies: 1000,
    glitter:          true,
    description:      'Hellblau & glitzernd — freigeschaltet bei 1000 🏆',
  },
};

// ── TrophyManager ──────────────────────────────────────────────────────────────
export class TrophyManager {
  constructor() {
    this._trophies   = parseInt(localStorage.getItem(KEY_TROPHIES) || '0', 10);
    this._activeSkin = localStorage.getItem(KEY_SKIN) || 'default';

    // Validate stored skin is still unlocked (in case trophies were reset externally)
    if (!this.isSkinUnlocked(this._activeSkin)) {
      this._activeSkin = 'default';
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  get trophies()   { return this._trophies; }
  get activeSkin() { return this._activeSkin; }

  /** Returns the active SKIN_DEF object. */
  getActiveSkinDef() {
    return SKIN_DEFS[this._activeSkin] || SKIN_DEFS.default;
  }

  isSkinUnlocked(key) {
    const def = SKIN_DEFS[key];
    if (!def) return false;
    return this._trophies >= def.requiredTrophies;
  }

  /** Returns an array of all skin defs with an `unlocked` flag. */
  getAllSkinsWithStatus() {
    return Object.values(SKIN_DEFS).map(def => ({
      ...def,
      unlocked: this.isSkinUnlocked(def.key),
      active:   this._activeSkin === def.key,
    }));
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  addWin() {
    this._trophies += 10;
    this._save();
    this._checkNewUnlocks();
    return this._trophies;
  }

  addLoss() {
    this._trophies = Math.max(0, this._trophies - 5);
    this._save();
    return this._trophies;
  }

  /**
   * Set active skin. Returns false if not yet unlocked.
   * @param {string} key
   */
  setSkin(key) {
    if (!this.isSkinUnlocked(key)) return false;
    this._activeSkin = key;
    localStorage.setItem(KEY_SKIN, key);
    return true;
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  _save() {
    localStorage.setItem(KEY_TROPHIES, String(this._trophies));
  }

  /**
   * Check if any skin was just unlocked.
   * @returns {string|null} key of newly unlocked skin, or null
   */
  _checkNewUnlocks() {
    for (const def of Object.values(SKIN_DEFS)) {
      if (def.key === 'default') continue;
      if (this._trophies >= def.requiredTrophies
          && (this._trophies - 10) < def.requiredTrophies) {
        return def.key; // just crossed the threshold
      }
    }
    return null;
  }

  /** Returns a newly unlocked skin key if the latest action crossed a threshold. */
  checkNewUnlock() {
    return this._checkNewUnlocks();
  }
}
