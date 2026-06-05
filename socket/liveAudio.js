// liveAudio.js

const broadcasters = {};
const viewers = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    // =====================================
    // BROADCASTER
    // =====================================

    socket.on("broadcaster", ({ roomId }) => {
      broadcasters[roomId] = socket.id;

      socket.join(roomId);

      console.log(`Broadcaster ${socket.id} started room ${roomId}`);

      socket.to(roomId).emit("broadcaster");
    });

    // =====================================
    // LISTENER
    // =====================================

    socket.on("listener", ({ roomId }) => {
      const broadcasterId = broadcasters[roomId];

      if (!broadcasterId) {
        socket.emit("broadcast-ended");
        return;
      }

      socket.join(roomId);

      viewers[socket.id] = {
        roomId,
      };

      io.to(broadcasterId).emit("listener", socket.id);
    });

    // =====================================
    // OFFER
    // =====================================

    socket.on("offer", (id, description) => {
      io.to(id).emit("offer", socket.id, description);
    });

    // =====================================
    // ANSWER
    // =====================================

    socket.on("answer", (id, description) => {
      io.to(id).emit("answer", socket.id, description);
    });

    // =====================================
    // ICE
    // =====================================

    socket.on("candidate", (id, candidate) => {
      io.to(id).emit("candidate", socket.id, candidate);
    });

    // =====================================
    // DISCONNECT
    // =====================================

    socket.on("disconnect", () => {
      const roomId = viewers[socket.id]?.roomId;

      delete viewers[socket.id];

      if (roomId) {
        const broadcasterId = broadcasters[roomId];

        if (broadcasterId) {
          io.to(broadcasterId).emit("disconnectPeer", socket.id);
        }
      }

      Object.keys(broadcasters).forEach((room) => {
        if (broadcasters[room] === socket.id) {
          delete broadcasters[room];

          io.to(room).emit("broadcast-ended");

          console.log(`Broadcast ended: ${room}`);
        }
      });
    });
  });
};
