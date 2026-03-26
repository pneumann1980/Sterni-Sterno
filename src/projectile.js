/**
 * projectile.js
 * Projectile system for Seestern Fighters.
 * Handles spawning, movement, hit detection, and cleanup.
 */

import * as THREE from 'three';

const CHARACTER_RADIUS = 1.0;
const MAX_PROJECTILES  = 20;

export class Projectile {
  /**
   * @param {object} config
   * @param {THREE.Vector3} config.position
   * @param {THREE.Vector3} config.direction  - normalised
   * @param {number} config.speed
   * @param {number} config.damage
   * @param {object} config.owner  - Character who fired
   * @param {number} config.lifetime - seconds
   * @param {number} config.radius  - sphere radius for visual
   * @param {number} config.color   - hex color
   */
  constructor({ position, direction, speed, damage, owner, lifetime, radius, color }) {
    this.position = position.clone();
    this.direction = direction.clone().normalize();
    this.speed     = speed;
    this.damage    = damage;
    this.owner     = owner;
    this.lifetime  = lifetime;
    this.radius    = radius;
    this.color     = color;

    this._hit = false;

    // Build mesh
    const geo = new THREE.SphereGeometry(radius, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
  }

  update(dt) {
    if (this._hit || this.lifetime <= 0) return;

    this.lifetime -= dt;
    this.position.x += this.direction.x * this.speed * dt;
    this.position.y += this.direction.y * this.speed * dt;
    this.position.z += this.direction.z * this.speed * dt;

    // Keep projectiles at ground level if y goes below 0
    if (this.position.y < 0.1) this.position.y = 0.1;

    this.mesh.position.copy(this.position);
  }

  get isDead() {
    return this.lifetime <= 0 || this._hit;
  }

  /**
   * Check if this projectile hit any of the given characters.
   * @param {Character[]} characters
   * @returns {Character|null} the hit character or null
   */
  checkCharacterHit(characters) {
    if (this._hit) return null;

    for (const ch of characters) {
      if (!ch || !ch.isAlive) continue;
      if (ch === this.owner) continue;

      const dx = this.position.x - ch.position.x;
      const dy = this.position.y - ch.position.y;
      const dz = this.position.z - ch.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < CHARACTER_RADIUS + this.radius) {
        this._hit = true;
        return ch;
      }
    }
    return null;
  }

  /**
   * Check if this projectile hit any obstacle.
   * @param {Array<{pos:[number,number,number], radius:number}>} obstacles
   * @returns {boolean}
   */
  checkObstacleHit(obstacles) {
    if (this._hit) return false;

    for (const obs of obstacles) {
      if (!obs) continue;
      const ox = obs.pos ? obs.pos[0] : obs.x;
      const oz = obs.pos ? obs.pos[2] : obs.z;
      const dx = this.position.x - ox;
      const dz = this.position.z - oz;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < (obs.radius || 1) + this.radius) {
        this._hit = true;
        return true;
      }
    }
    return false;
  }
}

export class ProjectileManager {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene       = scene;
    this.projectiles = [];
  }

  /**
   * Spawn a new projectile.
   * @param {object} config - same as Projectile constructor
   */
  spawn(config) {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      // Remove oldest
      const oldest = this.projectiles.shift();
      this.scene.remove(oldest.mesh);
    }

    const p = new Projectile(config);
    this.projectiles.push(p);
    this.scene.add(p.mesh);
    return p;
  }

  /**
   * Update all projectiles, check hits.
   * @param {number} dt
   * @param {Character[]} characters
   * @param {Array} obstacles - obstacle data from level
   * @returns {Array<{projectile, target}>} hit events
   */
  update(dt, characters, obstacles) {
    const hits = [];

    for (const proj of this.projectiles) {
      if (proj.isDead) continue;

      proj.update(dt);

      // Check obstacle hits first
      if (proj.checkObstacleHit(obstacles || [])) {
        continue;
      }

      // Check character hits
      const target = proj.checkCharacterHit(characters || []);
      if (target) {
        hits.push({ projectile: proj, target });
      }
    }

    this.cleanup();
    return hits;
  }

  /** Remove dead projectile meshes from scene. */
  cleanup() {
    const alive = [];
    for (const proj of this.projectiles) {
      if (proj.isDead) {
        this.scene.remove(proj.mesh);
      } else {
        alive.push(proj);
      }
    }
    this.projectiles = alive;
  }

  /** Remove all projectiles from scene. */
  clear() {
    for (const proj of this.projectiles) {
      this.scene.remove(proj.mesh);
    }
    this.projectiles = [];
  }
}
