// server.js
require("dotenv").config();
require("./firebase");

const path = require("path");
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const session = require("express-session");
const { MongoStore } = require("connect-mongo"); // ✅ FIXED: Standard syntax adjustment for older destructured exports
const http = require("http");

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");

// ======================================
// DATABASE
// ======================================
connectDB();

// ======================================
// WEBSOCKET SIGNALING SERVER (INTEGRATED)
// ======================================
// Shared native instance running directly on Express HTTP engine (Port 5000 / Proxy Target

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const { initWebRTCSignaling } = require("./socket/webrtcEngine");

initWebRTCSignaling(io);

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
      secure: false, // Set to true if active over native remote production SSL setups
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

server.listen(PORT, () => {
  console.log(`🚀 Unified Node Engine deployed flawlessly on port ${PORT}`);
});
