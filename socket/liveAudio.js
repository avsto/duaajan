const LiveReport = require("../models/LiveReport");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Connected:", socket.id);

    // =====================================
    // BROADCASTER JOIN
    // =====================================
    socket.on("broadcaster", async ({ roomId }, cb) => {
      try {
        const roomKey = String(roomId).trim();

        socket.join(roomKey);

        // SAVE IN DB (SOURCE OF TRUTH)
        const report = await LiveReport.findOneAndUpdate(
          { roomId: roomKey, status: "live" },
          {
            $set: {
              broadcasterSocketId: socket.id,
            },
          },
          { new: true },
        );

        console.log("🎤 Broadcaster Ready:", roomKey, socket.id);

        cb?.({ success: true });
      } catch (err) {
        console.log("Broadcaster Error:", err);
        cb?.({ success: false });
      }
    });

    // =====================================
    // VIEWER JOIN (FIXED RELIABLE)
    // =====================================
    socket.on("viewer", async ({ roomId }) => {
      try {
        const roomKey = String(roomId).trim();

        // 🔥 WAIT UNTIL DB IS READY (IMPORTANT FIX)
        let report = null;

        for (let i = 0; i < 5; i++) {
          report = await LiveReport.findOne({
            roomId: roomKey,
            status: "live",
          });

          if (report?.broadcasterSocketId) break;

          await new Promise((r) => setTimeout(r, 300));
        }

        if (!report || !report.broadcasterSocketId) {
          console.log("❌ No broadcaster found (DB)");
          socket.emit("broadcast-not-found");
          return;
        }

        socket.join(roomKey);

        socket.emit("viewer-accepted", {
          broadcasterId: report.broadcasterSocketId,
        });

        io.to(report.broadcasterSocketId).emit("viewer-joined", {
          viewerId: socket.id,
        });

        console.log("👂 Viewer Joined:", socket.id);
      } catch (err) {
        console.log("Viewer Error:", err);
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
    // CANDIDATE
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
          { roomId: roomKey, status: "live" },
          {
            $set: {
              status: "completed",
              isLive: false,
              endTime: new Date(),
              broadcasterSocketId: null,
            },
          },
        );

        io.to(roomKey).emit("broadcast-stopped");

        console.log("🛑 Broadcast Stopped");
      } catch (err) {
        console.log("Stop Error:", err);
      }
    });

    // =====================================
    // DISCONNECT (SAFE)
    // =====================================
    socket.on("disconnect", async () => {
      try {
        console.log("❌ Disconnected:", socket.id);

        // find broadcaster in DB
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

        console.log("🎤 Auto stopped broadcast");
      } catch (err) {
        console.log("Disconnect Error:", err);
      }
    });
  });
};
