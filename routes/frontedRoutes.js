const express = require("express");
const router = express.Router();

// Home Page
router.get("/", (req, res) => {
  res.render("fronted/index");
});

// About
router.get("/about", (req, res) => {
  res.render("fronted/about");
});

// Contact
router.get("/contact", (req, res) => {
  res.render("fronted/contact");
});

// Privacy Policy
router.get("/privacy-policy", (req, res) => {
  res.render("fronted/privacy-policy");
});

// Terms
router.get("/terms", (req, res) => {
  res.render("fronted/terms");
});

module.exports = router;
