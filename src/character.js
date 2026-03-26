/**
 * character.js
 * Character class: physics, movement, jump mechanics, health, animation, mesh.
 * Both players and AI enemies use this class — no cheating, same rules.
 */

import * as THREE from 'three';
import { WeaponSlots } from './weapons.js';
import { CharacterAnimator } from './animation.js';

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
    this.mesh    = new THREE.Group();
    this.bodyMat = new THREE.MeshLambertMaterial({ color: this.color });

    // Flat body (squashed sphere)
    this.bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 8),
      this.bodyMat
    );
    this.bodyMesh.scale.y = 0.42;
    this.bodyMesh.castShadow = true;
    this.mesh.add(this.bodyMesh);

    // 5 arms arranged radially — store references for animator
    this.armMeshes = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.18, 0.22),
        this.bodyMat
      );
      arm.position.set(Math.cos(angle) * 0.56, 0, Math.sin(angle) * 0.56);
      arm.rotation.y = angle;
      arm.castShadow = true;
      this.mesh.add(arm);
      this.armMeshes.push(arm);
    }

    // Eyes (decorative — own materials, not affected by hit-flash)
    const eyeMat   = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    for (const xOff of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat);
      eye.position.set(xOff, 0.11, 0.43);
      this.mesh.add(eye);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), pupilMat);
      pupil.position.set(xOff, 0.11, 0.49);
      this.mesh.add(pupil);
    }

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

    // Hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      this.bodyMat.color.setHex(this.hitFlashTimer > 0 ? 0xffffff : this.color);
    }
  }
}
