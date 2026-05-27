const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // =================================
    // COMMON
    // =================================

    role: {
      type: String,
      enum: ["admin", "masjid", "user"],
      default: "user",
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
    },

    otp: {
      type: String,
      default: null,
    },

    otpExpire: {
      type: Date,
      default: null,
    },

    // =================================
    // USER
    // =================================

    name: {
      type: String,

      required: function () {
        return this.role === "user";
      },
    },

    location: {
      type: String,

      required: function () {
        return this.role === "user";
      },
    },

    // =================================
    // MASJID
    // =================================

    masjidName: {
      type: String,

      required: function () {
        return this.role === "masjid";
      },
    },

    imamName: {
      type: String,

      required: function () {
        return this.role === "masjid";
      },
    },

    email: {
      type: String,

      required: function () {
        return this.role === "masjid";
      },
    },

    photo: {
      type: String,
      default: null,
    },

    address: {
      type: String,

      required: function () {
        return this.role === "masjid";
      },
    },

    pincode: {
      type: String,

      required: function () {
        return this.role === "masjid";
      },
    },

    document: {
      type: String,
      default: null,
    },

    committeeMember1: {
      type: String,
      default: null,
    },

    committeeMember1Document: {
      type: String,
      default: null,
    },

    committeeMember2: {
      type: String,
      default: null,
    },

    committeeMember2Document: {
      type: String,
      default: null,
    },

    // =================================

    status: {
      type: String,

      enum: ["pending", "approved", "rejected"],

      default: "pending",
    },

    isLive: {
      type: Boolean,
      default: false,
    },

    fcmToken: {
      type: String,
      default: null,
    },

    selectedMasjid: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "User",

      default: null,
    },

    prayers: {
      fajr: {
        type: Boolean,
        default: false,
      },

      zuhr: {
        type: Boolean,
        default: false,
      },

      asr: {
        type: Boolean,
        default: false,
      },

      maghrib: {
        type: Boolean,
        default: false,
      },

      isha: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
