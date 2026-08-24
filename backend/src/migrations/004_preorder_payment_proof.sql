-- Pre-orders are still a free reservation, not a checkout, but a
-- customer who has already sent a deposit transfer can now attach a
-- screenshot of that payment when booking (js/preorder-modal.js).
-- Stored the same way as orders.payment_proof_path - a filename on
-- local disk under backend/uploads, never a public URL - see
-- middleware/upload.js. Nullable because attaching one stays optional.

ALTER TABLE preorders ADD COLUMN IF NOT EXISTS payment_proof_path TEXT;
