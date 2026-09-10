
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
      min: 1,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
    },

    message: {
      type: String,
      default: "",
      trim: true,
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
      trim: true,
    },

    orderId: {
      type: String,
      default: "",
      trim: true,
    },

    paymentId: {
      type: String,
      default: "",
      trim: true,
    },

    signature: {
      type: String,
      default: "",
      trim: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },

    // ============================
    // MASJID
    // ============================

    masjidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ============================
    // PAYOUT
    // ============================

    payoutStatus: {
      type: String,
      enum: ["none", "pending", "success", "failed"],
      default: "none",
    },

    payoutAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    payoutNote: {
      type: String,
      default: "",
      trim: true,
    },

    payoutDate: {
      type: Date,
      default: null,
    },

    payoutProcessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


// ============================
// INDEXES
// ============================

// Masjid ke donation history ke liye
donateSchema.index({
  masjidId: 1,
  paymentStatus: 1,
  createdAt: -1,
});

// User ke donations ke liye
donateSchema.index({
  userId: 1,
  createdAt: -1,
});

// Payout history ke liye
donateSchema.index({
  masjidId: 1,
  payoutStatus: 1,
  payoutDate: -1,
});


// ============================
// MODEL
// ============================

module.exports = mongoose.model("Donate", donateSchema);
