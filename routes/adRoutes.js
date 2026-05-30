const express = require("express");
const router = express.Router();

const Ad = require("../models/Ad");

// ======================================
// GET ACTIVE ADS
// ======================================

router.get("/", async (req, res) => {
  try {
    const { position } = req.query;

    const query = {
      isActive: true,
      startDate: {
        $lte: new Date(),
      },
      endDate: {
        $gte: new Date(),
      },
    };

    if (position) {
      query.position = position;
    }

    const ads = await Ad.find(query)
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.json({
      success: true,
      count: ads.length,
      ads,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// ======================================
// GET SINGLE AD
// ======================================

router.get("/:id", async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id).lean();

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Ad not found",
      });
    }

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

// ======================================
// TRACK IMPRESSION
// ======================================

router.post("/:id/impression", async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, {
      $inc: {
        impressions: 1,
      },
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

// ======================================
// TRACK CLICK
// ======================================

router.post("/:id/click", async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(
      req.params.id,
      {
        $inc: {
          clicks: 1,
        },
      },
      {
        new: true,
      },
    );

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Ad not found",
      });
    }

    return res.json({
      success: true,
      redirectUrl: ad.redirectUrl,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
    });
  }
});

module.exports = router;
