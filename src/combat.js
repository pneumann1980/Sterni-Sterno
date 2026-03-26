/**
 * combat.js
 * Detects jump-attack hits and applies damage via the slot system.
 * Also handles projectile hit processing and melee attacks.
 *
 * Hit conditions for jump attacks (all must be true):
 *   1. Attacker is currently jumping
 *   2. Attacker has not yet landed an attack this jump
 *   3. Attacker is falling (velocity.y < 0)
 *   4. Horizontal distance < HIT_RADIUS
 *   5. Attacker is 0–MAX_HIT_HEIGHT units above the target
 */

const MELEE_RANGE    = 2.0;  // units
const MELEE_ARC      = Math.PI / 3; // ±60 degrees = 120 degree cone

export class CombatSystem {
  static HIT_RADIUS     = 2.0;  // XZ distance
  static MAX_HIT_HEIGHT = 3.5;  // attacker can be this far above target
  static MIN_HIT_HEIGHT = -0.4; // allow slight overlap

  /**
   * Checks one potential attacker → target pair for a jump attack.
   * Returns a hit descriptor or null.
   */
  checkHit(attacker, target) {
    if (!attacker.isJumping)      return null;
    if (attacker.attackLanded)    return null;
    if (attacker.velocity.y >= 0) return null;  // must be falling
    if (!target.isAlive)          return null;

    const dx = attacker.position.x - target.position.x;
    const dz = attacker.position.z - target.position.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const dy = attacker.position.y - target.position.y;

    if (
      horizontalDist < CombatSystem.HIT_RADIUS &&
      dy >= CombatSystem.MIN_HIT_HEIGHT &&
      dy <= CombatSystem.MAX_HIT_HEIGHT
    ) {
      attacker.attackLanded = true;
      const damage = attacker.weaponSlots.calculateTotalDamage();
      target.takeDamage(damage);

      return {
        attacker,
        target,
        damage,
        weapons: attacker.weaponSlots.slots.filter(Boolean),
      };
    }
    return null;
  }

  /**
   * Runs all pairwise checks across the character list.
   * Returns array of hit descriptors (may be empty).
   */
  processCombat(characters) {
    const hits = [];
    for (let i = 0; i < characters.length; i++) {
      for (let j = 0; j < characters.length; j++) {
        if (i === j) continue;
        if (!characters[i].isAlive || !characters[j].isAlive) continue;
        const hit = this.checkHit(characters[i], characters[j]);
        if (hit) hits.push(hit);
      }
    }
    return hits;
  }

  /**
   * Delegate projectile updating/hit detection to the ProjectileManager.
   * @param {ProjectileManager} projectileManager
   * @param {Character[]} characters
   * @param {object[]} obstacles - obstacle data array
   * @returns {Array<{projectile, target}>}
   */
  processProjectileHits(projectileManager, characters, obstacles) {
    return projectileManager.update(0, characters, obstacles);
    // Note: dt is passed separately via projectileManager.update in the main loop
    // This method is kept for API compatibility — main.js calls update directly
  }

  /**
   * Melee attack: hits targets within MELEE_RANGE in front arc of attacker.
   * @param {Character} attacker
   * @param {Character[]} targets
   * @returns {Array<{target, damage}>}
   */
  processMeleeAttack(attacker, targets) {
    const hits = [];
    const weapon = attacker.weaponSlots.getActive();
    if (!weapon || weapon.type !== 'melee' || !weapon.isReady) return hits;

    // Face direction of attacker
    const forwardX = Math.sin(attacker.facingAngle);
    const forwardZ = Math.cos(attacker.facingAngle);

    for (const target of targets) {
      if (!target || !target.isAlive) continue;
      if (target === attacker) continue;

      const dx = target.position.x - attacker.position.x;
      const dz = target.position.z - attacker.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > MELEE_RANGE) continue;

      // Check front arc
      if (dist > 0.001) {
        const toTargetX = dx / dist;
        const toTargetZ = dz / dist;
        const dot = toTargetX * forwardX + toTargetZ * forwardZ;
        if (dot < Math.cos(MELEE_ARC)) continue; // outside arc
      }

      weapon.fire();
      target.takeDamage(weapon.damage);
      hits.push({ target, damage: weapon.damage });
    }

    return hits;
  }
}
