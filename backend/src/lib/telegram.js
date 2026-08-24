const fs = require("fs");
const path = require("path");
const config = require("../config");

/* Sends a message to your Telegram chat via the Bot API.
   Fire-and-forget by design: notifications must never block or fail
   a customer's order, so every error here is only logged, never
   thrown. Silently does nothing if the bot isn't configured yet
   (see .env.example - TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID). */
async function sendTelegramMessage(text) {
  if (!config.telegramBotToken || !config.telegramChatId) return;

  try {
    const url = "https://api.telegram.org/bot" + config.telegramBotToken + "/sendMessage";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: text,
        parse_mode: "HTML"
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Telegram notify failed:", response.status, body);
    }
  } catch (err) {
    console.error("Telegram notify error:", err.message);
  }
}

/* Sends a photo (e.g. a payment proof screenshot) to your Telegram
   chat via the Bot API. `filePath` is a path on local disk (multer
   already saved it there before this is called - see
   middleware/upload.js). Same fire-and-forget contract as
   sendTelegramMessage: logs on failure, never throws. Caption is
   plain text, NOT HTML, despite the rest of this file using HTML
   parse mode - keep it simple and don't pass unescaped customer
   input here beyond what's already safe as a caption. */
async function sendTelegramPhoto(filePath, caption) {
  if (!config.telegramBotToken || !config.telegramChatId) return;
  if (!filePath || !fs.existsSync(filePath)) return;

  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const buffer = fs.readFileSync(filePath);

    const form = new FormData();
    form.append("chat_id", config.telegramChatId);
    if (caption) form.append("caption", caption);
    form.append("photo", new Blob([buffer], { type: mime }), "proof" + (ext || ".jpg"));

    const url = "https://api.telegram.org/bot" + config.telegramBotToken + "/sendPhoto";
    const response = await fetch(url, { method: "POST", body: form });

    if (!response.ok) {
      const body = await response.text();
      console.error("Telegram photo notify failed:", response.status, body);
    }
  } catch (err) {
    console.error("Telegram photo notify error:", err.message);
  }
}

/* Escapes the 3 characters that are special inside Telegram's HTML
   parse mode. Anything that comes from a customer (name, notes, txn
   reference, item names) MUST go through this before being dropped
   into a message string, or a stray '<' can break formatting or
   swallow the rest of the message. */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pad(value, width) {
  const s = String(value);
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

/* Renders order/pre-order line items as a monospace table using
   Telegram's <pre> block - real <table> markup isn't supported, but
   a fixed-width block lines up columns the same way on both mobile
   and desktop. `rows` is [{ qty, name, total }]. Text is escaped
   internally, so pass raw values in. */
function formatItemsTable(rows) {
  if (!rows || !rows.length) return "";
  const nameWidth = 18;
  const header = pad("Qty", 4) + pad("Item", nameWidth) + "Total";
  const lines = rows.map(function (r) {
    const name = escapeHtml(r.name).slice(0, nameWidth - 1);
    return pad(r.qty, 4) + pad(name, nameWidth) + r.total;
  });
  return "<pre>" + header + "\n" + lines.join("\n") + "</pre>";
}

module.exports = { sendTelegramMessage, sendTelegramPhoto, escapeHtml, formatItemsTable };
