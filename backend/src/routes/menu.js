const express = require("express");
const db = require("../db");

const router = express.Router();

// Same shape as data/menu.json / js/menu-data.js's MENU_DATA, so a
// future frontend fetch() can drop straight in without a rewrite.
router.get("/", async function (req, res, next) {
  try {
    const categories = await db.query(
      "SELECT id, slug, name, name_am FROM menu_categories ORDER BY sort_order ASC, id ASC"
    );
    const items = await db.query(
      `SELECT id, category_id, name, name_am, description, price, image, badge
       FROM menu_items WHERE is_available = TRUE ORDER BY category_id ASC, sort_order ASC, id ASC`
    );

    const itemsByCategory = new Map();
    items.rows.forEach(function (item) {
      if (!itemsByCategory.has(item.category_id)) itemsByCategory.set(item.category_id, []);
      itemsByCategory.get(item.category_id).push({
        id: item.id,
        name: item.name,
        nameAm: item.name_am,
        description: item.description,
        price: Number(item.price),
        image: item.image,
        badge: item.badge || undefined
      });
    });

    const payload = {
      categories: categories.rows.map(function (cat) {
        return {
          name: cat.name,
          nameAm: cat.name_am,
          items: itemsByCategory.get(cat.id) || []
        };
      })
    };

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
