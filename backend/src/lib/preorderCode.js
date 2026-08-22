const db = require("../db");

/* Same shape as generateUniqueOrderCode (lib/orderCode.js) but with a
   "P" marker so a preorder code is never mistaken for a paid order
   code at a glance: "SC-P-" + 6 digits. */
function randomCode() {
  var digits = Math.floor(100000 + Math.random() * 900000);
  return "SC-P-" + digits;
}

async function generateUniquePreorderCode(client) {
  var runner = client || db;
  for (var attempt = 0; attempt < 10; attempt++) {
    var code = randomCode();
    var existing = await runner.query("SELECT 1 FROM preorders WHERE preorder_code = $1", [code]);
    if (existing.rows.length === 0) return code;
  }
  throw new Error("Could not generate a unique preorder code after 10 attempts");
}

module.exports = { generateUniquePreorderCode };
