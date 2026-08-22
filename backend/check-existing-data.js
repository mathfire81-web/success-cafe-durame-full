const { Pool } = require("pg");
require("dotenv").config();

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log("All tables in this database:", tables.rows.map(function (r) { return r.table_name; }));

  const count = await p.query("SELECT COUNT(*)::int AS count FROM menu_items");
  console.log("Rows currently in menu_items:", count.rows[0].count);

  const sample = await p.query("SELECT id, name, price FROM menu_items LIMIT 5");
  console.log("Sample rows:", sample.rows);
}

run()
  .catch(function (e) { console.error(e.message); })
  .finally(function () { p.end(); });
