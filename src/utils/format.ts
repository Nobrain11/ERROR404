export function formatEth(amount: number, decimals = 4): string {
  return `${amount.toFixed(decimals)} ETH`;
}

export function formatToken(amount: number, decimals = 4): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenAddress(address: string): string {
  return formatAddress(address);
}

export function formatPercentage(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function percent(value: number, decimals = 2): string {
  return formatPercentage(value, decimals);
}

export function money(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  // sub-cent token prices need more precision
  return `$${value.toPrecision(3)}`;
}

export function scoreBar(score: number, length = 10): string {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)} ${Math.round(clamped)}`;
}
