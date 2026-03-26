/**
 * input.js
 * Manages keyboard state for up to 2 local players.
 * wasJustPressed() fires once per physical key press (useful for jump).
 * isDown() reflects held-down state (useful for movement).
 */

export const PLAYER1_KEYS = {
  up:          'ArrowUp',
  down:        'ArrowDown',
  left:        'ArrowLeft',
  right:       'ArrowRight',
  jump:        ' ',       // Space
  attack:      'Enter',  // Active weapon attack
  switchWeapon:'x',      // Switch active slot
  interact:    'e',
  emote:       'q',
};

export const PLAYER2_KEYS = {
  up:          'w',
  down:        's',
  left:        'a',
  right:       'd',
  jump:        'f',
  attack:      'g',
  switchWeapon:'h',
  interact:    'r',
  emote:       't',
};

const PREVENT_DEFAULT_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter']);

export class InputManager {
  constructor() {
    this._held        = new Set();
    this._justPressed = new Set();

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup',   (e) => this._onKeyUp(e));
  }

  _normalize(key) {
    // Keep multi-char keys (ArrowUp, Escape, Enter, …) as-is; lowercase single chars
    return key.length === 1 ? key.toLowerCase() : key;
  }

  _onKeyDown(e) {
    const key = this._normalize(e.key);
    if (PREVENT_DEFAULT_KEYS.has(e.key)) e.preventDefault();
    if (!this._held.has(key)) this._justPressed.add(key);
    this._held.add(key);
  }

  _onKeyUp(e) {
    this._held.delete(this._normalize(e.key));
  }

  isDown(key) {
    return this._held.has(this._normalize(key));
  }

  wasJustPressed(key) {
    return this._justPressed.has(this._normalize(key));
  }

  /** Call once per frame after processing all input */
  clearFrameState() {
    this._justPressed.clear();
  }

  /** Returns { up, down, left, right } booleans for a key-map */
  getMovement(keyMap) {
    return {
      up:    this.isDown(keyMap.up),
      down:  this.isDown(keyMap.down),
      left:  this.isDown(keyMap.left),
      right: this.isDown(keyMap.right),
    };
  }

  /** Returns true if the attack key was just pressed for the given keyMap */
  wasAttackPressed(keyMap) {
    return this.wasJustPressed(keyMap.attack);
  }

  /** Returns true if the weapon-switch key was just pressed for the given keyMap */
  wasSwitchPressed(keyMap) {
    return this.wasJustPressed(keyMap.switchWeapon);
  }
}
