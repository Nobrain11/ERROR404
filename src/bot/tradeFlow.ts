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
  scoreBar,
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

export function renderTokenAnalysis(
  scan: ScanResult
): string {
  const t = scan.token;

  return [
    "🔎 ERROR404 ANALYSIS",
    "",
    `$${t.symbol}`,
    "",
    "Price",
    money(t.priceUsd),
    "",
    "Market Cap",
    money(t.marketCapUsd),
    "",
    "Liquidity",
    money(t.liquidityUsd),
    "",
    "24H Volume",
    money(t.volume24hUsd),
    "",
    "━━━━━━━━━━━━━━",
    "",
    "🔥 Momentum",
    scoreBar(scan.momentumScore),
    "",
    "🐋 Smart Money",
    scoreBar(scan.smartMoneyScore),
    "",
    "💧 Liquidity",
    scoreBar(scan.liquidityScore),
    "",
    "🛡 Risk",
    scoreBar(scan.riskScore),
    "",
    "━━━━━━━━━━━━━━",
    "",
    "ERROR404 SCORE",
    `${Math.round(scan.score)}/100`,
  ].join("\n");
}

export async function analyzeAndReply(
  ctx: Context,
  telegramId: number,
  tokenAddress: string
): Promise<void> {
  try {
    const token =
      await getTokenMarketData(tokenAddress);

    const scan =
      scanToken(token);

    setLastScan(
      telegramId,
      scan
    );

    await ctx.reply(
      renderTokenAnalysis(scan),
      tokenAnalysisKeyboard(tokenAddress)
    );
  } catch (err) {
    if (
      err instanceof MarketDataUnavailableError
    ) {
      await ctx.reply(
        "Market data unavailable."
      );
    } else {
      logger.error(
        "Analysis failed",
        { error: String(err) }
      );

      await ctx.reply(
        "Failed to analyze token. Please check the address and try again."
      );
    }
  }
}

export async function startBuyFlow(
  ctx: Context,
  telegramId: number,
  tokenAddress: string,
  amountEth: number
): Promise<void> {
  const wallet =
    getActiveWallet(telegramId);

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
      "Market data unavailable."
    );
    return;
  }

  const scan =
    scanToken(token);

  setLastScan(
    telegramId,
    scan
  );

  const balanceEthStr =
    await getBalanceEth(
      wallet.address
    );

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
        "Trade Guard blocked this trade:",
        ...guard.reasons.map(
          (r) => `• ${r}`
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
      `$${token.symbol}`,
      `Amount: ${formatEth(amountEth)}`,
      `Price: ${money(token.priceUsd)}`,
      `Score: ${Math.round(scan.score)}/100`,
      "",
      "Expires in 30s.",
    ].join("\n"),
    confirmationKeyboard(
      confirmation.id
    )
  );
}

export async function startSellFlow(
  ctx: Context,
  telegramId: number,
  tokenAddress: string,
  amountPercent: number
): Promise<void> {
  const wallet =
    getActiveWallet(telegramId);

  if (!wallet) {
    await ctx.reply(
      "No active wallet. Open 💼 WALLET to create or import one first."
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
      "Market data unavailable."
    );
    return;
  }

  const scan =
    scanToken(token);

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
      `$${token.symbol}`,
      `Amount: ${amountPercent}% of position`,
      `Price: ${money(token.priceUsd)}`,
      `Risk: ${Math.round(scan.riskScore)}/100`,
      "",
      "Expires in 30s.",
    ].join("\n"),
    confirmationKeyboard(
      confirmation.id
    )
  );
}

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
    getActiveWallet(telegramId);

  if (!wallet) {
    await ctx.reply(
      "No active wallet."
    );
    return;
  }

  const signer =
    getSigner(wallet);

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

    markConfirming(order.id);

    await ctx.reply(
      "⚡ Executing..."
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

      const approxTokens =
        confirmation.amountEth *
          token.priceUsd >
        0
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
        `✅ Buy complete for $${confirmation.tokenSymbol}.`
      );
    } catch (err) {
      await ctx.reply(
        `❌ Buy failed: ${String(
          (err as Error).message ?? err
        )}`
      );
    }

    return;
  }

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
      (confirmation.amountPercent / 100);

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

    markConfirming(order.id);

    await ctx.reply(
      "📉 Executing..."
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
        `✅ Sell complete for $${confirmation.tokenSymbol}.`
      );
    } catch (err) {
      await ctx.reply(
        `❌ Sell failed: ${String(
          (err as Error).message ?? err
        )}`
      );
    }

    return;
  }

  await ctx.reply(
    "Invalid confirmation."
  );
}

export function formatBalanceLine(
  balanceWei: bigint
): string {
  return `${Number(
    formatEther(balanceWei)
  ).toFixed(4)} ETH`;
}

export { percent };
