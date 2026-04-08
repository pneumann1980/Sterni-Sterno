/**
 * matchmaking.js — v0.10
 * WebSocket-based matchmaking with automatic AI fallback.
 *
 * Flow:
 *   1. search(playerName) — opens WebSocket, sends { type:'hello' }
 *   2. Waits SEARCH_TIMEOUT ms for the server to pair two clients
 *   3. onMatch(isOnline, matchInfo)
 *        isOnline=true  → real player found; matchInfo = { ws, isHost, peerName }
 *        isOnline=false → AI fallback; matchInfo = null
 *   4. cancel() — abort without triggering callbacks
 *
 * Server URL is resolved in this priority order:
 *   1. ?ws=wss://... query parameter (manual override)
 *   2. Auto-detect: same host as the game page, port 8091
 *
 * Debug logging is written to console with [MM] prefix.
 */

const SEARCH_TIMEOUT = 12_000; // ms before AI fallback

// ── WebSocket URL resolution ───────────────────────────────────────────────────

function resolveWsUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('ws')) {
    const override = params.get('ws');
    console.log(`[MM] WS URL override: ${override}`);
    return override;
  }

  // Auto-detect: same host, port 8091
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host  = window.location.hostname;
  const url   = `${proto}//${host}:8091`;
  console.log(`[MM] Auto-detected WS URL: ${url}`);
  return url;
}

const WS_URL = resolveWsUrl();

// ── MatchState ────────────────────────────────────────────────────────────────

export const MatchState = {
  IDLE:      'idle',
  SEARCHING: 'searching',
  MATCHED:   'matched',
  FALLBACK:  'fallback',
  CANCELLED: 'cancelled',
};

// ── MatchmakingClient ─────────────────────────────────────────────────────────

export class MatchmakingClient {
  /**
   * @param {function(boolean, object|null): void} onMatch
   *   Called with (true,  { ws, isHost, peerName }) when a real player is found
   *   Called with (false, null)                     when falling back to AI
   * @param {function(string): void} [onStateChange]
   *   Optional callback called each time MatchState changes
   */
  constructor(onMatch, onStateChange) {
    this._onMatch       = onMatch;
    this._onStateChange = onStateChange || (() => {});
    this._state         = MatchState.IDLE;
    this._ws            = null;
    this._fallbackTimer = null;
  }

  get state() { return this._state; }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Start searching. Safe to call multiple times; cancels any previous search.
   * @param {string} playerName  Player's display name sent to the server
   */
  search(playerName = 'Spieler') {
    this.cancel();
    this._setState(MatchState.SEARCHING);
    console.log(`[MM] search() playerName="${playerName}" url="${WS_URL}"`);

    this._fallbackTimer = setTimeout(() => {
      console.log('[MM] Timeout — falling back to AI');
      this._triggerFallback();
    }, SEARCH_TIMEOUT);

    this._connectWebSocket(playerName);
  }

  /** Abort without triggering any callbacks. */
  cancel() {
    clearTimeout(this._fallbackTimer);
    this._fallbackTimer = null;
    if (this._ws) {
      this._ws.onclose = null; // prevent fallback on intentional close
      this._ws.close();
      this._ws = null;
    }
    if (this._state === MatchState.SEARCHING) {
      this._setState(MatchState.CANCELLED);
      console.log('[MM] Cancelled');
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  _connectWebSocket(playerName) {
    let ws;
    try {
      ws = new WebSocket(WS_URL);
      this._ws = ws;
    } catch (e) {
      console.error('[MM] Failed to create WebSocket:', e);
      return; // will fall through to timer-based fallback
    }

    ws.addEventListener('open', () => {
      if (this._state !== MatchState.SEARCHING) return;
      console.log('[MM] WS open — sending hello');
      ws.send(JSON.stringify({ type: 'hello', playerName }));
    });

    ws.addEventListener('message', (evt) => {
      if (this._state !== MatchState.SEARCHING) return;
      let msg;
      try { msg = JSON.parse(evt.data); }
      catch { console.warn('[MM] Malformed message:', evt.data); return; }

      console.log('[MM] Received:', msg.type, msg);

      switch (msg.type) {
        case 'waiting':
          // Still queued — UI already shows "Suche..."
          break;

        case 'matched':
          // Real player found — keep WS open for game sync
          this._triggerMatch(true, {
            ws,
            isHost:   msg.isHost,
            peerName: msg.peerName || 'Gegner',
            roomId:   msg.roomId,
          });
          this._ws = null; // ownership transferred to caller
          break;

        case 'error':
          console.warn('[MM] Server error:', msg.message);
          break;

        default:
          console.log('[MM] Unhandled message type:', msg.type);
      }
    });

    ws.addEventListener('error', (err) => {
      console.error('[MM] WebSocket error:', err);
      // Let the fallback timer handle it — don't double-fire
    });

    ws.addEventListener('close', (evt) => {
      console.log(`[MM] WS closed (code=${evt.code})`);
      if (this._ws === ws) this._ws = null;
      // If still searching, let the fallback timer fire naturally
    });
  }

  _triggerMatch(isOnline, matchInfo = null) {
    if (this._state !== MatchState.SEARCHING) return;
    clearTimeout(this._fallbackTimer);
    this._fallbackTimer = null;

    if (!isOnline && this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }

    this._setState(isOnline ? MatchState.MATCHED : MatchState.FALLBACK);
    this._onMatch(isOnline, matchInfo);
  }

  _triggerFallback() {
    this._triggerMatch(false, null);
  }

  _setState(s) {
    this._state = s;
    this._onStateChange(s);
  }
}
