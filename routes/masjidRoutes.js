const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const User = require("../models/User");

const admin = require("firebase-admin");

const upload = require("../middleware/upload");

const LiveReport = require("../models/LiveReport");
// ======================================
// GET MASJID LIST
// ======================================

router.get("/list", auth, async (req, res) => {
  try {
    const masjids = await User.find({
      role: "masjid",
    })
      .select("-otp -otpExpire")
      .sort({
        createdAt: -1,
      });

    res.json({
      success: true,
      count: masjids.length,
      masjids,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ======================================
// MASJID LIVE START
// ======================================

router.post("/live-start", auth, async (req, res) => {
  try {
    const masjidId = req.user._id;
    const { prayerType } = req.body;

    const validPrayers = ["fajr", "zuhr", "asr", "maghrib", "isha", "general"];

    if (!prayerType || !validPrayers.includes(prayerType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid prayer type",
      });
    }

    // CREATE LIVE REPORT (IMPORTANT FIX: status only)
    const report = await LiveReport.create({
      masjidId,
      roomId: String(masjidId),
      prayerType,
      startTime: new Date(),
      status: "live",
    });

    await User.findByIdAndUpdate(masjidId, {
      isLive: true,
      currentLiveReport: report._id,
    });

    // USERS
    const users = await User.find({
      role: "user",
      selectedMasjid: masjidId,
      [`prayers.${prayerType}`]: true,
      fcmToken: { $exists: true, $ne: "" },
    });

    let successCount = 0;
    let failedCount = 0;

    for (const user of users) {
      try {
        await admin.messaging().send({
          token: user.fcmToken,
          notification: {
            title: `${prayerType.toUpperCase()} Live Started`,
            body: "Tap to join live Azaan",
          },
          data: {
            type: "LIVE_START",
            masjidId: String(masjidId),
            roomId: String(masjidId),
            reportId: String(report._id),
          },
        });

        successCount++;
      } catch (err) {
        failedCount++;
      }
    }

    return res.json({
      success: true,
      reportId: report._id,
      successCount,
      failedCount,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false });
  }
});

router.post(
  "/update-masjid-details",
  auth,
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "committeeMember1Document", maxCount: 1 },
    { name: "committeeMember2Document", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const updateData = {
        address: req.body.address,
        pincode: req.body.pincode,
        committeeMember1: req.body.committeeMember1,
        committeeMember2: req.body.committeeMember2,
      };

      if (req.files?.document?.[0]) {
        updateData.document = req.files.document[0].filename;
      }

      if (req.files?.committeeMember1Document?.[0]) {
        updateData.committeeMember1Document =
          req.files.committeeMember1Document[0].filename;
      }

      if (req.files?.committeeMember2Document?.[0]) {
        updateData.committeeMember2Document =
          req.files.committeeMember2Document[0].filename;
      }

      const masjid = await User.findByIdAndUpdate(
        req.user._id,
        {
          $set: updateData,
        },
        {
          new: true,
        },
      );

      return res.json({
        success: true,
        message: "Masjid details updated successfully",
        data: masjid,
      });
    } catch (error) {
      console.log(error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

module.exports = router;
