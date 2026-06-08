const broadcasters = {};
const viewers = {};

const removeRoomViewers = (roomId) => {
  Object.keys(viewers).forEach((viewerId) => {
    if (viewers[viewerId]?.roomId === roomId) {
      delete viewers[viewerId];
    }
  });
};

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    // =====================================
    // BROADCASTER START
    // =====================================
    socket.on("broadcaster", ({ roomId }) => {
      try {
        if (!roomId) return;

        broadcasters[roomId] = socket.id;

        socket.roomId = roomId;
        socket.role = "broadcaster";

        socket.join(roomId);

        console.log("===== BROADCAST START =====");
        console.log("Room:", roomId);
        console.log("Socket:", socket.id);
        console.log("Broadcasters:", broadcasters);
      } catch (err) {
        console.log("Broadcaster Error:", err);
      }
    });

    // =====================================
    // VIEWER JOIN
    // =====================================
    socket.on("viewer", ({ roomId }) => {
      try {
        console.log("===== VIEWER JOIN =====");
        console.log("Room:", roomId);

        const broadcasterId = broadcasters[roomId];

        console.log("Found Broadcaster:", broadcasterId);

        if (!broadcasterId) {
          socket.emit("broadcast-not-found");
          return;
        }

        // broadcaster khud viewer na ban jaye
        if (broadcasterId === socket.id) {
          return;
        }

        socket.roomId = roomId;
        socket.role = "viewer";

        viewers[socket.id] = {
          roomId,
          broadcasterId,
        };

        socket.join(roomId);

        console.log("Viewer Joined:", socket.id);

        io.to(broadcasterId).emit("viewer", {
          viewerId: socket.id,
        });
      } catch (err) {
        console.log("Viewer Join Error:", err);
      }
    });

    // =====================================
    // OFFER
    // =====================================
    socket.on("offer", ({ target, offer }) => {
      if (!target) return;

      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =====================================
    // ANSWER
    // =====================================
    socket.on("answer", ({ target, answer }) => {
      if (!target) return;

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
    // STOP BROADCAST
    // =====================================
    socket.on("stop-broadcast", ({ roomId }) => {
      try {
        console.log("========== STOP REQUEST ==========");
        console.log("Room:", roomId);
        console.log("From Socket:", socket.id);
        console.log("Role:", socket.role);
        console.log("Current Broadcaster:", broadcasters[roomId]);
        console.log("==================================");

        if (!roomId) return;

        if (broadcasters[roomId] !== socket.id) {
          console.log("Unauthorized stop request");
          return;
        }

        console.log("Valid stop request");

        io.to(roomId).emit("broadcast-stopped");

        delete broadcasters[roomId];

        removeRoomViewers(roomId);

        console.log(`Broadcast stopped successfully: ${roomId}`);
      } catch (err) {
        console.log("Stop Broadcast Error:", err);
      }
    });

    // =====================================
    // DISCONNECT
    // =====================================
    socket.on("disconnect", (reason) => {
      console.log("Disconnected:", socket.id, reason);

      // broadcaster disconnect
      if (socket.role === "broadcaster") {
        const roomId = socket.roomId;

        if (roomId && broadcasters[roomId] === socket.id) {
          io.to(roomId).emit("broadcast-stopped");

          delete broadcasters[roomId];

          removeRoomViewers(roomId);

          console.log(`Broadcaster disconnected: ${roomId}`);
        }
      }

      // viewer disconnect
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
