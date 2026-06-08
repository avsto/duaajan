const broadcasters = {}; // Key: roomId -> Value: broadcasterSocketId
const viewers = {}; // Key: viewerSocketId -> Value: { roomId, broadcasterId }

const initWebRTCSignaling = (io) => {
  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    // ==========================
    // BROADCASTER START
    // ==========================
    socket.on("broadcaster", ({ roomId }) => {
      // Prevent multiple broadcasters overwriting an active room accidentally
      broadcasters[roomId] = socket.id;

      socket.roomId = roomId;
      socket.role = "broadcaster";

      socket.join(roomId);
      console.log(`Broadcaster Started Room: ${roomId} (Socket: ${socket.id})`);
    });

    // ==========================
    // VIEWER JOIN
    // ==========================
    socket.on("viewer", ({ roomId }) => {
      const broadcasterId = broadcasters[roomId];

      if (!broadcasterId) {
        socket.emit("broadcast-not-found");
        return;
      }

      socket.roomId = roomId;
      socket.role = "viewer";

      viewers[socket.id] = {
        roomId,
        broadcasterId,
      };

      socket.join(roomId);
      console.log(`Viewer ${socket.id} joined Room: ${roomId}`);

      // Alert the specific broadcaster so they can initiate the WebRTC Offer
      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });
    });

    // ==========================
    // SDP OFFER & ANSWER SIGNALING
    // ==========================
    socket.on("offer", ({ target, offer }) => {
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", {
        sender: socket.id,
        answer,
      });
    });

    // ==========================
    // ICE CANDIDATE
    // ==========================
    socket.on("candidate", ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });
    });

    // ==========================
    // STOP BROADCAST (Manual Trigger)
    // ==========================
    socket.on("stop-broadcast", ({ roomId }) => {
      if (broadcasters[roomId] !== socket.id) {
        console.log("Unauthorized stop request from:", socket.id);
        return;
      }

      handleBroadcasterTeardown(io, roomId);
    });

    // ==========================
    // DISCONNECT (Unexpected or App Close)
    // ==========================
    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);

      // Scenario A: Broadcaster falls off
      if (socket.role === "broadcaster") {
        const roomId = socket.roomId;
        if (roomId && broadcasters[roomId] === socket.id) {
          handleBroadcasterTeardown(io, roomId);
        }
      }

      // Scenario B: Viewer falls off (FIXED: Added cross-communication)
      if (socket.role === "viewer" || viewers[socket.id]) {
        const viewerData = viewers[socket.id];

        if (viewerData) {
          const { roomId, broadcasterId } = viewerData;

          console.log(`Viewer ${socket.id} disconnected from Room ${roomId}`);

          // CRITICAL FIX: Notify the broadcaster so they tear down the WebRTC Peer Connection!
          if (broadcasterId) {
            io.to(broadcasterId).emit("candidate", {
              sender: socket.id,
              candidate: null, // Passing null candidate tells WebRTC to close connections
            });

            // Re-trigger peer connection cleanup on broadcaster by passing a closed instruction
            io.to(broadcasterId).emit("viewer-disconnected", {
              viewerId: socket.id,
            });
          }
        }

        delete viewers[socket.id];
      }
    });
  });
};

/**
 * Clean helper function to handle complex multi-step broadcaster teardowns safely
 */
const handleBroadcasterTeardown = (io, roomId) => {
  console.log(`Cleaning up Room: ${roomId}`);

  // 1. Notify all listeners in the socket room instantly
  io.to(roomId).emit("broadcast-stopped");

  // 2. Erase broadcaster from global state registry
  delete broadcasters[roomId];

  // 3. Purge related viewers and forcefully eject them from Socket.io tracking rooms
  Object.keys(viewers).forEach((viewerId) => {
    if (viewers[viewerId]?.roomId === roomId) {
      const viewerSocket = io.sockets.sockets.get(viewerId);
      if (viewerSocket) {
        viewerSocket.leave(roomId); // Prevent memory leaks inside Socket.io
      }
      delete viewers[viewerId];
    }
  });
};

module.exports = {
  initWebRTCSignaling,
};
