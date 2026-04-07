/**
 * hud.js — Seestern Fighters v0.8
 * Brawl-Stars-inspired HUD:
 *   • Top bar: 🏆 trophies (left) | mode/level badge (center) | Skins button (right)
 *   • Left panel: player 1 HP, jump CD, active weapon icon + name + CD, abilities
 *   • Right panel: player 2 HP (or enemy count in multi-AI)
 *   • Center: score, hit flash
 */

// ── Canvas icon helpers ───────────────────────────────────────────────────────
function drawIcon(key) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 32, 32);

  const bg = { muschelShooter:'#dda840', blasenkanone:'#2277cc',
               stachelAura:'#cc2200', novaBlast:'#cc5500', einbuddeln:'#996622' };
  ctx.beginPath(); ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fillStyle = bg[key] || '#445566'; ctx.fill();

  ctx.save(); ctx.translate(16, 16);
  switch (key) {
    case 'muschelShooter':
      ctx.strokeStyle = '#fffae0'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.45;
        ctx.beginPath(); ctx.arc(0, 0, 8, a - 0.4, a + 0.4); ctx.stroke();
      }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, 0); ctx.stroke();
      break;
    case 'blasenkanone':
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      [[0,-4,4],[4,2,3],[-4,3,3]].forEach(([x,y,r]) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      });
      break;
    case 'stachelAura':
      ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a)*4, Math.sin(a)*4);
        ctx.lineTo(Math.cos(a)*11, Math.sin(a)*11); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2);
      ctx.fillStyle='#ff6600'; ctx.fill(); break;
    case 'novaBlast':
      ctx.fillStyle = '#ffee44';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i/8)*Math.PI*2-Math.PI/2, r = i%2===0?10:4;
        i===0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
              : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2);
      ctx.fillStyle='#fff'; ctx.fill(); break;
    case 'einbuddeln':
      ctx.fillStyle='#e8c060'; ctx.beginPath();
      ctx.ellipse(0,4,9,5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#00ffaa'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,-2);
      ctx.moveTo(-3,-4); ctx.lineTo(0,-2); ctx.lineTo(3,-4); ctx.stroke(); break;
    default:
      ctx.fillStyle='#ccc'; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
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
      <!-- ── Top bar (Brawl Stars style) ─────────────────────────────────── -->
      <div id="hud-top-bar">
        <div id="hud-top-left">
          <div id="trophy-display">
            <span class="trophy-icon">🏆</span>
            <span id="trophy-count">0</span>
          </div>
          <div id="coin-display">
            <span class="coin-icon">🪙</span>
            <span id="coin-count">0</span>
          </div>
        </div>
        <div id="hud-center-info">
          <div class="mode-badge" id="mode-badge">KI-Gegner</div>
          <div class="level-badge" id="level-badge"></div>
        </div>
        <div id="hud-top-right">
          <button id="btn-hud-shop" class="hud-shop-btn">🛒 Shop</button>
          <button id="btn-hud-skins" class="hud-skins-btn">🎨 Skins</button>
        </div>
      </div>

      <!-- ── Panels row (player 1 left, center, player 2 right) ─────────── -->
      <div class="hud-panels-row">
        <!-- Player 1 -->
        <div class="p-hud p1-hud" id="p1-panel">
          <div class="p-name" id="p1-name">Spieler 1</div>
          <div class="bar-label">HP</div>
          <div class="bar-bg"><div class="health-bar" id="p1-hp-bar"></div></div>
          <div class="bar-value" id="p1-hp-val">100</div>
          <div class="bar-label">Sprung-CD</div>
          <div class="bar-bg"><div class="cd-bar" id="p1-cd-bar" style="width:100%"></div></div>
          <div class="cd-text" id="p1-cd-text">Bereit ✓</div>
          <div class="weapon-row">
            <canvas class="weapon-icon" id="p1-weapon-icon" width="32" height="32"></canvas>
            <span class="active-weapon" id="p1-active-weapon">—</span>
          </div>
          <div class="bar-bg"><div class="weapon-cd-bar" id="p1-weapon-cd-bar" style="width:100%"></div></div>
          <div class="ability-row" id="p1-ability-row"></div>
          <div class="pickup-hint" id="p1-pickup-hint"></div>
        </div>

        <!-- Center: score + flash -->
        <div class="center-panel">
          <div class="score-display" id="score-display">Score: 0</div>
          <div class="enemy-counter" id="enemy-counter"></div>
          <div class="hit-flash"     id="hit-flash"></div>
        </div>

        <!-- Player 2 / Enemy -->
        <div class="p-hud p2-hud" id="p2-panel">
          <div class="p-name" id="p2-name">Gegner</div>
          <div class="bar-label">HP</div>
          <div class="bar-bg"><div class="health-bar" id="p2-hp-bar"></div></div>
          <div class="bar-value" id="p2-hp-val">100</div>
          <div class="bar-label">Sprung-CD</div>
          <div class="bar-bg"><div class="cd-bar" id="p2-cd-bar" style="width:100%"></div></div>
          <div class="cd-text" id="p2-cd-text">Bereit ✓</div>
          <div class="weapon-row">
            <canvas class="weapon-icon" id="p2-weapon-icon" width="32" height="32"></canvas>
            <span class="active-weapon" id="p2-active-weapon">—</span>
          </div>
          <div class="bar-bg"><div class="weapon-cd-bar" id="p2-weapon-cd-bar" style="width:100%"></div></div>
          <div class="ability-row" id="p2-ability-row"></div>
          <div class="pickup-hint" id="p2-pickup-hint"></div>
        </div>
      </div>
    `;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _hpColor(pct) {
    if (pct > 0.5) return '#44dd44';
    if (pct > 0.25) return '#ffaa00';
    return '#ff3333';
  }

  _weaponColor(key) {
    return { muschelShooter: '#ffcc44', blasenkanone: '#44aaff' }[key] || '#00ccff';
  }

  _updateCharPanel(prefix, char) {
    const hpPct = char.health / char.maxHealth;
    const cdPct = char.jumpCooldown > 0
      ? 1 - char.jumpCooldown / char.JUMP_COOLDOWN_TIME : 1;

    document.getElementById(`${prefix}-hp-bar`).style.width     = (hpPct * 100) + '%';
    document.getElementById(`${prefix}-hp-bar`).style.background = this._hpColor(hpPct);
    document.getElementById(`${prefix}-hp-val`).textContent      = Math.ceil(char.health);
    document.getElementById(`${prefix}-cd-bar`).style.width      = (cdPct * 100) + '%';
    document.getElementById(`${prefix}-cd-text`).textContent =
      char.jumpCooldown > 0 ? `CD: ${char.jumpCooldown.toFixed(1)} s` : 'Bereit ✓';

    const summary       = char.weaponSlots.getSummary();
    const activeSummary = summary.find(s => s.active);
    const activeEl      = document.getElementById(`${prefix}-active-weapon`);
    const wcdBarEl      = document.getElementById(`${prefix}-weapon-cd-bar`);
    const iconCanvas    = document.getElementById(`${prefix}-weapon-icon`);

    if (activeSummary && activeSummary.damage > 0) {
      const key    = char.weaponSlots.getActive()?.key || '';
      const wColor = this._weaponColor(key);
      activeEl.textContent          = activeSummary.weapon;
      activeEl.style.color          = wColor;
      wcdBarEl.style.width          = (activeSummary.cooldownPct * 100) + '%';
      wcdBarEl.style.background     = activeSummary.ready ? wColor : '#666';
      const iconCtx = iconCanvas.getContext('2d');
      iconCtx.clearRect(0, 0, 32, 32);
      iconCtx.drawImage(drawIcon(key), 0, 0);
    } else {
      activeEl.textContent      = '— Leer —';
      activeEl.style.color      = '#445566';
      wcdBarEl.style.width      = '100%';
      wcdBarEl.style.background = '#333';
      iconCanvas.getContext('2d').clearRect(0, 0, 32, 32);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  init(p1, p2, mode, levelName, trophies = 0, coins = 0) {
    document.getElementById('p1-name').textContent = p1.name;
    document.getElementById('p2-name').textContent = p2 ? p2.name : 'Gegner';
    document.getElementById('mode-badge').textContent =
      mode === 'local-versus' ? '⚔ Lokal 2-Spieler'
      : mode === 'vs-multi-ai' ? '🌊 Arena vs KI'
      : '🤖 KI-Gegner';
    const levelBadge = document.getElementById('level-badge');
    if (levelBadge) {
      levelBadge.textContent  = levelName || '';
      levelBadge.style.display = levelName ? 'block' : 'none';
    }
    this.updateTrophies(trophies);
    this.updateCoins(coins);
    ['p1', 'p2'].forEach(px => {
      const el = document.getElementById(`${px}-ability-row`);
      if (el) el.innerHTML = '';
    });
  }

  update(p1, p2) {
    this._updateCharPanel('p1', p1);
    if (p2) this._updateCharPanel('p2', p2);

    const h1 = document.getElementById('p1-pickup-hint');
    const h2 = document.getElementById('p2-pickup-hint');
    if (h1) h1.textContent = this._pickupHint1 || '';
    if (h2) h2.textContent = this._pickupHint2 || '';
    this._pickupHint1 = '';
    this._pickupHint2 = '';
  }

  /** Update the persistent trophy counter (top-left). */
  updateTrophies(count) {
    const el = document.getElementById('trophy-count');
    if (el) el.textContent = count;
  }

  /** Update the Unterseetaler coin counter (top-left). */
  updateCoins(count) {
    const el = document.getElementById('coin-count');
    if (el) el.textContent = count;
  }

  /** Show living enemy count in the center panel. */
  updateEnemyCount(living, total) {
    const el = document.getElementById('enemy-counter');
    if (!el) return;
    if (total <= 1) { el.textContent = ''; return; }
    el.textContent = `Gegner: ${living} / ${total}`;
    el.style.color = living === 0 ? '#44ff88' : '#ff8844';
  }

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
      const pct = (abilities.novaChargeProgress * 100).toFixed(0);
      parts.push(
        abilities.isNovaCharging
          ? `<div class="ab-chip ab-nova charging"><canvas class="ab-icon" data-key="novaBlast" width="20" height="20"></canvas>` +
            `<span>NOVA ${pct}%</span><div class="ab-bar-bg"><div class="ab-bar-fill ab-bar-nova" style="width:${pct}%"></div></div></div>`
          : `<div class="ab-chip ab-nova"><canvas class="ab-icon" data-key="novaBlast" width="20" height="20"></canvas>` +
            `<span>Nova BEREIT</span></div>`
      );
    }
    if (abilities.hasEinbuddeln) {
      parts.push(abilities.isBuried
        ? `<div class="ab-chip ab-bury active"><canvas class="ab-icon" data-key="einbuddeln" width="20" height="20"></canvas><span>VERGRABEN</span></div>`
        : `<div class="ab-chip ab-bury"><canvas class="ab-icon" data-key="einbuddeln" width="20" height="20"></canvas><span>Tarnung</span></div>`
      );
    }

    row.innerHTML = parts.join('');
    row.querySelectorAll('canvas.ab-icon').forEach(cv => {
      const iconCtx = cv.getContext('2d');
      iconCtx.clearRect(0, 0, 20, 20);
      iconCtx.drawImage(drawIcon(cv.dataset.key), 0, 0, 20, 20);
    });
  }

  setPickupHint(idx, name) {
    const hint = name ? `In der Nähe: ${name}` : '';
    if (idx === 0) this._pickupHint1 = hint;
    else           this._pickupHint2 = hint;
  }

  showHit(attackerName, damage) {
    const el = document.getElementById('hit-flash');
    if (!el) return;
    el.textContent = damage > 0
      ? `${attackerName} trifft! −${damage} Farbe`
      : `${attackerName}`;
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
