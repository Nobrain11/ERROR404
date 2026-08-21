import {
  HDNodeWallet,
  Wallet,
  isAddress,
  formatEther,
} from "ethers";
import { v4 as uuid } from "uuid";
import { WalletRecord } from "../types";
import { provider } from "./provider";

/**
 * Credentials returned ONLY when a new wallet is generated.
 *
 * The mnemonic is intentionally not part of WalletRecord,
 * so imported/stored wallets do not accidentally retain it.
 */
export interface CreatedWallet extends WalletRecord {
  mnemonic: string;
}

/**
 * Generate a brand-new ETH wallet on Robinhood Chain.
 *
 * IMPORTANT:
 * The mnemonic and private key are returned so the Telegram
 * layer can display them ONCE to the user.
 *
 * Do not log this object.
 * Do not persist the mnemonic.
 */
export function createWallet(
  label: string
): CreatedWallet {
  const wallet =
    HDNodeWallet.createRandom();

  const mnemonic =
    wallet.mnemonic?.phrase;

  if (!mnemonic) {
    throw new Error(
      "Failed to generate wallet recovery phrase."
    );
  }

  return {
    id: uuid(),
    label,
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic,
  };
}

/**
 * Import an existing wallet from a private key.
 *
 * Imported wallets do not expose a mnemonic because a
 * private key import does not necessarily have a recoverable
 * original seed phrase.
 */
export function importFromPrivateKey(
  privateKey: string,
  label: string
): WalletRecord {
  const trimmed =
    privateKey.trim();

  const wallet =
    new Wallet(trimmed);

  return {
    id: uuid(),
    label,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Import an existing wallet from a recovery phrase.
 *
 * We deliberately do not return/store the phrase.
 */
export function importFromSeedPhrase(
  seedPhrase: string,
  label: string
): WalletRecord {
  const trimmed =
    seedPhrase.trim();

  const wallet =
    HDNodeWallet.fromPhrase(trimmed);

  return {
    id: uuid(),
    label,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Get the native ETH balance on Robinhood Chain.
 */
export async function getBalanceEth(
  address: string
): Promise<string> {
  if (!isAddress(address)) {
    throw new Error(
      "Invalid address"
    );
  }

  const balance =
    await provider.getBalance(address);

  return formatEther(balance);
}

/**
 * Create a signer connected to the Robinhood Chain RPC.
 */
export function getSigner(
  record: WalletRecord
): Wallet {
  return new Wallet(
    record.privateKey,
    provider
  );
}
