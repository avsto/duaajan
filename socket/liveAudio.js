const broadcasters = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    // Broadcaster Start
    socket.on("broadcaster", ({ roomId }) => {
      broadcasters[roomId] = socket.id;

      socket.join(roomId);

      console.log("Broadcaster Started:", roomId);
    });

    // Viewer Join
    socket.on("viewer", ({ roomId }) => {
      const broadcasterId = broadcasters[roomId];

      console.log("Viewer Joined:", roomId);

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

    // Offer
    socket.on("offer", ({ target, offer }) => {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // Answer
    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // ICE
    socket.on("candidate", ({ target, candidate }) => {
      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // Stop
    socket.on("stop-broadcast", ({ roomId }) => {
      io.to(roomId).emit("broadcast-stopped");

      delete broadcasters[roomId];
    });

    socket.on("disconnect", () => {
      for (const roomId in broadcasters) {
        if (broadcasters[roomId] === socket.id) {
          io.to(roomId).emit("broadcast-stopped");

          delete broadcasters[roomId];
        }
      }
    });
  });
};
