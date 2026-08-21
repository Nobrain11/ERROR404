import { config } from "../config";
import { logger } from "../utils/logger";
import { Token } from "../types";

export class MarketDataUnavailableError extends Error {
  constructor(message = "Market data unavailable.") {
    super(message);
    this.name = "MarketDataUnavailableError";
  }
}

interface DexApiPair {
  baseToken: { address: string; symbol: string; name: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
}

interface DexApiResponse {
  pairs?: DexApiPair[];
}

/**
 * Fetches real token market data for a Robinhood Chain token address from the
 * configured DEX_API_URL. Never fabricates values — if the API is not
 * configured or returns nothing usable, throws MarketDataUnavailableError so
 * callers can surface "Market data unavailable." to the user.
 */
export async function getTokenMarketData(address: string): Promise<Token> {
  if (!config.dexApiUrl) {
    throw new MarketDataUnavailableError();
  }

  const url = `${config.dexApiUrl.replace(/\/$/, "")}/tokens/${address}`;

  let response: Response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch (err) {
    logger.warn("Market data fetch failed", { address, error: String(err) });
    throw new MarketDataUnavailableError();
  }

  if (!response.ok) {
    throw new MarketDataUnavailableError();
  }

  const data = (await response.json()) as DexApiResponse;
  const pair = data.pairs?.[0];

  if (!pair || !pair.priceUsd) {
    throw new MarketDataUnavailableError();
  }

  const priceUsd = Number(pair.priceUsd);
  if (Number.isNaN(priceUsd)) {
    throw new MarketDataUnavailableError();
  }

  return {
    address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    priceUsd,
    marketCapUsd: pair.marketCap ?? pair.fdv ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    volume24hUsd: pair.volume?.h24 ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null,
  };
}
