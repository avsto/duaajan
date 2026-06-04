const LiveReport = require("../models/LiveReport");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =========================
    // BROADCASTER JOIN
    // =========================
    socket.on("broadcaster", async ({ roomId }, callback) => {
      try {
        const roomKey = String(roomId);

        socket.join(roomKey); // IMPORTANT FIX

        const report = await LiveReport.findOneAndUpdate(
          {
            roomId: roomKey,
            status: "live",
          },
          {
            $set: {
              broadcasterSocketId: socket.id,
            },
          },
          { returnDocument: "after" },
        );

        console.log("🎤 Broadcaster Set:", report);

        callback?.({ success: true });
      } catch (err) {
        console.log(err);
        callback?.({ success: false });
      }
    });

    // =========================
    // VIEWER JOIN
    // =========================
    socket.on("viewer", async ({ roomId }) => {
      try {
        const roomKey = String(roomId);

        const report = await LiveReport.findOne({
          roomId: roomKey,
          status: "live",
        });

        if (!report || !report.broadcasterSocketId) {
          socket.emit("broadcast-not-found");
          return;
        }

        socket.join(roomKey); // IMPORTANT FIX

        socket.emit("viewer-accepted", {
          broadcasterId: report.broadcasterSocketId,
        });

        io.to(report.broadcasterSocketId).emit("viewer-joined", {
          viewerId: socket.id,
        });

        console.log("👂 Viewer Joined:", socket.id);
      } catch (err) {
        console.log(err);
      }
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
    // CANDIDATE
    // =========================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // =========================
    // STOP BROADCAST
    // =========================
    socket.on("stop-broadcast", async ({ roomId }) => {
      try {
        const roomKey = String(roomId);

        const report = await LiveReport.findOneAndUpdate(
          {
            roomId: roomKey,
            status: "live",
          },
          {
            $set: {
              status: "completed",
              isLive: false,
              endTime: new Date(),
              broadcasterSocketId: null,
            },
          },
          { returnDocument: "after" },
        );

        io.to(roomKey).emit("broadcast-stopped");

        console.log("🛑 Broadcast Stopped");
      } catch (err) {
        console.log(err);
      }
    });

    // =========================
    // DISCONNECT
    // =========================
    socket.on("disconnect", async () => {
      try {
        const report = await LiveReport.findOne({
          broadcasterSocketId: socket.id,
          status: "live",
        });

        if (!report) return;

        await LiveReport.findByIdAndUpdate(report._id, {
          status: "completed",
          isLive: false,
          endTime: new Date(),
          broadcasterSocketId: null,
        });

        io.to(report.roomId).emit("broadcast-stopped");

        console.log("🎤 Broadcaster Disconnected");
      } catch (err) {
        console.log(err);
      }
    });
  });
};
