const { COOKIE_NAME, verifyAdminToken } = require("../lib/auth");

module.exports = function requireAdmin(req, res, next) {
  var token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not signed in." });

  try {
    req.admin = verifyAdminToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: "Session expired, please sign in again." });
  }
};
