// liveAudio.js

const LiveReport = require("../models/LiveReport");

const viewers = {};
const broadcasters = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =====================================
    // BROADCASTER START
    // =====================================

    socket.on("broadcaster", async ({ roomId }, callback) => {
      try {
        const roomKey = String(roomId).trim();

        socket.roomId = roomKey;
        socket.isBroadcaster = true;

        broadcasters[roomKey] = socket.id;

        await LiveReport.findOneAndUpdate(
          { roomId: roomKey },
          {
            broadcasterSocketId: socket.id,
            status: "live",
            isLive: true,
          },
          {
            new: true,
          },
        );

        console.log("🎤 Broadcaster Started:", roomKey);

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
        const roomKey = String(roomId).trim();

        const report = await LiveReport.findOne({
          roomId: roomKey,
          status: "live",
          isLive: true,
        });

        if (!report) {
          console.log("❌ Report Not Found");
          socket.emit("broadcast-not-found");
          return;
        }

        const broadcasterSocket = io.sockets.sockets.get(
          report.broadcasterSocketId,
        );

        if (!broadcasterSocket) {
          console.log("❌ Broadcaster Socket Missing");
          socket.emit("broadcast-not-found");
          return;
        }

        socket.emit("viewer-accepted", {
          broadcasterId: report.broadcasterSocketId,
        });

        console.log("✅ Viewer Accepted:", socket.id);

        io.to(report.broadcasterSocketId).emit("viewer", {
          viewerId: socket.id,
        });

        console.log(
          "📤 Viewer Event Sent To Broadcaster:",
          report.broadcasterSocketId,
        );
      } catch (error) {
        console.log(error);
        socket.emit("broadcast-not-found");
      }
    });
    // =====================================
    // OFFER
    // =====================================

    socket.on("offer", ({ target, offer }) => {
      if (!target || !offer) return;

      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =====================================
    // ANSWER
    // =====================================

    socket.on("answer", ({ target, answer }) => {
      if (!target || !answer) return;

      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // =====================================
    // ICE CANDIDATE
    // =====================================

    socket.on("candidate", ({ target, candidate }) => {
      if (!target || !candidate) return;

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

        await LiveReport.findOneAndUpdate(
          {
            roomId: roomKey,
            status: "live",
          },
          {
            status: "completed",
            isLive: false,
            broadcasterSocketId: null,
            endTime: new Date(),
          },
        );

        Object.keys(viewers).forEach((id) => {
          if (viewers[id]?.roomId === roomKey) {
            io.to(id).emit("broadcast-stopped");
            delete viewers[id];
          }
        });

        delete broadcasters[roomKey];

        console.log("🛑 Broadcast Stopped:", roomKey);
      } catch (error) {
        console.log(error);
      }
    });

    // =====================================
    // DISCONNECT
    // =====================================

    socket.on("disconnect", async () => {
      try {
        console.log("❌ Disconnected:", socket.id);

        // VIEWER LEFT

        if (socket.isViewer) {
          const viewer = viewers[socket.id];

          if (viewer) {
            const viewerCount =
              Object.values(viewers).filter((v) => v.roomId === viewer.roomId)
                .length - 1;

            io.to(viewer.broadcasterId).emit("viewer-count", {
              count: Math.max(0, viewerCount),
            });

            delete viewers[socket.id];
          }

          return;
        }

        // BROADCASTER LEFT

        if (socket.isBroadcaster) {
          const roomKey = socket.roomId;

          setTimeout(async () => {
            const currentBroadcaster = broadcasters[roomKey];

            // reconnect ho gaya to skip
            if (currentBroadcaster !== socket.id) {
              return;
            }

            await LiveReport.findOneAndUpdate(
              {
                roomId: roomKey,
                status: "live",
              },
              {
                status: "completed",
                isLive: false,
                broadcasterSocketId: null,
                endTime: new Date(),
              },
            );

            Object.keys(viewers).forEach((id) => {
              if (viewers[id]?.roomId === roomKey) {
                io.to(id).emit("broadcast-stopped");
                delete viewers[id];
              }
            });

            delete broadcasters[roomKey];

            console.log("🎤 Broadcaster Disconnected:", roomKey);
          }, 30000); // 30 sec reconnect grace
        }
      } catch (error) {
        console.log(error);
      }
    });
  });
};
