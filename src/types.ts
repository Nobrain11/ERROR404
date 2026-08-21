export interface WalletRecord {
  id: string;
  label: string;
  address: string;
  privateKey: string; // NEVER log or display this. Stored in-memory only (no encryption, dev version).
}

export interface UserWalletState {
  telegramId: number;
  wallets: WalletRecord[];
  activeWalletId: string | null;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  priceChange24h: number | null;
}

export interface ScanResult {
  token: Token;
  momentumScore: number;
  smartMoneyScore: number;
  liquidityScore: number;
  riskScore: number;
  buyPressure: number;
  score: number;
  reasons: string[];
}

export type OrderSide = "BUY" | "SELL";

export type OrderStatus =
  | "OPEN"
  | "PENDING"
  | "CONFIRMING"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Order {
  id: string;
  telegramId: number;
  tokenAddress: string;
  tokenSymbol: string;
  side: OrderSide;
  amountEth: number | null; // for BUY: ETH amount in; for SELL: null (percent-based)
  amountPercent: number | null; // for SELL: percent of position
  status: OrderStatus;
  txHash: string | null;
  createdAt: number;
  updatedAt: number;
  error: string | null;
}

export interface Position {
  telegramId: number;
  tokenAddress: string;
  tokenSymbol: string;
  amountTokens: number;
  entryPriceUsd: number;
  openedAt: number;
}

export interface PendingConfirmation {
  id: string;
  telegramId: number;
  side: OrderSide;
  tokenAddress: string;
  tokenSymbol: string;
  amountEth: number | null;
  amountPercent: number | null;
  createdAt: number;
  expiresAt: number;
}

export interface SniperSettings {
  active: boolean;
  minScore: number;
  maxRisk: number;
  minLiquidityUsd: number;
  maxMarketCapUsd: number;
  maxBuyEth: number;
}

export interface AutopilotSettings {
  active: boolean;
  capitalEth: number;
  maxTradeEth: number;
  maxPositions: number;
  minScore: number;
  maxRisk: number;
  stopLossPercent: number;
  trailingStopPercent: number;
  takeProfitLevels: number[]; // e.g. [10, 20, 50]
}

export interface TrackedWallet {
  id: string;
  telegramId: number;
  address: string;
  label: string;
  addedAt: number;
}

export type AlertType =
  | "MOMENTUM"
  | "SMART_MONEY"
  | "LIQUIDITY"
  | "RISK"
  | "OPPORTUNITY";

export interface AlertSettings {
  telegramId: number;
  enabled: boolean;
}

export interface TradeGuardResult {
  passed: boolean;
  reasons: string[];
}

/** Conversation step used to drive multi-message flows (custom amount entry, imports, etc). */
export type PendingInputKind =
  | "IMPORT_PRIVATE_KEY"
  | "IMPORT_SEED_PHRASE"
  | "CUSTOM_BUY_AMOUNT"
  | "TRACK_WALLET_ADDRESS"
  | "RENAME_WALLET";

export interface PendingInput {
  kind: PendingInputKind;
  context?: Record<string, string>;
}
