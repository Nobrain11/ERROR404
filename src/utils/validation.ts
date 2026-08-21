import { isAddress } from "ethers";

export function validateAddress(address: string): boolean {
  return isAddress(address.trim());
}

export function validatePositiveNumber(value: string): number | null {
  const n = Number(value.trim());
  if (Number.isNaN(n) || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function validatePercentage(value: string): number | null {
  const n = Number(value.trim());
  if (Number.isNaN(n) || !Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}
