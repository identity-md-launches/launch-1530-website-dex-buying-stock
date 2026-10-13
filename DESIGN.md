# Stockroom design system

## Overview

Stockroom is a compact stock-token browsing and purchase tool. The implemented visual direction uses quiet white surfaces, warm green actions, generous alignment and a familiar financial table. A left navigation rail provides desktop orientation; the buy form becomes the first working surface on a phone. Prices and transaction state take priority over decorative content.

The source of truth is `src/styles.css`, with reusable behavior in `src/components/` and page composition in `src/App.tsx`. Light mode and English are the implemented variants. No dark theme is implied.

## Colors

Semantic tokens in `src/styles.css:8`:

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#f7f8fa` | Page background |
| `--color-surface` | `#ffffff` | Panels and dialogs |
| `--color-text` | `#222b2a` | Main text |
| `--color-muted` | `#69716f` | Labels and supporting copy |
| `--color-border` | `#e5e9e7` | Structural separators |
| `--color-accent` | `#234d3f` | Primary action and selected navigation |
| `--color-accent-hover` | `#173b2e` | Primary hover |
| `--color-accent-soft` | `#edf4e9` | Selection surface |
| `--color-positive` | `#257452` | Positive price changes, with a plus sign |
| `--color-negative` | `#b84244` | Negative changes, with a minus sign |
| `--color-warning` | `#886122` | Paused-state indicator |
| `--color-focus` | `#286249` | Keyboard focus perimeter |

Form controls use `#f5f7f4` with a `#e5eae1` border. Field groups themselves are flat and transparent; the final rules at the end of `styles.css` override the original grouping styles. Footer text is `#657069`. Sector icons use muted sage, sand, blue, violet and slate backgrounds, plus distinctive Apple/NVIDIA/Tesla/Microsoft marks. These colors identify assets; no status relies on color alone.

Rendered text contrast was measured by taste@1 and axe. Both passed for their tested states. Detailed measurements and coverage limits are in `artifacts/validation.md`.

## Typography

Local variable **DM Sans** (`src/assets/dm-sans-latin.woff2`) with Arial/sans-serif fallbacks. The loaded font supports weights 100–1000; the interface uses only **400, 500 and 600**. `font-display: swap`, root smoothing and `font-synthesis: none` are applied. The browser confirmed the local face loaded.

| Token | Size at default root | Use |
| --- | --- | --- |
| `--text-xs` | 12px | Metadata, status, table headings |
| `--text-sm` | 14px | Desktop controls and table content |
| `--text-base` | 16px | Body headings and mobile search input |
| `--text-lg` | 20px | Panel headings and brand |
| `--text-xl` | 28px | Stock prices, compact amount and mobile h1 |
| `--text-display` | 36px | Desktop h1 and expanded amount |

Body line height is 1.5; headings are 1.25. Small explanatory copy uses 1.6–1.7. Display headings use up to −0.04em tracking, panel headings −0.025em. Numbers use tabular figures. Full addresses use the system monospace stack, wrap anywhere and stay selectable. Long stock names wrap, never ellipsize. Inputs on mobile are at least 16px; the amount is 28px.

## Layout

The spacing vocabulary is 4, 8, 12, 16, 24 and 32px (`--space-*`), with content-specific 18/20/28/36px insets. Current components use both token declarations and explicit values; editing a spacing token alone does not retheme all component spacing.

- Desktop: 216px fixed rail, 80px header, centered main region capped at 1536px, 36px inline padding. Three spotlight buttons precede the market table and 324px trade column. At 1600px the trade column is 354px.
- At 1390px: rail is 196px; main insets 28px; volume and rank density reduce.
- Between 1100 and 1150px: the rail and trade column narrow and secondary table columns hide.
- Below 1100px: a single workspace column puts buying before the stock table; the buy panel and explanatory panel share a row when space allows.
- At 760px: the rail becomes a mobile menu, header height becomes 72px, and spotlight cards disappear.
- At 590px: the explanatory panel disappears, controls stack, and the buy panel is followed directly by the table. Table changes move beneath prices. Mobile page insets are 16px.
- Below 360px: 12px page insets, smaller brand, hidden stock icons and page-size selector preserve legible content and working paging.

The purchase action is in normal flow. The mobile first screen contains the product heading, pay input, chosen stock and connection action. No sticky mobile action overlaps content. `min-width: 0`, wrapping and column removal handle small screens. The tested widths and 200% text-resize results are recorded in validation; native browser zoom and translated layouts were not separately tested.

## Elevation & Depth

Main surfaces use borders and no shadows. Tonal controls identify editable/selectable regions without nested content cards. Only the native dialog is elevated: `0 20px 80px #13281e33`, no border, with a dark translucent, blurred backdrop. Navigation is a fixed desktop rail; modal layering is the native top layer.

## Shapes

The declared radius vocabulary is 8px for controls, 12px for panels, and 16px for dialogs. Asset marks use 7–10px radii by density. Dots and the small IMD icon are circles. All important text wraps rather than relying on clipping.

## Components

- **Buttons**: `.button.primary` is the single filled green main action; `.secondary` is bordered; `.quiet-link`, `.text-button` and `.icon-button` support lower-priority actions. Primary actions are 48px high. Disabled states are native and accompanied by an explanation. Dense utility controls satisfy the 24px/spacing baseline; not all are 44px.
- **StockIcon** (`src/components/StockIcon.tsx`): decorative asset identity, with `stock` and optional `small` props. It is hidden from assistive technology; visible names carry identity.
- **Market table** (`src/App.tsx`): semantic table, real sort buttons and `aria-sort`, selectable stock-name buttons, pressed-state watchlist buttons, full-address detail dialogs. Search and sector controls precede results. Counts, no-results recovery and pagination communicate list state.
- **TradePanel** (`src/components/TradePanel.tsx`): labeled decimal input, native stock-picker trigger, pressed-state slippage choices, fee, action and adjacent status. States include disconnected, wrong network, unavailable RPC/market, paused, quote loading, review, approval, pending receipt, success, rejection, revert and retry. USD reference data never fills the executable output.
- **Modal** (`src/components/Modal.tsx`): native `dialog.showModal()` makes the background inert. Tab/Shift+Tab wrap within visible controls; Escape and the close button dismiss idle dialogs; focus returns to the trigger. Pending wallet operations prevent accidental dismissal. Body scrolling is restored on close.
- **WalletModal** (`src/components/WalletModal.tsx`): discovered browser wallets, no-wallet instructions, connection error/pending states, full connected address, copy, explorer, switch and disconnect actions.
- **Feedback**: `role="status"` for routine results, `role="alert"` for failures, real `disabled`, `aria-pressed`, labels and `aria-describedby`. Focus uses a 2px explicit outline with 4px offset, and system Highlight in forced colors.

Only 150ms named color/background/border transitions are used for routine interaction. Primary press scale is 0.96. Spinners and transitions are enabled only under `prefers-reduced-motion: no-preference`; there is no autoplay content.

## Do’s and Don’ts

Reuse the page/workspace alignment, six type sizes and button variants. Put the control above the data it changes. Keep names and full contract values accessible. State unavailable or dated data plainly, distinguish quotes from reference prices, and require an explicit wallet step before any transaction.

Do not invent price history, balances or successful purchases. Do not add competing filled actions, decorative ticker motion, card-within-card surfaces or truncated addresses. Another page should reuse the shell, heading hierarchy, flat surface treatment and Modal rather than introducing another visual system.

Design review used the assignment's pinned Better Interface guide across accessibility, layout, writing, typography, colors and UI. The documentation method is adapted from Impeccable. Attribution and full license notices are retained in `artifacts/DESIGN-GUIDANCE-LICENSE.txt` and README.
