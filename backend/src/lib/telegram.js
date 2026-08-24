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

module.exports = { sendTelegramMessage };
