/**
 * hud.js
 * DOM-based HUD overlay: health bars (Farbe), jump cooldown, slot info, mode.
 * All elements are created once and updated each frame.
 */

export class HUD {
  constructor(container) {
    this.container = container;
    this._build();
  }

  _build() {
    this.container.innerHTML = `
      <div class="p-hud p1-hud">
        <div class="p-name" id="p1-name">Spieler 1</div>
        <div class="bar-label">Farbe</div>
        <div class="bar-bg">
          <div class="health-bar" id="p1-hp-bar"></div>
        </div>
        <div class="bar-value" id="p1-hp-val">100</div>
        <div class="bar-label">Sprung</div>
        <div class="bar-bg">
          <div class="cd-bar" id="p1-cd-bar" style="width:100%"></div>
        </div>
        <div class="cd-text" id="p1-cd-text">Bereit ✓</div>
        <div class="slots" id="p1-slots"></div>
      </div>

      <div class="center-panel">
        <div class="mode-badge" id="mode-badge">KI-Gegner</div>
        <div class="hit-flash" id="hit-flash"></div>
      </div>

      <div class="p-hud p2-hud">
        <div class="p-name" id="p2-name">Gegner</div>
        <div class="bar-label">Farbe</div>
        <div class="bar-bg">
          <div class="health-bar" id="p2-hp-bar"></div>
        </div>
        <div class="bar-value" id="p2-hp-val">100</div>
        <div class="bar-label">Sprung</div>
        <div class="bar-bg">
          <div class="cd-bar" id="p2-cd-bar" style="width:100%"></div>
        </div>
        <div class="cd-text" id="p2-cd-text">Bereit ✓</div>
        <div class="slots" id="p2-slots"></div>
      </div>
    `;
  }

  _hpColor(pct) {
    if (pct > 0.5) return '#44dd44';
    if (pct > 0.25) return '#ffaa00';
    return '#ff3333';
  }

  _updateCharPanel(prefix, char) {
    const hpPct = char.health / char.maxHealth;
    const cdPct = char.jumpCooldown > 0
      ? 1 - char.jumpCooldown / char.JUMP_COOLDOWN_TIME
      : 1;

    document.getElementById(`${prefix}-hp-bar`).style.width  = (hpPct * 100) + '%';
    document.getElementById(`${prefix}-hp-bar`).style.background = this._hpColor(hpPct);
    document.getElementById(`${prefix}-hp-val`).textContent  = Math.ceil(char.health);
    document.getElementById(`${prefix}-cd-bar`).style.width  = (cdPct * 100) + '%';
    document.getElementById(`${prefix}-cd-text`).textContent =
      char.jumpCooldown > 0
        ? `CD: ${char.jumpCooldown.toFixed(1)} s`
        : 'Bereit ✓';
  }

  /** Call once at start (or restart) to set names and slots */
  init(p1, p2, mode) {
    document.getElementById('p1-name').textContent = p1.name;
    document.getElementById('p2-name').textContent = p2.name;
    document.getElementById('mode-badge').textContent =
      mode === 'local-versus' ? '⚔ Lokal 2-Spieler' : '🤖 KI-Gegner';
    this._renderSlots('p1', p1.weaponSlots);
    this._renderSlots('p2', p2.weaponSlots);
  }

  _renderSlots(prefix, weaponSlots) {
    const el = document.getElementById(`${prefix}-slots`);
    if (!el) return;
    el.innerHTML = weaponSlots.getSummary()
      .map(s =>
        `<span class="slot ${s.damage > 0 ? 'filled' : 'empty'}">
          ${s.slot}: ${s.weapon}${s.damage > 0 ? ` (${s.damage})` : ''}
        </span>`
      ).join('');
  }

  /** Call every frame */
  update(p1, p2) {
    this._updateCharPanel('p1', p1);
    this._updateCharPanel('p2', p2);
  }

  /** Show a brief hit indicator in the center */
  showHit(attackerName, damage) {
    const el = document.getElementById('hit-flash');
    el.textContent = `${attackerName} trifft! −${damage} Farbe`;
    el.classList.add('visible');
    clearTimeout(this._hitTimeout);
    this._hitTimeout = setTimeout(() => el.classList.remove('visible'), 1200);
  }
}
