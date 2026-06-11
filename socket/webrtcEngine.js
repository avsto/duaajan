// webrtcSignaling.js

const broadcasters = new Map(); // roomId -> broadcasterSocketId
const viewers = new Map(); // viewerSocketId -> { roomId, broadcasterId }

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    // =====================================
    // BROADCASTER START
    // =====================================
    socket.on("broadcaster", ({ roomId }) => {
      try {
        if (!roomId) return;

        broadcasters.set(roomId, socket.id);

        socket.roomId = roomId;
        socket.role = "broadcaster";

        socket.join(roomId);

        console.log("🚀 Broadcaster Started");
        console.log("Room:", roomId);
        console.log("Socket:", socket.id);

        socket.emit("broadcast-ready", { roomId });
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

        const broadcasterId = broadcasters.get(roomId);

        console.log("Found Broadcaster:", broadcasterId);

        if (!broadcasterId) {
          socket.emit("broadcast-not-found");
          return;
        }

        socket.roomId = roomId;
        socket.role = "viewer";

        viewers.set(socket.id, {
          roomId,
          broadcasterId,
        });

        socket.join(roomId);

        io.to(broadcasterId).emit("viewer", {
          viewerId: socket.id,
        });

        console.log("✅ Viewer Added:", socket.id);
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

        const broadcasterId = broadcasters.get(roomId);

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
        console.log("🔴 Disconnected:", socket.id);
        console.log("Reason:", reason);

        // viewer disconnected
        const viewer = viewers.get(socket.id);

        if (viewer) {
          io.to(viewer.broadcasterId).emit("viewer-disconnected", {
            viewerId: socket.id,
          });

          viewers.delete(socket.id);

          console.log("👋 Viewer Left");

          return;
        }

        // broadcaster disconnected
        let roomId = socket.roomId;

        if (!roomId) {
          for (const [room, broadcasterId] of broadcasters.entries()) {
            if (broadcasterId === socket.id) {
              roomId = room;
              break;
            }
          }
        }

        if (roomId && broadcasters.get(roomId) === socket.id) {
          console.log("📴 Broadcaster disconnected:", roomId);

          setTimeout(() => {
            const currentBroadcaster = broadcasters.get(roomId);

            // same socket still registered => cleanup
            if (currentBroadcaster === socket.id) {
              console.log("🗑 Removing broadcaster");

              handleBroadcasterTeardown(io, roomId);
            } else {
              console.log("♻️ Broadcaster reconnected");
            }
          }, 30000);
        }
      } catch (err) {
        console.log("Disconnect Error:", err);
      }
    });
  });
};

// =====================================
// CLEANUP
// =====================================
const handleBroadcasterTeardown = (io, roomId) => {
  try {
    io.to(roomId).emit("broadcast-stopped");

    broadcasters.delete(roomId);

    for (const [viewerId, viewer] of viewers.entries()) {
      if (viewer.roomId === roomId) {
        const viewerSocket = io.sockets.sockets.get(viewerId);

        if (viewerSocket) {
          viewerSocket.leave(roomId);
        }

        viewers.delete(viewerId);
      }
    }

    console.log("✅ Room Cleanup Complete");
  } catch (err) {
    console.log("Cleanup Error:", err);
  }
};

module.exports = {
  initWebRTCSignaling,
};
