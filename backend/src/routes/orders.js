const express = require("express");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { withTransaction } = require("../db");
const { upload, UPLOAD_DIR } = require("../middleware/upload");
const { generateUniqueOrderCode } = require("../lib/orderCode");
const { getLandmarkById } = require("../lib/delivery");
const { PAYMENT_METHODS } = require("../lib/paymentMethods");

const router = express.Router();

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

/* Deletes an uploaded file if the request turns out to be invalid
   after all - multer already wrote it to disk by the time our own
   validation runs. */
function cleanupUpload(file) {
  if (!file) return;
  fs.unlink(file.path, function () { /* best-effort */ });
}

router.post("/", upload.single("proof"), async function (req, res, next) {
  try {
    const body = req.body || {};
    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const fulfillmentMethod = body.fulfillmentMethod;
    const paymentMethod = body.paymentMethod;
    const txnReference = (body.txnReference || "").trim();
    const landmarkId = body.landmarkId || null;

    let items;
    try {
      items = JSON.parse(body.items || "[]");
    } catch (e) {
      cleanupUpload(req.file);
      return badRequest(res, "Invalid items payload.");
    }

    if (!name) { cleanupUpload(req.file); return badRequest(res, "Full name is required."); }
    if (!phone) { cleanupUpload(req.file); return badRequest(res, "Phone number is required."); }
    if (!Array.isArray(items) || items.length === 0) {
      cleanupUpload(req.file);
      return badRequest(res, "Your cart is empty.");
    }
    if (fulfillmentMethod !== "in-cafe" && fulfillmentMethod !== "delivery") {
      cleanupUpload(req.file);
      return badRequest(res, "Invalid fulfillment method.");
    }
    if (!PAYMENT_METHODS[paymentMethod]) {
      cleanupUpload(req.file);
      return badRequest(res, "Invalid payment method.");
    }

    const methodConfig = PAYMENT_METHODS[paymentMethod];
    if (methodConfig.requiresRef && !txnReference) {
      cleanupUpload(req.file);
      return badRequest(res, "Please enter your transaction reference.");
    }
    if (methodConfig.requiresRef && !req.file) {
      cleanupUpload(req.file);
      return badRequest(res, "Please upload a screenshot of your payment.");
    }

    // ---- Delivery details: recomputed from the landmark id, never
    // trusted from client-supplied fee/address text. ----
    let deliveryLandmark = null;
    if (fulfillmentMethod === "delivery") {
      deliveryLandmark = await getLandmarkById(landmarkId);
      if (!deliveryLandmark) {
        cleanupUpload(req.file);
        return badRequest(res, "Please choose a delivery drop-off point on the map.");
      }
    }

    // ---- Items: prices come from the DB, never the client. ----
    const itemIds = items.map(function (i) { return i.id; });
    const dbItemsResult = await db.query(
      "SELECT id, name, price FROM menu_items WHERE id = ANY($1) AND is_available = TRUE",
      [itemIds]
    );
    const dbItemsById = new Map(dbItemsResult.rows.map(function (row) { return [row.id, row]; }));

    const orderItems = [];
    let subtotal = 0;
    for (const requested of items) {
      const qty = parseInt(requested.qty, 10);
      const dbItem = dbItemsById.get(requested.id);
      if (!dbItem) {
        cleanupUpload(req.file);
        return badRequest(res, "One of the items in your cart is no longer available.");
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        cleanupUpload(req.file);
        return badRequest(res, "Invalid quantity for " + dbItem.name + ".");
      }
      const unitPrice = Number(dbItem.price);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      orderItems.push({
        itemId: dbItem.id,
        name: dbItem.name,
        unitPrice: unitPrice,
        qty: qty,
        lineTotal: lineTotal
      });
    }

    const deliveryFee = deliveryLandmark ? deliveryLandmark.fee : 0;
    const total = subtotal + deliveryFee;
    const initialStatus = methodConfig.requiresRef ? "pending_verification" : "confirmed";
    const proofRelativePath = req.file ? path.basename(req.file.path) : null;
    const deliveryAddressText = deliveryLandmark
      ? "Near " + deliveryLandmark.name + (deliveryLandmark.approx ? " (approx.)" : "") + ", Durame town"
      : null;

    const order = await withTransaction(async function (client) {
      const orderCode = await generateUniqueOrderCode(client);

      const insertOrder = await client.query(
        `INSERT INTO orders
          (order_code, customer_name, customer_phone, fulfillment_method,
           delivery_landmark_id, delivery_address_text, delivery_km, delivery_fee,
           subtotal, total, payment_method, txn_reference, payment_proof_path, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id, order_code, status`,
        [
          orderCode,
          name,
          phone,
          fulfillmentMethod,
          deliveryLandmark ? deliveryLandmark.id : null,
          deliveryAddressText,
          deliveryLandmark ? deliveryLandmark.km : null,
          deliveryFee,
          subtotal,
          total,
          paymentMethod,
          methodConfig.requiresRef ? txnReference : null,
          proofRelativePath,
          initialStatus
        ]
      );

      const orderRow = insertOrder.rows[0];

      for (const item of orderItems) {
        await client.query(
          `INSERT INTO order_items (order_id, item_id, item_name, unit_price, qty, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [orderRow.id, item.itemId, item.name, item.unitPrice, item.qty, item.lineTotal]
        );
      }

      return orderRow;
    });

    res.status(201).json({
      orderCode: order.order_code,
      status: order.status,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total
    });
  } catch (err) {
    cleanupUpload(req.file);
    next(err);
  }
});

// Public order-status lookup by code - no auth, but only exposes what
// a customer already knows/needs (no phone, no proof image, no
// internal admin notes).
router.get("/:code", async function (req, res, next) {
  try {
    const orderResult = await db.query(
      `SELECT order_code, fulfillment_method, delivery_address_text, delivery_fee,
              subtotal, total, payment_method, status, created_at
       FROM orders WHERE order_code = $1`,
      [req.params.code]
    );
    if (!orderResult.rows.length) return res.status(404).json({ error: "Order not found." });

    const order = orderResult.rows[0];
    const itemsResult = await db.query(
      "SELECT item_name, unit_price, qty, line_total FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_code = $1)",
      [req.params.code]
    );

    res.json({
      orderCode: order.order_code,
      status: order.status,
      fulfillmentMethod: order.fulfillment_method,
      deliveryAddress: order.delivery_address_text,
      deliveryFee: Number(order.delivery_fee),
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
      items: itemsResult.rows.map(function (row) {
        return { name: row.item_name, unitPrice: Number(row.unit_price), qty: row.qty, lineTotal: Number(row.line_total) };
      })
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
