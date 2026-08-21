import { HDNodeWallet, Wallet, isAddress } from "ethers";
import { v4 as uuid } from "uuid";
import { WalletRecord } from "../types";
import { provider } from "./provider";

export function createWallet(label: string): WalletRecord {
  const wallet = HDNodeWallet.createRandom();
  return {
    id: uuid(),
    label,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

export function importFromPrivateKey(privateKey: string, label: string): WalletRecord {
  const trimmed = privateKey.trim();
  const wallet = new Wallet(trimmed);
  return {
    id: uuid(),
    label,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

export function importFromSeedPhrase(seedPhrase: string, label: string): WalletRecord {
  const trimmed = seedPhrase.trim();
  const wallet = HDNodeWallet.fromPhrase(trimmed);
  return {
    id: uuid(),
    label,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

export async function getBalanceEth(address: string): Promise<string> {
  if (!isAddress(address)) throw new Error("Invalid address");
  const balance = await provider.getBalance(address);
  const { formatEther } = await import("ethers");
  return formatEther(balance);
}

/** Returns a signer connected to the shared provider for the given wallet record. */
export function getSigner(record: WalletRecord): Wallet {
  return new Wallet(record.privateKey, provider);
}
