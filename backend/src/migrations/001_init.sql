-- Success Cafe Durame - initial schema
-- Menu is DB-backed (mirrors data/menu.json / js/menu-data.js so the
-- two stay in sync via scripts/seed.js). Orders are the real record of
-- what was placed; order_items snapshots price/name at order time so
-- a later menu price change never rewrites history. delivery_landmarks
-- mirrors js/delivery-map.js's LANDMARKS so delivery fees are computed
-- server-side, not trusted from the client.

CREATE TABLE IF NOT EXISTS menu_categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  name_am     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id            TEXT PRIMARY KEY,             -- e.g. 'sw-01', matches existing frontend ids
  category_id   INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_am       TEXT,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image         TEXT,
  badge         TEXT,
  is_available  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS delivery_landmarks (
  id      TEXT PRIMARY KEY,                   -- e.g. 'aberash-hotel'
  name    TEXT NOT NULL,
  lat     DOUBLE PRECISION NOT NULL,
  lng     DOUBLE PRECISION NOT NULL,
  approx  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                  SERIAL PRIMARY KEY,
  order_code          TEXT UNIQUE NOT NULL,
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT NOT NULL,

  fulfillment_method  TEXT NOT NULL CHECK (fulfillment_method IN ('in-cafe', 'delivery')),
  delivery_landmark_id TEXT REFERENCES delivery_landmarks(id),
  delivery_address_text TEXT,                 -- formatted snapshot, e.g. "Near Aberash Hotel, Durame town"
  delivery_km         NUMERIC(6,2),
  delivery_fee        NUMERIC(10,2) NOT NULL DEFAULT 0,

  subtotal            NUMERIC(10,2) NOT NULL,
  total               NUMERIC(10,2) NOT NULL,

  payment_method      TEXT NOT NULL CHECK (payment_method IN ('telebirr', 'cbebirr', 'bank', 'cash')),
  txn_reference       TEXT,
  payment_proof_path  TEXT,                   -- relative path under backend/uploads

  status              TEXT NOT NULL DEFAULT 'pending_verification'
                        CHECK (status IN ('pending_verification', 'confirmed', 'verified', 'rejected', 'completed')),
  admin_note          TEXT,
  verified_by         INTEGER REFERENCES admin_users(id),
  verified_at         TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  item_name   TEXT NOT NULL,
  unit_price  NUMERIC(10,2) NOT NULL,
  qty         INTEGER NOT NULL CHECK (qty > 0),
  line_total  NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
