/**
 * obstacles.js
 * Builds obstacle meshes from a level definition and handles
 * circle-vs-circle collision in the XZ plane.
 */

import * as THREE from 'three';

const CHARACTER_RADIUS = 0.6; // additional buffer when pushing character out

const OBSTACLE_COLORS = {
  rock:   0x334455,
  coral:  0xcc4422,
  barrel: 0x886633,
  pillar: 0x445566,
};

export class ObstacleSystem {
  constructor() {
    this.obstacles = []; // [{ pos, radius, mesh }]
  }

  /**
   * Create meshes for every obstacle in the level definition.
   * @param {object} levelDef
   * @param {THREE.Scene} scene
   */
  buildFromLevel(levelDef, scene) {
    this.clear(scene);

    if (!levelDef.obstacles) return;

    for (const obsDef of levelDef.obstacles) {
      const color = OBSTACLE_COLORS[obsDef.type] || 0x334455;
      const mat   = new THREE.MeshLambertMaterial({ color });
      let mesh;

      if (obsDef.type === 'pillar') {
        const height = (obsDef.scale ? obsDef.scale[1] : 1.5);
        const rad    = (obsDef.scale ? Math.max(obsDef.scale[0], obsDef.scale[2]) : 0.5) * 0.5;
        const geo    = new THREE.CylinderGeometry(rad, rad * 1.1, height, 8);
        mesh         = new THREE.Mesh(geo, mat);
        mesh.position.set(obsDef.pos[0], height / 2, obsDef.pos[2]);
      } else if (obsDef.type === 'barrel') {
        const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8);
        mesh      = new THREE.Mesh(geo, mat);
        mesh.position.set(obsDef.pos[0], 0.4, obsDef.pos[2]);
        if (obsDef.scale) mesh.scale.set(...obsDef.scale);
      } else {
        // rock / coral — use dodecahedron
        const geo = new THREE.DodecahedronGeometry(0.55, 0);
        mesh      = new THREE.Mesh(geo, mat);
        mesh.position.set(obsDef.pos[0], 0, obsDef.pos[2]);
        if (obsDef.scale) mesh.scale.set(...obsDef.scale);
        mesh.rotation.y = Math.random() * Math.PI;
      }

      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      this.obstacles.push({
        pos:    obsDef.pos,
        radius: obsDef.radius || 1.0,
        mesh,
      });
    }
  }

  /**
   * Push character out if it overlaps any obstacle (XZ circle-vs-circle).
   * @param {Character} character
   */
  checkCharacterCollision(character) {
    for (const obs of this.obstacles) {
      const ox = obs.pos[0];
      const oz = obs.pos[2];
      const dx = character.position.x - ox;
      const dz = character.position.z - oz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = obs.radius + CHARACTER_RADIUS;

      if (dist < minDist && dist > 0.001) {
        // Push character away from obstacle center
        const nx = dx / dist;
        const nz = dz / dist;
        character.position.x = ox + nx * minDist;
        character.position.z = oz + nz * minDist;
        // Kill lateral velocity component toward obstacle
        const dot = character.velocity.x * nx + character.velocity.z * nz;
        if (dot < 0) {
          character.velocity.x -= dot * nx;
          character.velocity.z -= dot * nz;
        }
      }
    }
  }

  /**
   * Returns true if projectile is within any obstacle radius.
   * @param {Projectile} projectile
   * @returns {boolean}
   */
  checkProjectileHit(projectile) {
    for (const obs of this.obstacles) {
      const ox = obs.pos[0];
      const oz = obs.pos[2];
      const dx = projectile.position.x - ox;
      const dz = projectile.position.z - oz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < obs.radius + projectile.radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Remove all obstacle meshes from the scene and clear the list.
   * @param {THREE.Scene} scene
   */
  clear(scene) {
    for (const obs of this.obstacles) {
      if (obs.mesh && scene) scene.remove(obs.mesh);
    }
    this.obstacles = [];
  }

  /** Returns the raw obstacle data array (for projectile checks etc.) */
  getObstacleData() {
    return this.obstacles;
  }
}
