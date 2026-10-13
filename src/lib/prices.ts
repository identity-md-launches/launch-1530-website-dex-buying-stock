import snapshot from "./price-snapshot.json";
import { stocks } from "./stocks";
export type Price = {
  price: number;
  change: number | null;
  volume: number | null;
  liquidity: number;
  url: string;
  pairAddress: string;
};
export type Prices = {
  fetchedAt: string;
  source: string;
  quotes: Record<string, Price>;
};
export const initialPrices: Prices = snapshot;
export const currency = (n?: number) =>
  n === undefined
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: n < 1 ? 4 : 2,
      }).format(n);
export const compactMoney = (n?: number | null) =>
  n == null
    ? "Unavailable"
    : "$" +
      Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
export async function fetchPrices(signal: AbortSignal): Promise<Prices> {
  const batches = [stocks.slice(0, 30), stocks.slice(30)];
  const pairs = (
    await Promise.all(
      batches.map(async (batch) => {
        const response = await fetch(
          `https://api.dexscreener.com/tokens/v1/ethereum/${batch.map((s) => s.address).join(",")}`,
          { signal },
        );
        if (!response.ok)
          throw new Error(`Price service returned ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data))
          throw new Error("Price service returned an invalid response");
        return data;
      }),
    )
  ).flat();
  const quotes: Record<string, Price> = {};
  for (const pair of pairs) {
    const address = pair?.baseToken?.address?.toLowerCase();
    const price = Number(pair?.priceUsd);
    if (
      pair?.chainId !== "ethereum" ||
      !stocks.some((s) => s.address.toLowerCase() === address) ||
      !Number.isFinite(price) ||
      price <= 0
    )
      continue;
    const liquidity =
      typeof pair.liquidity?.usd === "number" ? pair.liquidity.usd : 0;
    if (quotes[address] && quotes[address].liquidity >= liquidity) continue;
    const finite = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    quotes[address] = {
      price,
      change: finite(pair.priceChange?.h24),
      volume: finite(pair.volume?.h24),
      liquidity,
      pairAddress: pair.pairAddress,
      url: `https://dexscreener.com/ethereum/${encodeURIComponent(pair.pairAddress)}`,
    };
  }
  if (!Object.keys(quotes).length) throw new Error("No market prices returned");
  return {
    fetchedAt: new Date().toISOString(),
    source: "DEX Screener",
    quotes,
  };
}
