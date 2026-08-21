import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : null;
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  rpcUrl: required("RPC_URL"),
  chainId: required("CHAIN_ID"),
  debug: (process.env.DEBUG || "false").toLowerCase() === "true",

  // Market data — required for real prices. If unset, market.ts reports
  // "Market data unavailable." instead of fabricating values.
  dexApiUrl: optional("DEX_API_URL"),

  // Trade execution — required to actually place on-chain swaps. If unset,
  // trade execution fails cleanly with a clear error instead of no-op faking a fill.
  routerAddress: optional("ROUTER_ADDRESS"),
  wethAddress: optional("WETH_ADDRESS"),

  confirmationTtlMs: 30_000,
};
