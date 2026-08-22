const express = require("express");
const db = require("../db");

const router = express.Router();

const VALID_CATEGORIES = ["menu", "delivery", "website", "service", "other"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// POST /api/ideas - the "Share an Idea" modal (js/idea-modal.js).
// Public, no auth: anyone visiting the site can leave feedback.
router.post("/", async function (req, res, next) {
  try {
    const body = req.body || {};
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const category = (body.category || "").trim();
    const message = (body.message || "").trim();

    if (!name) return badRequest(res, "Name is required.");
    if (!email || !EMAIL_RE.test(email)) return badRequest(res, "A valid email is required.");
    if (!VALID_CATEGORIES.includes(category)) return badRequest(res, "Please choose a category.");
    if (!message) return badRequest(res, "Please share your idea before sending.");

    const insertResult = await db.query(
      `INSERT INTO ideas (name, email, category, message)
       VALUES ($1,$2,$3,$4)
       RETURNING id, created_at`,
      [name, email, category, message]
    );

    res.status(201).json({ id: insertResult.rows[0].id, createdAt: insertResult.rows[0].created_at });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
