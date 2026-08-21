import { config } from "../config";

function timestamp(): string {
  return new Date().toISOString();
}

// NOTE: never pass wallet private keys, seed phrases, or other credentials
// to any of these functions. Callers are responsible for redacting secrets
// before logging.
export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[${timestamp()}] [INFO] ${message}`, meta ?? "");
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[${timestamp()}] [WARN] ${message}`, meta ?? "");
  },
  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[${timestamp()}] [ERROR] ${message}`, meta ?? "");
  },
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!config.debug) return;
    console.debug(`[${timestamp()}] [DEBUG] ${message}`, meta ?? "");
  },
};
