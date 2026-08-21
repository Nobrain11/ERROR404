import { AlertSettings, AlertType } from "../types";

const settings = new Map<number, AlertSettings>();

function getOrCreate(telegramId: number): AlertSettings {
  let s = settings.get(telegramId);
  if (!s) {
    s = { telegramId, enabled: false };
    settings.set(telegramId, s);
  }
  return s;
}

export function enableAlerts(telegramId: number): void {
  getOrCreate(telegramId).enabled = true;
}

export function disableAlerts(telegramId: number): void {
  getOrCreate(telegramId).enabled = false;
}

export function alertsEnabled(telegramId: number): boolean {
  return getOrCreate(telegramId).enabled;
}

const ALERT_LABELS: Record<AlertType, string> = {
  MOMENTUM: "🔥 Momentum Alert",
  SMART_MONEY: "🐋 Smart Money Alert",
  LIQUIDITY: "💧 Liquidity Alert",
  RISK: "🚨 Risk Alert",
  OPPORTUNITY: "⚡ Trading Opportunity",
};

export function formatAlert(type: AlertType, body: string): string {
  return `${ALERT_LABELS[type]}\n\n${body}`;
}

export function listSubscribedUsers(): number[] {
  return Array.from(settings.values())
    .filter((s) => s.enabled)
    .map((s) => s.telegramId);
}
