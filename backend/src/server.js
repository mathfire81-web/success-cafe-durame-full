const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");

const menuRouter = require("./routes/menu");
const deliveryLandmarksRouter = require("./routes/deliveryLandmarks");
const ordersRouter = require("./routes/orders");
const adminAuthRouter = require("./routes/adminAuth");
const adminOrdersRouter = require("./routes/adminOrders");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ---- CORS ----
// The frontend/admin dashboard are deployed on a different origin
// (e.g. Vercel) than this API (e.g. Render), so cross-origin requests
// need to be explicitly allowed - including credentials, since admin
// auth relies on a cookie. Set ALLOWED_ORIGIN in the environment to a
// comma-separated list of exact origins in production.
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || config.allowedOrigins.length === 0 || config.allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

// ---- API ----
app.use("/api/menu", menuRouter);
app.use("/api/delivery-landmarks", deliveryLandmarksRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin/orders", adminOrdersRouter);

// ---- Admin dashboard (static; its own JS guards each page with
// GET /api/admin/auth/me and redirects to login when unauthenticated) ----
app.use("/admin", express.static(config.adminRoot));

// ---- The customer-facing site itself ----
// Note: backend/uploads (payment proof screenshots) lives outside
// both siteRoot and adminRoot entirely (see config.js) - it is only
// ever reachable through the authenticated
// GET /api/admin/orders/:id/proof route, never served directly.
app.use(express.static(config.siteRoot));

app.use(function notFound(req, res) {
  res.status(404).json({ error: "Not found." });
});

app.use(errorHandler);

app.listen(config.port, function () {
  console.log("Success Cafe server listening on port " + config.port);
});
