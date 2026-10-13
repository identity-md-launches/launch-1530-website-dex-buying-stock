import type { Stock } from "../lib/stocks";
export function StockIcon({
  stock,
  small = false,
}: {
  stock: Stock;
  small?: boolean;
}) {
  const ticker = stock.symbol.slice(0, -2);
  return (
    <span
      className={`stock-icon ${stock.color} ${small ? "small" : ""} brand-${ticker.toLowerCase()}`}
      aria-hidden="true"
    >
      {ticker === "AAPL" ? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M16.3 2.6c.1 1.5-.6 2.8-1.5 3.6-.9.8-2.1 1.2-3.3 1.1-.1-1.4.7-2.8 1.5-3.6.9-.8 2.2-1.3 3.3-1.1ZM19.4 17.2c-.5 1.2-.8 1.7-1.5 2.7-.9 1.2-2.1 2.8-3.6 2.8-1.3 0-1.6-.9-3.4-.9s-2.2.9-3.5.9c-1.4.1-2.6-1.4-3.5-2.6C1.4 16.6.4 11.4 2 8.8c1.1-1.9 2.8-3 4.4-3 1.6 0 2.6.9 4 .9s2.2-.9 4-.9c1.4 0 3 .8 4.1 2.1-3.6 2-3 7.2.9 9.3Z"
            transform="translate(2 -1) scale(.88)"
          />
        </svg>
      ) : ticker === "MSFT" ? (
        <svg viewBox="0 0 24 24">
          <path fill="#a0442a" d="M2 2h9v9H2z" />
          <path fill="#547722" d="M13 2h9v9h-9z" />
          <path fill="#1d789e" d="M2 13h9v9H2z" />
          <path fill="#ae811e" d="M13 13h9v9h-9z" />
        </svg>
      ) : ticker === "NVDA" ? (
        <svg
          viewBox="0 0 28 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 12s9-11 19-3v10h-8v-5h5V9c-7-4-13 3-13 3s3 5 8 5M14 5h11v17H14M12 12s3-3 6 0" />
        </svg>
      ) : ticker === "TSLA" ? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 4c6-2 12-2 18 0l-1 2c-5-2-11-2-16 0L3 4Zm2 4c4-1 10-1 14 0l-1 3-4-1-2 13-2-13-4 1-1-3Z" />
        </svg>
      ) : (
        <span>{ticker.length <= 2 ? ticker : ticker[0]}</span>
      )}
    </span>
  );
}
