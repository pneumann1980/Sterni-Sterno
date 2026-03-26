/**
 * weapons.js
 * Defines weapon types and the slot system for Seestern Fighters.
 * Supports projectile and melee weapon types with individual cooldowns.
 */

export class Weapon {
  constructor(name, damage, type, cooldown, special = null) {
    this.name         = name;
    this.damage       = damage;
    this.type         = type;     // 'projectile' | 'melee'
    this.cooldown     = cooldown; // seconds
    this.activeCooldown = 0;
    this.special      = special;
  }

  get isReady() {
    return this.activeCooldown <= 0;
  }

  updateCooldown(dt) {
    if (this.activeCooldown > 0) {
      this.activeCooldown = Math.max(0, this.activeCooldown - dt);
    }
  }

  fire() {
    this.activeCooldown = this.cooldown;
  }
}

// Weapon catalog — add new weapons here
export const WEAPONS = {
  pistole:    new Weapon('Pistole',      15, 'projectile', 0.6),
  saege:      new Weapon('Säge',          8, 'melee',      0.8),
  miniKanone: new Weapon('Mini-Kanone',  30, 'projectile', 2.0, 'heavy'),
};

export class WeaponSlots {
  constructor(maxSlots = 4) {
    this.maxSlots   = maxSlots;
    this.slots      = new Array(maxSlots).fill(null);
    this.activeIndex = 0;
  }

  equip(index, weapon) {
    if (index >= 0 && index < this.maxSlots) {
      this.slots[index] = weapon;
    }
  }

  unequip(index) {
    if (index >= 0 && index < this.maxSlots) {
      this.slots[index] = null;
    }
  }

  getActive() {
    return this.slots[this.activeIndex];
  }

  nextSlot() {
    this.activeIndex = (this.activeIndex + 1) % this.maxSlots;
  }

  prevSlot() {
    this.activeIndex = (this.activeIndex - 1 + this.maxSlots) % this.maxSlots;
  }

  /** Drop all weapons — returns array of { weapon, index }, clears slots */
  dropAll() {
    const dropped = this.slots
      .map((w, i) => (w ? { weapon: w, index: i } : null))
      .filter(Boolean);
    this.slots.fill(null);
    this.activeIndex = 0;
    return dropped;
  }

  /** Find the first empty slot index, or -1 if all are full */
  firstEmptySlot() {
    return this.slots.findIndex(w => w === null);
  }

  updateCooldowns(dt) {
    this.slots.forEach(w => { if (w) w.updateCooldown(dt); });
  }

  /** Legacy: sum of all slots for jump-attack damage */
  calculateTotalDamage() {
    return this.slots.reduce((s, w) => s + (w ? w.damage : 0), 0);
  }

  getEquippedWeapons() {
    return this.slots.filter(w => w !== null);
  }

  getSummary() {
    return this.slots.map((w, i) => ({
      slot:   i + 1,
      weapon: w ? w.name : 'Leer',
      damage: w ? w.damage : 0,
      active: i === this.activeIndex,
      ready:  w ? w.isReady : false,
      cooldownPct: w && w.cooldown > 0 ? Math.max(0, 1 - w.activeCooldown / w.cooldown) : 1,
    }));
  }
}
