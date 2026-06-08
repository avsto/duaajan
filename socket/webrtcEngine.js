// Location: ./socket/webrtcEngine.js

const initWebRTCSignaling = (wss) => {
  wss.on("connection", (ws) => {
    console.log("🚀 WebRTC Client Connected to Unified Engine");

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);

        // 1. Handshake Room System (Broadcaster / Listener Join Rules)
        if (data.type === "join") {
          ws.broadcastId = data.broadcastId;
          ws.role = data.role; // 'broadcaster' ya 'listener'
          console.log(
            `📡 [Room: ${data.broadcastId}] ${data.role.toUpperCase()} Joined`,
          );
        }

        // 2. Routing Peer-to-Peer Signaling Handshake (Offer, Answer, ICE Candidates)
        if (
          data.type === "offer" ||
          data.type === "answer" ||
          data.type === "candidate"
        ) {
          wss.clients.forEach((client) => {
            if (
              client !== ws &&
              client.readyState === 1 && // 1 = WebSocket.OPEN (Bina module import ke safe status)
              client.broadcastId === ws.broadcastId
            ) {
              client.send(JSON.stringify(data));
            }
          });
        }
      } catch (e) {
        console.error("❌ Signaling Data stream error:", e.message);
      }
    });

    ws.on("close", () => {
      console.log(
        `🔌 Client Left (Room: ${ws.broadcastId || "N/A"}, Role: ${ws.role || "N/A"})`,
      );
    });
  });
};

module.exports = { initWebRTCSignaling };
