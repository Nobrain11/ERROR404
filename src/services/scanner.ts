import { ScanResult, Token } from "../types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * All scores are deterministic functions of real market data returned by
 * market.ts. Nothing here uses Math.random() or placeholder values — if an
 * input is missing, the affected score falls back to a neutral 0 and a
 * reason is recorded rather than a fabricated number.
 */
export function scanToken(token: Token): ScanResult {
  const reasons: string[] = [];

  // Momentum: 24h price change, scaled. +50% change -> ~100 score.
  let momentumScore = 0;
  if (token.priceChange24h !== null) {
    momentumScore = clamp(50 + token.priceChange24h);
    reasons.push(`24h price change ${token.priceChange24h.toFixed(2)}%`);
  } else {
    reasons.push("No 24h price change data");
  }

  // Liquidity: liquidity in USD scaled logarithmically against a $100K reference.
  let liquidityScore = 0;
  if (token.liquidityUsd !== null && token.liquidityUsd > 0) {
    liquidityScore = clamp((Math.log10(token.liquidityUsd + 1) / Math.log10(100_000)) * 100);
    reasons.push(`Liquidity ${token.liquidityUsd.toLocaleString()} USD`);
  } else {
    reasons.push("No liquidity data");
  }

  // Buy pressure proxy: 24h volume relative to liquidity. High turnover = high pressure.
  let buyPressure = 0;
  if (token.volume24hUsd !== null && token.liquidityUsd && token.liquidityUsd > 0) {
    buyPressure = clamp((token.volume24hUsd / token.liquidityUsd) * 50);
    reasons.push(
      `24h volume/liquidity ratio ${(token.volume24hUsd / token.liquidityUsd).toFixed(2)}`
    );
  } else {
    reasons.push("No volume data");
  }

  // Smart money proxy: derived from buy pressure and momentum together, since
  // real per-wallet flow requires the Smart Money tracking feature. This is a
  // heuristic on real data, never a random number.
  const smartMoneyScore = clamp(buyPressure * 0.6 + momentumScore * 0.4);

  // Risk: higher when market cap dwarfs liquidity (thin liquidity relative to
  // cap = easier to manipulate / harder to exit) and when volume/liquidity is extreme.
  let riskScore = 50;
  if (token.marketCapUsd && token.liquidityUsd && token.liquidityUsd > 0) {
    const capToLiqRatio = token.marketCapUsd / token.liquidityUsd;
    riskScore = clamp(capToLiqRatio * 2);
    reasons.push(`Market cap/liquidity ratio ${capToLiqRatio.toFixed(1)}`);
  } else {
    reasons.push("Insufficient data to assess risk precisely");
  }

  const score = clamp(
    momentumScore * 0.3 +
      smartMoneyScore * 0.25 +
      liquidityScore * 0.25 +
      (100 - riskScore) * 0.2
  );

  return {
    token,
    momentumScore,
    smartMoneyScore,
    liquidityScore,
    riskScore,
    buyPressure,
    score,
    reasons,
  };
}
