const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const User = require("../models/User");

const admin = require("../firebase");


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

      const validPrayers = [
        "fajr",
        "zuhr",
        "asr",
        "maghrib",
        "isha",
      ];

      if (
        !prayerType ||
        !validPrayers.includes(prayerType)
      ) {

        return res.status(400).json({
          success: false,
          message: "Invalid prayer type",
        });
      }

      // ==================================
      // FIND USERS
      // ==================================

      const users = await User.find({
        role: "user",
        selectedMasjid: masjidId, [`prayers.${prayerType}`]: true,
        fcmToken: {
          $ne: null,
        },
      });

      console.log(
        "Users Found:",
        users.length,
      );

      // ==================================
      // SEND PUSH
      // ==================================

      for (const user of users) {

        try {

          await admin
            .messaging()
            .send({

              token: user.fcmToken,

              data: {
                type: "LIVE_START",

                masjidId: String(
                  masjidId,
                ),

                prayerstype:
                  prayerType,
              },

              notification: {
                title:
                  prayerType.toUpperCase() +
                  " Live Started",

                body:
                  "Tap to join live Ajan",
              },

              android: {
                priority: "high",
              },

              apns: {
                payload: {
                  aps: {
                    sound: "default",
                  },
                },
              },
            });

          console.log(
            "Notification Sent:",
            user.mobile,
          );

        } catch (error) {

          console.log(
            "FCM Error:",
            error.message,
          );
        }
      }

      // ==================================
      // RESPONSE
      // ==================================

      res.json({
        success: true,
        message:
          "Live notification sent",
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

module.exports = router;