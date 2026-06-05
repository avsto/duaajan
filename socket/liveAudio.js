const LiveReport = require("../models/LiveReport");

const broadcasters = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =========================
    // BROADCASTER
    // =========================

    socket.on("broadcaster", async ({ roomId }, callback) => {
      try {
        const roomKey = String(roomId).trim();

        broadcasters[roomKey] = socket.id;

        await LiveReport.findOneAndUpdate(
          { roomId: roomKey },
          {
            broadcasterSocketId: socket.id,
            status: "live",
            isLive: true,
          },
        );

        console.log("🎤 Broadcaster Started");
        console.log("Room:", roomKey);
        console.log("Socket:", socket.id);

        callback?.({ success: true });
      } catch (err) {
        console.log(err);
        callback?.({ success: false });
      }
    });

    // =========================
    // VIEWER
    // =========================

    socket.on("viewer", ({ roomId }) => {
      const roomKey = String(roomId).trim();

      const broadcasterId = broadcasters[roomKey];

      console.log("👂 Viewer Request:", roomKey);
      console.log("Broadcaster:", broadcasterId);

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

      console.log("✅ Viewer Accepted:", socket.id);
    });

    // =========================
    // OFFER
    // =========================

    socket.on("offer", ({ target, offer }) => {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =========================
    // ANSWER
    // =========================

    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // =========================
    // ICE
    // =========================

    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =========================
    // STOP
    // =========================

    socket.on("stop-broadcast", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        delete broadcasters[roomKey];

        await LiveReport.findOneAndUpdate(
          { roomId: roomKey },
          {
            status: "completed",
            isLive: false,
            broadcasterSocketId: null,
            endTime: new Date(),
          },
        );

        io.emit(`broadcast-stopped-${roomKey}`);

        console.log("🛑 Broadcast Stopped");
      } catch (err) {
        console.log(err);
      }
    });

    // =========================
    // DISCONNECT
    // =========================

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);

      Object.keys(broadcasters).forEach((roomId) => {
        if (broadcasters[roomId] === socket.id) {
          delete broadcasters[roomId];

          io.emit(`broadcast-stopped-${roomId}`);

          console.log("🎤 Broadcaster Disconnected:", roomId);
        }
      });
    });
  });
};
