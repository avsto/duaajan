// webrtcSignaling.js

const os = require("os");

console.log("======================================");
console.log("WEBRTC SIGNALING FILE LOADED");
console.log("FILE:", __filename);
console.log("DIR:", __dirname);
console.log("MODULE ID:", module.id);
console.log("HOSTNAME:", os.hostname());
console.log("PID:", process.pid);
console.log("======================================");

const broadcasters = new Map();
const viewers = new Map();
const pendingViewers = new Map();

const initWebRTCSignaling = (io) => {
  console.log("initWebRTCSignaling() called");

  io.on("connection", (socket) => {
    console.log("\n🟢 Connected:", socket.id);
    console.log("HOSTNAME:", os.hostname());
    console.log("PID:", process.pid);

    // ==================================================
    // BROADCASTER
    // ==================================================
    socket.on("broadcaster", ({ roomId }) => {
      try {
        if (!roomId) return;

        console.log("\n========== BROADCAST START ==========");
        console.log("Room:", roomId);
        console.log("Socket:", socket.id);
        console.log("HOSTNAME:", os.hostname());
        console.log("PID:", process.pid);

        console.log(
          "MAP SIZE BEFORE:",
          broadcasters.size
        );

        broadcasters.set(roomId, {
          socketId: socket.id,
          ready: true,
          ts: Date.now(),
        });

        console.log(
          "MAP SIZE AFTER:",
          broadcasters.size
        );

        console.log(
          "ALL BROADCASTERS:",
          [...broadcasters.entries()]
        );

        socket.roomId = roomId;
        socket.role = "broadcaster";

        socket.join(roomId);

        socket.emit("broadcast-ready", {
          roomId,
        });

        // flush pending viewers
        const queue = pendingViewers.get(roomId);

        if (queue && queue.size > 0) {
          console.log(
            "🔄 Flushing queued viewers:",
            queue.size
          );

          queue.forEach((viewerId) => {
            const viewerSocket =
              io.sockets.sockets.get(viewerId);

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
        console.log("HOSTNAME:", os.hostname());
        console.log("PID:", process.pid);

        console.log(
          "CURRENT MAP SIZE:",
          broadcasters.size
        );

        console.log(
          "CURRENT BROADCASTERS:",
          [...broadcasters.entries()]
        );

        const broadcaster =
          broadcasters.get(roomId);

        console.log(
          "FOUND BROADCASTER:",
          broadcaster
        );

        if (!broadcaster || !broadcaster.ready) {
          console.log(
            "⏳ Broadcaster not ready, queueing..."
          );

          if (!pendingViewers.has(roomId)) {
            pendingViewers.set(
              roomId,
              new Set()
            );
          }

          pendingViewers
            .get(roomId)
            .add(socket.id);

          return;
        }

        socket.roomId = roomId;
        socket.role = "viewer";

        viewers.set(socket.id, {
          roomId,
          broadcasterId: broadcaster.socketId,
        });

        socket.join(roomId);

        io.to(broadcaster.socketId).emit(
          "viewer",
          {
            viewerId: socket.id,
          }
        );

        console.log(
          "✅ Viewer Added:",
          socket.id
        );
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
    // DISCONNECT
    // ==================================================
    socket.on("disconnect", () => {
      console.log("🔴 Disconnected:", socket.id);

      const viewer = viewers.get(socket.id);

      if (viewer) {
        viewers.delete(socket.id);

        io.to(viewer.broadcasterId).emit(
          "viewer-disconnected",
          {
            viewerId: socket.id,
          }
        );

        return;
      }

      for (const [roomId, broadcaster] of broadcasters.entries()) {
        if (broadcaster.socketId === socket.id) {
          console.log(
            "📴 Broadcaster disconnected"
          );

          broadcasters.delete(roomId);

          io.to(roomId).emit(
            "broadcast-stopped"
          );

          break;
        }
      }
    });
  });
};

module.exports = {
  initWebRTCSignaling,
};