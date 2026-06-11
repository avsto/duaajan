const broadcasters = new Map(); // roomId -> socketId
const viewers = new Map(); // viewerId -> { roomId, broadcasterId }

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    // =========================
    // BROADCASTER
    // =========================
    socket.on("broadcaster", ({ roomId }) => {
      if (!roomId) return;

      console.log("\n========== BROADCAST START ==========");

      // overwrite safe
      broadcasters.set(roomId, socket.id);

      socket.roomId = roomId;
      socket.role = "broadcaster";

      socket.join(roomId);

      console.log("Room:", roomId);
      console.log("Socket:", socket.id);

      socket.emit("broadcast-ready", { roomId });
    });

    // =========================
    // VIEWER
    // =========================
    socket.on("viewer", ({ roomId }) => {
      if (!roomId) return;

      console.log("\n========== VIEWER JOIN ==========");
      console.log("Room:", roomId);
      console.log("Viewer:", socket.id);

      const broadcasterId = broadcasters.get(roomId);

      console.log("Found Broadcaster:", broadcasterId);

      if (!broadcasterId) {
        socket.emit("broadcast-not-found");
        return;
      }

      socket.roomId = roomId;
      socket.role = "viewer";

      viewers.set(socket.id, {
        roomId,
        broadcasterId,
      });

      socket.join(roomId);

      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });

      console.log("✅ Viewer Added");
    });

    // =========================
    // SIGNALING
    // =========================
    socket.on("offer", ({ target, offer }) => {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    socket.on("candidate", ({ target, candidate }) => {
      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =========================
    // STOP
    // =========================
    socket.on("stop-broadcast", ({ roomId }) => {
      const broadcasterId = broadcasters.get(roomId);

      if (broadcasterId !== socket.id) {
        console.log("❌ Unauthorized stop");
        return;
      }

      console.log("🛑 Broadcast Stopped:", roomId);

      handleCleanup(io, roomId);
    });

    // =========================
    // DISCONNECT (FIXED)
    // =========================
    socket.on("disconnect", (reason) => {
      console.log(`🔴 Disconnected: ${socket.id} | ${reason}`);

      // viewer check first
      if (viewers.has(socket.id)) {
        const { roomId, broadcasterId } = viewers.get(socket.id);

        io.to(broadcasterId).emit("viewer-disconnected", {
          viewerId: socket.id,
        });

        viewers.delete(socket.id);
        return;
      }

      // broadcaster check
      let roomId = socket.roomId;

      if (!roomId) {
        for (const [r, id] of broadcasters.entries()) {
          if (id === socket.id) {
            roomId = r;
            break;
          }
        }
      }

      if (roomId && broadcasters.get(roomId) === socket.id) {
        console.log("📴 Broadcaster left:", roomId);

        setTimeout(() => {
          if (broadcasters.get(roomId) === socket.id) {
            handleCleanup(io, roomId);
          }
        }, 5000);
      }
    });
  });
};

// =========================
// CLEANUP
// =========================
const handleCleanup = (io, roomId) => {
  console.log("🧹 Cleaning Room:", roomId);

  io.to(roomId).emit("broadcast-stopped");

  broadcasters.delete(roomId);

  for (const [viewerId, v] of viewers.entries()) {
    if (v.roomId === roomId) {
      viewers.delete(viewerId);
    }
  }

  console.log("✅ Cleanup Done");
};

module.exports = { initWebRTCSignaling };
