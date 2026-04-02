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
import { ProjectileManager }  from './projectile.js';
import { PickupManager }      from './pickup.js';
import { ObstacleSystem }     from './obstacles.js';
import { LEVELS }             from './level.js';
import { TouchInput }         from './touch.js';

// Projectile configuration per weapon type
const PROJECTILE_CONFIG = {
  pistole: {
    speed:    18,
    lifetime: 2.5,
    radius:   0.15,
    color:    0xffee00,
  },
  miniKanone: {
    speed:    14,
    lifetime: 3.0,
    radius:   0.25,
    color:    0xff4400,
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
    this.ai       = null;
    this.lastTime = 0;

    this._selectedLevel = 0;

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
    this.player2 = new Character({
      name:     mode === GameMode.VS_AI ? 'KI-Gegner' : 'Spieler 2',
      color:    0xff5500,
      position: [...(levelDef.spawnPositions[1] || [8, 0, 0])],
    });
    this._equipDefault(this.player2);
    this.world.scene.add(this.player2.mesh);

    // AI wiring
    this.ai = mode === GameMode.VS_AI
      ? new AIController(this.player2, this.player1)
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
    char.weaponSlots.equip(0, this._cloneWeapon(WEAPONS.pistole));
    char.weaponSlots.equip(1, this._cloneWeapon(WEAPONS.saege));
    char.weaponSlots.equip(2, this._cloneWeapon(WEAPONS.pistole));
    char.weaponSlots.equip(3, this._cloneWeapon(WEAPONS.saege));
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
    this.ai = null;
    this.projectiles.clear();
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
   * Fire the character's active weapon.
   * Returns true if something was fired.
   */
  _fireActiveWeapon(character) {
    const weapon = character.weaponSlots.getActive();
    if (!weapon || !weapon.isReady) return false;

    if (weapon.type === 'projectile') {
      const projKey    = weapon.name.includes('Kanone') ? 'miniKanone' : 'pistole';
      const cfg        = PROJECTILE_CONFIG[projKey];
      const direction  = character.getForwardDirection();

      // Spawn slightly in front of character at chest height
      const spawnPos = character.position.clone()
        .add(direction.clone().multiplyScalar(0.8))
        .setY(0.5);

      this.projectiles.spawn({
        position:  spawnPos,
        direction,
        speed:     cfg.speed,
        damage:    weapon.damage,
        owner:     character,
        lifetime:  cfg.lifetime,
        radius:    cfg.radius,
        color:     cfg.color,
      });
      weapon.fire();
      return true;
    }

    if (weapon.type === 'melee') {
      const other = character === this.player1 ? this.player2 : this.player1;
      const hits  = this.combat.processMeleeAttack(character, [other]);
      if (hits.length > 0) {
        hits.forEach(h => this.hud.showHit(character.name, h.damage));
      }
      return true;
    }

    return false;
  }

  // ── Jump-hit handler ────────────────────────────────────────────────────────

  _handleJumpHit(hit) {
    // When a jump attack lands: defender drops all weapons as pickups
    const dropped = hit.target.weaponSlots.dropAll();
    if (dropped.length > 0) {
      this.pickups.spawnDropped(hit.target.position, dropped);
    }
  }

  // ── Pickup hint helper ──────────────────────────────────────────────────────

  _updatePickupHints() {
    const HINT_RANGE = 2.5;

    [this.player1, this.player2].forEach((char, i) => {
      if (!char || !char.isAlive) return;
      const nearest = this.pickups.getNearestPickup(char.position);
      if (nearest && nearest.dist <= HINT_RANGE) {
        this.hud.setPickupHint(i, nearest.pickup.weapon ? nearest.pickup.weapon.name : '');
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
      this.player1.jump();
    }
    if (this.input.wasAttackPressed(PLAYER1_KEYS) || this.touch.wasAttackPressed()) {
      this._fireActiveWeapon(this.player1);
    }
    if (this.input.wasSwitchPressed(PLAYER1_KEYS) || this.touch.wasSwitchPressed()) {
      this.player1.weaponSlots.nextSlot();
    }

    // Player 2 — only in local-versus mode
    if (this.state.mode === GameMode.LOCAL_VERSUS && this.player2 && this.player2.isAlive) {
      const m2 = this.input.getMovement(PLAYER2_KEYS);
      this.player2.move(
        (m2.right ? 1 : 0) - (m2.left ? 1 : 0),
        (m2.down  ? 1 : 0) - (m2.up   ? 1 : 0)
      );
      if (this.input.wasJustPressed(PLAYER2_KEYS.jump)) {
        this.player2.jump();
      }
      if (this.input.wasAttackPressed(PLAYER2_KEYS)) {
        this._fireActiveWeapon(this.player2);
      }
      if (this.input.wasSwitchPressed(PLAYER2_KEYS)) {
        this.player2.weaponSlots.nextSlot();
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
        this.combat.processMeleeAttack(this.player2, [this.player1])
          .forEach(h => this.hud.showHit(this.player2.name, h.damage));
      }
    }

    // Physics
    if (this.player1) this.player1.update(dt);
    if (this.player2) this.player2.update(dt);

    // Obstacle collision
    if (this.player1 && this.player1.isAlive) this.obstacles.checkCharacterCollision(this.player1);
    if (this.player2 && this.player2.isAlive) this.obstacles.checkCharacterCollision(this.player2);

    // Jump-attack combat
    const jumpHits = this.combat.processCombat(
      [this.player1, this.player2].filter(Boolean)
    );
    jumpHits.forEach(h => {
      this.hud.showHit(h.attacker.name, h.damage);
      this._handleJumpHit(h);
    });

    // Projectile combat
    const chars      = [this.player1, this.player2].filter(Boolean);
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
    collectionEvents.forEach(({ character, weapon }) => {
      const slot = character.weaponSlots.firstEmptySlot();
      if (slot !== -1) {
        character.weaponSlots.equip(slot, this._cloneWeapon(weapon));
      } else {
        // Replace active slot
        character.weaponSlots.equip(character.weaponSlots.activeIndex, this._cloneWeapon(weapon));
      }
      this.hud.showHit(character.name, 0); // use showHit for feedback — repurposed
      const el = document.getElementById('hit-flash');
      if (el) {
        el.textContent = `${character.name} sammelt: ${weapon.name}!`;
        el.classList.add('visible');
        clearTimeout(this._pickupMsgTimeout);
        this._pickupMsgTimeout = setTimeout(() => el.classList.remove('visible'), 1500);
      }
    });

    // Pickup hints in HUD
    this._updatePickupHints();

    // Win condition
    if (this.player1 && this.player2) {
      if (!this.player1.isAlive) {
        this._endGame(this.player2.name);
        return;
      } else if (!this.player2.isAlive) {
        this._endGame(this.player1.name);
        return;
      }
    }

    // Camera
    if (this.player1 && this.player2) {
      this.world.updateCamera(this.player1.position, this.player2.position, dt);
    }

    // HUD
    if (this.player1 && this.player2) {
      this.hud.update(this.player1, this.player2);
    }
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
