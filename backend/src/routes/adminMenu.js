const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");
const { uploadMenuPhoto } = require("../middleware/uploadMenuPhoto");
const { uploadMenuPhoto: uploadToSupabase } = require("../lib/supabaseStorage");

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

/* ---------------- photo upload ---------------- */

// POST /api/admin/menu/photo, multipart field "photo". Returns
// { url } - the caller (item drawer) puts that straight into the
// item's image field on save. Uploading doesn't touch menu_items
// itself, so a photo can be picked before an item even exists yet.
router.post("/photo", uploadMenuPhoto.single("photo"), async function (req, res, next) {
  try {
    if (!req.file) return badRequest(res, "No photo received.");
    const url = await uploadToSupabase(req.file.buffer, req.file.mimetype, req.file.originalname);
    res.json({ url: url });
  } catch (err) {
    if (err.message === "MENU_PHOTO_NOT_IMAGE") return badRequest(res, "That file isn't an image.");
    next(err);
  }
});

/* ---------------- categories ---------------- */

router.get("/categories", async function (req, res, next) {
  try {
    const result = await db.query(
      "SELECT id, slug, name, name_am, sort_order FROM menu_categories ORDER BY sort_order ASC, id ASC"
    );
    res.json({ categories: result.rows.map(formatCategory) });
  } catch (err) {
    next(err);
  }
});

router.post("/categories", async function (req, res, next) {
  try {
    const name = (req.body.name || "").trim();
    const nameAm = (req.body.nameAm || "").trim();
    const sortOrder = parseInt(req.body.sortOrder, 10) || 0;
    if (!name) return badRequest(res, "Category name is required.");

    let slug = slugify(req.body.slug || name);
    if (!slug) return badRequest(res, "Could not derive a slug from that name.");
    const existing = await db.query("SELECT 1 FROM menu_categories WHERE slug = $1", [slug]);
    if (existing.rows.length) slug = slug + "-" + Date.now().toString().slice(-4);

    const result = await db.query(
      `INSERT INTO menu_categories (slug, name, name_am, sort_order) VALUES ($1,$2,$3,$4)
       RETURNING id, slug, name, name_am, sort_order`,
      [slug, name, nameAm || null, sortOrder]
    );
    res.status(201).json(formatCategory(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put("/categories/:id", async function (req, res, next) {
  try {
    const name = (req.body.name || "").trim();
    const nameAm = (req.body.nameAm || "").trim();
    const sortOrder = parseInt(req.body.sortOrder, 10) || 0;
    if (!name) return badRequest(res, "Category name is required.");

    const result = await db.query(
      `UPDATE menu_categories SET name = $1, name_am = $2, sort_order = $3
       WHERE id = $4 RETURNING id, slug, name, name_am, sort_order`,
      [name, nameAm || null, sortOrder, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Category not found." });
    res.json(formatCategory(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/categories/:id", async function (req, res, next) {
  try {
    const itemCount = await db.query("SELECT COUNT(*)::int AS count FROM menu_items WHERE category_id = $1", [req.params.id]);
    if (itemCount.rows[0].count > 0) {
      return res.status(409).json({ error: "Move or delete this category's items first \u2014 deleting it would remove " + itemCount.rows[0].count + " item(s) too." });
    }
    const result = await db.query("DELETE FROM menu_categories WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Category not found." });
    res.json({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------- items ---------------- */

// Unlike the public /api/menu route, this returns EVERY item
// (available or not) since staff need to see and toggle hidden items.
router.get("/items", async function (req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, category_id, name, name_am, description, price, image, badge, is_available, sort_order
       FROM menu_items ORDER BY category_id ASC, sort_order ASC, id ASC`
    );
    res.json({ items: result.rows.map(formatItem) });
  } catch (err) {
    next(err);
  }
});

router.post("/items", async function (req, res, next) {
  try {
    const name = (req.body.name || "").trim();
    const categoryId = parseInt(req.body.categoryId, 10);
    const price = Number(req.body.price);
    if (!name) return badRequest(res, "Item name is required.");
    if (!Number.isInteger(categoryId)) return badRequest(res, "Choose a category.");
    if (!Number.isFinite(price) || price < 0) return badRequest(res, "Enter a valid price.");

    let id = slugify(req.body.id || name);
    if (!id) return badRequest(res, "Could not derive an id from that name.");
    const existing = await db.query("SELECT 1 FROM menu_items WHERE id = $1", [id]);
    if (existing.rows.length) id = id + "-" + Date.now().toString().slice(-4);

    const result = await db.query(
      `INSERT INTO menu_items (id, category_id, name, name_am, description, price, image, badge, is_available, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, category_id, name, name_am, description, price, image, badge, is_available, sort_order`,
      [
        id,
        categoryId,
        name,
        (req.body.nameAm || "").trim() || null,
        (req.body.description || "").trim() || null,
        price,
        (req.body.image || "").trim() || null,
        (req.body.badge || "").trim() || null,
        req.body.isAvailable !== false,
        parseInt(req.body.sortOrder, 10) || 0
      ]
    );
    res.status(201).json(formatItem(result.rows[0]));
  } catch (err) {
    if (err.code === "23503") return badRequest(res, "That category no longer exists.");
    next(err);
  }
});

router.put("/items/:id", async function (req, res, next) {
  try {
    const name = (req.body.name || "").trim();
    const categoryId = parseInt(req.body.categoryId, 10);
    const price = Number(req.body.price);
    if (!name) return badRequest(res, "Item name is required.");
    if (!Number.isInteger(categoryId)) return badRequest(res, "Choose a category.");
    if (!Number.isFinite(price) || price < 0) return badRequest(res, "Enter a valid price.");

    const result = await db.query(
      `UPDATE menu_items SET
         category_id = $1, name = $2, name_am = $3, description = $4, price = $5,
         image = $6, badge = $7, is_available = $8, sort_order = $9
       WHERE id = $10
       RETURNING id, category_id, name, name_am, description, price, image, badge, is_available, sort_order`,
      [
        categoryId,
        name,
        (req.body.nameAm || "").trim() || null,
        (req.body.description || "").trim() || null,
        price,
        (req.body.image || "").trim() || null,
        (req.body.badge || "").trim() || null,
        req.body.isAvailable !== false,
        parseInt(req.body.sortOrder, 10) || 0,
        req.params.id
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Item not found." });
    res.json(formatItem(result.rows[0]));
  } catch (err) {
    if (err.code === "23503") return badRequest(res, "That category no longer exists.");
    next(err);
  }
});

// Quick toggle, used by the availability switch in the item list
// without needing the full edit form open.
router.patch("/items/:id/availability", async function (req, res, next) {
  try {
    const result = await db.query(
      "UPDATE menu_items SET is_available = $1 WHERE id = $2 RETURNING id, is_available",
      [!!req.body.isAvailable, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Item not found." });
    res.json({ id: result.rows[0].id, isAvailable: result.rows[0].is_available });
  } catch (err) {
    next(err);
  }
});

router.delete("/items/:id", async function (req, res, next) {
  try {
    const result = await db.query("DELETE FROM menu_items WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Item not found." });
    res.json({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    next(err);
  }
});

function formatCategory(row) {
  return { id: row.id, slug: row.slug, name: row.name, nameAm: row.name_am, sortOrder: row.sort_order };
}

function formatItem(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    nameAm: row.name_am,
    description: row.description,
    price: Number(row.price),
    image: row.image,
    badge: row.badge,
    isAvailable: row.is_available,
    sortOrder: row.sort_order
  };
}

module.exports = router;
