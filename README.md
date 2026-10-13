# Stockroom

A responsive, wallet-connected interface for the supplied IMD Stock DEX on Ethereum. Includes all 50 supplied stock tokens, reference prices, search, sector filters, sorting, pagination, a local watchlist, token contract details, and a guarded purchase flow.

**The finished static site is in `dist/`.** Source, package manifest, lockfile, local font, favicon and share image are included. No backend, API key, private key, hosted wallet relay or build step is needed to serve the export.

## Run locally

Use Node.js 24+ and npm.

```sh
npm ci
npm run dev
```

Build and preview the production export:

```sh
npm run typecheck
npm run build
npm run preview
```

Open the URL printed by Vite. You can also serve `dist/` with any static HTTP server. Opening `index.html` with `file://` is not supported by browser module loading. Vite uses `base: './'`; asset links are relative, navigation is in-page, and no server rewrite rules are needed. The submitted export was also tested beneath `/preview/`.

## Wallet and buying

- Ethereum mainnet, chain ID **1**.
- Supplied DEX: [`0xf66c6c7a09e741843d4ede8795ac4267e3823037`](https://etherscan.io/address/0xf66c6c7a09e741843d4ede8795ac4267e3823037#code).
- Verified contract ABI: `src/lib/dex-abi.ts`. Read-only Ethereum RPC: `https://ethereum-rpc.publicnode.com`.
- EIP-6963 wallet discovery, with an EIP-1193 browser-wallet fallback. On a phone, use a compatible wallet's in-app browser. There is no WalletConnect QR relay or project ID.
- The payment-token address, decimals, pause flag, configuration version, fee and market availability are read from the contract. There is no invented payment-token configuration.
- The purchase flow simulates `quoteBuy`, reviews exact amounts, approves only the required IMD amount when necessary, obtains a fresh quote after approval, and simulates `buyStock` before asking the wallet to submit it.
- Slippage choices are 0.1%, 0.5% and 1%. Minimum output uses integer arithmetic. Quotes expire in 60 seconds; transactions carry a 120-second deadline and the quoted configuration version. Account or network changes invalidate the review.
- Approval receipts are checked against allowance. Purchase success requires a successful receipt and a matching `StockPurchased` event. Reverted or unrelated replacement transactions are not shown as purchases. An unconfirmed transaction blocks another purchase and offers a confirmation recheck and Etherscan link.

### Observed deployment limitation

At **2026-10-13 07:08 UTC**, block **26181972**, the DEX was paused, its creator was unset and none of the 50 supplied markets was enabled. IMD, router and quoter addresses were configured. Configuration changed during this assignment, so this is a dated observation, not a permanent assumption. The page reads current state and its refresh control updates availability. The owner must finish the contract's configuration, enable markets and unpause before actual purchases are possible.

The frontend contains the real integration, but **no real wallet signature, approval or funded purchase was sent during validation**. Successful/rejected transaction scenarios were exercised with isolated local RPC and wallet fixtures. No test fixture is bundled into `dist/`.

Check current deployment state without writing to the chain:

```sh
node scripts/verify-chain.mjs
```

## Prices and local data

Prices are **stock-token reference prices in USD**, not guaranteed underlying exchange prices and not executable DEX quotes. The page requests DEX Screener data on load and on manual refresh, in two batches, and chooses the highest-liquidity Ethereum pair returned for each exact token address. A price refresh is atomic; partial/error responses do not overwrite the fallback.

`src/lib/price-snapshot.json` contains a real, dated snapshot fetched at **2026-10-13T06:36:43.233767Z**, with prices for **22 of the 50** addresses. It remains usable offline and is labeled “Snapshot.” Unavailable prices and changes are explicitly marked; no prices, charts, balances or returns are fabricated. “Updated” indicates when the browser retrieved the latest response. The data provider may be delayed, incomplete, rate-limited or unreachable.

Refresh the bundled fallback and rebuild when desired:

```sh
npm run refresh:prices
npm run build
```

Watchlists are stored only in this browser under `stockroom-watchlist`. Wallet connections, quotes and pending-transaction tracking are session state; after reloading, check any previously submitted transaction in your wallet or explorer before purchasing again. Stock order follows the requester’s list, not market capitalization.

## Validation

```sh
npx playwright install chromium webkit
# On Linux, install Playwright's required system libraries if needed.
npm run build
npm test
TEST_BROWSER=webkit npm test
```

The integration tests serve the production export under `/preview/`. Wallet and RPC fixtures never send transactions to a public network. Tests cover all 50 assets, filtering/sorting/pagination, persistent watchlists, dialogs, missing wallets, rejected requests, network changes, balance and decimal validation, exact approvals, quote expiry, slippage, confirmed/reverted/replaced purchases, price/RPC failures, mobile reflow and automated accessibility.

Actual worker results:

| Check | Result |
| --- | --- |
| Production build | Passed (`tsc --noEmit && vite build`) |
| Standalone typecheck | Passed (`tsc --noEmit`) |
| Chromium integration suite | 12/12 passed |
| WebKit integration suite | 12/12 passed |
| Axe WCAG A/AA checks | No violations in tested page and wallet-dialog states |
| Pinned taste@1 probe | 16/16 passed; 320, 390 and 1440 widths |
| First screen at 390×844 | Product, purchase form and connect action visible |
| Reflow | Checked at 320, 390, 590, 760, 900, 1100, 1280 and 1440; 200% text enlargement checked |

The worker installed dependencies and browser support libraries outside the repository, copied the same source and lockfile to `/tmp/stockroom-build`, ran these checks there, and copied back the clean production export. WebKit needed libraries extracted under `/tmp`, a software EGL configuration, and compositing disabled; it was not a physical iPhone test. See [the full validation record](artifacts/validation.md), [design system](DESIGN.md), and saved test reports in `artifacts/`.

The pinned probe was run from the repository root with:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/stockroom-browsers \
IMD_PLAYWRIGHT=/tmp/stockroom-tools/node_modules/playwright/index.mjs \
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Its pinned input is removed by the assignment system after submission; the measured report is preserved in `artifacts/taste.json`. The standalone browser tests remain rerunnable.

## Maintain the export

Source changes require `npm run build` and inclusion of the complete, regenerated `dist/`. Font and image assets are local. Edit `src/assets/share.svg`, then run `npm run generate:share` to regenerate `public/share.png` before rebuilding. Never add keys to the static app.

Run `node scripts/check-bundle.mjs` to verify local export assets, source payload size and the absence of dependency/cache directories. The final delivered files total approximately **1.6 MB**, including the **710,419-byte** production export.

The complete submission budget is **8,388,608 bytes**. Explicit path budget for `.gitignore`: **512 bytes maximum** (implemented: 187 bytes). It excludes dependency/cache directories at every nesting level and keeps `dist/` included. Dependency directories, npm caches, downloaded browser libraries, temporary explorer HTML and scratch output are not deliverables. No submodule or vendored registry is used.

Design guidance was adapted from Jakub Krehel’s [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface) (MIT) and Paul Bakaus’s [Impeccable documentation method](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md) (Apache-2.0). Their license notices, the DM Sans OFL license, and runtime dependency notices are in `artifacts/`.
