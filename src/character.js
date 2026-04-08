/**
 * character.js
 * Character class: physics, movement, jump mechanics, health, animation, mesh.
 * Both players and AI enemies use this class — no cheating, same rules.
 */

import * as THREE from 'three';
import { WeaponSlots } from './weapons.js';
import { AbilityManager } from './abilities.js';
import { CharacterAnimator } from './animation.js';
import {
  buildShellGunMesh,
  buildBubbleCannonMesh,
  buildSpikeOrbitMesh,
} from './weaponModels.js';

export const WORLD_HALF = 27;   // half of play-area size (WORLD_SIZE 55 / 2)
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
    this.attackLanded  = false;
    this.hitFlashTimer = 0;
    this._wasHit       = false;
    this.hitImpulse    = 0;

    // Death animation state
    this._dying      = false;
    this._deathTimer = 0;

    // Jump timing — 5-second cooldown, same for everyone
    this.jumpCooldown       = 0;
    this.JUMP_COOLDOWN_TIME = 5;
    this.JUMP_FORCE         = 13;
    this.moveSpeed          = 8;

    // Weapon slots — max 1 at a time
    this.weaponSlots = new WeaponSlots(1);

    // Ability system
    this.abilities = new AbilityManager();
    this.isBuried  = false;  // mirrored from abilities.isBuried

    // Internal visual state
    this._buriedOpacitySet = false;
    this._spikeOrbit       = null;
    this._rainbowActive    = false;
    this._rainbowHue       = 0;
    this._wrackMeshes      = null;
    this._unicornMeshes    = null;

    // Three.js mesh
    this._buildMesh();
    this.mesh.position.copy(this.position);

    // Animator (created after mesh so arm/body refs are available)
    this.animator = new CharacterAnimator(this.mesh, this.bodyMesh, this.armMeshes);
  }

  // ── Mesh construction ──────────────────────────────────────────────────────

  _buildMesh() {
    this.mesh = new THREE.Group();

    this.bodyMat = new THREE.MeshLambertMaterial({
      color:             this.color,
      emissive:          this.color,
      emissiveIntensity: 0.18,
    });
    const tipColor = new THREE.Color(this.color).multiplyScalar(0.65);
    this.tipMat = new THREE.MeshLambertMaterial({
      color:             tipColor,
      emissive:          tipColor,
      emissiveIntensity: 0.12,
    });

    // Central body — bigger, flatter pancake shape
    const bodyGeo  = new THREE.SphereGeometry(0.60, 12, 8);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    bodyMesh.scale.y = 0.36;
    bodyMesh.castShadow = true;
    this.mesh.add(bodyMesh);
    this.bodyMesh = bodyMesh;

    // 5 arms — 3 sphere segments tapering; slightly irregular lengths
    this.armMeshes = [];
    const ARM_LENGTHS = [1.0, 1.08, 0.96, 1.04, 0.98];
    for (let i = 0; i < 5; i++) {
      const angle    = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const armGroup = new THREE.Group();
      armGroup.rotation.y = angle;
      const L = ARM_LENGTHS[i];

      const sizes   = [0.27, 0.19, 0.11];
      const offsets = [0.60 * L, 1.05 * L, 1.42 * L];
      const mats    = [this.bodyMat, this.bodyMat, this.tipMat];

      sizes.forEach((r, j) => {
        const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mats[j]);
        seg.scale.y = 0.42;
        seg.position.set(offsets[j], -j * 0.04, 0);
        seg.castShadow = true;
        armGroup.add(seg);
      });

      this.mesh.add(armGroup);
      this.armMeshes.push(armGroup);
    }

    // Eyes
    const eyeMat   = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a22 });
    for (const xOff of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), eyeMat);
      eye.position.set(xOff, 0.15, 0.52);
      this.mesh.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 4), pupilMat);
      pupil.position.set(xOff + 0.02, 0.15, 0.58);
      this.mesh.add(pupil);
    }

    // Weapon mount
    this._weaponMount = new THREE.Group();
    this._weaponMount.position.set(1.1, 0.4, 0);
    this.mesh.add(this._weaponMount);
    this._currentWeaponModel = null;

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

  // ── Skin / visual customisation ────────────────────────────────────────────

  /**
   * Apply a skin to this character.
   * @param {number|null} color    — hex color, or null to keep the original
   * @param {boolean}     glitter
   * @param {boolean}     rainbow  — animated rainbow cycling
   * @param {boolean}     wrackDeco — wreck decorations (algae, barnacles)
   */
  applySkinColor(color, glitter, rainbow = false, wrackDeco = false, unicornHorn = false) {
    this._rainbowActive = rainbow;
    if (!rainbow) {
      const c = color !== null ? color : this.color;
      this.bodyMat.color.setHex(c);
      this.bodyMat.emissive.setHex(c);
      const tipColor = new THREE.Color(c).multiplyScalar(0.65);
      this.tipMat.color.copy(tipColor);
      this.tipMat.emissive.copy(tipColor);
    }
    // Don't overwrite this.color — it still drives hit-flash reset target

    if (glitter) this._addGlitter();
    else         this._removeGlitter();

    if (wrackDeco) this._addWrackDeco();
    else           this._removeWrackDeco();

    if (unicornHorn) this._addUnicornDeco();
    else             this._removeUnicornDeco();
  }

  _addGlitter() {
    if (this._glitterMeshes) return;
    this._glitterMeshes = [];
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color:       i % 2 === 0 ? 0xffffff : 0xaaddff,
        transparent: true,
        opacity:     0.9,
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 4, 4), mat);
      sphere._gAngle  = (i / 10) * Math.PI * 2;
      sphere._gRadius = 0.75 + Math.random() * 0.55;
      sphere._gHeight = (Math.random() - 0.5) * 0.9;
      sphere._gSpeed  = 1.2 + Math.random() * 1.8;
      this.mesh.add(sphere);
      this._glitterMeshes.push(sphere);
    }
  }

  _removeGlitter() {
    if (!this._glitterMeshes) return;
    this._glitterMeshes.forEach(s => this.mesh.remove(s));
    this._glitterMeshes = null;
  }

  _updateGlitter(dt) {
    if (!this._glitterMeshes) return;
    const t = Date.now() * 0.001;
    this._glitterMeshes.forEach((s, i) => {
      s._gAngle += s._gSpeed * dt;
      s.position.x = Math.cos(s._gAngle) * s._gRadius;
      s.position.z = Math.sin(s._gAngle) * s._gRadius;
      s.position.y = s._gHeight + Math.sin(t * 3 + i * 0.9) * 0.12;
      s.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(t * 4 + i * 1.1));
    });
  }

  // ── Rainbow skin ───────────────────────────────────────────────────────────

  _updateRainbow(dt) {
    if (!this._rainbowActive) return;
    this._rainbowHue = (this._rainbowHue + dt * 0.5) % 1.0; // full cycle every 2 s
    const c = new THREE.Color().setHSL(this._rainbowHue, 1.0, 0.55);
    this.bodyMat.color.copy(c);
    this.bodyMat.emissive.copy(c);
    this.bodyMat.emissiveIntensity = 0.4;
    const tip = c.clone().multiplyScalar(0.65);
    this.tipMat.color.copy(tip);
    this.tipMat.emissive.copy(tip);
  }

  // ── Wrack-Skin decorations ─────────────────────────────────────────────────

  _addWrackDeco() {
    if (this._wrackMeshes) return;
    this._wrackMeshes = [];

    // Algae strands: 6 thin elongated cylinders hanging from arms
    const algaeMat = new THREE.MeshLambertMaterial({ color: 0x2d7a2d, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const r     = 0.5 + Math.random() * 0.5;
      const geo   = new THREE.CylinderGeometry(0.03, 0.01, 0.4 + Math.random() * 0.4, 4);
      const strand = new THREE.Mesh(geo, algaeMat.clone());
      strand.position.set(Math.cos(angle) * r, -0.25 - Math.random() * 0.2, Math.sin(angle) * r);
      strand.rotation.z = (Math.random() - 0.5) * 0.6;
      strand._waveOffset = Math.random() * Math.PI * 2;
      this.mesh.add(strand);
      this._wrackMeshes.push(strand);
    }

    // Barnacles: 4 small flat disc shapes on the body
    const barnacleMat = new THREE.MeshLambertMaterial({ color: 0x9e8060 });
    for (let i = 0; i < 4; i++) {
      const angle  = (i / 4) * Math.PI * 2;
      const barnacle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.12, 0.08, 6),
        barnacleMat
      );
      barnacle.position.set(Math.cos(angle) * 0.45, 0.08, Math.sin(angle) * 0.45);
      barnacle.rotation.x = (Math.random() - 0.5) * 0.4;
      this.mesh.add(barnacle);
      this._wrackMeshes.push(barnacle);
    }

    // Rising bubbles: 5 transparent spheres orbiting slowly upward
    for (let i = 0; i < 5; i++) {
      const bubbleMat = new THREE.MeshBasicMaterial({
        color: 0x88ddff, transparent: true, opacity: 0.45,
      });
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 5, 4), bubbleMat);
      bubble._bubbleAngle = (i / 5) * Math.PI * 2;
      bubble._bubbleR     = 0.6 + Math.random() * 0.4;
      bubble._bubbleSpeed = 0.4 + Math.random() * 0.6;
      bubble._bubbleY     = Math.random();  // 0..1 normalized phase
      this.mesh.add(bubble);
      this._wrackMeshes.push(bubble);
    }
  }

  _removeWrackDeco() {
    if (!this._wrackMeshes) return;
    this._wrackMeshes.forEach(m => this.mesh.remove(m));
    this._wrackMeshes = null;
  }

  _updateWrackDeco(dt) {
    if (!this._wrackMeshes) return;
    const t = Date.now() * 0.001;

    for (const m of this._wrackMeshes) {
      if (m._waveOffset !== undefined) {
        // Algae sway
        m.rotation.z = Math.sin(t * 1.8 + m._waveOffset) * 0.3;
      } else if (m._bubbleAngle !== undefined) {
        // Rising bubbles
        m._bubbleY = (m._bubbleY + dt * m._bubbleSpeed * 0.3) % 1.0;
        m._bubbleAngle += dt * 0.4;
        m.position.set(
          Math.cos(m._bubbleAngle) * m._bubbleR,
          -0.4 + m._bubbleY * 1.2,
          Math.sin(m._bubbleAngle) * m._bubbleR
        );
        m.material.opacity = 0.2 + 0.3 * Math.sin(t * 2 + m._bubbleAngle);
      }
    }
  }

  // ── Unicorn-Skin decorations ──────────────────────────────────────────────

  _addUnicornDeco() {
    if (this._unicornMeshes) return;
    this._unicornMeshes = [];

    // Unicorn horn: pink tapered cone sticking upward
    const hornMat = new THREE.MeshLambertMaterial({
      color:             0xff88cc,
      emissive:          0xff44aa,
      emissiveIntensity: 0.5,
    });
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.10, 0.7, 8),
      hornMat
    );
    horn.position.set(0, 0.65, 0.25);  // slightly forward-top of body
    horn.rotation.x = -0.25;           // tilt forward a touch
    this.mesh.add(horn);
    this._unicornMeshes.push(horn);
    this._hornMesh = horn;

    // Spiral stripe on horn (small offset cylinder)
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffd4f0 });
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 5, 12), stripeMat);
    stripe.position.copy(horn.position);
    stripe.position.y += 0.15;
    stripe.rotation.copy(horn.rotation);
    this.mesh.add(stripe);
    this._unicornMeshes.push(stripe);

    // Magic sparkle particles: 8 small colorful spheres
    const sparkleColors = [0xff88cc, 0xcc88ff, 0xffffaa, 0x88ffcc, 0xffaaee];
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color:       sparkleColors[i % sparkleColors.length],
        transparent: true,
        opacity:     0.9,
      });
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 5, 4), mat);
      s._uAngle  = (i / 8) * Math.PI * 2;
      s._uRadius = 0.9 + Math.random() * 0.5;
      s._uHeight = (Math.random() - 0.3);
      s._uSpeed  = 1.0 + Math.random() * 1.5;
      s._uPhase  = Math.random() * Math.PI * 2;
      this.mesh.add(s);
      this._unicornMeshes.push(s);
    }
  }

  _removeUnicornDeco() {
    if (!this._unicornMeshes) return;
    this._unicornMeshes.forEach(m => this.mesh.remove(m));
    this._unicornMeshes = null;
    this._hornMesh = null;
  }

  _updateUnicornDeco(dt) {
    if (!this._unicornMeshes) return;
    const t = Date.now() * 0.001;

    // Horn shimmer
    if (this._hornMesh) {
      this._hornMesh.material.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 3.5);
    }

    // Sparkle particle orbits
    for (const m of this._unicornMeshes) {
      if (m._uAngle === undefined) continue;
      m._uAngle += dt * m._uSpeed;
      m.position.set(
        Math.cos(m._uAngle) * m._uRadius,
        m._uHeight + Math.sin(t * 2.5 + m._uPhase) * 0.22,
        Math.sin(m._uAngle) * m._uRadius,
      );
      m.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * 4 + m._uPhase));
      // Cycle sparkle hue gently
      const hue = ((t * 0.12 + m._uPhase * 0.1) % 1);
      m.material.color.setHSL(hue, 0.9, 0.75);
    }
  }

  showWeaponModel(weapon) {
    // Clear weapon mount
    while (this._weaponMount.children.length > 0) {
      this._weaponMount.remove(this._weaponMount.children[0]);
    }
    // NOTE: _spikeOrbit is now managed by ability system in _updateMeshVisuals
    this._currentWeaponModel = null;

    if (!weapon) return;

    const key = weapon.key || '';
    let model;
    if (key === 'muschelShooter') {
      model = buildShellGunMesh();
    } else if (key === 'blasenkanone') {
      model = buildBubbleCannonMesh();
    } else {
      return; // unknown key — no mount model
    }

    model.scale.setScalar(1.8);
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
    const wasHit = this._wasHit;
    this._wasHit = false;

    if (!this.isAlive) {
      if (this._dying) {
        this._deathTimer += dt;
        const p = Math.min(1, this._deathTimer / 0.5);
        this.mesh.rotation.z = p * (Math.PI / 2);
        if (p >= 1) this._dying = false;
      }
      this.animator.update(dt, {
        isMoving: false, isJumping: false, velocityY: 0,
        isAlive: false, wasHit: false, isOnGround: true, velocityMag: 0,
      });
      return;
    }

    // Cooldowns
    if (this.jumpCooldown > 0) this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    this.weaponSlots.updateCooldowns(dt);

    // Gravity
    if (!this.isOnGround) this.velocity.y -= GRAVITY * dt;

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

    // Sync buried state from ability manager
    this.isBuried = this.abilities.isBuried;

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

    // Spin during airtime
    if (this.isJumping) {
      this.mesh.rotation.z += 4 * dt;
    } else {
      if (!this._dying && this.isAlive) {
        this.mesh.rotation.z *= 0.85;
        this.mesh.rotation.x *= 0.85;
      }
    }

    // ── Buried state ──────────────────────────────────────────────────────────
    if (this.isBuried) {
      // Half-submerged look
      this.mesh.position.y = this.position.y - 0.55;
      if (!this._buriedOpacitySet) {
        this._setMeshOpacity(0.18);
        this._buriedOpacitySet = true;
      }
    } else {
      if (this._buriedOpacitySet) {
        this._setMeshOpacity(1.0);
        this._buriedOpacitySet = false;
      }
      // Normal idle bob
      this.mesh.position.y = this.position.y + Math.sin(Date.now() * 0.002) * 0.04;
    }

    // ── Nova charge glow ───────────────────────────────────────────────────────
    if (this.abilities.isNovaCharging) {
      const p     = this.abilities.novaChargeProgress;
      const pulse = Math.sin(Date.now() * 0.015) * 0.5 + 0.5;
      this.bodyMat.emissive.setHex(0xff6600);
      this.bodyMat.emissiveIntensity = 0.3 + p * 0.8 + pulse * 0.35;
    } else if (this.hitFlashTimer <= 0) {
      this.bodyMat.emissive.setHex(this.color);
      this.bodyMat.emissiveIntensity = 0.18;
    }

    // ── Stachel-Aura: auto-show / hide spike orbit ─────────────────────────────
    const hasAura = this.abilities.hasStachelAura;
    if (hasAura && !this._spikeOrbit) {
      this._spikeOrbit = buildSpikeOrbitMesh();
      this.mesh.add(this._spikeOrbit);
    } else if (!hasAura && this._spikeOrbit) {
      this.mesh.remove(this._spikeOrbit);
      this._spikeOrbit = null;
    }

    // Walk animation — arms pulse when moving
    if (this.armMeshes && (Math.abs(vx) > 0.5 || Math.abs(vz) > 0.5)) {
      const t = Date.now() * 0.009;
      this.armMeshes.forEach((arm, i) => {
        const wave = Math.sin(t + i * 1.26);
        arm.scale.set(1, 1, 1 + 0.22 * wave);
        arm.rotation.z = 0.10 * Math.sin(t + i * 1.26 + 0.5);
      });
    } else if (this.armMeshes) {
      const t = Date.now() * 0.0025;
      this.armMeshes.forEach((arm, i) => {
        arm.scale.set(1, 1, 1 + 0.07 * Math.sin(t + i * 1.26));
        arm.rotation.z = 0.04 * Math.sin(t + i * 1.26);
      });
    }

    // Jump stretch
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

    // Glitter particles (Prestige skin)
    this._updateGlitter(dt);

    // Rainbow color cycling
    this._updateRainbow(dt);

    // Wrack-Skin animated decorations
    this._updateWrackDeco(dt);

    // Unicorn-Skin horn + sparkles
    this._updateUnicornDeco(dt);

    // Rotate spike orbit
    if (this._spikeOrbit) {
      this._spikeOrbit.rotation.y += 2.8 * dt;
    } else if (this._currentWeaponModel) {
      this._currentWeaponModel.rotation.y += 1.2 * dt;
    }

    // Bob the weapon mount
    if (this._weaponMount) {
      this._weaponMount.position.y = 0.4 + Math.sin(Date.now() * 0.003) * 0.06;
    }
  }

  /**
   * Set the opacity of all mesh materials.
   * @param {number} opacity 0..1
   */
  _setMeshOpacity(opacity) {
    const transparent = opacity < 1;
    this.mesh.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => {
        m.transparent = transparent;
        m.opacity     = opacity;
      });
    });
  }
}
