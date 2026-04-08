/**
 * server.js — Seestern Fighters WebSocket Server
 *
 * Handles:
 *   1. Matchmaking: queues clients and pairs them into rooms
 *   2. State relay:  relays player state + game events to peer in the same room
 *   3. Disconnect handling: notifies peer when someone leaves
 *
 * Protocol (JSON over WebSocket):
 *
 *   Client → Server:
 *     { type:'hello',     playerName:'...' }
 *     { type:'state',     pos:[x,y,z], vel:[vx,vy,vz], facing:f,
 *                         health:h, isAlive:b, isBuried:b, isJumping:b,
 *                         weaponKey:'...' }
 *     { type:'event',     action:'fire'|'jump'|'hit',
 *                         pos:[x,y,z], dir:[dx,dz], damage:d, ... }
 *     { type:'ping' }
 *
 *   Server → Client:
 *     { type:'waiting' }
 *     { type:'matched',   roomId:'...', isHost:b, peerName:'...' }
 *     { type:'peer_state', ...same fields as state... }
 *     { type:'peer_event', ...same fields as event... }
 *     { type:'peer_left' }
 *     { type:'pong' }
 *     { type:'error',     message:'...' }
 */

const WebSocket = require('ws');

const PORT = parseInt(process.env.PORT || '8091', 10);

// ── State ─────────────────────────────────────────────────────────────────────

let nextId  = 1;
const waiting = [];           // clients waiting for a partner
const rooms   = new Map();    // roomId → { host: ws, guest: ws }

// ── Server setup ──────────────────────────────────────────────────────────────

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`[Seestern Server] Listening on ws://0.0.0.0:${PORT}`);
});

wss.on('connection', (ws, req) => {
  ws.clientId   = nextId++;
  ws.roomId     = null;
  ws.playerName = 'Spieler';
  ws.isAlive    = true; // for ping/pong keepalive

  const ip = req.socket.remoteAddress || 'unknown';
  console.log(`[+] Client ${ws.clientId} connected from ${ip}`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); }
    catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }
    handleMessage(ws, msg);
  });

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('close', () => {
    console.log(`[-] Client ${ws.clientId} disconnected`);
    removeFromWaiting(ws);
    notifyPeerLeft(ws);
  });

  ws.on('error', (err) => {
    console.error(`[!] Client ${ws.clientId} error: ${err.message}`);
  });
});

// ── Keepalive ping (every 30 s) ───────────────────────────────────────────────

const pingInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      console.log(`[~] Terminating stale client ${ws.clientId}`);
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

wss.on('close', () => clearInterval(pingInterval));

// ── Message handler ───────────────────────────────────────────────────────────

function handleMessage(ws, msg) {
  switch (msg.type) {

    case 'hello': {
      // Register player name and try to match
      ws.playerName = sanitizeName(msg.playerName);
      console.log(`[hello] Client ${ws.clientId} name="${ws.playerName}", waiting=${waiting.length}`);

      if (waiting.length > 0) {
        // Pair with the longest-waiting client
        const peer = waiting.shift();
        createRoom(peer, ws);
      } else {
        // Join the waiting queue
        waiting.push(ws);
        send(ws, { type: 'waiting' });
        console.log(`[wait]  Client ${ws.clientId} queued (queue size: ${waiting.length})`);
      }
      break;
    }

    case 'state':
    case 'event': {
      // Relay to peer in same room
      const peer = getPeer(ws);
      if (peer) {
        const relayType = msg.type === 'state' ? 'peer_state' : 'peer_event';
        send(peer, { ...msg, type: relayType });
      }
      break;
    }

    case 'ping': {
      send(ws, { type: 'pong' });
      break;
    }

    default:
      console.log(`[?] Unknown message type "${msg.type}" from client ${ws.clientId}`);
  }
}

// ── Room management ───────────────────────────────────────────────────────────

function createRoom(host, guest) {
  const roomId = `${host.clientId}-${guest.clientId}`;
  host.roomId  = roomId;
  guest.roomId = roomId;
  rooms.set(roomId, { host, guest });

  console.log(`[room] Created room "${roomId}": ${host.playerName} (host) vs ${guest.playerName}`);

  send(host, {
    type:      'matched',
    roomId,
    isHost:    true,
    peerName:  guest.playerName,
  });
  send(guest, {
    type:      'matched',
    roomId,
    isHost:    false,
    peerName:  host.playerName,
  });
}

function getPeer(ws) {
  if (!ws.roomId) return null;
  const room = rooms.get(ws.roomId);
  if (!room) return null;
  return room.host === ws ? room.guest : room.host;
}

function notifyPeerLeft(ws) {
  if (!ws.roomId) return;
  const peer = getPeer(ws);
  if (peer && peer.readyState === WebSocket.OPEN) {
    send(peer, { type: 'peer_left' });
  }
  rooms.delete(ws.roomId);
  ws.roomId = null;
}

function removeFromWaiting(ws) {
  const idx = waiting.indexOf(ws);
  if (idx !== -1) {
    waiting.splice(idx, 1);
    console.log(`[wait]  Client ${ws.clientId} removed from queue (size: ${waiting.length})`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function sanitizeName(raw) {
  if (typeof raw !== 'string') return 'Spieler';
  return raw.trim().slice(0, 20) || 'Spieler';
}
