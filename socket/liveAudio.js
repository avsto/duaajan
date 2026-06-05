const broadcasters = {};
const listeners = {};

io.on("connection", (socket) => {
  socket.on("broadcaster", ({ roomId }) => {
    broadcasters[roomId] = socket.id;
  });

  socket.on("join-listener", ({ roomId }) => {
    listeners[socket.id] = roomId;

    const broadcasterId = broadcasters[roomId];

    if (broadcasterId) {
      io.to(broadcasterId).emit("new-listener", socket.id);
    }
  });

  socket.on("offer", (data) => {
    io.to(data.listenerId).emit("offer", data.offer);
  });

  socket.on("answer", (data) => {
    const roomId = listeners[socket.id];

    const broadcasterId = broadcasters[roomId];

    if (broadcasterId) {
      io.to(broadcasterId).emit("answer", {
        listenerId: socket.id,
        answer: data.answer,
      });
    }
  });

  socket.on("broadcaster-candidate", (data) => {
    io.to(data.listenerId).emit("candidate", data.candidate);
  });

  socket.on("listener-candidate", (data) => {
    const roomId = listeners[socket.id];

    const broadcasterId = broadcasters[roomId];

    if (broadcasterId) {
      io.to(broadcasterId).emit("listener-candidate", {
        listenerId: socket.id,
        candidate: data.candidate,
      });
    }
  });

  socket.on("disconnect", () => {
    delete listeners[socket.id];
  });
});
