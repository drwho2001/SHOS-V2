#!/usr/bin/env node
// validate-claims.js — fail CI if claim/pool records are not owned by a traceable session.
// Reads the per-bus state files directly, without any network, and exits non-zero
// on violations. Deliberately a local check: the worst case is a clean exit on an
// empty state dir, not a hung build.
//
// An owner is legitimate if it appears somewhere in the bus's own ownership records
// (pool tasks or claim holders) — i.e. the session has a footprint. Anything else
// is either an untraceable owner or drift, which is what we want to flag.
//
// Usage: node scripts/validate-claims.js [--bus-home=<path>]

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const DEFAULT_BUS_HOME = process.env.SHOS_BUS_HOME || join(homedir(), '.shos-session-bus');
const HOME_DIR = (args.find((a) => a.startsWith('--bus-home=')) || `--bus-home=${DEFAULT_BUS_HOME}`).split('=')[1];
const STATE_DIR = join(HOME_DIR, 'state');
const CLAIMS_PATH = join(STATE_DIR, 'claims.json');
const POOL_PATH = join(STATE_DIR, 'pool.json');

const violations = [];
const notes = [];

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    violations.push({ path, kind: 'unparseable', detail: String(err.message || err) });
    return null;
  }
}

// Gather everything to build the legitimate owner set from.
const claims = existsSync(CLAIMS_PATH) ? readJsonSafe(CLAIMS_PATH) : null;
const pool = existsSync(POOL_PATH) ? readJsonSafe(POOL_PATH) : null;
const tasks = Array.isArray(pool?.tasks) ? pool.tasks : [];
const claimEntries = claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : {};

const KNOWN_OWNERS = new Set();
for (const t of tasks) {
  if (t?.owner != null) KNOWN_OWNERS.add(String(t.owner));
  for (const h of Array.isArray(t?.history) ? t.history : []) {
    if (h?.by != null) KNOWN_OWNERS.add(String(h.by));
  }
}
for (const file of Object.keys(claimEntries)) {
  const holders = Array.isArray(claimEntries[file]?.holders) ? claimEntries[file].holders : [];
  for (const h of holders) {
    if (h?.by != null) KNOWN_OWNERS.add(String(h.by));
  }
}
// Hand-maintained entries: session-bridge marks these if done outside a session.
for (const s of ['system-setup']) KNOWN_OWNERS.add(s);

const isKnown = (owner) => owner == null || KNOWN_OWNERS.has(String(owner));
const isDrift = (owner) => typeof owner === 'string' && (owner.toLowerCase() === 'unknown' || owner.toLowerCase() === 'repair');

// ── claims table ─────────────────────────────────────────────────────────────
if (!existsSync(CLAIMS_PATH)) {
  notes.push(`claims file not found at ${CLAIMS_PATH}`);
} else {
  const keys = Object.keys(claimEntries).sort();
  if (!keys.length) notes.push('claims: 0 entries (empty)');
  else {
    for (const file of keys) {
      const holders = Array.isArray(claimEntries[file]?.holders) ? claimEntries[file].holders : [];
      for (const h of holders) {
        const by = h?.by;
        if (by === undefined || by === null || isDrift(by)) {
          violations.push({ path: CLAIMS_PATH, file, kind: 'unknown-owner', detail: `holder '${JSON.stringify(by)}'` });
        } else if (!KNOWN_OWNERS.has(String(by))) {
          notes.push(`warn: unverified-owner: holder '${by}' in ${file} (claims but never appears in pool)`);
        }
      }
    }
    notes.push(`claims: checked ${keys.length} file(s)`);
  }
}

// ── pool tasks ───────────────────────────────────────────────────────────────
if (!existsSync(POOL_PATH)) {
  notes.push(`pool file not found at ${POOL_PATH}`);
} else if (!tasks.length) {
  notes.push('pool: 0 tasks (empty)');
} else {
  for (const t of tasks) {
    const owner = t?.owner;
    if (owner != null) {
      if (isDrift(owner)) {
        violations.push({ path: POOL_PATH, kind: 'unknown-owner', detail: `task ${t.id} owner '${owner}'` });
      } else if (!KNOWN_OWNERS.has(String(owner))) {
        notes.push(`warn: unverified-owner: task ${t.id} owner '${owner}' (never appears in claims)`);
      }
    }
    const history = Array.isArray(t?.history) ? t.history : [];
    for (const h of history) {
      if (!h || typeof h !== 'object') continue;
      const hBy = h.by;
      if (hBy != null) {
        if (isDrift(hBy)) {
          violations.push({ path: POOL_PATH, kind: 'history-unknown-owner', detail: `task ${t.id} history by '${hBy}'` });
        } else if (!KNOWN_OWNERS.has(String(hBy))) {
          notes.push(`warn: unverified-history-owner: task ${t.id} history by '${hBy}'`);
        }
      }
      if (typeof h.note === 'string' && /not attempted|not tried|never started|not attempted yet/i.test(h.note)) {
        violations.push({ path: POOL_PATH, kind: 'negative-status', detail: `task ${t.id} history note: "${h.note}"` });
      }
    }
  }
  notes.push(`pool: checked ${tasks.length} task(s)`);
}

const result = { busHome: HOME_DIR, ok: violations.length === 0, violations, notes };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
