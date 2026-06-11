const broadcasters = new Map();
const viewers = new Map();

module.exports = io => {
  io.on('connection', socket => {

    socket.on('broadcaster', ({ roomId }) => {
      broadcasters.set(roomId, socket.id);

      socket.join(roomId);
      socket.roomId = roomId;

      socket.emit('broadcast-ready');
    });

    socket.on('viewer', ({ roomId }) => {
      const broadcasterId = broadcasters.get(roomId);

      if (!broadcasterId) {
        socket.emit('broadcast-not-found');
        return;
      }

      viewers.set(socket.id, { roomId, broadcasterId });

      socket.join(roomId);

      io.to(broadcasterId).emit('viewer', {
        viewerId: socket.id,
      });
    });

    socket.on('offer', ({ target, offer }) => {
      io.to(target).emit('offer', {
        sender: socket.id,
        offer,
      });
    });

    socket.on('answer', ({ target, answer }) => {
      io.to(target).emit('answer', {
        sender: socket.id,
        answer,
      });
    });

    socket.on('candidate', ({ target, candidate }) => {
      io.to(target).emit('candidate', {
        sender: socket.id,
        candidate,
      });
    });

    socket.on('stop-broadcast', ({ roomId }) => {
      io.to(roomId).emit('broadcast-stopped');
      broadcasters.delete(roomId);
    });

    socket.on('disconnect', () => {
      viewers.delete(socket.id);

      for (const [room, id] of broadcasters.entries()) {
        if (id === socket.id) {
          broadcasters.delete(room);
          io.to(room).emit('broadcast-stopped');
        }
      }
    });
  });
};