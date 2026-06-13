const LiveReport = require("../models/LiveReport");

const viewers = new Map();
// viewerSocketId -> { roomId, broadcasterId }

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    // ==================================================
    // BROADCASTER
    // ==================================================
    socket.on("broadcaster", async ({ roomId }) => {
      try {
        if (!roomId) return;

        console.log("\n========== BROADCAST START ==========");
        console.log("Room:", roomId);
        console.log("Socket:", socket.id);

        socket.roomId = roomId;
        socket.role = "broadcaster";

        socket.join(roomId);

        // Save socket id in MongoDB
        await LiveReport.findOneAndUpdate(
          {
            roomId,
            isLive: true,
          },
          {
            broadcasterSocketId: socket.id,
          }
        );

        socket.emit("broadcast-ready", {
          roomId,
        });

        console.log("✅ Broadcaster Ready");
      } catch (err) {
        console.log("Broadcaster Error:", err);
      }
    });

    // ==================================================
    // VIEWER
    // ==================================================
    socket.on("viewer", async ({ roomId }) => {
      try {
        if (!roomId) return;

        console.log("\n========== VIEWER JOIN ==========");
        console.log("Room:", roomId);
        console.log("Viewer:", socket.id);

        const report = await LiveReport.findOne({
          roomId,
          isLive: true,
        });

        if (!report || !report.broadcasterSocketId) {
          console.log("❌ Broadcast Not Found");

          socket.emit("broadcast-not-found");

          return;
        }

        socket.roomId = roomId;
        socket.role = "viewer";

        viewers.set(socket.id, {
          roomId,
          broadcasterId: report.broadcasterSocketId,
        });

        socket.join(roomId);

        io.to(report.broadcasterSocketId).emit("viewer", {
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
    // ICE CANDIDATE
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
    socket.on("stop-broadcast", async ({ roomId }) => {
      try {
        console.log("🛑 Broadcast Stopped:", roomId);

        await LiveReport.findOneAndUpdate(
          {
            roomId,
            isLive: true,
          },
          {
            isLive: false,
            endTime: new Date(),
          }
        );

        cleanup(io, roomId);
      } catch (err) {
        console.log("Stop Error:", err);
      }
    });

    // ==================================================
    // DISCONNECT
    // ==================================================
    socket.on("disconnect", async () => {
      console.log("🔴 Disconnected:", socket.id);

      // viewer disconnect
      const viewer = viewers.get(socket.id);

      if (viewer) {
        io.to(viewer.broadcasterId).emit(
          "viewer-disconnected",
          {
            viewerId: socket.id,
          }
        );

        viewers.delete(socket.id);

        console.log("👋 Viewer Left");

        return;
      }

      // broadcaster disconnect
      const report = await LiveReport.findOne({
        broadcasterSocketId: socket.id,
        isLive: true,
      });

      if (report) {
        console.log("📴 Broadcaster Disconnected");

        setTimeout(async () => {
          const current = await LiveReport.findById(report._id);

          if (
            current &&
            current.isLive &&
            current.broadcasterSocketId === socket.id
          ) {
            console.log("🛑 Broadcaster Really Disconnected");

            await LiveReport.findByIdAndUpdate(report._id, {
              isLive: false,
              endTime: new Date(),
            });

            cleanup(io, report.roomId);
          }
        }, 30000);
      }
    });
  });
};

// ==================================================
// CLEANUP
// ==================================================
const cleanup = (io, roomId) => {
  try {
    console.log("🧹 Cleaning Room:", roomId);

    io.to(roomId).emit("broadcast-stopped");

    for (const [viewerId, viewer] of viewers.entries()) {
      if (viewer.roomId === roomId) {
        viewers.delete(viewerId);
      }
    }

    console.log("✅ Cleanup Done");
  } catch (err) {
    console.log("Cleanup Error:", err);
  }
};

module.exports = {
  initWebRTCSignaling,
};