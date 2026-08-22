const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const config = require("../config");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function run() {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: /supabase\.co|sslmode=require/i.test(config.databaseUrl)
      ? { rejectUnauthorized: false }
      : false
  });

  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );

  const files = fs.readdirSync(MIGRATIONS_DIR).filter(function (f) { return f.endsWith(".sql"); }).sort();
  const appliedResult = await pool.query("SELECT filename FROM schema_migrations");
  const applied = new Set(appliedResult.rows.map(function (r) { return r.filename; }));

  for (const file of files) {
    if (applied.has(file)) {
      console.log("skip  " + file + " (already applied)");
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log("apply " + file);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log("Migrations up to date.");
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
