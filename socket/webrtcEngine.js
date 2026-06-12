const broadcasters = new Map();
// roomId -> { socketId, ready: true, ts }

const viewers = new Map();
// viewerSocketId -> { roomId, broadcasterId }

const pendingViewers = new Map();
// roomId -> [viewerSocketId]

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    // =========================
    // BROADCASTER
    // =========================
    socket.on("broadcaster", ({ roomId }) => {
      if (!roomId) return;

      console.log("\n========== BROADCAST START ==========");
      console.log("Room:", roomId);
      console.log("Socket:", socket.id);

      const broadcasterData = {
        socketId: socket.id,
        ready: true,
        ts: Date.now(),
      };

      broadcasters.set(roomId, broadcasterData);

      socket.roomId = roomId;
      socket.role = "broadcaster";
      socket.join(roomId);

      console.log("Broadcaster Set:", broadcasterData);

      socket.emit("broadcast-ready", { roomId });

      // 🔥 flush queued viewers
      const queue = pendingViewers.get(roomId) || [];

      if (queue.length > 0) {
        console.log("🔄 Flushing queued viewers:", queue.length);

        queue.forEach((viewerId) => {
          io.to(socket.id).emit("viewer", { viewerId });
        });

        pendingViewers.delete(roomId);
      }
    });

    // =========================
    // VIEWER
    // =========================
    socket.on("viewer", ({ roomId }) => {
      if (!roomId) return;

      console.log("\n========== VIEWER JOIN ==========");
      console.log("Room:", roomId);
      console.log("Viewer:", socket.id);

      const broadcaster = broadcasters.get(roomId);

      if (!broadcaster || !broadcaster.ready) {
        console.log("⏳ Broadcaster not ready, queueing...");

        if (!pendingViewers.has(roomId)) {
          pendingViewers.set(roomId, []);
        }

        const q = pendingViewers.get(roomId);

        if (!q.includes(socket.id)) {
          q.push(socket.id);
        }

        return;
      }

      socket.roomId = roomId;
      socket.role = "viewer";

      viewers.set(socket.id, {
        roomId,
        broadcasterId: broadcaster.socketId,
      });

      socket.join(roomId);

      io.to(broadcaster.socketId).emit("viewer", {
        viewerId: socket.id,
      });

      console.log("✅ Viewer Added:", socket.id);
    });

    // =========================
    // OFFER
    // =========================
    socket.on("offer", ({ target, offer }) => {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =========================
    // ANSWER
    // =========================
    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // =========================
    // CANDIDATE
    // =========================
    socket.on("candidate", ({ target, candidate }) => {
      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =========================
    // STOP BROADCAST
    // =========================
    socket.on("stop-broadcast", ({ roomId }) => {
      const b = broadcasters.get(roomId);

      if (!b || b.socketId !== socket.id) {
        console.log("❌ Unauthorized stop request");
        return;
      }

      console.log("🛑 Broadcast Stopped:", roomId);

      cleanup(io, roomId);
    });

    // =========================
    // DISCONNECT
    // =========================
    socket.on("disconnect", () => {
      console.log("🔴 Disconnected:", socket.id);

      // broadcaster check
      for (const [roomId, b] of broadcasters.entries()) {
        if (b.socketId === socket.id) {
          cleanup(io, roomId);
          return;
        }
      }

      // viewer check
      const viewer = viewers.get(socket.id);

      if (viewer) {
        io.to(viewer.broadcasterId).emit("viewer-disconnected", {
          viewerId: socket.id,
        });

        viewers.delete(socket.id);
      }
    });
  });
};

// =========================
// CLEANUP
// =========================
const cleanup = (io, roomId) => {
  console.log("🧹 Cleaning Room:", roomId);

  const broadcaster = broadcasters.get(roomId);

  if (broadcaster) {
    io.to(broadcaster.socketId).emit("broadcast-stopped");
  }

  broadcasters.delete(roomId);
  pendingViewers.delete(roomId);

  for (const [viewerId, v] of viewers.entries()) {
    if (v.roomId === roomId) {
      viewers.delete(viewerId);
    }
  }

  console.log("✅ Cleanup Done");
};

module.exports = { initWebRTCSignaling };