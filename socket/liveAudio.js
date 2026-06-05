const LiveReport = require("../models/LiveReport");
const redis = require("../redis"); // 🔥 Redis REQUIRED

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

        // 🔥 SAVE LIVE STATE IN REDIS (IMPORTANT)
        await redis.set(
          `live:${roomKey}`,
          socket.id,
          "EX",
          60 * 60 * 6, // 6 hours
        );

        // optional DB update (history purpose)
        await LiveReport.findOneAndUpdate(
          { roomId: roomKey, status: "live" },
          {
            $set: {
              broadcasterSocketId: socket.id,
            },
          },
          { new: true },
        );

        console.log("🎤 Broadcaster Ready:", roomKey);

        cb?.({ success: true });
      } catch (err) {
        console.log("Broadcaster Error:", err);
        cb?.({ success: false });
      }
    });

    // =====================================
    // VIEWER JOIN (SAFE + RECONNECT FIX)
    // =====================================
    socket.on("viewer", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        // 🔥 GET FROM REDIS (NOT MEMORY)
        const broadcasterSocketId = await redis.get(`live:${roomKey}`);

        if (!broadcasterSocketId) {
          console.log("❌ No live stream found");
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
    // OFFER (Broadcaster → Viewer)
    // =====================================
    socket.on("offer", ({ target, offer }) => {
      if (!target || !offer) return;

      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =====================================
    // ANSWER (Viewer → Broadcaster)
    // =====================================
    socket.on("answer", ({ target, answer }) => {
      if (!target || !answer) return;

      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // =====================================
    // ICE CANDIDATE
    // =====================================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target || !candidate) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =====================================
    // STOP BROADCAST (ONLY MANUAL)
    // =====================================
    socket.on("stop-broadcast", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        // 🔥 REMOVE REDIS STATE
        await redis.del(`live:${roomKey}`);

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
    // DISCONNECT (NO AUTO STOP)
    // =====================================
    socket.on("disconnect", async () => {
      try {
        console.log("❌ Disconnected:", socket.id);

        // ❗ IMPORTANT: DO NOT STOP LIVE ON DISCONNECT
        // only log it
      } catch (err) {
        console.log("Disconnect Error:", err);
      }
    });
  });
};
