#!/usr/bin/env node
// fix-claims-attribution.mjs — retroactively attribute "unknown"/"REPAIR" claims
// to "retroactive" (done by this agent on 10 Nov 2026). All pool tasks are already
// marked "done"; only the attribution was missing. Adds a history entry to each
// pool task noting the retroactive fix.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BUS = process.env.SHOS_BUS_HOME || join(homedir(), '.shos-session-bus');
const STATE = join(BUS, 'state');
const CLAIMS_PATH = join(STATE, 'claims.json');
const POOL_PATH = join(STATE, 'pool.json');

const claims = JSON.parse(readFileSync(CLAIMS_PATH, 'utf8'));
const pool = JSON.parse(readFileSync(POOL_PATH, 'utf8'));

let claimsFixed = 0;
let poolOwnersFixed = 0;
let poolHistoryFixed = 0;
let historyEntriesAdded = 0;

// Fix claims.json holders
for (const file of Object.keys(claims)) {
  const holders = claims[file].holders || [];
  for (const h of holders) {
    if (h.by === 'unknown' || h.by === 'REPAIR') {
      h.by = 'retroactive';
      h.via = 'retroactive-attribution';
      claimsFixed++;
    }
  }
}

// Fix pool.json tasks
const now = new Date().toISOString();
for (const t of pool.tasks) {
  // Fix owner
  if (t.owner === 'unknown' || t.owner === 'REPAIR') {
    t.owner = 'retroactive';
    poolOwnersFixed++;
  }
  // Fix history entries
  const history = t.history || [];
  let fixedAny = false;
  for (const h of history) {
    if (h.by === 'unknown' || h.by === 'REPAIR') {
      h.by = 'retroactive';
      poolHistoryFixed++;
      fixedAny = true;
    }
  }
  // Add a history entry noting the retroactive attribution (only once)
  const alreadyNoted = history.some((h) => h.to === 'retroactive-attribution');
  if (fixedAny && !alreadyNoted) {
    history.push({
      at: now,
      by: 'retroactive',
      to: 'retroactive-attribution',
      note: 'Owner attribution fixed retroactively on 10 Nov 2026 — original session ID was not recorded.',
    });
    historyEntriesAdded++;
  }
}

writeFileSync(CLAIMS_PATH, JSON.stringify(claims, null, 2), 'utf8');
writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2), 'utf8');

console.log(`Claims holders fixed: ${claimsFixed}`);
console.log(`Pool owners fixed: ${poolOwnersFixed}`);
console.log(`Pool history entries fixed: ${poolHistoryFixed}`);
console.log(`History entries added: ${historyEntriesAdded}`);
console.log('Done. Run validate-claims.js to verify.');
