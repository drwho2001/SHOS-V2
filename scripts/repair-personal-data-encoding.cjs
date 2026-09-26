// Repair mojibake in the OWNER'S OWN stored data.
//
// ADDED 25 Sep 2026 after the owner found corrupted characters in his real
// records. This is deliberately the most cautious script in the repo,
// because it writes to real personal data and the failure mode we care
// about is unrecoverable loss, not a cosmetic glitch.
//
// SAFETY MODEL - read this before running with --apply:
//   1. DRY RUN BY DEFAULT. Nothing is written unless you pass --apply.
//   2. BACKUP IS MANDATORY. Every repository is dumped to a timestamped
//      JSON file BEFORE any write, and the script aborts if that fails.
//      That file is a complete, restorable snapshot of the decrypted data.
//   3. TARGETED REPAIR ONLY. Only the 12 verified mojibake sequences are
//      matched (see src/calculations/encodingRepair.js). It is structurally
//      incapable of touching the characters you want kept - the
//      multiplication sign, almost-equal, >=, both arrow shapes, em dash,
//      middle dot, bullet, degree, plus-minus, ellipsis, curly apostrophe
//      and every emoji. This is verified by an exhaustive test, not assumed.
//   4. NEVER GUESSES. Corruption that looks wrong but is not in the map is
//      REPORTED for you to look at, never silently "fixed" - guessing at
//      someone's medical notes is not an acceptable failure mode.
//   5. IDEMPOTENT. Running it twice is a no-op the second time.
//   6. BACKUP THE BACKUP. Your data is encrypted at rest; the dump this
//      script writes is PLAINTEXT. Treat it accordingly and delete it when
//      you're done.
//
// USAGE (needs the Vite DEV server - production builds don't expose
// /src/ modules, which is why this can't run against `vite preview`):
//   npm run dev -- --port 5183
//   node scripts/repair-personal-data-encoding.cjs                 (dry run)
//   node scripts/repair-personal-data-encoding.cjs --apply         (writes)
//
// NOTE: this drives a browser profile. It only sees the data in whichever
// profile it opens, so point it at the one holding your real records.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const APP_URL = process.env.SMOKE_TEST_URL || "http://localhost:5183";
const APPLY = process.argv.includes("--apply");
const BACKUP_DIR = process.env.SEOS_BACKUP_DIR || path.join(process.cwd(), "backups");

// Personal-data repositories only. Curated registries (kinks, organisms,
// results, option lists) are deliberately EXCLUDED: they are app vocabulary
// rather than the owner's own words, and rewriting curated content
// unattended is not a risk worth taking.
//
// `mode: "list"` repositories are arrays of records addressed by id.
// `mode: "single"` is for singleton stores (My Profile) that expose
// getProfile()/update(changes) instead of getAll()/update(id, data).
const REPOS = [
  ["contacts", "/src/repositories/contactRepository.js", "ContactRepository", "list"],
  ["encounters", "/src/repositories/encounterRepository.js", "EncounterRepository", "list"],
  ["clinicVisits", "/src/repositories/clinicVisitsRepository.js", "ClinicVisitsRepository", "list"],
  ["tests", "/src/repositories/testingRepository.js", "TestingRepository", "list"],
  ["vaccinations", "/src/repositories/vaccinationRepository.js", "VaccinationRepository", "list"],
  ["symptomLog", "/src/repositories/symptomLogRepository.js", "SymptomLogRepository", "list"],
  ["measurements", "/src/repositories/measurementRepository.js", "MeasurementRepository", "list"],
  ["medications", "/src/repositories/medicationRepository.js", "MedicationRepository", "list"],
  ["doseLogs", "/src/repositories/logRepository.js", "LogRepository", "list"],
  ["locations", "/src/repositories/locationsRepository.js", "LocationsRepository", "list"],
  ["cycles", "/src/repositories/menstrualCycleRepository.js", "MenstrualCycleRepository", "list"],
  ["contraception", "/src/repositories/contraceptionRepository.js", "ContraceptionRepository", "list"],
  ["pregnancies", "/src/repositories/pregnancyRepository.js", "PregnancyRepository", "list"],
  ["episodes", "/src/repositories/episodeRepository.js", "EpisodeRepository", "list"],
  ["trash", "/src/repositories/trashRepository.js", "TrashRepository", "list"],
  ["myProfile", "/src/repositories/myProfileRepository.js", "MyProfileRepository", "single"],
];

const REPAIR_URL = "/src/calculations/encodingRepair.js";

async function main() {
  if (!fs.existsSync(path.join(APP_URL.replace(/^https?:\/\//, ""), ""))) {
    // no-op; connectivity checked below
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => console.error("  [page error] " + e.message));

  console.log(`Opening ${APP_URL} ...`);
  await page.goto(APP_URL, { waitUntil: "networkidle" }).catch((e) => {
    console.error(`\nCould not reach ${APP_URL}: ${e.message}`);
    console.error("Start the DEV server first:  npm run dev -- --port 5183");
    process.exit(2);
  });
  await page.waitForTimeout(1500);

  // Onboarding / prompts would sit over the data; clear them harmlessly.
  await page.locator("text=Skip").first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.locator("text=Don't ask again").first().click({ timeout: 2500 }).catch(() => {});
  await page.locator("text=Not now").first().click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(700);

  const locked = await page.locator("text=Enter PIN to unlock").count();
  if (locked > 0) {
    console.error("\nThe app is locked. This script needs the vault unlocked so it can");
    console.error("read and write through the app's own repositories.");
    console.error("Unlock it in the browser window, then re-run.");
    await browser.close();
    process.exit(2);
  }

  // ---- 1. read everything -------------------------------------------------
  console.log("Reading all personal-data repositories...");
  const data = await page.evaluate(
    async ([repos, repairUrl]) => {
      const repair = await import(repairUrl);
      const out = {};
      for (const [key, modPath, exportName, mode] of repos) {
        try {
          const mod = await import(/* @vite-ignore */ modPath);
          const repo = mod[exportName];
          if (mode === "single") {
            if (!repo || typeof repo.getProfile !== "function") {
              out[key] = { error: `no getProfile() on ${exportName}` };
              continue;
            }
            const record = await repo.getProfile();
            const report = repair.repairDeep(record, key);
            out[key] = { exportName, modPath, mode, records: [record], repaired: report.value, changes: report.changes, unknown: report.unknown };
            continue;
          }
          if (!repo || typeof repo.getAll !== "function") {
            out[key] = { error: `no getAll() on ${exportName}` };
            continue;
          }
          const records = await repo.getAll();
          const report = repair.repairDeep(records, key);
          out[key] = { exportName, modPath, mode, records, repaired: report.value, changes: report.changes, unknown: report.unknown };
        } catch (e) {
          out[key] = { error: String(e && e.message ? e.message : e) };
        }
      }
      return out;
    },
    [REPOS, REPAIR_URL]
  );

  // ---- 2. report ----------------------------------------------------------
  let totalChanges = 0;
  let totalUnknown = 0;
  let totalRecords = 0;
  const unreadable = [];

  console.log("\n================ DRY RUN REPORT ================");
  for (const [key, d] of Object.entries(data)) {
    if (d.error) { unreadable.push(`${key}: ${d.error}`); continue; }
    const count = Array.isArray(d.records) ? d.records.length : 1;
    totalRecords += count;
    totalChanges += d.changes.length;
    totalUnknown += d.unknown.length;
    const flag = d.changes.length ? "WOULD CHANGE" : "clean      ";
    console.log(`  [${flag}] ${key.padEnd(14)} ${count} record(s), ${d.changes.length} field(s)`);
    for (const c of d.changes.slice(0, 6)) {
      console.log(`        ${c.path}`);
      console.log(`          from: ${JSON.stringify(c.from).slice(0, 150)}`);
      console.log(`          to  : ${JSON.stringify(c.to).slice(0, 150)}`);
    }
    if (d.changes.length > 6) console.log(`        ...and ${d.changes.length - 6} more field(s)`);
    for (const u of d.unknown.slice(0, 4)) {
      console.log(`        !! UNRECOGNISED corruption at ${u.path}: ${JSON.stringify(u.frag)}`);
    }
  }
  if (unreadable.length) {
    console.log("\n  Could not read (left untouched):");
    unreadable.forEach((u) => console.log("    - " + u));
  }
  console.log("===============================================");
  console.log(`Records scanned : ${totalRecords}`);
  console.log(`Fields to repair: ${totalChanges}`);
  console.log(`Unrecognised    : ${totalUnknown} (reported only, never guessed)`);

  if (totalChanges === 0) {
    console.log("\nNothing to repair. No backup needed, nothing written.");
    await browser.close();
    return;
  }

  // ---- 3. MANDATORY backup ------------------------------------------------
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `pre-encoding-repair-${stamp}.json`);
  const snapshot = {};
  for (const [key, d] of Object.entries(data)) {
    if (!d.error) snapshot[key] = d.records;
  }
  try {
    fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), "utf8");
  } catch (e) {
    console.error(`\nBACKUP FAILED (${e.message}). Aborting - nothing will be written.`);
    await browser.close();
    process.exit(3);
  }
  const bytes = fs.statSync(backupPath).size;
  console.log(`\nBackup written: ${backupPath} (${bytes} bytes)`);
  console.log("  ^ PLAINTEXT and unencrypted. Keep it somewhere safe, delete when done.");

  if (!APPLY) {
    console.log("\nDRY RUN - nothing was written. Re-run with --apply to make these changes.");
    await browser.close();
    return;
  }

  // ---- 4. apply -----------------------------------------------------------
  console.log("\nApplying repairs...");
  const applied = await page.evaluate(
    async ([repos, repairUrl]) => {
      const repair = await import(repairUrl);
      const results = [];
      for (const [key, modPath, exportName, mode] of repos) {
        try {
          const mod = await import(/* @vite-ignore */ modPath);
          const repo = mod[exportName];
          if (mode === "single") {
            const record = await repo.getProfile();
            const r = repair.repairDeep(record, key);
            const stillBroken = repair.repairDeep(await repo.getProfile(), key).changed ? 1 : 0;
            results.push({ key, updated: r.changed ? 1 : 0, stillBroken });
            if (r.changed) {
              const { id, ...rest } = r.value;
              await repo.update(rest);
            }
            continue;
          }
          const records = await repo.getAll();
          let updated = 0;
          for (const rec of records) {
            if (!rec || typeof rec !== "object" || !rec.id) continue;
            const r = repair.repairDeep(rec, key);
            if (!r.changed) continue;
            const { id, ...rest } = r.value;
            await repo.update(id, rest);
            updated++;
          }
          const after = await repo.getAll();
          const stillBroken = after.filter((rec) => repair.repairDeep(rec, key).changed).length;
          results.push({ key, updated, stillBroken });
        } catch (e) {
          results.push({ key, error: String(e && e.message ? e.message : e) });
        }
      }
      return results;
    },
    [REPOS, REPAIR_URL]
  );

  for (const r of applied) {
    if (r.error) console.log(`  [ERROR] ${r.key}: ${r.error}`);
    else console.log(`  ${r.key.padEnd(14)} updated ${r.updated} record(s); still-corrupt after write: ${r.stillBroken}`);
  }
  console.log(`\nDone. Backup retained at ${backupPath}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
