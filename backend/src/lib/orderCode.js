const db = require("../db");

/* Same format the frontend used to fake client-side: "SC-" + 6 digits
   (see generateOrderCode in js/payment.js, now replaced by a real
   call to the server). Retries on the rare collision instead of
   trusting randomness alone. */
function randomCode() {
  var digits = Math.floor(100000 + Math.random() * 900000);
  return "SC-" + digits;
}

async function generateUniqueOrderCode(client) {
  var runner = client || db;
  for (var attempt = 0; attempt < 10; attempt++) {
    var code = randomCode();
    var existing = await runner.query("SELECT 1 FROM orders WHERE order_code = $1", [code]);
    if (existing.rows.length === 0) return code;
  }
  throw new Error("Could not generate a unique order code after 10 attempts");
}

module.exports = { generateUniqueOrderCode };
