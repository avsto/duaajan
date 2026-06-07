const { WebSocket } = require("ws");

// Dynamic Rooms Map Matrix: { [roomid]: { broadcaster: ws, listeners: Set(), isEngineActive: false } }
let rooms = {};

const initWebRTCSignaling = (wss) => {
  console.log("⚡ WebRTC Multi-Room Distribution Mesh Initialized");

  wss.on("connection", (ws) => {
    let currentRoomId = null;
    let isBroadcaster = false;

    // View updates matrix builder
    const syncViewersCounter = (roomid) => {
      if (!rooms[roomid]) return;
      const count = rooms[roomid].listeners.size;
      const metricsPayload = JSON.stringify({
        type: "view-count-changed",
        count,
      });

      if (
        rooms[roomid].broadcaster &&
        rooms[roomid].broadcaster.readyState === WebSocket.OPEN
      ) {
        rooms[roomid].broadcaster.send(metricsPayload);
      }
      rooms[roomid].listeners.forEach((listener) => {
        if (listener.readyState === WebSocket.OPEN) {
          listener.send(metricsPayload);
        }
      });
    };

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        const roomid = data.roomid;

        switch (data.type) {
          case "register-broadcaster":
            if (!roomid) return;
            currentRoomId = roomid;
            isBroadcaster = true;

            if (!rooms[roomid]) {
              rooms[roomid] = {
                broadcaster: null,
                listeners: new Set(),
                isEngineActive: false,
              };
            }
            rooms[roomid].broadcaster = ws;
            rooms[roomid].isEngineActive = false; // Fresh initialization par state reset
            console.log(
              `📢 Master Stream Node Registered for Room Key: [${roomid}]`,
            );
            syncViewersCounter(roomid);
            break;

          case "register-listener":
            if (!roomid) return;
            currentRoomId = roomid;
            isBroadcaster = false;

            if (!rooms[roomid]) {
              rooms[roomid] = {
                broadcaster: null,
                listeners: new Set(),
                isEngineActive: false,
              };
            }
            rooms[roomid].listeners.add(ws);
            console.log(`🎧 Client Subscriber added to channel: [${roomid}]`);

            syncViewersCounter(roomid);

            // 🔴 CORRECTION: Tabhi offer mangenge jab Broadcaster ka WebRTC Setup complete ho
            if (
              rooms[roomid].broadcaster &&
              rooms[roomid].broadcaster.readyState === WebSocket.OPEN
            ) {
              if (rooms[roomid].isEngineActive) {
                console.log(
                  `🔄 Requesting fresh offer from ACTIVE broadcaster for room: ${roomid}`,
                );
                rooms[roomid].broadcaster.send(
                  JSON.stringify({ type: "request-offer" }),
                );
              } else {
                console.log(
                  `⏳ Broadcaster socket is open but WebRTC Engine is initializing. Waiting...`,
                );
              }
            }
            break;

          case "offer":
            if (currentRoomId && rooms[currentRoomId]) {
              // 🔴 LOCK: Broadcaster ne offer de diya, matlab engine ab active aur ready hai
              rooms[currentRoomId].isEngineActive = true;

              rooms[currentRoomId].listeners.forEach((listener) => {
                if (listener.readyState === WebSocket.OPEN) {
                  listener.send(
                    JSON.stringify({ type: "offer", sdp: data.sdp }),
                  );
                }
              });
            }
            break;

          case "answer":
            if (
              currentRoomId &&
              rooms[currentRoomId] &&
              rooms[currentRoomId].broadcaster
            ) {
              if (
                rooms[currentRoomId].broadcaster.readyState === WebSocket.OPEN
              ) {
                rooms[currentRoomId].broadcaster.send(
                  JSON.stringify({ type: "answer", sdp: data.sdp }),
                );
              }
            }
            break;

          case "ice-candidate":
            if (currentRoomId && rooms[currentRoomId]) {
              if (isBroadcaster) {
                rooms[currentRoomId].listeners.forEach((listener) => {
                  if (listener.readyState === WebSocket.OPEN) {
                    listener.send(
                      JSON.stringify({
                        type: "ice-candidate",
                        candidate: data.candidate,
                      }),
                    );
                  }
                });
              } else {
                if (
                  rooms[currentRoomId].broadcaster &&
                  rooms[currentRoomId].broadcaster.readyState === WebSocket.OPEN
                ) {
                  rooms[currentRoomId].broadcaster.send(
                    JSON.stringify({
                      type: "ice-candidate",
                      candidate: data.candidate,
                    }),
                  );
                }
              }
            }
            break;
        }
      } catch (err) {
        console.error("❌ Signalling processing data parsing fault:", err);
      }
    });

    ws.on("close", () => {
      if (!currentRoomId || !rooms[currentRoomId]) return;

      if (isBroadcaster) {
        console.log(
          `❌ Channel Streamer Dropped out for room: ${currentRoomId}`,
        );
        rooms[currentRoomId].listeners.forEach((listener) => {
          if (listener.readyState === WebSocket.OPEN) {
            listener.send(JSON.stringify({ type: "broadcaster-offline" }));
          }
        });
        rooms[currentRoomId].broadcaster = null;
        rooms[currentRoomId].isEngineActive = false;
      } else {
        rooms[currentRoomId].listeners.delete(ws);
        console.log(`ℹ️ Client left channels for: ${currentRoomId}`);
        syncViewersCounter(currentRoomId);
      }

      if (
        !rooms[currentRoomId].broadcaster &&
        rooms[currentRoomId].listeners.size === 0
      ) {
        delete rooms[currentRoomId];
        console.log(
          `🧹 Structural GC sweep finalized for empty channel: ${currentRoomId}`,
        );
      }
    });
  });
};

module.exports = { initWebRTCSignaling };
