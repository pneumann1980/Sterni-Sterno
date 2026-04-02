/**
 * hud.js
 * Extended DOM-based HUD overlay for Seestern Fighters.
 * Shows: health bars, jump cooldown, active weapon with cooldown bar,
 * weapon slot inventory, mode badge, level name, and pickup hint.
 */

export class HUD {
  constructor(container) {
    this.container     = container;
    this._hitTimeout   = null;
    this._pickupHint1  = '';
    this._pickupHint2  = '';
    this._build();
  }

  _build() {
    this.container.innerHTML = `
      <div class="p-hud p1-hud">
        <div class="p-name" id="p1-name">Spieler 1</div>
        <div class="bar-label">Farbe (HP)</div>
        <div class="bar-bg">
          <div class="health-bar" id="p1-hp-bar"></div>
        </div>
        <div class="bar-value" id="p1-hp-val">100</div>
        <div class="bar-label">Sprung-CD</div>
        <div class="bar-bg">
          <div class="cd-bar" id="p1-cd-bar" style="width:100%"></div>
        </div>
        <div class="cd-text" id="p1-cd-text">Bereit ✓</div>
        <div class="bar-label">Aktive Waffe</div>
        <div class="active-weapon" id="p1-active-weapon">—</div>
        <div class="bar-bg">
          <div class="weapon-cd-bar" id="p1-weapon-cd-bar" style="width:100%"></div>
        </div>
        <div class="slots" id="p1-slots"></div>
        <div class="pickup-hint" id="p1-pickup-hint"></div>
      </div>

      <div class="center-panel">
        <div class="score-display" id="score-display">Score: 0</div>
        <div class="mode-badge" id="mode-badge">KI-Gegner</div>
        <div class="level-badge" id="level-badge"></div>
        <div class="hit-flash" id="hit-flash"></div>
      </div>

      <div class="p-hud p2-hud">
        <div class="p-name" id="p2-name">Gegner</div>
        <div class="bar-label">Farbe (HP)</div>
        <div class="bar-bg">
          <div class="health-bar" id="p2-hp-bar"></div>
        </div>
        <div class="bar-value" id="p2-hp-val">100</div>
        <div class="bar-label">Sprung-CD</div>
        <div class="bar-bg">
          <div class="cd-bar" id="p2-cd-bar" style="width:100%"></div>
        </div>
        <div class="cd-text" id="p2-cd-text">Bereit ✓</div>
        <div class="bar-label">Aktive Waffe</div>
        <div class="active-weapon" id="p2-active-weapon">—</div>
        <div class="bar-bg">
          <div class="weapon-cd-bar" id="p2-weapon-cd-bar" style="width:100%"></div>
        </div>
        <div class="slots" id="p2-slots"></div>
        <div class="pickup-hint" id="p2-pickup-hint"></div>
      </div>
    `;
  }

  _hpColor(pct) {
    if (pct > 0.5) return '#44dd44';
    if (pct > 0.25) return '#ffaa00';
    return '#ff3333';
  }

  _weaponColor(weaponName) {
    if (!weaponName) return '#445566';
    if (weaponName.includes('Kanone')) return '#ff5500';
    if (weaponName.includes('ge'))     return '#00cc44';
    return '#00ccff';
  }

  _updateCharPanel(prefix, char) {
    const hpPct = char.health / char.maxHealth;
    const cdPct = char.jumpCooldown > 0
      ? 1 - char.jumpCooldown / char.JUMP_COOLDOWN_TIME
      : 1;

    document.getElementById(`${prefix}-hp-bar`).style.width  = (hpPct * 100) + '%';
    document.getElementById(`${prefix}-hp-bar`).style.background = this._hpColor(hpPct);
    document.getElementById(`${prefix}-hp-val`).textContent   = Math.ceil(char.health);
    document.getElementById(`${prefix}-cd-bar`).style.width   = (cdPct * 100) + '%';
    document.getElementById(`${prefix}-cd-text`).textContent  =
      char.jumpCooldown > 0
        ? `CD: ${char.jumpCooldown.toFixed(1)} s`
        : 'Bereit ✓';

    // Active weapon
    const summary     = char.weaponSlots.getSummary();
    const activeSummary = summary.find(s => s.active);
    const activeEl    = document.getElementById(`${prefix}-active-weapon`);
    const wcdBarEl    = document.getElementById(`${prefix}-weapon-cd-bar`);
    if (activeSummary && activeSummary.damage > 0) {
      const wColor = this._weaponColor(activeSummary.weapon);
      activeEl.textContent = `${activeSummary.weapon} (${activeSummary.damage})`;
      activeEl.style.color = wColor;
      wcdBarEl.style.width = (activeSummary.cooldownPct * 100) + '%';
      wcdBarEl.style.background = activeSummary.ready ? wColor : '#666';
    } else {
      activeEl.textContent = '— Leer —';
      activeEl.style.color = '#445566';
      wcdBarEl.style.width = '100%';
      wcdBarEl.style.background = '#333';
    }

    // Slot inventory
    this._renderSlots(prefix, char.weaponSlots);
  }

  /** Call once at start (or restart) to set names and initial state */
  init(p1, p2, mode, levelName) {
    document.getElementById('p1-name').textContent = p1.name;
    document.getElementById('p2-name').textContent = p2.name;
    document.getElementById('mode-badge').textContent =
      mode === 'local-versus' ? '⚔ Lokal 2-Spieler' : '🤖 KI-Gegner';
    const levelBadge = document.getElementById('level-badge');
    if (levelBadge) {
      levelBadge.textContent = levelName || '';
      levelBadge.style.display = levelName ? 'block' : 'none';
    }
    this._renderSlots('p1', p1.weaponSlots);
    this._renderSlots('p2', p2.weaponSlots);
  }

  _renderSlots(prefix, weaponSlots) {
    const el = document.getElementById(`${prefix}-slots`);
    if (!el) return;
    el.innerHTML = weaponSlots.getSummary()
      .map(s => {
        const activeClass = s.active ? ' slot-active' : '';
        const fillClass   = s.damage > 0 ? 'filled' : 'empty';
        const readyMark   = s.damage > 0 ? (s.ready ? ' ✓' : ' …') : '';
        const wcolor      = s.damage > 0 ? this._weaponColor(s.weapon) : '';
        const borderStyle = s.active && s.damage > 0
          ? `border-color: ${wcolor};`
          : '';
        return `<span class="slot ${fillClass}${activeClass}" style="${borderStyle}">
          ${s.slot}: ${s.weapon}${s.damage > 0 ? ` (${s.damage})${readyMark}` : ''}
        </span>`;
      }).join('');
  }

  /** Call every frame */
  update(p1, p2) {
    this._updateCharPanel('p1', p1);
    this._updateCharPanel('p2', p2);

    // Pickup hints
    const h1 = document.getElementById('p1-pickup-hint');
    const h2 = document.getElementById('p2-pickup-hint');
    if (h1) h1.textContent = this._pickupHint1;
    if (h2) h2.textContent = this._pickupHint2;
    // Reset hints each frame — callers set them before update()
    this._pickupHint1 = '';
    this._pickupHint2 = '';
  }

  /** Set pickup hint for a player (call before update()) */
  setPickupHint(playerIndex, weaponName) {
    const hint = weaponName ? `In der Nähe: ${weaponName}` : '';
    if (playerIndex === 0) this._pickupHint1 = hint;
    else                   this._pickupHint2 = hint;
  }

  /** Show a brief hit indicator in the center */
  showHit(attackerName, damage) {
    const el = document.getElementById('hit-flash');
    el.textContent = `${attackerName} trifft! −${damage} Farbe`;
    el.classList.add('visible');
    clearTimeout(this._hitTimeout);
    this._hitTimeout = setTimeout(() => el.classList.remove('visible'), 1200);
  }

  /** Update the persistent score display */
  updateScore(score) {
    const el = document.getElementById('score-display');
    if (el) el.textContent = `Score: ${score}`;
  }

  /** Update the level badge text */
  setLevelName(name) {
    const el = document.getElementById('level-badge');
    if (el) {
      el.textContent = name;
      el.style.display = name ? 'block' : 'none';
    }
  }
}
