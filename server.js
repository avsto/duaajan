// server.js

require("dotenv").config();
require("./firebase");

const path = require("path");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const http = require("http");

const connectDB = require("./config/db");

const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const app = express();
const server = http.createServer(app);

// ======================================
// DATABASE
// ======================================
connectDB();

// ======================================
// MIDDLEWARES
// ======================================
app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  }),
);

// ======================================
// SESSION
// ======================================
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
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: false,
    },
  }),
);

// ======================================
// VIEW ENGINE
// ======================================
app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================================
// API ROUTES
// ======================================
app.use("/api/auth", require("./routes/authRoutes"));

app.use("/api/user", require("./routes/userRoutes"));

app.use("/api/masjid", require("./routes/masjidRoutes"));

app.use("/api/donate", require("./routes/donateRoutes"));

app.use("/api/ads", require("./routes/adRoutes"));

// ======================================
// WEB ROUTES
// ======================================
app.use("/admin", require("./routes/adminRoutes"));

app.use("/", require("./routes/frontedRoutes"));

// ======================================
// START SERVER
// ======================================
async function startServer() {
  try {
    // ================================
    // SOCKET.IO
    // ================================
    const io = require("socket.io")(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      allowEIO3: true,
    });

    // ================================
    // REDIS ADAPTER
    // ================================
    const pubClient = createClient({
      url: process.env.REDIS_URL,
    });

    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));

    console.log("✅ Redis Adapter Connected");

    // ================================
    // WEBRTC SIGNALING
    // ================================
    const { initWebRTCSignaling } = require("./socket/webrtcSignaling");

    initWebRTCSignaling(io);

    // ================================
    // START LISTEN
    // ================================
    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(`🚀 Server started on ${PORT}`);
    });
  } catch (err) {
    console.log("Server Start Error:", err);
  }
}

startServer();
