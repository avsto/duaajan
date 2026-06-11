const broadcasters = new Map();
const viewers = new Map();

/**
 * SAFE broadcaster structure:
 * roomId => { socketId, ready, ts }
 */
const setBroadcaster = (roomId, socketId) => {
  broadcasters.set(roomId, {
    socketId,
    ready: true,
    ts: Date.now(),
  });
};

const getBroadcaster = (roomId) => {
  return broadcasters.get(roomId);
};

const waitForBroadcaster = (roomId, tries = 6) => {
  return new Promise((resolve) => {
    let count = 0;

    const interval = setInterval(() => {
      const b = getBroadcaster(roomId);

      if (b?.socketId) {
        clearInterval(interval);
        return resolve(b.socketId);
      }

      count++;

      if (count >= tries) {
        clearInterval(interval);
        resolve(null);
      }
    }, 500);
  });
};

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
    // BROADCASTER START
    // =========================
    socket.on("broadcaster", ({ roomId }) => {
      if (!roomId) return;

      console.log("\n========== BROADCAST START ==========");
      console.log("Room:", roomId);
      console.log("Socket:", socket.id);

      socket.roomId = roomId;
      socket.role = "broadcaster";

      socket.join(roomId);

      setBroadcaster(roomId, socket.id);

      console.log("Broadcaster Set:", getBroadcaster(roomId));

      socket.emit("broadcast-ready", { roomId });
    });

    // =========================
    // VIEWER JOIN (FIXED RACE CONDITION)
    // =========================
    socket.on("viewer", async ({ roomId }) => {
      if (!roomId) return;

      console.log("\n========== VIEWER JOIN ==========");
      console.log("Room:", roomId);
      console.log("Viewer:", socket.id);

      let broadcaster = getBroadcaster(roomId);

      if (!broadcaster?.socketId) {
        console.log("⏳ Broadcaster not ready, waiting...");

        const resolved = await waitForBroadcaster(roomId);

        if (!resolved) {
          console.log("❌ No broadcaster found after retry");
          socket.emit("broadcast-not-found");
          return;
        }

        broadcaster = { socketId: resolved };
      }

      attachViewer(socket, roomId, broadcaster.socketId, io);
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
    // STOP BROADCAST
    // =========================
    socket.on("stop-broadcast", ({ roomId }) => {
      const broadcaster = getBroadcaster(roomId);

      if (!broadcaster || broadcaster.socketId !== socket.id) {
        console.log("❌ Unauthorized stop request");
        return;
      }

      console.log("🛑 Broadcast Stopped:", roomId);

      cleanupRoom(io, roomId);
    });

    // =========================
    // DISCONNECT (SAFE)
    // =========================
    socket.on("disconnect", (reason) => {
      console.log(`🔴 Disconnected: ${socket.id} | ${reason}`);

      // viewer cleanup
      if (viewers.has(socket.id)) {
        const { roomId, broadcasterId } = viewers.get(socket.id);

        io.to(broadcasterId).emit("viewer-disconnected", {
          viewerId: socket.id,
        });

        viewers.delete(socket.id);
        return;
      }

      // broadcaster cleanup
      for (const [roomId, b] of broadcasters.entries()) {
        if (b.socketId === socket.id) {
          console.log("📴 Broadcaster disconnected:", roomId);

          setTimeout(() => {
            const latest = getBroadcaster(roomId);

            if (latest?.socketId === socket.id) {
              cleanupRoom(io, roomId);
            }
          }, 5000);

          break;
        }
      }
    });
  });
};

// =========================
// CLEANUP ROOM
// =========================
const cleanupRoom = (io, roomId) => {
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
