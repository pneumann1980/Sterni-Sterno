/**
 * pickup.js
 * Weapon and ability pickup system for Seestern Fighters.
 * Pickups are floating, spinning models that respawn after collection.
 *
 * A pickup carries either a `weapon` (Weapon instance) or an `abilityKey`
 * (string key into ABILITY_DEFS). Both types use the same visual & lifecycle.
 */

import * as THREE from 'three';
import { buildPickupMarkerMesh } from './weaponModels.js';

const COLLECT_RADIUS = 1.5;
const RESPAWN_TIME   = 8.0;
const FLOAT_HEIGHT   = 0.6;

export class WeaponPickup {
  /**
   * @param {object} config
   * @param {number[]} config.position  - [x, y, z]
   * @param {object|null}  config.weapon    - Weapon instance, or null for ability pickup
   * @param {string|null}  config.abilityKey - ability key string, or null for weapon pickup
   * @param {THREE.Scene}  config.scene
   */
  constructor({ position, weapon, abilityKey, scene }) {
    this.position   = new THREE.Vector3(...position);
    this.weapon     = weapon     || null;
    this.abilityKey = abilityKey || null;
    this.scene      = scene;
    this._collected    = false;
    this._respawnTimer = 0;
    this._phase        = Math.random() * Math.PI * 2;

    this._buildMesh();
    this.scene.add(this.mesh);
  }

  _buildMesh() {
    const key  = this._resolveKey();
    this.mesh  = buildPickupMarkerMesh(key);
    this.mesh.position.copy(this.position);
    this.mesh.position.y = FLOAT_HEIGHT;
    this.mesh.castShadow  = false;
  }

  _resolveKey() {
    if (this.abilityKey) return this.abilityKey;
    if (!this.weapon)    return 'muschelShooter';
    if (this.weapon.key) return this.weapon.key;
    const name = this.weapon.name || '';
    if (name.includes('Blase') || name.includes('Kanone')) return 'blasenkanone';
    return 'muschelShooter';
  }

  update(dt) {
    if (this._collected) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this.respawn();
      return;
    }

    // Floating bob
    this.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.002 + this._phase) * 0.15;
    // Spin
    this.mesh.rotation.y += 1.2 * dt;
  }

  /**
   * Returns true if the character is within collection range.
   * @param {Character} character
   * @returns {boolean}
   */
  checkCollection(character) {
    if (this._collected || !character || !character.isAlive) return false;
    const dx = character.position.x - this.position.x;
    const dz = character.position.z - this.position.z;
    return Math.sqrt(dx * dx + dz * dz) < COLLECT_RADIUS;
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
   * Pickup entries may have:
   *   { pos, weapon: 'weaponKey' }   — weapon pickup
   *   { pos, ability: 'abilityKey' } — ability pickup
   *
   * @param {object} levelDef
   * @param {object} WEAPONS_MAP
   */
  spawnFromLevel(levelDef, WEAPONS_MAP) {
    if (!levelDef.pickups) return;

    for (const def of levelDef.pickups) {
      let weapon = null, abilityKey = null;

      if (def.weapon) {
        weapon = WEAPONS_MAP[def.weapon] || null;
        if (!weapon) continue;
      } else if (def.ability) {
        abilityKey = def.ability;
      } else {
        continue;
      }

      this.pickups.push(new WeaponPickup({
        position:  def.pos,
        weapon,
        abilityKey,
        scene:     this.scene,
      }));
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
      this.pickups.push(new WeaponPickup({
        position: [
          position.x + (Math.random() - 0.5) * 2 + offset,
          0,
          position.z + (Math.random() - 0.5) * 2,
        ],
        weapon,
        abilityKey: null,
        scene:      this.scene,
      }));
    });
  }

  /**
   * Update all pickups and return collection events.
   * @param {number} dt
   * @param {Character[]} characters
   * @returns {Array<{character, weapon, abilityKey, pickup}>}
   */
  update(dt, characters) {
    const events = [];

    for (const pickup of this.pickups) {
      pickup.update(dt);
      if (pickup._collected) continue;

      for (const char of characters) {
        if (!char || !char.isAlive) continue;

        if (pickup.checkCollection(char)) {
          pickup.collect();
          events.push({
            character: char,
            weapon:     pickup.weapon,
            abilityKey: pickup.abilityKey,
            pickup,
          });
          break;
        }
      }
    }

    return events;
  }

  /** Remove all pickups from the scene. */
  clear() {
    for (const pickup of this.pickups) pickup.remove();
    this.pickups = [];
  }

  /**
   * Get the nearest uncollected pickup and its distance from a position.
   * @param {THREE.Vector3} position
   * @returns {{pickup: WeaponPickup, dist: number}|null}
   */
  getNearestPickup(position) {
    let nearest = null, nearestDist = Infinity;
    for (const pickup of this.pickups) {
      if (pickup._collected) continue;
      const dx = pickup.position.x - position.x;
      const dz = pickup.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) { nearestDist = dist; nearest = pickup; }
    }
    return nearest ? { pickup: nearest, dist: nearestDist } : null;
  }
}
