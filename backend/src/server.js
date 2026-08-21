const express = require("express");
const cookieParser = require("cookie-parser");
const config = require("./config");

const menuRouter = require("./routes/menu");
const deliveryLandmarksRouter = require("./routes/deliveryLandmarks");
const ordersRouter = require("./routes/orders");
const adminAuthRouter = require("./routes/adminAuth");
const adminOrdersRouter = require("./routes/adminOrders");
const errorHandler = require("./middleware/errorHandler");

const app = express();

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
