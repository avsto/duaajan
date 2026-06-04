// liveAudio.js

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

        console.log("=================================");
        console.log("🎤 Broadcaster Started");
        console.log("Room:", roomKey);
        console.log("Socket:", socket.id);
        console.log("=================================");

        callback?.({
          success: true,
        });
      } catch (error) {
        console.log(error);

        callback?.({
          success: false,
          message: error.message,
        });
      }
    });

    // =====================================
    // VIEWER JOIN
    // =====================================

    socket.on("viewer", ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        const broadcasterId = broadcasters[roomKey];

        console.log("=================================");
        console.log("👂 Viewer Joined");
        console.log("Room:", roomKey);
        console.log("Socket:", socket.id);
        console.log("Broadcaster:", broadcasterId);
        console.log("=================================");

        if (!broadcasterId) {
          socket.emit("broadcast-not-found");
          return;
        }

        socket.join(roomKey);

        if (!viewers[roomKey]) {
          viewers[roomKey] = new Set();
        }

        viewers[roomKey].add(socket.id);

        socket.emit("viewer-accepted", {
          broadcasterId,
        });

        io.to(broadcasterId).emit("viewer", {
          viewerId: socket.id,
        });

        io.to(broadcasterId).emit("viewer-count", {
          count: viewers[roomKey].size,
        });

        console.log("📊 Viewer Count:", viewers[roomKey].size);
      } catch (error) {
        console.log(error);
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
    // ICE CANDIDATE
    // =====================================

    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =====================================
    // STOP BROADCAST
    // =====================================

    socket.on("stop-broadcast", ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        console.log("🛑 Broadcast Stopped:", roomKey);

        io.to(roomKey).emit("broadcast-stopped");

        delete broadcasters[roomKey];
        delete viewers[roomKey];
      } catch (error) {
        console.log(error);
      }
    });

    // =====================================
    // DISCONNECT
    // =====================================

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);

      // Broadcaster disconnected

      Object.keys(broadcasters).forEach((roomKey) => {
        if (broadcasters[roomKey] === socket.id) {
          console.log("🎤 Broadcaster Disconnected:", roomKey);

          io.to(roomKey).emit("broadcast-stopped");

          delete broadcasters[roomKey];
          delete viewers[roomKey];
        }
      });

      // Viewer disconnected

      Object.keys(viewers).forEach((roomKey) => {
        if (viewers[roomKey]?.has(socket.id)) {
          viewers[roomKey].delete(socket.id);

          const broadcasterId = broadcasters[roomKey];

          if (broadcasterId) {
            io.to(broadcasterId).emit("viewer-count", {
              count: viewers[roomKey].size,
            });
          }

          console.log(
            "📉 Viewer Left:",
            socket.id,
            "Count:",
            viewers[roomKey].size,
          );
        }
      });
    });
  });
};
