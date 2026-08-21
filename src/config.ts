export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,

  // Telegram user/chat ID that receives admin notifications.
  adminChatId: Number(process.env.ADMIN_CHAT_ID),

  // Blockchain
  rpcUrl: process.env.RPC_URL!,
  chainId: Number(process.env.CHAIN_ID),

  // Trading
  routerAddress: process.env.ROUTER_ADDRESS!,
  wethAddress: process.env.WETH_ADDRESS!,

  // Market data
  dexApiUrl: process.env.DEX_API_URL!,

  // Confirmation timeout
  confirmationTtlMs: Number(
    process.env.CONFIRMATION_TTL_MS ?? 120_000
  ),

  // Logging
  logLevel: process.env.LOG_LEVEL ?? "info",
};
