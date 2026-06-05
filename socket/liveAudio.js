const LiveReport = require("../models/LiveReport");

module.exports = (io) => {
  const activeRooms = new Map(); // roomId -> socketId
  const socketToRoom = new Map();

  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =========================
    // BROADCASTER JOIN (FIXED)
    // =========================
    socket.on("broadcaster", async ({ roomId }, cb) => {
      try {
        const roomKey = String(roomId).trim();

        socket.join(roomKey);

        activeRooms.set(roomKey, socket.id);
        socketToRoom.set(socket.id, roomKey);

        // IMPORTANT FIX: ensure DB write completes BEFORE viewer joins
        const report = await LiveReport.findOneAndUpdate(
          { roomId: roomKey, status: "live" },
          {
            $set: {
              broadcasterSocketId: socket.id,
            },
          },
          { new: true },
        );

        if (!report) {
          console.log("❌ LiveReport not found");
          cb?.({ success: false });
          return;
        }

        console.log("🎤 Broadcaster Ready:", roomKey);

        cb?.({ success: true });
      } catch (err) {
        console.log("Broadcaster Error:", err);
        cb?.({ success: false });
      }
    });

    // =========================
    // VIEWER JOIN (FIXED RACE CONDITION)
    // =========================
    socket.on("viewer", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        // 🔥 FIX: check memory FIRST (faster than DB)
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

    // =========================
    // OFFER
    // =========================
    socket.on("offer", ({ target, offer }) => {
      if (!target || !offer) return;

      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =========================
    // ANSWER
    // =========================
    socket.on("answer", ({ target, answer }) => {
      if (!target || !answer) return;

      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // =========================
    // CANDIDATE
    // =========================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target || !candidate) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =========================
    // STOP BROADCAST (ONLY MANUAL)
    // =========================
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

        console.log("🛑 Broadcast Stopped");
      } catch (err) {
        console.log("Stop Error:", err);
      }
    });

    // =========================
    // DISCONNECT (FIXED - NO AUTO STOP)
    // =========================
    socket.on("disconnect", () => {
      try {
        const roomKey = socketToRoom.get(socket.id);

        if (!roomKey) return;

        activeRooms.delete(roomKey);
        socketToRoom.delete(socket.id);

        // ❌ IMPORTANT FIX:
        // DON'T STOP BROADCAST ON DISCONNECT

        console.log("⚠️ Socket disconnected but live continues:", socket.id);
      } catch (err) {
        console.log(err);
      }
    });
  });
};
