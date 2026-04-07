/**
 * trophies.js
 * Persistent trophy score, skin selection, and Unterseetaler currency manager
 * (localStorage-backed).
 *
 * Trophy rules:
 *   +10 on win, −5 on loss (min 0), never resets.
 *
 * Currency rules:
 *   +200 Unterseetaler per win, never resets.
 *
 * Trophy-gated skins:
 *   default   — always unlocked
 *   prestige1 — unlocked at 1000 trophies (hellblau + glitter)
 *
 * Shop skins (bought with Unterseetaler):
 *   wrack    — 1000 Taler (Wrack-Skin: braun + Algen-Ornamente)
 *   rainbow  — 3000 Taler (Rainbow-Skin: animiertes Regenbogen-Cycling)
 */

const KEY_TROPHIES    = 'seestern_trophies';
const KEY_SKIN        = 'seestern_skin';
const KEY_COINS       = 'seestern_coins';
const KEY_SHOP_OWNED  = 'seestern_shop_owned';

// ── Trophy-gated skin catalogue ────────────────────────────────────────────────
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

// ── Shop skin catalogue ────────────────────────────────────────────────────────
export const SHOP_SKIN_DEFS = {
  wrack: {
    key:         'wrack',
    name:        'Wrack-Skin',
    color:       0x8b6914,          // dunkelbraun (wrack wood)
    price:       1000,
    glitter:     false,
    rainbow:     false,
    wrackDeco:   true,              // triggers wreck decoration meshes
    description: 'Versunken & verwittert — mit Algen und Blasen.',
  },
  rainbow: {
    key:         'rainbow',
    name:        'Rainbow-Skin',
    color:       null,              // animated — color set per frame
    price:       3000,
    glitter:     false,
    rainbow:     true,              // triggers rainbow color cycling
    wrackDeco:   false,
    description: 'Animierte Regenbogenfarben — leuchtet in allen Farben.',
  },
};

// ── TrophyManager ──────────────────────────────────────────────────────────────
export class TrophyManager {
  constructor() {
    this._trophies    = parseInt(localStorage.getItem(KEY_TROPHIES) || '0', 10);
    this._coins       = parseInt(localStorage.getItem(KEY_COINS)    || '0', 10);
    this._activeSkin  = localStorage.getItem(KEY_SKIN) || 'default';

    // Load purchased shop skins
    try {
      this._shopOwned = JSON.parse(localStorage.getItem(KEY_SHOP_OWNED) || '[]');
    } catch {
      this._shopOwned = [];
    }

    // Validate stored skin is still available
    if (!this._isSkinAvailable(this._activeSkin)) {
      this._activeSkin = 'default';
    }
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  get trophies()    { return this._trophies; }
  get coins()       { return this._coins; }
  get activeSkin()  { return this._activeSkin; }

  /** Returns the active skin def (either trophy or shop skin). */
  getActiveSkinDef() {
    return SKIN_DEFS[this._activeSkin]
        || SHOP_SKIN_DEFS[this._activeSkin]
        || SKIN_DEFS.default;
  }

  /** Trophy-gated skin: unlocked by trophy count. */
  isSkinUnlocked(key) {
    const def = SKIN_DEFS[key];
    if (!def) return false;
    return this._trophies >= def.requiredTrophies;
  }

  /** Shop skin: owned if purchased. */
  isShopSkinOwned(key) {
    return this._shopOwned.includes(key);
  }

  /** Returns true if the skin can be equipped (unlocked or purchased). */
  _isSkinAvailable(key) {
    if (SKIN_DEFS[key])      return this.isSkinUnlocked(key);
    if (SHOP_SKIN_DEFS[key]) return this.isShopSkinOwned(key);
    return false;
  }

  /** Returns all trophy skins with status flags. */
  getAllSkinsWithStatus() {
    return Object.values(SKIN_DEFS).map(def => ({
      ...def,
      unlocked: this.isSkinUnlocked(def.key),
      active:   this._activeSkin === def.key,
      type:     'trophy',
    }));
  }

  /** Returns all shop skins with status flags. */
  getAllShopSkinsWithStatus() {
    return Object.values(SHOP_SKIN_DEFS).map(def => ({
      ...def,
      owned:    this.isShopSkinOwned(def.key),
      active:   this._activeSkin === def.key,
      canAfford: this._coins >= def.price,
      type:     'shop',
    }));
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  addWin() {
    this._trophies += 10;
    this._coins    += 200;
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
   * Set active skin (trophy-gated). Returns false if not unlocked.
   */
  setSkin(key) {
    if (!this.isSkinUnlocked(key)) return false;
    this._activeSkin = key;
    localStorage.setItem(KEY_SKIN, key);
    return true;
  }

  /**
   * Set active skin (shop). Returns false if not owned.
   */
  setShopSkin(key) {
    if (!this.isShopSkinOwned(key)) return false;
    this._activeSkin = key;
    localStorage.setItem(KEY_SKIN, key);
    return true;
  }

  /**
   * Purchase a shop skin. Returns 'ok', 'already_owned', or 'insufficient_funds'.
   */
  buyShopSkin(key) {
    const def = SHOP_SKIN_DEFS[key];
    if (!def) return 'unknown';
    if (this.isShopSkinOwned(key)) return 'already_owned';
    if (this._coins < def.price)   return 'insufficient_funds';

    this._coins -= def.price;
    this._shopOwned.push(key);
    localStorage.setItem(KEY_COINS, String(this._coins));
    localStorage.setItem(KEY_SHOP_OWNED, JSON.stringify(this._shopOwned));
    return 'ok';
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  _save() {
    localStorage.setItem(KEY_TROPHIES, String(this._trophies));
    localStorage.setItem(KEY_COINS,    String(this._coins));
  }

  /**
   * Check if any trophy skin was just unlocked.
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
