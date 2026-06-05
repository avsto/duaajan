const LiveReport = require("../models/LiveReport");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =====================================
    // BROADCASTER
    // =====================================

    socket.on("broadcaster", async ({ roomId }, callback) => {
      try {
        const roomKey = String(roomId).trim();

        const report = await LiveReport.findOneAndUpdate(
          {
            roomId: roomKey,
          },
          {
            broadcasterSocketId: socket.id,
            status: "live",
            isLive: true,
          },
          {
            new: true,
          },
        );

        console.log("🎤 Broadcaster Started");
        console.log("Room:", roomKey);
        console.log("Socket:", socket.id);

        callback?.({
          success: !!report,
        });
      } catch (error) {
        console.log(error);

        callback?.({
          success: false,
        });
      }
    });

    // =====================================
    // VIEWER JOIN
    // =====================================

    socket.on("viewer", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        const report = await LiveReport.findOne({
          roomId: roomKey,
          status: "live",
          isLive: true,
        });

        console.log("👂 Viewer Request:", roomKey);

        if (!report) {
          console.log("❌ Report Not Found");

          socket.emit("broadcast-not-found");
          return;
        }

        if (!report.broadcasterSocketId) {
          console.log("❌ Broadcaster Socket Missing");

          socket.emit("broadcast-not-found");
          return;
        }

        socket.emit("viewer-accepted", {
          broadcasterId: report.broadcasterSocketId,
        });

        io.to(report.broadcasterSocketId).emit("viewer", {
          viewerId: socket.id,
        });

        console.log("✅ Viewer Accepted:", socket.id);
      } catch (error) {
        console.log(error);

        socket.emit("broadcast-not-found");
      }
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
    // STOP BROADCAST
    // =====================================

    socket.on("stop-broadcast", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        const report = await LiveReport.findOne({
          roomId: roomKey,
          status: "live",
        });

        if (report) {
          await LiveReport.findByIdAndUpdate(report._id, {
            status: "completed",
            isLive: false,
            broadcasterSocketId: null,
            endTime: new Date(),
            duration: report.startTime
              ? Math.floor((Date.now() - report.startTime.getTime()) / 1000)
              : 0,
          });
        }

        io.emit(`broadcast-stopped-${roomKey}`);

        console.log("🛑 Broadcast Stopped");
      } catch (error) {
        console.log(error);
      }
    });

    // =====================================
    // DISCONNECT
    // =====================================

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
          broadcasterSocketId: null,
          endTime: new Date(),
          duration: report.startTime
            ? Math.floor((Date.now() - report.startTime.getTime()) / 1000)
            : 0,
        });

        io.emit(`broadcast-stopped-${report.roomId}`);

        console.log("🎤 Broadcaster Disconnected");
      } catch (error) {
        console.log(error);
      }
    });
  });
};
