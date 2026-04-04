/**
 * hud.js
 * DOM-based HUD overlay for Seestern Fighters v0.7.
 * Shows: health, jump cooldown, active weapon (with icon + CD bar),
 *        ability status (aura timer, nova charge, buried indicator),
 *        score, mode badge, level name, hit flash, pickup hint.
 */

// ── Canvas-drawn round weapon/ability icons ───────────────────────────────────
function drawIcon(key) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 32, 32);

  // Background circle
  const bgColors = {
    muschelShooter: '#dda840',
    blasenkanone:   '#2277cc',
    stachelAura:    '#cc2200',
    novaBlast:      '#cc5500',
    einbuddeln:     '#996622',
  };
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fillStyle = bgColors[key] || '#445566';
  ctx.fill();

  ctx.save();
  ctx.translate(16, 16);

  switch (key) {
    case 'muschelShooter': {
      // Shell fan + bullet line
      ctx.strokeStyle = '#fffae0';
      ctx.lineWidth   = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.45;
        ctx.beginPath();
        ctx.arc(0, 0, 8, a - 0.4, a + 0.4);
        ctx.stroke();
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, 0); ctx.stroke();
      break;
    }
    case 'blasenkanone': {
      // 3 bubble circles
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      [[0, -4, 4], [4, 2, 3], [-4, 3, 3]].forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      });
      break;
    }
    case 'stachelAura': {
      // 6 radiating lines (spike circle)
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth   = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff6600'; ctx.fill();
      break;
    }
    case 'novaBlast': {
      // 8-pointed explosion star
      ctx.fillStyle = '#ffee44';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a    = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const r    = i % 2 === 0 ? 10 : 4;
        const x    = Math.cos(a) * r;
        const y    = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      break;
    }
    case 'einbuddeln': {
      // Sandy mound + downward arrow
      ctx.fillStyle = '#e8c060';
      ctx.beginPath();
      ctx.ellipse(0, 4, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00ffaa'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -2);
      ctx.moveTo(-3, -4); ctx.lineTo(0, -2); ctx.lineTo(3, -4);
      ctx.stroke();
      break;
    }
    default: {
      ctx.fillStyle = '#ccc';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  return canvas;
}

export class HUD {
  constructor(container) {
    this.container    = container;
    this._hitTimeout  = null;
    this._pickupHint1 = '';
    this._pickupHint2 = '';
    this._build();
  }

  _build() {
    this.container.innerHTML = `
      <div class="p-hud p1-hud">
        <div class="p-name" id="p1-name">Spieler 1</div>
        <div class="bar-label">HP</div>
        <div class="bar-bg"><div class="health-bar" id="p1-hp-bar"></div></div>
        <div class="bar-value" id="p1-hp-val">100</div>
        <div class="bar-label">Sprung-CD</div>
        <div class="bar-bg"><div class="cd-bar" id="p1-cd-bar" style="width:100%"></div></div>
        <div class="cd-text" id="p1-cd-text">Bereit ✓</div>
        <div class="weapon-row" id="p1-weapon-row">
          <canvas class="weapon-icon" id="p1-weapon-icon" width="32" height="32"></canvas>
          <span class="active-weapon" id="p1-active-weapon">—</span>
        </div>
        <div class="bar-bg">
          <div class="weapon-cd-bar" id="p1-weapon-cd-bar" style="width:100%"></div>
        </div>
        <div class="ability-row" id="p1-ability-row"></div>
        <div class="pickup-hint" id="p1-pickup-hint"></div>
      </div>

      <div class="center-panel">
        <div class="score-display" id="score-display">Score: 0</div>
        <div class="mode-badge"  id="mode-badge">KI-Gegner</div>
        <div class="level-badge" id="level-badge"></div>
        <div class="hit-flash"   id="hit-flash"></div>
      </div>

      <div class="p-hud p2-hud">
        <div class="p-name" id="p2-name">Gegner</div>
        <div class="bar-label">HP</div>
        <div class="bar-bg"><div class="health-bar" id="p2-hp-bar"></div></div>
        <div class="bar-value" id="p2-hp-val">100</div>
        <div class="bar-label">Sprung-CD</div>
        <div class="bar-bg"><div class="cd-bar" id="p2-cd-bar" style="width:100%"></div></div>
        <div class="cd-text" id="p2-cd-text">Bereit ✓</div>
        <div class="weapon-row" id="p2-weapon-row">
          <canvas class="weapon-icon" id="p2-weapon-icon" width="32" height="32"></canvas>
          <span class="active-weapon" id="p2-active-weapon">—</span>
        </div>
        <div class="bar-bg">
          <div class="weapon-cd-bar" id="p2-weapon-cd-bar" style="width:100%"></div>
        </div>
        <div class="ability-row" id="p2-ability-row"></div>
        <div class="pickup-hint" id="p2-pickup-hint"></div>
      </div>
    `;
  }

  _hpColor(pct) {
    if (pct > 0.5) return '#44dd44';
    if (pct > 0.25) return '#ffaa00';
    return '#ff3333';
  }

  _weaponColor(key) {
    const colors = {
      muschelShooter: '#ffcc44',
      blasenkanone:   '#44aaff',
    };
    return colors[key] || '#00ccff';
  }

  _updateCharPanel(prefix, char) {
    const hpPct = char.health / char.maxHealth;
    const cdPct = char.jumpCooldown > 0
      ? 1 - char.jumpCooldown / char.JUMP_COOLDOWN_TIME
      : 1;

    document.getElementById(`${prefix}-hp-bar`).style.width     = (hpPct * 100) + '%';
    document.getElementById(`${prefix}-hp-bar`).style.background = this._hpColor(hpPct);
    document.getElementById(`${prefix}-hp-val`).textContent      = Math.ceil(char.health);
    document.getElementById(`${prefix}-cd-bar`).style.width      = (cdPct * 100) + '%';
    document.getElementById(`${prefix}-cd-text`).textContent =
      char.jumpCooldown > 0 ? `CD: ${char.jumpCooldown.toFixed(1)} s` : 'Bereit ✓';

    // Active weapon icon + name
    const summary       = char.weaponSlots.getSummary();
    const activeSummary = summary.find(s => s.active);
    const activeEl      = document.getElementById(`${prefix}-active-weapon`);
    const wcdBarEl      = document.getElementById(`${prefix}-weapon-cd-bar`);
    const iconCanvas    = document.getElementById(`${prefix}-weapon-icon`);

    if (activeSummary && activeSummary.damage > 0) {
      const key    = char.weaponSlots.getActive()?.key || '';
      const wColor = this._weaponColor(key);
      activeEl.textContent = activeSummary.weapon;
      activeEl.style.color = wColor;
      wcdBarEl.style.width      = (activeSummary.cooldownPct * 100) + '%';
      wcdBarEl.style.background = activeSummary.ready ? wColor : '#666';
      // Redraw icon
      const iconSrc = drawIcon(key);
      const iconCtx = iconCanvas.getContext('2d');
      iconCtx.clearRect(0, 0, 32, 32);
      iconCtx.drawImage(iconSrc, 0, 0);
    } else {
      activeEl.textContent = '— Leer —';
      activeEl.style.color = '#445566';
      wcdBarEl.style.width      = '100%';
      wcdBarEl.style.background = '#333';
      const iconCtx = iconCanvas.getContext('2d');
      iconCtx.clearRect(0, 0, 32, 32);
    }
  }

  /** Call once at start (or restart) to set names and initial state */
  init(p1, p2, mode, levelName) {
    document.getElementById('p1-name').textContent = p1.name;
    document.getElementById('p2-name').textContent = p2.name;
    document.getElementById('mode-badge').textContent =
      mode === 'local-versus' ? '⚔ Lokal 2-Spieler' : '🤖 KI-Gegner';
    const levelBadge = document.getElementById('level-badge');
    if (levelBadge) {
      levelBadge.textContent  = levelName || '';
      levelBadge.style.display = levelName ? 'block' : 'none';
    }
    // Clear ability rows
    ['p1', 'p2'].forEach(px => {
      const el = document.getElementById(`${px}-ability-row`);
      if (el) el.innerHTML = '';
    });
  }

  /** Call every frame */
  update(p1, p2) {
    this._updateCharPanel('p1', p1);
    this._updateCharPanel('p2', p2);

    const h1 = document.getElementById('p1-pickup-hint');
    const h2 = document.getElementById('p2-pickup-hint');
    if (h1) h1.textContent = this._pickupHint1 || '';
    if (h2) h2.textContent = this._pickupHint2 || '';
    this._pickupHint1 = '';
    this._pickupHint2 = '';
  }

  /**
   * Update ability status indicators for one player panel.
   * @param {string} prefix - 'p1' or 'p2'
   * @param {AbilityManager} abilities
   */
  updateAbilities(prefix, abilities) {
    const row = document.getElementById(`${prefix}-ability-row`);
    if (!row) return;

    const parts = [];

    if (abilities.hasStachelAura) {
      const t   = abilities.stachelAuraTimer.toFixed(1);
      const pct = (abilities.stachelAuraTimer / 15 * 100).toFixed(0);
      parts.push(
        `<div class="ab-chip ab-aura">` +
          `<canvas class="ab-icon" data-key="stachelAura" width="20" height="20"></canvas>` +
          `<span>Aura ${t}s</span>` +
          `<div class="ab-bar-bg"><div class="ab-bar-fill ab-bar-aura" style="width:${pct}%"></div></div>` +
        `</div>`
      );
    }

    if (abilities.hasNovaBlast) {
      if (abilities.isNovaCharging) {
        const pct = (abilities.novaChargeProgress * 100).toFixed(0);
        parts.push(
          `<div class="ab-chip ab-nova charging">` +
            `<canvas class="ab-icon" data-key="novaBlast" width="20" height="20"></canvas>` +
            `<span>NOVA ${pct}%</span>` +
            `<div class="ab-bar-bg"><div class="ab-bar-fill ab-bar-nova" style="width:${pct}%"></div></div>` +
          `</div>`
        );
      } else {
        parts.push(
          `<div class="ab-chip ab-nova">` +
            `<canvas class="ab-icon" data-key="novaBlast" width="20" height="20"></canvas>` +
            `<span>Nova BEREIT</span>` +
          `</div>`
        );
      }
    }

    if (abilities.hasEinbuddeln) {
      if (abilities.isBuried) {
        parts.push(
          `<div class="ab-chip ab-bury active">` +
            `<canvas class="ab-icon" data-key="einbuddeln" width="20" height="20"></canvas>` +
            `<span>VERGRABEN</span>` +
          `</div>`
        );
      } else {
        parts.push(
          `<div class="ab-chip ab-bury">` +
            `<canvas class="ab-icon" data-key="einbuddeln" width="20" height="20"></canvas>` +
            `<span>Tarnung</span>` +
          `</div>`
        );
      }
    }

    row.innerHTML = parts.join('');

    // Draw small icons into each ability chip canvas
    row.querySelectorAll('canvas.ab-icon').forEach(cv => {
      const key = cv.dataset.key;
      if (!key) return;
      const iconSrc = drawIcon(key);
      const ctx     = cv.getContext('2d');
      ctx.clearRect(0, 0, 20, 20);
      ctx.drawImage(iconSrc, 0, 0, 20, 20);
    });
  }

  setPickupHint(playerIndex, name) {
    const hint = name ? `In der Nähe: ${name}` : '';
    if (playerIndex === 0) this._pickupHint1 = hint;
    else                   this._pickupHint2 = hint;
  }

  showHit(attackerName, damage) {
    const el = document.getElementById('hit-flash');
    el.textContent = `${attackerName} trifft! −${damage} Farbe`;
    el.classList.add('visible');
    clearTimeout(this._hitTimeout);
    this._hitTimeout = setTimeout(() => el.classList.remove('visible'), 1200);
  }

  updateScore(score) {
    const el = document.getElementById('score-display');
    if (el) el.textContent = `Score: ${score}`;
  }

  setLevelName(name) {
    const el = document.getElementById('level-badge');
    if (el) {
      el.textContent  = name;
      el.style.display = name ? 'block' : 'none';
    }
  }
}
