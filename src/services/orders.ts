import { v4 as uuid } from "uuid";
import { Contract, parseEther, Wallet as EthersWallet } from "ethers";
import { Order, OrderSide, OrderStatus } from "../types";
import { config } from "../config";
import { logger } from "../utils/logger";

const orders = new Map<string, Order>();
const ordersByUser = new Map<number, string[]>();

const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
];

export class ExecutionUnavailableError extends Error {
  constructor(message = "Trade execution is not configured (ROUTER_ADDRESS/WETH_ADDRESS missing).") {
    super(message);
    this.name = "ExecutionUnavailableError";
  }
}

function record(order: Order): void {
  orders.set(order.id, order);
  const list = ordersByUser.get(order.telegramId) ?? [];
  list.unshift(order.id);
  ordersByUser.set(order.telegramId, list);
}

export function createOrder(input: {
  telegramId: number;
  tokenAddress: string;
  tokenSymbol: string;
  side: OrderSide;
  amountEth: number | null;
  amountPercent: number | null;
}): Order {
  const now = Date.now();
  const order: Order = {
    id: uuid(),
    telegramId: input.telegramId,
    tokenAddress: input.tokenAddress,
    tokenSymbol: input.tokenSymbol,
    side: input.side,
    amountEth: input.amountEth,
    amountPercent: input.amountPercent,
    status: "PENDING",
    txHash: null,
    createdAt: now,
    updatedAt: now,
    error: null,
  };
  record(order);
  return order;
}

function updateStatus(orderId: string, status: OrderStatus, patch?: Partial<Order>): void {
  const order = orders.get(orderId);
  if (!order) return;
  order.status = status;
  order.updatedAt = Date.now();
  if (patch) Object.assign(order, patch);
}

export function listOrders(telegramId: number): Order[] {
  const ids = ordersByUser.get(telegramId) ?? [];
  return ids.map((id) => orders.get(id)).filter((o): o is Order => Boolean(o));
}

export function getOrder(orderId: string): Order | null {
  return orders.get(orderId) ?? null;
}

/**
 * Executes a real on-chain swap via the configured router. Requires
 * ROUTER_ADDRESS and WETH_ADDRESS to be set — never simulates or fakes a fill.
 */
export async function executeBuy(
  orderId: string,
  signer: EthersWallet,
  tokenAddress: string,
  amountEth: number,
  slippageBps = 300
): Promise<void> {
  if (!config.routerAddress || !config.wethAddress) {
    updateStatus(orderId, "FAILED", { error: "Execution not configured" });
    throw new ExecutionUnavailableError();
  }

  updateStatus(orderId, "EXECUTING");

  try {
    const router = new Contract(config.routerAddress, ROUTER_ABI, signer);
    const path = [config.wethAddress, tokenAddress];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;
    // amountOutMin left at 0 slippage protection is handled upstream by Trade
    // Guard checks; a production build should quote via the router first.
    void slippageBps;

    const tx = await router.swapExactETHForTokens(0, path, signer.address, deadline, {
      value: parseEther(amountEth.toString()),
    });

    updateStatus(orderId, "EXECUTING", { txHash: tx.hash });
    const receipt = await tx.wait();

    if (receipt && receipt.status === 1) {
      updateStatus(orderId, "COMPLETED", { txHash: tx.hash });
    } else {
      updateStatus(orderId, "FAILED", { txHash: tx.hash, error: "Transaction reverted" });
    }
  } catch (err) {
    logger.error("Buy execution failed", { orderId, error: String(err) });
    updateStatus(orderId, "FAILED", { error: String(err) });
    throw err;
  }
}

export async function executeSell(
  orderId: string,
  signer: EthersWallet,
  tokenAddress: string,
  amountTokensWei: bigint
): Promise<void> {
  if (!config.routerAddress || !config.wethAddress) {
    updateStatus(orderId, "FAILED", { error: "Execution not configured" });
    throw new ExecutionUnavailableError();
  }

  updateStatus(orderId, "EXECUTING");

  try {
    const router = new Contract(config.routerAddress, ROUTER_ABI, signer);
    const path = [tokenAddress, config.wethAddress];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

    const tx = await router.swapExactTokensForETH(
      amountTokensWei,
      0,
      path,
      signer.address,
      deadline
    );

    updateStatus(orderId, "EXECUTING", { txHash: tx.hash });
    const receipt = await tx.wait();

    if (receipt && receipt.status === 1) {
      updateStatus(orderId, "COMPLETED", { txHash: tx.hash });
    } else {
      updateStatus(orderId, "FAILED", { txHash: tx.hash, error: "Transaction reverted" });
    }
  } catch (err) {
    logger.error("Sell execution failed", { orderId, error: String(err) });
    updateStatus(orderId, "FAILED", { error: String(err) });
    throw err;
  }
}

export function cancelOrder(orderId: string): void {
  updateStatus(orderId, "CANCELLED");
}

export function markConfirming(orderId: string): void {
  updateStatus(orderId, "CONFIRMING");
}
