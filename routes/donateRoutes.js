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

    // ==========================
    // VERIFY SIGNATURE
    // ==========================

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    // ==========================
    // FAILED
    // ==========================

    if (!isAuthentic) {
      await Donate.findByIdAndUpdate(donationId, {
        paymentStatus: "failed",
      });

      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // ==========================
    // SUCCESS
    // ==========================

    const donation = await Donate.findByIdAndUpdate(
      donationId,
      {
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        paymentStatus: "success",
      },
      {
        new: true,
      },
    );

    return res.json({
      success: true,
      message: "Donation successful",
      donation,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Verification failed",
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
