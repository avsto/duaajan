require("dotenv").config();
require("./firebase");

const path = require("path");
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const session = require("express-session");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ======================================
// DATABASE
// ======================================

connectDB();

// ======================================
// SOCKET.IO
// ======================================

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

require("./socket/liveAudio")(io);

// ======================================
// MIDDLEWARES
// ======================================

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
    },
  })
);

// ======================================
// VIEW ENGINE
// ======================================

app.set("view engine", "ejs");

app.set(
  "views",
  path.join(__dirname, "views")
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// ======================================
// API ROUTES
// ======================================

app.use("/api/auth",require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/masjid",require("./routes/masjidRoutes"));
app.use("/api/donate",require("./routes/donateRoutes"));
app.use("/api/ads", require("./routes/adRoutes"));
// ======================================
// ADMIN ROUTES
// ======================================

app.use("/admin",require("./routes/adminRoutes"));

// ======================================
// HOME ROUTE
// ======================================

app.get("/", (req, res) => {
  res.send("🚀 DuaAjan API Running");
});

// ======================================
// START SERVER
// ======================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});