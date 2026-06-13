// webrtcSignaling.js

module.exports.initWebRTCSignaling = (io, redis) => {
  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    // =========================
    // BROADCASTER
    // =========================
    socket.on("broadcaster", async ({ roomId }) => {
      if (!roomId) return;

      await redis.hSet(`broadcast:${roomId}`, {
        socketId: socket.id,
        ready: "1",
        ts: Date.now(),
      });

      socket.roomId = roomId;
      socket.role = "broadcaster";

      socket.join(roomId);

      socket.emit("broadcast-ready", { roomId });

      console.log("🎙 Broadcaster Ready:", roomId);
    });

    // =========================
    // VIEWER (MULTIPLE SUPPORT)
    // =========================
    socket.on("viewer", async ({ roomId }) => {
      if (!roomId) return;

      console.log("\n========== VIEWER JOIN ==========");
      console.log("Room:", roomId);
      console.log("Viewer:", socket.id);

      const broadcaster = await redis.hGetAll(`broadcast:${roomId}`);

      if (!broadcaster || !broadcaster.socketId) {
        socket.emit("broadcast-not-found");
        console.log("⏳ No broadcaster");
        return;
      }

      socket.roomId = roomId;
      socket.role = "viewer";

      socket.join(roomId);

      io.to(broadcaster.socketId).emit("viewer", {
        viewerId: socket.id,
      });

      console.log("👤 Viewer Added:", socket.id);
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
    // ICE CANDIDATE
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
    socket.on("stop-broadcast", async ({ roomId }) => {
      io.to(roomId).emit("broadcast-stopped");
      await redis.del(`broadcast:${roomId}`);
    });

    // =========================
    // DISCONNECT FIXED
    // =========================
    socket.on("disconnect", async () => {
      console.log("🔴 Disconnected:", socket.id);

      if (socket.role === "broadcaster") {
        setTimeout(async () => {
          const data = await redis.hGetAll(`broadcast:${socket.roomId}`);

          if (data?.socketId === socket.id) {
            io.to(socket.roomId).emit("broadcast-stopped");

            await redis.del(`broadcast:${socket.roomId}`);

            console.log("🛑 Broadcast ended");
          }
        }, 30000);
      }

      if (socket.role === "viewer") {
        io.to(socket.roomId).emit("viewer-disconnected", {
          viewerId: socket.id,
        });
      }
    });
  });
};
