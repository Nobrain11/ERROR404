import { JsonRpcProvider, Network, TransactionResponse, TransactionReceipt } from "ethers";
import { config } from "../config";
import { logger } from "../utils/logger";

// Single provider instance for Robinhood Chain. Do not switch chains here.
const provider = new JsonRpcProvider(config.rpcUrl, Number(config.chainId));

export async function getBlockNumber(): Promise<number> {
  return provider.getBlockNumber();
}

export async function getNetwork(): Promise<Network> {
  return provider.getNetwork();
}

export async function getNativeBalance(address: string): Promise<bigint> {
  return provider.getBalance(address);
}

export async function getTransaction(hash: string): Promise<TransactionResponse | null> {
  return provider.getTransaction(hash);
}

export async function getReceipt(hash: string): Promise<TransactionReceipt | null> {
  return provider.getTransactionReceipt(hash);
}

export async function waitForTransaction(
  hash: string,
  confirmations = 1
): Promise<TransactionReceipt | null> {
  return provider.waitForTransaction(hash, confirmations);
}

export async function verifyChainConnection(): Promise<void> {
  try {
    const network = await getNetwork();
    logger.info("Connected to Robinhood Chain", {
      chainId: network.chainId.toString(),
    });
  } catch (err) {
    logger.error("Failed to connect to RPC_URL", { error: String(err) });
    throw err;
  }
}

export { provider };
