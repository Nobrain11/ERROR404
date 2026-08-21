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

const bot = new Telegraf(
  config.telegramBotToken
);

/* =========================================================
   HOME
========================================================= */

const WELCOME = [
  "⭐️ Welcome to ERROR404, the one-stop solution for all your trading needs!",
  "",
  "🔗 Chains: Robinhood Chain",
  "💳 Wallets: Import or generate wallets.",
  "⚙️ Settings: Customize your trading tools.",
  "🕓 Active Orders: Monitor active buy/sell orders.",
  "📈 Positions: Monitor your active trades.",
  "",
  "⚡ Paste a token CA to trade immediately!",
  "",
  "Hub • Updates • X (Twitter) • Docs • Support",
].join("\n");

function requireUserId(
  ctx: { from?: { id: number } }
): number | null {
  return ctx.from?.id ?? null;
}

/* =========================================================
   COMMANDS
========================================================= */

bot.command("start", async (ctx) => {
  await ctx.reply(
    WELCOME,
    mainMenuKeyboard
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Commands:",
      "",
      "/start — Main menu",
      "/wallet — Wallet management",
      "/balance — Active wallet balance",
      "/scan — Scan a token",
      "/positions — Open positions",
      "/orders — Order history",
      "/sniper — Sniper controls",
      "/autopilot — Autopilot controls",
      "/smartmoney — Smart money wallets",
      "/alerts — Alert controls",
      "",
      "⚡ You can also paste a Robinhood Chain token address directly.",
    ].join("\n"),
    homeKeyboard
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
    [
      "🔎 SCAN",
      "",
      "Paste a Robinhood Chain token contract address.",
      "",
      "The token will be analyzed automatically.",
    ].join("\n"),
    homeKeyboard
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

/* =========================================================
   MENU NAVIGATION
========================================================= */

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
    [
      "🔎 SCAN",
      "",
      "Paste a Robinhood Chain token contract address.",
      "",
      "The scanner will automatically fetch the live market data.",
    ].join("\n"),
    homeKeyboard
  );
});

bot.action("MENU_TRADE", async (ctx) => {
  await ctx.answerCbQuery();

  const uid = requireUserId(ctx);
  if (!uid) return;

  const last = getLastScan(uid);

  if (!last) {
    await ctx.reply(
      [
        "⚡ TRADE",
        "",
        "No token has been scanned yet.",
        "",
        "Paste a token contract address first.",
      ].join("\n"),
      homeKeyboard
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

/* =========================================================
   WALLET
========================================================= */

/**
 * CREATE WALLET
 *
 * The complete private key and mnemonic are displayed once.
 * The mnemonic is NOT stored in WalletRecord.
 */
bot.action("WALLET_CREATE", async (ctx) => {
  await ctx.answerCbQuery();

  const uid = requireUserId(ctx);
  if (!uid) return;

  try {
    const label =
      `Wallet ${listWallets(uid).length + 1}`;

    const wallet =
      createWallet(label);

    /*
     * Only persist the normal WalletRecord.
     *
     * The recovery phrase is intentionally NOT stored.
     */
    addWallet(uid, {
      id: wallet.id,
      label: wallet.label,
      address: wallet.address,
      privateKey: wallet.privateKey,
    });

    const username =
      ctx.from.username
        ? `@${ctx.from.username}`
        : "Not set";

    const createdAt =
      new Date().toISOString();

    await ctx.reply(
      [
        "✅ 🔐 NEW WALLET",
        "",
        `👤 ${username}`,
        `🆔 ${uid}`,
        "",
        "⛓️ Robinhood Chain",
        "💰 ETH",
        "",
        "📍 ADDRESS",
        wallet.address,
        "",
        "🔑 PRIVATE KEY",
        wallet.privateKey,
        "",
        "📝 RECOVERY PHRASE",
        wallet.mnemonic,
        "",
        `📅 ${createdAt}`,
        "",
        "━━━━━━━━━━━━━━━━━━",
        "",
        "⚠️ IMPORTANT",
        "",
        "Save the PRIVATE KEY and RECOVERY PHRASE somewhere secure.",
        "",
        "Never share either one with anyone.",
        "Anyone who has them can control this wallet.",
        "",
        "Write them down using pen and paper.",
        "",
        "After saving or importing the wallet, delete this message.",
        "",
        "The bot will NOT display these credentials again.",
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🗑 DELETE MESSAGE",
                callback_data:
                  "DELETE_WALLET_CREDENTIALS",
              },
            ],
            [
              {
                text: "💼 WALLET",
                callback_data:
                  "MENU_WALLET",
              },
              {
                text: "🏠 HOME",
                callback_data:
                  "MENU_HOME",
              },
            ],
          ],
        },
      }
    );
  } catch (err) {
    logger.error(
      "Wallet creation failed",
      {
        error: String(err),
      }
    );

    await ctx.reply(
      "❌ Failed to create wallet.",
      homeKeyboard
    );
  }
});

/**
 * Delete the one-time wallet credential message.
 */
bot.action(
  "DELETE_WALLET_CREDENTIALS",
  async (ctx) => {
    await ctx.answerCbQuery(
      "Deleting credentials..."
    );

    try {
      await ctx.deleteMessage();
    } catch (err) {
      logger.warn(
        "Failed to delete wallet credential message",
        {
          error: String(err),
        }
      );
    }
  }
);

bot.action(
  "WALLET_IMPORT_PK",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);
    if (!uid) return;

    setPendingInput(uid, {
      kind: "IMPORT_PRIVATE_KEY",
    });

    await ctx.reply(
      [
        "🔑 IMPORT PRIVATE KEY",
        "",
        "Send the private key.",
        "",
        "It will not be logged or displayed again.",
      ].join("\n"),
      homeKeyboard
    );
  }
);

bot.action(
  "WALLET_IMPORT_SEED",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);
    if (!uid) return;

    setPendingInput(uid, {
      kind: "IMPORT_SEED_PHRASE",
    });

    await ctx.reply(
      [
        "🌱 IMPORT RECOVERY PHRASE",
        "",
        "Send the recovery phrase.",
        "",
        "It will not be logged or displayed again.",
      ].join("\n"),
      homeKeyboard
    );
  }
);

bot.action(
  "WALLET_LIST",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);
    if (!uid) return;

    await sendWalletList(ctx, uid);
  }
);

bot.action(
  "WALLET_BALANCE",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);
    if (!uid) return;

    await sendBalance(ctx, uid);
  }
);

bot.action(
  /^WALLET_SWITCH_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);
    if (!uid) return;

    const walletId =
      ctx.match[1];

    const ok =
      setActiveWallet(
        uid,
        walletId
      );

    await ctx.reply(
      ok
        ? "✅ Active wallet switched."
        : "❌ Wallet not found.",
      homeKeyboard
    );

    if (ok) {
      await sendWalletList(
        ctx,
        uid
      );
    }
  }
);

bot.action(
  /^WALLET_DELETE_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);
    if (!uid) return;

    const walletId =
      ctx.match[1];

    const ok =
      deleteWallet(
        uid,
        walletId
      );

    await ctx.reply(
      ok
        ? "🗑 Wallet deleted."
        : "❌ Wallet not found.",
      homeKeyboard
    );

    if (ok) {
      await sendWalletList(
        ctx,
        uid
      );
    }
  }
);

/* =========================================================
   TRADING
========================================================= */

bot.action(
  /^TRADE_BUY_(.+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const tokenAddress =
      ctx.match[1];

    await ctx.reply(
      "⚡ BUY",
      buyAmountKeyboard(
        tokenAddress
      )
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
      sellPercentKeyboard(
        tokenAddress
      )
    );
  }
);

/* =========================================================
   BUY AMOUNTS
========================================================= */

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
      [
        "💰 CUSTOM BUY",
        "",
        "Send the ETH amount.",
        "",
        "Example:",
        "0.15",
      ].join("\n"),
      homeKeyboard
    );
  }
);

bot.action(
  /^BUYAMT_(0x[a-fA-F0-9]{40})_([\d.]+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);
    if (!uid) return;

    const [, tokenAddress, amountStr] =
      ctx.match;

    const amount =
      Number(amountStr);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      await ctx.reply(
        "❌ Invalid ETH amount.",
        homeKeyboard
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

/* =========================================================
   SELL PERCENTAGES
========================================================= */

bot.action(
  /^SELLPCT_(0x[a-fA-F0-9]{40})_(\d+)$/,
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid = requireUserId(ctx);
    if (!uid) return;

    const [, tokenAddress, pctStr] =
      ctx.match;

    const percentage =
      Number(pctStr);

    if (
      !Number.isFinite(percentage) ||
      percentage <= 0 ||
      percentage > 100
    ) {
      await ctx.reply(
        "❌ Invalid sell percentage.",
        homeKeyboard
      );

      return;
    }

    await startSellFlow(
      ctx,
      uid,
      tokenAddress,
      percentage
    );
  }
);

/* =========================================================
   CONFIRMATION
========================================================= */

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
        [
          "❌ Confirmation expired.",
          "",
          "Please start the trade again.",
        ].join("\n"),
        homeKeyboard
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
      "❌ Trade cancelled.",
      homeKeyboard
    );
  }
);

/* =========================================================
   SNIPER
========================================================= */

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
        "Edit:",
        "/sniperset field value",
        "",
        "Fields:",
        "minscore",
        "maxrisk",
        "minliq",
        "maxmcap",
        "maxbuy",
      ].join("\n"),
      homeKeyboard
    );
  }
);

bot.command(
  "sniperset",
  async (ctx) => {
    const uid =
      requireUserId(ctx);

    if (!uid) return;

    const parts =
      ctx.message.text
        .split(" ")
        .slice(1);

    const [
      field,
      valueStr,
    ] = parts;

    const value =
      Number(valueStr);

    if (
      !field ||
      !Number.isFinite(value)
    ) {
      await ctx.reply(
        "Usage: /sniperset field value",
        homeKeyboard
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
      map[
        field.toLowerCase()
      ];

    if (!key) {
      await ctx.reply(
        "Unknown field. Use: minscore, maxrisk, minliq, maxmcap, maxbuy",
        homeKeyboard
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
      `✅ Updated ${field} to ${value}.`,
      homeKeyboard
    );
  }
);

/* =========================================================
   AUTOPILOT
========================================================= */

bot.action(
  "AUTOPILOT_TOGGLE",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid =
      requireUserId(ctx);

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

    const uid =
      requireUserId(ctx);

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
        "Edit:",
        "/autopilotset field value",
        "",
        "Fields:",
        "capital",
        "maxtrade",
        "maxpos",
        "minscore",
        "maxrisk",
        "stoploss",
        "trailstop",
      ].join("\n"),
      homeKeyboard
    );
  }
);

bot.command(
  "autopilotset",
  async (ctx) => {
    const uid =
      requireUserId(ctx);

    if (!uid) return;

    const parts =
      ctx.message.text
        .split(" ")
        .slice(1);

    const [
      field,
      valueStr,
    ] = parts;

    const value =
      Number(valueStr);

    if (
      !field ||
      !Number.isFinite(value)
    ) {
      await ctx.reply(
        "Usage: /autopilotset field value",
        homeKeyboard
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
      map[
        field.toLowerCase()
      ];

    if (!key) {
      await ctx.reply(
        "Unknown field. Use: capital, maxtrade, maxpos, minscore, maxrisk, stoploss, trailstop",
        homeKeyboard
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
      `✅ Updated ${field} to ${value}.`,
      homeKeyboard
    );
  }
);

/* =========================================================
   SMART MONEY
========================================================= */

bot.action(
  "SMARTMONEY_TRACK",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid =
      requireUserId(ctx);

    if (!uid) return;

    setPendingInput(uid, {
      kind: "TRACK_WALLET_ADDRESS",
    });

    await ctx.reply(
      [
        "🐋 TRACK WALLET",
        "",
        "Send the wallet address to track.",
      ].join("\n"),
      homeKeyboard
    );
  }
);

bot.action(
  "SMARTMONEY_LIST",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid =
      requireUserId(ctx);

    if (!uid) return;

    const wallets =
      listTrackedWallets(uid);

    if (wallets.length === 0) {
      await ctx.reply(
        [
          "🐋 TRACKED WALLETS",
          "",
          "No tracked wallets yet.",
        ].join("\n"),
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
                `${w.label}`,
                formatAddress(
                  w.address
                ),
                `Balance: ${Number(
                  activity.balanceEth
                ).toFixed(4)} ETH`,
                `Transactions: ${activity.txCount}`,
              ].join("\n");
            } catch {
              return [
                `${w.label}`,
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

/* =========================================================
   ALERTS
========================================================= */

bot.action(
  "ALERTS_ENABLE",
  async (ctx) => {
    await ctx.answerCbQuery();

    const uid =
      requireUserId(ctx);

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

    const uid =
      requireUserId(ctx);

    if (!uid) return;

    disableAlerts(uid);

    await ctx.reply(
      "🔕 Alerts disabled.",
      alertsMenuKeyboard(false)
    );
  }
);

/* =========================================================
   FREE TEXT / SCANNER
========================================================= */

bot.on("text", async (ctx) => {
  const uid =
    requireUserId(ctx);

  if (!uid) return;

  const text =
    ctx.message.text.trim();

  /*
   * Ignore commands.
   */
  if (text.startsWith("/")) {
    return;
  }

  const pending =
    getPendingInput(uid);

  /* -------------------------------------------------------
     PRIVATE KEY IMPORT
  ------------------------------------------------------- */

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
          "✅ WALLET IMPORTED",
          "",
          "📍 Address",
          wallet.address,
          "",
          "⛓️ Robinhood Chain",
          "💰 ETH",
        ].join("\n"),
        walletMenuKeyboard
      );
    } catch {
      await ctx.reply(
        "❌ Invalid private key.",
        homeKeyboard
      );
    }

    return;
  }

  /* -------------------------------------------------------
     SEED PHRASE IMPORT
  ------------------------------------------------------- */

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
          "✅ WALLET IMPORTED",
          "",
          "📍 Address",
          wallet.address,
          "",
          "⛓️ Robinhood Chain",
          "💰 ETH",
        ].join("\n"),
        walletMenuKeyboard
      );
    } catch {
      await ctx.reply(
        "❌ Invalid recovery phrase.",
        homeKeyboard
      );
    }

    return;
  }

  /* -------------------------------------------------------
     CUSTOM BUY
  ------------------------------------------------------- */

  if (
    pending?.kind ===
    "CUSTOM_BUY_AMOUNT"
  ) {
    setPendingInput(
      uid,
      null
    );

    const tokenAddress =
      pending.context
        ?.tokenAddress;

    const amount =
      validatePositiveNumber(
        text
      );

    if (
      !tokenAddress ||
      amount === null
    ) {
      await ctx.reply(
        "❌ Invalid ETH amount.",
        homeKeyboard
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

  /* -------------------------------------------------------
     SMART MONEY WALLET
  ------------------------------------------------------- */

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
        "❌ Invalid wallet address.",
        homeKeyboard
      );

      return;
    }

    await ctx.reply(
      [
        "✅ WALLET TRACKED",
        "",
        `📍 ${formatAddress(
          result.address
        )}`,
      ].join("\n"),
      smartMoneyMenuKeyboard
    );

    return;
  }

  /* -------------------------------------------------------
     TOKEN SCANNER
  ------------------------------------------------------- */

  if (
    validateAddress(text)
  ) {
    await analyzeAndReply(
      ctx,
      uid,
      text
    );

    return;
  }

  /*
   * Anything else is not treated as a token.
   */
  await ctx.reply(
    [
      "❌ Invalid input.",
      "",
      "Paste a valid Robinhood Chain token contract address.",
    ].join("\n"),
    homeKeyboard
  );
});

/* =========================================================
   WALLET LIST
========================================================= */

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
      [
        "📋 LIST WALLETS",
        "",
        "No wallets yet.",
        "",
        "Create or import a wallet first.",
      ].join("\n"),
      walletMenuKeyboard
    );

    return;
  }

  await ctx.reply(
    "📋 LIST WALLETS",
    walletListKeyboard(
      wallets.map((w) => ({
        id: w.id,
        label:
          `${w.label} (${formatAddress(w.address)})`,
      })),
      active?.id ?? null
    )
  );
}

/* =========================================================
   BALANCE
========================================================= */

async function sendBalance(
  ctx: import("telegraf").Context,
  uid: number
) {
  const wallet =
    getActiveWallet(uid);

  if (!wallet) {
    await ctx.reply(
      [
        "💰 BALANCE",
        "",
        "No active wallet.",
        "",
        "Create or import a wallet first.",
      ].join("\n"),
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
        "⛓️ Robinhood Chain",
        "💰 ETH",
        "",
        wallet.label,
        formatAddress(
          wallet.address
        ),
        "",
        `${Number(balance).toFixed(4)} ETH`,
      ].join("\n"),
      homeKeyboard
    );
  } catch (err) {
    logger.error(
      "Balance fetch failed",
      {
        error: String(err),
      }
    );

    await ctx.reply(
      "❌ Failed to fetch balance from the chain.",
      homeKeyboard
    );
  }
}

/* =========================================================
   POSITIONS
========================================================= */

async function sendPositions(
  ctx: import("telegraf").Context,
  uid: number
) {
  const positions =
    listPositions(uid);

  if (positions.length === 0) {
    await ctx.reply(
      [
        "📊 POSITIONS",
        "",
        "No open positions.",
      ].join("\n"),
      homeKeyboard
    );

    return;
  }

  for (
    const p of positions
  ) {
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
          "📊 POSITION",
          "",
          `$${p.tokenSymbol}`,
          "",
          "Amount",
          p.amountTokens.toFixed(4),
          "",
          "Entry",
          money(
            p.entryPriceUsd
          ),
          "",
          "Current",
          money(
            token.priceUsd
          ),
          "",
          "PnL",
          `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`,
        ].join("\n"),
        positionRowKeyboard(
          p.tokenAddress
        )
      );
    } catch {
      await ctx.reply(
        [
          "📊 POSITION",
          "",
          `$${p.tokenSymbol}`,
          `Amount: ${p.amountTokens.toFixed(4)}`,
          "",
          "Market data unavailable.",
        ].join("\n"),
        homeKeyboard
      );
    }
  }
}

/* =========================================================
   ORDERS
========================================================= */

async function sendOrders(
  ctx: import("telegraf").Context,
  uid: number
) {
  const orders =
    listOrders(uid);

  if (orders.length === 0) {
    await ctx.reply(
      [
        "📋 ORDERS",
        "",
        "No orders yet.",
      ].join("\n"),
      homeKeyboard
    );

    return;
  }

  const lines =
    orders
      .slice(0, 20)
      .map(
        (o) =>
          [
            `${o.side} $${o.tokenSymbol}`,
            o.amountEth !== null
              ? formatEth(
                  o.amountEth
                )
              : `${o.amountPercent}%`,
            o.status,
          ].join("\n")
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

/* =========================================================
   SNIPER MENU
========================================================= */

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
      "Status",
      s.active
        ? "🟢 ON"
        : "🔴 OFF",
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

/* =========================================================
   AUTOPILOT MENU
========================================================= */

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
      "Status",
      s.active
        ? "🟢 ON"
        : "🔴 OFF",
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

/* =========================================================
   BACKGROUND
========================================================= */

cron.schedule(
  "*/30 * * * * *",
  () => {
    logger.debug(
      "Heartbeat tick"
    );
  }
);

/* =========================================================
   BOOT
========================================================= */

async function main(): Promise<void> {
  await verifyChainConnection();

  await bot.launch();

  logger.info(
    "ERROR404 Telegram bot is running."
  );
}

main().catch((err) => {
  logger.error(
    "Fatal startup error",
    {
      error: String(err),
    }
  );

  process.exit(1);
});

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
