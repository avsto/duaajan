// webrtcEngine.js
const { WebSocket } = require("ws");

let broadcaster = null;
let listeners = new Set();

/**
 * Initializes and binds the WebRTC signaling logic onto the global WSS instance.
 * @param {WebSocketServer} wss - The WebSocket server wrapper instance
 */
const initWebRTCSignaling = (wss) => {
  console.log("⚡ WebRTC Signaling Engine attached to Express Core Instance");

  wss.on("connection", (ws) => {
    console.log("⚓ New mobile device linked to WebRTC gateway");

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case "register-broadcaster":
            broadcaster = ws;
            console.log("📢 Broadcaster registered as source master");
            break;

          case "register-listener":
            listeners.add(ws);
            console.log("🎧 New passive listener attached to subscriber array");
            // If a broadcast offer is already staged, inform the incoming listener
            if (broadcaster) {
              ws.send(JSON.stringify({ type: "broadcaster-online" }));
            }
            break;

          case "request-new-offer":
            // ✅ CRITICAL RE-NEGOTIATION FIX: Late listeners trigger a renegotiation request to the broadcaster
            console.log(
              "🔄 Listener requested a fresh offer. Alerting broadcaster...",
            );
            if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
              broadcaster.send(JSON.stringify({ type: "request-offer" }));
            }
            break;

          case "offer":
            console.log(
              "📦 Offer received, piping broadcast tracks down to listeners...",
            );
            listeners.forEach((listener) => {
              if (listener.readyState === WebSocket.OPEN) {
                listener.send(JSON.stringify({ type: "offer", sdp: data.sdp }));
              }
            });
            break;

          case "answer":
            console.log(
              "🤝 Answer received, forwarding handshake down to broadcaster...",
            );
            if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
              broadcaster.send(
                JSON.stringify({ type: "answer", sdp: data.sdp }),
              );
            }
            break;

          case "ice-candidate":
            if (ws === broadcaster) {
              listeners.forEach((listener) => {
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
              if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
                broadcaster.send(
                  JSON.stringify({
                    type: "ice-candidate",
                    candidate: data.candidate,
                  }),
                );
              }
            }
            break;
        }
      } catch (err) {
        console.error("❌ Message parsing anomaly recorded:", err);
      }
    });

    ws.on("close", () => {
      if (ws === broadcaster) {
        console.log("❌ Broadcaster stream disconnected from grid");
        broadcaster = null;
        listeners.forEach((listener) => {
          if (listener.readyState === WebSocket.OPEN) {
            listener.send(JSON.stringify({ type: "broadcaster-offline" }));
          }
        });
      } else {
        console.log("ℹ️ Listener removed from subscriber array");
        listeners.delete(ws);
      }
    });
  });
};

module.exports = { initWebRTCSignaling };
