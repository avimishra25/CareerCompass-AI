const express  = require("express");
const jwt      = require("jsonwebtoken");
const passport = require("passport");
const User     = require("../models/User");

const router = express.Router();

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

// ─── GET /api/auth/google ─────────────────────────────────────
// Redirects user to Google consent screen
router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// ─── GET /api/auth/google/callback ───────────────────────────
// Google redirects here after user approves
router.get("/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.CLIENT_URL}?auth_error=true` }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
  }
);

// ─── GET /api/auth/me ────────────────────────────────────────
router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select("-googleId");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

module.exports = router;