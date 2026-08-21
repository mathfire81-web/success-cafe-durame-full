const fs = require("fs");
const path = require("path");
const db = require("../db");
const config = require("../config");
const { hashPassword } = require("../lib/auth");
const { LANDMARKS } = require("../lib/landmarks-data");

const MENU_JSON_PATH = path.join(__dirname, "..", "..", "..", "frontend", "data", "menu.json");

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function seedMenu() {
  const raw = fs.readFileSync(MENU_JSON_PATH, "utf8");
  const menu = JSON.parse(raw);

  let categorySort = 0;
  for (const category of menu.categories) {
    categorySort += 1;
    const slug = slugify(category.name);

    const categoryResult = await db.query(
      `INSERT INTO menu_categories (slug, name, name_am, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name = $2, name_am = $3, sort_order = $4
       RETURNING id`,
      [slug, category.name, category.nameAm || null, categorySort]
    );
    const categoryId = categoryResult.rows[0].id;

    let itemSort = 0;
    for (const item of category.items) {
      itemSort += 1;
      await db.query(
        `INSERT INTO menu_items (id, category_id, name, name_am, description, price, image, badge, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           category_id = $2, name = $3, name_am = $4, description = $5,
           price = $6, image = $7, badge = $8, sort_order = $9`,
        [item.id, categoryId, item.name, item.nameAm || null, item.description || null, item.price, item.image || null, item.badge || null, itemSort]
      );
    }
  }
  console.log("Seeded " + menu.categories.length + " menu categories.");
}

async function seedLandmarks() {
  for (const spot of LANDMARKS) {
    await db.query(
      `INSERT INTO delivery_landmarks (id, name, lat, lng, approx)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET name = $2, lat = $3, lng = $4, approx = $5`,
      [spot.id, spot.name, spot.lat, spot.lng, !!spot.approx]
    );
  }
  console.log("Seeded " + LANDMARKS.length + " delivery landmarks.");
}

async function seedAdmin() {
  if (!config.seedAdminPassword) {
    console.log("Skipped admin user - set ADMIN_USERNAME and ADMIN_PASSWORD in .env and re-run to create one.");
    return;
  }
  const passwordHash = await hashPassword(config.seedAdminPassword);
  await db.query(
    `INSERT INTO admin_users (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = $2`,
    [config.seedAdminUsername, passwordHash]
  );
  console.log("Seeded admin user \"" + config.seedAdminUsername + "\".");
}

async function run() {
  await seedMenu();
  await seedLandmarks();
  await seedAdmin();
  await db.pool.end();
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
