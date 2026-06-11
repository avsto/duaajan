const broadcasters = new Map();
const viewers = new Map();

/**
 * attach viewer safely
 */
const attachViewer = (socket, roomId, broadcasterId, io) => {
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

  console.log("✅ Viewer Added:", socket.id);
};

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

      const existing = broadcasters.get(roomId);

      // SAFE overwrite logic
      if (!existing || existing !== socket.id) {
        broadcasters.set(roomId, socket.id);
      }

      socket.roomId = roomId;
      socket.role = "broadcaster";

      socket.join(roomId);

      console.log("Current Broadcaster:", broadcasters.get(roomId));

      socket.emit("broadcast-ready", { roomId });
    });

    // =========================
    // VIEWER (FIXED RACE CONDITION)
    // =========================
    socket.on("viewer", ({ roomId }) => {
      if (!roomId) return;

      console.log("\n========== VIEWER JOIN ==========");
      console.log("Room:", roomId);
      console.log("Viewer:", socket.id);

      const broadcasterId = broadcasters.get(roomId);

      console.log("Found Broadcaster:", broadcasterId);

      // 🔥 FIX: retry if undefined
      if (!broadcasterId) {
        console.log("❌ Broadcaster not ready, retrying...");

        setTimeout(() => {
          const retry = broadcasters.get(roomId);

          if (!retry) {
            socket.emit("broadcast-not-found");
            return;
          }

          attachViewer(socket, roomId, retry, io);
        }, 500);

        return;
      }

      attachViewer(socket, roomId, broadcasterId, io);
    });

    // =========================
    // OFFER
    // =========================
    socket.on("offer", ({ target, offer }) => {
      if (!target) return;

      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =========================
    // ANSWER
    // =========================
    socket.on("answer", ({ target, answer }) => {
      if (!target) return;

      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // =========================
    // CANDIDATE
    // =========================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =========================
    // STOP BROADCAST
    // =========================
    socket.on("stop-broadcast", ({ roomId }) => {
      const broadcasterId = broadcasters.get(roomId);

      if (broadcasterId !== socket.id) {
        console.log("❌ Unauthorized stop request");
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

      // VIEWER CHECK
      if (viewers.has(socket.id)) {
        const { roomId, broadcasterId } = viewers.get(socket.id);

        io.to(broadcasterId).emit("viewer-disconnected", {
          viewerId: socket.id,
        });

        viewers.delete(socket.id);
        return;
      }

      // BROADCASTER CHECK
      for (const [roomId, id] of broadcasters.entries()) {
        if (id === socket.id) {
          console.log("📴 Broadcaster disconnected:", roomId);

          // 🔥 delay cleanup (important fix)
          setTimeout(() => {
            if (broadcasters.get(roomId) === socket.id) {
              handleCleanup(io, roomId);
            }
          }, 5000);

          break;
        }
      }
    });
  });
};

// =========================
// CLEANUP FUNCTION
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
