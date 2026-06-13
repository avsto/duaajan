// webrtcSignaling.js

const broadcasters = new Map();
// roomId -> { socketId, ready, ts }

const viewers = new Map();
// viewerSocketId -> { roomId, broadcasterId }

const pendingViewers = new Map();
// roomId -> Set(viewerSocketId)

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    // ==================================================
    // BROADCASTER
    // ==================================================
    socket.on("broadcaster", ({ roomId }) => {
      try {
        if (!roomId) return;

        console.log("\n========== BROADCAST START ==========");
        console.log("Room:", roomId);
        console.log("Socket:", socket.id);

        broadcasters.set(roomId, {
          socketId: socket.id,
          ready: true,
          ts: Date.now(),
        });

        socket.roomId = roomId;
        socket.role = "broadcaster";

        socket.join(roomId);

        socket.emit("broadcast-ready", {
          roomId,
        });

        console.log("ALL BROADCASTERS:", [...broadcasters.entries()]);

        // ==========================================
        // FLUSH PENDING VIEWERS
        // ==========================================
        const queue = pendingViewers.get(roomId);

        if (queue && queue.size > 0) {
          console.log("🔄 Flushing queued viewers:", queue.size);

          queue.forEach((viewerId) => {
            const viewerSocket = io.sockets.sockets.get(viewerId);

            if (!viewerSocket) return;

            viewers.set(viewerId, {
              roomId,
              broadcasterId: socket.id,
            });

            viewerSocket.roomId = roomId;
            viewerSocket.role = "viewer";

            viewerSocket.join(roomId);

            io.to(socket.id).emit("viewer", {
              viewerId,
            });

            console.log("✅ Queued Viewer Added:", viewerId);
          });

          pendingViewers.delete(roomId);
        }

        console.log("✅ Broadcaster Ready");
      } catch (err) {
        console.log("Broadcaster Error:", err);
      }
    });

    // ==================================================
    // VIEWER
    // ==================================================
    socket.on("viewer", ({ roomId }) => {
      try {
        if (!roomId) return;

        console.log("\n========== VIEWER JOIN ==========");
        console.log("Room:", roomId);
        console.log("Viewer:", socket.id);

        console.log("CURRENT BROADCASTERS:", [...broadcasters.entries()]);

        const broadcaster = broadcasters.get(roomId);

        console.log("FOUND BROADCASTER:", broadcaster);

        // broadcaster unavailable
        if (!broadcaster || !broadcaster.ready) {
          console.log("⏳ Broadcaster not ready, queueing...");

          if (!pendingViewers.has(roomId)) {
            pendingViewers.set(roomId, new Set());
          }

          pendingViewers.get(roomId).add(socket.id);

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
      } catch (err) {
        console.log("Viewer Error:", err);
      }
    });

    // ==================================================
    // OFFER
    // ==================================================
    socket.on("offer", ({ target, offer }) => {
      if (!target) return;

      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // ==================================================
    // ANSWER
    // ==================================================
    socket.on("answer", ({ target, answer }) => {
      if (!target) return;

      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // ==================================================
    // CANDIDATE
    // ==================================================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // ==================================================
    // STOP BROADCAST
    // ==================================================
    socket.on("stop-broadcast", ({ roomId }) => {
      try {
        const broadcaster = broadcasters.get(roomId);

        if (!broadcaster) return;

        if (broadcaster.socketId !== socket.id) {
          return;
        }

        console.log("🛑 Broadcast Stopped:", roomId);

        cleanup(io, roomId);
      } catch (err) {
        console.log("Stop Error:", err);
      }
    });

    // ==================================================
    // DISCONNECT
    // ==================================================
    socket.on("disconnect", () => {
      console.log("🔴 Disconnected:", socket.id);

      // viewer disconnect
      const viewer = viewers.get(socket.id);

      if (viewer) {
        io.to(viewer.broadcasterId).emit("viewer-disconnected", {
          viewerId: socket.id,
        });

        viewers.delete(socket.id);

        console.log("👋 Viewer Left");

        return;
      }

      // broadcaster disconnect
      for (const [roomId, broadcaster] of broadcasters.entries()) {
        if (broadcaster.socketId === socket.id) {
          console.log("📴 Broadcaster disconnected, waiting 30 sec...");

          setTimeout(() => {
            const current = broadcasters.get(roomId);

            // reconnected
            if (current && current.socketId !== socket.id) {
              console.log("♻️ Broadcaster reconnected");
              return;
            }

            // still disconnected
            if (current && current.socketId === socket.id) {
              console.log("🛑 Broadcaster really disconnected");

              cleanup(io, roomId);
            }
          }, 30000);

          break;
        }
      }
    });
  });
};

// ==================================================
// CLEANUP
// ==================================================
const cleanup = (io, roomId) => {
  console.log("🧹 Cleaning Room:", roomId);

  io.to(roomId).emit("broadcast-stopped");

  broadcasters.delete(roomId);
  pendingViewers.delete(roomId);

  for (const [viewerId, viewer] of viewers.entries()) {
    if (viewer.roomId === roomId) {
      viewers.delete(viewerId);
    }
  }

  console.log("✅ Cleanup Done");
};

module.exports = {
  initWebRTCSignaling,
};
