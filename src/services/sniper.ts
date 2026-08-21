import { SniperSettings, ScanResult } from "../types";
import { runTradeGuard } from "./risk";

const DEFAULTS: SniperSettings = {
  active: false,
  minScore: 75,
  maxRisk: 25,
  minLiquidityUsd: 10_000,
  maxMarketCapUsd: 1_000_000,
  maxBuyEth: 0.2,
};

const settings = new Map<number, SniperSettings>();

export function getSniperSettings(telegramId: number): SniperSettings {
  let s = settings.get(telegramId);
  if (!s) {
    s = { ...DEFAULTS };
    settings.set(telegramId, s);
  }
  return s;
}

export function updateSniperSettings(telegramId: number, patch: Partial<SniperSettings>): SniperSettings {
  const current = getSniperSettings(telegramId);
  const updated = { ...current, ...patch };
  settings.set(telegramId, updated);
  return updated;
}

export function startSniper(telegramId: number): SniperSettings {
  return updateSniperSettings(telegramId, { active: true });
}

export function stopSniper(telegramId: number): SniperSettings {
  return updateSniperSettings(telegramId, { active: false });
}

/**
 * Evaluates a scanned candidate token against a user's sniper settings and
 * the shared Trade Guard. A sniper trade is only eligible when both this AND
 * runTradeGuard() pass — the sniper never bypasses Trade Guard.
 */
export function evaluateSniperCandidate(
  s: SniperSettings,
  scan: ScanResult,
  balanceEth: number
): { eligible: boolean; reasons: string[] } {
  if (!s.active) return { eligible: false, reasons: ["Sniper is OFF"] };

  const guard = runTradeGuard({
    scan,
    amountEth: s.maxBuyEth,
    balanceEth,
    minScore: s.minScore,
    maxRisk: s.maxRisk,
    minLiquidityUsd: s.minLiquidityUsd,
    maxMarketCapUsd: s.maxMarketCapUsd,
    maxTradeEth: s.maxBuyEth,
  });

  return { eligible: guard.passed, reasons: guard.reasons };
}
