import { ScanResult, TradeGuardResult } from "../types";

export interface TradeGuardInput {
  scan: ScanResult;
  amountEth: number;
  balanceEth: number;
  minScore: number;
  maxRisk: number;
  minLiquidityUsd?: number;
  maxMarketCapUsd?: number;
  maxTradeEth?: number;
  slippageBps?: number; // basis points, e.g. 100 = 1%
}

/**
 * Every trade — manual, sniper, or autopilot — must pass through here before
 * a confirmation is issued or an order is executed.
 */
export function runTradeGuard(input: TradeGuardInput): TradeGuardResult {
  const reasons: string[] = [];
  let passed = true;

  if (input.scan.score < input.minScore) {
    passed = false;
    reasons.push(`Score ${input.scan.score.toFixed(0)} below minimum ${input.minScore}`);
  }

  if (input.scan.riskScore > input.maxRisk) {
    passed = false;
    reasons.push(`Risk ${input.scan.riskScore.toFixed(0)} above maximum ${input.maxRisk}`);
  }

  if (
    input.minLiquidityUsd !== undefined &&
    (input.scan.token.liquidityUsd === null || input.scan.token.liquidityUsd < input.minLiquidityUsd)
  ) {
    passed = false;
    reasons.push(`Liquidity below minimum $${input.minLiquidityUsd.toLocaleString()}`);
  }

  if (
    input.maxMarketCapUsd !== undefined &&
    input.scan.token.marketCapUsd !== null &&
    input.scan.token.marketCapUsd > input.maxMarketCapUsd
  ) {
    passed = false;
    reasons.push(`Market cap above maximum $${input.maxMarketCapUsd.toLocaleString()}`);
  }

  if (input.maxTradeEth !== undefined && input.amountEth > input.maxTradeEth) {
    passed = false;
    reasons.push(`Trade amount exceeds maximum ${input.maxTradeEth} ETH`);
  }

  if (input.amountEth > input.balanceEth) {
    passed = false;
    reasons.push("Insufficient wallet balance");
  }

  if (input.amountEth <= 0) {
    passed = false;
    reasons.push("Trade amount must be greater than zero");
  }

  return { passed, reasons };
}
