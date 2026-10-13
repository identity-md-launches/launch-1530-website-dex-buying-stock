import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe2,
  LayoutGrid,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { stocks, sectors } from "./lib/stocks";
import type { Stock } from "./lib/stocks";
import {
  currency,
  compactMoney,
  fetchPrices,
  initialPrices,
} from "./lib/prices";
import type { Price } from "./lib/prices";
import { DEX, EXPLORER } from "./lib/chain";
import { useWallet } from "./lib/wallet";
import { useDex } from "./lib/useDex";
import { Modal } from "./components/Modal";
import { WalletModal } from "./components/WalletModal";
import { TradePanel } from "./components/TradePanel";
import { StockIcon } from "./components/StockIcon";

function Logo() {
  return (
    <span className="brand">
      <svg className="brand-mark" viewBox="0 0 36 36" aria-hidden="true">
        <rect width="36" height="36" rx="10" fill="currentColor" />
        <path
          d="M9 22v-7h5v7zm7 0V10h5v12zm7 0V6h5v16zM9 26h19"
          fill="#cbefb5"
          stroke="#cbefb5"
          strokeWidth="1.5"
        />
      </svg>
      <span>
        stockroom<span className="brand-period">.</span>
      </span>
    </span>
  );
}
function Change({ value }: { value?: number | null }) {
  return value == null ? (
    <span className="muted">Unavailable</span>
  ) : (
    <span className={`change ${value >= 0 ? "positive" : "negative"}`}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
function SnapshotLabel({
  fetchedAt,
  live,
}: {
  fetchedAt: string;
  live: boolean;
}) {
  return (
    <span className="price-status">
      <span className={`status-dot ${live ? "" : "neutral"}`} />
      {live ? "Updated" : "Snapshot"}{" "}
      {new Date(fetchedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}
    </span>
  );
}

export default function App() {
  const wallet = useWallet();
  const dexState = useDex();
  const [selected, setSelected] = useState(stocks[0]);
  const [prices, setPrices] = useState(initialPrices);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceLive, setPriceLive] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [tab, setTab] = useState<"all" | "watchlist">("all");
  const [sort, setSort] = useState<"rank" | "name" | "price" | "change">(
    "rank",
  );
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [walletOpen, setWalletOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [detail, setDetail] = useState<Stock>();
  const [copied, setCopied] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState("");
  const priceRequest = useRef<AbortController | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const values: unknown = JSON.parse(
        localStorage.getItem("stockroom-watchlist") || "[]",
      );
      return Array.isArray(values)
        ? values.filter(
            (v) => typeof v === "string" && stocks.some((s) => s.symbol === v),
          )
        : [];
    } catch {
      return [];
    }
  });
  const refreshPrices = useCallback(async () => {
    priceRequest.current?.abort();
    const controller = new AbortController();
    priceRequest.current = controller;
    const timer = setTimeout(() => controller.abort("timeout"), 15_000);
    setPriceLoading(true);
    setPriceError("");
    try {
      const result = await fetchPrices(controller.signal);
      if (priceRequest.current === controller) {
        setPrices(result);
        setPriceLive(true);
      }
    } catch {
      if (priceRequest.current === controller) {
        setPriceLive(false);
        setPriceError("Price refresh unavailable. Showing the dated snapshot.");
      }
    } finally {
      clearTimeout(timer);
      if (priceRequest.current === controller) setPriceLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshPrices();
    return () => {
      priceRequest.current?.abort();
      priceRequest.current = null;
    };
  }, [refreshPrices]);
  const toggleFavorite = (stock: Stock) => {
    const next = favorites.includes(stock.symbol)
      ? favorites.filter((s) => s !== stock.symbol)
      : [...favorites, stock.symbol];
    setFavorites(next);
    try {
      localStorage.setItem("stockroom-watchlist", JSON.stringify(next));
      setStatus(
        `${stock.name} ${next.includes(stock.symbol) ? "added to" : "removed from"} your watchlist.`,
      );
    } catch {
      setStatus(
        "Watchlist updated for this session. Browser storage is unavailable.",
      );
    }
  };
  const filtered = useMemo(
    () =>
      stocks
        .filter((s) => {
          const matches = `${s.symbol} ${s.name} ${s.address}`
            .toLowerCase()
            .includes(query.toLowerCase().trim());
          return (
            matches &&
            (sector === "All sectors" || s.sector === sector) &&
            (tab === "all" || favorites.includes(s.symbol))
          );
        })
        .sort((a, b) => {
          if (sort === "name")
            return a.name.localeCompare(b.name) * (ascending ? 1 : -1);
          if (sort === "rank") return (a.rank - b.rank) * (ascending ? 1 : -1);
          const av = prices.quotes[a.address.toLowerCase()]?.[sort];
          const bv = prices.quotes[b.address.toLowerCase()]?.[sort];
          if (av == null) return bv == null ? a.rank - b.rank : 1;
          if (bv == null) return -1;
          return (av - bv) * (ascending ? 1 : -1);
        }),
    [query, sector, tab, favorites, sort, ascending, prices],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleStocks = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const sortBy = (column: typeof sort) => {
    setAscending(
      sort === column ? !ascending : column === "name" || column === "rank",
    );
    setSort(column);
    setPage(1);
  };
  const setView = (view: typeof tab) => {
    setTab(view);
    setPage(1);
    setMenuOpen(false);
    if (view === "watchlist")
      document.getElementById("markets")?.scrollIntoView({ block: "start" });
  };
  const chooseStock = (stock: Stock) => {
    setSelected(stock);
    setPickerOpen(false);
    setDetail(undefined);
    setStatus(`${stock.name} selected for purchase.`);
    if (window.innerWidth < 1100)
      document.getElementById("trade")?.scrollIntoView({ block: "start" });
  };
  const reset = () => {
    setQuery("");
    setSector("All sectors");
    setTab("all");
    setPage(1);
  };
  const price = (stock: Stock): Price | undefined =>
    prices.quotes[stock.address.toLowerCase()];
  const nav = (
    <>
      <button
        className={`nav-item ${tab === "all" ? "active" : ""}`}
        onClick={() => setView("all")}
      >
        <LayoutGrid size={19} />
        <span>Markets</span>
        <span className="nav-count">50</span>
      </button>
      <button
        className={`nav-item ${tab === "watchlist" ? "active" : ""}`}
        onClick={() => setView("watchlist")}
      >
        <Star size={19} />
        <span>Watchlist</span>
        {favorites.length > 0 && (
          <span className="nav-count">{favorites.length}</span>
        )}
      </button>
      <button
        className="nav-item"
        onClick={() => {
          setAboutOpen(true);
          setMenuOpen(false);
        }}
      >
        <BookOpen size={19} />
        <span>How it works</span>
      </button>
    </>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand-link"
          href="#"
          aria-label="Stockroom home"
          onClick={reset}
        >
          <Logo />
        </a>
        <nav aria-label="Main navigation">{nav}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-message">
            <span className="orbit-icon" aria-hidden="true">
              <Globe2 size={25} />
            </span>
            <h3>
              Stocks meet
              <br />
              your wallet.
            </h3>
            <p>
              Explore familiar companies
              <br />
              on Ethereum.
            </p>
            <button onClick={() => setAboutOpen(true)}>
              Explore the basics <ArrowUpRight size={16} />
            </button>
          </div>
          <a
            className="nav-item contract-nav"
            href={`${EXPLORER}/address/${DEX}#code`}
            target="_blank"
            rel="noreferrer"
          >
            <ShieldCheck size={18} />
            <span>DEX contract</span>
            <ArrowUpRight size={15} />
          </a>
          <div className="sidebar-footer">
            <span className="status-dot" /> Built on Ethereum <span>↗</span>
          </div>
        </div>
      </aside>
      <div className="app-shell">
        <header className="topbar">
          <div className="desktop-breadcrumb">
            Markets <ChevronRight size={15} /> <span>Stocks</span>
          </div>
          <a
            className="mobile-brand brand-link"
            href="#"
            aria-label="Stockroom home"
            onClick={reset}
          >
            <Logo />
          </a>
          <div className="header-actions">
            <span className="network">
              <svg
                width="14"
                height="21"
                viewBox="0 0 14 22"
                aria-hidden="true"
              >
                <path
                  d="m7 0 7 11-7 4-7-4L7 0Zm0 16 7-4-7 10-7-10 7 4Z"
                  fill="currentColor"
                />
              </svg>
              Ethereum
            </span>
            <span className="header-divider" />
            <button
              className="button wallet-button"
              onClick={() => {
                wallet.setError("");
                setWalletOpen(true);
              }}
            >
              <Wallet size={17} />
              <span>
                {wallet.account ? "Wallet connected" : "Connect wallet"}
              </span>
              {wallet.account && <span className="status-dot" />}
            </button>
            <button
              className="icon-button mobile-menu-button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>
        {menuOpen && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {nav}
          </nav>
        )}
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>
                Stocks, onchain<span>.</span>
              </h1>
              <p>Explore and buy 50 tokenized stocks with IMD.</p>
            </div>
            <button
              className="quiet-link about-link"
              onClick={() => setAboutOpen(true)}
            >
              Meet your new market <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="spotlight" aria-label="Stock spotlight">
            {stocks.slice(0, 3).map((s, i) => (
              <button
                className={`spotlight-card ${selected.symbol === s.symbol ? "is-selected" : ""}`}
                key={s.symbol}
                onClick={() => chooseStock(s)}
                aria-label={`Buy ${s.name}`}
              >
                <div className="spotlight-top">
                  <StockIcon stock={s} />
                  <span>
                    <strong>{s.name}</strong>
                    <span className="muted">{s.symbol}</span>
                  </span>
                  <ArrowUpRight className="spotlight-arrow" size={18} />
                </div>
                <div className="spotlight-value">
                  <strong>{currency(price(s)?.price)}</strong>
                  <span className="spotlight-change">
                    <Change value={price(s)?.change} />
                    <span className="muted">24h</span>
                  </span>
                </div>
                <div className="spotlight-footer">
                  <span>
                    {
                      [
                        "Consumer electronics",
                        "Computing & AI",
                        "Electric vehicles",
                      ][i]
                    }
                  </span>
                  <span className="tiny-line" aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>
          <div className="workspace">
            <section
              className="market-panel"
              id="markets"
              aria-labelledby="market-title"
            >
              <div className="market-title-row">
                <h2 id="market-title">
                  Explore stocks <span className="count-label">50</span>
                </h2>
                <button
                  className="icon-button"
                  aria-label="Refresh market prices"
                  disabled={priceLoading}
                  onClick={() => void refreshPrices()}
                >
                  <RefreshCw
                    size={17}
                    className={priceLoading ? "spinner" : ""}
                  />
                </button>
              </div>
              <div className="market-tabs" aria-label="Stock lists">
                <button
                  className={tab === "all" ? "active" : ""}
                  aria-pressed={tab === "all"}
                  onClick={() => setView("all")}
                >
                  All stocks
                </button>
                <button
                  className={tab === "watchlist" ? "active" : ""}
                  aria-pressed={tab === "watchlist"}
                  onClick={() => setView("watchlist")}
                >
                  <Star size={15} />
                  Watchlist <span>{favorites.length}</span>
                </button>
              </div>
              <div className="market-toolbar">
                <label className="search-field">
                  <Search size={18} />
                  <span className="sr-only">Search stocks</span>
                  <input
                    name="search"
                    type="search"
                    autoComplete="off"
                    placeholder="Search name, symbol or address"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label className="sector-select">
                  <span className="sr-only">Filter by sector</span>
                  <select
                    value={sector}
                    onChange={(e) => {
                      setSector(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option>All sectors</option>
                    {sectors.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="data-context">
                <SnapshotLabel fetchedAt={prices.fetchedAt} live={priceLive} />
                <span>Token prices in USD</span>
              </div>
              {priceError && (
                <div className="price-error" role="status">
                  {priceError}{" "}
                  <button
                    className="inline-button"
                    onClick={() => void refreshPrices()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {tab === "watchlist" && (
                <p className="watchlist-note">
                  Your watchlist is saved in this browser.
                </p>
              )}
              <table className="stock-table">
                <caption className="sr-only">
                  50 supplied tokenized stocks. Select a company to buy or view
                  its contract.
                </caption>
                <thead>
                  <tr>
                    <th className="favorite-cell">
                      <span className="sr-only">Watchlist</span>
                    </th>
                    <th
                      className="rank-cell"
                      aria-sort={
                        sort === "rank"
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        onClick={() => sortBy("rank")}
                        aria-label="Sort by supplied rank"
                      >
                        #
                      </button>
                    </th>
                    <th
                      aria-sort={
                        sort === "name"
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button onClick={() => sortBy("name")}>
                        Asset <ArrowUpDown size={12} />
                      </button>
                    </th>
                    <th
                      className="price-column"
                      aria-sort={
                        sort === "price"
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button onClick={() => sortBy("price")}>
                        Price <ArrowUpDown size={12} />
                      </button>
                    </th>
                    <th
                      className="change-column"
                      aria-sort={
                        sort === "change"
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button onClick={() => sortBy("change")}>
                        24h change <ArrowUpDown size={12} />
                      </button>
                    </th>
                    <th className="volume-column">24h volume</th>
                    <th className="contract-column">
                      <span className="sr-only">Contract</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStocks.map((s) => (
                    <tr
                      key={s.symbol}
                      className={
                        selected.symbol === s.symbol ? "selected-row" : ""
                      }
                    >
                      <td className="favorite-cell">
                        <button
                          className={`icon-button star-button ${favorites.includes(s.symbol) ? "saved" : ""}`}
                          aria-label={`${favorites.includes(s.symbol) ? "Remove" : "Add"} ${s.name} ${favorites.includes(s.symbol) ? "from" : "to"} watchlist`}
                          aria-pressed={favorites.includes(s.symbol)}
                          onClick={() => toggleFavorite(s)}
                        >
                          <Star size={16} />
                        </button>
                      </td>
                      <td className="rank-cell">{s.rank}</td>
                      <td>
                        <button
                          className="asset-button"
                          onClick={() => chooseStock(s)}
                        >
                          <StockIcon stock={s} small />
                          <span>
                            <strong>{s.name}</strong>
                            <span className="muted">{s.symbol}</span>
                          </span>
                        </button>
                      </td>
                      <td
                        className={`numeric price-column ${!price(s) ? "missing-price" : ""}`}
                      >
                        <span>{currency(price(s)?.price)}</span>
                        <span className="mobile-change">
                          <Change value={price(s)?.change} />
                        </span>
                      </td>
                      <td className="numeric change-column">
                        <Change value={price(s)?.change} />
                      </td>
                      <td className="numeric volume-column">
                        {compactMoney(price(s)?.volume)}
                      </td>
                      <td className="contract-column">
                        <button
                          className="icon-button"
                          aria-label={`View ${s.symbol} contract and details`}
                          onClick={() => {
                            setDetail(s);
                            setCopied(false);
                            setCopyNotice("");
                          }}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="empty-state">
                  {tab === "watchlist" && !favorites.length ? (
                    <Star size={28} />
                  ) : (
                    <Search size={28} />
                  )}
                  <h3>
                    {tab === "watchlist" && !favorites.length
                      ? "Keep your favorites close"
                      : "No matching stocks"}
                  </h3>
                  <p>
                    {tab === "watchlist" && !favorites.length
                      ? "Star a stock to add it to your watchlist."
                      : `No stocks match ${query ? `“${query}”` : "these filters"}. Try a different search.`}
                  </p>
                  <button className="button secondary" onClick={reset}>
                    {tab === "watchlist" && !favorites.length
                      ? "Explore all stocks"
                      : "Clear filters"}
                  </button>
                </div>
              )}
              <div className="table-pagination">
                <span role="status">
                  {filtered.length
                    ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} stocks`
                    : "0 stocks"}
                </span>
                <div className="pagination-actions">
                  <label className="page-size">
                    <span className="sr-only">Stocks per page</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value={10}>10 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>Show all 50</option>
                    </select>
                  </label>
                  <button
                    className="icon-button"
                    aria-label="Previous page"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Next page"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <div className="market-source">
                <span>
                  Prices by{" "}
                  <a
                    href="https://dexscreener.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    DEX Screener <ArrowUpRight size={12} />
                  </a>
                </span>
                <span>
                  {Object.keys(prices.quotes).length} of 50 prices available
                </span>
              </div>
            </section>
            <div className="trade-column">
              <TradePanel
                stock={selected}
                price={price(selected)}
                wallet={wallet}
                dexState={dexState}
                onConnect={() => {
                  wallet.setError("");
                  setWalletOpen(true);
                }}
                onChoose={() => {
                  setPickerQuery("");
                  setPickerOpen(true);
                }}
                onAbout={() => setAboutOpen(true)}
              />
              <div className="ownership-note">
                <div className="ownership-art" aria-hidden="true">
                  <span className="art-square">s</span>
                  <ArrowRight size={20} />
                  <Wallet size={30} />
                </div>
                <h3>Keep stocks in your wallet</h3>
                <p>
                  Buy tokenized exposure to companies you know. Keep your tokens
                  on Ethereum.
                </p>
                <button
                  className="quiet-link"
                  onClick={() => setAboutOpen(true)}
                >
                  How it works <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          </div>
          <footer className="page-footer">
            <span>
              Stockroom <span className="muted">/ Powered by IMD</span>
            </span>
            <span>Token prices are indicative. Your quote sets the trade.</span>
            <button onClick={() => setAboutOpen(true)}>
              About & risks <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      <div className="sr-only" role="status">
        {status}
      </div>
      {walletOpen && (
        <WalletModal wallet={wallet} onClose={() => setWalletOpen(false)} />
      )}
      {pickerOpen && (
        <Modal title="Choose a stock" onClose={() => setPickerOpen(false)}>
          <label className="search-field picker-search">
            <Search size={18} />
            <span className="sr-only">Search available stocks</span>
            <input
              name="stock-search"
              type="search"
              autoFocus
              autoComplete="off"
              placeholder="Search 50 stocks"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
            />
          </label>
          <div className="picker-list">
            {stocks
              .filter((s) =>
                `${s.name} ${s.symbol} ${s.address}`
                  .toLowerCase()
                  .includes(pickerQuery.toLowerCase().trim()),
              )
              .map((s) => (
                <button
                  className="picker-item"
                  key={s.symbol}
                  onClick={() => chooseStock(s)}
                >
                  <StockIcon stock={s} small />
                  <span>
                    <strong>{s.name}</strong>
                    <span className="muted">{s.symbol}</span>
                  </span>
                  <span className="picker-price">
                    {currency(price(s)?.price)}
                  </span>
                  {selected.symbol === s.symbol && <Check size={16} />}
                </button>
              ))}
            {!stocks.some((s) =>
              `${s.name} ${s.symbol} ${s.address}`
                .toLowerCase()
                .includes(pickerQuery.toLowerCase().trim()),
            ) && (
              <div className="empty-state">
                <h3>No matching stocks</h3>
                <button
                  className="button secondary"
                  onClick={() => setPickerQuery("")}
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
      {detail && (
        <Modal title="Stock details" onClose={() => setDetail(undefined)}>
          <div className="review-stock">
            <StockIcon stock={detail} />
            <div>
              <h3>{detail.name}</h3>
              <p className="muted">
                {detail.symbol} · {detail.sector}
              </p>
            </div>
          </div>
          <dl className="review-details">
            <div>
              <dt>Reference token price</dt>
              <dd>{currency(price(detail)?.price)}</dd>
            </div>
            <div>
              <dt>24h change</dt>
              <dd>
                <Change value={price(detail)?.change} />
              </dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Ethereum mainnet</dd>
            </div>
          </dl>
          <p className="field-caption">Token contract</p>
          <code className="full-address">{detail.address}</code>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(detail.address);
                  setCopied(true);
                } catch {
                  setCopyNotice(
                    "Select and copy the full contract address above.",
                  );
                }
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
              {copied ? "Copied" : "Copy address"}
            </button>
            <a
              className="button secondary"
              href={`${EXPLORER}/token/${detail.address}`}
              target="_blank"
              rel="noreferrer"
            >
              View contract <ExternalLink size={16} />
            </a>
          </div>
          <p role="status">{copyNotice}</p>
          <button
            className="button primary full-width"
            onClick={() => chooseStock(detail)}
          >
            Select {detail.symbol} <ArrowRight size={16} />
          </button>
          <p className="fineprint">
            Listing here does not mean this market is enabled on the DEX.
            Availability is checked before quoting.
          </p>
          {price(detail) && (
            <a
              className="quiet-link"
              href={price(detail)?.url}
              target="_blank"
              rel="noreferrer"
            >
              View price source <ArrowUpRight size={15} />
            </a>
          )}
        </Modal>
      )}
      {aboutOpen && (
        <Modal
          title="A stock market for your wallet"
          onClose={() => setAboutOpen(false)}
        >
          <p className="modal-intro">
            Stockroom connects your Ethereum wallet to the IMD Stock DEX.
          </p>
          <ol className="how-steps">
            <li>
              <span>1</span>
              <div>
                <h3>Choose a tokenized stock</h3>
                <p>
                  Explore the 50 supplied assets. Market prices are token
                  reference prices, not guaranteed stock exchange prices.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Get a quote in IMD</h3>
                <p>
                  Connect an Ethereum wallet, enter an IMD amount and choose
                  your slippage limit. A quote includes the DEX fee; ETH network
                  fees are separate.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Review and buy</h3>
                <p>
                  Approve the exact IMD amount if needed. Get a fresh quote,
                  then confirm the purchase. The contract sends stock tokens to
                  your wallet.
                </p>
              </div>
            </li>
          </ol>
          <div className="about-risk">
            <ShieldCheck size={20} />
            <div>
              <h3>Know what you’re buying</h3>
              <p>
                These are third-party stock tokens, not direct share ownership.
                Prices can differ from underlying shares. Issuer restrictions,
                transfer limits and eligibility rules may apply. You can lose
                money.
              </p>
              <a
                href="https://ondo.finance/global-markets"
                target="_blank"
                rel="noreferrer"
              >
                Read the issuer’s information <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
          <details className="about-details">
            <summary>DEX status, fees & price sources</summary>
            <p>
              The verified contract charges 0.50% of the IMD amount. Swap pool
              fees affect the quoted output. The owner controls markets and can
              pause trading.
            </p>
            <p>
              Reference prices come from the highest-liquidity Ethereum pair
              returned by DEX Screener. A dated bundled snapshot remains
              available if the price feed fails. Missing prices are never
              estimated.
            </p>
            <p>
              The asset order follows the supplied list, not market
              capitalization. Watchlists live only in this browser.
            </p>
            <p>DEX contract</p>
            <code className="full-address">{DEX}</code>
            <a
              href={`${EXPLORER}/address/${DEX}#code`}
              target="_blank"
              rel="noreferrer"
            >
              Inspect the verified contract <ArrowUpRight size={15} />
            </a>
          </details>
        </Modal>
      )}
    </>
  );
}
