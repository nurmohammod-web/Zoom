import { createServer } from "http";
import { Server } from "socket.io";

// Standalone Socket.io signaling server. Pure relay — no database access.
// Persistence (rooms/participants) lives in the Next.js API routes.

// Railway (and most PaaS) inject PORT and route their public URL to it.
// Fall back to SIGNALING_PORT for local dev.
const PORT = Number(process.env.PORT ?? process.env.SIGNALING_PORT ?? 4000);
const MAX_PER_ROOM = 4;

interface PeerMeta {
  roomId: string;
  name: string;
}

// socket.id -> { roomId, name }
const peers = new Map<string, PeerMeta>();

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, peers: peers.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: true, // reflect request origin (dev). Lock down in production.
    methods: ["GET", "POST"],
  },
});

function peersInRoom(roomId: string, exceptId?: string) {
  const result: { socketId: string; name: string }[] = [];
  for (const [socketId, meta] of peers) {
    if (meta.roomId === roomId && socketId !== exceptId) {
      result.push({ socketId, name: meta.name });
    }
  }
  return result;
}

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }: { roomId: string; name: string }) => {
    if (!roomId || typeof roomId !== "string") return;

    const existing = peersInRoom(roomId);
    if (existing.length >= MAX_PER_ROOM) {
      socket.emit("room-full", { maxParticipants: MAX_PER_ROOM });
      return;
    }

    peers.set(socket.id, { roomId, name: name || "Guest" });
    socket.join(roomId);

    // Tell the newcomer who is already here (they will wait for offers).
    socket.emit("existing-peers", { peers: existing });

    // Tell existing members about the newcomer (they will initiate offers).
    socket.to(roomId).emit("peer-joined", { socketId: socket.id, name: name || "Guest" });
  });

  // Relay SDP/ICE to a specific target socket, tagging the sender.
  socket.on("offer", ({ to, sdp }: { to: string; sdp: RTCSessionDescriptionInit }) => {
    io.to(to).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ to, sdp }: { to: string; sdp: RTCSessionDescriptionInit }) => {
    io.to(to).emit("answer", { from: socket.id, sdp });
  });

  socket.on(
    "ice-candidate",
    ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    },
  );

  socket.on("chat-message", ({ text }: { text: string }) => {
    const meta = peers.get(socket.id);
    if (!meta || !text) return;
    io.to(meta.roomId).emit("chat-message", {
      from: socket.id,
      name: meta.name,
      text: String(text).slice(0, 2000),
      ts: Date.now(),
    });
  });

  socket.on("disconnect", () => {
    const meta = peers.get(socket.id);
    if (meta) {
      socket.to(meta.roomId).emit("peer-left", { socketId: socket.id });
      peers.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[signaling] listening on http://localhost:${PORT}`);
});
