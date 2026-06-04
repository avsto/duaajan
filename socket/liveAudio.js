const INSTANCE_ID = Math.random().toString(36).substring(2, 8);

console.log(`🚀 Socket Instance Started: ${INSTANCE_ID}`);

const broadcasters = {};
const viewers = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`✅ Connected: ${socket.id}`);
    console.log(`📦 Instance: ${INSTANCE_ID}`);
    console.log(`🆔 PID: ${process.pid}`);

    // =====================================
    // BROADCASTER
    // =====================================

    socket.on("broadcaster", ({ roomId }) => {
      roomId = String(roomId);

      broadcasters[roomId] = socket.id;

      socket.join(roomId);

      console.log("==========================");
      console.log("🎤 Broadcaster Started");
      console.log("Instance:", INSTANCE_ID);
      console.log("PID:", process.pid);
      console.log("RoomId:", roomId);
      console.log("Socket:", socket.id);
      console.log("Broadcasters:", broadcasters);
      console.log("==========================");
    });

    // =====================================
    // VIEWER
    // =====================================

    socket.on("viewer", ({ roomId }) => {
      roomId = String(roomId);

      console.log("==========================");
      console.log("👂 Viewer Joined");
      console.log("Instance:", INSTANCE_ID);
      console.log("PID:", process.pid);
      console.log("RoomId:", roomId);
      console.log("Broadcasters:", broadcasters);

      const broadcasterId = broadcasters[roomId];

      console.log("Found Broadcaster:", broadcasterId);

      if (!broadcasterId) {
        console.log("❌ Broadcast Not Found");

        socket.emit("broadcast-not-found");

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

      console.log("Viewer Count:", viewers[roomId].size);

      console.log("==========================");
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

      console.log("🛑 Broadcast Stopped:", roomId);

      io.to(roomId).emit("broadcast-stopped");

      delete broadcasters[roomId];
      delete viewers[roomId];
    });

    // =====================================
    // DISCONNECT
    // =====================================

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);

      Object.keys(broadcasters).forEach((roomId) => {
        if (broadcasters[roomId] === socket.id) {
          console.log("🎤 Broadcaster Disconnected:", roomId);

          io.to(roomId).emit("broadcast-stopped");

          delete broadcasters[roomId];

          delete viewers[roomId];
        }
      });

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
    });
  });
};
