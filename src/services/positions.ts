import { Position } from "../types";

const positions = new Map<number, Position[]>();

function keyFor(telegramId: number): Position[] {
  const list = positions.get(telegramId) ?? [];
  positions.set(telegramId, list);
  return list;
}

export function openOrIncreasePosition(
  telegramId: number,
  tokenAddress: string,
  tokenSymbol: string,
  amountTokens: number,
  entryPriceUsd: number
): void {
  const list = keyFor(telegramId);
  const existing = list.find((p) => p.tokenAddress === tokenAddress);
  if (existing) {
    const totalCost = existing.amountTokens * existing.entryPriceUsd + amountTokens * entryPriceUsd;
    existing.amountTokens += amountTokens;
    existing.entryPriceUsd = totalCost / existing.amountTokens;
  } else {
    list.push({
      telegramId,
      tokenAddress,
      tokenSymbol,
      amountTokens,
      entryPriceUsd,
      openedAt: Date.now(),
    });
  }
}

export function reducePosition(telegramId: number, tokenAddress: string, amountTokens: number): void {
  const list = keyFor(telegramId);
  const existing = list.find((p) => p.tokenAddress === tokenAddress);
  if (!existing) return;
  existing.amountTokens -= amountTokens;
  if (existing.amountTokens <= 0) {
    positions.set(
      telegramId,
      list.filter((p) => p.tokenAddress !== tokenAddress)
    );
  }
}

export function listPositions(telegramId: number): Position[] {
  return keyFor(telegramId);
}

export function getPosition(telegramId: number, tokenAddress: string): Position | null {
  return keyFor(telegramId).find((p) => p.tokenAddress === tokenAddress) ?? null;
}

export function calculatePnlPercent(position: Position, currentPriceUsd: number): number {
  if (position.entryPriceUsd === 0) return 0;
  return ((currentPriceUsd - position.entryPriceUsd) / position.entryPriceUsd) * 100;
}
