const mongoose = require("mongoose");

const liveReportSchema = new mongoose.Schema(
  {
    masjidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    roomId: {
      type: String,
      required: true,
      index: true,
    },

    broadcasterSocketId: {
      type: String,
      default: null,
    },

    prayerType: {
      type: String,
      enum: ["fajr", "zuhr", "asr", "maghrib", "isha", "general"],
      default: "general",
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number,
      default: 0,
    },

    listeners: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    totalListeners: {
      type: Number,
      default: 0,
    },

    maxListeners: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["live", "completed"],
      default: "live",
    },

    isLive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("LiveReport", liveReportSchema);
