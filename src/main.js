/**
 * main.js
 * Entry point — creates and wires all subsystems, runs the game loop.
 *
 * Subsystem responsibilities:
 *   World            — Three.js scene, renderer, camera, environment
 *   Character        — physics, health, mesh, animator
 *   InputManager     — keyboard state
 *   AIController     — enemy behaviour (returns action flags)
 *   CombatSystem     — jump-attack hit detection & damage
 *   ProjectileManager— projectile lifecycle and hit detection
 *   PickupManager    — weapon pickup lifecycle
 *   ObstacleSystem   — collision geometry from level
 *   HUD              — DOM overlay
 *   GameState        — mode / status / level tracking
 *   LEVELS           — level definitions
 */

import * as THREE from 'three';
import { World }              from './world.js';
import { Character }          from './character.js';
import { InputManager, PLAYER1_KEYS, PLAYER2_KEYS } from './input.js';
import { AIController }       from './ai.js';
import { CombatSystem }       from './combat.js';
import { HUD }                from './hud.js';
import { GameState, GameMode, GameStatus } from './gamestate.js';
import { WEAPONS }            from './weapons.js';
import { ABILITY_DEFS }       from './abilities.js';
import { ProjectileManager }  from './projectile.js';
import { PickupManager }      from './pickup.js';
import { ObstacleSystem }     from './obstacles.js';
import { LEVELS }             from './level.js';
import { TouchInput }         from './touch.js';

// Projectile configuration keyed by weapon.key
const PROJECTILE_CONFIG = {
  muschelShooter: {
    speed:    20,
    lifetime: 2.2,
    radius:   0.18,
    color:    0xffee88,
    style:    'shell',   // used by projectile mesh builder
  },
  blasenkanone: {
    speed:    8,
    lifetime: 3.5,
    radius:   0.42,      // big hitbox
    color:    0x44ccff,
    style:    'bubble',
  },
};

// ── Main Game class ───────────────────────────────────────────────────────────
class Game {
  constructor() {
    this.world      = new World();
    this.input      = new InputManager();
    this.touch      = new TouchInput();
    this.combat     = new CombatSystem();
    this.state      = new GameState();
    this.hud        = new HUD(document.getElementById('hud'));
    this.obstacles  = new ObstacleSystem();
    this.pickups    = new PickupManager(this.world.scene);
    this.projectiles = new ProjectileManager(this.world.scene);

    this.player1  = null;
    this.player2  = null;
    this.player3  = null;
    this.ai       = null;
    this.ai2      = null;
    this.lastTime = 0;

    this._selectedLevel = 0;
    this._novaEffects   = [];  // active nova explosion VFX

    this._bindMenuButtons();
    this._bindGameButtons();
    this._bindGlobalKeys();
    this._buildLevelSelector();
  }

  // ── Button wiring ───────────────────────────────────────────────────────────

  _buildLevelSelector() {
    const hint = document.querySelector('.controls-hint');
    if (!hint) return;

    // Insert level selector before controls hint
    const levelRow = document.createElement('div');
    levelRow.className = 'btn-row level-selector';
    levelRow.style.marginTop = '16px';
    levelRow.style.marginBottom = '4px';

    LEVELS.forEach((level, i) => {
      const btn = document.createElement('button');
      btn.className = `btn level-btn${i === 0 ? ' level-btn-active' : ' secondary'}`;
      btn.textContent = `${i + 1}: ${level.name}`;
      btn.dataset.levelIndex = i;
      btn.onclick = () => {
        this._selectedLevel = i;
        document.querySelectorAll('.level-btn').forEach((b, bi) => {
          b.className = `btn level-btn${bi === i ? ' level-btn-active' : ' secondary'}`;
        });
      };
      levelRow.appendChild(btn);
    });

    hint.parentNode.insertBefore(levelRow, hint);
  }

  _bindMenuButtons() {
    document.getElementById('btn-vs-ai').onclick = () =>
      this._startGame(GameMode.VS_AI, this._selectedLevel);
    document.getElementById('btn-vs-player').onclick = () =>
      this._startGame(GameMode.LOCAL_VERSUS, this._selectedLevel);
    document.getElementById('btn-vs-two-ai').onclick = () =>
      this._startGame(GameMode.VS_TWO_AI, this._selectedLevel);

    // Difficulty selector
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('diff-active'));
        btn.classList.add('diff-active');
        this.state.setDifficulty(btn.dataset.diff);
      });
    });
  }

  _bindGameButtons() {
    document.getElementById('btn-restart').onclick  = () => this._restartGame();
    document.getElementById('btn-menu').onclick     = () => this._goToMenu();
    document.getElementById('btn-resume').onclick   = () => this._resume();
    document.getElementById('btn-pause-menu').onclick = () => this._goToMenu();

    // "Next Level" button — injected dynamically
    const nextBtn = document.getElementById('btn-next-level');
    if (nextBtn) {
      nextBtn.onclick = () => {
        const nextIdx = this.state.nextLevel();
        this._startGame(this.state.mode, nextIdx);
      };
    }
  }

  _bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.state.isPlaying) this._pause();
        else if (this.state.isPaused) this._resume();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const dbg = document.getElementById('debug');
        dbg.style.display = dbg.style.display === 'block' ? 'none' : 'block';
      }
    });
  }

  // ── Game flow ───────────────────────────────────────────────────────────────

  _startGame(mode, levelIndex = 0) {
    this._cleanupCharacters();
    this.state.start(mode, levelIndex);

    const levelDef = LEVELS[levelIndex] || LEVELS[0];

    // Player 1 — blue starfish
    this.player1 = new Character({
      name:     'Spieler 1',
      color:    0x2255ff,
      position: [...(levelDef.spawnPositions[0] || [-8, 0, 0])],
    });
    this._equipDefault(this.player1);
    this.world.scene.add(this.player1.mesh);

    // Player 2 / Enemy — orange starfish
    const p2Name = mode === GameMode.VS_TWO_AI ? 'KI-Gegner 1'
                 : mode === GameMode.VS_AI      ? 'KI-Gegner'
                 : 'Spieler 2';
    this.player2 = new Character({
      name:     p2Name,
      color:    0xff5500,
      position: [...(levelDef.spawnPositions[1] || [8, 0, 0])],
    });
    this._equipDefault(this.player2);
    this.world.scene.add(this.player2.mesh);

    // Player 3 / second enemy — green starfish (VS_TWO_AI only)
    if (mode === GameMode.VS_TWO_AI) {
      this.player3 = new Character({
        name:     'KI-Gegner 2',
        color:    0x22cc44,
        position: [...(levelDef.spawnPositions[2] || [0, 0, -8])],
      });
      this._equipDefault(this.player3);
      this.world.scene.add(this.player3.mesh);
    }

    // AI wiring — pass selected difficulty
    const diff = this.state.difficulty;
    this.ai = (mode === GameMode.VS_AI || mode === GameMode.VS_TWO_AI)
      ? new AIController(this.player2, this.player1, diff)
      : null;
    this.ai2 = mode === GameMode.VS_TWO_AI && this.player3
      ? new AIController(this.player3, this.player1, diff)
      : null;

    // Load level (builds obstacles, decorations, pickups)
    this.projectiles.clear();
    this.world.loadLevel(levelDef, this.obstacles, this.pickups, WEAPONS);

    this.hud.init(this.player1, this.player2, mode, levelDef.name);

    this._showScreen('none');
    document.getElementById('hud').style.display = 'flex';
    this.touch.show();
  }

  _equipDefault(char) {
    // Muschel-Shooter in slot 0 (active), Blasenkanone in slot 1
    // Slots 2-3 stay empty (available for dropped weapon pickups)
    char.weaponSlots.equip(0, this._cloneWeapon(WEAPONS.muschelShooter));
    char.weaponSlots.equip(1, this._cloneWeapon(WEAPONS.blasenkanone));
    char.weaponSlots.equip(2, null);
    char.weaponSlots.equip(3, null);
  }

  /** Clone a weapon so each character has independent cooldown state. */
  _cloneWeapon(w) {
    // Shallow clone preserving prototype (for isReady getter etc.)
    const clone = Object.create(Object.getPrototypeOf(w));
    Object.assign(clone, w);
    clone.activeCooldown = 0;
    return clone;
  }

  _cleanupCharacters() {
    if (this.player1) { this.world.scene.remove(this.player1.mesh); this.player1 = null; }
    if (this.player2) { this.world.scene.remove(this.player2.mesh); this.player2 = null; }
    if (this.player3) { this.world.scene.remove(this.player3.mesh); this.player3 = null; }
    this.ai  = null;
    this.ai2 = null;
    this.projectiles.clear();
    // Clean up any live nova VFX
    for (const eff of this._novaEffects) this.world.scene.remove(eff.mesh);
    this._novaEffects = [];
  }

  _restartGame() {
    this._startGame(this.state.mode, this.state.currentLevelIndex);
  }

  _goToMenu() {
    this._cleanupCharacters();
    this.world.unloadLevel(this.obstacles, this.pickups);
    this.state.toMenu();
    document.getElementById('hud').style.display = 'none';
    this.touch.hide();
    this._showScreen('menu');
  }

  _pause() {
    this.state.pause();
    this.touch.hide();
    this._showScreen('pause');
  }

  _resume() {
    this.state.resume();
    this.touch.show();
    this._showScreen('none');
  }

  _endGame(winnerName) {
    this.state.endGame(winnerName);
    document.getElementById('hud').style.display = 'none';
    this.touch.hide();

    const isWin = winnerName === this.player1.name;
    if (isWin) this.state.addWin(); else this.state.addLoss();
    document.getElementById('winner-text').textContent = isWin ? 'VICTORY! 🏆' : 'DEFEAT 💀';
    document.getElementById('winner-text').style.color = isWin ? '#ffdd00' : '#ff4444';
    const deltaEl = document.getElementById('score-delta');
    if (deltaEl) {
      deltaEl.textContent = isWin ? '+10 Punkte' : '-5 Punkte';
      deltaEl.style.color = isWin ? '#88ff88' : '#ff6666';
    }
    this.hud.updateScore(this.state.score);

    // Show / update next-level button
    let nextBtn = document.getElementById('btn-next-level');
    if (!nextBtn) {
      nextBtn = document.createElement('button');
      nextBtn.id        = 'btn-next-level';
      nextBtn.className = 'btn';
      nextBtn.textContent = '➡ Nächste Arena';
      nextBtn.onclick = () => {
        const nextIdx = this.state.nextLevel();
        this._startGame(this.state.mode, nextIdx);
      };
      const btnRow = document.querySelector('#game-over .btn-row');
      if (btnRow) btnRow.appendChild(nextBtn);
    }

    this._showScreen('game-over');
  }

  /** Show one overlay; pass 'none' to hide all. */
  _showScreen(id) {
    ['menu', 'game-over', 'pause'].forEach(s => {
      document.getElementById(s).style.display = s === id ? 'flex' : 'none';
    });
  }

  // ── Weapon firing ───────────────────────────────────────────────────────────

  /**
   * Fire the character's active weapon with auto-aim assist.
   * Returns true if something was fired.
   */
  _fireActiveWeapon(character) {
    const weapon = character.weaponSlots.getActive();
    if (!weapon || !weapon.isReady) return false;

    if (weapon.type === 'projectile') {
      const cfg = PROJECTILE_CONFIG[weapon.key];
      if (!cfg) return false;

      // ── Auto-aim: blend toward nearest visible enemy within 12 units ──────
      const allPlayers = [this.player1, this.player2, this.player3];
      const enemies = allPlayers.filter(c => c && c.isAlive && c !== character && !c.isBuried);
      let aimDir = character.getForwardDirection();
      let nearest = null, nearestDist = 12;
      enemies.forEach(t => {
        const d = character.position.distanceTo(t.position);
        if (d < nearestDist) { nearestDist = d; nearest = t; }
      });
      if (nearest) {
        const toTarget = nearest.position.clone()
          .sub(character.position).setY(0).normalize();
        aimDir = aimDir.clone().lerp(toTarget, 0.75).normalize();
      }

      const spawnPos = character.position.clone()
        .add(aimDir.clone().multiplyScalar(0.8))
        .setY(0.5);

      this.projectiles.spawn({
        position:  spawnPos,
        direction: aimDir,
        speed:     cfg.speed,
        damage:    weapon.damage,
        owner:     character,
        lifetime:  cfg.lifetime,
        radius:    cfg.radius,
        color:     cfg.color,
        style:     cfg.style,
      });
      weapon.fire();
      return true;
    }

    if (weapon.type === 'melee') {
      const others = [this.player1, this.player2, this.player3]
        .filter(c => c && c !== character);
      const hits = this.combat.processMeleeAttack(character, others);
      if (hits.length > 0) {
        hits.forEach(h => this.hud.showHit(character.name, h.damage));
      }
      return true;
    }

    return false;
  }

  // ── Ability activation ───────────────────────────────────────────────────────

  /**
   * Try to use the character's active ability.
   * Falls back to cycling the weapon slot if no ability is available.
   */
  _useAbility(character) {
    const ab = character.abilities;
    if (ab.hasNovaBlast) {
      ab.startNovaCharge();
      return;
    }
    if (ab.hasEinbuddeln) {
      const buried = ab.toggleBury();
      // Sync immediately
      character.isBuried = character.abilities.isBuried;
      return;
    }
    // No ability — fall back to weapon switch
    character.weaponSlots.nextSlot();
  }

  // ── Nova-Blast detonation ────────────────────────────────────────────────────

  _triggerNovaBlast(character) {
    const pos         = character.position.clone();
    const def         = ABILITY_DEFS.novaBlast;
    const allChars    = [this.player1, this.player2, this.player3].filter(Boolean);

    allChars.forEach(target => {
      if (target === character || !target.isAlive) return;
      const dx   = target.position.x - pos.x;
      const dz   = target.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= def.blastRadius) return;

      // Never kills — leaves target at minimum 1 HP
      const actualDmg = Math.max(0, target.health - 1);
      if (actualDmg > 0) target.takeDamage(actualDmg);

      // Eject buried targets
      if (target.abilities.isBuried) {
        target.abilities.ejectFromGround();
        target.isBuried = false;
      }

      // Knockback impulse
      const nx = dist > 0.1 ? dx / dist : (Math.random() - 0.5);
      const nz = dist > 0.1 ? dz / dist : (Math.random() - 0.5);
      target.velocity.x += nx * def.knockback;
      target.velocity.z += nz * def.knockback;
      target.velocity.y  = Math.max(target.velocity.y, 8);
      target.isOnGround  = false;

      this.hud.showHit(character.name, actualDmg);
    });

    this._spawnNovaVFX(pos, def.blastRadius);
  }

  _spawnNovaVFX(pos, maxRadius) {
    const mat = new THREE.MeshBasicMaterial({
      color:       0xff8800,
      transparent: true,
      opacity:     0.60,
      side:        THREE.BackSide,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat);
    sphere.position.copy(pos);
    sphere.position.y = Math.max(0.5, pos.y + 0.5);
    this.world.scene.add(sphere);
    this._novaEffects.push({ mesh: sphere, mat, timer: 0, duration: 0.55, maxRadius });

    // Also spawn a bright inner flash (smaller, faster)
    const flashMat = new THREE.MeshBasicMaterial({
      color:       0xffffaa,
      transparent: true,
      opacity:     0.80,
      side:        THREE.BackSide,
    });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), flashMat);
    flash.position.copy(sphere.position);
    this.world.scene.add(flash);
    this._novaEffects.push({ mesh: flash, mat: flashMat, timer: 0, duration: 0.22, maxRadius: maxRadius * 0.45 });
  }

  // ── Jump-hit handler ────────────────────────────────────────────────────────

  _handleJumpHit(hit) {
    // When a jump attack lands: defender drops all weapons as pickups
    const dropped = hit.target.weaponSlots.dropAll();
    if (dropped.length > 0) {
      this.pickups.spawnDropped(hit.target.position, dropped);
    }
  }

  // ── Pickup message helper ────────────────────────────────────────────────────

  _showPickupMsg(charName, itemName) {
    const el = document.getElementById('hit-flash');
    if (el) {
      el.textContent = `${charName} sammelt: ${itemName}!`;
      el.classList.add('visible');
      clearTimeout(this._pickupMsgTimeout);
      this._pickupMsgTimeout = setTimeout(() => el.classList.remove('visible'), 1800);
    }
  }

  // ── Pickup hint helper ──────────────────────────────────────────────────────

  _updatePickupHints() {
    const HINT_RANGE = 2.5;

    [this.player1, this.player2, this.player3].forEach((char, i) => {
      if (!char || !char.isAlive) return;
      const nearest = this.pickups.getNearestPickup(char.position);
      if (nearest && nearest.dist <= HINT_RANGE) {
        const pickup = nearest.pickup;
        const name = pickup.weapon
          ? pickup.weapon.name
          : (pickup.abilityKey && ABILITY_DEFS[pickup.abilityKey]
              ? ABILITY_DEFS[pickup.abilityKey].name
              : '');
        this.hud.setPickupHint(i, name);
      }
    });
  }

  // ── Per-frame ───────────────────────────────────────────────────────────────

  _processInput() {
    if (!this.player1 || !this.player1.isAlive) return;

    // ── Player 1: keyboard + touch merged ───────────────────────────────────
    const m1  = this.input.getMovement(PLAYER1_KEYS);
    const tdx = this.touch.getMoveX();
    const tdz = this.touch.getMoveZ();

    this.player1.move(
      (m1.right ? 1 : 0) - (m1.left ? 1 : 0) + tdx,
      (m1.down  ? 1 : 0) - (m1.up   ? 1 : 0) + tdz
    );
    if (this.input.wasJustPressed(PLAYER1_KEYS.jump) || this.touch.wasJumpPressed()) {
      if (this.player1.isBuried) {
        // Jump exits buried state
        this.player1.abilities.ejectFromGround();
        this.player1.isBuried = false;
      } else {
        this.player1.jump();
      }
    }
    if (this.input.wasAttackPressed(PLAYER1_KEYS) || this.touch.wasAttackPressed()) {
      this._fireActiveWeapon(this.player1);
    }
    // Ability button (x / touch switch): try active ability, fall back to weapon cycle
    if (this.input.wasSwitchPressed(PLAYER1_KEYS) || this.touch.wasSwitchPressed()) {
      this._useAbility(this.player1);
    }

    // Player 2 — only in local-versus mode
    if (this.state.mode === GameMode.LOCAL_VERSUS && this.player2 && this.player2.isAlive) {
      const m2 = this.input.getMovement(PLAYER2_KEYS);
      this.player2.move(
        (m2.right ? 1 : 0) - (m2.left ? 1 : 0),
        (m2.down  ? 1 : 0) - (m2.up   ? 1 : 0)
      );
      if (this.input.wasJustPressed(PLAYER2_KEYS.jump)) {
        if (this.player2.isBuried) {
          this.player2.abilities.ejectFromGround();
          this.player2.isBuried = false;
        } else {
          this.player2.jump();
        }
      }
      if (this.input.wasAttackPressed(PLAYER2_KEYS)) {
        this._fireActiveWeapon(this.player2);
      }
      if (this.input.wasSwitchPressed(PLAYER2_KEYS)) {
        this._useAbility(this.player2);
      }
    }
  }

  _updateDebug() {
    const dbg = document.getElementById('debug');
    if (dbg.style.display !== 'block') return;
    const p1 = this.player1, p2 = this.player2;
    if (!p1 || !p2) return;
    const w1 = p1.weaponSlots.getActive();
    const w2 = p2.weaponSlots.getActive();
    dbg.innerHTML = [
      `P1  hp:${Math.ceil(p1.health)}  cd:${p1.jumpCooldown.toFixed(2)}  ` +
        `y:${p1.position.y.toFixed(2)}  vy:${p1.velocity.y.toFixed(2)}  ` +
        `weapon:${w1 ? w1.name : '—'}  proj:${this.projectiles.projectiles.length}`,
      `P2  hp:${Math.ceil(p2.health)}  cd:${p2.jumpCooldown.toFixed(2)}  ` +
        `y:${p2.position.y.toFixed(2)}  vy:${p2.velocity.y.toFixed(2)}  ` +
        `weapon:${w2 ? w2.name : '—'}  pickups:${this.pickups.pickups.length}`,
      `mode:${this.state.mode}  level:${this.state.currentLevelIndex}  tab=debug`,
    ].join('<br>');
  }

  update(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // cap at 50 ms
    this.lastTime = timestamp;

    if (!this.state.isPlaying) {
      this.world.render();
      return;
    }

    // Input
    this._processInput();

    // AI
    if (this.ai && this.player2 && this.player2.isAlive) {
      const aiActions = this.ai.update(dt, this.pickups);
      if (aiActions.wantsAttack) {
        this._fireActiveWeapon(this.player2);
      }
      if (aiActions.wantsMelee) {
        const meleeTargets = [this.player1, this.player3].filter(Boolean);
        this.combat.processMeleeAttack(this.player2, meleeTargets)
          .forEach(h => this.hud.showHit(this.player2.name, h.damage));
      }
    }
    if (this.ai2 && this.player3 && this.player3.isAlive) {
      const ai2Actions = this.ai2.update(dt, this.pickups);
      if (ai2Actions.wantsAttack) {
        this._fireActiveWeapon(this.player3);
      }
      if (ai2Actions.wantsMelee) {
        const meleeTargets = [this.player1, this.player2].filter(Boolean);
        this.combat.processMeleeAttack(this.player3, meleeTargets)
          .forEach(h => this.hud.showHit(this.player3.name, h.damage));
      }
    }

    // Physics
    if (this.player1) this.player1.update(dt);
    if (this.player2) this.player2.update(dt);
    if (this.player3) this.player3.update(dt);

    // Obstacle collision
    if (this.player1 && this.player1.isAlive) this.obstacles.checkCharacterCollision(this.player1);
    if (this.player2 && this.player2.isAlive) this.obstacles.checkCharacterCollision(this.player2);
    if (this.player3 && this.player3.isAlive) this.obstacles.checkCharacterCollision(this.player3);

    // ── Ability updates ──────────────────────────────────────────────────────
    const allChars = [this.player1, this.player2, this.player3].filter(Boolean);
    allChars.forEach(attacker => {
      if (!attacker.isAlive) return;
      const abilityEvent = attacker.abilities.update(dt);

      if (abilityEvent === 'aura_tick') {
        // Stachel-Aura contact damage
        const auraRadius = ABILITY_DEFS.stachelAura.auraRadius;
        const damage     = ABILITY_DEFS.stachelAura.damage;
        allChars.forEach(target => {
          if (target === attacker || !target.isAlive) return;
          const dx = target.position.x - attacker.position.x;
          const dz = target.position.z - attacker.position.z;
          if (Math.sqrt(dx * dx + dz * dz) < auraRadius) {
            target.takeDamage(damage);
            this.hud.showHit(attacker.name, damage);
          }
        });
      }

      if (abilityEvent === 'nova_fire') {
        this._triggerNovaBlast(attacker);
      }

      // Sync buried state (ability manager is source of truth)
      attacker.isBuried = attacker.abilities.isBuried;
    });

    // ── Nova VFX update ─────────────────────────────────────────────────────
    if (this._novaEffects.length > 0) {
      const alive = [];
      for (const eff of this._novaEffects) {
        eff.timer += dt;
        const p = Math.min(1, eff.timer / eff.duration);
        eff.mesh.scale.setScalar(p * eff.maxRadius);
        eff.mat.opacity = 0.60 * (1 - p);
        if (p < 1) alive.push(eff);
        else       this.world.scene.remove(eff.mesh);
      }
      this._novaEffects = alive;
    }

    // Jump-attack combat
    const jumpHits = this.combat.processCombat(
      [this.player1, this.player2, this.player3].filter(Boolean)
    );
    jumpHits.forEach(h => {
      this.hud.showHit(h.attacker.name, h.damage);
      this._handleJumpHit(h);
    });

    // Projectile combat
    const chars      = [this.player1, this.player2, this.player3].filter(Boolean);
    const obsData    = this.obstacles.getObstacleData();
    const projHits   = this.projectiles.update(dt, chars, obsData);
    projHits.forEach(h => {
      h.target.takeDamage(h.projectile.damage);
      this.hud.showHit(
        h.projectile.owner ? h.projectile.owner.name : 'Projektil',
        h.projectile.damage
      );
    });

    // Pickup collection
    const collectionEvents = this.pickups.update(dt, chars);
    collectionEvents.forEach(({ character, weapon, abilityKey }) => {
      if (weapon) {
        const slot = character.weaponSlots.firstEmptySlot();
        if (slot !== -1) {
          character.weaponSlots.equip(slot, this._cloneWeapon(weapon));
        } else {
          character.weaponSlots.equip(character.weaponSlots.activeIndex, this._cloneWeapon(weapon));
        }
        this._showPickupMsg(character.name, weapon.name);
      } else if (abilityKey) {
        const def = ABILITY_DEFS[abilityKey];
        if (abilityKey === 'stachelAura')  character.abilities.grantStachelAura();
        else if (abilityKey === 'novaBlast')   character.abilities.grantNovaBlast();
        else if (abilityKey === 'einbuddeln')  character.abilities.grantEinbuddeln();
        this._showPickupMsg(character.name, def ? def.name : abilityKey);
      }
    });

    // Pickup hints in HUD
    this._updatePickupHints();

    // Win condition
    if (this.player1 && this.player2) {
      if (!this.player1.isAlive) {
        // Player 1 is down — enemies win
        this._endGame(this.player2.isAlive ? this.player2.name : (this.player3 ? this.player3.name : this.player2.name));
        return;
      }
      if (this.state.mode === GameMode.VS_TWO_AI) {
        // Player 1 wins only when both enemies are defeated
        const p2Dead = !this.player2.isAlive;
        const p3Dead = !this.player3 || !this.player3.isAlive;
        if (p2Dead && p3Dead) {
          this._endGame(this.player1.name);
          return;
        }
      } else {
        if (!this.player2.isAlive) {
          this._endGame(this.player1.name);
          return;
        }
      }
    }

    // Sync weapon display on characters
    const syncWeapon = (char) => {
      if (!char || !char.isAlive) return;
      const active = char.weaponSlots.getActive();
      if (char._lastSyncedWeapon !== active) {
        char.showWeaponModel(active);
        char._lastSyncedWeapon = active;
      }
    };
    syncWeapon(this.player1);
    syncWeapon(this.player2);
    syncWeapon(this.player3);

    // Camera
    if (this.player1 && this.player2) {
      this.world.updateCamera(this.player1.position, this.player2.position, dt);
    }

    // HUD
    if (this.player1 && this.player2) {
      this.hud.update(this.player1, this.player2);
    }
    // Ability status bars in HUD
    if (this.player1) this.hud.updateAbilities('p1', this.player1.abilities);
    if (this.player2) this.hud.updateAbilities('p2', this.player2.abilities);
    this.hud.updateScore(this.state.score);

    // Debug
    this._updateDebug();

    // Clear per-frame input state
    this.input.clearFrameState();

    // Render
    this.world.render();
  }

  run() {
    const loop = (ts) => {
      this.update(ts);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
const game = new Game();
game.run();
