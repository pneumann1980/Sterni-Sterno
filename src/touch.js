/**
 * touch.js
 * Virtual dual-joystick touch input for Seestern Fighters.
 *
 * Layout:
 *   Left half  → dynamic movement joystick (appears at touch-start position)
 *   Right zone → attack + switch buttons (small, top), large JUMP zone below
 *
 * Output interface (mirrors InputManager where possible):
 *   getMoveX() / getMoveZ()  — analog -1..1
 *   wasJumpPressed()         — once per press
 *   wasAttackPressed()       — once per press
 *   wasSwitchPressed()       — once per press
 *   show() / hide()          — visibility lifecycle
 *   clearFrameState()        — call once per frame after reading
 */

const JOY_RADIUS    = 52;   // px — max knob travel from center
const JOY_DEAD_ZONE = 0.12; // normalised dead zone

export class TouchInput {
  constructor() {
    this._moveX = 0;
    this._moveZ = 0;

    this._jumpPressed   = false;
    this._attackPressed = false;
    this._switchPressed = false;

    this._leftTouchId  = null;
    this._leftBaseX    = 0;
    this._leftBaseY    = 0;

    this._container = null;
    this._joyBase   = null;
    this._joyKnob   = null;

    this._buildDOM();
    this._bindEvents();

    // Always start hidden — show() is called by main.js when game starts
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getMoveX() { return this._moveX; }
  getMoveZ() { return this._moveZ; }

  wasJumpPressed()   { const v = this._jumpPressed;   this._jumpPressed   = false; return v; }
  wasAttackPressed() { const v = this._attackPressed; this._attackPressed = false; return v; }
  wasSwitchPressed() { const v = this._switchPressed; this._switchPressed = false; return v; }

  clearFrameState() { /* consumed on read — no-op needed for API compatibility */ }

  show() { this._container.style.display = 'block'; }
  hide() { this._container.style.display = 'none'; }
  get active() { return this._container.style.display !== 'none'; }

  // ── DOM construction ───────────────────────────────────────────────────────

  _buildDOM() {
    this._container = document.createElement('div');
    this._container.id = 'touch-controls';
    this._container.style.display = 'none';
    this._container.innerHTML = `
      <!-- Left half: touch zone (joystick appears dynamically) -->
      <div id="tc-left-zone"></div>

      <!-- Joystick (repositioned on touchstart) -->
      <div id="tc-joy-base">
        <div id="tc-joy-knob"></div>
      </div>

      <!-- Right action zone -->
      <div id="tc-right-zone">
        <div id="tc-btn-row-top">
          <button id="tc-btn-switch" class="tc-btn tc-btn-sm">↕<span>Waffe</span></button>
          <button id="tc-btn-attack" class="tc-btn tc-btn-md">⚔<span>Angriff</span></button>
        </div>
        <div id="tc-jump-zone">
          <div id="tc-jump-base">
            <div id="tc-jump-label">SPRUNG</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this._container);

    this._joyBase = document.getElementById('tc-joy-base');
    this._joyKnob = document.getElementById('tc-joy-knob');

    // Hide joystick until touch
    this._joyBase.style.opacity = '0';
  }

  // ── Touch / pointer event binding ─────────────────────────────────────────

  _bindEvents() {
    const leftZone = document.getElementById('tc-left-zone');

    // ── Left zone: joystick ──────────────────────────────────────────────────
    leftZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (this._leftTouchId !== null) return; // already tracking one finger
      this._leftTouchId = t.identifier;
      this._leftBaseX   = t.clientX;
      this._leftBaseY   = t.clientY;

      // Place joystick base at touch start
      this._joyBase.style.left    = (t.clientX - JOY_RADIUS) + 'px';
      this._joyBase.style.top     = (t.clientY - JOY_RADIUS) + 'px';
      this._joyBase.style.opacity = '1';
      this._setKnob(0, 0);
    }, { passive: false });

    leftZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._leftTouchId) continue;
        const rawDx = t.clientX - this._leftBaseX;
        const rawDz = t.clientY - this._leftBaseY;
        const dist  = Math.sqrt(rawDx * rawDx + rawDz * rawDz);
        const clamp = Math.min(dist, JOY_RADIUS);
        const nx    = dist > 0 ? rawDx / dist : 0;
        const nz    = dist > 0 ? rawDz / dist : 0;

        this._moveX = Math.abs(nx) > JOY_DEAD_ZONE ? nx * (clamp / JOY_RADIUS) : 0;
        this._moveZ = Math.abs(nz) > JOY_DEAD_ZONE ? nz * (clamp / JOY_RADIUS) : 0;

        this._setKnob(nx * clamp, nz * clamp);
      }
    }, { passive: false });

    const endLeft = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._leftTouchId) continue;
        this._leftTouchId = null;
        this._moveX       = 0;
        this._moveZ       = 0;
        this._joyBase.style.opacity = '0';
        this._setKnob(0, 0);
      }
    };
    leftZone.addEventListener('touchend',    endLeft, { passive: true });
    leftZone.addEventListener('touchcancel', endLeft, { passive: true });

    // ── Jump zone: tap anywhere in the zone ──────────────────────────────────
    const jumpZone = document.getElementById('tc-jump-zone');
    if (jumpZone) {
      jumpZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._jumpPressed = true;
        jumpZone.classList.add('tc-jump-pressed');
      }, { passive: false });
      jumpZone.addEventListener('touchend', () => {
        jumpZone.classList.remove('tc-jump-pressed');
      }, { passive: true });
      jumpZone.addEventListener('touchcancel', () => {
        jumpZone.classList.remove('tc-jump-pressed');
      }, { passive: true });
    }

    // ── Action buttons ───────────────────────────────────────────────────────
    this._bindActionBtn('tc-btn-attack', () => { this._attackPressed = true; });
    this._bindActionBtn('tc-btn-switch', () => { this._switchPressed = true; });
  }

  _bindActionBtn(id, callback) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      callback();
      btn.classList.add('tc-btn-pressed');
    }, { passive: false });
    btn.addEventListener('touchend', () => btn.classList.remove('tc-btn-pressed'), { passive: true });
    btn.addEventListener('touchcancel', () => btn.classList.remove('tc-btn-pressed'), { passive: true });
  }

  _setKnob(px, py) {
    this._joyKnob.style.transform =
      `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
  }
}
