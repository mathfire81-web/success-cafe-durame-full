const { Pool } = require("pg");
const config = require("./config");

/* Supabase's Postgres (and most hosted Postgres) requires SSL, but
   node-postgres doesn't turn it on just because the connection string
   says sslmode=require - it needs the ssl option passed explicitly.
   Supabase's cert chain isn't always in Node's default trust store,
   so rejectUnauthorized: false is what Supabase's own docs recommend
   here (the connection is still encrypted, just not chain-verified).
   Local/plain "postgresql://...@localhost" dev DBs skip this. */
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: /supabase\.co|sslmode=require/i.test(config.databaseUrl)
    ? { rejectUnauthorized: false }
    : false
});

pool.on("error", function (err) {
  // Idle client errors shouldn't crash the whole process.
  console.error("Unexpected Postgres pool error", err);
});

function query(text, params) {
  return pool.query(text, params);
}

/* Runs `fn(client)` inside a BEGIN/COMMIT, rolling back on any thrown
   error. Used for order creation, where the order row and its
   order_items rows must succeed or fail together. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
