/**
 * weapons.js
 * Defines weapon types and the slot system for Seestern Fighters.
 * Architecture supports up to N slots (currently 4, easily extendable to 5/6).
 */

export class Weapon {
  constructor(name, damage, special = null) {
    this.name = name;
    this.damage = damage;
    this.special = special; // placeholder for future special effects
  }
}

// Weapon catalog — add new weapons here
export const WEAPONS = {
  pistole:    new Weapon('Pistole',      15),
  saege:      new Weapon('Säge',          5),
  miniKanone: new Weapon('Mini-Kanone',  20, 'knockback_placeholder'),
};

export class WeaponSlots {
  constructor(maxSlots = 4) {
    this.maxSlots = maxSlots;
    this.slots = new Array(maxSlots).fill(null);
  }

  equip(slotIndex, weapon) {
    if (slotIndex >= 0 && slotIndex < this.maxSlots) {
      this.slots[slotIndex] = weapon;
    }
  }

  unequip(slotIndex) {
    if (slotIndex >= 0 && slotIndex < this.maxSlots) {
      this.slots[slotIndex] = null;
    }
  }

  /** Sum of damage across all filled slots — all fire simultaneously on hit */
  calculateTotalDamage() {
    return this.slots.reduce((sum, w) => sum + (w ? w.damage : 0), 0);
  }

  getEquippedWeapons() {
    return this.slots.filter(w => w !== null);
  }

  getSummary() {
    return this.slots.map((w, i) => ({
      slot: i + 1,
      weapon: w ? w.name : 'Leer',
      damage: w ? w.damage : 0,
    }));
  }
}
