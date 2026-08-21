import { PendingInput, ScanResult } from "../types";

interface Session {
  pendingInput: PendingInput | null;
  lastScan: ScanResult | null;
}

const sessions = new Map<number, Session>();

function getOrCreate(telegramId: number): Session {
  let s = sessions.get(telegramId);
  if (!s) {
    s = { pendingInput: null, lastScan: null };
    sessions.set(telegramId, s);
  }
  return s;
}

export function setPendingInput(telegramId: number, input: PendingInput | null): void {
  getOrCreate(telegramId).pendingInput = input;
}

export function getPendingInput(telegramId: number): PendingInput | null {
  return getOrCreate(telegramId).pendingInput;
}

export function setLastScan(telegramId: number, scan: ScanResult): void {
  getOrCreate(telegramId).lastScan = scan;
}

export function getLastScan(telegramId: number): ScanResult | null {
  return getOrCreate(telegramId).lastScan;
}
