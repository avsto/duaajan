const broadcasters = {};
const viewers = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =====================================
    // MASJID START LIVE
    // =====================================

    socket.on("broadcaster", ({ roomId }) => {
      roomId = String(roomId);

      broadcasters[roomId] = socket.id;

      console.log("🎤 Broadcaster Started");
      console.log("RoomId:", roomId);
      console.log("Socket:", socket.id);
      console.log("Broadcasters:", broadcasters);
    });

    socket.on("viewer", ({ roomId }) => {
      roomId = String(roomId);

      console.log("👂 Viewer Joined");
      console.log("RoomId:", roomId);
      console.log("Broadcasters:", broadcasters);

      const broadcasterId = broadcasters[roomId];

      console.log("Found Broadcaster:", broadcasterId);

      if (!broadcasterId) {
        socket.emit("broadcast-not-found");
        return;
      }

      socket.emit("viewer-accepted", {
        broadcasterId,
      });

      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });
    });

    // =====================================
    // USER JOIN LIVE
    // =====================================

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
    // ICE
    // =====================================

    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =====================================
    // STOP LIVE
    // =====================================

    socket.on("stop-broadcast", ({ roomId }) => {
      roomId = String(roomId);

      console.log("🛑 Broadcast Stopped:", roomId);

      io.to(roomId).emit("broadcast-stopped");

      delete broadcasters[roomId];
      delete viewers[roomId];
    });

    // =====================================
    // DISCONNECT
    // =====================================

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);

      // broadcaster disconnected

      Object.keys(broadcasters).forEach((roomId) => {
        if (broadcasters[roomId] === socket.id) {
          console.log("🎤 Broadcaster Disconnected:", roomId);

          io.to(roomId).emit("broadcast-stopped");

          delete broadcasters[roomId];
          delete viewers[roomId];
        }
      });

      // viewer disconnected

      Object.keys(viewers).forEach((roomId) => {
        if (viewers[roomId]?.has(socket.id)) {
          viewers[roomId].delete(socket.id);

          const broadcasterId = broadcasters[roomId];

          if (broadcasterId) {
            io.to(broadcasterId).emit("viewer-count", {
              count: viewers[roomId].size,
            });
          }
        }
      });
    });
  });
};
