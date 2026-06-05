const LiveReport = require("../models/LiveReport");

module.exports = (io) => {
  // store live rooms in memory
  const activeRooms = new Map();
  // roomId -> broadcasterSocketId

  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =========================
    // BROADCASTER JOIN
    // =========================
    socket.on("broadcaster", async ({ roomId }, callback) => {
      try {
        const roomKey = String(roomId).trim();

        socket.join(roomKey);

        // store in memory (IMPORTANT FIX)
        activeRooms.set(roomKey, socket.id);

        // optional DB update (history only)
        const report = await LiveReport.findOneAndUpdate(
          {
            roomId: roomKey,
            status: "live",
          },
          {
            $set: {
              broadcasterSocketId: socket.id,
            },
          },
          { new: true },
        );

        console.log("🎤 Broadcaster Set:", report);

        callback?.({ success: true });
      } catch (err) {
        console.log("Broadcaster Error:", err);
        callback?.({ success: false });
      }
    });

    // =========================
    // VIEWER JOIN
    // =========================
    socket.on("viewer", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        const broadcasterSocketId = activeRooms.get(roomKey);

        // ❌ NOT FOUND
        if (!broadcasterSocketId) {
          socket.emit("broadcast-not-found");
          return;
        }

        socket.join(roomKey);

        // send broadcaster id to viewer
        socket.emit("viewer-accepted", {
          broadcasterId: broadcasterSocketId,
        });

        // notify broadcaster (ROOM BASED FIX)
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
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =========================
    // ANSWER (Viewer -> Broadcaster)
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
      if (!target) return;

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

        console.log("🛑 Broadcast Stopped");
      } catch (err) {
        console.log("Stop Error:", err);
      }
    });

    // =========================
    // DISCONNECT
    // =========================
    socket.on("disconnect", async () => {
      try {
        console.log("❌ Disconnected:", socket.id);

        // find room from memory
        let roomToDelete = null;

        for (const [roomId, sockId] of activeRooms.entries()) {
          if (sockId === socket.id) {
            roomToDelete = roomId;
            break;
          }
        }

        if (roomToDelete) {
          activeRooms.delete(roomToDelete);

          await LiveReport.findOneAndUpdate(
            {
              roomId: roomToDelete,
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

          io.to(roomToDelete).emit("broadcast-stopped");

          console.log("🎤 Broadcaster auto-stopped");
        }
      } catch (err) {
        console.log("Disconnect Error:", err);
      }
    });
  });
};
