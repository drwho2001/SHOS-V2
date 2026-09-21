# SHOS v2 — Alpha Implementation Plan

**Generated:** 21 Sep 2026  
**Base Commit:** dd5b9e2 (latest main)  
**Status:** Build passes, ESLint clean, 15/15 smoke tests pass

---

## Executive Summary

Most "backlog" items from the explore agent's categories are **already implemented** or **explicitly decided against**. The actual remaining work for an alpha release falls into 3 primary batches:

| Batch | Focus | Est. Complexity | Verification |
|-------|-------|-----------------|--------------|
| **1** | Accessibility — dialog semantics, contrast, live regions | Medium | Lint + smoke + axe-core |
| **2** | Desktop polish — measure-cap sweep (Resources/Onboarding/About) | Low | Lint + smoke + visual |
| **3** | Test infrastructure — unit/integration test foundation | Medium | Lint + new test runs |

Items requiring **physical device** (safe-area #68 other spots, cold-start notification race) are documented but deferred.

---

## Batch 1: Accessibility Remediation (High Priority)

### 1.1 Module-Level Sheets → `role="dialog"` + Focus-on-Open

**Scope:** ~45 full-screen overlay sheets across 15 module files currently use `position: fixed; inset: 0; overflowY: auto` with `tabIndex={0}` but lack `role="dialog"` and focus management.

**Files to Touch:**
```
src/modules/SHOS_Encounters_Prototype.jsx        (1 sheet)
src/modules/SHOS_Testing_Prototype.jsx           (1 sheet)
src/modules/SHOS_ClinicVisits_Prototype.jsx      (1 sheet)
src/modules/SHOS_Vaccinations_Prototype.jsx      (1 sheet)
src/modules/SHOS_SymptomLog_Prototype.jsx        (1 sheet)
src/modules/SHOS_Measurements_Prototype.jsx      (2 sheets)
src/modules/SHOS_Timeline_Prototype.jsx          (1 sheet)
src/modules/SHOS_ClinicCard_Prototype.jsx        (3 sheets)
src/modules/SHOS_Attachments_Prototype.jsx       (1 sheet)
src/modules/SHOS_Home_Prototype.jsx              (1 sheet)
src/modules/SHOS_Healthcare_Prototype.jsx        (1 sheet)
src/modules/SHOS_GlobalSearch_Prototype.jsx      (1 sheet - already role="region")
src/modules/SHOS_Contacts_Prototype.jsx          (5 sheets)
src/modules/SHOS_MyProfile_Prototype.jsx         (2 sheets)
src/modules/SHOS_Medication_Dashboard_Prototype.jsx (7 sheets)
src/modules/SHOS_MenstrualHealth_Prototype.jsx   (1 sheet)
src/modules/SHOS_RegistryManagement_Prototype.jsx (1 sheet)
src/modules/SHOS_PartnerNotification_Prototype.jsx (1 sheet)
src/modules/SHOS_OptionListEditor_Prototype.jsx  (2 sheets)
src/modules/SHOS_Settings_Prototype.jsx          (20+ sub-screens - already role="region" on root)
```

**Pattern (additive, per CLAUDE.md #82):**
```jsx
// Before
<div tabIndex={0} style={{ position: "fixed", inset: 0, ... }}>

// After
<div role="dialog" aria-label="<descriptive title>" tabIndex={0} 
     style={{ position: "fixed", inset: 0, ... }}
     onKeyDown={handleKeyDown}
     ref={dialogRef}>
```

**Focus-on-Open:** Add `useEffect(() => { dialogRef.current?.focus(); }, [])` on mount.

**Verification:** `axe-core` scan on each sheet; manual Tab/Enter navigation.

---

### 1.2 Contrast Violations Fix

**Identified Violations:**
| Component | Current | Issue | Fix |
|-----------|---------|-------|-----|
| Guide tour button (`SHOS_Settings_Prototype.jsx:3644`) | `background: ACCENTS.home` (`#008585`) on white | 2.1:1 on white | Use `ACTION.teal` (darker variant) or white text on `ACCENTS.home` with verified 4.5:1 |
| Meds Dashboard locked-dose button (`SHOS_Medication_Dashboard_Prototype.jsx:507`) | `opacity: 0.9` on outline button | Text contrast drops below 4.5:1 | Use `ACTION_TEXT_SAFE.medication` for text color when locked, or disable button with `aria-disabled` |

**Files:**
- `src/modules/SHOS_Settings_Prototype.jsx` (Guide screen tour button)
- `src/modules/SHOS_Medication_Dashboard_Prototype.jsx` (MedicationCard locked state)
- Full `axe-core` re-scan to catch others TBD

**Verification:** Computed contrast via `getComputedStyle` in Playwright; `axe-core` color-contrast rule.

---

### 1.3 Live-Region Announcements for Search/Filter

**Scope:** Search/filter result counts change silently. Need `aria-live="polite"` regions.

**Locations:**
- `SHOS_GlobalSearch_Prototype.jsx` — result count
- `SHOS_Contacts_Prototype.jsx` — filter/sort results
- `SHOS_Encounters_Prototype.jsx` — search/filter
- `SHOS_Testing_Prototype.jsx` — search/filter
- `SHOS_ClinicVisits_Prototype.jsx` — search/filter
- `SHOS_Vaccinations_Prototype.jsx` — search/filter
- `SHOS_Measurements_Prototype.jsx` — search/filter
- `SHOS_SymptomLog_Prototype.jsx` — search/filter
- `SHOS_Medication_Dashboard_Prototype.jsx` — search/filter
- `SHOS_Settings_Prototype.jsx` — Resources search, Notification history filter

**Pattern:**
```jsx
<div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
  {resultCount} results found
</div>
```

**Verification:** Screen reader (NVDA/VoiceOver) announces count changes; `axe-core` live-region check.

---

### 1.4 Heading Hierarchy Audit (Post-Commit ea80572)

**Status:** 31 sub-screen titles converted to `<h1>` in ea80572. Remaining gaps:
- Module landing screens (Home, Healthcare, Medication, Encounters, Contacts) — have `<h1>` via `TYPE.screenTitle`
- Detail/edit sheets — need `<h1>` for record titles (some have, some don't)
- Settings sub-screens — done

**Action:** Targeted sweep for sheets missing `<h1>` (mainly detail views).

---

**Batch 1 Verification:**
```bash
npm run build && npx eslint . && npm run dev -- --port 5183 &
node scripts/smoke-test.cjs
# Plus: run axe-core scan script against all 15 smoke test states
```

---

## Batch 2: Desktop Polish — Measure-Cap Sweep (#93 Follow-up)

### 2.1 Scope
Apply the same desktop-only measure-cap pattern (`isDesktopWidth ? {maxWidth: 640, margin: "0 auto"} : {}`) used for Guide/Glossary to:
- **Resources screen** (`SHOS_Settings_Prototype.jsx` ~line 1222)
- **Onboarding screen** (`SHOS_Home_Prototype.jsx` / `App.jsx` OnboardingScreen)
- **About screen** (`SHOS_Settings_Prototype.jsx` ~line 3759)

**Files:**
- `src/modules/SHOS_Settings_Prototype.jsx` (Resources, About)
- `src/App.jsx` or `src/modules/SHOS_Home_Prototype.jsx` (Onboarding)

**Pattern (additive only, mobile untouched):**
```jsx
const isDesktop = useIsDesktopWidth(); // from src/calculations/responsive.js
<div style={isDesktop ? { maxWidth: 640, margin: "0 auto", padding: 16 } : { padding: 16 }}>
  {/* existing content */}
</div>
```

**Verification:** Visual comparison at 390px (mobile) vs 1600px (desktop); smoke test passes.

---

## Batch 3: Test Infrastructure Foundation

### 3.1 Unit/Integration Test Setup

**Goal:** Add `vitest` for pure-logic testing (calculations, repositories, utilities) alongside existing Playwright smoke tests.

**Files to Create:**
```
vitest.config.js
src/calculations/__tests__/dateInputHelpers.test.js
src/calculations/__tests__/medicationCalculations.test.js
src/calculations/__tests__/testingCalculations.test.js
src/repositories/__tests__/contactRepository.test.js
src/storage/__tests__/storageAdapter.test.js
```

**CI Integration:** Add `npm run test:unit` to `.github/workflows/smoke-test.yml` (runs before Playwright).

**Verification:** `npm run test:unit` passes; CI green.

---

## Explicitly Deferred (With Reasoning)

| Item | Reason |
|------|--------|
| **#68 Safe-area/status-bar other spots** | Requires physical notch device; sandboxed env resolves `env()` to 0px — cannot verify |
| **Cold-start notification-action race** | Upstream Capacitor limitation; documented in CLAUDE.md; no JS fix possible |
| **Android Keystore-backed device key** | Owner decided 9 Sep 2026: stay with IndexedDB non-extractable key (trade-off documented) |
| **Registry-entry merge / per-value icons / schema editor** | Deliberate scope cuts per CLAUDE.md "avoid over-normalisation" |
| **Other desktop-empty-space complaints** | Out of scope per #93 judgment call #4 unless separately reported |
| **PIN-recovery UI** | **Already implemented** (Settings + AppLockScreen) — smoke test 13 covers it |
| **KDF iteration count** | **Already set**: 100k (PIN), 250k (recovery) in `cryptoService.js` |
| **ErrorBoundary decrypt** | **Already implemented** — dynamic import in `main.jsx:153` |
| **draftStorage.js scope** | **Already decided** — uses `sessionStorage` (cleared on session end) |
| **Phase 4 positive check** | **Already in smoke test 8** — verifies raw `localStorage` is ciphertext |

---

## Dependencies Between Batches

```
Batch 1 (Accessibility) ──────► Can run independently
       │
       ▼
Batch 2 (Desktop Polish) ─────► Requires Batch 1's useIsDesktopWidth() hook (already exists)
       │
       ▼
Batch 3 (Test Infra) ─────────► Independent; can run in parallel with 1-2
```

---

## Commit / Push Protocol (Per CLAUDE.md)

For **each batch** (or logical sub-batch within Batch 1):
1. `npm run build` — catches syntax errors
2. `npx eslint .` — must pass clean
3. `npm run dev -- --port <free>` + `node scripts/smoke-test.cjs` — 15/15 flows pass
4. `git commit -m "..."` with attribution footer:
   ```
   Co-Authored-By: <model> <noreply@anthropic.com>
   Claude-Session: <this session URL>
   ```
5. `git push -u origin main`
6. Verify CI: Smoke Test + Build APK + Web Alpha all green on pushed commit

---

## Estimated Effort

| Batch | Files Touched | Est. Hours | Risk |
|-------|---------------|------------|------|
| 1.1 Dialog semantics | ~20 module files | 4-6 | Medium (focus management edge cases) |
| 1.2 Contrast fixes | 2-3 files | 1-2 | Low |
| 1.3 Live regions | ~10 files | 2-3 | Low |
| 1.4 Heading audit | ~5 files | 1 | Low |
| **Batch 1 Total** | **~35 files** | **8-12** | **Medium** |
| Batch 2 Desktop | 3 files | 1-2 | Low |
| Batch 3 Test Infra | 6 new files + config | 3-4 | Low |

**Total: ~12-18 hours of focused work for alpha-ready accessibility + polish.**

---

## Alpha Release Criteria

- [ ] All 15 smoke tests pass on `main`
- [ ] `axe-core` zero violations on critical paths (dialog, contrast, live-region, headings)
- [ ] Desktop viewports (1600px) render without horizontal overflow or empty-space complaints on targeted screens
- [ ] Unit test suite runs in CI (`npm run test:unit`)
- [ ] CI green: Smoke Test + Build APK + Web Alpha workflows
- [ ] CLAUDE.md "Known issues" updated with current status
- [ ] Notion Development log appended with dated entry