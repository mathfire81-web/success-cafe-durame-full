const { Pool } = require("pg");
require("dotenv").config();

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

p.query(
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'menu_items' ORDER BY ordinal_position"
)
  .then(function (r) {
    console.log(r.rows);
  })
  .catch(function (e) {
    console.error(e.message);
  })
  .finally(function () {
    p.end();
  });
