# Success Cafe - Backend

Node/Express + PostgreSQL backend for the Success Cafe Durame site:
order persistence, server-side price/delivery-fee calculation, payment
proof screenshot uploads, and a small admin dashboard for manually
verifying Telebirr/CBE Birr/bank transfers before an order is
confirmed.

## Project layout

```
frontend/   the existing storefront (index.html, css/, js/, images/, data/)
admin/      admin dashboard (login + order verification)
backend/    this - Express API + Postgres, serves both of the above
```

`frontend/` and `admin/` are **siblings** of `backend/`, not nested
inside it. This is deliberate: the server only ever serves those two
folders as static files, so `backend/uploads` (payment proof
screenshots), `backend/.env`, and backend source code are never
reachable over HTTP - proof images are only ever served through the
authenticated `GET /api/admin/orders/:id/proof` route.

## One-time setup

1. **Create the database.**
   ```
   createdb success_cafe
   ```

2. **Configure environment.**
   ```
   cd backend
   cp .env.example .env
   ```
   Edit `.env`:
   - `DATABASE_URL` - your Postgres connection string
   - `JWT_SECRET` - any long random string
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` - the first admin login (leave
     `ADMIN_PASSWORD` blank to skip creating one, and set it later)

3. **Install dependencies.**
   ```
   npm install
   ```

4. **Run migrations.**
   ```
   npm run migrate
   ```

5. **Seed the menu, delivery landmarks, and admin user.**
   ```
   npm run seed
   ```
   This reads `frontend/data/menu.json` into the DB and mirrors the
   landmark list from `js/delivery-map.js` (kept in
   `backend/src/lib/landmarks-data.js` - if you add a landmark on the
   map, add it there too and re-run `npm run seed`).

6. **Start the server.**
   ```
   npm start
   ```
   Visit `http://localhost:3000` for the storefront and
   `http://localhost:3000/admin/login.html` for the admin dashboard.

   During development, `npm run dev` restarts on file changes (Node
   18+'s built-in `--watch`).

## How an order flows

1. Customer checks out on `payment-verification.html`. The page
   `POST`s `multipart/form-data` to `/api/orders` - customer info,
   cart items, fulfillment method (+ landmark id if delivery), payment
   method, transaction reference, and the proof screenshot file.
2. **The server, not the browser, decides the price.** Item prices are
   looked up fresh from the `menu_items` table, and the delivery fee
   is recomputed from the landmark's lat/lng using the same
   distance→fee formula as the frontend map
   (`backend/src/lib/delivery.js` mirrors `js/delivery-map.js`
   exactly). A tampered client-side fee or price is simply ignored.
3. Cash orders are marked `confirmed` immediately (nothing to verify).
   Telebirr/CBE Birr/bank orders are marked `pending_verification` and
   wait for an admin.
4. An admin signs in at `/admin/dashboard.html`, opens the order,
   views the proof screenshot, and clicks **Verify** or **Reject**
   (with an optional reason). Verified/confirmed orders can later be
   marked **Completed**.

## API summary

Public:
- `GET /api/menu` - categories + items
- `GET /api/delivery-landmarks` - landmarks with computed km/fee/ETA
- `POST /api/orders` - place an order (multipart, see above)
- `GET /api/orders/:code` - public order status lookup by order code

Admin (require the `sc_admin_token` httpOnly cookie set by login):
- `POST /api/admin/auth/login`, `POST /api/admin/auth/logout`, `GET /api/admin/auth/me`
- `GET /api/admin/orders?status=&page=&pageSize=`
- `GET /api/admin/orders/:id`
- `GET /api/admin/orders/:id/proof` - streams the payment screenshot
- `POST /api/admin/orders/:id/verify`
- `POST /api/admin/orders/:id/reject` `{ reason }`
- `POST /api/admin/orders/:id/complete`

## Notes / things to revisit later

- **Menu is still hardcoded on the frontend** (`js/menu-data.js`) for
  offline-friendly browsing; the DB is the seed target and is ready to
  serve `GET /api/menu`, but `menu.js`/`home.js`/`food-picker.js`
  weren't rewired to fetch it live in this pass - that's a small,
  separate follow-up if you want menu edits to go live without a code
  deploy.
- **Deploying frontend and backend on different origins:** right now
  they're served by the same Express app (no CORS needed). If you ever
  split them apart, add the `cors` package and allow-list the frontend
  origin on `/api/*`.
- **Multiple app instances:** the admin login rate limiter is
  in-memory per process; fine for one instance, but swap for a shared
  store (e.g. Redis) if you ever scale to more than one.
