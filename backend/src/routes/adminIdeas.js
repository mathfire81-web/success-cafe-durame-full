const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/ideas - list "Share an Idea" submissions, newest first.
// Read-only: there's no verification workflow for these, just a record
// someone on staff can review. (You can also browse the `ideas` table
// directly in the Supabase table editor - this endpoint exists for a
// future admin-dashboard tab.)
router.get("/", async function (req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const offset = (page - 1) * pageSize;

    const listResult = await db.query(
      `SELECT id, name, email, category, message, created_at
       FROM ideas
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM ideas");

    res.json({
      ideas: listResult.rows.map(function (row) {
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          category: row.category,
          message: row.message,
          createdAt: row.created_at
        };
      }),
      page: page,
      pageSize: pageSize,
      total: countResult.rows[0].count
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
