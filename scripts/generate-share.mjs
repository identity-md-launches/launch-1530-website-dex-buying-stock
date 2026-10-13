import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    await readFile(new URL("../src/assets/share.svg", import.meta.url), "utf8"),
  );
  await page.addStyleTag({
    content:
      "html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden}svg{display:block}",
  });
  await page.screenshot({
    path: new URL("../public/share.png", import.meta.url).pathname,
  });
} finally {
  await browser.close();
}
