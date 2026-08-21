const express = require("express");
const db = require("../db");
const { comparePassword, signAdminToken, COOKIE_NAME } = require("../lib/auth");
const requireAdmin = require("../middleware/requireAdmin");
const loginRateLimit = require("../middleware/loginRateLimit");
const config = require("../config");

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.nodeEnv === "production",
  maxAge: 12 * 60 * 60 * 1000 // 12h, kept in sync with jwtExpiresIn's default
};

router.post("/login", loginRateLimit, async function (req, res, next) {
  try {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const result = await db.query("SELECT id, username, password_hash FROM admin_users WHERE username = $1", [username]);
    const admin = result.rows[0];

    // Compare against a dummy hash when the user doesn't exist, so the
    // response time doesn't leak which usernames are valid.
    const hashToCheck = admin ? admin.password_hash : "$2a$10$invalidsaltinvalidsaltinvalidsaltinvalidu";
    const passwordMatches = await comparePassword(password, hashToCheck);

    if (!admin || !passwordMatches) {
      return res.status(401).json({ error: "Incorrect username or password." });
    }

    const token = signAdminToken(admin);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({ username: admin.username });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", function (req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/me", requireAdmin, function (req, res) {
  res.json({ username: req.admin.username });
});

module.exports = router;
