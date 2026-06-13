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

connectDB();

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URL,
      collectionName: "sessions",
    }),
  }),
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/masjid", require("./routes/masjidRoutes"));
app.use("/api/donate", require("./routes/donateRoutes"));
app.use("/api/ads", require("./routes/adRoutes"));

app.use("/admin", require("./routes/adminRoutes"));
app.use("/", require("./routes/frontedRoutes"));

async function start() {
  try {
    const io = require("socket.io")(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      allowEIO3: true,
    });

    const pubClient = createClient({
      url: process.env.REDIS_URL,
    });
    
    // 
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));

    console.log("✅ Redis Adapter Connected");

    const { initWebRTCSignaling } = require("./socket/webrtcSignaling");

    initWebRTCSignaling(io, pubClient);

    server.listen(process.env.PORT || 5000, () => {
      console.log("🚀 Server Started");
    });
  } catch (err) {
    console.log(err);
  }
}

start();
