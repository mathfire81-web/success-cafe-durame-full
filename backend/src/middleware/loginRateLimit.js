/*
  Minimal in-memory brute-force guard for POST /api/admin/auth/login.
  Keyed by IP, sliding window. Good enough for a single-cafe, single-
  instance deployment; if this ever runs behind multiple app
  instances, swap for a shared store (Redis) instead.
*/
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

var attemptsByIp = new Map();

function prune(now) {
  attemptsByIp.forEach(function (record, ip) {
    if (now - record.windowStart > WINDOW_MS) attemptsByIp.delete(ip);
  });
}

module.exports = function loginRateLimit(req, res, next) {
  var ip = req.ip || "unknown";
  var now = Date.now();
  prune(now);

  var record = attemptsByIp.get(ip);
  if (!record || now - record.windowStart > WINDOW_MS) {
    record = { windowStart: now, count: 0 };
    attemptsByIp.set(ip, record);
  }

  if (record.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Too many login attempts. Try again later." });
  }

  record.count += 1;
  next();
};
