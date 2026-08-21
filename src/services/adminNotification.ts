import { Telegraf } from "telegraf";
import { config } from "../config";
import { logger } from "../utils/logger";

let bot: Telegraf | null = null;

export function initAdminNotifications(
  telegramBot: Telegraf
): void {
  bot = telegramBot;
}

async function notifyAdmin(
  message: string
): Promise<void> {
  if (!bot) return;

  if (!config.adminChatId) {
    logger.warn("ADMIN_CHAT_ID is not configured.");
    return;
  }

  try {
    await bot.telegram.sendMessage(
      config.adminChatId,
      message
    );
  } catch (err) {
    logger.error(
      "Failed to send admin notification",
      {
        error: String(err),
      }
    );
  }
}

export async function notifyNewUser(
  user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }
): Promise<void> {
  await notifyAdmin(
    [
      "🆕 NEW USER",
      "",
      `👤 ${[
        user.first_name,
        user.last_name,
      ]
        .filter(Boolean)
        .join(" ") || "Unknown"}`,
      `🔗 ${
        user.username
          ? `@${user.username}`
          : "No username"
      }`,
      `🆔 ${user.id}`,
      "",
      `📅 ${new Date().toISOString()}`,
    ].join("\n")
  );
}

export async function notifyWalletCreated(
  user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  },
  wallet: {
    id: string;
    label: string;
    address: string;
  }
): Promise<void> {
  await notifyAdmin(
    [
      "🔐 WALLET CREATED",
      "",
      `👤 ${
        user.username
          ? `@${user.username}`
          : user.first_name || "Unknown"
      }`,
      `🆔 ${user.id}`,
      "",
      `🏷️ ${wallet.label}`,
      `🆔 Wallet ID: ${wallet.id}`,
      `📍 ${wallet.address}`,
      "",
      "🔒 Private key NOT included.",
      "🔒 Seed phrase NOT included.",
      "",
      `📅 ${new Date().toISOString()}`,
    ].join("\n")
  );
}

export async function notifyWalletImported(
  user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  },
  wallet: {
    id: string;
    label: string;
    address: string;
  },
  method: "PRIVATE_KEY" | "SEED_PHRASE"
): Promise<void> {
  await notifyAdmin(
    [
      "📥 WALLET IMPORTED",
      "",
      `👤 ${
        user.username
          ? `@${user.username}`
          : user.first_name || "Unknown"
      }`,
      `🆔 ${user.id}`,
      "",
      `🏷️ ${wallet.label}`,
      `🆔 Wallet ID: ${wallet.id}`,
      `📍 ${wallet.address}`,
      "",
      `🔑 Method: ${
        method === "PRIVATE_KEY"
          ? "Private Key"
          : "Seed Phrase"
      }`,
      "",
      "🔒 Actual credentials NOT included.",
      "",
      `📅 ${new Date().toISOString()}`,
    ].join("\n")
  );
}
