/**
 * main.js
 * Entry point — creates and wires all subsystems, runs the game loop.
 *
 * Subsystem responsibilities:
 *   World      — Three.js scene, renderer, camera, environment
 *   Character  — physics, health, mesh
 *   InputManager — keyboard state
 *   AIController — enemy behaviour
 *   CombatSystem — hit detection & damage
 *   HUD          — DOM overlay
 *   GameState    — mode / status tracking
 */

import * as THREE from 'three';
import { World }         from './world.js';
import { Character }     from './character.js';
import { InputManager, PLAYER1_KEYS, PLAYER2_KEYS } from './input.js';
import { AIController }  from './ai.js';
import { CombatSystem }  from './combat.js';
import { HUD }           from './hud.js';
import { GameState, GameMode, GameStatus } from './gamestate.js';
import { WEAPONS }       from './weapons.js';

// ── Starting positions ────────────────────────────────────────────────────────
const START_POS = {
  p1: [-6, 0, 0],
  p2: [ 6, 0, 0],
};

// ── Default loadout ───────────────────────────────────────────────────────────
function equipDefault(char) {
  char.weaponSlots.equip(0, WEAPONS.pistole);
  char.weaponSlots.equip(1, WEAPONS.saege);
  char.weaponSlots.equip(2, WEAPONS.pistole);
  char.weaponSlots.equip(3, WEAPONS.saege);
  // Slot 3 could be null (empty) — total damage: 15+5+15+5 = 40
  // Swap the last line to: char.weaponSlots.equip(3, null) for 35 dmg
}

// ── Main Game class ───────────────────────────────────────────────────────────
class Game {
  constructor() {
    this.world  = new World();
    this.input  = new InputManager();
    this.combat = new CombatSystem();
    this.state  = new GameState();
    this.hud    = new HUD(document.getElementById('hud'));

    this.player1  = null;
    this.player2  = null;
    this.ai       = null;
    this.lastTime = 0;

    this._bindMenuButtons();
    this._bindGameButtons();
    this._bindGlobalKeys();
  }

  // ── Button wiring ───────────────────────────────────────────────────────────

  _bindMenuButtons() {
    document.getElementById('btn-vs-ai').onclick = () =>
      this._startGame(GameMode.VS_AI);
    document.getElementById('btn-vs-player').onclick = () =>
      this._startGame(GameMode.LOCAL_VERSUS);
  }

  _bindGameButtons() {
    document.getElementById('btn-restart').onclick  = () => this._restartGame();
    document.getElementById('btn-menu').onclick     = () => this._goToMenu();
    document.getElementById('btn-resume').onclick   = () => this._resume();
    document.getElementById('btn-pause-menu').onclick = () => this._goToMenu();
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

  _startGame(mode) {
    this._cleanupCharacters();
    this.state.start(mode);

    // Player 1 — blue starfish
    this.player1 = new Character({
      name:     'Spieler 1',
      color:    0x2255ff,
      position: [...START_POS.p1],
    });
    equipDefault(this.player1);
    this.world.scene.add(this.player1.mesh);

    // Player 2 / Enemy — orange starfish
    this.player2 = new Character({
      name:     mode === GameMode.VS_AI ? 'KI-Gegner' : 'Spieler 2',
      color:    0xff5500,
      position: [...START_POS.p2],
    });
    equipDefault(this.player2);
    this.world.scene.add(this.player2.mesh);

    // AI wiring
    this.ai = mode === GameMode.VS_AI
      ? new AIController(this.player2, this.player1)
      : null;

    this.hud.init(this.player1, this.player2, mode);

    this._showScreen('none');
    document.getElementById('hud').style.display = 'flex';
  }

  _cleanupCharacters() {
    if (this.player1) { this.world.scene.remove(this.player1.mesh); this.player1 = null; }
    if (this.player2) { this.world.scene.remove(this.player2.mesh); this.player2 = null; }
    this.ai = null;
  }

  _restartGame() {
    this._startGame(this.state.mode);
  }

  _goToMenu() {
    this._cleanupCharacters();
    this.state.toMenu();
    document.getElementById('hud').style.display = 'none';
    this._showScreen('menu');
  }

  _pause() {
    this.state.pause();
    this._showScreen('pause');
  }

  _resume() {
    this.state.resume();
    this._showScreen('none');
  }

  _endGame(winnerName) {
    this.state.endGame(winnerName);
    document.getElementById('winner-text').textContent = `${winnerName} gewinnt! 🌟`;
    document.getElementById('hud').style.display = 'none';
    this._showScreen('game-over');
  }

  /** Show one overlay; pass 'none' to hide all. */
  _showScreen(id) {
    ['menu', 'game-over', 'pause'].forEach(s => {
      document.getElementById(s).style.display = s === id ? 'flex' : 'none';
    });
  }

  // ── Per-frame ───────────────────────────────────────────────────────────────

  _processInput() {
    // Player 1
    const m1 = this.input.getMovement(PLAYER1_KEYS);
    this.player1.move(
      (m1.right ? 1 : 0) - (m1.left ? 1 : 0),
      (m1.down  ? 1 : 0) - (m1.up   ? 1 : 0)
    );
    if (this.input.wasJustPressed(PLAYER1_KEYS.jump)) {
      this.player1.jump();
    }

    // Player 2 — only in local-versus mode
    if (this.state.mode === GameMode.LOCAL_VERSUS) {
      const m2 = this.input.getMovement(PLAYER2_KEYS);
      this.player2.move(
        (m2.right ? 1 : 0) - (m2.left ? 1 : 0),
        (m2.down  ? 1 : 0) - (m2.up   ? 1 : 0)
      );
      if (this.input.wasJustPressed(PLAYER2_KEYS.jump)) {
        this.player2.jump();
      }
    }
  }

  _updateDebug() {
    const dbg = document.getElementById('debug');
    if (dbg.style.display !== 'block') return;
    const p1 = this.player1, p2 = this.player2;
    dbg.innerHTML = [
      `P1  hp:${Math.ceil(p1.health)}  cd:${p1.jumpCooldown.toFixed(2)}  ` +
        `y:${p1.position.y.toFixed(2)}  vy:${p1.velocity.y.toFixed(2)}  jumping:${p1.isJumping}`,
      `P2  hp:${Math.ceil(p2.health)}  cd:${p2.jumpCooldown.toFixed(2)}  ` +
        `y:${p2.position.y.toFixed(2)}  vy:${p2.velocity.y.toFixed(2)}  jumping:${p2.isJumping}`,
      `mode: ${this.state.mode}  |  tab=toggle debug`,
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
    if (this.ai) this.ai.update(dt);

    // Physics
    this.player1.update(dt);
    this.player2.update(dt);

    // Combat
    const hits = this.combat.processCombat([this.player1, this.player2]);
    hits.forEach(h => this.hud.showHit(h.attacker.name, h.damage));

    // Win condition
    if (!this.player1.isAlive) {
      this._endGame(this.player2.name);
    } else if (!this.player2.isAlive) {
      this._endGame(this.player1.name);
    }

    // Camera
    if (this.player1 && this.player2) {
      this.world.updateCamera(this.player1.position, this.player2.position, dt);
    }

    // HUD
    if (this.player1 && this.player2) {
      this.hud.update(this.player1, this.player2);
    }

    // Debug overlay
    if (this.player1 && this.player2) {
      this._updateDebug();
    }

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
