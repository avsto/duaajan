global.broadcasters = global.broadcasters || {};
global.viewers = global.viewers || {};

const broadcasters = global.broadcasters;
const viewers = global.viewers;

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    // =====================================
    // BROADCASTER START
    // =====================================
    socket.on("broadcaster", ({ roomId }) => {
      try {
        if (!roomId) return;

        roomId = String(roomId).trim();

        console.log("\n========== BROADCAST START ==========");
        console.log("Room:", roomId);
        console.log("Socket:", socket.id);

        broadcasters[roomId] = socket.id;

        socket.roomId = roomId;
        socket.role = "broadcaster";

        socket.join(roomId);

        console.log(
          "Current Broadcasters:",
          JSON.stringify(broadcasters, null, 2),
        );

        socket.emit("broadcast-ready", { roomId });

        console.log("✅ Broadcast Registered");
      } catch (err) {
        console.log("Broadcaster Error:", err);
      }
    });

    // =====================================
    // VIEWER JOIN
    // =====================================
    socket.on("viewer", ({ roomId }) => {
      try {
        if (!roomId) return;

        roomId = String(roomId).trim();

        console.log("\n========== VIEWER JOIN ==========");
        console.log("Room:", roomId);
        console.log("Viewer Socket:", socket.id);

        const addViewer = (broadcasterId) => {
          socket.roomId = roomId;
          socket.role = "viewer";

          viewers[socket.id] = {
            roomId,
            broadcasterId,
          };

          socket.join(roomId);

          io.to(broadcasterId).emit("viewer", {
            viewerId: socket.id,
          });

          console.log("✅ Viewer Added");
        };

        let broadcasterId = broadcasters[roomId];

        console.log("Found Broadcaster:", broadcasterId);

        // Retry once after 2 sec
        if (!broadcasterId) {
          console.log("⚠️ Broadcaster not found. Retrying...");

          setTimeout(() => {
            const retryBroadcasterId = broadcasters[roomId];

            console.log("Retry Broadcaster:", retryBroadcasterId);

            if (!retryBroadcasterId) {
              console.log("❌ Broadcast Not Found");

              socket.emit("broadcast-not-found");

              return;
            }

            addViewer(retryBroadcasterId);
          }, 2000);

          return;
        }

        addViewer(broadcasterId);
      } catch (err) {
        console.log("Viewer Join Error:", err);
      }
    });

    // =====================================
    // OFFER
    // =====================================
    socket.on("offer", ({ target, offer }) => {
      if (!target) return;

      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    // =====================================
    // ANSWER
    // =====================================
    socket.on("answer", ({ target, answer }) => {
      if (!target) return;

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
    socket.on("stop-broadcast", ({ roomId }) => {
      try {
        if (!roomId) return;

        roomId = String(roomId).trim();

        const broadcasterId = broadcasters[roomId];

        if (broadcasterId !== socket.id) {
          console.log("❌ Unauthorized stop request");
          return;
        }

        console.log("🛑 Broadcast Stopped:", roomId);

        handleBroadcasterTeardown(io, roomId);
      } catch (err) {
        console.log("Stop Broadcast Error:", err);
      }
    });

    // =====================================
    // DISCONNECT
    // =====================================
    socket.on("disconnect", (reason) => {
      try {
        console.log(`🔴 Disconnected: ${socket.id} | ${reason}`);

        let roomId = socket.roomId;

        if (!roomId) {
          roomId = Object.keys(broadcasters).find(
            (room) => broadcasters[room] === socket.id,
          );
        }

        // broadcaster disconnected
        if (roomId && broadcasters[roomId] === socket.id) {
          console.log(`📴 Broadcaster Left Room: ${roomId}`);

          handleBroadcasterTeardown(io, roomId);

          return;
        }

        // viewer disconnected
        if (viewers[socket.id]) {
          const { roomId, broadcasterId } = viewers[socket.id];

          console.log(`👤 Viewer Left Room ${roomId}`);

          io.to(broadcasterId).emit("viewer-disconnected", {
            viewerId: socket.id,
          });

          delete viewers[socket.id];
        }
      } catch (err) {
        console.log("Disconnect Error:", err);
      }
    });
  });
};

// =====================================
// ROOM CLEANUP
// =====================================
function handleBroadcasterTeardown(io, roomId) {
  try {
    roomId = String(roomId).trim();

    console.log(`🧹 Cleaning Room: ${roomId}`);

    io.to(roomId).emit("broadcast-stopped");

    delete broadcasters[roomId];

    Object.keys(viewers).forEach((viewerId) => {
      const viewer = viewers[viewerId];

      if (viewer?.roomId === roomId) {
        const socket = io.sockets.sockets.get(viewerId);

        if (socket) {
          socket.leave(roomId);
        }

        delete viewers[viewerId];
      }
    });

    console.log("✅ Room Cleanup Complete");
  } catch (err) {
    console.log("Cleanup Error:", err);
  }
}

module.exports = {
  initWebRTCSignaling,
};
