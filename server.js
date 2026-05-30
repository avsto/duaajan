require("dotenv").config();
require("./firebase");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const session = require("express-session");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(
  session({
    secret: "duaajan-secret",
    resave: false,
    saveUninitialized: true,
  }),
);
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
app.use("/api/donate", require("./routes/donateRoutes"));

// =========================

// view engine
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/admin", require("./routes/adminRoutes"));

// Render the index.ejs file when the root URL is accessed

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
