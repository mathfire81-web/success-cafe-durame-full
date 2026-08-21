require("dotenv").config();

function required(name, fallback) {
  var value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error("Missing required env var: " + name);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  databaseUrl: required("DATABASE_URL"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",

  // Seed-only: used by scripts/seed.js to create/update the first admin
  // account. Not read anywhere else, so rotating them later just means
  // re-running the seed script or updating the DB row directly.
  seedAdminUsername: process.env.ADMIN_USERNAME || "admin",
  seedAdminPassword: process.env.ADMIN_PASSWORD || "",

  maxProofUploadBytes: 8 * 1024 * 1024, // 8MB, matches MAX_PROOF_SIZE in js/payment.js

  // Layout: backend/, frontend/, and admin/ are sibling folders (see
  // project root). Deliberately NOT nested inside each other - the
  // static file server below only ever serves siteRoot/adminRoot, so
  // backend source, .env, and backend/uploads (payment proof images,
  // which must stay behind admin auth) are never reachable over HTTP.
  siteRoot: require("path").join(__dirname, "..", "..", "frontend"),
  adminRoot: require("path").join(__dirname, "..", "..", "admin")
};
