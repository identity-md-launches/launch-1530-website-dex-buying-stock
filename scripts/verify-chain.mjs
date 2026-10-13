// Read-only inspection of the supplied DEX. Does not configure or send transactions.
import { createPublicClient, http, keccak256 } from "viem";
import { mainnet } from "viem/chains";
import { dexAbi } from "../src/lib/dex-abi.ts";
import { stocks } from "../src/lib/stocks.ts";
const address = "0xf66c6c7a09e741843d4ede8795ac4267e3823037";
const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com", {
    batch: true,
    timeout: 15000,
    retryCount: 1,
  }),
});
const block = await client.getBlockNumber();
const functions = [
  "paused",
  "imd",
  "router",
  "quoter",
  "creator",
  "configVersion",
  "FEE_BPS",
];
const values = await Promise.all(
  functions.map((functionName) =>
    client.readContract({
      address,
      abi: dexAbi,
      functionName,
      blockNumber: block,
    }),
  ),
);
const markets = await Promise.all(
  stocks.map((s) =>
    client.readContract({
      address,
      abi: dexAbi,
      functionName: "market",
      args: [s.address.toLowerCase()],
      blockNumber: block,
    }),
  ),
);
const code = await client.getCode({ address, blockNumber: block });
if (!code || code === "0x") throw new Error("No deployed contract code.");
const result = {
  inspectedAt: new Date().toISOString(),
  chainId: await client.getChainId(),
  address,
  block: String(block),
  runtimeCodeKeccak256: keccak256(code),
  ...Object.fromEntries(
    functions.map((name, i) => [
      name,
      typeof values[i] === "bigint" ? String(values[i]) : values[i],
    ]),
  ),
  enabledStocks: stocks.filter((_, i) => markets[i][1]).map((s) => s.symbol),
};
console.log(JSON.stringify(result, null, 2));
