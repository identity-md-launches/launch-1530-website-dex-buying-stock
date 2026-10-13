import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Info,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { decodeEventLog, erc20Abi } from "viem";
import type { Address, Hash, TransactionReceipt } from "viem";
import {
  DEX,
  EXPLORER,
  displayAmount,
  friendlyError,
  lowerAddress,
  parseAmount,
  presentAddress,
  publicClient,
  readAsset,
  readBalance,
  readDex,
  tokenAmount,
  walletClient,
} from "../lib/chain";
import { dexAbi } from "../lib/dex-abi";
import type { Stock } from "../lib/stocks";
import type { Price } from "../lib/prices";
import { currency } from "../lib/prices";
import type { WalletState } from "../lib/wallet";
import type { DexHook } from "../lib/useDex";
import { StockIcon } from "./StockIcon";
import { Modal } from "./Modal";

type Quote = {
  stock: Stock;
  gross: bigint;
  out: bigint;
  minimum: bigint;
  fee: bigint;
  version: bigint;
  deadline: bigint;
  expires: number;
  decimals: number;
  token: Address;
  payDecimals: number;
  account: Address;
  needsApproval: boolean;
  slippage: number;
};
type Transaction = {
  hash: Hash;
  kind: "approval" | "purchase";
  state: "pending" | "success" | "failed" | "unknown";
  quote: Quote;
};

export function TradePanel({
  stock,
  price,
  wallet,
  dexState,
  onConnect,
  onChoose,
  onAbout,
}: {
  stock: Stock;
  price?: Price;
  wallet: WalletState;
  dexState: DexHook;
  onConnect: () => void;
  onChoose: () => void;
  onAbout: () => void;
}) {
  const { dex, loading, error: dexError, refresh } = dexState;
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(50);
  const [asset, setAsset] = useState<{ enabled: boolean; decimals: number }>();
  const [assetError, setAssetError] = useState("");
  const [assetLoading, setAssetLoading] = useState(true);
  const [assetRevision, setAssetRevision] = useState(0);
  const [balance, setBalance] = useState<bigint>();
  const [balanceError, setBalanceError] = useState("");
  const [balanceRevision, setBalanceRevision] = useState(0);
  const [quote, setQuote] = useState<Quote>();
  const [busy, setBusy] = useState<"quote" | "approval" | "purchase">();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [transaction, setTransaction] = useState<Transaction>();
  const [now, setNow] = useState(Date.now());
  const request = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  useEffect(() => {
    let cancelled = false;
    setAsset(undefined);
    setAssetError("");
    setAssetLoading(true);
    readAsset(stock.address)
      .then((result) => {
        if (!cancelled) setAsset(result);
      })
      .catch((e) => {
        if (!cancelled) setAssetError(friendlyError(e));
      })
      .finally(() => {
        if (!cancelled) setAssetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stock.address, assetRevision, dex?.version]);
  useEffect(() => {
    let cancelled = false;
    setBalance(undefined);
    setBalanceError("");
    if (wallet.account && dex && presentAddress(dex.imd))
      readBalance(dex.imd, wallet.account)
        .then((b) => {
          if (!cancelled) setBalance(b);
        })
        .catch(() => {
          if (!cancelled)
            setBalanceError("Balance unavailable. Retry before buying.");
        });
    return () => {
      cancelled = true;
    };
  }, [wallet.account, dex?.imd, balanceRevision]);
  useEffect(() => {
    request.current++;
    setQuote(undefined);
    setError("");
    setNote("");
  }, [stock.address, amount, slippage, wallet.account, wallet.chain]);
  useEffect(() => {
    if (!quote) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [quote]);

  const ready =
    !!dex &&
    dex.configured &&
    !dex.paused &&
    asset?.enabled &&
    !loading &&
    !assetLoading;
  const assertWallet = async (account: Address) => {
    const current = walletRef.current;
    if (
      !current.provider ||
      current.account?.toLowerCase() !== account.toLowerCase() ||
      current.chain !== 1
    )
      throw new Error(
        "Wallet changed. Reconnect on Ethereum and get a new quote.",
      );
    const [accounts, chainId] = await Promise.all([
      current.provider.request({ method: "eth_accounts" }),
      current.provider.request({ method: "eth_chainId" }),
    ]);
    if (
      Number(chainId) !== 1 ||
      accounts[0]?.toLowerCase() !== account.toLowerCase()
    )
      throw new Error(
        "Wallet changed. Reconnect on Ethereum and get a new quote.",
      );
    return current.provider;
  };
  const getQuote = async () => {
    if (!wallet.account) return onConnect();
    if (wallet.chain !== 1) return void wallet.switchNetwork();
    if (!dex || !ready || !asset) return;
    let gross: bigint;
    try {
      gross = parseAmount(amount, dex.decimals);
    } catch (e) {
      setError(friendlyError(e));
      inputRef.current?.focus();
      return;
    }
    const id = ++request.current;
    setBusy("quote");
    setError("");
    setNote("");
    try {
      const account = wallet.account;
      await assertWallet(account);
      const [state, tokenBalance, allowance] = await Promise.all([
        readDex(),
        readBalance(dex.imd, account),
        publicClient.readContract({
          address: dex.imd,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account, DEX],
        }),
      ]);
      if (!state.configured || state.paused)
        throw new Error("Trading is not available. Refresh the DEX status.");
      if (state.imd !== dex.imd)
        throw new Error("The payment token changed. Refresh the DEX status.");
      if (gross > tokenBalance)
        throw new Error(
          "Insufficient IMD balance. Enter a smaller amount or add IMD to your wallet.",
        );
      const { result } = await publicClient.simulateContract({
        address: DEX,
        abi: dexAbi,
        functionName: "quoteBuy",
        args: [lowerAddress(stock.address), gross],
        account,
      });
      const [out, fees, version] = result;
      if (out <= 0n)
        throw new Error("No output was quoted. Try a different amount.");
      const minimum = (out * BigInt(10_000 - slippage)) / 10_000n;
      if (minimum <= 0n)
        throw new Error("This amount is too small. Enter a larger amount.");
      if (id !== request.current) return;
      setBalance(tokenBalance);
      setQuote({
        stock,
        gross,
        out,
        minimum,
        fee: fees.fee,
        version,
        expires: Date.now() + 60_000,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 120),
        decimals: asset.decimals,
        token: dex.imd,
        payDecimals: dex.decimals,
        account,
        needsApproval: allowance < gross,
        slippage,
      });
    } catch (e) {
      if (id === request.current) setError(friendlyError(e));
    } finally {
      setBusy(undefined);
    }
  };
  const confirmReceipt = async (
    receipt: TransactionReceipt,
    q: Quote,
    kind: "approval" | "purchase",
  ) => {
    let confirmed = receipt.status === "success";
    if (confirmed && kind === "approval") {
      const allowance = await publicClient.readContract({
        address: q.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [q.account, DEX],
      });
      confirmed = allowance >= q.gross;
    } else if (confirmed) {
      confirmed = receipt.logs.some((log) => {
        if (log.address.toLowerCase() !== DEX.toLowerCase()) return false;
        try {
          const event = decodeEventLog({
            abi: dexAbi,
            eventName: "StockPurchased",
            data: log.data,
            topics: log.topics,
          });
          return (
            event.args.buyer.toLowerCase() === q.account.toLowerCase() &&
            event.args.stock.toLowerCase() === q.stock.address.toLowerCase() &&
            event.args.grossIMD === q.gross &&
            event.args.stockReceived >= q.minimum
          );
        } catch {
          return false;
        }
      });
    }
    setTransaction({
      hash: receipt.transactionHash,
      kind,
      state: confirmed ? "success" : "failed",
      quote: q,
    });
    if (!confirmed)
      setError(
        "The transaction reverted or was replaced without completing this action. Check Etherscan. Network fees may apply.",
      );
    else
      setNote(
        kind === "approval"
          ? "IMD allowance confirmed. Get a fresh quote to complete your purchase."
          : `${q.stock.symbol} purchase confirmed on Ethereum. The tokens were sent to your wallet.`,
      );
    setBalanceRevision((n) => n + 1);
  };
  const recheckReceipt = async () => {
    if (!transaction) return;
    setBusy(transaction.kind);
    setError("");
    try {
      await confirmReceipt(
        await publicClient.getTransactionReceipt({ hash: transaction.hash }),
        transaction.quote,
        transaction.kind,
      );
    } catch {
      setError(
        "A confirmed receipt is not available yet. Check Etherscan and retry confirmation.",
      );
    } finally {
      setBusy(undefined);
    }
  };
  const execute = async () => {
    if (!quote || busy) return;
    const q = quote;
    const kind = q.needsApproval ? "approval" : "purchase";
    setBusy(kind);
    setError("");
    setNote("");
    setTransaction(undefined);
    try {
      if (Date.now() >= q.expires)
        throw new Error("This quote has expired. Get a new quote.");
      const provider = await assertWallet(q.account);
      const state = await readDex();
      if (state.paused || !state.configured || state.version !== q.version)
        throw new Error(
          "The DEX configuration changed. Close this review and get a new quote.",
        );
      const currentAsset = await readAsset(q.stock.address);
      if (!currentAsset.enabled)
        throw new Error("This stock is no longer available on the DEX.");
      let hash: Hash;
      if (kind === "approval") {
        const simulation = await publicClient.simulateContract({
          address: q.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [DEX, q.gross],
          account: q.account,
        });
        await assertWallet(q.account);
        hash = await walletClient(provider).writeContract(simulation.request);
      } else {
        const simulation = await publicClient.simulateContract({
          address: DEX,
          abi: dexAbi,
          functionName: "buyStock",
          args: [
            lowerAddress(q.stock.address),
            q.gross,
            q.minimum,
            q.deadline,
            q.version,
          ],
          account: q.account,
        });
        await assertWallet(q.account);
        if (Date.now() >= q.expires)
          throw new Error("This quote has expired. Get a new quote.");
        hash = await walletClient(provider).writeContract(simulation.request);
      }
      setTransaction({ hash, kind, state: "pending", quote: q });
      setQuote(undefined);
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          confirmations: 1,
          onReplaced: ({ transaction }) =>
            setTransaction({
              hash: transaction.hash,
              kind,
              state: "pending",
              quote: q,
            }),
        });
        await confirmReceipt(receipt, q, kind);
      } catch {
        setTransaction((prev) => (prev ? { ...prev, state: "unknown" } : prev));
        setError(
          "Confirmation is taking longer than expected. Check Etherscan before submitting another transaction.",
        );
      }
      setBalanceRevision((n) => n + 1);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(undefined);
    }
  };
  const expired = !!quote && now >= quote.expires;
  const waiting = !!busy || wallet.busy;
  const unresolved =
    transaction?.state === "unknown" || transaction?.state === "pending";
  let action = "Get quote";
  if (!wallet.account) action = "Connect wallet";
  else if (wallet.chain !== 1) action = "Switch to Ethereum";
  else if (busy === "quote") action = "Getting quote…";
  else if (busy) action = "Waiting for confirmation…";
  else if (unresolved) action = "Awaiting transaction";
  else if (loading || assetLoading) action = "Checking availability…";
  else if (!ready)
    action = dex?.paused ? "Trading paused" : "Trading unavailable";

  return (
    <section className="trade-panel" id="trade" aria-labelledby="trade-title">
      <div className="section-heading">
        <h2 id="trade-title">Buy stock</h2>
        <button
          className="icon-button"
          aria-label="About buying stocks"
          onClick={onAbout}
        >
          <CircleHelp size={18} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void getQuote();
        }}
      >
        <div className="pay-field">
          <div className="field-heading">
            <label htmlFor="amount">You pay</label>
            <span className="token-label">
              <span className="imd-mini">i</span> IMD
            </span>
          </div>
          <input
            ref={inputRef}
            id="amount"
            name="amount"
            autoComplete="off"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={error ? "trade-error" : "balance-hint"}
            aria-invalid={!!error}
            disabled={!!busy}
          />
          <div className="balance-line" id="balance-hint">
            <span>
              {wallet.account
                ? balance !== undefined && dex
                  ? `Balance: ${displayAmount(balance, dex.decimals)} IMD`
                  : balanceError || "Reading balance…"
                : "Connect to see your balance"}
            </span>
            {balance !== undefined && balance > 0n && dex && (
              <button
                type="button"
                className="max-button"
                disabled={!!busy}
                onClick={() => setAmount(tokenAmount(balance, dex.decimals))}
              >
                Max
              </button>
            )}
            {balanceError && (
              <button
                className="inline-button"
                type="button"
                onClick={() => setBalanceRevision((n) => n + 1)}
              >
                Retry
              </button>
            )}
          </div>
        </div>
        <div className="trade-direction" aria-hidden="true">
          <ArrowDown size={17} />
        </div>
        <div className="receive-field">
          <span className="field-caption">You receive</span>
          <button
            className="stock-selector"
            type="button"
            onClick={onChoose}
            disabled={!!busy}
          >
            <StockIcon stock={stock} small />
            <span>
              <strong>{stock.name}</strong>
              <span className="muted">{stock.symbol}</span>
            </span>
            <ChevronDown size={18} />
          </button>
          <div className="reference-price">
            <span>Reference price</span>
            <span>{currency(price?.price)}</span>
          </div>
        </div>
        <div className="trade-settings">
          <span>Slippage limit</span>
          <div className="slippage-options" aria-label="Maximum slippage">
            {[10, 50, 100].map((n) => (
              <button
                key={n}
                type="button"
                className={n === slippage ? "selected" : ""}
                aria-pressed={n === slippage}
                disabled={!!busy}
                onClick={() => setSlippage(n)}
              >
                {n / 100}%
              </button>
            ))}
          </div>
        </div>
        <div className="fee-line">
          <span>
            DEX fee{" "}
            <button
              type="button"
              className="inline-icon"
              aria-label="Explain trading fees"
              onClick={onAbout}
            >
              <Info size={14} />
            </button>
          </span>
          <span>
            {dex ? `${Number(dex.feeBps) / 100}%` : "0.50%"}{" "}
            <span className="muted">of IMD</span>
          </span>
        </div>
        <button
          className="button primary full-width buy-action"
          type="submit"
          disabled={
            waiting ||
            unresolved ||
            (!!wallet.account && wallet.chain === 1 && !ready)
          }
        >
          {waiting ? (
            <LoaderCircle size={18} className="spinner" />
          ) : !wallet.account ? (
            <Wallet size={18} />
          ) : null}
          {action}
          {!wallet.account && <ArrowRight size={18} />}
        </button>
      </form>
      <div className="dex-notice">
        {loading ? (
          <>
            <LoaderCircle size={15} className="spinner" />
            <span>Checking the DEX on Ethereum…</span>
          </>
        ) : dexError ? (
          <>
            <Info size={16} />
            <span>DEX status unavailable.</span>
          </>
        ) : dex?.paused ? (
          <>
            <span className="status-dot amber" />
            <span>Trading is paused by the DEX owner.</span>
          </>
        ) : !dex?.configured ? (
          <>
            <Info size={16} />
            <span>The DEX is being configured.</span>
          </>
        ) : assetError ? (
          <>
            <Info size={16} />
            <span>Stock status unavailable.</span>
          </>
        ) : !asset?.enabled && !assetLoading ? (
          <>
            <Info size={16} />
            <span>This stock is not enabled for buying yet.</span>
          </>
        ) : (
          <>
            <ShieldCheck size={16} />
            <span>Quotes are verified on Ethereum.</span>
          </>
        )}
        <button
          className="icon-button refresh-status"
          aria-label="Refresh trading status"
          disabled={loading || assetLoading}
          onClick={() => {
            void refresh();
            setAssetRevision((n) => n + 1);
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div role="alert" id="trade-error">
        {(error || wallet.error) && (
          <p className="field-error">{error || wallet.error}</p>
        )}
      </div>
      <div role="status">
        {note && (
          <p className="success-note">
            <CheckCircle2 size={17} />
            {note}
          </p>
        )}
      </div>
      {transaction && (
        <div className="transaction">
          <span>
            {transaction.kind === "approval"
              ? "IMD approval"
              : "Stock purchase"}{" "}
            ·{" "}
            {transaction.state === "unknown"
              ? "Awaiting confirmation"
              : transaction.state}
          </span>
          <a
            href={`${EXPLORER}/tx/${transaction.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction <ArrowUpRight size={15} />
          </a>
          {transaction.state === "unknown" && (
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() => void recheckReceipt()}
            >
              Check confirmation
            </button>
          )}
        </div>
      )}
      <p className="trade-footnote">
        <ShieldCheck size={15} /> Tokens go directly to your wallet.
      </p>
      {quote && (
        <Modal
          title="Review your purchase"
          onClose={() => {
            setQuote(undefined);
            setError("");
          }}
          busy={!!busy}
        >
          <div className="review-stock">
            <StockIcon stock={quote.stock} />
            <div>
              <h3>{quote.stock.name}</h3>
              <p className="muted">{quote.stock.symbol} · Ethereum</p>
            </div>
          </div>
          <dl className="review-details">
            <div>
              <dt>You pay</dt>
              <dd>{tokenAmount(quote.gross, quote.payDecimals)} IMD</dd>
            </div>
            <div>
              <dt>Estimated receipt</dt>
              <dd>
                {tokenAmount(quote.out, quote.decimals)} {quote.stock.symbol}
              </dd>
            </div>
            <div>
              <dt>Minimum receipt</dt>
              <dd>
                {tokenAmount(quote.minimum, quote.decimals)}{" "}
                {quote.stock.symbol}
              </dd>
            </div>
            <div>
              <dt>DEX fee (included)</dt>
              <dd>{tokenAmount(quote.fee, quote.payDecimals)} IMD</dd>
            </div>
            <div>
              <dt>Maximum slippage</dt>
              <dd>{quote.slippage / 100}%</dd>
            </div>
            <div>
              <dt>Network fee</dt>
              <dd>Estimated in your wallet, in ETH</dd>
            </div>
          </dl>
          <details className="review-contracts">
            <summary>Contract and wallet details</summary>
            <p>DEX / allowance spender</p>
            <code className="full-address">{DEX}</code>
            <p>IMD payment token</p>
            <code className="full-address">{quote.token}</code>
            <p>Stock token</p>
            <code className="full-address">{quote.stock.address}</code>
            <p>Recipient wallet</p>
            <code className="full-address">{quote.account}</code>
          </details>
          <p className="notice">
            {expired
              ? "Quote expired. Close this review and request a new quote."
              : quote.needsApproval
                ? "First, approve only this amount of IMD. After confirmation, request a fresh quote to buy."
                : "Confirming sends a purchase transaction. Review the amount and network fee in your wallet."}
          </p>
          <div role="alert">
            {error && <p className="field-error">{error}</p>}
          </div>
          <button
            className="button primary full-width"
            onClick={() => void execute()}
            disabled={expired || !!busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="spinner" size={18} /> Check your
                wallet…
              </>
            ) : quote.needsApproval ? (
              "Approve IMD amount"
            ) : (
              "Confirm purchase"
            )}
          </button>
          <p className="fineprint center">
            {expired
              ? "Get a new quote to continue."
              : `Quote expires in ${Math.max(0, Math.ceil((quote.expires - now) / 1000))} seconds.`}
          </p>
        </Modal>
      )}
    </section>
  );
}
