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

  // Comma-separated list of origins allowed to call the API with
  // credentials (e.g. https://your-site.vercel.app). Empty = allow any
  // origin (fine for local dev, tighten this in production).
  allowedOrigins: (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",

  // Seed-only: used by scripts/seed.js to create/update the first admin
  // account. Not read anywhere else, so rotating them later just means
  // re-running the seed script or updating the DB row directly.
  seedAdminUsername: process.env.ADMIN_USERNAME || "admin",
  seedAdminPassword: process.env.ADMIN_PASSWORD || "",

  maxProofUploadBytes: 8 * 1024 * 1024, // 8MB, matches MAX_PROOF_SIZE in js/payment.js
  maxMenuPhotoBytes: 5 * 1024 * 1024, // 5MB

  // Supabase Storage, used ONLY for menu item photos an admin uploads
  // from the dashboard - Render's own disk is wiped on every deploy,
  // so photos can't live there. Optional: the upload route checks for
  // these itself and returns a clear error rather than crashing
  // startup if they're not set yet.
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  menuPhotosBucket: process.env.SUPABASE_MENU_BUCKET || "menu-images",

  // Telegram notifications (new order / new pre-order alerts). Optional
  // - lib/telegram.js just no-ops if these aren't set. Get these from
  // @BotFather (bot token) and @userinfobot or getUpdates (chat id).
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",

  // Layout: backend/, frontend/, and admin/ are sibling folders (see
  // project root). Deliberately NOT nested inside each other - the
  // static file server below only ever serves siteRoot/adminRoot, so
  // backend source, .env, and backend/uploads (payment proof images,
  // which must stay behind admin auth) are never reachable over HTTP.
  siteRoot: require("path").join(__dirname, "..", "..", "frontend"),
  adminRoot: require("path").join(__dirname, "..", "..", "admin")
};
