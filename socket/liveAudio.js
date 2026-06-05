const LiveReport = require("../models/LiveReport");

module.exports = (io) => {
  const activeRooms = new Map();
  const socketToRoom = new Map();

  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =========================
    // BROADCASTER JOIN
    // =========================
    socket.on("broadcaster", async ({ roomId }, callback) => {
      try {
        const roomKey = String(roomId).trim();

        socket.join(roomKey);

        // store active broadcaster
        activeRooms.set(roomKey, socket.id);
        socketToRoom.set(socket.id, roomKey);

        // optional DB update (history only)
        await LiveReport.findOneAndUpdate(
          {
            roomId: roomKey,
            status: "live",
          },
          {
            $set: {
              broadcasterSocketId: socket.id,
            },
          },
        );

        console.log("🎤 Broadcaster Ready:", roomKey);

        callback?.({ success: true });
      } catch (err) {
        console.log("Broadcaster Error:", err);
        callback?.({ success: false });
      }
    });

    // =========================
    // VIEWER JOIN (FIXED + SAFE)
    // =========================
    socket.on("viewer", ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        const broadcasterSocketId = activeRooms.get(roomKey);

        // ❌ broadcaster not ready
        if (!broadcasterSocketId) {
          socket.emit("broadcast-not-found");
          return;
        }

        socket.join(roomKey);

        // send broadcaster id to viewer
        socket.emit("viewer-accepted", {
          broadcasterId: broadcasterSocketId,
        });

        // notify broadcaster (room based - stable)
        io.to(roomKey).emit("viewer-joined", {
          viewerId: socket.id,
        });

        console.log("👂 Viewer Joined:", socket.id);
      } catch (err) {
        console.log("Viewer Error:", err);
      }
    });

    // =========================
    // OFFER (Broadcaster -> Viewer)
    // =========================
    socket.on("offer", ({ target, offer }) => {
      if (!target || !offer) return;

      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =========================
    // ANSWER (Viewer -> Broadcaster)
    // =========================
    socket.on("answer", ({ target, answer }) => {
      if (!target || !answer) return;

      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // =========================
    // ICE CANDIDATE
    // =========================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target || !candidate) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =========================
    // STOP BROADCAST
    // =========================
    socket.on("stop-broadcast", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        activeRooms.delete(roomKey);

        await LiveReport.findOneAndUpdate(
          {
            roomId: roomKey,
            status: "live",
          },
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

    // =========================
    // DISCONNECT (SAFE CLEANUP)
    // =========================
    socket.on("disconnect", async () => {
      try {
        console.log("❌ Disconnected:", socket.id);

        const roomKey = socketToRoom.get(socket.id);

        if (roomKey) {
          activeRooms.delete(roomKey);
          socketToRoom.delete(socket.id);

          await LiveReport.findOneAndUpdate(
            {
              roomId: roomKey,
              status: "live",
            },
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

          console.log("🎤 Broadcaster auto-stopped:", roomKey);
        }
      } catch (err) {
        console.log("Disconnect Error:", err);
      }
    });
  });
};
