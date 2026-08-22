-- Success Cafe Durame - ideas + preorders
-- These were front-end-only forms (js/idea-modal.js, js/preorder-modal.js)
-- that validated input and showed a thank-you state but never sent
-- anything anywhere. This gives both a real table so submissions are
-- actually kept. preorder_items mirrors order_items: qty/price are
-- snapshotted at submit time so a later menu price change never
-- rewrites history, same reasoning as orders.

CREATE TABLE IF NOT EXISTS ideas (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  category    TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at DESC);

CREATE TABLE IF NOT EXISTS preorders (
  id                  SERIAL PRIMARY KEY,
  preorder_code       TEXT UNIQUE NOT NULL,
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT NOT NULL,

  reservation_date    DATE NOT NULL,
  reservation_time    TEXT,
  guests              INTEGER NOT NULL CHECK (guests > 0),

  item_count          INTEGER NOT NULL DEFAULT 0,
  subtotal            NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes               TEXT,                   -- customer's special requests / allergies

  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  admin_note          TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preorders_status ON preorders(status);
CREATE INDEX IF NOT EXISTS idx_preorders_created_at ON preorders(created_at DESC);

CREATE TABLE IF NOT EXISTS preorder_items (
  id            SERIAL PRIMARY KEY,
  preorder_id   INTEGER NOT NULL REFERENCES preorders(id) ON DELETE CASCADE,
  item_id       TEXT NOT NULL,
  item_name     TEXT NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL,
  qty           INTEGER NOT NULL CHECK (qty > 0),
  line_total    NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preorder_items_preorder_id ON preorder_items(preorder_id);
