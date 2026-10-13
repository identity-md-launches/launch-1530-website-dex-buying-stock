// Rebuild the dated fallback from the public source. Never invent missing prices.
import { writeFile } from "node:fs/promises";
import { stocks } from "../src/lib/stocks.ts";
const batches = [stocks.slice(0, 30), stocks.slice(30)];
const responses = await Promise.all(
  batches.map(async (batch) => {
    const url = `https://api.dexscreener.com/tokens/v1/ethereum/${batch.map((s) => s.address).join(",")}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok)
      throw new Error(
        `${url}: HTTP ${response.status}; existing snapshot preserved.`,
      );
    const pairs = await response.json();
    if (!Array.isArray(pairs))
      throw new Error(
        "Unexpected price response; existing snapshot preserved.",
      );
    return pairs;
  }),
);
const quotes = {};
for (const pair of responses.flat()) {
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
  const finite = (v) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  quotes[address] = {
    price,
    change: finite(pair.priceChange?.h24),
    volume: finite(pair.volume?.h24),
    liquidity,
    url: `https://dexscreener.com/ethereum/${encodeURIComponent(pair.pairAddress)}`,
    pairAddress: pair.pairAddress,
  };
}
if (!Object.keys(quotes).length)
  throw new Error("No prices returned; existing snapshot preserved.");
const data = {
  fetchedAt: new Date().toISOString(),
  source: "DEX Screener",
  quotes,
};
await writeFile(
  new URL("../src/lib/price-snapshot.json", import.meta.url),
  JSON.stringify(data, null, 2) + "\n",
);
console.log(
  `Saved ${Object.keys(quotes).length} real token prices at ${data.fetchedAt}. Rebuild dist/ to include the snapshot.`,
);
