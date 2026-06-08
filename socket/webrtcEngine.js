const initWebRTCSignaling = (wss) => {
  wss.on("connection", (ws) => {
    console.log("Naya client connect hua");

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);

        // 1. Jab koi Broadcaster ya Listener join kare
        if (data.type === "join") {
          ws.broadcastId = data.broadcastId;
          ws.role = data.role; // 'broadcaster' ya 'listener'
          console.log(`${data.role} joined Room: ${data.broadcastId}`);
        }

        // 2. Jab Broadcaster audio bhej raha ho
        if (data.type === "audio" && ws.role === "broadcaster") {
          // Sirf un logo ko bhejo jo is same broadcastId wale room mein hain
          wss.clients.forEach((client) => {
            if (
              client !== ws &&
              client.readyState === 1 && // 1 ka matlab WebSocket.OPEN hota hai (Bina import ke chalega)
              client.broadcastId === ws.broadcastId &&
              client.role === "listener"
            ) {
              client.send(
                JSON.stringify({
                  type: "audio",
                  payload: data.payload,
                }),
              );
            }
          });
        }
      } catch (e) {
        console.error("Data error:", e);
      }
    });

    ws.on("close", () => {
      console.log(
        `Client disconnect ho gaya (Room: ${ws.broadcastId}, Role: ${ws.role})`,
      );
    });
  });
};

module.exports = { initWebRTCSignaling };