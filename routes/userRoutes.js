const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const User = require("../models/User");

// ======================================
// SELECT MASJID
// ======================================

router.post("/select-masjid", auth, async (req, res) => {
  try {
    const { masjidId } = req.body;

    const masjid = await User.findOne({ _id: masjidId, role: "masjid" });

    if (!masjid) {
      return res.status(404).json({
        success: false,
        message: "Masjid not found",
      });
    }

    req.user.selectedMasjid = masjidId;

    await req.user.save();

    res.json({
      success: true,
      message: "Masjid selected successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post("/update-prayer", auth, async (req, res) => {
  try {
    const { prayer, status } = req.body;

    // only masjid

    if (req.user.role === "user") {
      return res.status(403).json({
        success: false,
        message: "Only masjid allowed",
      });
    }

    // valid prayer check

    const validPrayers = ["fajr", "zuhr", "asr", "maghrib", "isha"];

    if (!validPrayers.includes(prayer)) {
      return res.status(400).json({
        success: false,
        message: "Invalid prayer",
      });
    }

    // update

    req.user.prayers[prayer] = status;

    await req.user.save();

    res.json({
      success: true,

      message: `${prayer} updated`,

      prayers: req.user.prayers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,

      message: error.message,
    });
  }
});

module.exports = router;
