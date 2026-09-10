const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const User = require("../models/User");
const Ad = require("../models/Ad");
const axios = require("axios");
const adminAuth = require("../middleware/adminAuth");
const LiveReport = require("../models/LiveReport");
const Donate = require("../models/Donate");
const AppSetting = require("../models/AppSetting");
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

    const [users, donationData, masjids, ads] = await Promise.all([
      User.countDocuments({
        role: "user",
      }),

      Donate.aggregate([
        {
          $match: {
            paymentStatus: "success",
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: "$amount",
            },
          },
        },
      ]),

      User.countDocuments({
        role: "masjid",
      }),

      Ad.countDocuments(),
    ]);

    const donateAmount =
      donationData.length > 0 ? donationData[0].totalAmount : 0;
    let settings = await AppSetting.findOne();
    if (!settings) {
      settings = await AppSetting.create({});
    }

    const stats = {
      users,
      donateAmount,
      masjids,
      ads,
      settings,
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

router.get("/donations", adminAuth, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;
  const search = req.query.search || "";

  const query = {};

  const [donations, totalDonations] = await Promise.all([
    Donate.find(query)
      .populate("userId", "name mobile")
      .populate("masjidId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Donate.countDocuments(query),
  ]);

  const successDonations = await Donate.countDocuments({
    paymentStatus: "success",
  });

  // ✅ ADD THIS (important)
  const totalAmountAgg = await Donate.aggregate([
    { $match: { paymentStatus: "success" } },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  const totalAmount = totalAmountAgg.length > 0 ? totalAmountAgg[0].total : 0;

  res.render("admin/donations", {
    donations,
    page,
    search,
    totalDonations,
    successDonations,
    totalAmount, // ✅ now defined
    totalPages: Math.ceil(totalDonations / limit),
  });
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
// AJAN HISTORY
// =========================
router.get("/masjids/:id/ajan-history", adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;

    const limit = 20;

    const skip = (page - 1) * limit;

    const masjid = await User.findById(req.params.id);

    if (!masjid) {
      return res.send("Masjid not found");
    }

    const totalRecords = await LiveReport.countDocuments({
      masjidId: req.params.id,
    });

    const ajanHistory = await LiveReport.find({
      masjidId: req.params.id,
    })
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit);

    res.render("admin/ajan-history", {
      masjid,
      ajanHistory,
      currentPage: page,
      totalPages,
      totalRecords,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send(error.message);
  }
});

// ============================================================
// GET PAYOUT PAGE
// ============================================================

router.post("/masjids/:id/payout-settings", adminAuth, async (req, res) => {
    try {
      // ==================================================
      // MASJID ID
      // ==================================================

      const { id } = req.params;

      console.log(`Updating payout settings for masjid ID: ${id} with body:`, req.body);

      // ==================================================
      // VALIDATE OBJECT ID
      // ==================================================

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid masjid ID.",
        });
      }

      // ==================================================
      // REQUEST BODY
      // ==================================================

      const { walletAccepted, walletAcceptedAmount } = req.body;

      // ==================================================
      // TYPE VALIDATION
      // ==================================================

      if (!["fixed", "percentage"].includes(walletAccepted)) {
        return res.status(400).json({
          success: false,
          message: "Invalid wallet acceptance type. Use fixed or percentage.",
        });
      }

      // ==================================================
      // AMOUNT VALIDATION
      // ==================================================

      const amount = Number(walletAcceptedAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Wallet accepted amount must be greater than 0.",
        });
      }

      // ==================================================
      // PERCENTAGE VALIDATION
      // ==================================================

      if (walletAccepted === "percentage" && amount > 100) {
        return res.status(400).json({
          success: false,
          message: "Percentage cannot be greater than 100.",
        });
      }

      // ==================================================
      // ROUND AMOUNT
      // ==================================================

      const finalAmount = Math.round((amount + Number.EPSILON) * 100) / 100;

      // ==================================================
      // FIND MASJID
      // ==================================================
      //
      // Masjid is stored in User collection.
      //

      const masjid = await User.findOne({
        _id: id,
        role: "masjid",
      });

      if (!masjid) {
        return res.status(404).json({
          success: false,
          message: "Masjid not found.",
        });
      }

      // ==================================================
      // UPDATE SETTINGS
      // ==================================================

      masjid.walletAccepted = walletAccepted;

      masjid.walletAcceptedAmount = finalAmount;

      await masjid.save();

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.status(200).json({
        success: true,

        message: "Wallet settings updated successfully.",

        masjid: {
          _id: masjid._id,

          walletAccepted: masjid.walletAccepted,

          walletAcceptedAmount: masjid.walletAcceptedAmount,
        },
      });
    } catch (error) {
      // ==================================================
      // ERROR
      // ==================================================

      console.error("WALLET SETTINGS UPDATE ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Server error while updating wallet settings.",
        error: error.message,
      });
    }
  },
);

// ============================================================
// PAYOUT PAGE
// ============================================================
//
// GET
// /masjids/:id/payout?page=1
//
// ============================================================

router.get("/masjids/:id/payout", adminAuth, async (req, res) => {
  try {
    // ==================================================
    // PAGE / PAGINATION
    // ==================================================

    let page = parseInt(req.query.page, 10) || 1;

    if (page < 1) {
      page = 1;
    }

    // Same as your EJS pagination.
    const limit = 20;

    // ==================================================
    // VALIDATE MASJID ID
    // ==================================================

    const masjidId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(masjidId)) {
      return res.status(400).send("Invalid masjid ID");
    }

    // ==================================================
    // FIND MASJID
    // ==================================================

    const masjid = await User.findOne({
      _id: masjidId,
      role: "masjid",
    }).lean();

    if (!masjid) {
      return res.status(404).send("Masjid not found");
    }

    // ==================================================
    // SUCCESSFUL DONATION FILTER
    // ==================================================

    const donationFilter = {
      masjidId: masjid._id,
      paymentStatus: "success",
    };

    // ==================================================
    // TOTAL SUCCESSFUL DONATIONS
    // ==================================================

    const totalRecords = await Donate.countDocuments(donationFilter);

    // ==================================================
    // TOTAL PAGES
    // ==================================================

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    // ==================================================
    // FIX PAGE IF OUT OF RANGE
    // ==================================================

    if (page > totalPages) {
      page = totalPages;
    }

    const finalSkip = (page - 1) * limit;

    // ==================================================
    // DONATION HISTORY
    // ==================================================

    const payoutHistory = await Donate.find(donationFilter)
      .populate("userId", "name mobile")
      .populate("payoutProcessedBy", "name mobile")
      .sort({
        createdAt: -1,
      })
      .skip(finalSkip)
      .limit(limit)
      .lean();

    // ==================================================
    // TOTAL DONATION AMOUNT
    // ==================================================

    const totalDonationResult = await Donate.aggregate([
      {
        $match: donationFilter,
      },

      {
        $group: {
          _id: null,

          total: {
            $sum: "$amount",
          },
        },
      },
    ]);

    const totalDonation =
      totalDonationResult.length > 0
        ? Number(totalDonationResult[0].total || 0)
        : 0;

    // ==================================================
    // TOTAL PAYOUT AMOUNT
    // ==================================================

    const totalPayoutResult = await Donate.aggregate([
      {
        $match: {
          masjidId: masjid._id,

          payoutStatus: "success",
        },
      },

      {
        $group: {
          _id: null,

          total: {
            $sum: "$payoutAmount",
          },
        },
      },
    ]);

    const totalPayout =
      totalPayoutResult.length > 0
        ? Number(totalPayoutResult[0].total || 0)
        : 0;

    // ==================================================
    // NUMBER OF PAYOUT TRANSACTIONS
    // ==================================================

    const totalPayoutTransactions = await Donate.countDocuments({
      masjidId: masjid._id,

      payoutStatus: "success",

      payoutAmount: {
        $gt: 0,
      },
    });

    // ==================================================
    // PAYOUT TRANSACTIONS
    // ==================================================
    //
    // No Payout.js required.
    //
    // Payout information is stored inside Donate.
    //

    const payoutTransactions = await Donate.find({
      masjidId: masjid._id,

      payoutStatus: "success",

      payoutAmount: {
        $gt: 0,
      },
    })
      .populate("userId", "name mobile")
      .populate("payoutProcessedBy", "name mobile")
      .sort({
        payoutDate: -1,
        createdAt: -1,
      })
      .lean();

    // ==================================================
    // RENDER PAGE
    // ==================================================

    return res.render("admin/payout", {
      masjid,

      payoutHistory,

      payoutTransactions,

      currentPage: page,

      totalPages,

      totalRecords,

      totalDonation,

      totalPayout,

      totalPayoutTransactions,
    });
  } catch (error) {
    // ==================================================
    // ERROR
    // ==================================================

    console.error("PAYOUT PAGE ERROR:", error);

    return res.status(500).send(error.message);
  }
});

// ============================================================
// CREATE PAYOUT
// ============================================================
//
// POST
// /masjids/:id/payout
//
// Body:
//
// {
//     "amount": 5000,
//     "note": "Cash payout"
// }
//
// ============================================================

router.post("/masjids/:id/payout", adminAuth, async (req, res) => {
  // ======================================================
  // MONGODB SESSION
  // ======================================================

  const session = await mongoose.startSession();

  try {
    // ==================================================
    // MASJID ID
    // ==================================================

    const masjidId = req.params.id;

    // ==================================================
    // VALIDATE MASJID ID
    // ==================================================

    if (!mongoose.Types.ObjectId.isValid(masjidId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid masjid ID.",
      });
    }

    // ==================================================
    // REQUEST DATA
    // ==================================================

    const amount = Number(req.body.amount);

    const note = typeof req.body.note === "string" ? req.body.note.trim() : "";

    // ==================================================
    // VALIDATE AMOUNT
    // ==================================================

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid payout amount.",
      });
    }

    // ==================================================
    // ROUND PAYOUT
    // ==================================================

    const payoutAmount = Math.round((amount + Number.EPSILON) * 100) / 100;

    // ==================================================
    // ADMIN ID
    // ==================================================

    const adminId = req.user && req.user._id ? req.user._id : null;

    // ==================================================
    // START TRANSACTION
    // ==================================================

    session.startTransaction();

    // ==================================================
    // FIND MASJID
    // ==================================================

    const masjid = await User.findOne({
      _id: masjidId,
      role: "masjid",
    }).session(session);

    if (!masjid) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Masjid not found.",
      });
    }

    // ==================================================
    // CURRENT WALLET
    // ==================================================

    const currentWallet = Number(masjid.wallet || 0);

    // ==================================================
    // CHECK WALLET
    // ==================================================

    if (payoutAmount > currentWallet) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,

        message: `Insufficient wallet balance. Available balance: ₹${currentWallet.toLocaleString("en-IN")}`,

        wallet: currentWallet,
      });
    }

    // ==================================================
    // FIND SUCCESSFUL UNPAID DONATIONS
    // ==================================================
    //
    // payoutStatus:
    //
    // success = completely paid
    //
    // pending / null / missing = still available
    //
    // ==================================================

    const unpaidDonations = await Donate.find({
      masjidId: masjid._id,

      paymentStatus: "success",

      payoutStatus: {
        $ne: "success",
      },
    })
      .sort({
        createdAt: 1,
      })
      .session(session);

    // ==================================================
    // CALCULATE AVAILABLE AMOUNT
    // ==================================================

    let unpaidDonationAmount = 0;

    for (const donation of unpaidDonations) {
      const donationAmount = Number(donation.amount || 0);

      const alreadyPaid = Number(donation.payoutAmount || 0);

      const remaining = Math.max(0, donationAmount - alreadyPaid);

      unpaidDonationAmount += remaining;
    }

    // ==================================================
    // ROUND AVAILABLE AMOUNT
    // ==================================================

    unpaidDonationAmount =
      Math.round((unpaidDonationAmount + Number.EPSILON) * 100) / 100;

    // ==================================================
    // CHECK AVAILABLE DONATIONS
    // ==================================================

    if (unpaidDonationAmount < payoutAmount) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,

        message: `Not enough unpaid donation balance. Available for payout: ₹${unpaidDonationAmount.toLocaleString("en-IN")}`,

        wallet: currentWallet,

        availableForPayout: unpaidDonationAmount,
      });
    }

    // ==================================================
    // PREPARE PAYOUT ALLOCATION
    // ==================================================

    let remainingPayout = payoutAmount;

    const allocations = [];

    for (const donation of unpaidDonations) {
      if (remainingPayout <= 0) {
        break;
      }

      const donationAmount = Number(donation.amount || 0);

      const alreadyPaid = Number(donation.payoutAmount || 0);

      const remainingDonation = Math.max(0, donationAmount - alreadyPaid);

      if (remainingDonation <= 0) {
        continue;
      }

      const allocation = Math.min(remainingPayout, remainingDonation);

      allocations.push({
        donation,

        amount: allocation,
      });

      remainingPayout =
        Math.round((remainingPayout - allocation + Number.EPSILON) * 100) / 100;
    }

    // ==================================================
    // SAFETY CHECK
    // ==================================================

    if (remainingPayout > 0) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,

        message: "Unable to allocate payout amount.",
      });
    }

    // ==================================================
    // DEDUCT WALLET ATOMICALLY
    // ==================================================
    //
    // This protects against two admins trying
    // to payout the same wallet simultaneously.
    //
    // ==================================================

    const updatedMasjid = await User.findOneAndUpdate(
      {
        _id: masjid._id,

        role: "masjid",

        wallet: {
          $gte: payoutAmount,
        },
      },

      {
        $inc: {
          wallet: -payoutAmount,
        },
      },

      {
        new: true,

        session,
      },
    );

    // ==================================================
    // WALLET UPDATE FAILED
    // ==================================================

    if (!updatedMasjid) {
      await session.abortTransaction();

      const latestMasjid = await User.findById(masjid._id);

      return res.status(400).json({
        success: false,

        message: "Wallet balance changed. Please try again.",

        wallet: latestMasjid ? Number(latestMasjid.wallet || 0) : 0,
      });
    }

    // ==================================================
    // UPDATE DONATION PAYOUT RECORDS
    // ==================================================

    const updatedDonations = [];

    for (const allocation of allocations) {
      const donation = allocation.donation;

      const allocationAmount = Number(allocation.amount);

      // ----------------------------------------------
      // OLD PAYOUT
      // ----------------------------------------------

      const oldPayoutAmount = Number(donation.payoutAmount || 0);

      // ----------------------------------------------
      // NEW PAYOUT
      // ----------------------------------------------

      const newPayoutAmount =
        Math.round(
          (oldPayoutAmount + allocationAmount + Number.EPSILON) * 100,
        ) / 100;

      // ----------------------------------------------
      // DONATION TOTAL
      // ----------------------------------------------

      const donationTotal = Number(donation.amount || 0);

      // ----------------------------------------------
      // UPDATE DONATION
      // ----------------------------------------------

      donation.payoutAmount = newPayoutAmount;

      donation.payoutNote = note;

      donation.payoutDate = new Date();

      donation.payoutProcessedBy = adminId;

      // ----------------------------------------------
      // PAYOUT STATUS
      // ----------------------------------------------

      if (newPayoutAmount >= donationTotal) {
        donation.payoutStatus = "success";
      } else {
        donation.payoutStatus = "pending";
      }

      // ----------------------------------------------
      // SAVE
      // ----------------------------------------------

      await donation.save({
        session,
      });

      // ----------------------------------------------
      // RESPONSE DATA
      // ----------------------------------------------

      updatedDonations.push({
        donationId: donation._id,

        donationAmount: donationTotal,

        payoutAmount: allocationAmount,

        totalPayoutForDonation: newPayoutAmount,

        payoutStatus: donation.payoutStatus,
      });
    }

    // ==================================================
    // COMMIT TRANSACTION
    // ==================================================

    await session.commitTransaction();

    // ==================================================
    // FINAL WALLET
    // ==================================================

    const finalWallet = Number(updatedMasjid.wallet || 0);

    // ==================================================
    // SUCCESS RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: `Payout of ₹${payoutAmount.toLocaleString("en-IN")} successful.`,

      payout: {
        amount: payoutAmount,

        note: note,

        date: new Date(),

        transactions: updatedDonations.length,
      },

      allocations: updatedDonations,

      masjid: {
        id: updatedMasjid._id,

        wallet: finalWallet,

        totalDonation: Number(updatedMasjid.totalDonation || 0),
      },
    });
  } catch (error) {
    // ==================================================
    // ROLLBACK
    // ==================================================

    try {
      await session.abortTransaction();
    } catch (abortError) {
      console.error("TRANSACTION ABORT ERROR:", abortError);
    }

    // ==================================================
    // ERROR
    // ==================================================

    console.error("ADMIN PAYOUT ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Payout failed.",

      error: error.message,
    });
  } finally {
    // ==================================================
    // END SESSION
    // ==================================================

    await session.endSession();
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

router.post("/settings", adminAuth, async (req, res) => {
  try {
    const { notificationEnabled, freeNotificationDays } = req.body;

    let settings = await AppSetting.findOne();

    if (!settings) {
      settings = new AppSetting();
    }

    settings.notificationEnabled = notificationEnabled === "true";
    settings.freeNotificationDays = parseInt(freeNotificationDays) || 7;

    await settings.save();

    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
});

module.exports = router;
