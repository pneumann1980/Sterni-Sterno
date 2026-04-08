/**
 * obstacles.js
 * Builds obstacle meshes from a level definition and handles
 * circle-vs-circle collision in the XZ plane.
 *
 * Obstacle types:
 *   rock        — DodecahedronGeometry, dark grey
 *   coral       — DodecahedronGeometry, red-orange
 *   coral_low   — short coral (jumpable: characters pass through when jumping)
 *   barrel      — CylinderGeometry, brown
 *   pillar      — CylinderGeometry, slate blue (height from scale[1])
 *   ship_hull   — BoxGeometry plank (dark wood), supports rotY rotation
 *   ruin_wall   — Tall flat box, crumbled ancient stone
 *
 * Extra obstacle definition fields:
 *   rotY        — Y-axis rotation in radians (for ship_hull / ruin_wall)
 *   jumpable    — if true, characters that are jumping pass through (no character collision)
 *                 but projectiles are still blocked
 */

import * as THREE from 'three';

const CHARACTER_RADIUS = 0.6; // additional push-out buffer

const OBSTACLE_COLORS = {
  rock:       0x334455,
  coral:      0xcc4422,
  coral_low:  0xdd6633,
  barrel:     0x886633,
  pillar:     0x445566,
  ship_hull:  0x6b4a1a,   // weathered dark wood
  ruin_wall:  0x4a4040,   // ancient stone
};

export class ObstacleSystem {
  constructor() {
    this.obstacles = []; // [{ pos, radius, mesh, jumpable }]
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

      switch (obsDef.type) {

        case 'pillar': {
          const height = obsDef.scale ? obsDef.scale[1] : 1.5;
          const rad    = (obsDef.scale ? Math.max(obsDef.scale[0], obsDef.scale[2]) : 0.5) * 0.5;
          const geo    = new THREE.CylinderGeometry(rad, rad * 1.1, height, 8);
          mesh         = new THREE.Mesh(geo, mat);
          mesh.position.set(obsDef.pos[0], height / 2, obsDef.pos[2]);
          break;
        }

        case 'barrel': {
          const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8);
          mesh      = new THREE.Mesh(geo, mat);
          mesh.position.set(obsDef.pos[0], 0.4, obsDef.pos[2]);
          if (obsDef.scale) mesh.scale.set(...obsDef.scale);
          break;
        }

        case 'ship_hull': {
          // Wide plank wall (W × H × D)
          const sx = obsDef.scale ? obsDef.scale[0] : 1;
          const sy = obsDef.scale ? obsDef.scale[1] : 1;
          const sz = obsDef.scale ? obsDef.scale[2] : 1;
          const plankW = 3.0 * sx;
          const plankH = 1.6 * sy;
          const plankD = 0.55 * sz;
          const geo    = new THREE.BoxGeometry(plankW, plankH, plankD);
          mat.color.setHex(OBSTACLE_COLORS.ship_hull);
          // Add slight grain variation
          const geo2 = new THREE.BoxGeometry(plankW * 0.95, plankH * 0.12, plankD * 1.05);
          const grainMat = new THREE.MeshLambertMaterial({ color: 0x4a3010 });
          const grain1 = new THREE.Mesh(geo2, grainMat);
          grain1.position.y = 0.3;
          const grain2 = new THREE.Mesh(geo2, grainMat);
          grain2.position.y = -0.3;
          mesh = new THREE.Mesh(geo, mat);
          mesh.add(grain1, grain2);
          mesh.position.set(obsDef.pos[0], plankH / 2, obsDef.pos[2]);
          if (obsDef.rotY !== undefined) mesh.rotation.y = obsDef.rotY;
          break;
        }

        case 'ruin_wall': {
          const sx = obsDef.scale ? obsDef.scale[0] : 1;
          const sy = obsDef.scale ? obsDef.scale[1] : 1;
          const sz = obsDef.scale ? obsDef.scale[2] : 1;
          const w  = 2.8 * sx;
          const h  = 2.0 * sy;
          const d  = 0.5 * sz;
          const geo = new THREE.BoxGeometry(w, h, d);
          // Add crumbled top accent
          const topGeo = new THREE.BoxGeometry(w * 0.7, h * 0.15, d * 1.1);
          const topMat = new THREE.MeshLambertMaterial({ color: 0x3a3030 });
          const topMesh = new THREE.Mesh(topGeo, topMat);
          topMesh.position.y = h * 0.42;
          topMesh.rotation.y = 0.18;
          mesh = new THREE.Mesh(geo, mat);
          mesh.add(topMesh);
          mesh.position.set(obsDef.pos[0], h / 2, obsDef.pos[2]);
          if (obsDef.rotY !== undefined) mesh.rotation.y = obsDef.rotY;
          break;
        }

        case 'coral_low': {
          // Short, squat coral — blocks shots but jumpable by characters
          const geo = new THREE.DodecahedronGeometry(0.5, 0);
          mesh      = new THREE.Mesh(geo, mat);
          mesh.position.set(obsDef.pos[0], 0, obsDef.pos[2]);
          if (obsDef.scale) mesh.scale.set(obsDef.scale[0], obsDef.scale[1] * 0.55, obsDef.scale[2]);
          mesh.rotation.y = Math.random() * Math.PI;
          break;
        }

        default: {
          // rock / coral — use dodecahedron
          const geo = new THREE.DodecahedronGeometry(0.55, 0);
          mesh      = new THREE.Mesh(geo, mat);
          mesh.position.set(obsDef.pos[0], 0, obsDef.pos[2]);
          if (obsDef.scale) mesh.scale.set(...obsDef.scale);
          mesh.rotation.y = Math.random() * Math.PI;
        }
      }

      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      this.obstacles.push({
        pos:      obsDef.pos,
        radius:   obsDef.radius || 1.0,
        mesh,
        jumpable: obsDef.jumpable || obsDef.type === 'coral_low',
      });
    }
  }

  /**
   * Push character out if it overlaps any obstacle (XZ circle-vs-circle).
   * Jumpable obstacles are skipped while the character is in the air.
   * @param {Character} character
   */
  checkCharacterCollision(character) {
    for (const obs of this.obstacles) {
      // Jumpable obstacles: skip collision while character is airborne
      if (obs.jumpable && character.isJumping) continue;

      const ox = obs.pos[0];
      const oz = obs.pos[2];
      const dx = character.position.x - ox;
      const dz = character.position.z - oz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = obs.radius + CHARACTER_RADIUS;

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        character.position.x = ox + nx * minDist;
        character.position.z = oz + nz * minDist;
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
   * All obstacle types block projectiles (jumpable doesn't exempt from shot-blocking).
   */
  checkProjectileHit(projectile) {
    for (const obs of this.obstacles) {
      const ox = obs.pos[0];
      const oz = obs.pos[2];
      const dx = projectile.position.x - ox;
      const dz = projectile.position.z - oz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < obs.radius + projectile.radius) return true;
    }
    return false;
  }

  /** Remove all obstacle meshes from the scene and clear the list. */
  clear(scene) {
    for (const obs of this.obstacles) {
      if (obs.mesh && scene) scene.remove(obs.mesh);
    }
    this.obstacles = [];
  }

  /** Returns the raw obstacle data array (for projectile checks etc.) */
  getObstacleData() { return this.obstacles; }
}
