const { WebSocket } = require("ws");
const LiveReport = require("../models/LiveReport");
const User = require("../models/User");

let rooms = {};

const initWebRTCSignaling = (wss) => {
  console.log("⚡ WebRTC Multi-Room Distribution Mesh Engine Online (API-Synced)");

  wss.on("connection", (ws) => {
    let currentRoomId = null;
    let isBroadcaster = false;
    let listenerDatabaseId = null;

    const syncViewersCounter = async (roomid) => {
      if (!rooms[roomid]) return;
      const count = rooms[roomid].listeners.size;
      const metricsPayload = JSON.stringify({ type: "view-count-changed", count });

      if (rooms[roomid].broadcaster && rooms[roomid].broadcaster.readyState === WebSocket.OPEN) {
        rooms[roomid].broadcaster.send(metricsPayload);
      }
      rooms[roomid].listeners.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(metricsPayload);
        }
      });

      if (rooms[roomid].reportId) {
        try {
          await LiveReport.findByIdAndUpdate(rooms[roomid].reportId, {
            $set: { totalListeners: count },
            $max: { maxListeners: count },
          });
        } catch (dbErr) {
          console.error("❌ Live report analytics sync loop failure:", dbErr);
        }
      }
    };

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);
        const roomid = data.roomid || data.roomId;

        switch (data.type) {
          case "register-broadcaster":
            if (!roomid) return;
            currentRoomId = roomid;
            isBroadcaster = true;

            if (!rooms[roomid]) {
              rooms[roomid] = { broadcaster: null, listeners: new Map(), reportId: null, isEngineActive: false };
            }
            rooms[roomid].broadcaster = ws;
            rooms[roomid].isEngineActive = false;
            rooms[roomid].reportId = data.reportId || null;

            console.log(`📢 Broadcaster Connected for Report: [${rooms[roomid].reportId}]`);
            syncViewersCounter(roomid);
            break;

          case "register-listener":
            if (!roomid) return;
            currentRoomId = roomid;
            isBroadcaster = false;
            listenerDatabaseId = data.userId || null;

            if (!rooms[roomid]) {
              rooms[roomid] = { broadcaster: null, listeners: new Map(), reportId: null, isEngineActive: false };
            }

            rooms[roomid].listeners.set(ws, { joinedAt: new Date(), userId: listenerDatabaseId });
            console.log(`🎧 Listener connected to room: ${roomid}`);

            if (rooms[roomid].reportId) {
              try {
                await LiveReport.findByIdAndUpdate(rooms[roomid].reportId, {
                  $push: { listeners: { userId: listenerDatabaseId, joinedAt: new Date() } },
                });
              } catch (dbErr) {
                console.error("❌ Failed to log listener inside MongoDB:", dbErr);
              }
            }

            syncViewersCounter(roomid);

            if (rooms[roomid].broadcaster && rooms[roomid].broadcaster.readyState === WebSocket.OPEN) {
              if (rooms[roomid].isEngineActive) {
                rooms[roomid].broadcaster.send(JSON.stringify({ type: "request-offer" }));
              }
            }
            break;

          case "offer":
            if (currentRoomId && rooms[currentRoomId]) {
              rooms[currentRoomId].isEngineActive = true;
              rooms[currentRoomId].listeners.forEach((clientObj, clientWs) => {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: "offer", sdp: data.sdp }));
                }
              });
            }
            break;

          case "answer":
            if (currentRoomId && rooms[currentRoomId] && rooms[currentRoomId].broadcaster) {
              if (rooms[currentRoomId].broadcaster.readyState === WebSocket.OPEN) {
                rooms[currentRoomId].broadcaster.send(JSON.stringify({ type: "answer", sdp: data.sdp }));
              }
            }
            break;

          case "ice-candidate":
            if (currentRoomId && rooms[currentRoomId]) {
              if (isBroadcaster) {
                // Broadcaster ka candidate saare listeners ko pass karein
                rooms[currentRoomId].listeners.forEach((clientObj, clientWs) => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: "ice-candidate", candidate: data.candidate }));
                  }
                });
              } else {
                // Listener ka candidate master broadcaster ko pass karein
                if (rooms[currentRoomId].broadcaster && rooms[currentRoomId].broadcaster.readyState === WebSocket.OPEN) {
                  rooms[currentRoomId].broadcaster.send(JSON.stringify({ type: "ice-candidate", candidate: data.candidate }));
                }
              }
            }
            break;

          case "unregister-broadcaster":
            if (currentRoomId && rooms[currentRoomId]) {
              await closeLiveSessionLog(currentRoomId);
            }
            break;
        }
      } catch (err) {
        console.error("❌ Signalling incoming packet crash:", err);
      }
    });

    const closeLiveSessionLog = async (roomId) => {
      if (!rooms[roomId]) return;
      console.log(`🧹 Terminating protocol for channel: ${roomId}`);

      const currentReportId = rooms[roomId].reportId;

      rooms[roomId].listeners.forEach((clientObj, clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: "broadcaster-offline" }));
        }
      });

      if (currentReportId) {
        try {
          const report = await LiveReport.findById(currentReportId);
          if (report && report.status === "live") {
            const end = new Date();
            const durationSec = Math.round((end.getTime() - report.startTime.getTime()) / 1000);

            await LiveReport.findByIdAndUpdate(currentReportId, {
              $set: { endTime: end, duration: durationSec, status: "completed", isLive: false },
            });

            await User.findByIdAndUpdate(roomId, {
              $set: { isLive: false },
            });

            console.log(`💾 Live session saved. Runtime: ${durationSec}s`);
          }
        } catch (dbErr) {
          console.error("❌ Database updates fault:", dbErr);
        }
      }

      delete rooms[roomId];
    };

    ws.on("close", async () => {
      if (!currentRoomId || !rooms[currentRoomId]) return;

      if (isBroadcaster) {
        await closeLiveSessionLog(currentRoomId);
      } else {
        rooms[currentRoomId].listeners.delete(ws);
        syncViewersCounter(currentRoomId);

        if (!rooms[currentRoomId].broadcaster && rooms[currentRoomId].listeners.size === 0) {
          delete rooms[currentRoomId];
        }
      }
    });
  });
};

module.exports = { initWebRTCSignaling };