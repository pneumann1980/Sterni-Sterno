/**
 * matchmaking.js
 * Simple WebSocket-based matchmaking with automatic AI fallback.
 *
 * Flow:
 *   1. connect() — attempts WebSocket to server
 *   2. Waits SEARCH_TIMEOUT seconds for a peer signal
 *   3. onMatch(isOnline)  — called with true  if a real player was found
 *                                          false if AI fallback kicks in
 *   4. cancel() — abort the search
 *
 * Server protocol (JSON messages):
 *   client → server: { type: 'hello' }
 *   server → client: { type: 'matched', peerId: '...' }
 *   server → client: { type: 'waiting' }
 *
 * If no server is reachable the code falls back silently after SEARCH_TIMEOUT ms.
 */

const SEARCH_TIMEOUT = 5000; // ms before AI fallback
const WS_URL = (() => {
  // Allow override via ?ws=wss://example.com in the URL
  const params = new URLSearchParams(window.location.search);
  return params.get('ws') || null; // null → always AI fallback
})();

export const MatchState = {
  IDLE:      'idle',
  SEARCHING: 'searching',
  MATCHED:   'matched',
  FALLBACK:  'fallback',
  CANCELLED: 'cancelled',
};

export class MatchmakingClient {
  /**
   * @param {function(boolean): void} onMatch
   *   Called with true  when a real player is found
   *   Called with false when falling back to AI
   * @param {function(string): void} [onStateChange]
   *   Optional: called each time the MatchState changes
   */
  constructor(onMatch, onStateChange) {
    this._onMatch       = onMatch;
    this._onStateChange = onStateChange || (() => {});
    this._state         = MatchState.IDLE;
    this._ws            = null;
    this._fallbackTimer = null;
  }

  get state() { return this._state; }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Start searching for a match. Safe to call multiple times; cancels any
   * previous search first.
   */
  search() {
    this.cancel();
    this._setState(MatchState.SEARCHING);

    // Arm fallback timer — fires whether WebSocket connects or not
    this._fallbackTimer = setTimeout(() => {
      this._triggerFallback();
    }, SEARCH_TIMEOUT);

    if (WS_URL) {
      this._connectWebSocket();
    }
    // If no WS_URL the timer alone will fire the fallback
  }

  /** Abort the current search without triggering any match callback. */
  cancel() {
    clearTimeout(this._fallbackTimer);
    this._fallbackTimer = null;
    if (this._ws) {
      this._ws.onclose = null; // prevent fallback on explicit close
      this._ws.close();
      this._ws = null;
    }
    if (this._state === MatchState.SEARCHING) {
      this._setState(MatchState.CANCELLED);
    }
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _connectWebSocket() {
    try {
      this._ws = new WebSocket(WS_URL);
    } catch {
      // Invalid URL — will fall back via timer
      return;
    }

    this._ws.addEventListener('open', () => {
      if (this._state !== MatchState.SEARCHING) return;
      this._ws.send(JSON.stringify({ type: 'hello' }));
    });

    this._ws.addEventListener('message', (evt) => {
      if (this._state !== MatchState.SEARCHING) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'matched') {
          this._triggerMatch(true);
        }
      } catch { /* ignore malformed messages */ }
    });

    this._ws.addEventListener('error', () => {
      // Connection failed — fall through to timer-based fallback
    });

    this._ws.addEventListener('close', () => {
      this._ws = null;
    });
  }

  _triggerMatch(isOnline) {
    if (this._state !== MatchState.SEARCHING) return;
    clearTimeout(this._fallbackTimer);
    this._fallbackTimer = null;
    if (this._ws && !isOnline) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
    this._setState(isOnline ? MatchState.MATCHED : MatchState.FALLBACK);
    this._onMatch(isOnline);
  }

  _triggerFallback() {
    this._triggerMatch(false);
  }

  _setState(s) {
    this._state = s;
    this._onStateChange(s);
  }
}
