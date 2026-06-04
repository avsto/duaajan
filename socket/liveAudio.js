const broadcasters = {};
const viewers = {};
const pendingViewers = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =====================================
    // BROADCASTER START
    // =====================================

    socket.on("broadcaster", ({ roomId }) => {
      roomId = String(roomId);

      broadcasters[roomId] = socket.id;

      socket.join(roomId);

      console.log("🎤 Broadcaster Started");
      console.log("Room:", roomId);

      // Connect waiting viewers
      if (pendingViewers[roomId] && pendingViewers[roomId].length) {
        console.log(
          `Connecting ${pendingViewers[roomId].length} waiting viewers`,
        );

        pendingViewers[roomId].forEach((viewerId) => {
          io.to(viewerId).emit("viewer-accepted", {
            broadcasterId: socket.id,
          });

          io.to(socket.id).emit("viewer", {
            viewerId,
          });
        });

        delete pendingViewers[roomId];
      }
    });

    // =====================================
    // VIEWER JOIN
    // =====================================

    socket.on("viewer", ({ roomId }) => {
      roomId = String(roomId);

      const broadcasterId = broadcasters[roomId];

      console.log("👂 Viewer Joined:", roomId);

      // broadcaster not ready
      if (!broadcasterId) {
        console.log("⏳ Broadcaster Not Ready");

        if (!pendingViewers[roomId]) {
          pendingViewers[roomId] = [];
        }

        if (!pendingViewers[roomId].includes(socket.id)) {
          pendingViewers[roomId].push(socket.id);
        }

        return;
      }

      socket.join(roomId);

      if (!viewers[roomId]) {
        viewers[roomId] = new Set();
      }

      viewers[roomId].add(socket.id);

      socket.emit("viewer-accepted", {
        broadcasterId,
      });

      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });

      io.to(broadcasterId).emit("viewer-count", {
        count: viewers[roomId].size,
      });
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
    // STOP
    // =====================================

    socket.on("stop-broadcast", ({ roomId }) => {
      roomId = String(roomId);

      io.to(roomId).emit("broadcast-stopped");

      delete broadcasters[roomId];
      delete viewers[roomId];
      delete pendingViewers[roomId];
    });

    // =====================================
    // DISCONNECT
    // =====================================

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);

      // broadcaster disconnect

      Object.keys(broadcasters).forEach((roomId) => {
        if (broadcasters[roomId] === socket.id) {
          io.to(roomId).emit("broadcast-stopped");

          delete broadcasters[roomId];
          delete viewers[roomId];
          delete pendingViewers[roomId];
        }
      });

      // viewer disconnect

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

      // remove pending viewer

      Object.keys(pendingViewers).forEach((roomId) => {
        pendingViewers[roomId] = pendingViewers[roomId].filter(
          (id) => id !== socket.id,
        );
      });
    });
  });
};
