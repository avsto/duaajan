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
  cors: {
    origin: "*",
  },
});

// =========================================
// 🔌 SOCKET.IO CONNECTION
// =========================================

const broadcasters = {};

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  // START BROADCAST

  socket.on("broadcaster", ({ roomId }) => {

    broadcasters[roomId] = socket.id;

    socket.join(roomId);

    console.log(
      "Broadcaster Started:",
      roomId
    );

  });

  // VIEWER JOIN

  socket.on("viewer", ({ roomId }) => {

    socket.join(roomId);

    console.log(
      "Viewer Joined:",
      socket.id
    );

    const broadcasterId =
      broadcasters[roomId];

    if (broadcasterId) {

      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });

    } else {

      io.to(socket.id).emit(
        "broadcast-not-found"
      );

    }

  });

  // OFFER

  socket.on("offer", ({
    target,
    offer,
  }) => {

    io.to(target).emit("offer", {
      sender: socket.id,
      offer,
    });

  });

  // ANSWER

  socket.on("answer", ({
    target,
    answer,
  }) => {

    io.to(target).emit("answer", {
      sender: socket.id,
      answer,
    });

  });

  // ICE CANDIDATE

  socket.on("candidate", ({
    target,
    candidate,
  }) => {

    if (target) {

      io.to(target).emit("candidate", {
        sender: socket.id,
        candidate,
      });

    }

  });

  // STOP BROADCAST

  socket.on("stop-broadcast", ({
    roomId,
  }) => {

    console.log(
      "Broadcast Stopped:",
      roomId
    );

    io.to(roomId).emit(
      "broadcast-stopped"
    );

    delete broadcasters[roomId];

  });

  // DISCONNECT

  socket.on("disconnect", () => {

    console.log(
      "Disconnected:",
      socket.id
    );

    for (let roomId in broadcasters) {

      if (
        broadcasters[roomId] === socket.id
      ) {

        io.to(roomId).emit(
          "broadcast-stopped"
        );

        delete broadcasters[roomId];

      }

    }

  });

});

// =========================================
// 🔌 SOCKET.IO CONNECTION
// =========================================

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("Mongo Connected"))
  .catch((err) => console.log(err));

app.use("/uploads", express.static("uploads"));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/masjid", require("./routes/masjidRoutes"));
app.use("/api/donate", require("./routes/donateRoutes"));


const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
