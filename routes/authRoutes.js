const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const upload = require("../middleware/upload");
const User = require("../models/User");
const auth = require("../middleware/auth");
const axios = require("axios");
router.post(
  "/register",
  upload.fields([
    {
      name: "photo",
      maxCount: 1,
    },

    {
      name: "document",
      maxCount: 1,
    },

    {
      name: "committeeMember1Document",
      maxCount: 1,
    },

    {
      name: "committeeMember2Document",
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    try {
      const body = req.body;

      let user = await User.findOne({ mobile: body.mobile });

      if (user) {
        return res.status(404).json({
          success: false,
          message: "User found",
        });
      } else {
        user = new User({
          mobile: body.mobile,
        });
      }

      // ===================================
      // USER
      // ===================================

      if (body.role === "user") {
        user.name = body.name;

        user.location = body.location;

        user.role = "user";

        user.status = "approved";
        user.fcmToken = body?.fcmToken;
      }

      // ===================================
      // MASJID
      // ===================================

      if (body.role === "masjid") {
        user.role = "masjid";

        user.masjidName = body.masjidName;

        user.imamName = body.imamName;

        user.email = body.email;

        user.address = body.address;

        user.pincode = body.pincode;

        user.committeeMember1 = body.committeeMember1;

        user.committeeMember2 = body.committeeMember2;

        // FILES

        user.photo = req.files.photo?.[0]?.path;

        user.document = req.files.document?.[0]?.path;

        user.committeeMember1Document =
          req.files.committeeMember1Document?.[0]?.path;

        user.committeeMember2Document =
          req.files.committeeMember2Document?.[0]?.path;

        user.status = "pending";
      }

      await user.save();

      res.json({
        success: true,
        message: "Registered Successfully",
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

router.post("/send-otp", async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile required",
      });
    }

    // ======================================
    // GENERATE OTP
    // ======================================

    const otp = "1111"; //Math.floor(1000 + Math.random() * 9000).toString();

    // ======================================
    // FIND USER
    // ======================================

    let user = await User.findOne({ mobile });

    // ======================================
    // CREATE USER IF NOT EXISTS
    // ======================================

    if (!user) {
      user = await User.create({
        mobile,
      });
    }

    // ======================================
    // SAVE OTP
    // ======================================

    user.otp = otp;

    user.otpExpire = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();

     const smsResponse = await axios.get(
          "https://bhashsms.com/api/sendmsgutil.php",
          {
            params: {
              user: "Dua_2",
              pass: "123456", // actual password
              sender: "BUZWAP",
              phone: mobile,
              text: "auth_01",
              priority: "wa",
              stype: "auth",
              Params: otp,
            },
          },
        );

    // ======================================
    // SMS SEND HERE
    // ======================================

    console.log("OTP:", otp);

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ======================================
// VERIFY OTP
// ======================================

router.post("/verify-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    // ======================================
    // FIND USER
    // ======================================

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ======================================
    // INVALID OTP
    // ======================================

    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // ======================================
    // OTP EXPIRED
    // ======================================

    if (new Date() > user.otpExpire) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // ======================================
    // CLEAR OTP
    // ======================================

    user.otp = null;
    user.otpExpire = null;

    await user.save();

    // ======================================
    // JWT TOKEN
    // ======================================

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "30d",
      },
    );

    // ======================================
    // CHECK PROFILE COMPLETED
    // ======================================

    let profileCompleted = false;

    if (user.role === "user" && user.name) {
      profileCompleted = true;
    }

    if (user.role === "masjid" && user.masjidName) {
      profileCompleted = true;
    }

    res.json({
      success: true,

      message: "Login successful",

      token,

      profileCompleted,

      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get(
  "/me",

  auth,

  async (req, res) => {
    try {
      const user = await User.findById(req.user._id)

        .populate({
          path: "selectedMasjid",

          select: `
            masjidName
            imamName
            photo
            address
            isLive
          `,
        });

      res.json({
        success: true,

        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        message: error.message,
      });
    }
  },
);

router.post("/save-fcm", auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      fcmToken,
    });

    res.json({
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
    });
  }
});

module.exports = router;
