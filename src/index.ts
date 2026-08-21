import { Telegraf } from "telegraf";
import cron from "node-cron";
import { config } from "./config";
import { logger } from "./utils/logger";
import { verifyChainConnection } from "./services/provider";
import { validateAddress } from "./utils/validation";
import {
  createWallet,
  importFromPrivateKey,
  importFromSeedPhrase,
  getBalanceEth,
} from "./services/wallet";
import {
  addWallet,
  listWallets,
  getActiveWallet,
  setActiveWallet,
  deleteWallet,
} from "./services/walletStore";
import { listOrders } from "./services/orders";
import { listPositions, calculatePnlPercent } from "./services/positions";
import { getSniperSettings, startSniper, stopSniper, updateSniperSettings } from "./services/sniper";
import {
  getAutopilotSettings,
  startAutopilot,
  stopAutopilot,
  updateAutopilotSettings,
} from "./services/autopilot";
import {
  trackWallet,
  listTrackedWallets,
  getWalletActivity,
} from "./services/smartMoney";
import { alertsEnabled, enableAlerts, disableAlerts } from "./services/alerts";
import { getTokenMarketData } from "./services/market";
import { scanToken } from "./services/scanner";
import { consumeConfirmation, cancelConfirmation } from "./services/confirmation";
import { getPendingInput, setPendingInput, getLastScan } from "./services/session";
import { formatAddress, formatEth, money } from "./utils/format";
import {
  mainMenuKeyboard,
  homeKeyboard,
  walletMenuKeyboard,
  walletListKeyboard,
  buyAmountKeyboard,
  sellPercentKeyboard,
  sniperMenuKeyboard,
  autopilotMenuKeyboard,
  smartMoneyMenuKeyboard,
  alertsMenuKeyboard,
  positionRowKeyboard,
} from "./bot/keyboards";
import {
  analyzeAndReply,
  startBuyFlow,
  startSellFlow,
  executeConfirmedTrade,
  renderTokenAnalysis,
} from "./bot/tradeFlow";
import { validatePositiveNumber } from "./utils/validation";

const bot = new Telegraf(config.telegramBotToken);

const WELCOME = [
  "⚡ ERROR404",
  "",
  "Robinhood Chain Trading Bot",
].join("\n");

function requireUserId(ctx: { from?: { id: number } }): number | null {
  return ctx.from?.id ?? null;
}

// ---------- Commands ----------

bot.command("start", async (ctx) => {
  await ctx.reply(WELCOME, mainMenuKeyboard);
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Commands:",
      "/start — main menu",
      "/wallet — wallet management",
      "/balance — active wallet balance",
      "/scan — send a token address to analyze",
      "/positions — open positions",
      "/orders — order history",
      "/sniper — sniper controls",
      "/autopilot — autopilot controls",
      "/smartmoney — track wallets",
      "/alerts — alert controls",
      "",
      "You can also just paste a Robinhood Chain token address to analyze it.",
    ].join("\n")
  );
});

bot.command("wallet", async (ctx) => {
  await ctx.reply("💼 WALLET", walletMenuKeyboard);
});

bot.command("balance", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendBalance(ctx, uid);
});

bot.command("scan", async (ctx) => {
  await ctx.reply("Send a Robinhood Chain token contract address to analyze.");
});

bot.command("positions", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendPositions(ctx, uid);
});

bot.command("orders", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendOrders(ctx, uid);
});

bot.command("sniper", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendSniperMenu(ctx, uid);
});

bot.command("autopilot", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendAutopilotMenu(ctx, uid);
});

bot.command("smartmoney", async (ctx) => {
  await ctx.reply("🐋 SMART MONEY", smartMoneyMenuKeyboard);
});

bot.command("alerts", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  await ctx.reply("🔔 ALERTS", alertsMenuKeyboard(alertsEnabled(uid)));
});

// ---------- Menu navigation ----------

bot.action("MENU_HOME", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(WELCOME, mainMenuKeyboard);
});

bot.action("MENU_WALLET", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("💼 WALLET", walletMenuKeyboard);
});

bot.action("MENU_SCAN", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Send a Robinhood Chain token contract address to analyze.");
});

bot.action("MENU_TRADE", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const last = getLastScan(uid);
  if (!last) {
    await ctx.reply("Send a token address first (🔎 SCAN) to trade it.");
    return;
  }
  await ctx.reply(renderTokenAnalysis(last), buyAmountKeyboard(last.token.address));
});

bot.action("MENU_POSITIONS", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendPositions(ctx, uid);
});

bot.action("MENU_ORDERS", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendOrders(ctx, uid);
});

bot.action("MENU_SNIPER", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendSniperMenu(ctx, uid);
});

bot.action("MENU_AUTOPILOT", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendAutopilotMenu(ctx, uid);
});

bot.action("MENU_SMARTMONEY", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("🐋 SMART MONEY", smartMoneyMenuKeyboard);
});

bot.action("MENU_ALERTS", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  await ctx.reply("🔔 ALERTS", alertsMenuKeyboard(alertsEnabled(uid)));
});

// ---------- Wallet actions ----------

bot.action("WALLET_CREATE", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const label = `Wallet ${listWallets(uid).length + 1}`;
  const wallet = createWallet(label);
  addWallet(uid, wallet);
  await ctx.reply(`✅ Wallet created.\n\nLabel: ${wallet.label}\nAddress: ${wallet.address}`);
});

bot.action("WALLET_IMPORT_PK", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  setPendingInput(uid, { kind: "IMPORT_PRIVATE_KEY" });
  await ctx.reply("Send the private key to import. This message will not be logged or displayed again.");
});

bot.action("WALLET_IMPORT_SEED", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  setPendingInput(uid, { kind: "IMPORT_SEED_PHRASE" });
  await ctx.reply("Send the seed phrase to import. This message will not be logged or displayed again.");
});

bot.action("WALLET_LIST", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendWalletList(ctx, uid);
});

bot.action("WALLET_BALANCE", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  await sendBalance(ctx, uid);
});

bot.action(/^WALLET_SWITCH_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const walletId = ctx.match[1];
  const ok = setActiveWallet(uid, walletId);
  await ctx.reply(ok ? "✅ Active wallet switched." : "Wallet not found.");
  if (ok) await sendWalletList(ctx, uid);
});

bot.action(/^WALLET_DELETE_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const walletId = ctx.match[1];
  const ok = deleteWallet(uid, walletId);
  await ctx.reply(ok ? "🗑 Wallet deleted." : "Wallet not found.");
  if (ok) await sendWalletList(ctx, uid);
});

// ---------- Trade actions ----------

bot.action(/^TRADE_BUY_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const tokenAddress = ctx.match[1];
  await ctx.reply("⚡ BUY", buyAmountKeyboard(tokenAddress));
});

bot.action(/^TRADE_SELL_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const tokenAddress = ctx.match[1];
  await ctx.reply("📉 SELL", sellPercentKeyboard(tokenAddress));
});

bot.action(/^BUYAMT_CUSTOM_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const tokenAddress = ctx.match[1];
  setPendingInput(uid, { kind: "CUSTOM_BUY_AMOUNT", context: { tokenAddress } });
  await ctx.reply("Send the ETH amount to buy (e.g. 0.15).");
});

bot.action(/^BUYAMT_(0x[a-fA-F0-9]{40})_([\d.]+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const [, tokenAddress, amountStr] = ctx.match;
  await startBuyFlow(ctx, uid, tokenAddress, Number(amountStr));
});

bot.action(/^SELLPCT_(0x[a-fA-F0-9]{40})_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const [, tokenAddress, pctStr] = ctx.match;
  await startSellFlow(ctx, uid, tokenAddress, Number(pctStr));
});

bot.action(/^CONFIRM_EXEC_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const confirmationId = ctx.match[1];
  const confirmation = consumeConfirmation(confirmationId);
  if (!confirmation) {
    await ctx.reply("This confirmation has expired. Please start the trade again.");
    return;
  }
  await executeConfirmedTrade(ctx, uid, confirmationId, confirmation);
});

bot.action(/^CONFIRM_CANCEL_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const confirmationId = ctx.match[1];
  cancelConfirmation(confirmationId);
  await ctx.reply("❌ Trade cancelled.");
});

// ---------- Sniper ----------

bot.action("SNIPER_TOGGLE", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const current = getSniperSettings(uid);
  if (current.active) stopSniper(uid);
  else startSniper(uid);
  await sendSniperMenu(ctx, uid);
});

bot.action("SNIPER_SETTINGS", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const s = getSniperSettings(uid);
  await ctx.reply(
    [
      "🎯 SNIPER SETTINGS",
      "",
      `Minimum Score: ${s.minScore}`,
      `Maximum Risk: ${s.maxRisk}`,
      `Minimum Liquidity: ${money(s.minLiquidityUsd)}`,
      `Maximum Market Cap: ${money(s.maxMarketCapUsd)}`,
      `Maximum Buy: ${formatEth(s.maxBuyEth)}`,
      "",
      "Edit settings by messaging: /sniperset field value",
      "Fields: minscore, maxrisk, minliq, maxmcap, maxbuy",
    ].join("\n")
  );
});

bot.command("sniperset", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  const parts = ctx.message.text.split(" ").slice(1);
  const [field, valueStr] = parts;
  const value = Number(valueStr);
  if (!field || Number.isNaN(value)) {
    await ctx.reply("Usage: /sniperset field value");
    return;
  }
  const map: Record<string, string> = {
    minscore: "minScore",
    maxrisk: "maxRisk",
    minliq: "minLiquidityUsd",
    maxmcap: "maxMarketCapUsd",
    maxbuy: "maxBuyEth",
  };
  const key = map[field.toLowerCase()];
  if (!key) {
    await ctx.reply("Unknown field. Use: minscore, maxrisk, minliq, maxmcap, maxbuy");
    return;
  }
  updateSniperSettings(uid, { [key]: value } as never);
  await ctx.reply(`✅ Updated ${field} to ${value}.`);
});

// ---------- Autopilot ----------

bot.action("AUTOPILOT_TOGGLE", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const current = getAutopilotSettings(uid);
  if (current.active) stopAutopilot(uid);
  else startAutopilot(uid);
  await sendAutopilotMenu(ctx, uid);
});

bot.action("AUTOPILOT_SETTINGS", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const s = getAutopilotSettings(uid);
  await ctx.reply(
    [
      "🤖 AUTOPILOT SETTINGS",
      "",
      `Capital: ${formatEth(s.capitalEth)}`,
      `Max Trade: ${formatEth(s.maxTradeEth)}`,
      `Max Positions: ${s.maxPositions}`,
      `Minimum Score: ${s.minScore}`,
      `Maximum Risk: ${s.maxRisk}`,
      `Stop Loss: ${s.stopLossPercent}%`,
      `Trailing Stop: ${s.trailingStopPercent}%`,
      `Take Profit: ${s.takeProfitLevels.join("% / ")}%`,
      "",
      "Edit settings by messaging: /autopilotset field value",
      "Fields: capital, maxtrade, maxpos, minscore, maxrisk, stoploss, trailstop",
    ].join("\n")
  );
});

bot.command("autopilotset", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  const parts = ctx.message.text.split(" ").slice(1);
  const [field, valueStr] = parts;
  const value = Number(valueStr);
  if (!field || Number.isNaN(value)) {
    await ctx.reply("Usage: /autopilotset field value");
    return;
  }
  const map: Record<string, string> = {
    capital: "capitalEth",
    maxtrade: "maxTradeEth",
    maxpos: "maxPositions",
    minscore: "minScore",
    maxrisk: "maxRisk",
    stoploss: "stopLossPercent",
    trailstop: "trailingStopPercent",
  };
  const key = map[field.toLowerCase()];
  if (!key) {
    await ctx.reply("Unknown field. Use: capital, maxtrade, maxpos, minscore, maxrisk, stoploss, trailstop");
    return;
  }
  updateAutopilotSettings(uid, { [key]: value } as never);
  await ctx.reply(`✅ Updated ${field} to ${value}.`);
});

// ---------- Smart Money ----------

bot.action("SMARTMONEY_TRACK", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  setPendingInput(uid, { kind: "TRACK_WALLET_ADDRESS" });
  await ctx.reply("Send the wallet address to track.");
});

bot.action("SMARTMONEY_LIST", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  const wallets = listTrackedWallets(uid);
  if (wallets.length === 0) {
    await ctx.reply("No tracked wallets yet.", smartMoneyMenuKeyboard);
    return;
  }
  const lines = await Promise.all(
    wallets.map(async (w) => {
      try {
        const activity = await getWalletActivity(w.address);
        return `${w.label}\n${formatAddress(w.address)}\nBalance: ${Number(activity.balanceEth).toFixed(4)} ETH | Txs: ${activity.txCount}`;
      } catch {
        return `${w.label}\n${formatAddress(w.address)}\nActivity unavailable`;
      }
    })
  );
  await ctx.reply(`🐋 TRACKED WALLETS\n\n${lines.join("\n\n")}`, smartMoneyMenuKeyboard);
});

// ---------- Alerts ----------

bot.action("ALERTS_ENABLE", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  enableAlerts(uid);
  await ctx.reply("🔔 Alerts enabled.", alertsMenuKeyboard(true));
});

bot.action("ALERTS_DISABLE", async (ctx) => {
  await ctx.answerCbQuery();
  const uid = requireUserId(ctx);
  if (!uid) return;
  disableAlerts(uid);
  await ctx.reply("🔕 Alerts disabled.", alertsMenuKeyboard(false));
});

// ---------- Free-text handling (pending inputs + token address scan) ----------

bot.on("text", async (ctx) => {
  const uid = requireUserId(ctx);
  if (!uid) return;
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return; // commands handled above

  const pending = getPendingInput(uid);

  if (pending?.kind === "IMPORT_PRIVATE_KEY") {
    setPendingInput(uid, null);
    try {
      const wallet = importFromPrivateKey(text, `Wallet ${listWallets(uid).length + 1}`);
      addWallet(uid, wallet);
      await ctx.reply(`✅ Wallet imported.\n\nAddress: ${wallet.address}`);
    } catch {
      await ctx.reply("❌ Invalid private key.");
    }
    return;
  }

  if (pending?.kind === "IMPORT_SEED_PHRASE") {
    setPendingInput(uid, null);
    try {
      const wallet = importFromSeedPhrase(text, `Wallet ${listWallets(uid).length + 1}`);
      addWallet(uid, wallet);
      await ctx.reply(`✅ Wallet imported.\n\nAddress: ${wallet.address}`);
    } catch {
      await ctx.reply("❌ Invalid seed phrase.");
    }
    return;
  }

  if (pending?.kind === "CUSTOM_BUY_AMOUNT") {
    setPendingInput(uid, null);
    const tokenAddress = pending.context?.tokenAddress;
    const amount = validatePositiveNumber(text);
    if (!tokenAddress || amount === null) {
      await ctx.reply("Invalid amount.");
      return;
    }
    await startBuyFlow(ctx, uid, tokenAddress, amount);
    return;
  }

  if (pending?.kind === "TRACK_WALLET_ADDRESS") {
    setPendingInput(uid, null);
    const result = trackWallet(uid, text);
    if (!result) {
      await ctx.reply("❌ Invalid wallet address.");
      return;
    }
    await ctx.reply(`✅ Tracking ${formatAddress(result.address)}.`, smartMoneyMenuKeyboard);
    return;
  }

  // Otherwise: treat as a token address for analysis.
  if (validateAddress(text)) {
    await analyzeAndReply(ctx, uid, text);
  } else {
    await ctx.reply("Send a valid Robinhood Chain token address, or use /help for commands.");
  }
});

// ---------- Helper senders ----------

async function sendWalletList(ctx: import("telegraf").Context, uid: number) {
  const wallets = listWallets(uid);
  const active = getActiveWallet(uid);
  if (wallets.length === 0) {
    await ctx.reply("No wallets yet. Create or import one.", walletMenuKeyboard);
    return;
  }
  await ctx.reply(
    "📋 LIST WALLETS",
    walletListKeyboard(
      wallets.map((w) => ({ id: w.id, label: `${w.label} (${formatAddress(w.address)})` })),
      active?.id ?? null
    )
  );
}

async function sendBalance(ctx: import("telegraf").Context, uid: number) {
  const wallet = getActiveWallet(uid);
  if (!wallet) {
    await ctx.reply("No active wallet. Open 💼 WALLET to create or import one first.", walletMenuKeyboard);
    return;
  }
  try {
    const balance = await getBalanceEth(wallet.address);
    await ctx.reply(`💰 BALANCE\n\n${wallet.label}\n${formatAddress(wallet.address)}\n\n${Number(balance).toFixed(4)} ETH`);
  } catch (err) {
    logger.error("Balance fetch failed", { error: String(err) });
    await ctx.reply("Failed to fetch balance from the chain.");
  }
}

async function sendPositions(ctx: import("telegraf").Context, uid: number) {
  const positions = listPositions(uid);
  if (positions.length === 0) {
    await ctx.reply("📊 POSITIONS\n\nNo open positions.", homeKeyboard);
    return;
  }
  for (const p of positions) {
    try {
      const token = await getTokenMarketData(p.tokenAddress);
      const pnl = calculatePnlPercent(p, token.priceUsd);
      await ctx.reply(
        [
          "📊 POSITIONS",
          "",
          `$${p.tokenSymbol}`,
          "",
          "Amount:",
          `${p.amountTokens.toFixed(4)}`,
          "",
          "Entry:",
          money(p.entryPriceUsd),
          "",
          "Current:",
          money(token.priceUsd),
          "",
          "PnL:",
          `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`,
        ].join("\n"),
        positionRowKeyboard(p.tokenAddress)
      );
    } catch {
      await ctx.reply(`$${p.tokenSymbol}\nAmount: ${p.amountTokens.toFixed(4)}\nMarket data unavailable.`);
    }
  }
}

async function sendOrders(ctx: import("telegraf").Context, uid: number) {
  const orders = listOrders(uid);
  if (orders.length === 0) {
    await ctx.reply("📋 ORDERS\n\nNo orders yet.", homeKeyboard);
    return;
  }
  const lines = orders
    .slice(0, 20)
    .map(
      (o) =>
        `${o.side} $${o.tokenSymbol}\n${o.amountEth ? formatEth(o.amountEth) : `${o.amountPercent}%`}\n${o.status}`
    );
  await ctx.reply(`📋 ORDERS\n\n${lines.join("\n\n")}`, homeKeyboard);
}

async function sendSniperMenu(ctx: import("telegraf").Context, uid: number) {
  const s = getSniperSettings(uid);
  await ctx.reply(
    [
      "🎯 SNIPER",
      "",
      `Status:`,
      s.active ? "ON" : "OFF",
      "",
      `Minimum Score`,
      `${s.minScore}`,
      "",
      `Maximum Risk`,
      `${s.maxRisk}`,
      "",
      `Minimum Liquidity`,
      money(s.minLiquidityUsd),
      "",
      `Maximum Market Cap`,
      money(s.maxMarketCapUsd),
      "",
      `Maximum Buy`,
      formatEth(s.maxBuyEth),
    ].join("\n"),
    sniperMenuKeyboard(s.active)
  );
}

async function sendAutopilotMenu(ctx: import("telegraf").Context, uid: number) {
  const s = getAutopilotSettings(uid);
  await ctx.reply(
    [
      "🤖 AUTOPILOT",
      "",
      `Status:`,
      s.active ? "ON" : "OFF",
      "",
      `Capital`,
      formatEth(s.capitalEth),
      "",
      `Max Trade`,
      formatEth(s.maxTradeEth),
      "",
      `Max Positions`,
      `${s.maxPositions}`,
      "",
      `Minimum Score`,
      `${s.minScore}`,
      "",
      `Maximum Risk`,
      `${s.maxRisk}`,
      "",
      `Stop Loss`,
      `${s.stopLossPercent}%`,
      "",
      `Trailing Stop`,
      `${s.trailingStopPercent}%`,
      "",
      `Take Profit`,
      `${s.takeProfitLevels.join("% / ")}%`,
    ].join("\n"),
    autopilotMenuKeyboard(s.active)
  );
}

// ---------- Background: expire stale confirmations is implicit via TTL checks on read ----------
// A light cron placeholder is kept here for future price-based alert/autopilot polling
// once a token discovery / new-pairs feed (DEX_API_URL) is wired in.
cron.schedule("*/30 * * * * *", () => {
  logger.debug("Heartbeat tick");
});

// ---------- Boot ----------

async function main(): Promise<void> {
  await verifyChainConnection();
  await bot.launch();
  logger.info("ERROR404 Telegram bot is running.");
}

main().catch((err) => {
  logger.error("Fatal startup error", { error: String(err) });
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
