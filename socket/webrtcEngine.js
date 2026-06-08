const broadcasters = {};

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    // START BROADCAST
    socket.on("broadcaster", ({ roomId }) => {
      broadcasters[roomId] = socket.id;

      socket.join(roomId);

      console.log("Broadcaster Started:", roomId);
    });

    // VIEWER JOIN
    socket.on("viewer", ({ roomId }) => {
      socket.join(roomId);

      console.log("Viewer Joined:", socket.id);

      const broadcasterId = broadcasters[roomId];

      if (broadcasterId) {
        io.to(broadcasterId).emit("viewer", {
          viewerId: socket.id,
        });
      } else {
        socket.emit("broadcast-not-found");
      }
    });

    // OFFER
    socket.on("offer", ({ target, offer }) => {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // ANSWER
    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // ICE CANDIDATE
    socket.on("candidate", ({ target, candidate }) => {
      if (target) {
        io.to(target).emit("candidate", {
          sender: socket.id,
          candidate,
        });
      }
    });

    // STOP BROADCAST
    socket.on("stop-broadcast", ({ roomId }) => {
      console.log("Broadcast Stopped:", roomId);

      io.to(roomId).emit("broadcast-stopped");

      delete broadcasters[roomId];
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);

      for (const roomId in broadcasters) {
        if (broadcasters[roomId] === socket.id) {
          io.to(roomId).emit("broadcast-stopped");

          delete broadcasters[roomId];

          console.log(`Broadcaster disconnected: ${roomId}`);
        }
      }
    });
  });
};

module.exports = {
  initWebRTCSignaling,
};
