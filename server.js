require("dotenv").config();
require("./firebase");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// =========================
// SOCKET IMPORT
// =========================
require("./socket/liveAudio")(io);

// =========================
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo Connected"))
  .catch(console.log);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/masjid", require("./routes/masjidRoutes"));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});