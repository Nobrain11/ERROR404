import { Telegraf } from "telegraf";
import cron from "node-cron";
import { config } from "./config";
import { logger } from "./utils/logger";
import { verifyChainConnection } from "./services/provider";
import {
  validateAddress,
  validatePositiveNumber,
} from "./utils/validation";

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

import {
  listPositions,
  calculatePnlPercent,
} from "./services/positions";

import {
  getSniperSettings,
  startSniper,
  stopSniper,
  updateSniperSettings,
} from "./services/sniper";

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

import {
  alertsEnabled,
  enableAlerts,
  disableAlerts,
} from "./services/alerts";

import { getTokenMarketData } from "./services/market";

import {
  consumeConfirmation,
  cancelConfirmation,
} from "./services/confirmation";

import {
  getPendingInput,
  setPendingInput,
  getLastScan,
} from "./services/session";

import {
  formatAddress,
  formatEth,
  money,
} from "./utils/format";

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

const bot = new Telegraf(config.telegramBotToken);

const WELCOME = [
  "⚡ ERROR404",
  "",
  "Robinhood Chain Trading Bot",
].join("\n");

function requireUserId(
  ctx: { from?: { id: number } }
): number | null {
  return ctx.from?.id ?? null;
}

// ============================================================
// COMMANDS
// ============================================================

bot.command("start", async (ctx) => {
  await ctx.reply(
    WELCOME,
    mainMenuKeyboard
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "ERROR404 — Commands",
      "",
      "/start — Main menu",
      "/wallet — Wallet management",
      "/balance — Active wallet balance",
      "/scan — Analyze a token",
      "/positions — Open positions",
      "/orders — Order history",
      "/sniper — Sniper controls",
      "/autopilot — Autopilot controls",
      "/smartmoney — Track wallets",
      "/alerts — Alert controls",
      "",
      "You can also paste a Robinhood Chain token address directly.",
    ].join("\n")
  );
});

bot.command("wallet", async (ctx) => {
  await ctx.reply(
    "💼 WALLET",
    walletMenuKeyboard
  );
});

bot.command("balance", async (ctx) => {
  const uid = requireUserId(ctx);

  if (!uid) return;

  await sendBalance(ctx, uid);
});

bot.command("scan", async (ctx) => {
  await ctx.reply(
    "🔎 Send a Robinhood Chain token contract address to analyze."
  );
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
  await ctx.reply(
    "🐋 SMART MONEY",
    smartMoneyMenuKeyboard
  );
});

bot.command("alerts", async (ctx) => {
  const uid = requireUserId(ctx);

  if (!uid) return;

  await ctx.reply(
    "🔔 ALERTS",
    alertsMenuKeyboard(
      alertsEnabled(uid)
    )
  );
});

// ============================================================
// MAIN MENU
// ============================================================

bot.action("MENU_HOME", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    WELCOME,
    mainMenuKeyboard
  );
});

bot.action("MENU_WALLET", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "💼 WALLET",
    walletMenuKeyboard
  );
});

bot.action("MENU_SCAN", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    "🔎 Send a Robinhood Chain token contract address to analyze."
  );
});

bot.action("MENU_TRADE", async (ctx) => {
  await ctx.answerCbQuery();

  const uid = requireUserId(ctx);

  if (!uid) return;

  const last = getLastScan(uid);

  if (!last) {
    await ctx.reply(
      "Send a token address first using 🔎 SCAN."
    );

    return;
  }

  await ctx.reply(
    renderTokenAnalysis(last),
    buyAmountKeyboard(
      last.token.address
    )
  );
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

  await ctx.reply(
    "🐋 SMART MONEY",
    smartMoneyMenuKeyboard
  );
});

bot.action("MENU_ALERTS", async (ctx) => {
  await ctx.answerCbQuery();

  const uid = requireUserId(ctx);

  if (!uid) return;

  await ctx.reply(
    "🔔 ALERTS",
    alertsMenuKeyboard(
      alertsEnabled(uid)
    )
  );
});

// ============================================================
// WALLET
// ============================================================

bot.action("WALLET_CREATE", async (ctx) => {
  await ctx.answerCbQuery();

  const uid = requireUserId(ctx);

  if (!uid) return;

  const label =
    `Wallet ${listWallets(uid).length + 1}`;

  const wallet = createWallet(label);

  addWallet(uid, wallet);

  await ctx.reply(
    [
      "✅ Wallet created.",
      "",
      `Label: ${wallet.label}`,
      `Address: ${wallet.address}`,
    ].join("\n")
  );
});

bot.action("WALLET_IMPORT_PK", async (ctx) => {
  await ctx.answerCbQuery();

  const uid = requireUserId(ctx);

  if (!uid) return;

  setPendingInput(uid, {
    kind: "IMPORT_PRIVATE_KEY",
  });

  await ctx.reply(
    "Send the private key to import."
  );
});

bot.action("WALLET_IMPORT_SEED", async (ctx) => {
  await ctx.answerCbQuery();

  const uid = requireUserId(ctx);

  if (!uid) return;

  setPendingInput(uid, {
    kind: "IMPORT_SEED_PHRASE",
  });

  await ctx.reply(
    "Send the seed phrase to import."
  );
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

bot.action(
  /^WALLET_SWITCH_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const walletId = ctx.match[1];

    const ok = setActiveWallet(
      uid,
      walletId
    );

    await ctx.reply(
      ok
        ? "✅ Active wallet switched."
        : "❌ Wallet not found."
    );

    if (ok) {
      await sendWalletList(ctx, uid);
    }
  }
);

bot.action(
  /^WALLET_DELETE_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const walletId = ctx.match[1];

    const ok = deleteWallet(
      uid,
      walletId
    );

    await ctx.reply(
      ok
        ? "🗑 Wallet deleted."
        : "❌ Wallet not found."
    );

    if (ok) {
      await sendWalletList(ctx, uid);
    }
  }
);

// ============================================================
// TRADING
// ============================================================

bot.action(
  /^TRADE_BUY_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const tokenAddress =
      ctx.match[1];

    await ctx.reply(
      "⚡ BUY",
      buyAmountKeyboard(tokenAddress)
    );
  }
);

bot.action(
  /^TRADE_SELL_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const tokenAddress =
      ctx.match[1];

    await ctx.reply(
      "📉 SELL",
      sellPercentKeyboard(tokenAddress)
    );
  }
);

// Custom buy amount
bot.action(
  /^BUYAMT_CUSTOM_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const tokenAddress =
      ctx.match[1];

    setPendingInput(uid, {
      kind: "CUSTOM_BUY_AMOUNT",
      context: {
        tokenAddress,
      },
    });

    await ctx.reply(
      "Enter the ETH amount to buy.\n\nExample: 0.15"
    );
  }
);

// Preset buy amount
bot.action(
  /^BUYAMT_(0x[a-fA-F0-9]{40})_([\d.]+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const tokenAddress =
      ctx.match[1];

    const amountStr =
      ctx.match[2];

    const amount =
      validatePositiveNumber(amountStr);

    if (amount === null) {
      await ctx.reply(
        "❌ Invalid buy amount."
      );

      return;
    }

    await startBuyFlow(
      ctx,
      uid,
      tokenAddress,
      amount
    );
  }
);

// Sell percentage
bot.action(
  /^SELLPCT_(0x[a-fA-F0-9]{40})_(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const tokenAddress =
      ctx.match[1];

    const pctStr =
      ctx.match[2];

    const amountPercent =
      validatePositiveNumber(pctStr);

    if (
      amountPercent === null ||
      amountPercent > 100
    ) {
      await ctx.reply(
        "❌ Invalid sell percentage."
      );

      return;
    }

    await startSellFlow(
      ctx,
      uid,
      tokenAddress,
      amountPercent
    );
  }
);

// Confirm trade
bot.action(
  /^CONFIRM_EXEC_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const confirmationId =
      ctx.match[1];

    const confirmation =
      consumeConfirmation(
        confirmationId
      );

    if (!confirmation) {
      await ctx.reply(
        "❌ This confirmation has expired. Please start the trade again."
      );

      return;
    }

    await executeConfirmedTrade(
      ctx,
      uid,
      confirmationId,
      confirmation
    );
  }
);

// Cancel trade
bot.action(
  /^CONFIRM_CANCEL_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const confirmationId =
      ctx.match[1];

    cancelConfirmation(
      confirmationId
    );

    await ctx.reply(
      "❌ Trade cancelled."
    );
  }
);

// ============================================================
// SNIPER
// ============================================================

bot.action(
  "SNIPER_TOGGLE",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const current =
      getSniperSettings(uid);

    if (current.active) {
      stopSniper(uid);
    } else {
      startSniper(uid);
    }

    await sendSniperMenu(
      ctx,
      uid
    );
  }
);

bot.action(
  "SNIPER_SETTINGS",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const s =
      getSniperSettings(uid);

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
        "Use:",
        "/sniperset field value",
        "",
        "Fields:",
        "minscore",
        "maxrisk",
        "minliq",
        "maxmcap",
        "maxbuy",
      ].join("\n")
    );
  }
);

bot.command(
  "sniperset",
  async (ctx) => {
    const uid = requireUserId(ctx);

    if (!uid) return;

    const parts =
      ctx.message.text
        .split(" ")
        .slice(1);

    const field =
      parts[0];

    const valueStr =
      parts[1];

    const value =
      Number(valueStr);

    if (
      !field ||
      Number.isNaN(value)
    ) {
      await ctx.reply(
        "Usage: /sniperset field value"
      );

      return;
    }

    const map: Record<
      string,
      string
    > = {
      minscore: "minScore",
      maxrisk: "maxRisk",
      minliq: "minLiquidityUsd",
      maxmcap: "maxMarketCapUsd",
      maxbuy: "maxBuyEth",
    };

    const key =
      map[field.toLowerCase()];

    if (!key) {
      await ctx.reply(
        "Unknown field."
      );

      return;
    }

    updateSniperSettings(
      uid,
      {
        [key]: value,
      } as never
    );

    await ctx.reply(
      `✅ Updated ${field} to ${value}.`
    );
  }
);

// ============================================================
// AUTOPILOT
// ============================================================

bot.action(
  "AUTOPILOT_TOGGLE",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const current =
      getAutopilotSettings(uid);

    if (current.active) {
      stopAutopilot(uid);
    } else {
      startAutopilot(uid);
    }

    await sendAutopilotMenu(
      ctx,
      uid
    );
  }
);

bot.action(
  "AUTOPILOT_SETTINGS",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const s =
      getAutopilotSettings(uid);

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
        "Use:",
        "/autopilotset field value",
      ].join("\n")
    );
  }
);

bot.command(
  "autopilotset",
  async (ctx) => {
    const uid = requireUserId(ctx);

    if (!uid) return;

    const parts =
      ctx.message.text
        .split(" ")
        .slice(1);

    const field =
      parts[0];

    const valueStr =
      parts[1];

    const value =
      Number(valueStr);

    if (
      !field ||
      Number.isNaN(value)
    ) {
      await ctx.reply(
        "Usage: /autopilotset field value"
      );

      return;
    }

    const map: Record<
      string,
      string
    > = {
      capital: "capitalEth",
      maxtrade: "maxTradeEth",
      maxpos: "maxPositions",
      minscore: "minScore",
      maxrisk: "maxRisk",
      stoploss: "stopLossPercent",
      trailstop: "trailingStopPercent",
    };

    const key =
      map[field.toLowerCase()];

    if (!key) {
      await ctx.reply(
        "Unknown field."
      );

      return;
    }

    updateAutopilotSettings(
      uid,
      {
        [key]: value,
      } as never
    );

    await ctx.reply(
      `✅ Updated ${field} to ${value}.`
    );
  }
);

// ============================================================
// SMART MONEY
// ============================================================

bot.action(
  "SMARTMONEY_TRACK",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    setPendingInput(uid, {
      kind: "TRACK_WALLET_ADDRESS",
    });

    await ctx.reply(
      "Send the wallet address to track."
    );
  }
);

bot.action(
  "SMARTMONEY_LIST",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    const wallets =
      listTrackedWallets(uid);

    if (wallets.length === 0) {
      await ctx.reply(
        "No tracked wallets yet.",
        smartMoneyMenuKeyboard
      );

      return;
    }

    const lines =
      await Promise.all(
        wallets.map(
          async (w) => {
            try {
              const activity =
                await getWalletActivity(
                  w.address
                );

              return [
                w.label,
                formatAddress(
                  w.address
                ),
                `Balance: ${Number(activity.balanceEth).toFixed(4)} ETH`,
                `Transactions: ${activity.txCount}`,
              ].join("\n");
            } catch {
              return [
                w.label,
                formatAddress(
                  w.address
                ),
                "Activity unavailable",
              ].join("\n");
            }
          }
        )
      );

    await ctx.reply(
      [
        "🐋 TRACKED WALLETS",
        "",
        lines.join("\n\n"),
      ].join("\n"),
      smartMoneyMenuKeyboard
    );
  }
);

// ============================================================
// ALERTS
// ============================================================

bot.action(
  "ALERTS_ENABLE",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    enableAlerts(uid);

    await ctx.reply(
      "🔔 Alerts enabled.",
      alertsMenuKeyboard(true)
    );
  }
);

bot.action(
  "ALERTS_DISABLE",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);

    if (!uid) return;

    disableAlerts(uid);

    await ctx.reply(
      "🔕 Alerts disabled.",
      alertsMenuKeyboard(false)
    );
  }
);

// ============================================================
// FREE TEXT
// ============================================================

bot.on("text", async (ctx) => {
  const uid = requireUserId(ctx);

  if (!uid) return;

  const text =
    ctx.message.text.trim();

  if (text.startsWith("/")) {
    return;
  }

  const pending =
    getPendingInput(uid);

  // -----------------------------
  // Private key import
  // -----------------------------

  if (
    pending?.kind ===
    "IMPORT_PRIVATE_KEY"
  ) {
    setPendingInput(
      uid,
      null
    );

    try {
      const wallet =
        importFromPrivateKey(
          text,
          `Wallet ${listWallets(uid).length + 1}`
        );

      addWallet(
        uid,
        wallet
      );

      await ctx.reply(
        [
          "✅ Wallet imported.",
          "",
          `Address: ${wallet.address}`,
        ].join("\n")
      );
    } catch {
      await ctx.reply(
        "❌ Invalid private key."
      );
    }

    return;
  }

  // -----------------------------
  // Seed phrase import
  // -----------------------------

  if (
    pending?.kind ===
    "IMPORT_SEED_PHRASE"
  ) {
    setPendingInput(
      uid,
      null
    );

    try {
      const wallet =
        importFromSeedPhrase(
          text,
          `Wallet ${listWallets(uid).length + 1}`
        );

      addWallet(
        uid,
        wallet
      );

      await ctx.reply(
        [
          "✅ Wallet imported.",
          "",
          `Address: ${wallet.address}`,
        ].join("\n")
      );
    } catch {
      await ctx.reply(
        "❌ Invalid seed phrase."
      );
    }

    return;
  }

  // -----------------------------
  // Custom buy amount
  // -----------------------------

  if (
    pending?.kind ===
    "CUSTOM_BUY_AMOUNT"
  ) {
    setPendingInput(
      uid,
      null
    );

    const tokenAddress =
      pending.context?.tokenAddress;

    const amount =
      validatePositiveNumber(text);

    if (
      !tokenAddress ||
      amount === null
    ) {
      await ctx.reply(
        "❌ Invalid ETH amount."
      );

      return;
    }

    await startBuyFlow(
      ctx,
      uid,
      tokenAddress,
      amount
    );

    return;
  }

  // -----------------------------
  // Track wallet
  // -----------------------------

  if (
    pending?.kind ===
    "TRACK_WALLET_ADDRESS"
  ) {
    setPendingInput(
      uid,
      null
    );

    const result =
      trackWallet(
        uid,
        text
      );

    if (!result) {
      await ctx.reply(
        "❌ Invalid wallet address."
      );

      return;
    }

    await ctx.reply(
      `✅ Tracking ${formatAddress(result.address)}.`,
      smartMoneyMenuKeyboard
    );

    return;
  }

  // -----------------------------
  // Token address
  // -----------------------------

  if (validateAddress(text)) {
    await analyzeAndReply(
      ctx,
      uid,
      text
    );

    return;
  }

  await ctx.reply(
    "Send a valid Robinhood Chain token address, or use /help."
  );
});

// ============================================================
// WALLET LIST
// ============================================================

async function sendWalletList(
  ctx: import("telegraf").Context,
  uid: number
) {
  const wallets =
    listWallets(uid);

  const active =
    getActiveWallet(uid);

  if (wallets.length === 0) {
    await ctx.reply(
      "No wallets yet. Create or import one.",
      walletMenuKeyboard
    );

    return;
  }

  await ctx.reply(
    "📋 LIST WALLETS",
    walletListKeyboard(
      wallets.map(
        (w) => ({
          id: w.id,
          label:
            `${w.label} (${formatAddress(w.address)})`,
        })
      ),
      active?.id ?? null
    )
  );
}

// ============================================================
// BALANCE
// ============================================================

async function sendBalance(
  ctx: import("telegraf").Context,
  uid: number
) {
  const wallet =
    getActiveWallet(uid);

  if (!wallet) {
    await ctx.reply(
      "No active wallet. Open 💼 WALLET to create or import one first.",
      walletMenuKeyboard
    );

    return;
  }

  try {
    const balance =
      await getBalanceEth(
        wallet.address
      );

    await ctx.reply(
      [
        "💰 BALANCE",
        "",
        wallet.label,
        formatAddress(
          wallet.address
        ),
        "",
        `${Number(balance).toFixed(4)} ETH`,
      ].join("\n")
    );
  } catch (err) {
    logger.error(
      "Balance fetch failed",
      {
        error: String(err),
      }
    );

    await ctx.reply(
      "Failed to fetch balance from Robinhood Chain."
    );
  }
}

// ============================================================
// POSITIONS
// ============================================================

async function sendPositions(
  ctx: import("telegraf").Context,
  uid: number
) {
  const positions =
    listPositions(uid);

  if (positions.length === 0) {
    await ctx.reply(
      "📊 POSITIONS\n\nNo open positions.",
      homeKeyboard
    );

    return;
  }

  for (const p of positions) {
    try {
      const token =
        await getTokenMarketData(
          p.tokenAddress
        );

      const pnl =
        calculatePnlPercent(
          p,
          token.priceUsd
        );

      await ctx.reply(
        [
          "📊 POSITIONS",
          "",
          `$${p.tokenSymbol}`,
          "",
          "Amount:",
          p.amountTokens.toFixed(4),
          "",
          "Entry:",
          money(
            p.entryPriceUsd
          ),
          "",
          "Current:",
          money(
            token.priceUsd
          ),
          "",
          "PnL:",
          `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`,
        ].join("\n"),
        positionRowKeyboard(
          p.tokenAddress
        )
      );
    } catch {
      await ctx.reply(
        [
          `$${p.tokenSymbol}`,
          `Amount: ${p.amountTokens.toFixed(4)}`,
          "Market data unavailable.",
        ].join("\n")
      );
    }
  }
}

// ============================================================
// ORDERS
// ============================================================

async function sendOrders(
  ctx: import("telegraf").Context,
  uid: number
) {
  const orders =
    listOrders(uid);

  if (orders.length === 0) {
    await ctx.reply(
      "📋 ORDERS\n\nNo orders yet.",
      homeKeyboard
    );

    return;
  }

  const lines =
    orders
      .slice(0, 20)
      .map(
        (o) =>
          `${o.side} $${o.tokenSymbol}\n${
            o.amountEth !== null &&
            o.amountEth !== undefined
              ? formatEth(o.amountEth)
              : `${o.amountPercent ?? 0}%`
          }\n${o.status}`
      );

  await ctx.reply(
    [
      "📋 ORDERS",
      "",
      lines.join("\n\n"),
    ].join("\n"),
    homeKeyboard
  );
}

// ============================================================
// SNIPER MENU
// ============================================================

async function sendSniperMenu(
  ctx: import("telegraf").Context,
  uid: number
) {
  const s =
    getSniperSettings(uid);

  await ctx.reply(
    [
      "🎯 SNIPER",
      "",
      "Status:",
      s.active
        ? "ON"
        : "OFF",
      "",
      "Minimum Score",
      `${s.minScore}`,
      "",
      "Maximum Risk",
      `${s.maxRisk}`,
      "",
      "Minimum Liquidity",
      money(
        s.minLiquidityUsd
      ),
      "",
      "Maximum Market Cap",
      money(
        s.maxMarketCapUsd
      ),
      "",
      "Maximum Buy",
      formatEth(
        s.maxBuyEth
      ),
    ].join("\n"),
    sniperMenuKeyboard(
      s.active
    )
  );
}

// ============================================================
// AUTOPILOT MENU
// ============================================================

async function sendAutopilotMenu(
  ctx: import("telegraf").Context,
  uid: number
) {
  const s =
    getAutopilotSettings(uid);

  await ctx.reply(
    [
      "🤖 AUTOPILOT",
      "",
      "Status:",
      s.active
        ? "ON"
        : "OFF",
      "",
      "Capital",
      formatEth(
        s.capitalEth
      ),
      "",
      "Max Trade",
      formatEth(
        s.maxTradeEth
      ),
      "",
      "Max Positions",
      `${s.maxPositions}`,
      "",
      "Minimum Score",
      `${s.minScore}`,
      "",
      "Maximum Risk",
      `${s.maxRisk}`,
      "",
      "Stop Loss",
      `${s.stopLossPercent}%`,
      "",
      "Trailing Stop",
      `${s.trailingStopPercent}%`,
      "",
      "Take Profit",
      `${s.takeProfitLevels.join("% / ")}%`,
    ].join("\n"),
    autopilotMenuKeyboard(
      s.active
    )
  );
}

// ============================================================
// HEARTBEAT
// ============================================================

cron.schedule(
  "*/30 * * * * *",
  () => {
    logger.debug(
      "ERROR404 heartbeat tick"
    );
  }
);

// ============================================================
// START BOT
// ============================================================

async function main(): Promise<void> {
  logger.info(
    "Connecting to Robinhood Chain..."
  );

  await verifyChainConnection();

  logger.info(
    "Robinhood Chain connection verified."
  );

  await bot.launch();

  logger.info(
    "ERROR404 Telegram bot is running."
  );
}

main().catch(
  (err) => {
    logger.error(
      "Fatal startup error",
      {
        error: String(err),
      }
    );

    process.exit(1);
  }
);

process.once(
  "SIGINT",
  () => {
    bot.stop("SIGINT");
  }
);

process.once(
  "SIGTERM",
  () => {
    bot.stop("SIGTERM");
  }
);
