import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseUnits,
} from "viem";
import type { Address, EIP1193Provider } from "viem";
import { mainnet } from "viem/chains";
import { dexAbi } from "./dex-abi";

export const DEX: Address = "0xf66c6c7a09e741843d4ede8795ac4267e3823037";
export const EXPLORER = "https://etherscan.io";
export const RPC = "https://ethereum-rpc.publicnode.com";
export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC, { timeout: 12_000, retryCount: 1 }),
});
export const walletClient = (provider: EIP1193Provider) =>
  createWalletClient({ chain: mainnet, transport: custom(provider) });
export const presentAddress = (value: string): value is Address =>
  isAddress(value) && !/^0x0+$/i.test(value);
export const lowerAddress = (value: Address): Address =>
  value.toLowerCase() as Address;
export type DexState = {
  paused: boolean;
  configured: boolean;
  imd: Address;
  decimals: number;
  symbol: string;
  feeBps: bigint;
  version: bigint;
  block: bigint;
};

export async function readDex(): Promise<DexState> {
  const block = await publicClient.getBlockNumber();
  const read = <
    F extends
      | "paused"
      | "imd"
      | "router"
      | "quoter"
      | "creator"
      | "configVersion"
      | "FEE_BPS",
  >(
    functionName: F,
  ) =>
    publicClient.readContract({
      address: DEX,
      abi: dexAbi,
      functionName,
      blockNumber: block,
    });
  const [paused, imd, router, quoter, creator, version, feeBps] =
    await Promise.all([
      read("paused"),
      read("imd"),
      read("router"),
      read("quoter"),
      read("creator"),
      read("configVersion"),
      read("FEE_BPS"),
    ]);
  let decimals = 0;
  let symbol = "IMD";
  if (presentAddress(imd)) {
    [decimals, symbol] = await Promise.all([
      publicClient.readContract({
        address: imd,
        abi: erc20Abi,
        functionName: "decimals",
        blockNumber: block,
      }),
      publicClient.readContract({
        address: imd,
        abi: erc20Abi,
        functionName: "symbol",
        blockNumber: block,
      }),
    ]);
  }
  return {
    paused,
    imd,
    decimals,
    symbol,
    version,
    feeBps,
    block,
    configured: [imd, router, quoter, creator].every(presentAddress),
  };
}

export async function readAsset(address: Address) {
  const [market, decimals] = await Promise.all([
    publicClient.readContract({
      address: DEX,
      abi: dexAbi,
      functionName: "market",
      args: [lowerAddress(address)],
    }),
    publicClient.readContract({
      address: lowerAddress(address),
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);
  return { enabled: market[1], decimals };
}
export async function readBalance(token: Address, account: Address) {
  return publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
}
export function parseAmount(value: string, decimals: number): bigint {
  if (
    !/^\d+(?:\.\d+)?$/.test(value) ||
    (value.split(".")[1]?.length ?? 0) > decimals
  )
    throw new Error(
      `Enter a positive amount with up to ${decimals} decimal places.`,
    );
  const result = parseUnits(value, decimals);
  if (result <= 0n) throw new Error("Enter an amount greater than zero.");
  return result;
}
export function tokenAmount(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}
export function displayAmount(value: bigint, decimals: number): string {
  const numeric = Number(formatUnits(value, decimals));
  if (numeric > 0 && numeric < 0.000001) return "<0.000001";
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
export function friendlyError(error: unknown): string {
  const e = error as {
    message?: string;
    shortMessage?: string;
    code?: number;
    cause?: unknown;
  };
  const raw = `${e.shortMessage ?? ""} ${e.message ?? ""}`;
  if (e.code === 4001 || /rejected|denied/i.test(raw))
    return "Request declined in your wallet. You can try again.";
  if (/ConfigurationChanged/i.test(raw))
    return "The DEX configuration changed. Get a new quote.";
  if (/MarketNotEnabled/i.test(raw))
    return "This stock is not enabled on the DEX yet. Choose another stock.";
  if (/EnforcedPause/i.test(raw))
    return "Trading is paused by the DEX owner. Refresh the status later.";
  if (/NotConfigured|QuoterNotConfigured/i.test(raw))
    return "The DEX is still being configured. Quotes are not available yet.";
  if (/InsufficientLiquidity|InvalidQuote/i.test(raw))
    return "There is not enough liquidity for this amount. Try a smaller amount.";
  if (/InsufficientOutput/i.test(raw))
    return "The price moved beyond your slippage limit. Get a new quote.";
  if (/insufficient funds/i.test(raw))
    return "Your wallet needs enough IMD for this trade and ETH for network fees.";
  if (/AmountTooSmall/i.test(raw))
    return "This amount is too small for the DEX. Enter a larger amount.";
  if (/deadline|expired/i.test(raw))
    return "This quote has expired. Get a new quote.";
  if (/timeout|timed out/i.test(raw))
    return "The network did not respond in time. Check the transaction on Etherscan before trying again.";
  if (/network|fetch|HTTP|RPC|socket/i.test(raw))
    return "Unable to reach Ethereum. Check your connection and try again.";
  if (error instanceof Error && !e.shortMessage && error.message.length < 180)
    return error.message;
  return "The request could not be completed. Check your wallet and try again.";
}
