// liveAudio.js
const LiveReport = require("../models/LiveReport");

const broadcasters = {};
const viewers = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =====================================
    // BROADCASTER START
    // =====================================

    socket.on("broadcaster", async ({ roomId }, callback) => {
      try {
        const roomKey = String(roomId);

        await LiveReport.findOneAndUpdate(
          {
            roomId: roomKey,
            status: "live",
          },
          {
            broadcasterSocketId: socket.id,
          },
        );

        console.log("🎤 Broadcaster Started");
        console.log("Room:", roomKey);

        callback?.({
          success: true,
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
        const roomKey = String(roomId);

        const report = await LiveReport.findOne({
          roomId: roomKey,
          status: "live",
          isLive: true,
        });

        if (!report) {
          socket.emit("broadcast-not-found");
          return;
        }

        if (!report.broadcasterSocketId) {
          socket.emit("broadcast-not-found");
          return;
        }

        socket.emit("viewer-accepted", {
          broadcasterId: report.broadcasterSocketId,
        });

        io.to(report.broadcasterSocketId).emit("viewer", {
          viewerId: socket.id,
        });

        console.log("👂 Viewer Joined:", socket.id);
      } catch (error) {
        console.log(error);
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
    // ICE CANDIDATE
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
        const roomKey = String(roomId);

        const report = await LiveReport.findOne({
          roomId: roomKey,
          status: "live",
        });

        if (report) {
          await LiveReport.findByIdAndUpdate(report._id, {
            status: "completed",
            isLive: false,
            endTime: new Date(),
            broadcasterSocketId: null,
            duration: Math.floor(
              (Date.now() - report.startTime.getTime()) / 1000,
            ),
          });
        }

        io.to(roomKey).emit("broadcast-stopped");

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
          endTime: new Date(),
          broadcasterSocketId: null,
          duration: Math.floor(
            (Date.now() - report.startTime.getTime()) / 1000,
          ),
        });

        io.to(report.roomId).emit("broadcast-stopped");

        console.log("🎤 Broadcaster Disconnected");
      } catch (error) {
        console.log(error);
      }
    });
  });
};
