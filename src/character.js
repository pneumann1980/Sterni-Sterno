/**
 * character.js
 * Character class: physics, movement, jump mechanics, health, animation, mesh.
 * Both players and AI enemies use this class — no cheating, same rules.
 */

import * as THREE from 'three';
import { WeaponSlots } from './weapons.js';
import { CharacterAnimator } from './animation.js';
import {
  buildShellGunMesh,
  buildBubbleCannonMesh,
  buildSpikeAuraMesh,
  buildCoralGunMesh,
} from './weaponModels.js';

export const WORLD_HALF = 19;   // half of play-area size
const GRAVITY            = 22;  // units / s²
const GROUND_Y           = 0;   // logical Y when standing

export class Character {
  constructor({ name, color, position, maxHealth = 100 }) {
    this.name       = name;
    this.color      = color;
    this.maxHealth  = maxHealth;
    this.health     = maxHealth;
    this.isAlive    = true;

    // Spatial state
    this.position   = new THREE.Vector3(...position);
    this.velocity   = new THREE.Vector3();
    this.isOnGround = true;
    this.isJumping  = false;

    // Facing direction (radians, used for projectile fire direction)
    this.facingAngle = 0;

    // Combat state
    this.attackLanded  = false;   // did this jump already deal damage?
    this.hitFlashTimer = 0;
    this._wasHit       = false;   // single-frame flag for animator
    this.hitImpulse    = 0;       // scale-up impulse on hit

    // Death animation state
    this._dying      = false;
    this._deathTimer = 0;

    // Jump timing — 5-second cooldown, same for everyone
    this.jumpCooldown       = 0;
    this.JUMP_COOLDOWN_TIME = 5;
    this.JUMP_FORCE         = 13;
    this.moveSpeed          = 8;

    // Weapon slots
    this.weaponSlots = new WeaponSlots(4);

    // Three.js mesh
    this._buildMesh();
    this.mesh.position.copy(this.position);

    // Animator (created after mesh so arm/body refs are available)
    this.animator = new CharacterAnimator(this.mesh, this.bodyMesh, this.armMeshes);
  }

  // ── Mesh construction ──────────────────────────────────────────────────────

  _buildMesh() {
    this.mesh = new THREE.Group();
    this.bodyMat = new THREE.MeshLambertMaterial({ color: this.color });

    // Central body — larger flattened sphere
    const bodyGeo = new THREE.SphereGeometry(0.52, 10, 8);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    bodyMesh.scale.y = 0.38;
    bodyMesh.castShadow = true;
    this.mesh.add(bodyMesh);
    this.bodyMesh = bodyMesh;

    // 5 arms — each arm is 3 spheres tapering outward
    this.armMeshes = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const armGroup = new THREE.Group();
      armGroup.rotation.y = angle; // point arm outward

      const sizes   = [0.22, 0.16, 0.10]; // taper from body to tip
      const offsets = [0.55, 0.95, 1.28]; // distance from center

      sizes.forEach((r, j) => {
        const seg = new THREE.Mesh(
          new THREE.SphereGeometry(r, 7, 6),
          this.bodyMat
        );
        seg.scale.y = 0.45;
        seg.position.set(offsets[j], 0, 0); // along local X axis
        seg.castShadow = true;
        armGroup.add(seg);
      });

      this.mesh.add(armGroup);
      this.armMeshes.push(armGroup);
    }

    // Eyes (decorative — own materials, not affected by hit-flash)
    const eyeMat   = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111133 });
    for (const xOff of [-0.16, 0.16]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 6), eyeMat);
      eye.position.set(xOff, 0.14, 0.47);
      this.mesh.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), pupilMat);
      pupil.position.set(xOff, 0.14, 0.52);
      this.mesh.add(pupil);
    }

    // Weapon mount — right-hand side
    this._weaponMount = new THREE.Group();
    this._weaponMount.position.set(0.7, 0.1, 0);
    this.mesh.add(this._weaponMount);
    this._currentWeaponModel = null;

    // Name label (drawn via sprite)
    this._addNameLabel();
  }

  _addNameLabel() {
    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 128, 40);

    const tex       = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite    = new THREE.Sprite(spriteMat);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.set(0, 1.0, 0);
    this.mesh.add(sprite);
  }

  showWeaponModel(weapon) {
    // Clear previous model
    while (this._weaponMount.children.length > 0) {
      this._weaponMount.remove(this._weaponMount.children[0]);
    }
    if (!weapon) {
      this._currentWeaponModel = null;
      return;
    }
    let model;
    const n = weapon.name.toLowerCase();
    if (n.includes('pistole') || n.includes('muschel') || n.includes('shell')) {
      model = buildShellGunMesh();
    } else if (n.includes('kanone') || n.includes('blase') || n.includes('bubble')) {
      model = buildBubbleCannonMesh();
    } else if (n.includes('ge') || n.includes('stachel') || n.includes('spike')) {
      model = buildSpikeAuraMesh();
    } else {
      model = buildCoralGunMesh();
    }
    model.scale.setScalar(0.75);
    this._weaponMount.add(model);
    this._currentWeaponModel = model;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Attempt a jump. Returns true if the jump was started. */
  jump() {
    if (this.jumpCooldown > 0 || !this.isOnGround) return false;
    this.velocity.y    = this.JUMP_FORCE;
    this.isJumping     = true;
    this.isOnGround    = false;
    this.attackLanded  = false;
    this.jumpCooldown  = this.JUMP_COOLDOWN_TIME;
    return true;
  }

  /** Set horizontal movement intent. dx/dz are -1..1; magnitude is normalised. */
  move(dx, dz) {
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0.001) {
      this.velocity.x = (dx / len) * this.moveSpeed;
      this.velocity.z = (dz / len) * this.moveSpeed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  /** Returns a normalised THREE.Vector3 in the character's facing direction. */
  getForwardDirection() {
    return new THREE.Vector3(
      Math.sin(this.facingAngle),
      0,
      Math.cos(this.facingAngle)
    ).normalize();
  }

  /** Called by CombatSystem when a jump-attack or projectile lands on this character. */
  takeDamage(amount) {
    if (!this.isAlive) return;
    this.health = Math.max(0, this.health - amount);
    this.hitFlashTimer = 0.18;
    this._wasHit = true;
    this.hitImpulse = 0.3;
    if (this.health <= 0) {
      this.isAlive = false;
      this._dying  = true;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(dt) {
    // Snapshot wasHit for this frame, then reset
    const wasHit = this._wasHit;
    this._wasHit = false;

    if (!this.isAlive) {
      // Death tilt over 0.5 s
      if (this._dying) {
        this._deathTimer += dt;
        const p = Math.min(1, this._deathTimer / 0.5);
        this.mesh.rotation.z = p * (Math.PI / 2);
        if (p >= 1) this._dying = false;
      }
      // Update animator for death state
      this.animator.update(dt, {
        isMoving: false, isJumping: false, velocityY: 0,
        isAlive: false, wasHit: false, isOnGround: true, velocityMag: 0,
      });
      return;
    }

    // Cooldowns
    if (this.jumpCooldown > 0) {
      this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    }
    this.weaponSlots.updateCooldowns(dt);

    // Gravity
    if (!this.isOnGround) {
      this.velocity.y -= GRAVITY * dt;
    }

    // Integrate position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Ground collision
    if (this.position.y <= GROUND_Y) {
      this.position.y = GROUND_Y;
      this.velocity.y = 0;
      if (this.isJumping) {
        this.isJumping    = false;
        this.attackLanded = false;
      }
      this.isOnGround = true;
    }

    // World boundary clamp
    this.position.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, this.position.x));
    this.position.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, this.position.z));

    // Update facing angle from velocity
    const vx = this.velocity.x, vz = this.velocity.z;
    if (Math.abs(vx) > 0.5 || Math.abs(vz) > 0.5) {
      this.facingAngle = Math.atan2(vx, vz);
    }

    // Sync mesh position
    this.mesh.position.copy(this.position);
    this._updateMeshVisuals(dt);

    // Animation state
    const velocityMag = Math.sqrt(vx * vx + vz * vz);
    this.animator.update(dt, {
      isMoving:    velocityMag > 0.5,
      isJumping:   this.isJumping,
      velocityY:   this.velocity.y,
      isAlive:     true,
      wasHit,
      isOnGround:  this.isOnGround,
      velocityMag,
    });
  }

  _updateMeshVisuals(dt) {
    // Smooth facing direction toward movement
    const vx = this.velocity.x, vz = this.velocity.z;
    if (Math.abs(vx) > 0.5 || Math.abs(vz) > 0.5) {
      const target = Math.atan2(vx, vz);
      let diff = target - this.mesh.rotation.y;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mesh.rotation.y += diff * Math.min(1, 12 * dt);
    }

    // Spin during airtime for visual flair
    if (this.isJumping) {
      this.mesh.rotation.z += 4 * dt;
    } else {
      // Snap back upright (don't override death tilt)
      if (!this._dying && this.isAlive) {
        this.mesh.rotation.z *= 0.85;
        this.mesh.rotation.x *= 0.85;
      }
    }

    // Idle bob — gentle up/down
    this.mesh.position.y = this.position.y + Math.sin(Date.now() * 0.002) * 0.04;

    // Walk animation — arms pulse when moving
    if (this.armMeshes && (Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5)) {
      const t = Date.now() * 0.008;
      this.armMeshes.forEach((arm, i) => {
        arm.scale.set(1, 1, 1 + 0.12 * Math.sin(t + i * 1.26));
      });
    } else if (this.armMeshes) {
      // Gentle idle wiggle
      const t = Date.now() * 0.002;
      this.armMeshes.forEach((arm, i) => {
        arm.scale.set(1, 1, 1 + 0.05 * Math.sin(t + i * 1.26));
      });
    }

    // Jump animation — stretch body vertically while airborne
    if (this.bodyMesh) this.bodyMesh.scale.y = this.isJumping ? 0.6 : 0.38;

    // Hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      this.bodyMat.color.setHex(this.hitFlashTimer > 0 ? 0xffffff : this.color);
    }

    // Hit impulse — brief scale-up on damage
    if (this.hitImpulse > 0) {
      this.hitImpulse -= dt;
      const s = 1 + this.hitImpulse * 0.5;
      this.mesh.scale.set(s, s, s);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }

    // Rotate spike aura continuously if equipped
    if (this._currentWeaponModel) {
      this._currentWeaponModel.rotation.y += 2 * dt;
    }
    // Bob weapon mount
    if (this._weaponMount) {
      this._weaponMount.position.y = 0.1 + Math.sin(Date.now() * 0.003) * 0.04;
    }
  }
}
