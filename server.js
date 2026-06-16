// server.js

require("dotenv").config();
require("./firebase");

const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const connectDB = require("./config/db");

const app = express();
const server = http.createServer(app);

// ==========================
// DB
// ==========================
connectDB();

// ==========================
// MIDDLEWARE
// ==========================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.JWT_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL,
    }),
  }),
);

// ======================================
// VIEW ENGINE CONFIGURATION
// ======================================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================
// ROUTES
// ==========================
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

// ==========================
// SOCKET + REDIS
// ==========================
async function start() {
  const io = require("socket.io")(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // 🔴 Redis (IMPORTANT FIX)
  const pubClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    },
  });

  const subClient = pubClient.duplicate();

  pubClient.on("error", (err) => {
    console.log("Redis Error:", err);
  });

  await pubClient.connect();
  await subClient.connect();

  io.adapter(createAdapter(pubClient, subClient));

  console.log("✅ Redis Connected");

  // WebRTC signaling
  const { initWebRTCSignaling } = require("./socket/webrtcSignaling");
  initWebRTCSignaling(io, pubClient);

  // START SERVER
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log("🚀 Server running on", PORT);
  });
}

start();
