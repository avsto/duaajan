require("dotenv").config();
require("./firebase");

const path = require("path");
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo"); // ✅ FIX: Standard CommonJS import correction

const http = require("http");
const { WebSocketServer, WebSocket } = require("ws"); // ✅ FIX: Explicitly extracted 'WebSocket' to fix connection state evaluations

const app = express();
const server = http.createServer(app);

// ======================================
// DATABASE
// ======================================
connectDB();

// ======================================
// WEBSOCKET SIGNALING SERVER (INTEGRATED)
// ======================================
// ✅ FIXED: Instead of mapping an isolated port (8089), bind WS directly onto your HTTP server instance.
// Now, your React Native apps should link to: "wss://://duaajan.com" or "wss://duaajan.com" depending on your proxy configurations.
const wss = new WebSocketServer({ server });
console.log("⚡ WebRTC Signaling Engine attached to Express Core Instance");

// Track active communication peers
let broadcaster = null;
let listeners = new Set();

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

        case "offer":
          console.log(
            "📦 Offer received, piping broadcast tracks down to listeners...",
          );
          listeners.forEach((listener) => {
            // ✅ FIXED: Evaluated against WebSocket.OPEN instead of the undefined property ws.OPEN
            if (listener.readyState === WebSocket.OPEN) {
              listener.send(JSON.stringify({ type: "offer", sdp: data.sdp }));
            }
          });
          break;

        case "answer":
          console.log(
            "🤝 Answer received, forwarding handshake down to broadcaster...",
          );
          // ✅ FIXED: Evaluated against WebSocket.OPEN
          if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
            broadcaster.send(JSON.stringify({ type: "answer", sdp: data.sdp }));
          }
          break;

        case "ice-candidate":
          if (ws === broadcaster) {
            listeners.forEach((listener) => {
              // ✅ FIXED: Evaluated against WebSocket.OPEN
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
            // ✅ FIXED: Evaluated against WebSocket.OPEN
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

// ======================================
// MIDDLEWARES
// ======================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================================
// SESSION MANAGEMENT
// =========================================
app.use(
  session({
    secret: process.env.JWT_SECRET || "duaajan-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL,
      collectionName: "sessions",
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: false, // Set to true if deploying directly on an HTTPS production ecosystem
    },
  }),
);

// ======================================
// VIEW ENGINE CONFIGURATION
// ======================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================================
// API ROUTES MANAGEMENT
// ======================================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/masjid", require("./routes/masjidRoutes"));
app.use("/api/donate", require("./routes/donateRoutes"));
app.use("/api/ads", require("./routes/adRoutes"));

// ======================================
// ADMIN & WEB FRAMEWORK ROUTES
// ======================================
app.use("/admin", require("./routes/adminRoutes"));
app.use("/", require("./routes/frontedRoutes"));

// ======================================
// ENGINE START SYSTEM
// ======================================
const PORT = process.env.PORT || 5000;

// ✅ FIXED: Initializing via 'server.listen' instead of 'app.listen' to ensure Express handles WebSockets alongside standard API routing bindings
server.listen(PORT, () => {
  console.log(`🚀 Unified Node Engine deployed flawlessly on port ${PORT}`);
});
