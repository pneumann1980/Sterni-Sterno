/**
 * abilities.js
 * Temporary and one-use special abilities for Seestern Fighters.
 *
 * Stachel-Aura   — passive aura (15 s), damages nearby enemies each tick
 * Nova-Explosion — hold ability button 1 s to charge, AOE knockback + damage, one-use
 * Sand-Tarnung   — press ability button to bury; emerge with small AoE; 12 s cooldown
 */

export const ABILITY_DEFS = {
  stachelAura: {
    key:        'stachelAura',
    name:       'Stachel-Aura',
    duration:   15,
    damage:     8,
    damageTick: 0.45,
    auraRadius: 2.0,
  },
  novaBlast: {
    key:         'novaBlast',
    name:        'Nova-Explosion',
    chargeTime:  1.0,
    damage:      80,
    blastRadius: 5.0,
    knockback:   18,
  },
  einbuddeln: {
    key:          'einbuddeln',
    name:         'Sand-Tarnung',
    cooldown:     12,    // seconds before can dig again after surfacing
    emergeRadius: 3.0,   // AoE radius on surface
    emergeDamage: 25,    // damage to enemies within emergeRadius
    emergeKnock:  10,    // knockback impulse on surface
  },
};

export class AbilityManager {
  constructor() {
    // ── Stachel-Aura ─────────────────────────────────────────────────────────
    this._auraTimer = 0;
    this._auraTick  = 0;

    // ── Nova-Blast ────────────────────────────────────────────────────────────
    this._novaReady    = false;
    this._novaCharging = false;
    this._novaCharge   = 0;

    // ── Sand-Tarnung ──────────────────────────────────────────────────────────
    this._buriedReady    = false;
    this.isBuried        = false;
    this._buryCooldown   = 0;    // counts down to 0 → re-grants ability
    this._pendingEmerge  = false; // signals the game loop to trigger emerge AoE
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
    // Only grant if not on cooldown and not already buried
    if (!this.isBuried && this._buryCooldown <= 0) {
      this._buriedReady = true;
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  get hasStachelAura()     { return this._auraTimer > 0; }
  get stachelAuraTimer()   { return this._auraTimer; }

  get hasNovaBlast()       { return this._novaReady; }
  get isNovaCharging()     { return this._novaCharging; }
  get novaChargeProgress() { return this._novaCharge; }

  get hasEinbuddeln()      { return this._buriedReady; }
  get buryCooldown()       { return this._buryCooldown; }
  /** 0 = on cooldown, 1 = ready */
  get buryCooldownProgress() {
    const max = ABILITY_DEFS.einbuddeln.cooldown;
    return Math.max(0, 1 - this._buryCooldown / max);
  }

  // ── Per-frame update ─────────────────────────────────────────────────────────

  /**
   * Call once per frame. Returns:
   *   'aura_tick'   — aura damage tick
   *   'nova_fire'   — nova explodes
   *   'bury_emerge' — player just surfaced → trigger AoE
   *   null
   */
  update(dt) {
    // Pending emerge event (set by toggleBury / ejectFromGround)
    if (this._pendingEmerge) {
      this._pendingEmerge = false;
      return 'bury_emerge';
    }

    // Bury cooldown — re-grant when it expires
    if (this._buryCooldown > 0) {
      this._buryCooldown = Math.max(0, this._buryCooldown - dt);
      if (this._buryCooldown <= 0) {
        this._buriedReady = true; // ability re-granted after cooldown
      }
    }

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

  startNovaCharge() {
    if (!this._novaReady || this._novaCharging) return false;
    this._novaCharging = true;
    this._novaCharge   = 0;
    return true;
  }

  /**
   * Toggle buried state.
   * Burying: immediately goes underground.
   * Surfacing: starts cooldown, schedules emerge AoE event.
   * @returns {boolean|null} new isBuried state, or null if unavailable
   */
  toggleBury() {
    if (!this._buriedReady) return null;
    this.isBuried = !this.isBuried;
    if (!this.isBuried) {
      // Surfacing — start cooldown, schedule emerge event
      this._buriedReady  = false;
      this._buryCooldown = ABILITY_DEFS.einbuddeln.cooldown;
      this._pendingEmerge = true;
    }
    return this.isBuried;
  }

  /**
   * Force-eject from ground (e.g. hit by nova blast or jump key while buried).
   * Also triggers emerge AoE.
   */
  ejectFromGround() {
    if (!this.isBuried) return;
    this.isBuried       = false;
    this._buriedReady   = false;
    this._buryCooldown  = ABILITY_DEFS.einbuddeln.cooldown;
    this._pendingEmerge = true;
  }
}
