const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: null,
    },

    video: {
      type: String,
      default: null,
    },

    redirectUrl: {
      type: String,
      default: null,
    },

    advertiserName: {
      type: String,
      default: "",
    },

    advertiserMobile: {
      type: String,
      default: "",
    },

    adType: {
      type: String,
      enum: ["banner", "popup", "video", "slider"],
      default: "banner",
    },

    position: {
      type: String,
      enum: [
        "home_top",
        "home_bottom",
        "live_screen",
        "masjid_screen",
        "donation_screen",
      ],
      default: "home_top",
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    impressions: {
      type: Number,
      default: 0,
    },

    clicks: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Ad", adSchema);
