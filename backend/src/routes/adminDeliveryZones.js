const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");
const delivery = require("../lib/delivery");

const router = express.Router();
router.use(requireAdmin);

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// Fee/time/distance are always computed from the formula in lib/delivery.js,
// never stored - so admins only ever manage the raw point (name, lat, lng),
// and the estimate updates automatically if the formula ever changes.
router.get("/", async function (req, res, next) {
  try {
    const landmarks = await delivery.listLandmarks();
    res.json({ landmarks: landmarks });
  } catch (err) {
    next(err);
  }
});

router.post("/", async function (req, res, next) {
  try {
    const name = (req.body.name || "").trim();
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!name) return badRequest(res, "Name is required.");
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return badRequest(res, "Enter a valid latitude.");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return badRequest(res, "Enter a valid longitude.");

    let id = slugify(req.body.id || name);
    if (!id) return badRequest(res, "Could not derive an id from that name.");
    const existing = await db.query("SELECT 1 FROM delivery_landmarks WHERE id = $1", [id]);
    if (existing.rows.length) id = id + "-" + Date.now().toString().slice(-4);

    await db.query(
      "INSERT INTO delivery_landmarks (id, name, lat, lng, approx) VALUES ($1,$2,$3,$4,$5)",
      [id, name, lat, lng, !!req.body.approx]
    );
    const landmark = await delivery.getLandmarkById(id);
    res.status(201).json(landmark);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async function (req, res, next) {
  try {
    const name = (req.body.name || "").trim();
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!name) return badRequest(res, "Name is required.");
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return badRequest(res, "Enter a valid latitude.");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return badRequest(res, "Enter a valid longitude.");

    // Renaming the id (primary key) is optional - only when newId is
    // sent and differs from the current one. orders.delivery_landmark_id
    // has ON UPDATE CASCADE (see migration 003), so this can't orphan
    // a past order's reference.
    var newId = req.body.newId ? slugify(req.body.newId) : null;
    if (newId && newId !== req.params.id) {
      if (!newId) return badRequest(res, "Could not derive a valid id from that value.");
      const clash = await db.query("SELECT 1 FROM delivery_landmarks WHERE id = $1", [newId]);
      if (clash.rows.length) return badRequest(res, "That id is already used by another zone.");
      await db.query("UPDATE delivery_landmarks SET id = $1 WHERE id = $2", [newId, req.params.id]);
    }
    const effectiveId = newId && newId !== req.params.id ? newId : req.params.id;

    const result = await db.query(
      "UPDATE delivery_landmarks SET name = $1, lat = $2, lng = $3, approx = $4 WHERE id = $5 RETURNING id",
      [name, lat, lng, !!req.body.approx, effectiveId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Zone not found." });
    const landmark = await delivery.getLandmarkById(effectiveId);
    res.json(landmark);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    const result = await db.query("DELETE FROM delivery_landmarks WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Zone not found." });
    res.json({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
