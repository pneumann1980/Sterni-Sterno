/**
 * ai.js
 * Simple AI controller: pursues target, jumps when in range.
 *
 * Rules — same as player, no cheating:
 *   • Same cooldown, same damage, same physics
 *   • Moves at 75 % of player speed
 *   • Slightly imprecise: checks jump decision every 0.5 s with a
 *     random chance to actually jump (prevents perfect robotic play)
 */
export class AIController {
  constructor(character, target) {
    this.character = character;
    this.target    = target;

    this.ATTACK_RANGE           = 2.2;  // horizontal distance to attempt jump
    this.SPEED_FACTOR           = 0.75;
    this.jumpDecisionTimer      = 0;
    this.JUMP_DECISION_INTERVAL = 0.5;  // seconds between jump decisions
    this.JUMP_PROBABILITY       = 0.65; // chance to jump when all conditions met
  }

  update(dt) {
    const ch = this.character;
    const tg = this.target;

    if (!ch.isAlive || !tg.isAlive) return;

    const dx   = tg.position.x - ch.position.x;
    const dz   = tg.position.z - ch.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // ── Movement ────────────────────────────────────────────────────────────
    // Always steer toward target (reduced speed)
    const speed = ch.moveSpeed * this.SPEED_FACTOR;
    if (dist > 0.3) {
      ch.velocity.x = (dx / dist) * speed;
      ch.velocity.z = (dz / dist) * speed;
    } else {
      ch.velocity.x = 0;
      ch.velocity.z = 0;
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
  }
}
