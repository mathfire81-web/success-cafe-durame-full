/* Mirrors PAYMENT_NOTES in js/payment.js - which methods require a
   transaction reference + proof screenshot before an order can be
   auto-marked "pending_verification" vs going straight to
   "confirmed" (cash, paid on delivery/pickup). */
const PAYMENT_METHODS = {
  telebirr: { requiresRef: true },
  cbebirr: { requiresRef: true },
  bank: { requiresRef: true },
  cash: { requiresRef: false }
};

module.exports = { PAYMENT_METHODS };
