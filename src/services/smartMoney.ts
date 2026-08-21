import { v4 as uuid } from "uuid";
import { isAddress } from "ethers";
import { TrackedWallet } from "../types";
import { provider } from "./provider";
import { formatEther } from "ethers";

const tracked = new Map<number, TrackedWallet[]>();

function keyFor(telegramId: number): TrackedWallet[] {
  const list = tracked.get(telegramId) ?? [];
  tracked.set(telegramId, list);
  return list;
}

export function trackWallet(telegramId: number, address: string, label?: string): TrackedWallet | null {
  const trimmed = address.trim();
  if (!isAddress(trimmed)) return null;

  const list = keyFor(telegramId);
  if (list.some((w) => w.address.toLowerCase() === trimmed.toLowerCase())) {
    return list.find((w) => w.address.toLowerCase() === trimmed.toLowerCase()) ?? null;
  }

  const entry: TrackedWallet = {
    id: uuid(),
    telegramId,
    address: trimmed,
    label: label ?? `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`,
    addedAt: Date.now(),
  };
  list.push(entry);
  return entry;
}

export function listTrackedWallets(telegramId: number): TrackedWallet[] {
  return keyFor(telegramId);
}

export function untrackWallet(telegramId: number, id: string): boolean {
  const list = keyFor(telegramId);
  const index = list.findIndex((w) => w.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  return true;
}

/**
 * Real, on-chain activity for a tracked wallet: current native balance and
 * latest transaction count. Never fabricated. Deeper token-transfer history
 * requires an indexer (not available on a raw JSON-RPC provider) — wire one
 * in here later if needed.
 */
export async function getWalletActivity(address: string): Promise<{
  address: string;
  balanceEth: string;
  txCount: number;
}> {
  const [balance, txCount] = await Promise.all([
    provider.getBalance(address),
    provider.getTransactionCount(address),
  ]);

  return {
    address,
    balanceEth: formatEther(balance),
    txCount,
  };
}
