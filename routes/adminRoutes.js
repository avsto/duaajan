const express = require("express");
const router = express.Router();

const User = require("../models/User");

// =========================
// LOGIN PAGE
// =========================
router.get("/", (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }

  res.render("admin/login");
});

// =========================
// SEND OTP
// =========================
router.post("/send-otp", async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Phone number required",
      });
    }

    const admin = await User.findOne({
      mobile,
      role: "admin",
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const otp = '1111'; //Math.floor(100000 + Math.random() * 900000).toString();

    admin.otp = otp;
    admin.otpExpire = new Date(Date.now() + 5 * 60 * 1000);

    await admin.save();

    console.log("OTP:", otp);

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// =========================
// VERIFY OTP
// =========================
router.post("/verify-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    const admin = await User.findOne({
      mobile,
      role: "admin",
    }).select("+otp +otpExpire");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (admin.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (new Date() > admin.otpExpire) {
      return res.status(400).json({
        success: false,
        message: "OTP Expired",
      });
    }

    admin.otp = null;
    admin.otpExpire = null;

    await admin.save();

    req.session.admin = {
      id: admin._id,
      mobile: admin.mobile,
      role: admin.role,
    };

    return res.json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// =========================
// DASHBOARD
// =========================
router.get("/dashboard", async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect("/admin");
    }

    // dynamic stats
    const users = await User.countDocuments({
      role: "user",
    });

    const liveUsers = await User.countDocuments({
      role: "user",
      isLive: true,
    });

    const masjids = await User.countDocuments({
      role: "masjid",
    });

    const stats = {
      users,
      liveUsers,
      masjids,
    };

    res.render("admin/dashboard", {
      stats,
    });
  } catch (error) {
    console.log(error);

    res.send("Server Error");
  }
});

// =========================
// USERS
// =========================
router.get("/users", async (req, res) => {

  const users = await User.find({
    role: "user"
  }).sort({ createdAt: -1 });

  res.render("admin/users", {
    users
  });

});
// =========================
// MASJIDS
// =========================
router.get("/masjids", async (req, res) => {

  const masjids = await User.find({
    role: "masjid"
  }).sort({
    createdAt: -1
  });

  res.render("admin/masjids", {
    masjids
  });

});

// =========================
// UPDATE MASJID STATUS
// =========================
router.post("/masjids/:id/status", async (req, res) => {

  const { status } = req.body;

  await User.findByIdAndUpdate(
    req.params.id,
    { status }
  );

  res.json({
    success: true
  });

});

// =========================
// LOGOUT
// =========================
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin");
  });
});

module.exports = router;
