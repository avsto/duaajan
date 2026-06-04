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

    // ==================================
    // VALIDATION
    // ==================================

    const validPrayers = ["fajr", "zuhr", "asr", "maghrib", "isha", "general"];

    if (!prayerType || !validPrayers.includes(prayerType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid prayer type",
      });
    }

    console.log("=================================");
    console.log("Live Start Request");
    console.log("Masjid ID:", masjidId);
    console.log("Prayer Type:", prayerType);
    console.log("=================================");

    // ==================================
    // FIND USERS
    // ==================================

    const users = await User.find({
      role: "user",
      selectedMasjid: masjidId,
      [`prayers.${prayerType}`]: true,
      fcmToken: {
        $exists: true,
        $ne: null,
        $ne: "",
      },
    });

    console.log("Users Found:", users.length);

    users.forEach((user) => {
      console.log({
        mobile: user.mobile,
        token: user.fcmToken
          ? user.fcmToken.substring(0, 30) + "..."
          : "No Token",
      });
    });

    // ==================================
    // CREATE LIVE REPORT
    // ==================================

    const report = await LiveReport.create({
      masjidId,
      roomId: String(masjidId),
      prayerType,
      startTime: new Date(),
      isLive: true,
    });

    await LiveReport.findByIdAndUpdate(report._id, {
      $inc: {
        totalListeners: 1,
      },
    });

    // ==================================
    // UPDATE MASJID STATUS
    // ==================================

    await User.findByIdAndUpdate(masjidId, {
      isLive: true,
      currentLiveReport: report._id,
    });

    // ==================================
    // NO USERS FOUND
    // ==================================

    if (users.length === 0) {
      return res.json({
        success: true,
        message: "No subscribed users found",
      });
    }

    // ==================================
    // SEND FCM
    // ==================================

    let successCount = 0;
    let failedCount = 0;

    for (const user of users) {
      try {
        const message = {
          token: user.fcmToken,

          notification: {
            title: `${prayerType.toUpperCase()} Live Started`,
            body: "Tap to join live Azaan",
          },

          data: {
            type: "LIVE_START",
            masjidId: String(masjidId),
            prayerType: String(prayerType),
            reportId: String(report._id),
          },

          android: {
            priority: "high",
            notification: {
              channelId: "default",
              sound: "default",
            },
          },

          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        };

        const response = await admin.messaging().send(message);

        console.log(`Notification Sent To ${user.mobile} :`, response);

        successCount++;
      } catch (error) {
        failedCount++;

        console.log("=================================");
        console.log("FCM ERROR");
        console.log("User:", user.mobile);
        console.log("Token:", user.fcmToken);
        console.log("Code:", error.code);
        console.log("Message:", error.message);
        console.log(error);
        console.log("=================================");

        // Invalid token remove
        if (
          error.code === "messaging/registration-token-not-registered" ||
          error.code === "messaging/invalid-registration-token"
        ) {
          await User.findByIdAndUpdate(user._id, {
            $unset: {
              fcmToken: 1,
            },
          });

          console.log("Invalid token removed for:", user.mobile);
        }
      }
    }

    // ==================================
    // RESPONSE
    // ==================================

    return res.json({
      success: true,
      message: "Live notification process completed",
      totalUsers: users.length,
      successCount,
      failedCount,
      reportId: report._id,
    });
  } catch (error) {
    console.log("LIVE START ERROR");
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
