/**
 * trophies.js
 * Persistent trophy score, skin selection, Unterseetaler (credits) currency,
 * lifetime-credit tracking, and glory ("Ruhm") manager (localStorage-backed).
 *
 * Trophy rules:
 *   +WIN_TROPHIES on win, −LOSS_TROPHIES on loss (min 0), never resets.
 *
 * Currency rules (all values in economy.js):
 *   +WIN_CREDITS Unterseetaler per regularly won match — aborted matches
 *   (disconnects etc.) never award credits. Every earned coin also counts
 *   into the lifetime total which drives glory tiers and never decreases.
 *
 * Glory ("Ruhm"):
 *   Tiers unlock permanently once lifetime earned credits cross the tier
 *   threshold (see GLORY_TIERS in economy.js). Spending credits in the shop
 *   never removes an unlocked tier.
 *
 * Trophy-gated skins:
 *   default   — always unlocked
 *   prestige1 — unlocked at 1000 trophies (hellblau + glitter)
 *
 * Shop skins (bought with Unterseetaler):
 *   wrack    — 1000 Taler (Wrack-Skin: braun + Algen-Ornamente)
 *   rainbow  — 3000 Taler (Rainbow-Skin: animiertes Regenbogen-Cycling)
 *   unicorn  — 10000 Taler (Unicorn-Skin: Horn + Funkeln)
 *   sterni   — STERNI_PRICE Taler (vertikal geteilt: links hellblau,
 *              rechts dunkelblau, beide Augen auf der hellen linken Hälfte)
 */

import {
  WIN_TROPHIES,
  LOSS_TROPHIES,
  WIN_CREDITS,
  STERNI_PRICE,
  GLORY_TIERS,
  highestUnlockedTier,
  nextGloryTier,
} from './economy.js';

const KEY_TROPHIES       = 'seestern_trophies';
const KEY_SKIN           = 'seestern_skin';
const KEY_COINS          = 'seestern_coins';
const KEY_SHOP_OWNED     = 'seestern_shop_owned';
const KEY_LOOTBOX_OWNED  = 'seestern_lootbox_owned';
const KEY_LIFETIME_COINS = 'seestern_lifetime_coins';
const KEY_GLORY_TIERS    = 'seestern_glory_tiers';

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

// ── Lootbox-exclusive skin catalogue ──────────────────────────────────────────
export const LOOTBOX_SKIN_DEFS = {
  golden: {
    key:         'golden',
    name:        'Goldener Seestern',
    color:       0xFFD700,
    glitter:     true,
    rainbow:     false,
    wrackDeco:   false,
    unicornHorn: false,
    description: 'Reines Gold mit Glitzereffekt — äußerst selten!',
  },
  midnight: {
    key:         'midnight',
    name:        'Mitternachts-Seestern',
    color:       0x1a0066,
    glitter:     true,
    rainbow:     false,
    wrackDeco:   false,
    unicornHorn: false,
    description: 'Tiefes Nachtblau mit Sternenglitzer.',
  },
  lava: {
    key:         'lava',
    name:        'Lava-Seestern',
    color:       0xFF4400,
    glitter:     false,
    rainbow:     false,
    wrackDeco:   false,
    unicornHorn: false,
    description: 'Glutrot wie frische Lava aus dem Vulkan!',
  },
  toxic: {
    key:         'toxic',
    name:        'Toxischer Seestern',
    color:       0x39FF14,
    glitter:     false,
    rainbow:     false,
    wrackDeco:   false,
    unicornHorn: false,
    description: 'Giftig neongrün — leuchtet im Dunkeln!',
  },
  obsidian: {
    key:         'obsidian',
    name:        'Obsidian-Seestern',
    color:       0x0d0011,
    glitter:     true,
    rainbow:     false,
    wrackDeco:   false,
    unicornHorn: false,
    description: 'Fast schwarz mit purpurnem Schimmer.',
  },
  sakura: {
    key:         'sakura',
    name:        'Sakura-Seestern',
    color:       0xFFB7C5,
    glitter:     true,
    rainbow:     false,
    wrackDeco:   false,
    unicornHorn: false,
    description: 'Zart rosa wie Kirschblüten im Frühling.',
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
    unicornHorn: false,
    description: 'Animierte Regenbogenfarben — leuchtet in allen Farben.',
  },
  unicorn: {
    key:         'unicorn',
    name:        'Unicorn-Skin',
    color:       0xfff0ff,          // weißlich-rosa
    price:       10000,
    glitter:     false,
    rainbow:     false,
    wrackDeco:   false,
    unicornHorn: true,              // triggers unicorn horn + sparkle effect
    description: 'Weißer Seestern mit Einhorn-Horn ✨ — magisch & einzigartig!',
  },
  sterni: {
    key:         'sterni',
    name:        'Sterni',
    color:       null,              // colors come from splitColors
    price:       STERNI_PRICE,
    glitter:     false,
    rainbow:     false,
    wrackDeco:   false,
    unicornHorn: false,
    // Vertical split exactly through the middle: left half hellblau,
    // right half dunkelblau.
    splitColors: { left: 0x8fd8ff, right: 0x123c8e },
    // Both eyes sit fully on the light-blue LEFT half:
    // eye center offset + eyeRadius must stay < 0 (left of the split line).
    splitEyes:   { offsets: [-0.30, -0.12], eyeRadius: 0.10 },
    description: 'Links hellblau, rechts dunkelblau — beide Augen auf der hellen Seite.',
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

    // Load lootbox-unlocked skins
    try {
      this._lootboxOwned = JSON.parse(localStorage.getItem(KEY_LOOTBOX_OWNED) || '[]');
    } catch {
      this._lootboxOwned = [];
    }
    if (!Array.isArray(this._shopOwned))    this._shopOwned = [];
    if (!Array.isArray(this._lootboxOwned)) this._lootboxOwned = [];

    // Lifetime earned credits — migration for existing profiles: older saves
    // have no lifetime key, so we seed it with the current balance (best
    // available estimate) without touching any other stored data.
    const storedLifetime = localStorage.getItem(KEY_LIFETIME_COINS);
    if (storedLifetime === null) {
      this._lifetimeCoins = this._coins;
      localStorage.setItem(KEY_LIFETIME_COINS, String(this._lifetimeCoins));
    } else {
      this._lifetimeCoins = parseInt(storedLifetime, 10) || 0;
    }

    // Permanently unlocked glory tiers
    try {
      this._gloryUnlocked = JSON.parse(localStorage.getItem(KEY_GLORY_TIERS) || '[]');
    } catch {
      this._gloryUnlocked = [];
    }
    if (!Array.isArray(this._gloryUnlocked)) this._gloryUnlocked = [];
    this._syncGloryUnlocks(); // unlock anything the lifetime total already earns

    // Validate stored skin is still available
    if (!this._isSkinAvailable(this._activeSkin)) {
      this._activeSkin = 'default';
    }
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  get trophies()      { return this._trophies; }
  get coins()         { return this._coins; }
  get lifetimeCoins() { return this._lifetimeCoins; }
  get activeSkin()    { return this._activeSkin; }

  /** Keys of all permanently unlocked glory tiers. */
  get unlockedGloryTiers() { return [...this._gloryUnlocked]; }

  /** Highest unlocked glory tier def, or null if none reached yet. */
  getGloryTier() {
    return highestUnlockedTier(this._gloryUnlocked);
  }

  /**
   * Glory progress snapshot for UI display.
   * @returns {{current:object|null, next:object|null, lifetimeCredits:number}}
   */
  getGloryProgress() {
    return {
      current:         this.getGloryTier(),
      next:            nextGloryTier(this._gloryUnlocked),
      lifetimeCredits: this._lifetimeCoins,
    };
  }

  /** Returns the active skin def (trophy, shop, or lootbox skin). */
  getActiveSkinDef() {
    return SKIN_DEFS[this._activeSkin]
        || SHOP_SKIN_DEFS[this._activeSkin]
        || LOOTBOX_SKIN_DEFS[this._activeSkin]
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

  /** Lootbox skin: owned if unlocked from a Seesternbox. */
  isLootboxSkinOwned(key) {
    return this._lootboxOwned.includes(key);
  }

  /** Returns true if the skin can be equipped (unlocked or purchased or lootbox). */
  _isSkinAvailable(key) {
    if (SKIN_DEFS[key])        return this.isSkinUnlocked(key);
    if (SHOP_SKIN_DEFS[key])   return this.isShopSkinOwned(key);
    if (LOOTBOX_SKIN_DEFS[key]) return this.isLootboxSkinOwned(key);
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
      owned:     this.isShopSkinOwned(def.key),
      active:    this._activeSkin === def.key,
      canAfford: this._coins >= def.price,
      type:      'shop',
    }));
  }

  /** Returns all lootbox skins with status flags. */
  getAllLootboxSkinsWithStatus() {
    return Object.values(LOOTBOX_SKIN_DEFS).map(def => ({
      ...def,
      owned:  this.isLootboxSkinOwned(def.key),
      active: this._activeSkin === def.key,
      type:   'lootbox',
    }));
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  /**
   * Record a won match: +WIN_TROPHIES trophies, and (unless the match was
   * aborted) +WIN_CREDITS Unterseetaler. Call this exactly once per match —
   * the game flow guards against duplicate match-end events.
   * @param {boolean} awardCredits  false for aborted/invalid matches
   */
  addWin(awardCredits = true) {
    this._trophies += WIN_TROPHIES;
    if (awardCredits) this._earnCoins(WIN_CREDITS);
    this._save();
    this._checkNewUnlocks();
    return this._trophies;
  }

  addLoss() {
    this._trophies = Math.max(0, this._trophies - LOSS_TROPHIES);
    this._save();
    return this._trophies;
  }

  /**
   * Add earned coins (e.g. from lootbox rewards). Counts into the lifetime
   * total and may unlock glory tiers. Saves immediately.
   */
  addCoins(amount) {
    return this._earnCoins(amount);
  }

  /**
   * Central sink for all EARNED coins: updates balance + lifetime total and
   * unlocks any glory tier the new lifetime total qualifies for.
   */
  _earnCoins(amount) {
    const amt = Math.max(0, Math.floor(Number(amount) || 0));
    this._coins         += amt;
    this._lifetimeCoins += amt;
    localStorage.setItem(KEY_COINS,          String(this._coins));
    localStorage.setItem(KEY_LIFETIME_COINS, String(this._lifetimeCoins));
    this._syncGloryUnlocks();
    return this._coins;
  }

  /**
   * Unlock every glory tier the lifetime total qualifies for. Never removes
   * tiers — unlocks are permanent even if credits are spent later.
   * @returns {object|null} the newest unlocked tier def, or null
   */
  _syncGloryUnlocks() {
    let newest = null;
    for (const tier of GLORY_TIERS) {
      if (this._lifetimeCoins >= tier.requiredLifetimeCredits
          && !this._gloryUnlocked.includes(tier.key)) {
        this._gloryUnlocked.push(tier.key);
        newest = tier;
      }
    }
    if (newest) {
      localStorage.setItem(KEY_GLORY_TIERS, JSON.stringify(this._gloryUnlocked));
    }
    return newest;
  }

  /**
   * Deduct coins. Returns true on success, false if insufficient funds.
   */
  spendCoins(amount) {
    if (this._coins < amount) return false;
    this._coins -= amount;
    localStorage.setItem(KEY_COINS, String(this._coins));
    return true;
  }

  /**
   * Unlock a lootbox skin (earned from Seesternbox). Saves immediately.
   */
  unlockLootboxSkin(key) {
    if (!LOOTBOX_SKIN_DEFS[key]) return false;
    if (this._lootboxOwned.includes(key)) return true; // already owned
    this._lootboxOwned.push(key);
    localStorage.setItem(KEY_LOOTBOX_OWNED, JSON.stringify(this._lootboxOwned));
    return true;
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
   * Set active skin (lootbox). Returns false if not owned.
   */
  setLootboxSkin(key) {
    if (!this.isLootboxSkinOwned(key)) return false;
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
          && (this._trophies - WIN_TROPHIES) < def.requiredTrophies) {
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
