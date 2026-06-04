const broadcasters = {};
const viewers = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =====================================
    // BROADCASTER START
    // =====================================

    socket.on("broadcaster", ({ roomId }, callback) => {
      try {
        const roomKey = String(roomId).trim();

        broadcasters[roomKey] = socket.id;

        socket.join(roomKey);

        if (!viewers[roomKey]) {
          viewers[roomKey] = new Set();
        }

        console.log("🎤 Broadcaster Started");
        console.log("Room:", roomKey);
        console.log("Socket:", socket.id);

        callback?.({
          success: true,
        });
      } catch (error) {
        console.log(error);

        callback?.({
          success: false,
        });
      }
    });

    // =====================================
    // VIEWER JOIN
    // =====================================

    socket.on("viewer", ({ roomId }) => {
      const roomKey = String(roomId).trim();

      const broadcasterId = broadcasters[roomKey];

      console.log("👂 Viewer Joined:", roomKey);

      if (!broadcasterId) {
        socket.emit("broadcast-not-found");
        return;
      }

      if (!viewers[roomKey]) {
        viewers[roomKey] = new Set();
      }

      // duplicate join avoid
      viewers[roomKey].add(socket.id);

      socket.join(roomKey);

      socket.emit("viewer-accepted", {
        broadcasterId,
      });

      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });

      io.to(broadcasterId).emit("viewer-count", {
        count: viewers[roomKey].size,
      });

      console.log("Viewer Count:", viewers[roomKey].size);
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
      const roomKey = String(roomId).trim();

      console.log("🛑 Broadcast Stopped:", roomKey);

      io.to(roomKey).emit("broadcast-stopped");

      delete broadcasters[roomKey];

      delete viewers[roomKey];
    });

    // =====================================
    // DISCONNECT
    // =====================================

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);

      // broadcaster disconnect

      Object.keys(broadcasters).forEach((roomKey) => {
        if (broadcasters[roomKey] === socket.id) {
          console.log("🎤 Broadcaster Disconnected:", roomKey);

          io.to(roomKey).emit("broadcast-stopped");

          delete broadcasters[roomKey];

          delete viewers[roomKey];
        }
      });

      // viewer disconnect

      Object.keys(viewers).forEach((roomKey) => {
        if (viewers[roomKey]?.has(socket.id)) {
          viewers[roomKey].delete(socket.id);

          // cleanup empty room

          if (viewers[roomKey].size === 0) {
            delete viewers[roomKey];
          }

          const broadcasterId = broadcasters[roomKey];

          if (broadcasterId) {
            io.to(broadcasterId).emit("viewer-count", {
              count: viewers[roomKey]?.size || 0,
            });
          }
        }
      });
    });
  });
};
