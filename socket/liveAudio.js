const { WebSocketServer } = require("ws");

// Port 8080 par server start karein
const wss = new WebSocketServer({ port: 8080 });
console.log("WebRTC Signaling Server running on port 8080");

// Sabhi connected devices ko track karne ke liye
let broadcaster = null;
let listeners = new Set();

wss.on("connection", (ws) => {
  console.log("Naya device connect hua");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case "register-broadcaster":
          broadcaster = ws;
          console.log("Broadcaster register ho gaya");
          break;

        case "register-listener":
          listeners.add(ws);
          console.log("Naya Listener register ho gaya");
          // Agar broadcaster pehle se live hai, toh listener ko batao
          if (broadcaster) {
            ws.send(JSON.stringify({ type: "broadcaster-online" }));
          }
          break;

        case "offer":
          // Broadcaster se offer lekar sabhi listeners ko bhej do
          console.log("Offer mila, listeners ko forward kar raha hu...");
          listeners.forEach((listener) => {
            if (listener.readyState === ws.OPEN) {
              listener.send(JSON.stringify({ type: "offer", sdp: data.sdp }));
            }
          });
          break;

        case "answer":
          // Listener se answer lekar wapas broadcaster ko bhej do
          console.log("Answer mila, broadcaster ko forward kar raha hu...");
          if (broadcaster && broadcaster.readyState === ws.OPEN) {
            broadcaster.send(JSON.stringify({ type: "answer", sdp: data.sdp }));
          }
          break;

        case "ice-candidate":
          // ICE Candidates ko sahi target device par forward karein
          if (ws === broadcaster) {
            // Broadcaster ka candidate sabhi listeners ko bhejein
            listeners.forEach((listener) => {
              if (listener.readyState === ws.OPEN) {
                listener.send(
                  JSON.stringify({
                    type: "ice-candidate",
                    candidate: data.candidate,
                  }),
                );
              }
            });
          } else {
            // Listener ka candidate broadcaster ko bhejein
            if (broadcaster && broadcaster.readyState === ws.OPEN) {
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
      console.error("Error parsing message:", err);
    }
  });

  ws.on("close", () => {
    if (ws === broadcaster) {
      console.log("Broadcaster disconnect hua");
      broadcaster = null;
      // Listeners ko inform karein ki live stream band ho gayi
      listeners.forEach((listener) =>
        listener.send(JSON.stringify({ type: "broadcaster-offline" })),
      );
    } else {
      console.log("Listener disconnect hua");
      listeners.delete(ws);
    }
  });
});
