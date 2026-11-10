#!/usr/bin/env node
// check-heartbeat.js — fail CI if a session hasn't refreshed its heartbeat in N minutes.
// Local only: reads the per-session file and returns a non-zero code if stale or absent.
//
// Usage: node scripts/check-heartbeat.js <session-id> [--age-minutes=N]
//   (default: 5 minutes)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BUS_HOME = process.env.SHOS_BUS_HOME || join(homedir(), '.shos-session-bus');
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const ageFlag = args.find((a) => a.startsWith('--age-minutes='));
const ageMinutes = ageFlag ? Number(ageFlag.split('=')[1]) : 5;
const sessionId = positional[0];

if (!sessionId || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(sessionId)) {
  console.error('Usage: check-heartbeat.js <session-id> [--age-minutes=N]');
  process.exit(2);
}
if (!Number.isFinite(ageMinutes) || ageMinutes <= 0) {
  console.error('--age-minutes must be a positive number');
  process.exit(2);
}

const path = join(BUS_HOME, sessionId, 'state', 'heartbeat.json');
if (!existsSync(path)) {
  console.error(`no heartbeat found for ${sessionId} at ${path}`);
  process.exit(1);
}
let data;
try {
  data = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  console.error(`heartbeat for ${sessionId} is not valid JSON: ${e.message}`);
  process.exit(1);
}
if (typeof data?.timestamp !== 'string' || !data.timestamp) {
  console.error(`heartbeat for ${sessionId} has no timestamp`);
  process.exit(1);
}
const ts = Date.parse(data.timestamp);
if (!Number.isFinite(ts)) {
  console.error(`heartbeat for ${sessionId} has an invalid timestamp`);
  process.exit(1);
}
const ageSec = (Date.now() - ts) / 1000;
if (ageSec > ageMinutes * 60) {
  console.error(`heartbeat for ${sessionId} is ${Math.round(ageSec)}s old (limit ${ageMinutes * 60}s)`);
  process.exit(1);
}
console.log(`heartbeat for ${sessionId} OK (${Math.round(ageSec)}s ago)`);
process.exit(0);
