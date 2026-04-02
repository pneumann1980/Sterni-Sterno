/**
 * ai.js
 * AI controller with a proper state machine.
 *
 * States: idle | chase | attack | evade | strafe
 *
 * Rules — same as player, no cheating:
 *   • Same cooldown, same damage, same physics
 *   • Moves at 72 % of player speed (SPEED_FACTOR)
 *   • Slightly imprecise: random chance on jump/fire decisions
 *   • Evades for a short period after taking damage
 */

export class AIController {
  constructor(character, target) {
    this.character = character;
    this.target    = target;
    this.state     = 'chase';
    this.stateTimer = 0;

    // Tuning
    this.SPEED_FACTOR    = 0.72;
    this.ATTACK_RANGE    = 2.4;
    this.FIRE_RANGE      = 10.0;
    this.EVADE_DURATION  = 1.2;  // seconds to evade after being hit
    this.strafeDir       = 1;
    this.strafeAngle     = 0;
    this.fireTimer       = 0;
    this.FIRE_INTERVAL   = 0.45;
    this.jumpTimer       = 0;
    this.JUMP_INTERVAL   = 0.5;
    this.JUMP_PROB       = 0.65;
    this._wantsAttack    = false;
    this._wantsMelee     = false;

    // Listen for damage to trigger evade state
    const origTakeDamage = character.takeDamage.bind(character);
    character.takeDamage = (amount) => {
      origTakeDamage(amount);
      if (Math.random() < 0.6) this._enterEvade();
    };
  }

  _enterEvade() {
    this.state      = 'evade';
    this.stateTimer = this.EVADE_DURATION;
    this.strafeDir  = Math.random() < 0.5 ? 1 : -1;
  }

  _transition(newState, duration = 0) {
    this.state      = newState;
    this.stateTimer = duration;
  }

  update(dt, pickupManager) {
    const ch = this.character;
    const tg = this.target;
    this._wantsAttack = false;
    this._wantsMelee  = false;

    if (!ch.isAlive || !tg.isAlive) return { wantsAttack: false, wantsMelee: false };

    const dx   = tg.position.x - ch.position.x;
    const dz   = tg.position.z - ch.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const speed = ch.moveSpeed * this.SPEED_FACTOR;

    this.stateTimer -= dt;

    // State transitions
    if (this.state !== 'evade') {
      if (dist < this.ATTACK_RANGE)      this._transition('attack');
      else if (dist < this.FIRE_RANGE)   this._transition('strafe');
      else                               this._transition('chase');
    } else if (this.stateTimer <= 0) {
      this._transition('chase');
    }

    // State behaviours
    switch (this.state) {
      case 'chase': {
        // Move directly toward target
        if (dist > 0.3) {
          ch.velocity.x = (dx / dist) * speed;
          ch.velocity.z = (dz / dist) * speed;
        }
        break;
      }
      case 'strafe': {
        // Orbit target at medium range + occasionally close in
        this.strafeAngle += dt * 1.2 * this.strafeDir;
        const orbitDist = 4.5;
        const targetX = tg.position.x + Math.cos(this.strafeAngle) * orbitDist;
        const targetZ = tg.position.z + Math.sin(this.strafeAngle) * orbitDist;
        const toX = targetX - ch.position.x;
        const toZ = targetZ - ch.position.z;
        const toDist = Math.sqrt(toX * toX + toZ * toZ);
        if (toDist > 0.3) {
          ch.velocity.x = (toX / toDist) * speed;
          ch.velocity.z = (toZ / toDist) * speed;
        }
        break;
      }
      case 'attack': {
        // Close in for jump or melee
        if (dist > 1.0) {
          ch.velocity.x = (dx / dist) * speed * 1.1;
          ch.velocity.z = (dz / dist) * speed * 1.1;
        } else {
          ch.velocity.x *= 0.8;
          ch.velocity.z *= 0.8;
        }
        break;
      }
      case 'evade': {
        // Move away from target + sideways
        const nx = dist > 0 ? dx / dist : 0;
        const nz = dist > 0 ? dz / dist : 0;
        const px = -nz * this.strafeDir;
        const pz =  nx * this.strafeDir;
        ch.velocity.x = (-nx * 0.6 + px * 0.8) * speed * 1.2;
        ch.velocity.z = (-nz * 0.6 + pz * 0.8) * speed * 1.2;
        break;
      }
    }

    // Jump decision (only in attack state)
    this.jumpTimer -= dt;
    if (this.jumpTimer <= 0) {
      this.jumpTimer = this.JUMP_INTERVAL;
      if (this.state === 'attack' && dist <= this.ATTACK_RANGE
          && ch.jumpCooldown <= 0 && ch.isOnGround
          && Math.random() < this.JUMP_PROB) {
        ch.jump();
      }
    }

    // Weapon fire (strafe and chase states)
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.FIRE_INTERVAL + Math.random() * 0.3;
      const w = ch.weaponSlots.getActive();
      if (w && w.isReady) {
        if (w.type === 'projectile' && dist <= this.FIRE_RANGE && Math.random() < 0.7) {
          this._wantsAttack = true;
        } else if (w.type === 'melee' && dist <= 2.2 && Math.random() < 0.8) {
          this._wantsMelee = true;
        }
      }
    }

    // Pickup seeking
    if (pickupManager) {
      const emptySlot = ch.weaponSlots.firstEmptySlot();
      if (emptySlot !== -1) {
        const nearest = pickupManager.getNearestPickup(ch.position);
        if (nearest && nearest.dist < 6 && nearest.dist < dist * 0.6) {
          const pdx = nearest.pickup.position.x - ch.position.x;
          const pdz = nearest.pickup.position.z - ch.position.z;
          const pd  = Math.sqrt(pdx * pdx + pdz * pdz);
          if (pd > 0.3) {
            ch.velocity.x = (pdx / pd) * speed;
            ch.velocity.z = (pdz / pd) * speed;
          }
        }
      }
    }

    return { wantsAttack: this._wantsAttack, wantsMelee: this._wantsMelee };
  }
}
