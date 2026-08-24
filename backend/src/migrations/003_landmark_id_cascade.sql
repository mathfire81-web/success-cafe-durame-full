-- Lets an admin rename or delete a delivery zone (delivery_landmarks.id)
-- without it blowing up on past orders that reference it. Orders
-- already snapshot delivery_address_text/delivery_km/delivery_fee at
-- order time, so the landmark row itself is only ever a live pointer -
-- safe to let it follow a rename (CASCADE) or go null on delete
-- (SET NULL) without losing any historical order data.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_landmark_id_fkey;

ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_landmark_id_fkey
  FOREIGN KEY (delivery_landmark_id) REFERENCES delivery_landmarks(id)
  ON UPDATE CASCADE ON DELETE SET NULL;
