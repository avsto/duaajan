require("dotenv").config();
require("./firebase");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ======================
// SOCKET.IO SETUP
// ======================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ======================
// MIDDLEWARE
// ======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// DATABASE CONNECTION
// ======================
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Mongo Connected"))
  .catch((err) => console.log("❌ Mongo Error:", err));

// ======================
// STATIC FILES
// ======================
app.use("/uploads", express.static("uploads"));

// ======================
// ROUTES
// ======================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/masjid", require("./routes/masjidRoutes"));
app.use("/api/donate", require("./routes/donateRoutes"));

// ======================
// SOCKET MODULE
// ======================
require("./socket/liveAudio")(io);

// ======================
// HEALTH CHECK (IMPORTANT)
// ======================
app.get("/", (req, res) => {
  res.send("🚀 Server is running fine");
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});