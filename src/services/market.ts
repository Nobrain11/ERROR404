import { config } from "../config";
import { logger } from "../utils/logger";
import { Token } from "../types";

export class MarketDataUnavailableError extends Error {
  constructor(message = "Market data unavailable.") {
    super(message);
    this.name = "MarketDataUnavailableError";
  }
}

interface DexApiToken {
  address?: string;
  symbol?: string;
  name?: string;
}

interface DexApiPair {
  chainId?: string;
  dexId?: string;
  url?: string;

  baseToken?: DexApiToken;
  quoteToken?: DexApiToken;

  priceUsd?: string;

  marketCap?: number;
  fdv?: number;

  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };

  volume?: {
    h24?: number;
  };

  priceChange?: {
    h24?: number;
  };
}

interface DexApiResponse {
  schemaVersion?: string;
  pairs?: DexApiPair[] | null;
}

/**
 * Normalize the configured DEX API URL.
 *
 * Expected:
 *
 * https://api.dexscreener.com/latest/dex
 *
 * Result:
 *
 * https://api.dexscreener.com/latest/dex/tokens/{address}
 */
function getDexApiBaseUrl(): string {
  const value = config.dexApiUrl?.trim();

  if (!value) {
    throw new MarketDataUnavailableError(
      "DEX_API_URL is not configured."
    );
  }

  return value.replace(/\/+$/, "");
}

/**
 * Validate an Ethereum-style address before sending it to the API.
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

/**
 * Safely convert a number into a finite number.
 */
function finiteNumber(
  value: unknown
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (typeof value === "string") {
    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : null;
  }

  return null;
}

/**
 * Select the best Robinhood Chain pair.
 *
 * IMPORTANT:
 * Never simply use pairs[0].
 *
 * DexScreener can return multiple markets/chains for a token.
 * ERROR404 must only use the Robinhood Chain market.
 */
function selectRobinhoodPair(
  pairs: DexApiPair[],
  tokenAddress: string
): DexApiPair | null {
  const normalizedAddress =
    tokenAddress.toLowerCase();

  const robinhoodPairs = pairs.filter(
    (pair) => {
      const chainId =
        pair.chainId?.toLowerCase();

      const baseAddress =
        pair.baseToken?.address?.toLowerCase();

      return (
        chainId === "robinhood" &&
        baseAddress === normalizedAddress
      );
    }
  );

  if (robinhoodPairs.length === 0) {
    return null;
  }

  /**
   * Prefer the pair with the highest liquidity.
   *
   * This prevents the scanner from choosing an
   * obscure low-liquidity pair when multiple
   * Robinhood Chain pairs exist.
   */
  robinhoodPairs.sort(
    (a, b) => {
      const liquidityA =
        finiteNumber(a.liquidity?.usd) ?? 0;

      const liquidityB =
        finiteNumber(b.liquidity?.usd) ?? 0;

      return liquidityB - liquidityA;
    }
  );

  return robinhoodPairs[0];
}

/**
 * Fetch real market data for a Robinhood Chain token.
 *
 * Flow:
 *
 * Telegram
 *   ↓
 * token address
 *   ↓
 * DexScreener token API
 *   ↓
 * filter chainId === "robinhood"
 *   ↓
 * verify base token address
 *   ↓
 * select highest-liquidity pair
 *   ↓
 * return real market data
 *
 * No mock values are generated.
 */
export async function getTokenMarketData(
  address: string
): Promise<Token> {
  const tokenAddress =
    address.trim();

  if (!isValidAddress(tokenAddress)) {
    throw new MarketDataUnavailableError(
      "Invalid token address."
    );
  }

  let baseUrl: string;

  try {
    baseUrl = getDexApiBaseUrl();
  } catch (err) {
    logger.error(
      "DEX API configuration error",
      {
        error: String(err),
      }
    );

    throw err;
  }

  const url =
    `${baseUrl}/tokens/${tokenAddress}`;

  logger.info(
    "Fetching token market data",
    {
      address: tokenAddress,
      url,
    }
  );

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (err) {
    logger.error(
      "DEX API request failed",
      {
        address: tokenAddress,
        error:
          err instanceof Error
            ? err.message
            : String(err),
      }
    );

    throw new MarketDataUnavailableError(
      "Unable to connect to DEX market data."
    );
  }

  if (!response.ok) {
    logger.warn(
      "DEX API returned non-200 response",
      {
        address: tokenAddress,
        status: response.status,
        statusText: response.statusText,
      }
    );

    throw new MarketDataUnavailableError(
      `DEX API returned HTTP ${response.status}.`
    );
  }

  let data: DexApiResponse;

  try {
    data =
      (await response.json()) as DexApiResponse;
  } catch (err) {
    logger.error(
      "Failed to parse DEX API response",
      {
        address: tokenAddress,
        error: String(err),
      }
    );

    throw new MarketDataUnavailableError(
      "Invalid market data response."
    );
  }

  const pairs = Array.isArray(data.pairs)
    ? data.pairs
    : [];

  if (pairs.length === 0) {
    logger.info(
      "No DEX pairs found",
      {
        address: tokenAddress,
      }
    );

    throw new MarketDataUnavailableError(
      "No market pairs found for this token."
    );
  }

  logger.info(
    "DEX pairs received",
    {
      address: tokenAddress,
      pairCount: pairs.length,
      chains: [
        ...new Set(
          pairs
            .map((pair) => pair.chainId)
            .filter(Boolean)
        ),
      ],
    }
  );

  const pair =
    selectRobinhoodPair(
      pairs,
      tokenAddress
    );

  if (!pair) {
    logger.info(
      "No Robinhood Chain pair found",
      {
        address: tokenAddress,
        availableChains: [
          ...new Set(
            pairs
              .map(
                (p) => p.chainId
              )
              .filter(Boolean)
          ),
        ],
      }
    );

    throw new MarketDataUnavailableError(
      "No Robinhood Chain market found for this token."
    );
  }

  const symbol =
    pair.baseToken?.symbol?.trim();

  const name =
    pair.baseToken?.name?.trim();

  const priceUsd =
    finiteNumber(pair.priceUsd);

  if (
    !symbol ||
    !name ||
    priceUsd === null ||
    priceUsd < 0
  ) {
    logger.warn(
      "Robinhood pair contains unusable market data",
      {
        address: tokenAddress,
        symbol,
        name,
        priceUsd,
      }
    );

    throw new MarketDataUnavailableError(
      "Robinhood market data is incomplete."
    );
  }

  const marketCapUsd =
    finiteNumber(pair.marketCap) ??
    finiteNumber(pair.fdv);

  const liquidityUsd =
    finiteNumber(pair.liquidity?.usd);

  const volume24hUsd =
    finiteNumber(pair.volume?.h24);

  const priceChange24h =
    finiteNumber(pair.priceChange?.h24);

  const result: Token = {
    address: tokenAddress,
    symbol,
    name,
    priceUsd,
    marketCapUsd,
    liquidityUsd,
    volume24hUsd,
    priceChange24h,
  };

  logger.info(
    "Robinhood Chain market data found",
    {
      address: result.address,
      symbol: result.symbol,
      priceUsd: result.priceUsd,
      marketCapUsd: result.marketCapUsd,
      liquidityUsd: result.liquidityUsd,
      volume24hUsd: result.volume24hUsd,
      priceChange24h: result.priceChange24h,
      dexId: pair.dexId,
    }
  );

  return result;
}
