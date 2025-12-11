// server/signaling.cjs
// Minimal WebRTC mesh signaling server using ws + express.
//
// Run locally:
//   node server/signaling.cjs
// or via npm script:
//   "server": "node server/signaling.cjs"
//
// Env (optional):
//   SIGNALING_PORT  (defaults to 4100)
//   SIGNALING_HOST  (defaults to 0.0.0.0)

require('dotenv').config();
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();

// Simple health endpoint
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/**
 * Signal:
 * {
 *   type: "join"|"peers"|"peer-join"|"peer-leave"|"offer"|"answer"|"ice",
 *   room: string,
 *   from?: string,
 *   to?: string,
 *   payload?: any
 * }
 *
 * rooms: Map<roomId, Map<peerId, WebSocket>>
 */
const rooms = new Map();

/**
 * Get or create room map.
 * @param {string} roomId
 * @returns {Map<string, WebSocket>}
 */
function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Map();
    rooms.set(roomId, room);
  }
  return room;
}

/**
 * Broadcast to all peers in a room except the sender.
 * @param {string} roomId
 * @param {WebSocket} sender
 * @param {any} message
 */
function broadcast(roomId, sender, message) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(message);

  for (const [, socket] of room.entries()) {
    if (socket === sender) continue;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  let currentRoomId = null;
  let currentPeerId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { type, room, from, to } = msg || {};

    // First message must be "join"
    if (type === 'join' && room && from) {
      currentRoomId = room;
      currentPeerId = from;

      const roomMap = getRoom(room);
      roomMap.set(currentPeerId, ws);

      // Send existing peers back to the newcomer
      const existingPeers = Array.from(roomMap.keys()).filter(
        (id) => id !== currentPeerId
      );

      ws.send(
        JSON.stringify({
          type: 'peers',
          room,
          from: 'server',
          payload: existingPeers,
        })
      );

      // Notify others that a new peer joined
      broadcast(room, ws, {
        type: 'peer-join',
        room,
        from: currentPeerId,
      });

      return;
    }

    // Ignore anything until we know room & peer
    if (!currentRoomId || !currentPeerId) return;

    // Direct message to a specific peer (offer/answer/ice)
    if (to) {
      const roomMap = rooms.get(currentRoomId);
      if (!roomMap) return;
      const targetSocket = roomMap.get(to);
      if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
        targetSocket.send(JSON.stringify(msg));
      }
      return;
    }

    // Fallback: broadcast to everyone else (not commonly used)
    broadcast(currentRoomId, ws, msg);
  });

  ws.on('close', () => {
    if (!currentRoomId || !currentPeerId) return;

    const roomMap = rooms.get(currentRoomId);
    if (!roomMap) return;

    roomMap.delete(currentPeerId);

    // Inform others that this peer left
    broadcast(currentRoomId, ws, {
      type: 'peer-leave',
      room: currentRoomId,
      from: currentPeerId,
    });

    if (roomMap.size === 0) {
      rooms.delete(currentRoomId);
    }
  });
});

// IMPORTANT: dedicated port for signaling, default 4100
const PORT = Number(process.env.SIGNALING_PORT || 4100);
const HOST = process.env.SIGNALING_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Signaling server listening on http://${HOST}:${PORT}`);
});
