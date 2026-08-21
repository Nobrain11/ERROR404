# ERROR404 — Robinhood Chain Telegram Trading Bot

Telegram-only trading bot. No website, no dashboard, no Mini App, no REST API —
the entire experience lives inside Telegram.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `TELEGRAM_BOT_TOKEN` — from @BotFather
   - `RPC_URL`, `CHAIN_ID` — Robinhood Chain RPC endpoint and chain ID
   - `DEX_API_URL` — a DexScreener-compatible API base URL for Robinhood Chain
     token data (`GET {DEX_API_URL}/tokens/{address}`). Without this, the bot
     will correctly report "Market data unavailable." instead of faking prices.
   - `ROUTER_ADDRESS`, `WETH_ADDRESS` — a Uniswap V2-style router and wrapped
     native token on Robinhood Chain. Without these, buy/sell confirmations
     still work but execution fails cleanly with a clear error instead of a
     fake fill.

2. Install and run:
   ```
   pnpm install
   pnpm build
   pnpm start
   ```
   Or for local development: `pnpm dev`

## Deploying to Railway

Push this repo to GitHub and connect it to a new Railway service. `railway.json`
already points Railway at `pnpm install && pnpm build` for the build step and
`pnpm start` for the start command. Set the same environment variables as
`.env` in Railway's Variables tab.

## Notes on this dev build

- **No wallet encryption.** Private keys and seed phrases are held in-memory
  only, never written to disk or logged. This is intentional for this
  development version — see `src/services/walletStore.ts`.
- **In-memory stores everywhere** (wallets, orders, positions, sniper/autopilot
  settings, tracked wallets, alert preferences). Nothing persists across a
  restart. The module boundaries were kept narrow specifically so each store
  can be swapped for PostgreSQL later without touching the bot logic.
- **Real market data only.** `src/services/market.ts` never fabricates a
  price, liquidity, or volume figure — if `DEX_API_URL` isn't set or the API
  has no data for a token, users see "Market data unavailable."
- **Trade Guard is the single gate** for every trade — manual, sniper, and
  autopilot all route through `src/services/risk.ts::runTradeGuard()` before
  a confirmation is ever issued.
- **Sniper/autopilot discovery.** This build wires the settings, Trade Guard
  evaluation, and stop-loss/take-profit math for both features
  (`src/services/sniper.ts`, `src/services/autopilot.ts`), but doesn't include
  an automatic "new token" discovery feed — Robinhood Chain doesn't have a
  documented one yet. Once you have a new-pairs endpoint, poll it from the
  `node-cron` job in `src/index.ts` and pass each candidate through
  `evaluateSniperCandidate` / `evaluateAutopilotCandidate`.
