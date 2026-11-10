# Handover — 10 Nov 2026

**Supersedes:** `docs/NEXT-SESSION.md` (26 Oct 2026), which is stale: it claims
"i18n: all 16 modules wired" with 34 keys, and cannot reflect the REPAIR batch or
the recent verification sessions. Nothing in that older file was deleted; it is a
point-in-time handover from another session and should not be edited from here.

**Working tree:** clean of this session's edits — everything I changed is committed.
`BACKLOG.md` and `CLAUDE.md` have local modifications that are **not this session's
work** and were left untouched.

## What's shipped (recent, this session chain)

| Commit | Change |
|---|---|
| `cc895d3` | *(prior session)* Usage-ordered registry pickers, derived "No barrier method", measured sheet-tab offsets |
| `d5b4053` | Testing: pending result regains recent vs older distinction |
| `c22b6a4` | Testing: double-tap guard + Saving state in edit sheet |
| `33ec22f` | i18n: `common.saving` |
| `52c76e9` | Testing: "No result recorded yet" state for past-dated pending tests, `testing.noResultRecorded` |
| `3240fdd` | New `storageKeyDrift.test.js` — pins USAGE_KEYS vs every registry storageKey |
| `5d0eb77` | Encounters: double-tap guard + Saving state |
| `5da898c` | ClinicVisits: same fix (hardcoded "Save" → `"Saving…"`) |
| `5256edd` | Measurements: save-button double-tap guard |
| `fa7fd2a` | MenstrualHealth: shared SaveButton double-tap guard |
| `7e544e4` | ClinicVisits: list rows inherit red state from linked positive tests (fixes mockup item #4) |
| `9d28b84` | New `simpleRegistry.test.js` — CRUD roundtrip smoke for the shared registry factory |
| `b146da9` | Backup: `parseBackupFile` rejects non-object `data`; new `backupService.test.js` roundtrip test |
| `93eaa0f` | i18n: 38 referenced-but-missing keys added to `en.json`; new `translationKeyCoverage.test.js` guard |
| `0f25c97` | New `docs/RELEASE-DECISIONS.md` — sign-off blockers for a real release |

`REDACTED_FIXES_PLAN.md` (untracked, mine) tracks the encounter red-state fixes;
it now reads as complete.

## What's verified

- `npm run build` → green at 829–1207 MB free RAM
- `npx eslint .` → 0 errors (2 pre-existing `encountersList` warnings)
- Targeted suites → 28+ passing (registryUsage, protectionBarrier, storageKeyDrift,
  simpleRegistry, translationKeyCoverage, backupService)
- Full `verify:fast` has **not** been re-run since the REPAIR batch; ~17 min and
  ~1 GB minimum headroom. Eight unit-test failures on the REPAIR batch's baseline
  are pre-existing and unrelated.

## Remaining roadmap

1. **Release decisions (owner sign-off):** `docs/RELEASE-DECISIONS.md` — release
   keystore (release builds currently sign with the *debug* key), CSP for the PWA,
   Android `versionName`/`versionCode` vs `package.json` semver.
2. **Chunk reduction:** `healthcare` manual chunk ≈ 547 kB (includes pdf-lib +
   fontkit); `settings` manual chunk ≈ 607 kB (includes React internal runtime +
   settings/file tree). Neither is a drop-in cleanup — needs a real split plan,
   measure-before/measure-after, and a visual pass. Not done deliberately.
3. **Full verify:fast** run to confirm no regressions at scale.
4. **Device matrix / real-phone checks** — unchanged backlog, see
   `docs/DEVICE-TESTING.md`.
5. **`BACKLOG.md`** now carries an entry on STI-test episode grouping captured
   during a `healthcare-sti-test-card.html` review (not this session's work).

## Hard constraints discovered this session

- **RAM.** The builder dies with 0xC0000409 (esbuild out-of-memory) under ~400 MB
  free. It passes at ≥ ~750 MB. Check `Win32_OperatingSystem.FreePhysicalMemory`
  before builds on this machine.
- **Idled `verify:fast` is long** (~17 min); plan around it.
- **The build pipeline passes on free RAM**; do not `npm run build` under memory
  pressure without noting it first.
- **Do not edit** `BACKLOG.md` or `CLAUDE.md` from this session; both carry other
  sessions' local modifications.
