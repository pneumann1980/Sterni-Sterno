/**
 * pickup.js
 * Weapon pickup system for Seestern Fighters.
 * Pickups are floating, spinning tori that respawn after collection.
 */

import * as THREE from 'three';

const COLLECT_RADIUS = 1.5;
const RESPAWN_TIME   = 8.0;
const FLOAT_HEIGHT   = 0.6;
const SPIN_SPEED     = 2.0;

const PICKUP_COLORS = {
  pistole:    0x00ffff, // cyan
  saege:      0x00cc44, // green
  miniKanone: 0xff3300, // red
};

export class WeaponPickup {
  /**
   * @param {object} config
   * @param {number[]} config.position - [x, y, z]
   * @param {object}  config.weapon   - Weapon instance
   * @param {THREE.Scene} config.scene
   */
  constructor({ position, weapon, scene }) {
    this.position = new THREE.Vector3(...position);
    this.weapon   = weapon;
    this.scene    = scene;
    this._collected    = false;
    this._respawnTimer = 0;
    this._bobTime      = Math.random() * Math.PI * 2; // random phase

    this._buildMesh();
    this.scene.add(this.mesh);
  }

  _buildMesh() {
    const weaponKey = this._weaponKey();
    const color     = PICKUP_COLORS[weaponKey] || 0xffffff;

    const geo = new THREE.TorusGeometry(0.35, 0.12, 8, 16);
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    this.mesh.position.y = FLOAT_HEIGHT;
    this.mesh.castShadow = false;
  }

  _weaponKey() {
    if (!this.weapon) return 'pistole';
    const name = this.weapon.name || '';
    if (name.includes('Kanone')) return 'miniKanone';
    if (name.includes('ge')) return 'saege';
    return 'pistole';
  }

  update(dt) {
    if (this._collected) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    this._bobTime += dt;

    // Floating bob
    this.mesh.position.y = FLOAT_HEIGHT + Math.sin(this._bobTime * 2) * 0.1;

    // Spinning
    this.mesh.rotation.y += SPIN_SPEED * dt;
    this.mesh.rotation.x += SPIN_SPEED * 0.3 * dt;
  }

  /**
   * @param {Character} character
   * @returns {object|null} weapon if collected, null otherwise
   */
  checkCollection(character) {
    if (this._collected || !character || !character.isAlive) return null;

    const dx = character.position.x - this.position.x;
    const dz = character.position.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < COLLECT_RADIUS) {
      return this.weapon;
    }
    return null;
  }

  collect() {
    this._collected    = true;
    this._respawnTimer = RESPAWN_TIME;
    this.mesh.visible  = false;
  }

  respawn() {
    this._collected   = false;
    this.mesh.visible = true;
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

export class PickupManager {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene   = scene;
    this.pickups = [];
  }

  /**
   * Create pickups from a level definition.
   * @param {object} levelDef
   * @param {object} WEAPONS_MAP - the WEAPONS catalog
   */
  spawnFromLevel(levelDef, WEAPONS_MAP) {
    if (!levelDef.pickups) return;

    for (const pickupDef of levelDef.pickups) {
      const weapon = WEAPONS_MAP[pickupDef.weapon] || null;
      if (!weapon) continue;

      const pickup = new WeaponPickup({
        position: pickupDef.pos,
        weapon,
        scene: this.scene,
      });
      this.pickups.push(pickup);
    }
  }

  /**
   * Spawn pickups for dropped weapons (e.g. on jump-attack hit).
   * @param {THREE.Vector3} position
   * @param {object[]} weaponList - array of { weapon } objects
   */
  spawnDropped(position, weaponList) {
    weaponList.forEach(({ weapon }, i) => {
      if (!weapon) return;
      const offset = i * 0.8;
      const pickup = new WeaponPickup({
        position: [
          position.x + (Math.random() - 0.5) * 2 + offset,
          0,
          position.z + (Math.random() - 0.5) * 2,
        ],
        weapon,
        scene: this.scene,
      });
      this.pickups.push(pickup);
    });
  }

  /**
   * Update all pickups and return collection events.
   * @param {number} dt
   * @param {Character[]} characters
   * @returns {Array<{character, weapon, pickup}>}
   */
  update(dt, characters) {
    const events = [];

    for (const pickup of this.pickups) {
      pickup.update(dt);

      if (pickup._collected) continue;

      for (const char of characters) {
        if (!char || !char.isAlive) continue;

        const weapon = pickup.checkCollection(char);
        if (weapon) {
          pickup.collect();
          events.push({ character: char, weapon, pickup });
          break; // one character collects per pickup per frame
        }
      }
    }

    return events;
  }

  /** Remove all pickups from the scene. */
  clear() {
    for (const pickup of this.pickups) {
      pickup.remove();
    }
    this.pickups = [];
  }

  /**
   * Get the nearest uncollected pickup and its distance from a position.
   * @param {THREE.Vector3} position
   * @returns {{pickup: WeaponPickup, dist: number}|null}
   */
  getNearestPickup(position) {
    let nearest = null;
    let nearestDist = Infinity;

    for (const pickup of this.pickups) {
      if (pickup._collected) continue;
      const dx = pickup.position.x - position.x;
      const dz = pickup.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest     = pickup;
      }
    }

    return nearest ? { pickup: nearest, dist: nearestDist } : null;
  }
}
