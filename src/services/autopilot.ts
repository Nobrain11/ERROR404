import { AutopilotSettings, ScanResult } from "../types";
import { runTradeGuard } from "./risk";
import { listPositions } from "./positions";

const DEFAULTS: AutopilotSettings = {
  active: false,
  capitalEth: 1,
  maxTradeEth: 0.2,
  maxPositions: 5,
  minScore: 75,
  maxRisk: 25,
  stopLossPercent: 10,
  trailingStopPercent: 5,
  takeProfitLevels: [10, 20, 50],
};

const settings = new Map<number, AutopilotSettings>();

export function getAutopilotSettings(telegramId: number): AutopilotSettings {
  let s = settings.get(telegramId);
  if (!s) {
    s = { ...DEFAULTS, takeProfitLevels: [...DEFAULTS.takeProfitLevels] };
    settings.set(telegramId, s);
  }
  return s;
}

export function updateAutopilotSettings(
  telegramId: number,
  patch: Partial<AutopilotSettings>
): AutopilotSettings {
  const current = getAutopilotSettings(telegramId);
  const updated = { ...current, ...patch };
  settings.set(telegramId, updated);
  return updated;
}

export function startAutopilot(telegramId: number): AutopilotSettings {
  return updateAutopilotSettings(telegramId, { active: true });
}

export function stopAutopilot(telegramId: number): AutopilotSettings {
  return updateAutopilotSettings(telegramId, { active: false });
}

/**
 * Every automated trade must pass the same Trade Guard as a manual trade —
 * this function is the sole entry point autopilot uses to decide eligibility.
 */
export function evaluateAutopilotCandidate(
  telegramId: number,
  s: AutopilotSettings,
  scan: ScanResult,
  balanceEth: number
): { eligible: boolean; reasons: string[] } {
  if (!s.active) return { eligible: false, reasons: ["Autopilot is OFF"] };

  const openPositions = listPositions(telegramId).length;
  if (openPositions >= s.maxPositions) {
    return { eligible: false, reasons: [`Max positions reached (${s.maxPositions})`] };
  }

  const guard = runTradeGuard({
    scan,
    amountEth: s.maxTradeEth,
    balanceEth,
    minScore: s.minScore,
    maxRisk: s.maxRisk,
    maxTradeEth: s.maxTradeEth,
  });

  return { eligible: guard.passed, reasons: guard.reasons };
}

export function shouldStopLoss(pnlPercent: number, settings_: AutopilotSettings): boolean {
  return pnlPercent <= -Math.abs(settings_.stopLossPercent);
}

export function shouldTakeProfit(pnlPercent: number, settings_: AutopilotSettings): number | null {
  const hit = [...settings_.takeProfitLevels].sort((a, b) => b - a).find((level) => pnlPercent >= level);
  return hit ?? null;
}
