// routes/donateRoutes.js

const express = require("express");

const router = express.Router();

const Razorpay = require("razorpay");

const crypto = require("crypto");

const Donate = require("../models/Donate");

const auth = require("../middleware/auth");

// =======================================
// RAZORPAY
// =======================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// =======================================
// CREATE DONATION
// LOGIN REQUIRED
// =======================================

router.post("/create-donation", auth, async (req, res) => {
  try {
    // logged in user
    const userId = req.user._id;

    const { masjidId, amount, message, anonymous } = req.body;

    // ==========================
    // VALIDATION
    // ==========================

    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    // ==========================
    // CREATE ORDER
    // ==========================

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `donate_${Date.now()}`,
    });

    // ==========================
    // SAVE DONATION
    // ==========================

    const donation = await Donate.create({
      userId,
      masjidId,
      amount,
      message,
      anonymous,
      orderId: order.id,
      paymentStatus: "pending",
    });

    return res.json({
      success: true,
      message: "Donation order created",
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      order,
      donation,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

// =======================================
// VERIFY DONATION
// =======================================

router.post("/verify-donation", auth, async (req, res) => {
  try {
    const {
      donationId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // =========================================
    // VALIDATION
    // =========================================

    if (
      !donationId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are required",
      });
    }

    // =========================================
    // VERIFY RAZORPAY SIGNATURE
    // =========================================

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    // =========================================
    // INVALID SIGNATURE
    // =========================================

    if (!isAuthentic) {
      await Donate.findByIdAndUpdate(donationId, {
        paymentStatus: "failed",
      });

      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // =========================================
    // FIND DONATION
    // =========================================

    const donation = await Donate.findById(donationId);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "Donation not found",
      });
    }

    // =========================================
    // PREVENT DUPLICATE PAYMENT CREDIT
    // =========================================

    if (donation.paymentStatus === "success") {
      return res.status(400).json({
        success: false,
        message: "Donation already verified",
        donation,
      });
    }

    // =========================================
    // DONATION AMOUNT
    // =========================================

    const donationAmount = Number(donation.amount);

    if (!donationAmount || donationAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid donation amount",
      });
    }

    // =========================================
    // FIND USER
    // =========================================

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // =========================================
    // SELECTED MASJID CHECK
    // =========================================

    if (!user.selectedMasjid) {
      return res.status(400).json({
        success: false,
        message: "No masjid selected",
      });
    }

    // =========================================
    // FIND SELECTED MASJID
    // =========================================

    const masjid = await User.findOne({
      _id: user.selectedMasjid,
      role: "masjid",
    });

    if (!masjid) {
      return res.status(404).json({
        success: false,
        message: "Selected masjid not found",
      });
    }

    // =========================================
    // UPDATE DONATION STATUS FIRST
    // =========================================

    donation.paymentId = razorpay_payment_id;
    donation.signature = razorpay_signature;
    donation.paymentStatus = "success";

    await donation.save();

    // =========================================
    // UPDATE TOTAL DONATION
    // =========================================

    const oldTotalDonation = Number(masjid.totalDonation) || 0;

    const newTotalDonation = oldTotalDonation + donationAmount;

    masjid.totalDonation = newTotalDonation;

    // =========================================
    // WALLET CALCULATION
    // =========================================

    const wallet = Number(masjid.wallet) || 0;

    const acceptedAmount = Number(masjid.walletAcceptedAmount) || 0;

    let walletToAdd = 0;

    // =========================================
    // FIXED
    // =========================================
    //
    // Example:
    // wallet = 800
    // accepted = 1000
    // donation = 500
    //
    // walletToAdd = 200
    //
    // =========================================

    if (masjid.walletAccepted === "fixed") {
      const remaining = Math.max(acceptedAmount - wallet, 0);

      walletToAdd = Math.min(donationAmount, remaining);
    }

    // =========================================
    // PERCENTAGE
    // =========================================
    //
    // Example:
    // donation = 1000
    // percentage = 10
    //
    // walletToAdd = 100
    //
    // =========================================
    else if (masjid.walletAccepted === "percentage") {
      walletToAdd = (donationAmount * acceptedAmount) / 100;
    }

    // =========================================
    // TOTAL PAYMENT
    // =========================================
    //
    // Example:
    //
    // totalDonation = 10000
    // acceptedAmount = 10
    //
    // maximum wallet = 1000
    //
    // =========================================
    else if (masjid.walletAccepted === "totalPayment") {
      const maximumWallet = (newTotalDonation * acceptedAmount) / 100;

      const remaining = Math.max(maximumWallet - wallet, 0);

      walletToAdd = Math.min(donationAmount, remaining);
    }

    // =========================================
    // ADD TO WALLET
    // =========================================

    if (walletToAdd > 0) {
      masjid.wallet = wallet + walletToAdd;
    }

    await masjid.save();

    // =========================================
    // SUCCESS RESPONSE
    // =========================================

    return res.json({
      success: true,
      message: "Donation successful",

      donation,

      masjid: {
        id: masjid._id,
        name: masjid.masjidName,
        totalDonation: masjid.totalDonation,
        wallet: masjid.wallet,
        walletAccepted: masjid.walletAccepted,
        walletAcceptedAmount: masjid.walletAcceptedAmount,
      },

      walletAdded: walletToAdd,
    });
  } catch (error) {
    console.log("VERIFY DONATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Verification failed",
      error: error.message,
    });
  }
});

router.get("/my-donations", auth, async (req, res) => {
  try {
    // logged in user
    const userId = req.user._id;

    // ==========================
    // GET DONATIONS
    // ==========================

    const donations = await Donate.find({
      userId,
    })
      .populate("masjidId", "masjidName address photo")
      .sort({
        createdAt: -1,
      });

    // ==========================
    // TOTAL DONATION
    // ==========================

    const totalDonation = await Donate.aggregate([
      {
        $match: {
          userId: req.user._id,
          paymentStatus: "success",
        },
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

    return res.json({
      success: true,

      totalDonation: totalDonation[0]?.total || 0,

      totalRecords: donations.length,

      donations,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

module.exports = router;
