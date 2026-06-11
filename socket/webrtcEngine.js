
// src/webrtcSignaling.js

const broadcasters = new Map(); // roomId -> socketId
const viewers = new Map(); // viewerSocketId -> { roomId, broadcasterId }

const initWebRTCSignaling = (io) => {
  io.on('connection', socket => {
    console.log('🟢 Connected:', socket.id);

    // =========================
    // BROADCASTER START
    // =========================
    socket.on('broadcaster', ({ roomId }) => {
      try {
        if (!roomId) return;

        // IMPORTANT: overwrite safe
        broadcasters.set(roomId, socket.id);

        socket.roomId = roomId;
        socket.role = 'broadcaster';

        socket.join(roomId);

        console.log('🚀 Broadcaster Started');
        console.log('Room:', roomId);
        console.log('Socket:', socket.id);

        socket.emit('broadcast-ready', { roomId });
      } catch (err) {
        console.log('Broadcaster Error:', err);
      }
    });

    // =========================
    // VIEWER JOIN
    // =========================
    socket.on('viewer', ({ roomId }) => {
      try {
        if (!roomId) return;

        const broadcasterId = broadcasters.get(roomId);

        console.log('👀 Viewer Request');
        console.log('Room:', roomId);
        console.log('Broadcaster:', broadcasterId);

        if (!broadcasterId) {
          socket.emit('broadcast-not-found');
          return;
        }

        socket.roomId = roomId;
        socket.role = 'viewer';

        viewers.set(socket.id, {
          roomId,
          broadcasterId,
        });

        socket.join(roomId);

        io.to(broadcasterId).emit('viewer', {
          viewerId: socket.id,
        });

        console.log('✅ Viewer Added:', socket.id);
      } catch (err) {
        console.log('Viewer Error:', err);
      }
    });

    // =========================
    // OFFER
    // =========================
    socket.on('offer', ({ target, offer }) => {
      if (!target) return;

      io.to(target).emit('offer', {
        sender: socket.id,
        offer,
      });
    });

    // =========================
    // ANSWER
    // =========================
    socket.on('answer', ({ target, answer }) => {
      if (!target) return;

      io.to(target).emit('answer', {
        sender: socket.id,
        answer,
      });
    });

    // =========================
    // ICE CANDIDATE
    // =========================
    socket.on('candidate', ({ target, candidate }) => {
      if (!target) return;

      io.to(target).emit('candidate', {
        sender: socket.id,
        candidate,
      });
    });

    // =========================
    // STOP BROADCAST
    // =========================
    socket.on('stop-broadcast', ({ roomId }) => {
      try {
        const broadcasterId = broadcasters.get(roomId);

        if (!broadcasterId) return;

        if (broadcasterId !== socket.id) {
          console.log('❌ Unauthorized stop attempt:', socket.id);
          return;
        }

        console.log('🛑 Broadcast Stopped:', roomId);

        handleBroadcasterTeardown(io, roomId);
      } catch (err) {
        console.log('Stop Error:', err);
      }
    });

    // =========================
    // DISCONNECT
    // =========================
    socket.on('disconnect', reason => {
      try {
        console.log('🔴 Disconnected:', socket.id, reason);

        // -------------------------
        // VIEWER CLEANUP
        // -------------------------
        const viewer = viewers.get(socket.id);

        if (viewer) {
          const { broadcasterId } = viewer;

          io.to(broadcasterId).emit('viewer-disconnected', {
            viewerId: socket.id,
          });

          viewers.delete(socket.id);

          console.log('👋 Viewer removed');
          return;
        }

        // -------------------------
        // BROADCASTER CLEANUP
        // -------------------------
        let roomId = socket.roomId;

        if (!roomId) {
          for (const [room, id] of broadcasters.entries()) {
            if (id === socket.id) {
              roomId = room;
              break;
            }
          }
        }

        if (roomId && broadcasters.get(roomId) === socket.id) {
          console.log('📴 Broadcaster disconnected:', roomId);

          // delay to allow reconnect
          setTimeout(() => {
            const current = broadcasters.get(roomId);

            if (current === socket.id) {
              console.log('🧹 Final cleanup broadcaster');
              handleBroadcasterTeardown(io, roomId);
            } else {
              console.log('♻️ Broadcaster reconnected, skip cleanup');
            }
          }, 15000);
        }
      } catch (err) {
        console.log('Disconnect Error:', err);
      }
    });
  });
};

// =========================
// CLEANUP FUNCTION
// =========================
const handleBroadcasterTeardown = (io, roomId) => {
  try {
    console.log('🧹 Cleaning Room:', roomId);

    io.to(roomId).emit('broadcast-stopped');

    broadcasters.delete(roomId);

    for (const [viewerId, viewer] of viewers.entries()) {
      if (viewer.roomId === roomId) {
        const socket = io.sockets.sockets.get(viewerId);

        if (socket) {
          socket.leave(roomId);
        }

        viewers.delete(viewerId);
      }
    }

    console.log('✅ Cleanup Complete');
  } catch (err) {
    console.log('Cleanup Error:', err);
  }
};

module.exports = {
  initWebRTCSignaling,
};
