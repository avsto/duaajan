const { WebSocket } = require("ws");

// Dynamic Rooms Map Matrix: { [roomid]: { broadcaster: ws, listeners: Set() } }
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
        const roomid = data.roomid; // Maps exactly from the parsed data stream

        switch (data.type) {
          case "register-broadcaster":
            if (!roomid) return;
            currentRoomId = roomid;
            isBroadcaster = true;

            if (!rooms[roomid])
              rooms[roomid] = { broadcaster: null, listeners: new Set() };
            rooms[roomid].broadcaster = ws;
            console.log(
              `📢 Master Stream Node Registered for Room Key: [${roomid}]`,
            );
            syncViewersCounter(roomid);
            break;

          case "register-listener":
            if (!roomid) return;
            currentRoomId = roomid;
            isBroadcaster = false;

            if (!rooms[roomid])
              rooms[roomid] = { broadcaster: null, listeners: new Set() };
            rooms[roomid].listeners.add(ws);
            console.log(`🎧 Client Subscriber added to channel: [${roomid}]`);

            syncViewersCounter(roomid);

            // 🔴 LIVE RE-NEGOTIATION BRIDGE:
            if (
              rooms[roomid].broadcaster &&
              rooms[roomid].broadcaster.readyState === WebSocket.OPEN
            ) {
              console.log(
                `🔄 Requesting fresh offer from broadcaster for room: ${roomid}`,
              );
              rooms[roomid].broadcaster.send(
                JSON.stringify({ type: "request-offer" }),
              );
            }
            break;

          case "offer":
            if (currentRoomId && rooms[currentRoomId]) {
              rooms[currentRoomId].listeners.forEach((listener) => {
                // ✅ FIX: Sirf un listeners ko offer bhejo jo open hain aur current context se linked hain
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
                // ✅ FIX: Listener se aaya candidate sirf broadaster ke paas jana chahiye, baaki listeners ke paas nahi!
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
      } else {
        rooms[currentRoomId].listeners.delete(ws);
        console.log(
          `ℹ️ Client left structural dynamic loop channels for: ${currentRoomId}`,
        );
        syncViewersCounter(currentRoomId);
      }

      // Memory Allocation Cleanup bounds
      if (
        !rooms[currentRoomId].broadcaster &&
        rooms[currentRoomId].listeners.size === 0
      ) {
        delete rooms[currentRoomId];
        console.log(
          `🧹 Structural GC sweep finalized map arrays for empty channel: ${currentRoomId}`,
        );
      }
    });
  });
};

module.exports = { initWebRTCSignaling };
