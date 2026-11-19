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
  for (let i = 0; i < 30; i++) { if (probe()) return { url, server }; spawnSync(process.execPath, ["-e", "setTimeout(()=>{},1000)"], { timeout: 2000 }); }
  try { process.kill(server.pid, "SIGTERM"); } catch {}
  throw new Error("a11y gate: preview server never came up");
}

(async () => {
  let url = process.env.A11Y_TEST_URL;
  let server = null;
  if (!url) { const s = startServer(); url = s.url; server = s.server; }
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
        if (screen.name !== "Home") {
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
    if (server) { try { process.kill(server.pid, "SIGTERM"); } catch {} }
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
    else if (count > baseline[key].count) problems.push(`REGRESSION: ${key} ${baseline[key].count} -> ${count} nodes`);
  }
  for (const key of Object.keys(baseline)) if (!counts[key]) problems.push(`IMPROVED: ${key} is now gone — update the baseline with --update-baseline`);
  console.log(`a11y gate: ${Object.keys(counts).length} rule(s), ${Object.values(counts).reduce((a, b) => a + b, 0)} nodes`);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("a11y gate: no NEW violations (ratchet clean)");
})().catch(e => { console.error(e); process.exit(1); });
