import { v4 as uuid } from "uuid";
import { PendingConfirmation, OrderSide } from "../types";
import { config } from "../config";

const pending = new Map<string, PendingConfirmation>();

export function createConfirmation(input: {
  telegramId: number;
  side: OrderSide;
  tokenAddress: string;
  tokenSymbol: string;
  amountEth: number | null;
  amountPercent: number | null;
}): PendingConfirmation {
  const now = Date.now();
  const confirmation: PendingConfirmation = {
    id: uuid(),
    telegramId: input.telegramId,
    side: input.side,
    tokenAddress: input.tokenAddress,
    tokenSymbol: input.tokenSymbol,
    amountEth: input.amountEth,
    amountPercent: input.amountPercent,
    createdAt: now,
    expiresAt: now + config.confirmationTtlMs,
  };
  pending.set(confirmation.id, confirmation);
  return confirmation;
}

export function getConfirmation(id: string): PendingConfirmation | null {
  const confirmation = pending.get(id);
  if (!confirmation) return null;
  if (Date.now() > confirmation.expiresAt) {
    pending.delete(id);
    return null;
  }
  return confirmation;
}

export function consumeConfirmation(id: string): PendingConfirmation | null {
  const confirmation = getConfirmation(id);
  if (confirmation) pending.delete(id);
  return confirmation;
}

export function cancelConfirmation(id: string): boolean {
  return pending.delete(id);
}

export function secondsRemaining(confirmation: PendingConfirmation): number {
  return Math.max(0, Math.ceil((confirmation.expiresAt - Date.now()) / 1000));
}
