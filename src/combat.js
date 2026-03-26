/**
 * combat.js
 * Detects jump-attack hits and applies damage via the slot system.
 *
 * Hit conditions (all must be true):
 *   1. Attacker is currently jumping
 *   2. Attacker has not yet landed an attack this jump
 *   3. Attacker is falling (velocity.y < 0)
 *   4. Horizontal distance < HIT_RADIUS
 *   5. Attacker is 0–MAX_HIT_HEIGHT units above the target
 */
export class CombatSystem {
  static HIT_RADIUS      = 2.0;  // XZ distance
  static MAX_HIT_HEIGHT  = 3.5;  // attacker can be this far above target
  static MIN_HIT_HEIGHT  = -0.4; // allow slight overlap

  /**
   * Checks one potential attacker → target pair.
   * Returns a hit descriptor or null.
   */
  checkHit(attacker, target) {
    if (!attacker.isJumping)    return null;
    if (attacker.attackLanded)  return null;
    if (attacker.velocity.y >= 0) return null;  // must be falling
    if (!target.isAlive)        return null;

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
}
