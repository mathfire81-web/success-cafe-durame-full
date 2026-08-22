const express = require("express");
const db = require("../db");
const { withTransaction } = require("../db");
const { generateUniquePreorderCode } = require("../lib/preorderCode");

const router = express.Router();

const PHONE_RE = /^0[79][0-9]{8}$/;

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// POST /api/preorders - the "Pre-order food" / table-reservation modal
// (js/preorder-modal.js). This is a free reservation, not a paid
// checkout - no payment fields - but the food selection still has its
// prices looked up from menu_items server-side, same reasoning as
// /api/orders: never trust a price the client sends.
router.post("/", async function (req, res, next) {
  try {
    const body = req.body || {};
    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const date = (body.date || "").trim();
    const time = (body.time || "").trim();
    const guests = parseInt(body.guests, 10);
    const notes = (body.notes || "").trim();

    let items;
    try {
      items = Array.isArray(body.items) ? body.items : JSON.parse(body.items || "[]");
    } catch (e) {
      return badRequest(res, "Invalid items payload.");
    }

    if (!name) return badRequest(res, "Full name is required.");
    if (!PHONE_RE.test(phone)) return badRequest(res, "Please enter a valid phone number.");
    if (!date) return badRequest(res, "Please choose a date.");
    if (!Number.isInteger(guests) || guests <= 0) return badRequest(res, "Please enter a valid number of guests.");

    // Food selection is optional here ("decide when you arrive" is a
    // valid choice in the UI), so an empty list is fine - only
    // validate shape/prices when items were actually picked.
    const preorderItems = [];
    let subtotal = 0;
    if (Array.isArray(items) && items.length > 0) {
      const itemIds = items.map(function (i) { return i.id; });
      const dbItemsResult = await db.query(
        "SELECT id, name, price FROM menu_items WHERE id = ANY($1) AND is_available = TRUE",
        [itemIds]
      );
      const dbItemsById = new Map(dbItemsResult.rows.map(function (row) { return [row.id, row]; }));

      for (const requested of items) {
        const qty = parseInt(requested.qty, 10);
        const dbItem = dbItemsById.get(requested.id);
        if (!dbItem) return badRequest(res, "One of the selected items is no longer available.");
        if (!Number.isInteger(qty) || qty <= 0) return badRequest(res, "Invalid quantity for " + dbItem.name + ".");

        const unitPrice = Number(dbItem.price);
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;
        preorderItems.push({
          itemId: dbItem.id,
          name: dbItem.name,
          unitPrice: unitPrice,
          qty: qty,
          lineTotal: lineTotal
        });
      }
    }

    const itemCount = preorderItems.reduce(function (sum, i) { return sum + i.qty; }, 0);

    const preorder = await withTransaction(async function (client) {
      const preorderCode = await generateUniquePreorderCode(client);

      const insertPreorder = await client.query(
        `INSERT INTO preorders
          (preorder_code, customer_name, customer_phone, reservation_date, reservation_time,
           guests, item_count, subtotal, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, preorder_code, created_at`,
        [preorderCode, name, phone, date, time || null, guests, itemCount, subtotal, notes || null]
      );

      const preorderRow = insertPreorder.rows[0];

      for (const item of preorderItems) {
        await client.query(
          `INSERT INTO preorder_items (preorder_id, item_id, item_name, unit_price, qty, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [preorderRow.id, item.itemId, item.name, item.unitPrice, item.qty, item.lineTotal]
        );
      }

      return preorderRow;
    });

    res.status(201).json({
      preorderCode: preorder.preorder_code,
      itemCount: itemCount,
      subtotal: subtotal,
      createdAt: preorder.created_at
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
