/**
 * gamesync.js — v0.10
 * Keeps a matched WebSocket alive for the duration of an online game.
 *
 * Responsibilities:
 *   • sendState(state)  — send own player state to the peer (rate-limited to 20/s)
 *   • sendEvent(event)  — send a game event (fire, hit, jump) to peer immediately
 *   • Receives peer_state / peer_event / peer_left messages and calls callbacks
 *
 * State object shape (subset actually used):
 *   {
 *     pos:      [x, y, z],
 *     vel:      [vx, vy, vz],
 *     facing:   number,
 *     health:   number,
 *     isAlive:  boolean,
 *     isBuried: boolean,
 *     isJumping: boolean,
 *     weaponKey: string|null,
 *   }
 *
 * Event object shape:
 *   { action: 'fire'|'jump'|'hit', damage?:number, pos?:[x,y,z], dir?:[dx,dz] }
 */

const STATE_INTERVAL_MS = 50; // send state at most every 50 ms (20/s)

export class GameSync {
  /**
   * @param {WebSocket}                   ws
   * @param {boolean}                     isHost
   * @param {function(object):void}       onPeerState
   * @param {function(object):void}       onPeerEvent
   * @param {function():void}             onPeerLeft
   */
  constructor(ws, isHost, onPeerState, onPeerEvent, onPeerLeft) {
    this._ws          = ws;
    this._isHost      = isHost;
    this._onPeerState = onPeerState;
    this._onPeerEvent = onPeerEvent;
    this._onPeerLeft  = onPeerLeft;
    this._lastSentAt  = 0;
    this._closed      = false;

    this._ws.addEventListener('message', (evt) => this._handleMessage(evt));
    this._ws.addEventListener('close',   ()    => this._handleClose());
    this._ws.addEventListener('error',   (e)   => console.error('[GS] WS error:', e));

    console.log(`[GS] GameSync ready, isHost=${isHost}`);
  }

  get isHost() { return this._isHost; }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Send own player state (rate-limited to STATE_INTERVAL_MS).
   * Call every frame — internally throttled.
   */
  sendState(state) {
    if (this._closed) return;
    const now = performance.now();
    if (now - this._lastSentAt < STATE_INTERVAL_MS) return;
    this._lastSentAt = now;
    this._send({ type: 'state', ...state });
  }

  /**
   * Send a one-shot game event immediately (no rate limiting).
   */
  sendEvent(event) {
    if (this._closed) return;
    this._send({ type: 'event', ...event });
  }

  /** Gracefully close the connection. */
  close() {
    this._closed = true;
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.close();
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  _handleMessage(evt) {
    let msg;
    try { msg = JSON.parse(evt.data); }
    catch { return; }

    switch (msg.type) {
      case 'peer_state':
        this._onPeerState(msg);
        break;
      case 'peer_event':
        this._onPeerEvent(msg);
        break;
      case 'peer_left':
        console.log('[GS] Peer left the game');
        this._onPeerLeft();
        break;
      case 'pong':
        break; // keepalive from server
      default:
        console.log('[GS] Unhandled msg:', msg.type);
    }
  }

  _handleClose() {
    if (!this._closed) {
      console.log('[GS] Connection closed unexpectedly');
      this._closed = true;
      this._onPeerLeft();
    }
  }

  _send(obj) {
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }
}
