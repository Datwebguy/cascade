// Records the Cascade demo: title cards plus a real run of the app against a real Buffer account.
// Usage: node demo/record.cjs <outDir> <ttsDir> <baseUrl>
// Each narration line is shown as a caption while its on-screen action runs; start times are
// written to timeline.json so the voice-over can be placed exactly.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const [outDir, ttsDir, baseUrl = "http://localhost:3000"] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, "narration.json"), "utf8"));
const durations = JSON.parse(fs.readFileSync(path.join(ttsDir, "durations.json"), "utf8"));
const seg = Object.fromEntries(spec.segments.map((s) => [s.id, s]));
const W = 1600, H = 900;
const GAP = 450; // ms of breathing room after each line

const IDEA =
  "We just shipped Cascade for #BufferCommit. Write one idea and get a post that fits every channel, ready in Buffer. " +
  "Your words stay yours: no hashtags or emojis you didn't write. Try it: https://oncascade.vercel.app";
const IMAGE = process.env.DEMO_IMAGE || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1600";

const OVERLAY = `
  window.__ov = (chip, caption) => {
    let root = document.getElementById("__ov");
    if (!root) {
      root = document.createElement("div");
      root.id = "__ov";
      root.innerHTML = '<div id="__chip"></div><div id="__cap"></div>';
      const st = document.createElement("style");
      st.textContent = \`
        #__ov{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Inter,system-ui,sans-serif}
        #__chip{position:absolute;top:22px;left:22px;background:rgba(11,12,26,.88);color:#fff;padding:9px 16px;border-radius:10px;font-size:18px;font-weight:600;opacity:0;transition:opacity .3s}
        #__chip:before{content:"— ";color:#3ee6d8}
        #__cap{position:absolute;bottom:34px;left:50%;transform:translateX(-50%);max-width:74%;background:rgba(11,12,26,.88);color:#fff;padding:12px 22px;border-radius:12px;font-size:24px;line-height:1.35;text-align:center;opacity:0;transition:opacity .25s}
      \`;
      document.documentElement.appendChild(st);
      document.documentElement.appendChild(root);
    }
    const c = document.getElementById("__chip"), p = document.getElementById("__cap");
    c.textContent = chip || ""; c.style.opacity = chip ? 1 : 0;
    p.textContent = caption || ""; p.style.opacity = caption ? 1 : 0;
  };
  if (window.__lastOv) window.addEventListener("DOMContentLoaded", () => window.__ov(...window.__lastOv));
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(name, viewport, run) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, recordVideo: { dir: outDir, size: viewport } });
  await ctx.addInitScript(OVERLAY);
  if (viewport.width === W) {
    // Larger UI so the app reads well at video size.
    await ctx.addInitScript(() => {
      const st = document.createElement("style");
      st.textContent = "body{zoom:1.2}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
    });
  }
  const page = await ctx.newPage();
  const t0 = Date.now();
  const timeline = [];
  let current = null;
  const say = async (id, action) => {
    const s = seg[id];
    current = [s.chip, s.text];
    const start = Date.now();
    timeline.push({ id, t: (start - t0) / 1000 });
    await page.evaluate(([chip, text]) => { window.__lastOv = [chip, text]; window.__ov && window.__ov(chip, text); }, current).catch(() => {});
    if (action) await action();
    const left = durations[id] * 1000 + GAP - (Date.now() - start);
    if (left > 0) await sleep(left);
  };
  // Re-apply the caption after navigations.
  page.on("load", () => current && page.evaluate((c) => { window.__lastOv = c; window.__ov && window.__ov(...c); }, current).catch(() => {}));
  await run(page, say);
  await page.evaluate(() => window.__ov && window.__ov("", "")).catch(() => {});
  await sleep(600);
  const video = page.video();
  await ctx.close();
  await browser.close();
  const file = path.join(outDir, `${name}.webm`);
  fs.renameSync(await video.path(), file);
  return { name, file, timeline };
}

async function card(name, ids, holdAfter = 800) {
  return record(name, { width: 1920, height: 1080 }, async (page, say) => {
    await page.goto(`file://${path.join(__dirname, "cards.html")}?card=${name}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(500);
    for (const id of ids) await say(id);
    await sleep(holdAfter);
  });
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const parts = [];
  parts.push(await card("intro", ["s01"]));
  parts.push(await card("problem", ["s02", "s03"], 400));

  parts.push(
    await record("app", { width: W, height: H }, async (page, say) => {
      await page.goto(baseUrl + "/");
      await sleep(1200);
      await say("s04", async () => {
        await page.hover("text=Connect your Buffer account");
        await sleep(1300);
        await page.goto(baseUrl + "/api/dev/login");
        await page.waitForSelector(".channel-row", { timeout: 30000 });
      });
      await say("s05", async () => {
        await page.click("#idea-text");
        await page.keyboard.type(IDEA, { delay: 14 });
      });
      await say("s06", async () => {
        const toLink = page.locator("text=Or paste a link instead");
        if (await toLink.isVisible().catch(() => false)) {
          await page.locator(".dropzone").hover().catch(() => {});
          await sleep(900);
          await toLink.click();
        }
        await page.fill("#media-url", IMAGE);
        await page.waitForSelector(".media-status.ok", { timeout: 30000 });
        await page.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }));
      });
      await say("s07", async () => {
        const rows = page.locator('.channel-row:not([data-disabled="true"])');
        const n = await rows.count();
        for (let i = 0; i < n; i++) {
          await rows.nth(i).click();
          await sleep(250);
        }
      });
      await say("s08", async () => {
        await page.click(".actionbar .btn.primary");
        await page.waitForSelector(".post", { timeout: 90000 });
        await sleep(800);
      });
      await say("s09", async () => {
        await page.locator(".meter").first().hover();
      });
      await say("s10", async () => {
        await page.evaluate(() => window.scrollBy({ top: 260, behavior: "smooth" }));
      });
      await say("s11", async () => {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await sleep(400);
        const rewrite = page.locator(".post .post-head button").first();
        await rewrite.click();
        await page.waitForFunction(() => !document.querySelector(".post-head button[disabled]"), null, { timeout: 60000 }).catch(() => {});
      });
      await say("s12", async () => {
        await page.click('.review-head button[role=radio]:has-text("Draft")');
        await sleep(600);
        await page.locator('.post button[role=radio]:has-text("Pick a time")').first().click();
        await sleep(1400);
        await page.locator('.post button[role=radio]:has-text("Draft")').first().click();
      });
      await say("s13", async () => {
        await page.click(".actionbar .btn.primary");
        await page.waitForSelector(".results", { timeout: 60000 });
      });
      await say("s14", async () => {
        await page.locator(".result").first().hover().catch(() => {});
      });
      await sleep(600);
    }),
  );

  parts.push(await card("outro", ["s15"], 1400));
  fs.writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(parts.map(({ name, file, timeline }) => ({ name, file, timeline })), null, 1));
  console.log(JSON.stringify(parts.map((p) => ({ name: p.name, lines: p.timeline.length })), null, 0));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
