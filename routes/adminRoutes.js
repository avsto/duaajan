const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Ad = require("../models/Ad");
const axios = require("axios");
const adminAuth = require("../middleware/adminAuth");

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

    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    admin.otp = otp;

    admin.otpExpire = new Date(Date.now() + 5 * 60 * 1000);

    await admin.save();

    // Send WhatsApp/SMS OTP
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

    console.log("OTP:", otp);
    console.log("SMS Response:", smsResponse.data);

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.log("OTP Error:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
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
    });

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

    if (!admin.otpExpire || new Date() > admin.otpExpire) {
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
      name: admin.name || "Admin",
    };

    req.session.save((err) => {
      if (err) {
        console.log(err);

        return res.status(500).json({
          success: false,
          message: "Session Error",
        });
      }

      return res.json({
        success: true,
        message: "Login Successful",
      });
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
router.get("/dashboard", adminAuth, async (req, res) => {
  try {
    
    const admin = await User.findById(req.session.admin.id).lean();

    const [users, liveUsers, masjids, ads] = await Promise.all([
      User.countDocuments({
        role: "user",
      }),

      User.countDocuments({
        role: "user",
        isLive: true,
      }),

      User.countDocuments({
        role: "masjid",
      }),

      Ad.countDocuments(),
    ]);

    const stats = {
      users,
      liveUsers,
      masjids,
      ads,
    };

    res.render("admin/dashboard", {
      admin,
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
router.get("/users", adminAuth, async (req, res) => {
  try {
   
    const page = parseInt(req.query.page) || 1;

    const limit = 20;

    const search = req.query.search || "";

    const query = {
      role: "user",
    };

    // Search

    if (search.trim()) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          mobile: {
            $regex: search,
            $options: "i",
          },
        },
        {
          location: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const totalUsers = await User.countDocuments(query);

    const totalPages = Math.ceil(totalUsers / limit);

    const users = await User.find(query)

      .sort({
        createdAt: -1,
      })

      .skip((page - 1) * limit)

      .limit(limit)

      .lean();

    return res.render("admin/users", {
      users,
      page,
      totalPages,
      totalUsers,
      search,
    });
  } catch (error) {
    console.log(error);

    return res.send("Server Error");
  }
});

// =========================
// DELETE USER
// =========================

router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: "User deleted successfully",
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
// MASJIDS
// =========================
// =========================
// MASJIDS LIST
// =========================

router.get("/masjids", adminAuth, async (req, res) => {
  try {
    
    const page = parseInt(req.query.page) || 1;

    const limit = 20;

    const search = req.query.search || "";

    const query = {
      role: "masjid",
    };

    if (search.trim()) {
      query.$or = [
        {
          masjidName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          imamName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          mobile: {
            $regex: search,
            $options: "i",
          },
        },
        {
          address: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const totalMasjids = await User.countDocuments(query);

    const totalPages = Math.ceil(totalMasjids / limit);

    const masjids = await User.find(query)

      .sort({
        createdAt: -1,
      })

      .skip((page - 1) * limit)

      .limit(limit)

      .lean();

    res.render("admin/masjids", {
      masjids,
      page,
      totalPages,
      totalMasjids,
      search,
    });
  } catch (error) {
    console.log(error);

    res.send("Server Error");
  }
});

// =========================
// UPDATE MASJID STATUS
// =========================

router.post("/masjids/:id/status", adminAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
      });
    }

    await User.findByIdAndUpdate(req.params.id, {
      status,
    });

    return res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
    });
  }
});

// =========================
// DELETE MASJID
// =========================

router.delete("/masjids/:id", adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
    });
  }
});

// =========================
// ADS LIST
// =========================

router.get("/ads", adminAuth, async (req, res) => {
  try {
    
    const ads = await Ad.find().sort({ createdAt: -1 }).lean();

    res.render("admin/ads", {
      ads,
    });
  } catch (error) {
    console.log(error);

    res.send("Server Error");
  }
});

router.delete("/ads/:id", adminAuth, async (req, res) => {
  try {
    
    await Ad.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
    });
  }
});

router.get("/ads/create", adminAuth, (req, res) => {
  res.render("admin/create-ad");
});

router.post("/ads/create", adminAuth, async (req, res) => {
  try {
    const ad = await Ad.create(req.body);

    return res.json({
      success: true,
      ad,
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
// EDIT AD PAGE
// =========================
router.get("/ads/edit/:id", adminAuth, async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.send("Advertisement not found");
    }

    res.render("admin/edit-ad", {
      ad,
    });
  } catch (error) {
    console.log(error);
    res.send("Server Error");
  }
});

router.put("/ads/:id", adminAuth, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json({
      success: true,
      ad,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
    });
  }
});
// =========================
// update ad status
// =========================
router.put("/ads/:id", adminAuth, async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true });

    res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
    });
  }
});
// =========================
// LOGOUT
// =========================
router.get("/logout", adminAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin");
  });
});

module.exports = router;
