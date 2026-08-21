import "dotenv/config";

export const config = {
  telegramBotToken:
    process.env.TELEGRAM_BOT_TOKEN ?? "",

  adminChatId:
    Number(process.env.ADMIN_CHAT_ID ?? 0),

  rpcUrl:
    process.env.RPC_URL ?? "",

  chainId:
    Number(process.env.CHAIN_ID ?? 0),

  logLevel:
    process.env.LOG_LEVEL ?? "info",
};

if (!config.telegramBotToken) {
  throw new Error(
    "TELEGRAM_BOT_TOKEN is not configured."
  );
}

if (!config.adminChatId) {
  console.warn(
    "⚠️ ADMIN_CHAT_ID is not configured. Admin notifications are disabled."
  );
}
