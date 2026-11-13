// Captures README screenshots from a local run against a real Buffer account.
// Usage: node demo/screenshots.cjs <baseUrl> <outDir>
const { chromium } = require("playwright");
const [base = "http://localhost:3000", out = "docs/screenshots"] = process.argv.slice(2);
const IDEA = "We just shipped scheduled exports: your weekly report now lands in your team's inbox every Monday at 9. No more manual downloads. #productupdate";
const IMAGE = "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1600";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(base + "/"); await p.waitForLoadState("networkidle"); await sleep(2600);
  await p.screenshot({ path: `${out}/landing.png` });
  await p.goto(base + "/api/dev/login"); await p.waitForSelector(".channel-row");
  await p.fill("#idea-text", IDEA);
  const toLink = p.locator("text=Or paste a link instead");
  if (await toLink.isVisible().catch(() => false)) await toLink.click();
  await p.fill("#media-url", IMAGE);
  await p.waitForSelector(".media-status.ok", { timeout: 30000 });
  const rows = p.locator('.channel-row:not([data-disabled="true"])');
  for (let i = 0; i < (await rows.count()); i++) await rows.nth(i).click();
  await p.evaluate(() => window.scrollTo(0, 0)); await sleep(500);
  await p.screenshot({ path: `${out}/compose.png` });
  await p.click(".actionbar .btn.primary");
  await p.waitForSelector(".overlay-card"); await sleep(900);
  await p.screenshot({ path: `${out}/writing.png` });
  await p.waitForSelector(".post", { timeout: 90000 }); await sleep(1200);
  await p.locator('.post button[role=radio]:has-text("Pick a time")').nth(1).click(); await sleep(400);
  await p.click('.review-head button[role=radio]:has-text("Draft")'); await sleep(500);
  await p.screenshot({ path: `${out}/review.png` });
  await p.click(".actionbar .btn.primary");
  await p.waitForSelector(".results", { timeout: 60000 }); await sleep(1500);
  await p.screenshot({ path: `${out}/sent.png` });
  // phone view of the review screen
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(base + "/"); await mp.waitForLoadState("networkidle"); await sleep(2200);
  await mp.screenshot({ path: `${out}/mobile.png` });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
