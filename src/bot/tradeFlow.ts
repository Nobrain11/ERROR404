import { Context } from "telegraf";
import {
  parseEther,
  formatEther,
} from "ethers";

import {
  getTokenMarketData,
  MarketDataUnavailableError,
} from "../services/market";

import { scanToken } from "../services/scanner";

import {
  getActiveWallet,
} from "../services/walletStore";

import {
  getBalanceEth,
  getSigner,
} from "../services/wallet";

import {
  runTradeGuard,
} from "../services/risk";

import {
  createConfirmation,
} from "../services/confirmation";

import {
  createOrder,
  executeBuy,
  executeSell,
  markConfirming,
} from "../services/orders";

import {
  openOrIncreasePosition,
  reducePosition,
  getPosition,
} from "../services/positions";

import {
  setLastScan,
} from "../services/session";

import {
  money,
  formatEth,
  percent,
} from "../utils/format";

import {
  confirmationKeyboard,
  tokenAnalysisKeyboard,
} from "./keyboards";

import {
  ScanResult,
} from "../types";

import {
  logger,
} from "../utils/logger";

// ============================================================
// SCANNER FORMATTERS
// ============================================================

function formatNullableMoney(
  value: number | null
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return money(value);
}

function formatPercentValue(
  value: number | null
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function riskLabel(
  risk: number
): string {
  if (risk <= 20) {
    return "🟢 LOW";
  }

  if (risk <= 40) {
    return "🟡 MODERATE";
  }

  if (risk <= 65) {
    return "🟠 HIGH";
  }

  return "🔴 EXTREME";
}

function liquidityLabel(
  score: number
): string {
  if (score >= 75) {
    return "🟢 GOOD";
  }

  if (score >= 50) {
    return "🟡 FAIR";
  }

  if (score >= 25) {
    return "🟠 LOW";
  }

  return "🔴 VERY LOW";
}

function momentumLabel(
  score: number
): string {
  if (score >= 75) {
    return "🟢 STRONG";
  }

  if (score >= 55) {
    return "🟡 POSITIVE";
  }

  if (score >= 40) {
    return "⚪ NEUTRAL";
  }

  return "🔴 WEAK";
}

// ============================================================
// TOKEN SCANNER
// ============================================================

export function renderTokenAnalysis(
  scan: ScanResult
): string {
  const t =
    scan.token;

  const priceChange =
    formatPercentValue(
      t.priceChange24h
    );

  return [
    `🪙 ${t.name} ($${t.symbol})`,
    "",
    t.address,
    "",
    "🟢 ROBINHOOD CHAIN",
    "",
    `💵 Price      ${money(t.priceUsd)}`,
    `💰 Market Cap ${formatNullableMoney(t.marketCapUsd)}`,
    `💧 Liquidity  ${formatNullableMoney(t.liquidityUsd)}`,
    `📊 24H Volume ${formatNullableMoney(t.volume24hUsd)}`,
    `📈 24H Change ${priceChange}`,
    "",
    `⚡ Momentum   ${momentumLabel(scan.momentumScore)}`,
    `💧 Liquidity  ${liquidityLabel(scan.liquidityScore)}`,
    `🛡 Risk       ${riskLabel(scan.riskScore)}`,
    "",
    `⚡ ERROR404 SCORE  ${Math.round(scan.score)}/100`,
  ].join("\n");
}

// ============================================================
// SCAN
// ============================================================

export async function analyzeAndReply(
  ctx: Context,
  telegramId: number,
  tokenAddress: string
): Promise<void> {
  try {
    const token =
      await getTokenMarketData(
        tokenAddress
      );

    const scan =
      scanToken(token);

    setLastScan(
      telegramId,
      scan
    );

    await ctx.reply(
      renderTokenAnalysis(scan),
      tokenAnalysisKeyboard(
        tokenAddress
      )
    );
  } catch (err) {
    if (
      err instanceof MarketDataUnavailableError
    ) {
      await ctx.reply(
        [
          "❌ TOKEN NOT FOUND",
          "",
          "No usable Robinhood Chain market data was found for this address.",
          "",
          "Make sure:",
          "• the contract address is correct",
          "• the token has a live Robinhood Chain pair",
          "• DEX_API_URL is configured",
        ].join("\n")
      );

      return;
    }

    logger.error(
      "Analysis failed",
      {
        error:
          err instanceof Error
            ? err.message
            : String(err),
      }
    );

    await ctx.reply(
      "❌ Failed to analyze token."
    );
  }
}

// ============================================================
// BUY FLOW
// ============================================================

export async function startBuyFlow(
  ctx: Context,
  telegramId: number,
  tokenAddress: string,
  amountEth: number
): Promise<void> {
  if (
    !Number.isFinite(amountEth) ||
    amountEth <= 0
  ) {
    await ctx.reply(
      "❌ Invalid ETH amount."
    );
    return;
  }

  const wallet =
    getActiveWallet(
      telegramId
    );

  if (!wallet) {
    await ctx.reply(
      "No active wallet. Open 💼 WALLET to create or import one first."
    );
    return;
  }

  let token;

  try {
    token =
      await getTokenMarketData(
        tokenAddress
      );
  } catch {
    await ctx.reply(
      "❌ Market data unavailable."
    );
    return;
  }

  const scan =
    scanToken(token);

  setLastScan(
    telegramId,
    scan
  );

  let balanceEthStr: string;

  try {
    balanceEthStr =
      await getBalanceEth(
        wallet.address
      );
  } catch {
    await ctx.reply(
      "❌ Unable to read wallet balance."
    );
    return;
  }

  const balanceEth =
    Number(balanceEthStr);

  const guard =
    runTradeGuard({
      scan,
      amountEth,
      balanceEth,
      minScore: 0,
      maxRisk: 100,
    });

  if (!guard.passed) {
    await ctx.reply(
      [
        "🛡 TRADE GUARD",
        "",
        "Trade blocked.",
        "",
        ...guard.reasons.map(
          (reason) =>
            `• ${reason}`
        ),
      ].join("\n")
    );

    return;
  }

  const confirmation =
    createConfirmation({
      telegramId,
      side: "BUY",
      tokenAddress,
      tokenSymbol: token.symbol,
      amountEth,
      amountPercent: null,
    });

  await ctx.reply(
    [
      "⚡ CONFIRM BUY",
      "",
      `🪙 $${token.symbol}`,
      "",
      `Amount  ${formatEth(amountEth)}`,
      `Price   ${money(token.priceUsd)}`,
      `Score   ${Math.round(scan.score)}/100`,
      "",
      "Confirmation expires in 30 seconds.",
    ].join("\n"),
    confirmationKeyboard(
      confirmation.id
    )
  );
}

// ============================================================
// SELL FLOW
// ============================================================

export async function startSellFlow(
  ctx: Context,
  telegramId: number,
  tokenAddress: string,
  amountPercent: number
): Promise<void> {
  if (
    !Number.isFinite(amountPercent) ||
    amountPercent <= 0 ||
    amountPercent > 100
  ) {
    await ctx.reply(
      "❌ Invalid sell percentage."
    );
    return;
  }

  const wallet =
    getActiveWallet(
      telegramId
    );

  if (!wallet) {
    await ctx.reply(
      "No active wallet."
    );
    return;
  }

  const position =
    getPosition(
      telegramId,
      tokenAddress
    );

  if (!position) {
    await ctx.reply(
      "You have no open position in this token."
    );
    return;
  }

  let token;

  try {
    token =
      await getTokenMarketData(
        tokenAddress
      );
  } catch {
    await ctx.reply(
      "❌ Market data unavailable."
    );
    return;
  }

  const scan =
    scanToken(token);

  setLastScan(
    telegramId,
    scan
  );

  const confirmation =
    createConfirmation({
      telegramId,
      side: "SELL",
      tokenAddress,
      tokenSymbol: token.symbol,
      amountEth: null,
      amountPercent,
    });

  await ctx.reply(
    [
      "📉 CONFIRM SELL",
      "",
      `🪙 $${token.symbol}`,
      "",
      `Amount  ${amountPercent}%`,
      `Price   ${money(token.priceUsd)}`,
      `Risk    ${riskLabel(scan.riskScore)}`,
      "",
      "Confirmation expires in 30 seconds.",
    ].join("\n"),
    confirmationKeyboard(
      confirmation.id
    )
  );
}

// ============================================================
// EXECUTE CONFIRMED TRADE
// ============================================================

export async function executeConfirmedTrade(
  ctx: Context,
  telegramId: number,
  _confirmationId: string,
  confirmation: {
    side: "BUY" | "SELL";
    tokenAddress: string;
    tokenSymbol: string;
    amountEth: number | null;
    amountPercent: number | null;
  }
): Promise<void> {
  const wallet =
    getActiveWallet(
      telegramId
    );

  if (!wallet) {
    await ctx.reply(
      "No active wallet."
    );
    return;
  }

  const signer =
    getSigner(wallet);

  // ----------------------------------------------------------
  // BUY
  // ----------------------------------------------------------

  if (
    confirmation.side === "BUY" &&
    confirmation.amountEth !== null
  ) {
    const order =
      createOrder({
        telegramId,
        tokenAddress:
          confirmation.tokenAddress,
        tokenSymbol:
          confirmation.tokenSymbol,
        side: "BUY",
        amountEth:
          confirmation.amountEth,
        amountPercent: null,
      });

    markConfirming(
      order.id
    );

    await ctx.reply(
      "⚡ Executing buy..."
    );

    try {
      await executeBuy(
        order.id,
        signer,
        confirmation.tokenAddress,
        confirmation.amountEth
      );

      const token =
        await getTokenMarketData(
          confirmation.tokenAddress
        );

      /*
       * NOTE:
       * This is still an approximation because
       * actual received token amount should eventually
       * come from the transaction receipt/logs.
       */
      const approxTokens =
        token.priceUsd > 0
          ? confirmation.amountEth /
            token.priceUsd
          : 0;

      openOrIncreasePosition(
        telegramId,
        confirmation.tokenAddress,
        confirmation.tokenSymbol,
        approxTokens,
        token.priceUsd
      );

      await ctx.reply(
        [
          "✅ BUY COMPLETE",
          "",
          `$${confirmation.tokenSymbol}`,
          `Amount: ${formatEth(confirmation.amountEth)}`,
        ].join("\n")
      );
    } catch (err) {
      await ctx.reply(
        [
          "❌ BUY FAILED",
          "",
          err instanceof Error
            ? err.message
            : String(err),
        ].join("\n")
      );
    }

    return;
  }

  // ----------------------------------------------------------
  // SELL
  // ----------------------------------------------------------

  if (
    confirmation.side === "SELL" &&
    confirmation.amountPercent !== null
  ) {
    const position =
      getPosition(
        telegramId,
        confirmation.tokenAddress
      );

    if (!position) {
      await ctx.reply(
        "No open position to sell."
      );
      return;
    }

    const sellAmountTokens =
      position.amountTokens *
      (
        confirmation.amountPercent /
        100
      );

    if (
      !Number.isFinite(
        sellAmountTokens
      ) ||
      sellAmountTokens <= 0
    ) {
      await ctx.reply(
        "❌ Invalid token amount."
      );
      return;
    }

    const order =
      createOrder({
        telegramId,
        tokenAddress:
          confirmation.tokenAddress,
        tokenSymbol:
          confirmation.tokenSymbol,
        side: "SELL",
        amountEth: null,
        amountPercent:
          confirmation.amountPercent,
      });

    markConfirming(
      order.id
    );

    await ctx.reply(
      "📉 Executing sell..."
    );

    try {
      const amountWei =
        parseEther(
          sellAmountTokens.toFixed(18)
        );

      await executeSell(
        order.id,
        signer,
        confirmation.tokenAddress,
        amountWei
      );

      reducePosition(
        telegramId,
        confirmation.tokenAddress,
        sellAmountTokens
      );

      await ctx.reply(
        [
          "✅ SELL COMPLETE",
          "",
          `$${confirmation.tokenSymbol}`,
          `Sold: ${confirmation.amountPercent}%`,
        ].join("\n")
      );
    } catch (err) {
      await ctx.reply(
        [
          "❌ SELL FAILED",
          "",
          err instanceof Error
            ? err.message
            : String(err),
        ].join("\n")
      );
    }

    return;
  }

  await ctx.reply(
    "❌ Invalid confirmation."
  );
}

// ============================================================
// BALANCE FORMAT
// ============================================================

export function formatBalanceLine(
  balanceWei: bigint
): string {
  return `${Number(
    formatEther(balanceWei)
  ).toFixed(4)} ETH`;
}

export { percent };
