/**
 * weapons.js
 * Two projectile weapons used in weapon slots.
 * (Stachel-Aura, Nova-Explosion and Sand-Tarnung are now Abilities — see abilities.js)
 *
 * Muschel-Shooter  — standard projectile, medium speed/damage
 * Blasenkanone     — large slow bubble, higher damage, bigger hitbox
 */

export class Weapon {
  constructor({ key, name, damage, type, cooldown, special = null }) {
    this.key          = key;        // unique identifier for config lookups
    this.name         = name;
    this.damage       = damage;
    this.type         = type;       // 'projectile' | 'aura'
    this.cooldown     = cooldown;   // seconds between uses
    this.activeCooldown = 0;
    this.special      = special;
  }

  get isReady() { return this.activeCooldown <= 0; }

  updateCooldown(dt) {
    if (this.activeCooldown > 0) {
      this.activeCooldown = Math.max(0, this.activeCooldown - dt);
    }
  }

  fire() { this.activeCooldown = this.cooldown; }
}

// ── Weapon catalog ─────────────────────────────────────────────────────────────
export const WEAPONS = {
  muschelShooter: new Weapon({
    key:      'muschelShooter',
    name:     'Muschel-Shooter',
    damage:   8,
    type:     'projectile',
    cooldown: 0.65,
  }),

  blasenkanone: new Weapon({
    key:      'blasenkanone',
    name:     'Blasenkanone',
    damage:   15,
    type:     'projectile',
    cooldown: 1.8,
    special:  'large_slow',
  }),
};

// ── Slot system (unchanged API) ────────────────────────────────────────────────
export class WeaponSlots {
  constructor(maxSlots = 4) {
    this.maxSlots    = maxSlots;
    this.slots       = new Array(maxSlots).fill(null);
    this.activeIndex = 0;
  }

  equip(index, weapon) {
    if (index >= 0 && index < this.maxSlots) this.slots[index] = weapon;
  }
  unequip(index) {
    if (index >= 0 && index < this.maxSlots) this.slots[index] = null;
  }

  getActive()  { return this.slots[this.activeIndex]; }
  nextSlot()   { this.activeIndex = (this.activeIndex + 1) % this.maxSlots; }
  prevSlot()   { this.activeIndex = (this.activeIndex - 1 + this.maxSlots) % this.maxSlots; }

  dropAll() {
    const dropped = this.slots
      .map((w, i) => (w ? { weapon: w, index: i } : null))
      .filter(Boolean);
    this.slots.fill(null);
    this.activeIndex = 0;
    return dropped;
  }

  firstEmptySlot() { return this.slots.findIndex(w => w === null); }

  updateCooldowns(dt) {
    this.slots.forEach(w => { if (w) w.updateCooldown(dt); });
  }

  calculateTotalDamage() {
    return this.slots.reduce((s, w) => s + (w ? w.damage : 0), 0);
  }

  getEquippedWeapons() { return this.slots.filter(w => w !== null); }

  getSummary() {
    return this.slots.map((w, i) => ({
      slot:        i + 1,
      weapon:      w ? w.name : 'Leer',
      damage:      w ? w.damage : 0,
      active:      i === this.activeIndex,
      ready:       w ? w.isReady : false,
      cooldownPct: w && w.cooldown > 0
        ? Math.max(0, 1 - w.activeCooldown / w.cooldown)
        : 1,
    }));
  }
}
