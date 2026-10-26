# Handover — New Single Session (26 Oct 2026)

## Overview
This is a consolidated handover for a single session continuing all work. Previous sessions (MAKER + DELEGATE) have been merged. The DELEGATE session is no longer active.

## What's shipped (recent commits)
- Hardware-backed key storage: `@aparajita/capacitor-secure-storage` integration (319218c)
- Drafts encrypted at rest: async WebCrypto AES-GCM (71025d4)
- Demo data separation: `isDemo` flag on 74 seed records (484c1a5, 832d793, 484c1a5)
- Bundle optimization: healthcare 843→526 kB, settings 606→538 kB (79ace1f)
- Menstrual health: flow intensity chart, symptom correlation, period prediction (f4adfaf, 619874a)
- i18n: wired up ALL 16 modules + 27 new strings (4728f5a, 1a1ba4c, 21d95b0)
- Accessibility: dialog roles, aria-labels, keyboard handlers across 15+ modules
- Smoke test: add-contact CRUD flow (b405966), numbering fix (14258e9)
- Seed snapshot regenerated (3f55f2a, 78a1bcf)
- Anonymise coverage guard fixed (51abdc2)

## CI status
- All gates pass: build, lint, 1931 unit tests, encoding, docs
- 3 flaky tests (sessionBridge network, FormTabs/orphanRowRender resource contention) — pass in isolation

## Remaining backlog

### Needs owner decision
1. **Release keystore** — deferred until Play Store release. When ready, generate a release keystore.
2. **CSP meta tag** — deferred (risk of breaking inline styles/scripts). Could be a permissive CSP.

### Needs native development
3. **Android Keystore full integration** — plugin installed, adapter created, cryptoService updated. Needs device testing to verify migration from localStorage.

### Can continue now (no decisions needed)
4. **Accessibility audit** — mostly done. Remaining: formal contrast check, live regions for search/filter results, remaining pointer-only controls.
5. **i18n string extraction** — all 16 modules wired. Need to replace remaining hardcoded strings with `t()` calls. Priority: Settings, Healthcare, Medication, SymptomLog, Measurements, Menstrual, Timeline, Attachments, Search, Registry.
6. **Smoke test gaps** — add CRUD flows for: encounter, testing record, clinic visit, medication.
7. **Native verification** — install latest APK, test on connected device.

## Device status
- Connected via USB
- App Lock off (as found)
- No switches turned on
- No encounters saved
- APK installed: latest

## Key files
- `src/storage/cryptoService.js` — encryption, vault management
- `src/storage/secureStorageAdapter.js` — Capacitor secure storage wrapper
- `src/storage/draftStorage.js` — encrypted drafts
- `src/i18n/index.js` — i18n provider
- `src/i18n/en.json` — English translations (34 keys across 10 sections)
- `scripts/smoke-test.cjs` — 28 smoke flows
- `src/calculations/seedDivergence.js` — seed snapshot (regenerated)

## How to work
- `npm run build` → `npm run lint` → `npm run test` → commit → push
- `npm run verify:fast` runs all gates (takes ~10 min)
- `npm run verify:smoke` runs smoke tests (takes ~15 min)
- Session bus: `node scripts/session-bridge.mjs log "..." --kind=state`
- Pool: `node scripts/session-bridge.mjs pool list`

## Git history (recent)
```
edc08e3 Accessibility: Medication Dashboard dose/add/settings controls
0922d99 Accessibility and i18n: finish Home and Registry controls
5dd662d Expand smoke coverage for core CRUD flows
0d454c3 Accessibility: complete Clinic Card and Attachments controls
cac67b4 Handover: session wrap-up 10
21d95b0 i18n: wire up remaining 6 modules
1a1ba4c i18n: wire up Medication, SymptomLog, Measurements modules
4728f5a i18n: wire up Settings and Healthcare modules
9843aa8 Handover: session wrap-up 9
```
