const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");
const { downloadPaymentProof } = require("../lib/supabaseStorage");

const router = express.Router();
router.use(requireAdmin);

const VALID_STATUSES = ["pending_verification", "confirmed", "verified", "rejected", "completed"];

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
      `SELECT id, order_code, customer_name, customer_phone, fulfillment_method,
              payment_method, subtotal, delivery_fee, total, status, created_at
       FROM orders ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM orders ${whereClause}`, params.slice(0, where.length));

    res.json({
      orders: listResult.rows.map(formatOrderSummary),
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
    const orderResult = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!orderResult.rows.length) return res.status(404).json({ error: "Order not found." });
    const order = orderResult.rows[0];

    const itemsResult = await db.query(
      "SELECT item_id, item_name, unit_price, qty, line_total FROM order_items WHERE order_id = $1 ORDER BY id ASC",
      [order.id]
    );

    res.json({
      id: order.id,
      orderCode: order.order_code,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      fulfillmentMethod: order.fulfillment_method,
      deliveryAddress: order.delivery_address_text,
      deliveryKm: order.delivery_km !== null ? Number(order.delivery_km) : null,
      deliveryFee: Number(order.delivery_fee),
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      paymentMethod: order.payment_method,
      txnReference: order.txn_reference,
      hasProof: !!order.payment_proof_path,
      status: order.status,
      adminNote: order.admin_note,
      verifiedAt: order.verified_at,
      createdAt: order.created_at,
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

router.get("/:id/proof", async function (req, res, next) {
  try {
    const result = await db.query("SELECT payment_proof_path FROM orders WHERE id = $1", [req.params.id]);
    const storagePath = result.rows[0] && result.rows[0].payment_proof_path;
    if (!storagePath) return res.status(404).json({ error: "No payment proof on this order." });

    // Proof screenshots live in a private Supabase Storage bucket (see
    // lib/supabaseStorage.js) - fetched here with the service role key
    // and streamed straight through, so the bucket itself never needs
    // to be public and this route stays the only way to reach it.
    const file = await downloadPaymentProof(storagePath);
    if (!file) return res.status(404).json({ error: "Proof file not found." });

    res.set("Content-Type", file.contentType);
    res.send(file.buffer);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/verify", async function (req, res, next) {
  try {
    const result = await db.query(
      `UPDATE orders SET status = 'verified', verified_by = $1, verified_at = now()
       WHERE id = $2 AND status = 'pending_verification'
       RETURNING id, status`,
      [req.admin.sub, req.params.id]
    );
    if (!result.rows.length) {
      return res.status(409).json({ error: "Order isn't awaiting verification (already actioned, or doesn't exist)." });
    }
    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", async function (req, res, next) {
  try {
    const reason = (req.body.reason || "").trim() || null;
    const result = await db.query(
      `UPDATE orders SET status = 'rejected', admin_note = $1, verified_by = $2, verified_at = now()
       WHERE id = $3 AND status = 'pending_verification'
       RETURNING id, status`,
      [reason, req.admin.sub, req.params.id]
    );
    if (!result.rows.length) {
      return res.status(409).json({ error: "Order isn't awaiting verification (already actioned, or doesn't exist)." });
    }
    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/complete", async function (req, res, next) {
  try {
    const result = await db.query(
      `UPDATE orders SET status = 'completed'
       WHERE id = $1 AND status IN ('verified', 'confirmed')
       RETURNING id, status`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(409).json({ error: "Order isn't ready to be marked completed." });
    }
    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    next(err);
  }
});

function formatOrderSummary(row) {
  return {
    id: row.id,
    orderCode: row.order_code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    fulfillmentMethod: row.fulfillment_method,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at
  };
}

module.exports = router;
