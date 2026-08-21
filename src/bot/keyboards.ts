import { Markup } from "telegraf";
/* =========================================================
   MAIN MENU
========================================================= */
export const mainMenuKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("💼 WALLET", "MENU_WALLET"),
    Markup.button.callback("🔎 SCAN", "MENU_SCAN"),
  ],
  [
    Markup.button.callback("⚡ TRADE", "MENU_TRADE"),
  ],
  [
    Markup.button.callback("📊 POSITIONS", "MENU_POSITIONS"),
    Markup.button.callback("📋 ORDERS", "MENU_ORDERS"),
  ],
  [
    Markup.button.callback("🎯 SNIPER", "MENU_SNIPER"),
    Markup.button.callback("🤖 AUTOPILOT", "MENU_AUTOPILOT"),
  ],
  [
    Markup.button.callback("🐋 SMART MONEY", "MENU_SMARTMONEY"),
    Markup.button.callback("🔔 ALERTS", "MENU_ALERTS"),
  ],
]);
/* =========================================================
   HOME
========================================================= */
export const homeKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("🏠 HOME", "MENU_HOME"),
  ],
]);
/* =========================================================
   WALLET MENU
========================================================= */
export const walletMenuKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback(
      "➕ CREATE WALLET",
      "WALLET_CREATE"
    ),
    Markup.button.callback(
      "🔑 IMPORT PRIVATE KEY",
      "WALLET_IMPORT_PK"
    ),
  ],
  [
    Markup.button.callback(
      "🌱 IMPORT SEED PHRASE",
      "WALLET_IMPORT_SEED"
    ),
    Markup.button.callback(
      "📋 LIST WALLETS",
      "WALLET_LIST"
    ),
  ],
  [
    Markup.button.callback(
      "📤 EXPORT WALLET",
      "WALLET_EXPORT"
    ),
    Markup.button.callback(
      "💰 BALANCE",
      "WALLET_BALANCE"
    ),
  ],
  [
    Markup.button.callback(
      "↩️ RETURN",
      "MENU_HOME"
    ),
  ],
]);
/* =========================================================
   WALLET LIST
========================================================= */
export function walletListKeyboard(
  wallets: {
    id: string;
    label: string;
  }[],
  activeId: string | null
) {
  const rows = wallets.map((wallet) => [
    Markup.button.callback(
      `${wallet.id === activeId ? "✅ " : ""}${wallet.label}`,
      `WALLET_SWITCH_${wallet.id}`
    ),
    Markup.button.callback(
      "🗑",
      `WALLET_DELETE_${wallet.id}`
    ),
  ]);
  rows.push([
    Markup.button.callback(
      "↩️ RETURN",
      "MENU_WALLET"
    ),
  ]);
  return Markup.inlineKeyboard(rows);
}
/* =========================================================
   TOKEN ANALYSIS
========================================================= */
export function tokenAnalysisKeyboard(
  tokenAddress: string
) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "⚡ BUY",
        `TRADE_BUY_${tokenAddress}`
      ),
      Markup.button.callback(
        "📉 SELL",
        `TRADE_SELL_${tokenAddress}`
      ),
    ],
    [
      Markup.button.callback(
        "🎯 SNIPER",
        "MENU_SNIPER"
      ),
      Markup.button.callback(
        "🤖 AUTOPILOT",
        "MENU_AUTOPILOT"
      ),
    ],
    [
      Markup.button.callback(
        "🏠 HOME",
        "MENU_HOME"
      ),
    ],
  ]);
}
/* =========================================================
   BUY AMOUNT
========================================================= */
export function buyAmountKeyboard(
  tokenAddress: string
) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "0.01 ETH",
        `BUYAMT_${tokenAddress}_0.01`
      ),
      Markup.button.callback(
        "0.05 ETH",
        `BUYAMT_${tokenAddress}_0.05`
      ),
    ],
    [
      Markup.button.callback(
        "0.10 ETH",
        `BUYAMT_${tokenAddress}_0.1`
      ),
      Markup.button.callback(
        "0.25 ETH",
        `BUYAMT_${tokenAddress}_0.25`
      ),
    ],
    [
      Markup.button.callback(
        "CUSTOM",
        `BUYAMT_CUSTOM_${tokenAddress}`
      ),
    ],
    [
      Markup.button.callback(
        "🏠 HOME",
        "MENU_HOME"
      ),
    ],
  ]);
}
/* =========================================================
   SELL PERCENTAGE
========================================================= */
export function sellPercentKeyboard(
  tokenAddress: string
) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "25%",
        `SELLPCT_${tokenAddress}_25`
      ),
      Markup.button.callback(
        "50%",
        `SELLPCT_${tokenAddress}_50`
      ),
    ],
    [
      Markup.button.callback(
        "75%",
        `SELLPCT_${tokenAddress}_75`
      ),
      Markup.button.callback(
        "100%",
        `SELLPCT_${tokenAddress}_100`
      ),
    ],
    [
      Markup.button.callback(
        "🏠 HOME",
        "MENU_HOME"
      ),
    ],
  ]);
}
/* =========================================================
   CONFIRMATION
========================================================= */
export function confirmationKeyboard(
  confirmationId: string
) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "⚡ EXECUTE",
        `CONFIRM_EXEC_${confirmationId}`
      ),
      Markup.button.callback(
        "❌ CANCEL",
        `CONFIRM_CANCEL_${confirmationId}`
      ),
    ],
  ]);
}
/* =========================================================
   SNIPER
========================================================= */
export const sniperMenuKeyboard = (
  active: boolean
) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        active ? "🔴 STOP" : "🟢 START",
        "SNIPER_TOGGLE"
      ),
    ],
    [
      Markup.button.callback(
        "⚙️ SETTINGS",
        "SNIPER_SETTINGS"
      ),
    ],
    [
      Markup.button.callback(
        "🏠 HOME",
        "MENU_HOME"
      ),
    ],
  ]);
/* =========================================================
   AUTOPILOT
========================================================= */
export const autopilotMenuKeyboard = (
  active: boolean
) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        active ? "🔴 STOP" : "🟢 START",
        "AUTOPILOT_TOGGLE"
      ),
    ],
    [
      Markup.button.callback(
        "⚙️ SETTINGS",
        "AUTOPILOT_SETTINGS"
      ),
    ],
    [
      Markup.button.callback(
        "🏠 HOME",
        "MENU_HOME"
      ),
    ],
  ]);
/* =========================================================
   SMART MONEY
========================================================= */
export const smartMoneyMenuKeyboard =
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "➕ TRACK WALLET",
        "SMARTMONEY_TRACK"
      ),
    ],
    [
      Markup.button.callback(
        "📋 TRACKED WALLETS",
        "SMARTMONEY_LIST"
      ),
    ],
    [
      Markup.button.callback(
        "🏠 HOME",
        "MENU_HOME"
      ),
    ],
  ]);
/* =========================================================
   ALERTS
========================================================= */
export const alertsMenuKeyboard = (
  enabled: boolean
) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "🔔 ENABLE",
        "ALERTS_ENABLE"
      ),
      Markup.button.callback(
        "🔕 DISABLE",
        "ALERTS_DISABLE"
      ),
    ],
    [
      Markup.button.callback(
        `Status: ${enabled ? "ON" : "OFF"}`,
        "MENU_ALERTS"
      ),
    ],
    [
      Markup.button.callback(
        "🏠 HOME",
        "MENU_HOME"
      ),
    ],
  ]);
/* =========================================================
   POSITION
========================================================= */
export function positionRowKeyboard(
  tokenAddress: string
) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "📉 SELL",
        `TRADE_SELL_${tokenAddress}`
      ),
    ],
    [
      Markup.button.callback(
        "🏠 HOME",
        "MENU_HOME"
      ),
    ],
  ]);
}
