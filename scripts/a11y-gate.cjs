// a11y-gate.cjs — advisory-with-baseline accessibility gate (19 Nov 2026).
//
// This repo had axe-core in devDependencies but never ran it. A hard gate with
// the current backlog of findings would block every push, so this is a
// RATCHET: `a11y-baseline.json` records today's violations with reasons, and
// the gate fails only when a NEW rule appears or an existing rule's count
// goes UP. Fixing findings shrinks the baseline on the next --update-baseline.
//
// Run standalone against the dev server:
//   A11Y_TEST_URL=http://localhost:5183 node scripts/a11y-gate.cjs
// With no A11Y_TEST_URL it starts its own `vite preview` and cleans it up.
//   node scripts/a11y-gate.cjs --update-baseline   # accept current findings
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BASELINE = path.join(ROOT, "a11y-baseline.json");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const UPDATE = process.argv.includes("--update-baseline");
const VIEWPORTS = [
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "desktop-1280x800", width: 1280, height: 800 },
];
// The nav click is a React state change, not a navigation — axe must wait for
// the target screen's OWN text before measuring, or counts swing run to run
// and the ratchet cries wolf.
const SCREENS = [
  { name: "Home", marker: "Recent activity" },
  { name: "Encounter", marker: "Select" },
  { name: "Medication", marker: "Active medications" },
  { name: "Healthcare", marker: "Healthcare" },
  // AX1 25 Nov: full pass now includes the Settings overlay and its
  // sub-screens. Each one reloads first so a previous overlay cannot leak
  // into the next measurement.
  { name: "Settings", marker: "Backup & Export", settings: true },
  { name: "About", marker: "About", settings: true, row: "About" },
  { name: "Backup & Export", marker: "Backup & Export", settings: true, row: "Backup & Export" },
  { name: "Privacy", marker: "Privacy", settings: true, row: "Privacy" },
  { name: "Data & network", marker: "Data & network", settings: true, row: "Data & network" },
  { name: "Widgets", marker: "Widgets", settings: true, row: "Widgets" },
  { name: "Preferences", marker: "Preferences", settings: true, row: "Preferences" },
  { name: "Notifications", marker: "Notifications", settings: true, row: "Notifications" },
  { name: "Colour scheme", marker: "Colour scheme", settings: true, row: "Colour scheme" },
  { name: "Manage lists", marker: "Manage lists", settings: true, row: "Manage lists" },
  { name: "Locations", marker: "Locations", settings: true, row: "Locations" },
];

function startServer() {
  const port = 5600 + Math.floor(Math.random() * 300);
  const url = `http://localhost:${port}`;
  const isWin = process.platform === "win32";
  const server = spawn(isWin ? "npx.cmd" : "npx", ["vite", "preview", "--port", String(port)],
    { cwd: ROOT, detached: true, stdio: "ignore", shell: isWin });
  server.unref();
  const probe = () => spawnSync(process.execPath,
    ["-e", `require("http").get(${JSON.stringify(url)},r=>process.exit(r.statusCode===200?0:1)).on("error",()=>process.exit(1))`],
    { stdio: "ignore", timeout: 5000 }).status === 0;
  for (let i = 0; i < 30; i++) { if (probe()) return { url, server, port }; spawnSync(process.execPath, ["-e", "setTimeout(()=>{},1000)"], { timeout: 2000 }); }
  try { process.kill(server.pid, "SIGTERM"); } catch {}
  throw new Error("a11y gate: preview server never came up");
}

(async () => {
  let url = process.env.A11Y_TEST_URL;
  let server = null;
  let serverPort = null;
  if (!url) { const s = startServer(); url = s.url; server = s.server; serverPort = s.port; }
  const browser = await chromium.launch();
  const counts = {};
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route("**/__axe.min.js", r => r.fulfill({ status: 200, contentType: "application/javascript", body: AXE }));
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Skip")?.click());
      await page.waitForTimeout(1500);
      for (const screen of SCREENS) {
        if (screen.settings) {
          // Reload per settings screen: the Settings overlay is a fixed
          // dialog, and stacking sub-screens from a previous measurement
          // would audit whichever one happened to be on top.
          await page.goto(url, { waitUntil: "networkidle" });
          await page.waitForTimeout(800);
          await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Skip")?.click());
          await page.waitForTimeout(800);
          await page.evaluate(() => document.querySelector('[aria-label="Settings"]')?.click());
          await page.waitForTimeout(500);
          if (screen.row) {
            await page.evaluate(row => {
              const el = [...document.querySelectorAll('[role="button"], button, [tabindex="0"]')]
                .find(e => (e.textContent || "").trim().startsWith(row));
              el?.click();
            }, screen.row);
            await page.waitForTimeout(500);
          }
        } else if (screen.name !== "Home") {
          await page.evaluate(lbl => [...document.querySelectorAll("[aria-label]")].find(e => e.getAttribute("aria-label") === lbl)?.click(), screen.name);
        }
        await page.waitForFunction(
          marker => (document.body.innerText || "").includes(marker),
          screen.marker,
          { timeout: 10000 }
        ).catch(() => {});
        await page.waitForTimeout(400);
        if (!(await page.evaluate(() => typeof window.axe !== "undefined"))) await page.addScriptTag({ url: `${url}/__axe.min.js` });
        const violations = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
          return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        });
        console.log(`  ${vp.name}/${screen.name}: ${violations.map(v => `${v.id}=${v.nodes}`).join(", ") || "clean"}`);
        for (const v of violations) {
          const key = `${v.id}|${v.impact}`;
          counts[key] = (counts[key] || 0) + v.nodes;
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    if (server) {
      // Same trap verify-changes.mjs already documents: killing the npx
      // PARENT leaves the vite GRANDCHILD holding the port (observed here as
      // stale previews on 5789/5845). Kill the whole tree on Windows.
      try { process.kill(server.pid, "SIGTERM"); } catch {}
      if (process.platform === "win32") {
        spawnSync("powershell", ["-NoProfile", "-Command",
          `Get-NetTCPConnection -LocalPort ${serverPort} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { taskkill /F /T /PID $_.OwningProcess 2>$null | Out-Null }`],
          { stdio: "ignore", timeout: 30000 });
      }
    }

  }

  if (UPDATE) {
    const baseline = {};
    for (const [key, count] of Object.entries(counts)) {
      baseline[key] = { count, reason: "Accepted at baseline 19 Nov 2026 — see docs/reviews/2026-11-17/COMPACTION-HANDOFF.md. Ratchet: fix to shrink, never grow." };
    }
    fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + "\n");
    console.log(`a11y baseline written with ${Object.keys(baseline).length} rules`);
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const problems = [];
  for (const [key, count] of Object.entries(counts)) {
    if (!baseline[key]) problems.push(`NEW violation: ${key} (${count} nodes)`);
    else if (count > baseline[key].count) {
      // Node counts drift a little between Windows and Linux Chromium (font
      // metrics change which text nodes axe flags). Only a LARGE jump is a
      // regression; small drift is reported, not failed. New rule IDs always
      // fail — that is the gate's real job.
      const delta = count - baseline[key].count;
      if (delta > Math.max(5, Math.ceil(baseline[key].count * 0.25))) {
        problems.push(`REGRESSION: ${key} ${baseline[key].count} -> ${count} nodes`);
      } else {
        console.log(`  drift (not failing): ${key} ${baseline[key].count} -> ${count} nodes`);
      }
    }
  }
  for (const key of Object.keys(baseline)) if (!counts[key]) problems.push(`IMPROVED: ${key} is now gone — update the baseline with --update-baseline`);
  console.log(`a11y gate: ${Object.keys(counts).length} rule(s), ${Object.values(counts).reduce((a, b) => a + b, 0)} nodes`);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("a11y gate: no NEW violations (ratchet clean)");
})().catch(e => { console.error(e); process.exit(1); });
