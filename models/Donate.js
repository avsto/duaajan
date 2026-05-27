const mongoose = require("mongoose");

const donateSchema = new mongoose.Schema(
  {
    // ============================
    // USER
    // ============================

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ============================
    // DONATION INFO
    // ============================

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    message: {
      type: String,
      default: "",
    },

    anonymous: {
      type: Boolean,
      default: false,
    },

    // ============================
    // PAYMENT
    // ============================

    paymentMethod: {
      type: String,
      default: "razorpay",
    },

    orderId: {
      type: String,
      default: "",
    },

    paymentId: {
      type: String,
      default: "",
    },

    signature: {
      type: String,
      default: "",
    },

    paymentStatus: {
      type: String,

      enum: ["pending", "success", "failed"],

      default: "pending",
    },

    // ============================
    // MASJID (OPTIONAL)
    // ============================

    masjidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Donate", donateSchema);
