const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();
router.use(requireAdmin);

const VALID_STATUSES = ["pending", "confirmed", "cancelled", "completed"];

router.get("/", async function (req, res, next) {
  try {
    const status = req.query.status;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];
    if (status && VALID_STATUSES.includes(status)) {
      params.push(status);
      where.push("status = $" + params.length);
    }
    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    params.push(pageSize, offset);
    const listResult = await db.query(
      `SELECT id, preorder_code, customer_name, customer_phone, reservation_date, reservation_time,
              guests, item_count, subtotal, status, created_at
       FROM preorders ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM preorders ${whereClause}`, params.slice(0, where.length));

    res.json({
      preorders: listResult.rows.map(formatPreorderSummary),
      page: page,
      pageSize: pageSize,
      total: countResult.rows[0].count
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async function (req, res, next) {
  try {
    const preorderResult = await db.query("SELECT * FROM preorders WHERE id = $1", [req.params.id]);
    if (!preorderResult.rows.length) return res.status(404).json({ error: "Preorder not found." });
    const preorder = preorderResult.rows[0];

    const itemsResult = await db.query(
      "SELECT item_id, item_name, unit_price, qty, line_total FROM preorder_items WHERE preorder_id = $1 ORDER BY id ASC",
      [preorder.id]
    );

    res.json({
      id: preorder.id,
      preorderCode: preorder.preorder_code,
      customerName: preorder.customer_name,
      customerPhone: preorder.customer_phone,
      reservationDate: preorder.reservation_date,
      reservationTime: preorder.reservation_time,
      guests: preorder.guests,
      subtotal: Number(preorder.subtotal),
      notes: preorder.notes,
      status: preorder.status,
      adminNote: preorder.admin_note,
      createdAt: preorder.created_at,
      items: itemsResult.rows.map(function (row) {
        return {
          itemId: row.item_id,
          name: row.item_name,
          unitPrice: Number(row.unit_price),
          qty: row.qty,
          lineTotal: Number(row.line_total)
        };
      })
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/status", async function (req, res, next) {
  try {
    const status = req.body.status;
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status." });

    const result = await db.query(
      `UPDATE preorders SET status = $1, admin_note = $2 WHERE id = $3 RETURNING id, status`,
      [status, (req.body.note || "").trim() || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Preorder not found." });
    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    next(err);
  }
});

function formatPreorderSummary(row) {
  return {
    id: row.id,
    preorderCode: row.preorder_code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    reservationDate: row.reservation_date,
    reservationTime: row.reservation_time,
    guests: row.guests,
    itemCount: row.item_count,
    subtotal: Number(row.subtotal),
    status: row.status,
    createdAt: row.created_at
  };
}

module.exports = router;
