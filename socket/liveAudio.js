const LiveReport = require("../models/LiveReport");

// roomId -> broadcasterSocketId
const activeRooms = new Map();

// socketId -> roomId (for cleanup)
const socketToRoom = new Map();

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =====================================
    // BROADCASTER JOIN
    // =====================================
    socket.on("broadcaster", async ({ roomId }, cb) => {
      try {
        const roomKey = String(roomId).trim();

        socket.join(roomKey);

        activeRooms.set(roomKey, socket.id);
        socketToRoom.set(socket.id, roomKey);

        await LiveReport.findOneAndUpdate(
          { roomId: roomKey, status: "live" },
          {
            $set: {
              broadcasterSocketId: socket.id,
            },
          },
        );

        console.log("🎤 Broadcaster Ready:", roomKey);

        cb?.({ success: true });
      } catch (err) {
        console.log("Broadcaster Error:", err);
        cb?.({ success: false });
      }
    });

    // =====================================
    // VIEWER JOIN
    // =====================================
    socket.on("viewer", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        const broadcasterSocketId = activeRooms.get(roomKey);

        if (!broadcasterSocketId) {
          console.log("❌ No broadcaster in memory");
          socket.emit("broadcast-not-found");
          return;
        }

        socket.join(roomKey);

        socket.emit("viewer-accepted", {
          broadcasterId: broadcasterSocketId,
        });

        io.to(broadcasterSocketId).emit("viewer-joined", {
          viewerId: socket.id,
        });

        console.log("👂 Viewer Joined:", socket.id);
      } catch (err) {
        console.log("Viewer Error:", err);
      }
    });

    // =====================================
    // OFFER
    // =====================================
    socket.on("offer", ({ target, offer }) => {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =====================================
    // ANSWER
    // =====================================
    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // =====================================
    // CANDIDATE
    // =====================================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =====================================
    // STOP BROADCAST (MANUAL)
    // =====================================
    socket.on("stop-broadcast", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        activeRooms.delete(roomKey);

        await LiveReport.findOneAndUpdate(
          { roomId: roomKey, status: "live" },
          {
            $set: {
              status: "completed",
              isLive: false,
              endTime: new Date(),
              broadcasterSocketId: null,
            },
          },
        );

        io.to(roomKey).emit("broadcast-stopped");

        console.log("🛑 Broadcast Stopped:", roomKey);
      } catch (err) {
        console.log("Stop Error:", err);
      }
    });

    // =====================================
    // DISCONNECT (AUTO CLEANUP FIXED)
    // =====================================
    socket.on("disconnect", async () => {
      try {
        console.log("❌ Disconnected:", socket.id);

        const roomKey = socketToRoom.get(socket.id);

        if (!roomKey) return;

        activeRooms.delete(roomKey);
        socketToRoom.delete(socket.id);

        await LiveReport.findOneAndUpdate(
          { roomId: roomKey, status: "live" },
          {
            $set: {
              status: "completed",
              isLive: false,
              endTime: new Date(),
              broadcasterSocketId: null,
            },
          },
        );

        io.to(roomKey).emit("broadcast-stopped");

        console.log("🎤 Auto stopped broadcast:", roomKey);
      } catch (err) {
        console.log("Disconnect Error:", err);
      }
    });
  });
};
