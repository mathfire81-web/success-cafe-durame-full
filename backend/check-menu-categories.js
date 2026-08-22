const { Pool } = require("pg");
require("dotenv").config();

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const cols = await p.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'menu_categories' ORDER BY ordinal_position"
  );
  console.log("menu_categories columns:", cols.rows);

  const count = await p.query("SELECT COUNT(*)::int AS count FROM menu_categories");
  console.log("Rows currently in menu_categories:", count.rows[0].count);
}

run()
  .catch(function (e) { console.error(e.message); })
  .finally(function () { p.end(); });
