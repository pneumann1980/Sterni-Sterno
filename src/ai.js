/**
 * ai.js
 * AI controller: pursues target, uses weapons, picks up items.
 *
 * Rules — same as player, no cheating:
 *   • Same cooldown, same damage, same physics
 *   • Moves at 75 % of player speed
 *   • Slightly imprecise: checks jump decision every 0.5 s with a
 *     random chance to actually jump (prevents perfect robotic play)
 *   • Uses weapon system: fires active weapon, switches slots randomly
 *   • Goes for pickups if slots are empty and a pickup is nearby
 */

export class AIController {
  constructor(character, target) {
    this.character = character;
    this.target    = target;

    this.ATTACK_RANGE           = 2.2;   // horizontal distance to attempt jump
    this.FIRE_RANGE             = 12.0;  // max range to fire projectile weapons
    this.MELEE_RANGE            = 2.0;   // melee attack range
    this.SPEED_FACTOR           = 0.75;
    this.jumpDecisionTimer      = 0;
    this.JUMP_DECISION_INTERVAL = 0.5;
    this.JUMP_PROBABILITY       = 0.65;
    this.fireTimer              = 0;
    this.FIRE_INTERVAL          = 0.4;   // seconds between fire decisions
    this.switchTimer            = 0;
    this.SWITCH_INTERVAL        = 3.0;   // occasionally switch weapons
    this.strafeDir              = 1;
    this.strafeTimer            = 0;
    this.STRAFE_INTERVAL        = 1.5;

    // Output actions — read by main.js each frame
    this._wantsAttack = false;
    this._wantsMelee  = false;
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

    // ── Weapon slot switching ────────────────────────────────────────────────
    this.switchTimer -= dt;
    if (this.switchTimer <= 0) {
      this.switchTimer = this.SWITCH_INTERVAL + Math.random() * 2;
      if (Math.random() < 0.4) {
        ch.weaponSlots.nextSlot();
      }
    }

    // ── Pickup seeking ───────────────────────────────────────────────────────
    let goingForPickup = false;
    if (pickupManager) {
      const emptySlot = ch.weaponSlots.firstEmptySlot();
      if (emptySlot !== -1) {
        const nearest = pickupManager.getNearestPickup(ch.position);
        if (nearest && nearest.dist < dist * 0.7 && nearest.dist < 8) {
          // Move toward pickup instead of player
          const pdx = nearest.pickup.position.x - ch.position.x;
          const pdz = nearest.pickup.position.z - ch.position.z;
          const pdist = Math.sqrt(pdx * pdx + pdz * pdz);
          if (pdist > 0.3) {
            const speed = ch.moveSpeed * this.SPEED_FACTOR;
            ch.velocity.x = (pdx / pdist) * speed;
            ch.velocity.z = (pdz / pdist) * speed;
            goingForPickup = true;
          }
        }
      }
    }

    // ── Movement toward target ───────────────────────────────────────────────
    if (!goingForPickup) {
      const speed = ch.moveSpeed * this.SPEED_FACTOR;

      // Strafe sideways
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeTimer = this.STRAFE_INTERVAL + Math.random();
        this.strafeDir   = Math.random() < 0.5 ? 1 : -1;
      }

      if (dist > 0.3) {
        const nx = dx / dist;
        const nz = dz / dist;
        // Perpendicular strafe vector
        const sx = -nz * this.strafeDir * 0.3;
        const sz =  nx * this.strafeDir * 0.3;
        ch.velocity.x = (nx + sx) * speed;
        ch.velocity.z = (nz + sz) * speed;
      } else {
        ch.velocity.x = 0;
        ch.velocity.z = 0;
      }
    }

    // ── Jump decision ────────────────────────────────────────────────────────
    this.jumpDecisionTimer -= dt;
    if (this.jumpDecisionTimer <= 0) {
      this.jumpDecisionTimer = this.JUMP_DECISION_INTERVAL;
      if (
        dist <= this.ATTACK_RANGE &&
        ch.jumpCooldown <= 0 &&
        ch.isOnGround &&
        Math.random() < this.JUMP_PROBABILITY
      ) {
        ch.jump();
      }
    }

    // ── Ranged/melee weapon fire ─────────────────────────────────────────────
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.FIRE_INTERVAL + Math.random() * 0.3;

      const activeWeapon = ch.weaponSlots.getActive();
      if (activeWeapon && activeWeapon.isReady) {
        if (activeWeapon.type === 'projectile' && dist <= this.FIRE_RANGE) {
          if (Math.random() < 0.7) {
            this._wantsAttack = true;
          }
        } else if (activeWeapon.type === 'melee' && dist <= this.MELEE_RANGE) {
          if (Math.random() < 0.8) {
            this._wantsMelee = true;
          }
        }
      }
    }

    return {
      wantsAttack: this._wantsAttack,
      wantsMelee:  this._wantsMelee,
    };
  }
}
