// All wallet/RPC fixtures below are intercepted locally. No transaction reaches a network.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import {
  decodeFunctionData,
  encodeFunctionResult,
  encodeEventTopics,
  encodeAbiParameters,
  erc20Abi,
  parseUnits,
} from "viem";
import { dexAbi } from "../src/lib/dex-abi.ts";
import { stocks } from "../src/lib/stocks.ts";

const DEX = "0xf66c6c7a09e741843d4ede8795ac4267e3823037";
const IMD = "0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7";
// Reuse the supplied contract as an isolated mock account; there is no private key.
const ACCOUNT = DEX;
const HASH = "0x" + "ab".repeat(32);
const BLOCK_HASH = "0x" + "cd".repeat(32);
const snapshot = JSON.parse(
  await readFile(new URL("../src/lib/price-snapshot.json", import.meta.url)),
);
let browser, server, base;
const issues = [];
before(async () => {
  server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const local = resolve(
      "dist",
      pathname.replace(/^\/preview\//, "") || "index.html",
    );
    if (
      !pathname.startsWith("/preview/") ||
      !local.startsWith(resolve("dist") + "/")
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const body = await readFile(local);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".woff2": "font/woff2",
        }[extname(local)] || "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}/preview/`;
  browser = await (
    process.env.TEST_BROWSER === "webkit" ? webkit : chromium
  ).launch({ headless: true });
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
  assert.deepEqual(issues, [], "No uncaught browser errors");
});
async function setup({
  wallet = false,
  wrongChain = false,
  reject = false,
  paused = false,
  allowance = false,
  failPrices = false,
  failRpc = false,
  width = 1440,
  height = 1000,
  reverted = false,
  noEvent = false,
  quoteError = false,
} = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on("pageerror", (e) => issues.push(e.message));
  const state = { approved: allowance, transactions: [], quoteRequests: 0 };
  if (wallet)
    await page.addInitScript(
      ({ ACCOUNT, HASH, wrongChain, reject }) => {
        window.__walletTest = {
          chain: wrongChain ? "0x89" : "0x1",
          txs: [],
          listeners: {},
          reject,
        };
        const m = window.__walletTest;
        const provider = {
          on(name, handler) {
            (m.listeners[name] ||= []).push(handler);
          },
          removeListener(name, handler) {
            m.listeners[name] = (m.listeners[name] || []).filter(
              (h) => h !== handler,
            );
          },
          async request({ method, params }) {
            if (method === "eth_requestAccounts" && m.reject)
              throw { code: 4001, message: "User rejected connection" };
            if (method === "eth_requestAccounts" || method === "eth_accounts")
              return [ACCOUNT];
            if (method === "eth_chainId") return m.chain;
            if (method === "wallet_switchEthereumChain") {
              if (m.reject)
                throw { code: 4001, message: "User rejected network change" };
              m.chain = params[0].chainId;
              (m.listeners.chainChanged || []).forEach((h) => h(m.chain));
              return null;
            }
            if (method === "eth_sendTransaction") {
              if (m.reject)
                throw { code: 4001, message: "User rejected transaction" };
              m.txs.push(params[0]);
              return HASH;
            }
            throw new Error(`Unexpected wallet method ${method}`);
          },
        };
        window.ethereum = provider;
        window.addEventListener("eip6963:requestProvider", () =>
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: {
                  uuid: "test-wallet",
                  name: "Test wallet",
                  rdns: "test.wallet",
                },
                provider,
              },
            }),
          ),
        );
      },
      { ACCOUNT, HASH, wrongChain, reject },
    );
  await page.route("https://api.dexscreener.com/**", async (route) => {
    if (failPrices) return route.abort("failed");
    const pairs = Object.entries(snapshot.quotes).map(([address, q]) => ({
      chainId: "ethereum",
      baseToken: { address },
      priceUsd: String(q.price),
      priceChange: { h24: q.change },
      volume: { h24: q.volume },
      liquidity: { usd: q.liquidity },
      pairAddress: q.pairAddress,
    }));
    await route.fulfill({ json: pairs });
  });
  await page.route("https://ethereum-rpc.publicnode.com/**", async (route) => {
    if (failRpc) return route.abort("failed");
    const request = route.request().postDataJSON();
    const respond = async (body) => {
      const { method, params = [], id } = body;
      let result;
      if (method === "eth_blockNumber") result = "0x3e8";
      else if (method === "eth_chainId") result = "0x1";
      else if (method === "eth_call") {
        const call = params[0];
        const isDex = call.to.toLowerCase() === DEX.toLowerCase();
        const abi = isDex ? dexAbi : erc20Abi;
        const { functionName, args = [] } = decodeFunctionData({
          abi,
          data: call.data,
        });
        let value;
        if (functionName === "paused") value = paused;
        else if (functionName === "imd") value = IMD;
        else if (["router", "quoter", "creator"].includes(functionName))
          value = DEX;
        else if (functionName === "configVersion") value = 1n;
        else if (functionName === "FEE_BPS") value = 50n;
        else if (functionName === "market") value = ["0x1234", true];
        else if (functionName === "decimals") value = 18;
        else if (functionName === "symbol") value = "IMD";
        else if (functionName === "balanceOf") value = parseUnits("10000", 18);
        else if (functionName === "allowance") {
          const txs = await page.evaluate(() => window.__walletTest?.txs || []);
          state.approved ||= txs.some((tx) => tx.data.startsWith("0x095ea7b3"));
          value = state.approved ? parseUnits("10000", 18) : 0n;
        } else if (functionName === "quoteBuy") {
          state.quoteRequests++;
          if (quoteError)
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32000,
                message: "execution reverted: InsufficientLiquidity",
              },
            };
          const gross = args[1];
          const fee = gross / 200n;
          value = [
            parseUnits("2", 18),
            {
              swapAmount: gross - fee,
              fee,
              burnAmount: fee / 2n,
              creatorAmount: fee - fee / 2n,
            },
            1n,
          ];
        } else if (functionName === "buyStock") value = parseUnits("2", 18);
        else if (functionName === "approve") value = true;
        else throw new Error(`Unexpected contract method ${functionName}`);
        result = encodeFunctionResult({ abi, functionName, result: value });
      } else if (method === "eth_getTransactionReceipt") {
        const txs = await page.evaluate(() => window.__walletTest?.txs || []);
        const last = txs.at(-1);
        if (!last) result = null;
        else {
          state.transactions = txs;
          let logs = [];
          if (last.to.toLowerCase() === DEX.toLowerCase() && !noEvent) {
            const { args } = decodeFunctionData({
              abi: dexAbi,
              data: last.data,
            });
            logs = [
              {
                address: DEX,
                topics: encodeEventTopics({
                  abi: dexAbi,
                  eventName: "StockPurchased",
                  args: { buyer: ACCOUNT, stock: args[0] },
                }),
                data: encodeAbiParameters(
                  [
                    { type: "uint256" },
                    { type: "uint256" },
                    { type: "uint256" },
                    { type: "uint256" },
                    { type: "uint256" },
                    { type: "address" },
                    { type: "uint256" },
                  ],
                  [
                    args[1],
                    parseUnits("2", 18),
                    args[1] / 200n,
                    0n,
                    args[1] / 200n,
                    DEX,
                    1n,
                  ],
                ),
                blockHash: BLOCK_HASH,
                blockNumber: "0x3e8",
                transactionHash: HASH,
                transactionIndex: "0x0",
                logIndex: "0x0",
                removed: false,
              },
            ];
          }
          result = {
            blockHash: BLOCK_HASH,
            blockNumber: "0x3e8",
            cumulativeGasUsed: "0x5208",
            effectiveGasPrice: "0x1",
            from: ACCOUNT,
            gasUsed: "0x5208",
            logs,
            logsBloom: "0x" + "0".repeat(512),
            status: reverted ? "0x0" : "0x1",
            to: last.to,
            transactionHash: HASH,
            transactionIndex: "0x0",
            type: "0x2",
          };
        }
      } else throw new Error(`Unexpected RPC method ${method}`);
      return { jsonrpc: "2.0", id, result };
    };
    await route.fulfill({
      json: Array.isArray(request)
        ? await Promise.all(request.map(respond))
        : await respond(request),
    });
  });
  await page.goto(base);
  await page.getByRole("heading", { name: "Stocks, onchain." }).waitFor();
  await page.waitForFunction(
    () =>
      !document
        .querySelector("#trade")
        ?.textContent?.includes("Checking the DEX"),
  );
  return { page, context, state, close: () => context.close() };
}
async function connect(page) {
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Test wallet", exact: true }).click();
  await page
    .getByRole("button", { name: "Wallet connected", exact: true })
    .waitFor();
}
async function requestQuote(page, amount = "100") {
  await page.getByLabel("You pay").fill(amount);
  await page.getByRole("button", { name: "Get quote", exact: true }).click();
  await page.getByRole("heading", { name: "Review your purchase" }).waitFor();
}

test("all 50 supplied assets, static metadata and bundled assets are complete", async () => {
  assert.equal(stocks.length, 50);
  assert.equal(new Set(stocks.map((s) => s.address.toLowerCase())).size, 50);
  assert(
    stocks.every(
      (s, i) => s.rank === i + 1 && /^0x[0-9a-fA-F]{40}$/.test(s.address),
    ),
  );
  const html = await readFile("dist/index.html", "utf8");
  for (const value of [
    "<title>",
    'name="description"',
    'property="og:title"',
    'property="og:image"',
    'rel="icon"',
  ])
    assert(html.includes(value));
  assert(!/(?:src|href)="\/assets\//.test(html));
  const png = await readFile("dist/share.png");
  assert(png.length > 1000);
});
test("search, sector filter, sorting and pagination reach all 50 stocks", async () => {
  const { page, close } = await setup();
  assert.equal(await page.locator("tbody tr").count(), 10);
  await page.getByLabel("Search stocks", { exact: true }).fill("0xCabD955");
  await page
    .getByRole("button", { name: /Strategy \(MicroStrategy\) MSTRon/ })
    .waitFor();
  await page
    .getByLabel("Search stocks", { exact: true })
    .fill("does not exist");
  await page.getByRole("heading", { name: "No matching stocks" }).waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Filter by sector").selectOption("Energy");
  assert.equal(await page.locator("tbody tr").count(), 1);
  assert.match(await page.locator("tbody").innerText(), /Chevron/);
  await page.getByLabel("Filter by sector").selectOption("All sectors");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  assert.match(await page.locator("tbody").innerText(), /Pfizer/);
  await page.getByLabel("Stocks per page").selectOption("50");
  assert.equal(await page.locator("tbody tr").count(), 50);
  await page.getByRole("button", { name: "Asset", exact: true }).click();
  assert.match(await page.locator("tbody tr").first().innerText(), /Abbott/);
  await page.getByRole("button", { name: "Price", exact: true }).click();
  const values = await page
    .locator("tbody td.price-column>span:first-child")
    .allTextContents();
  const numeric = values
    .filter((x) => x.startsWith("$"))
    .map((x) => Number(x.replace(/[$,]/g, "")));
  assert.deepEqual(
    numeric,
    [...numeric].sort((a, b) => b - a),
  );
  await close();
});
test("watchlist persists locally and empty state has recovery", async () => {
  const { page, close } = await setup();
  await page
    .getByRole("button", { name: "Add Apple to watchlist", exact: true })
    .click();
  await page.reload();
  assert.equal(
    await page
      .getByRole("button", { name: "Remove Apple from watchlist", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .locator(".market-tabs")
    .getByRole("button", { name: /Watchlist/ })
    .click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "Remove Apple from watchlist", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Keep your favorites close" })
    .waitFor();
  await page.getByRole("button", { name: "Explore all stocks" }).click();
  assert.equal(await page.locator("tbody tr").count(), 10);
  await close();
});
test("stock picker, contract details and Escape focus return", async () => {
  const { page, close } = await setup();
  const trigger = page.getByRole("button", {
    name: "View AAPLon contract and details",
  });
  await trigger.click();
  assert.equal(
    await page.locator("dialog .full-address").textContent(),
    stocks[0].address,
  );
  assert(
    (
      await page
        .getByRole("link", { name: "View contract", exact: true })
        .getAttribute("href")
    ).includes(stocks[0].address),
  );
  await page.keyboard.press("Escape");
  assert(await trigger.evaluate((el) => el === document.activeElement));
  await page.locator(".stock-selector").click();
  await page.getByLabel("Search available stocks").fill("Lockheed");
  await page.locator(".picker-item").click();
  assert.match(
    await page.locator(".stock-selector").innerText(),
    /Lockheed Martin/,
  );
  await close();
});
test("390px first screen, reflow widths, enlarged text and accessible controls", async () => {
  const { page, close } = await setup({ width: 390, height: 844 });
  const action = await page.locator(".buy-action").boundingBox();
  assert(action.y + action.height < 844);
  for (const width of [320, 390, 590, 760, 900, 1100, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `No horizontal overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: "html{font-size:200%}" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "200% text enlargement reflows",
  );
  await close();
});
test("axe accessibility scan: page and wallet dialog", async () => {
  const { page, close } = await setup({ width: 390, height: 844 });
  let result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((x) => ({
      id: x.id,
      nodes: x.nodes.map((n) => n.target),
    })),
    [],
  );
  await page.locator(".buy-action").click();
  await page.getByRole("heading", { name: "No wallet detected" }).waitFor();
  result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((x) => ({
      id: x.id,
      nodes: x.nodes.map((n) => n.target),
    })),
    [],
  );
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(() => !!document.activeElement.closest("dialog")),
    );
  }
  await page.keyboard.press("Escape");
  assert(
    await page
      .locator(".buy-action")
      .evaluate((el) => el === document.activeElement),
  );
  await close();
});
test("price failure retains explicit snapshot and RPC failure blocks buying", async () => {
  const { page, close } = await setup({
    wallet: true,
    failPrices: true,
    failRpc: true,
  });
  await page
    .getByText("Price refresh unavailable. Showing the dated snapshot.")
    .waitFor();
  assert.match(await page.locator(".price-status").textContent(), /Snapshot/);
  await connect(page);
  assert(
    await page
      .getByRole("button", { name: "Trading unavailable", exact: true })
      .isDisabled(),
  );
  await page.getByText("DEX status unavailable.").waitFor();
  await close();
});
test("rejected connection, wrong-network switch and account change", async () => {
  const first = await setup({ wallet: true, reject: true });
  await first.page.locator(".buy-action").click();
  await first.page
    .getByRole("button", { name: "Test wallet", exact: true })
    .click();
  await first.page
    .locator("dialog")
    .getByText("Request declined in your wallet. You can try again.")
    .waitFor();
  await first.close();
  const { page, close } = await setup({ wallet: true, wrongChain: true });
  await connect(page);
  await page.evaluate(() => (window.__walletTest.reject = true));
  await page
    .getByRole("button", { name: "Switch to Ethereum", exact: true })
    .click();
  await page
    .locator("#trade-error")
    .getByText("Request declined in your wallet. You can try again.")
    .waitFor();
  await page.evaluate(() => (window.__walletTest.reject = false));
  await page
    .getByRole("button", { name: "Switch to Ethereum", exact: true })
    .click();
  await page.getByRole("button", { name: "Get quote", exact: true }).waitFor();
  await requestQuote(page);
  await page.evaluate(() =>
    window.__walletTest.listeners.accountsChanged.forEach((h) => h([])),
  );
  await page.waitForFunction(() => !document.querySelector("dialog"));
  assert.equal(await page.locator(".buy-action").innerText(), "Connect wallet");
  await close();
});
test("paused contract, amount validation and insufficient funds", async () => {
  const first = await setup({ wallet: true, paused: true });
  await connect(first.page);
  assert(
    await first.page
      .getByRole("button", { name: "Trading paused", exact: true })
      .isDisabled(),
  );
  await first.close();
  const { page, close } = await setup({ wallet: true });
  await connect(page);
  for (const amount of ["0", "-1", "1e3", "1.0000000000000000001", "bad"]) {
    await page.getByLabel("You pay").fill(amount);
    await page.getByRole("button", { name: "Get quote", exact: true }).click();
    assert.equal(
      await page.getByLabel("You pay").getAttribute("aria-invalid"),
      "true",
    );
    assert(
      await page
        .getByLabel("You pay")
        .evaluate((el) => el === document.activeElement),
    );
  }
  await page.getByLabel("You pay").fill("10001");
  await page.getByRole("button", { name: "Get quote", exact: true }).click();
  await page
    .getByText(
      "Insufficient IMD balance. Enter a smaller amount or add IMD to your wallet.",
    )
    .waitFor();
  await close();
});
test("exact allowance approval, fresh quote, confirmed purchase and decoded parameters", async () => {
  const { page, close, state } = await setup({ wallet: true });
  await connect(page);
  await requestQuote(page);
  assert.match(await page.locator("dialog").innerText(), /1.99 AAPLon/);
  await page
    .getByRole("button", { name: "Approve IMD amount", exact: true })
    .click();
  await page
    .getByText(
      "IMD allowance confirmed. Get a fresh quote to complete your purchase.",
    )
    .waitFor();
  const approval = decodeFunctionData({
    abi: erc20Abi,
    data: state.transactions[0].data,
  });
  assert.equal(approval.functionName, "approve");
  assert.equal(approval.args[0].toLowerCase(), DEX);
  assert.equal(approval.args[1], parseUnits("100", 18));
  await requestQuote(page);
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await page
    .getByText(
      "AAPLon purchase confirmed on Ethereum. The tokens were sent to your wallet.",
    )
    .waitFor();
  const purchase = decodeFunctionData({
    abi: dexAbi,
    data: state.transactions.at(-1).data,
  });
  assert.equal(purchase.functionName, "buyStock");
  assert.equal(purchase.args[0].toLowerCase(), stocks[0].address.toLowerCase());
  assert.equal(purchase.args[1], parseUnits("100", 18));
  assert.equal(purchase.args[2], parseUnits("1.99", 18));
  assert.equal(purchase.args[4], 1n);
  assert(purchase.args[3] > BigInt(Math.floor(Date.now() / 1000)));
  assert.equal(state.quoteRequests, 2);
  await close();
});
test("expired quotes, reverted receipts, missing purchase event and rejected signature", async () => {
  const expired = await setup({ wallet: true, allowance: true });
  await connect(expired.page);
  await expired.page.clock.install();
  await requestQuote(expired.page);
  await expired.page.clock.fastForward(61_000);
  assert(
    await expired.page
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .isDisabled(),
  );
  await expired.close();
  for (const options of [{ reverted: true }, { noEvent: true }]) {
    const t = await setup({ wallet: true, allowance: true, ...options });
    await connect(t.page);
    await requestQuote(t.page);
    await t.page
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click();
    await t.page
      .getByText(
        "The transaction reverted or was replaced without completing this action. Check Etherscan. Network fees may apply.",
      )
      .waitFor();
    assert(
      !(await t.page
        .getByText(
          "AAPLon purchase confirmed on Ethereum. The tokens were sent to your wallet.",
        )
        .count()),
    );
    await t.close();
  }
  const t = await setup({ wallet: true, allowance: true });
  await connect(t.page);
  await requestQuote(t.page);
  await t.page.evaluate(() => (window.__walletTest.reject = true));
  await t.page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await t.page
    .locator("dialog")
    .getByText("Request declined in your wallet. You can try again.")
    .waitFor();
  await t.close();
});
test("quote failure is actionable and sends no transaction", async () => {
  const { page, close } = await setup({ wallet: true, quoteError: true });
  await connect(page);
  await page.getByLabel("You pay").fill("100");
  await page.getByRole("button", { name: "Get quote", exact: true }).click();
  await page
    .getByText(
      "There is not enough liquidity for this amount. Try a smaller amount.",
    )
    .waitFor();
  assert.equal(await page.evaluate(() => window.__walletTest.txs.length), 0);
  await close();
});
