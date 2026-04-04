/**
 * abilities.js
 * Temporary and one-use special abilities for Seestern Fighters.
 *
 * Stachel-Aura   — passive aura (15 s), damages nearby enemies each tick
 * Nova-Explosion — hold ability button 1 s to charge, AOE knockback + damage, one-use
 * Sand-Tarnung   — press ability button to bury underground; jump or nova hit to exit
 */

export const ABILITY_DEFS = {
  stachelAura: {
    key:        'stachelAura',
    name:       'Stachel-Aura',
    duration:   15,      // seconds the aura stays active
    damage:     8,       // HP per damage tick
    damageTick: 0.45,    // seconds between ticks
    auraRadius: 2.0,     // units
  },
  novaBlast: {
    key:         'novaBlast',
    name:        'Nova-Explosion',
    chargeTime:  1.0,    // seconds to hold before firing
    damage:      80,     // leaves targets at min 1 HP
    blastRadius: 5.0,    // units
    knockback:   18,     // velocity impulse
  },
  einbuddeln: {
    key:  'einbuddeln',
    name: 'Sand-Tarnung',
  },
};

export class AbilityManager {
  constructor() {
    // ── Stachel-Aura (timed passive) ─────────────────────────────────────────
    this._auraTimer = 0;    // > 0 = active
    this._auraTick  = 0;    // countdown to next damage tick

    // ── Nova-Blast (one-use active) ───────────────────────────────────────────
    this._novaReady    = false;
    this._novaCharging = false;
    this._novaCharge   = 0;  // 0 → 1

    // ── Sand-Tarnung (toggle) ─────────────────────────────────────────────────
    this._buriedReady = false;
    this.isBuried     = false;
  }

  // ── Grants ──────────────────────────────────────────────────────────────────

  grantStachelAura() {
    this._auraTimer = ABILITY_DEFS.stachelAura.duration;
    this._auraTick  = 0;
  }

  grantNovaBlast() {
    this._novaReady    = true;
    this._novaCharging = false;
    this._novaCharge   = 0;
  }

  grantEinbuddeln() {
    this._buriedReady = true;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  get hasStachelAura()     { return this._auraTimer > 0; }
  get stachelAuraTimer()   { return this._auraTimer; }

  get hasNovaBlast()       { return this._novaReady; }
  get isNovaCharging()     { return this._novaCharging; }
  get novaChargeProgress() { return this._novaCharge; } // 0..1

  get hasEinbuddeln()      { return this._buriedReady; }

  // ── Per-frame update ─────────────────────────────────────────────────────────

  /**
   * Call once per frame. Returns:
   *   'aura_tick' — aura damage should be applied this frame
   *   'nova_fire' — nova charge is complete and should explode
   *   null        — nothing special
   */
  update(dt) {
    // Aura countdown
    if (this._auraTimer > 0) {
      this._auraTimer = Math.max(0, this._auraTimer - dt);
      this._auraTick  -= dt;
      if (this._auraTick <= 0) {
        this._auraTick += ABILITY_DEFS.stachelAura.damageTick;
        return 'aura_tick';
      }
    }

    // Nova charge
    if (this._novaCharging) {
      this._novaCharge += dt / ABILITY_DEFS.novaBlast.chargeTime;
      if (this._novaCharge >= 1) {
        this._novaCharge   = 1;
        this._novaCharging = false;
        this._novaReady    = false;
        return 'nova_fire';
      }
    }

    return null;
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  /** Start charging nova blast. Returns false if not available. */
  startNovaCharge() {
    if (!this._novaReady || this._novaCharging) return false;
    this._novaCharging = true;
    this._novaCharge   = 0;
    return true;
  }

  /**
   * Toggle buried state.
   * @returns {boolean|null} new isBuried value, or null if no ability available
   */
  toggleBury() {
    if (!this._buriedReady) return null;
    this.isBuried = !this.isBuried;
    if (!this.isBuried) {
      // Surfacing consumes the ability
      this._buriedReady = false;
    }
    return this.isBuried;
  }

  /** Force-eject from ground (e.g. hit by nova). Consumes the ability. */
  ejectFromGround() {
    if (!this.isBuried) return;
    this.isBuried     = false;
    this._buriedReady = false;
  }
}
