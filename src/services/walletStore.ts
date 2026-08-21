import { UserWalletState, WalletRecord } from "../types";

// In-memory only. Never persisted, never logged. Architected so this module
// can be swapped for a PostgreSQL-backed store later without touching callers.
const store = new Map<number, UserWalletState>();

function getOrCreateState(telegramId: number): UserWalletState {
  let state = store.get(telegramId);
  if (!state) {
    state = { telegramId, wallets: [], activeWalletId: null };
    store.set(telegramId, state);
  }
  return state;
}

export function addWallet(telegramId: number, wallet: WalletRecord): void {
  const state = getOrCreateState(telegramId);
  state.wallets.push(wallet);
  if (!state.activeWalletId) {
    state.activeWalletId = wallet.id;
  }
}

export function listWallets(telegramId: number): WalletRecord[] {
  return getOrCreateState(telegramId).wallets;
}

export function getActiveWallet(telegramId: number): WalletRecord | null {
  const state = getOrCreateState(telegramId);
  if (!state.activeWalletId) return null;
  return state.wallets.find((w) => w.id === state.activeWalletId) ?? null;
}

export function setActiveWallet(telegramId: number, walletId: string): boolean {
  const state = getOrCreateState(telegramId);
  const exists = state.wallets.some((w) => w.id === walletId);
  if (!exists) return false;
  state.activeWalletId = walletId;
  return true;
}

export function deleteWallet(telegramId: number, walletId: string): boolean {
  const state = getOrCreateState(telegramId);
  const index = state.wallets.findIndex((w) => w.id === walletId);
  if (index === -1) return false;
  state.wallets.splice(index, 1);
  if (state.activeWalletId === walletId) {
    state.activeWalletId = state.wallets[0]?.id ?? null;
  }
  return true;
}

export function renameWallet(telegramId: number, walletId: string, label: string): boolean {
  const state = getOrCreateState(telegramId);
  const wallet = state.wallets.find((w) => w.id === walletId);
  if (!wallet) return false;
  wallet.label = label;
  return true;
}
