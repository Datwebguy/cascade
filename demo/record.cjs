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
const GAP = 200; // ms of breathing room after each line

const IDEA = "We just shipped Cascade for #BufferCommit: write one idea, get a post made for each network, ready in Buffer.";
const IMAGE = process.env.DEMO_IMAGE || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1600";

const OVERLAY = `
  window.__ov = (chip, caption) => {
    let root = document.getElementById("__ov");
    if (!root) {
      root = document.createElement("div");
      root.id = "__ov";
      root.innerHTML = '<div id="__chip"><i></i><span></span></div><div id="__cap"></div>';
      const st = document.createElement("style");
      st.textContent = \`
        #__ov{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Inter,system-ui,sans-serif}
        #__chip{position:absolute;top:18px;right:22px;display:flex;align-items:center;gap:10px;background:#fff;color:#12132a;padding:9px 16px 9px 12px;border-radius:999px;font-size:17px;font-weight:600;border:1px solid #e4e3f0;box-shadow:0 10px 30px -12px rgba(40,30,120,.35);opacity:0;transform:translateY(-6px);transition:opacity .3s,transform .3s}
        #__chip.on{opacity:1;transform:none}
        #__chip i{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#8b7cff,#3ee6d8);flex:none}
        #__cap{position:absolute;left:28px;bottom:28px;max-width:62%;background:#fff;color:#12132a;padding:14px 20px 14px 22px;border-radius:16px;font-size:23px;line-height:1.4;font-weight:500;border:1px solid #e4e3f0;box-shadow:0 18px 40px -16px rgba(40,30,120,.35);opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}
        #__cap.on{opacity:1;transform:none}
        #__cap:before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:4px;background:linear-gradient(#8b7cff,#3ee6d8)}
      \`;
      document.documentElement.appendChild(st);
      document.documentElement.appendChild(root);
    }
    const c = document.getElementById("__chip"), p = document.getElementById("__cap");
    c.querySelector("span").textContent = chip || ""; c.classList.toggle("on", !!chip);
    p.textContent = caption || ""; p.classList.toggle("on", !!caption);
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
  const cuts = [];
  let cutMs = 0;
  let current = null;
  // Run a slow wait; the edit keeps a short glimpse of it and removes the rest.
  const cut = async (fn) => {
    const a = Date.now();
    await fn();
    const b = Date.now();
    if (b - a > 1400) {
      cuts.push([(a - t0) / 1000 + 0.6, (b - t0) / 1000 - 0.3]);
      cutMs += b - a - 900;
    }
  };
  const say = async (id, action, after) => {
    const s = seg[id];
    current = [s.chip, s.text];
    const start = Date.now();
    timeline.push({ id, t: (start - t0) / 1000 });
    await page.evaluate(([chip, text]) => { window.__lastOv = [chip, text]; window.__ov && window.__ov(chip, text); }, current).catch(() => {});
    const cutBefore = cutMs;
    if (action) await action();
    // Only time that survives the edit counts toward the line's length.
    const left = durations[id] * 1000 + GAP - (Date.now() - start - (cutMs - cutBefore));
    if (left > 0) await sleep(left);
    if (after) await after();
  };
  // Re-apply the caption after navigations.
  page.on("load", () => current && page.evaluate((c) => { window.__lastOv = c; window.__ov && window.__ov(...c); }, current).catch(() => {}));
  await run(page, say, cut);
  await page.evaluate(() => window.__ov && window.__ov("", "")).catch(() => {});
  await sleep(600);
  const video = page.video();
  await ctx.close();
  await browser.close();
  const file = path.join(outDir, `${name}.webm`);
  fs.renameSync(await video.path(), file);
  return { name, file, timeline, cuts };
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
  parts.push(await card("answer", ["s01"], 300));
  parts.push(await card("hook", ["s02", "s03"], 300));
  parts.push(await card("uses", ["s04"], 300));

  parts.push(
    await record("app", { width: W, height: H }, async (page, say, cut) => {
      await page.goto(baseUrl + "/");
      await page.waitForLoadState("networkidle").catch(() => {});
      await say("s05", async () => {
        await page.hover("text=Connect your Buffer account");
        await sleep(1000);
        await cut(async () => {
          await page.goto(baseUrl + "/api/dev/login");
          await page.waitForSelector(".channel-row", { timeout: 30000 });
        });
      });
      await say(
        "s06",
        async () => {
          await page.click("#idea-text");
          await page.keyboard.type(IDEA, { delay: 6 });
          await page.evaluate(() => document.querySelector(".dropzone")?.scrollIntoView({ block: "center", behavior: "smooth" }));
          await sleep(350);
          await page.locator(".dropzone .btn").hover().catch(() => {});
          await sleep(500);
          const toLink = page.locator("text=Or paste a link instead");
          if (await toLink.isVisible().catch(() => false)) await toLink.click();
          await page.click("#media-url");
          await page.keyboard.type(IMAGE, { delay: 3 });
        },
        () => cut(() => page.waitForSelector(".media-status.ok", { timeout: 30000 })),
      );
      await say(
        "s07",
        async () => {
          // Show the attached image while the voice moves on.
          await page.evaluate(() => document.querySelector(".media-preview")?.scrollIntoView({ block: "center", behavior: "smooth" }));
          await sleep(1300);
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          await sleep(350);
          const rows = page.locator('.channel-row:not([data-disabled="true"])');
          const n = await rows.count();
          for (let i = 0; i < n; i++) {
            await rows.nth(i).click();
            await sleep(150);
          }
          await page.click(".actionbar .btn.primary");
        },
        async () => {
          await cut(() => page.waitForSelector(".post", { timeout: 90000 }));
          await sleep(300);
        },
      );
      await say("s08", async () => {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await page.locator(".post .who").nth(1).hover().catch(() => {});
        await sleep(2200);
        await page.locator(".post .who").first().hover().catch(() => {});
      });
      await say("s09", async () => {
        await page.locator(".post .post-body").first().click();
        await page.keyboard.press("End");
        await sleep(600);
        await page.locator('.post button[role=radio]:has-text("Pick a time")').first().click();
        await sleep(1300);
        await page.click('.review-head button[role=radio]:has-text("Draft")');
      });
      await say(
        "s10",
        () => page.click(".actionbar .btn.primary"),
        () => cut(() => page.waitForSelector(".results", { timeout: 60000 })),
      );
      await say("s10b", async () => {
        await page.locator(".status-link").first().hover().catch(() => {});
        await sleep(2200);
        await page.evaluate(() => document.querySelector(".what-next")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      });
      await sleep(1000);
    }),
  );

  parts.push(await card("outro", ["s11"], 900));
  fs.writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(parts.map(({ name, file, timeline, cuts }) => ({ name, file, timeline, cuts })), null, 1));
  console.log(JSON.stringify(parts.map((p) => ({ name: p.name, lines: p.timeline.length })), null, 0));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
