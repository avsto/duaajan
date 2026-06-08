const broadcasters = {}; // Key: roomId -> Value: broadcasterSocketId
const viewers = {};      // Key: viewerSocketId -> Value: { roomId, broadcasterId }

const initWebRTCSignaling = (io) => {
  // CORS ko handle karne ke liye aap app.js/server.js mein bhi 'origin: *' zaroor check karein

  io.on("connection", (socket) => {
    console.log("Connected globally:", socket.id);

    // ==========================
    // BROADCASTER START
    // ==========================
    socket.on("broadcaster", ({ roomId }) => {
      if (!roomId) return;
      
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
      if (!roomId) return;

      const broadcasterId = broadcasters[roomId];

      if (!broadcasterId) {
        console.log(`Room not found: ${roomId} for viewer: ${socket.id}`);
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

      // Broadcaster ko alert karein taaki Offer initiate ho sake
      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });
    });

    // ==========================
    // SDP OFFER & ANSWER SIGNALING
    // ==========================
    socket.on("offer", ({ target, offer }) => {
      if (!target) return;
      io.to(target).emit("offer", {
        sender: socket.id,
        offer,
      });
    });

    socket.on("answer", ({ target, answer }) => {
      if (!target) return;
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
      if (!roomId) return;

      if (broadcasters[roomId] !== socket.id) {
        console.log("Unauthorized stop request from:", socket.id);
        return;
      }

      handleBroadcasterTeardown(io, roomId);
    });

    // ==========================
    // DISCONNECT (Unexpected or App Close)
    // ==========================
    socket.on("disconnect", (reason) => {
      console.log(`Disconnected: ${socket.id} | Reason: ${reason}`);

      // FIX: Sirf socket.role par depend na rahein, registries mein find karein
      
      // 1. Check karein kya yeh socket kisi room ka broadcaster tha?
      let foundRoomId = socket.roomId;
      if (!foundRoomId) {
        // Fallback: Pure object registry mein check karein
        foundRoomId = Object.keys(broadcasters).find(room => broadcasters[room] === socket.id);
      }

      if (foundRoomId && broadcasters[foundRoomId] === socket.id) {
        console.log(`Broadcaster disconnected from Room: ${foundRoomId}`);
        handleBroadcasterTeardown(io, foundRoomId);
        return; // Teardown ho gaya, aage check karne ki zaroorat nahi
      }

      // 2. Check karein kya yeh socket koi active viewer tha?
      if (viewers[socket.id]) {
        const viewerData = viewers[socket.id];
        const { roomId, broadcasterId } = viewerData;

        console.log(`Viewer ${socket.id} clean disconnected from Room: ${roomId}`);

        if (broadcasterId) {
          // Broadcaster ko notify karein taaki WebRTC instances saaf hon
          io.to(broadcasterId).emit("candidate", {
            sender: socket.id,
            candidate: null,
          });

          io.to(broadcasterId).emit("viewer-disconnected", {
            viewerId: socket.id,
          });
        }

        delete viewers[socket.id];
      }
    });
  });
};

/**
 * Teardown helper block for room cleanups
 */
const handleBroadcasterTeardown = (io, roomId) => {
  if (!roomId) return;
  console.log(`Cleaning up Room: ${roomId}`);

  // 1. Notify all viewers instantly
  io.to(roomId).emit("broadcast-stopped");

  // 2. Erase broadcaster tracking
  delete broadcasters[roomId];

  // 3. Purge related viewers and forcefully eject them from Socket.io virtual rooms
  Object.keys(viewers).forEach((viewerId) => {
    if (viewers[viewerId]?.roomId === roomId) {
      const viewerSocket = io.sockets.sockets.get(viewerId);
      if (viewerSocket) {
        viewerSocket.leave(roomId);
      }
      delete viewers[viewerId];
    }
  });
};

module.exports = {
  initWebRTCSignaling,
};