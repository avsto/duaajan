const broadcasters = {};
const viewers = {};

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    // ==========================
    // BROADCASTER START
    // ==========================
    socket.on("broadcaster", ({ roomId }) => {
      broadcasters[roomId] = socket.id;

      console.log("===== BROADCAST START =====");
      console.log("Room:", roomId);
      console.log("Socket:", socket.id);
      console.log("Broadcasters:", broadcasters);

      socket.roomId = roomId;
      socket.role = "broadcaster";

      socket.join(roomId);

      console.log(`Broadcaster Started: ${roomId}`);
    });

    // ==========================
    // VIEWER JOIN
    // ==========================
    socket.on("viewer", ({ roomId }) => {
      console.log("===== VIEWER JOIN =====");
      console.log("Room:", roomId);
      console.log("Broadcasters:", broadcasters);

      const broadcasterId = broadcasters[roomId];

      console.log("Found Broadcaster:", broadcasterId);

      if (!broadcasterId) {
        socket.emit("broadcast-not-found");
        return;
      }

      socket.roomId = roomId;
      socket.role = "viewer";

      viewers[socket.id] = {
        roomId,
        broadcasterId,
      };

      socket.join(roomId);

      console.log(`Viewer Joined: ${socket.id}`);

      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });
    });

    // ==========================
    // OFFER
    // ==========================
    socket.on("offer", ({ target, offer }) => {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // ==========================
    // ANSWER
    // ==========================
    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // ==========================
    // ICE CANDIDATE
    // ==========================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // ==========================
    // STOP BROADCAST
    // ==========================
    socket.on("stop-broadcast", ({ roomId }) => {
      console.log(`Broadcast Stopped: ${roomId}`);

      io.to(roomId).emit("broadcast-stopped");

      delete broadcasters[roomId];

      Object.keys(viewers).forEach((viewerId) => {
        if (viewers[viewerId]?.roomId === roomId) {
          delete viewers[viewerId];
        }
      });
    });

    // ==========================
    // DISCONNECT
    // ==========================
    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);

      // Broadcaster disconnected
      if (socket.role === "broadcaster") {
        const roomId = socket.roomId;

        if (roomId && broadcasters[roomId] === socket.id) {
          io.to(roomId).emit("broadcast-stopped");

          delete broadcasters[roomId];

          Object.keys(viewers).forEach((viewerId) => {
            if (viewers[viewerId]?.roomId === roomId) {
              delete viewers[viewerId];
            }
          });

          console.log(`Broadcaster disconnected: ${roomId}`);
        }
      }

      // Viewer disconnected
      if (socket.role === "viewer") {
        delete viewers[socket.id];

        console.log(`Viewer disconnected: ${socket.id}`);
      }
    });
  });
};

module.exports = {
  initWebRTCSignaling,
};
