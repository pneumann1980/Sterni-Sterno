/**
 * animation.js
 * Procedural animation system for Seestern Fighters characters.
 * CharacterAnimator operates on a character's mesh group using additive
 * transforms — no bones needed, just scale and rotation manipulations.
 */

export class CharacterAnimator {
  /**
   * @param {THREE.Group} characterMesh - the root mesh group
   * @param {THREE.Mesh} bodyMesh - the body sphere mesh
   * @param {THREE.Mesh[]} armMeshes - array of 5 arm meshes
   */
  constructor(characterMesh, bodyMesh, armMeshes) {
    this.mesh     = characterMesh;
    this.body     = bodyMesh;
    this.arms     = armMeshes; // array of 5

    // Animation time accumulator
    this._t = 0;

    // Hurt pulse state
    this._hurtTimer   = 0;
    this._hurtActive  = false;

    // Death tilt state
    this._deathTimer    = 0;
    this._deathDuration = 0.5;
    this._dying         = false;

    // Landing squash state
    this._landSquashTimer    = 0;
    this._landSquashDuration = 0.18;
    this._wasJumping         = false;

    // Launch squash state
    this._launchTimer    = 0;
    this._launchDuration = 0.12;
    this._wasOnGround    = true;

    // Cached original arm rotations (Y set at build time)
    this._armBaseRotY = armMeshes.map(a => a.rotation.y);
  }

  /**
   * @param {number} dt - delta time in seconds
   * @param {object} state - { isMoving, isJumping, velocityY, isAlive, wasHit, velocityMag }
   */
  update(dt, state) {
    this._t += dt;

    if (!state.isAlive) {
      this._animateDeath(dt);
      return;
    }

    // Reset body scale each frame then apply animations
    this._resetBodyScale();

    // Hurt pulse takes priority visually
    if (state.wasHit && !this._hurtActive) {
      this._hurtActive = true;
      this._hurtTimer  = 0.1;
    }
    if (this._hurtActive) {
      this._animateHurt(dt);
    }

    // Detect jump launch (ground → air)
    if (this._wasOnGround && state.isJumping && !state.isOnGround) {
      this._launchTimer = this._launchDuration;
    }
    // Detect landing (air → ground)
    if (this._wasJumping && !state.isJumping && state.isOnGround) {
      this._landSquashTimer = this._landSquashDuration;
    }
    this._wasJumping  = state.isJumping;
    this._wasOnGround = state.isOnGround !== undefined ? state.isOnGround : true;

    if (state.isJumping) {
      this._animateJump(dt, state.velocityY);
    } else {
      // Launch squash lingers briefly after jump starts
      if (this._launchTimer > 0) {
        this._launchTimer -= dt;
        const p = Math.max(0, this._launchTimer / this._launchDuration);
        this._applyBodyScale(1 + 0.3 * p, 1 - 0.3 * p); // squash XZ, stretch Y
      }

      // Landing squash
      if (this._landSquashTimer > 0) {
        this._landSquashTimer -= dt;
        const p = Math.max(0, this._landSquashTimer / this._landSquashDuration);
        this._applyBodyScale(1 + 0.3 * p, 1 - 0.3 * p); // wide and flat on land
      }

      if (state.isMoving) {
        this._animateWalk(dt, state.velocityMag || 1);
      } else {
        this._animateIdle(dt);
      }
    }
  }

  // ── Idle ────────────────────────────────────────────────────────────────────

  _animateIdle(dt) {
    // Gentle Y bob on the whole mesh
    if (this.mesh) {
      this.mesh.position.y = (this.mesh.position.y || 0);
      // Bob is applied as offset — main.js keeps logical position, mesh syncs each frame
      // We store a Y-offset in _idleBobOffset and apply it to the body scale slightly
    }
    const bob = Math.sin(this._t * Math.PI * 2 * 1.5) * 0.05;
    if (this.body) {
      this.body.position.y = bob;
    }

    // Very slight arm oscillation
    this.arms.forEach((arm, i) => {
      if (!arm) return;
      const phase = (i / 5) * Math.PI * 2;
      arm.rotation.x = Math.sin(this._t * 1.5 + phase) * 0.06;
    });
  }

  // ── Walk ─────────────────────────────────────────────────────────────────────

  _animateWalk(dt, velocityMag) {
    const speedScale = Math.min(velocityMag / 8, 1.5);
    const freq = 3.0 * speedScale;

    // Alternate arms up/down
    this.arms.forEach((arm, i) => {
      if (!arm) return;
      // Arms alternate: even indices swing one way, odd the other
      const phase = (i % 2 === 0 ? 0 : Math.PI);
      arm.rotation.x = Math.sin(this._t * freq * Math.PI * 2 + phase) * 0.35 * speedScale;
    });

    // Small bob on body
    if (this.body) {
      this.body.position.y = Math.abs(Math.sin(this._t * freq * Math.PI * 2)) * 0.04;
    }
  }

  // ── Jump ─────────────────────────────────────────────────────────────────────

  _animateJump(dt, velocityY) {
    // Squash on launch (velocityY high and positive), stretch at peak, squash on land
    if (velocityY > 4) {
      // Launching — squash: wider XZ, shorter Y
      const t = Math.min(1, velocityY / 13);
      this._applyBodyScale(1 + 0.3 * t, 1 - 0.3 * t);
    } else if (velocityY > -4) {
      // Near peak — stretch: taller Y, narrower XZ
      const t = 1 - Math.abs(velocityY) / 4;
      this._applyBodyScale(1 - 0.15 * t, 1 + 0.3 * t);
    } else {
      // Falling — slight squash in anticipation of landing
      const t = Math.min(1, Math.abs(velocityY) / 13);
      this._applyBodyScale(1 + 0.1 * t, 1 - 0.1 * t);
    }

    // Arms spread out during jump
    this.arms.forEach((arm, i) => {
      if (!arm) return;
      const phase = (i / 5) * Math.PI * 2;
      arm.rotation.x = Math.sin(phase) * 0.4;
    });
  }

  // ── Hurt ─────────────────────────────────────────────────────────────────────

  _animateHurt(dt) {
    this._hurtTimer -= dt;
    if (this._hurtTimer <= 0) {
      this._hurtActive = false;
      this._resetBodyScale();
      return;
    }
    // Scale pulse: 1.3x for duration then back
    this._applyBodyScale(1.3, 1.3);
  }

  // ── Death ────────────────────────────────────────────────────────────────────

  _animateDeath(dt) {
    if (!this._dying) {
      this._dying      = true;
      this._deathTimer = 0;
    }
    this._deathTimer += dt;
    const p = Math.min(1, this._deathTimer / this._deathDuration);
    // Tilt forward (rotation.z to PI/2)
    if (this.mesh) {
      this.mesh.rotation.z = p * (Math.PI / 2);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _resetBodyScale() {
    if (this.body) {
      this.body.scale.set(1, 1, 1);
    }
  }

  /** scaleXZ applied to X and Z, scaleY applied to Y */
  _applyBodyScale(scaleXZ, scaleY) {
    if (this.body) {
      this.body.scale.set(scaleXZ, scaleY, scaleXZ);
    }
  }
}
