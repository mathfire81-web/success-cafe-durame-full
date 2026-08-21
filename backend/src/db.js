const { Pool } = require("pg");
const config = require("./config");

const pool = new Pool({ connectionString: config.databaseUrl });

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
