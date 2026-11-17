# SHOS-V2 — Plan & Backlog (canonical, kept current)

> **For other sessions:** This is the single source of truth for what needs doing.
> Read this first. Update it when you complete or add items.
> Companion: `BACKLOG.md` (detailed item descriptions), `AUDITS.md` (findings log),
> `audit-tracker.json` (screen coverage + toggle status).

## Current state (refreshed 17 Nov 2026)
- **Live beta audit done:** full fresh-install walkthrough of every screen, form and toggle
  (dark + light), with screenshots. Reports + ranked fixes: `docs/reviews/2026-11-17/`
  (start with `BETA-ACTION-PLAN.md` R1–R13 and `AXES-BRAINSTORM.md`).
- **Shipped this round:** "No barrier method" canonical label + search/filter (R13);
  update-banner dismiss fix + APK link removed (R1); biometric toggle gated on web.
  See `docs/HISTORY.md`, 17 Nov entries.
- **Owner decisions recorded (not built):** D1=B remove+migrate vaginal health; D2=B
  snapshot-on-clear demo restore; D3 urine+serum hCG; FSRH = cluster, menopause build,
  pregnancy tests owned by Testing. See `BACKLOG.md` "17 Nov 2026".
- **Verification (17 Nov, local):** 38 targeted unit tests pass, eslint clean on changed
  files, `vite build` success. A full `npm run verify --fast` run did not complete on this
  machine (300s timeout); CI remains the gate. Check `git status` for the current
  uncommitted set rather than trusting a number here.
- The batches below are the older 11–13 Nov working plan; items already shipped are
  recorded in `docs/HISTORY.md`. Treat this file's *queue* as the canonical next work,
  and `docs/reviews/2026-11-17/BETA-ACTION-PLAN.md` as the current priority order.

---

## Batch 1 — Safe mechanical (DO FIRST)
**Risk: None. Run in parallel. Protects all current work.**

| # | Task | Files | Verification |
|---|------|-------|-------------|
| 1a | Commit current uncommitted work (37 files) | All modified | `git status` clean |
| 1b | Rename `healthcareBlue` → `healthcare` (13 files) | SectionCard + 12 modules | eslint 0, vitest pass |
| 1c | Clean up dead exports (zero refs) | Multiple | eslint + vitest catch misses |
| 1d | Run full test suite to establish baseline | — | vitest + eslint + smoke |

**Order:** 1a first, then 1b/1c parallel, then 1d.

---

## Batch 2 — Targeted fixes (known, scoped)
**Risk: Low. Fix one at a time, test between each.**

| # | Task | File(s) | Finding |
|---|------|---------|---------|
| 2a | Hide empty group labels in encounter cards | SHOS_Encounters_Prototype.jsx | 8a |
| 2b | Hide empty SectionCards or add "None recorded" placeholder | SHOS_Contacts_Prototype.jsx | 8c |
| 2c | Fix FAB overlap on medication cards | SHOS_Medication_Dashboard_Prototype.jsx | 8e |
| 2d | Make "5 Active medications" card clickable or differentiate | SHOS_Medication_Dashboard_Prototype.jsx | 10 |
| 2e | Add dev-mode guard to "A new version is ready" banner | App.jsx | 0c |

**Order:** 2a → 2b → 2c+2d (same file) → 2e. Test between each.

---

## Batch 3 — Consistency passes (mechanical, verify after)
**Risk: Low-medium. Run after Batch 2.**

| # | Task | Scope | Verification |
|---|------|-------|-------------|
| 3a | Tokenise 13px → TYPE.body (516 sites) | All src/ | eslint + vitest + smoke |
| 3b | Fix stray hexes (goldText pair, module accents) | ~30 sites | eslint + vitest + smoke |
| 3c | Design manual targeted update (sections 10, 12, new components) | DESIGN-MANUAL.md | Manual review |
| 3d | Add CI guard for mockup hygiene | smoke-test.cjs | Run on all mockups |

**Order:** 3a + 3b parallel. 3c after. 3d independent.

---

## Batch 4 — New features (design decisions agreed 13 Nov 2026)
**Risk: Medium. Design settled — ready to build.**

| # | Task | Prerequisite | Effort | Design decisions |
|---|------|-------------|--------|-----------------|
| 4a | Female reproductive health (0g) — PMS quick-log, cycle phase, contraception side effects, headache diary | ✅ Done | 2-3 days | Deep link from cycle; symptoms live under Symptoms module with 2-way linkage; headache extends SymptomLog; cycle stats on both screens; exclude fertility tracking |
| 4b | Safety contact sharing (0) — field selection + share sheet + timer | ✅ Done | 1-2 days | User selects fields (default: name/address/vehicle); Google Maps first; system share sheet; user-defined timer with 50%/10% reminders; disclaimer both places |
| 4c | Healthcare header/toolbar standardisation (0b) — banner + tab header | ✅ Done (documented) | 1 day | Banner (fixed): exit/search/settings. Tab header (scrollable): add/filter/sort/export. Healthcare first, then all modules. |
| 4d | Widget render and design check (0e) — Playwright batch capture | ✅ Done (grep) | 0.5 day | Grep for widgets first, then capture all states (populated+empty, dark+light) |
| 4e | Demo data completeness (0d) — fill gaps | ✅ Done (seeded) | 1 day | 2 of each type, 3-5 common types, isDemo flag, clear sample data |
| 4f | Demo data display states (0h) — fix + spot-check | ✅ Done | 0.5 day | Required incomplete in red; summary hides unfilled; detail ghosts with toggle; edit form ghost unless in use. Encounters as template. |
| 4g | Design consistency (0j) — apply encounters card language to healthcare + contacts | ✅ Documented | 2-3 days | Healthcare first, then contacts. Incremental. |
| 4h | Sticky allergies banner (0k) | ✅ Done | 0.5 day | Sticky section below banner (tab-specific) |
| 4i | Dashboard title truncation (0l) | ✅ Done | 0.5 day | Rename to "Home" |
| 4j | Contacts running count (0m) | ✅ Done | 0.5 day | Opt-in, on by default |
| 4k | Filter 3-state toggle (0n) | ✅ Done | 1 day | All sortable lists |
| 4l | Medication notification banner (0o) | ✅ Verified | 1 day | Test current build, fix issues |
| 4m | Design manual full audit (0f) | ✅ Done | 0.5 day | Full audit of entire manual |

**Order:** 4a first (highest value). Then 4b, 4c. Then 4g (design consistency). Then 4d, 4e, 4f, 4h-4m.

---

## Batch 5 — Infrastructure (after audit completes)
**Risk: Low. Do last. ✅ ALL DONE**

| # | Task | Prerequisite | Status |
|---|------|-------------|--------|
| 5a | Port mockup design language into live app | Audit complete (§49b) | ✅ Done (commit 721b250) |
| 5b | Decide contactMerge.js fate (wire or delete) | None | ✅ Wired (duplicateCandidatePanel in use) |
| 5c | Run full vitest after all changes | All batches done | ✅ Run; 1 guard failure fixed (5dc2e3f) |
| 5d | Final smoke test on all mockups | All batches done | ✅ 0 FAIL on all 18 mockups |

---

## Open findings (not yet fixed)

| Finding | Description | Priority | Status |
|---------|-------------|----------|--------|
| 4 | ~30 stray hexes, goldText pair vs ACTION.gold | Medium | ✅ Done (goldText → ACTION.gold across 4 modules) |
| Challenge | Dead exports (zero refs) | Low | Open (Batch 1c) |

All other findings (8a, 8c, 8e, 10, 13px tokenisation, contactMerge.js) are resolved.

## Device audit progress (14 Nov 2026) - IN PROGRESS

Device: Redmi 13C, `com.shos.app` 0.2.0 (buildSha 921d19d). Audit only - no
app code changed. Screenshots/UI dumps in the session temp dir, not committed.

| Area | Status |
|------|--------|
| Home, Contacts (+Select), Contact detail, Encounter list, Encounter detail (top) | Done |
| Medication, Healthcare, Clinic Card (overlay, top to bottom) | Done |
| Healthcare sub-tabs design review (Vaccinations/Clinic Visits/Measurements/Testing vs Encounter reference) | Done |
| Medication sub-tabs design review (Registry/Log/Inventory vs Encounter reference) | Done |
| My Profile design review vs Encounter reference | Done |
| Add contact form - all 3 tabs, exercised fields/toggles, saved, verified, deleted | Done |
| Share for safety sheet (defaults, field ticks, preview, share fallback, back/checkbox behaviour) | Done |
| Encounters list, Add encounter (3 tabs exercised, saved, verified, deleted) | Done |
| Stats/Insights (filters, chart, metrics, insight box) | Done |
| Calendar (week toggle, month nav, date tap, filter chips) | Done |
| Settings overlay: My Profile, Backup & Export, Privacy, Widgets, Preferences, Notifications, Colour scheme, Manage lists, Resources, Glossary | Done |
| Settings overlay structure | Partial |
| Episodes, Calendar, Stats/Insights | Done |
| Settings sub-screens | Done |
| Other create flows (encounter, medication, test, symptom, clinic visit, retest, vaccination) | Done |

New findings recorded as BACKLOG.md items 51-103 (pronouns combine/create,
contact detail photo missing, fixed save bar overlapping bottom tab controls,
overlay background isolation + stale scroll, chip state not exposed, Approximate
toggle feedback; Share for safety: no native share sheet, hardware back leaves
the sheet open, empty fields silently dropped, dead photo control, live location
never shared, read-only uneditable message, checkbox square double-toggles;
Encounters: tab bar/system nav overlay lower controls, protection rows overflow
and clip options, counts glued to labels, duplicated protection label, attendee
chip without accessible name/photo, empty sections rendered, native ISO date
control, plainer form vs summary-card design; Stats: "(XXX)" placeholder count,
insight box clipped by nav bar, unique partners 0; Calendar: filter chips too
dark; Settings: My Profile no photo, Widgets 8th widget clipped, Resources
duplicates + bottom clipping, Privacy Anonymise mode missing toggle, kinks
toggle gated; Create flows: Vaccinations no delete/archive in Select mode,
Symptoms list-only no detail view; Design review vs Encounter reference:
Healthcare sub-tabs flat opaque surfaces not frosted glassmorphism (94),
Clinic Visits FAB overlaps bottom card (95), Measurements solid opaque header
breaks glassmorphism + flat search bar/tight spacing (96/97), Medication
Registry right-edge clipping + FAB overlap (98), Log/Inventory FAB overlap
(99), Inventory harsh dividers + flat list surface (100), My Profile bottom
section clipped + left-edge artifact (101/102), module accent token consistency
confirmed working (103)).

## Ideas (need design discussion before implementation)

| # | Title | Priority | Effort |
|---|-------|----------|--------|
| 0 | Safety: share contact identification with trusted contact | Medium | 1-2 days |
| 0b | Healthcare header/toolbar standardisation | Medium | 1 day |
| 0c | "A new version is ready" banner fix | Low | 0.5 day |
| 0d | Demo data completeness | Medium | 1 day |
| 0e | Widget render and design check | Medium | 0.5 day |
| 0f | Design manual currency check | Medium | 0.5 day |
| 0g | Female reproductive health perspective audit | High | 2-3 days |
| 0h | Three essential data display states | Medium | 0.5 day |
| 0i | Colour token naming: "healthcareBlue" → "healthcare" | Low | ✅ Done |
| 0j | Design consistency: apply encounters card language to healthcare and contacts | Medium | 2-3 days |
| 0k | Sticky allergies banner | Medium | 0.5 day |
| 0l | Dashboard title truncation ("X's dashboard" → two lines or "Home") | Low | 0.5 day |
| 0m | Contacts running count (scroll progress) | Low | 0.5 day |
| 0n | Filter 3-state toggle (off → asc → desc) | Medium | 1 day |
| 0o | Medication notification banner verification | Medium | 1 day |
| 0p | Contacts: combine / create new pronouns (BACKLOG 51) | Medium | 0.5 day |
| 0q | Contact detail: show profile picture (BACKLOG 52) | Medium | 0.5 day |
| 0r | Add contact: fixed save bar overlaps bottom controls (BACKLOG 53) | High | 0.5 day |
| 0s | Overlays: isolate background a11y + reset scroll (BACKLOG 54) | Medium | 1 day |
| 0t | Chips: expose selected state to accessibility (BACKLOG 55) | Medium | 1 day |
| 0u | Share for safety: native share targets, e.g. Messages/WhatsApp/Snapchat (BACKLOG 57) | High | 1 day |
| 0v | Share for safety: one editable combined message before sharing (BACKLOG 62) | Medium | 0.5 day |
| 0w | Share for safety: real live-location link or embedded map (BACKLOG 61) | High | 1-2 days |
| 0x | Share for safety: empty-field handling + working photo note (BACKLOG 59/60) | Medium | 0.5 day |
| 0y | Checkbox rows: make the box itself toggle exactly once (BACKLOG 63) | High | 0.5 day |
| 0z | Overlays: Android back closes the top sheet (BACKLOG 58) | Medium | 0.5 day |
| 0aa | Add encounter: pad content above tab bar/system nav (BACKLOG 64) | High | 0.5 day |
| 0ab | Add encounter: wrap/scroll option rows, separate usage counts (BACKLOG 65/66) | Medium | 0.5 day |
| 0ac | Encounter detail: attendee accessible name/avatar; hide empty sections (BACKLOG 68/69) | Medium | 0.5 day |
| 0ad | Encounter form: custom styled date/time + card styling (BACKLOG 70/71) | Medium | 1 day |
| 0ae | Fix protection context duplicate label (BACKLOG 67) | Medium | 0.5 day |
| 0af | Calendar filter chips contrast too dark (BACKLOG 75) | Medium | 0.5 day |
| 0ag | Stats: fix "(XXX)" placeholder count (BACKLOG 76) | Low | 0.25 day |
| 0ah | Stats: pad insight box above system nav (BACKLOG 77) | Medium | 0.25 day |
| 0ai | Stats: unique partners should reflect linked contacts (BACKLOG 78) | Medium | 0.5 day |
| 0aj | Settings: Widgets 8th widget clipped by nav bar (BACKLOG 81) | Medium | 0.25 day |
| 0ak | Settings: Resources duplicate entries + bottom clipping (BACKLOG 82) | Medium | 0.5 day |
| 0al | Settings: Privacy Anonymise mode missing toggle (BACKLOG 83) | Medium | 0.5 day |
| 0am | Settings: Privacy kinks toggle gated on missing Anonymise toggle (BACKLOG 84) | Medium | 0.25 day |
| 0an | Vaccinations: add delete/archive in Select mode (BACKLOG 85) | Medium | 0.5 day |
| 0ao | Symptom entries: add detail view drill-down (BACKLOG 86) | Medium | 0.5 day |
| 0ap | Healthcare sub-tabs: frosted glassmorphism + glow borders (BACKLOG 94) | Medium | 1 day |
| 0aq | Healthcare Clinic Visits: pad content above FAB (BACKLOG 95) | Medium | 0.25 day |
| 0ar | Healthcare Measurements: frosted header + search bar + spacing (BACKLOG 96/97) | Medium | 0.5 day |
| 0as | Medication Registry: right-edge padding + FAB clearance (BACKLOG 98) | Medium | 0.25 day |
| 0at | Medication Log/Inventory: pad content above FAB (BACKLOG 99) | Medium | 0.25 day |
| 0au | Medication Inventory: replace divider lines with frosted cards (BACKLOG 100) | Medium | 0.5 day |
| 0av | My Profile: pad bottom above INTO / LIMITS + remove left-edge artifact (BACKLOG 101/102) | Medium | 0.25 day |

## Recommended next steps (in priority order)

> **17 Nov 2026:** The list below is the older 11–13 Nov working order (Batches 1–5 are
> all DONE per their own tables above; do not re-run them). The **current ranked,
> challenged backlog is `docs/reviews/2026-11-17/CONSOLIDATED-BACKLOG.md`** — it folds in
> the beta findings, the approved axes (recovery ranked above cosmetic), the 14 Nov
> device-audit items, and the owner's FSRH decisions, and marks rejected items so they
> are not rebuilt. Prefer it over the list below.

1. **Batch 1** — ✅ DONE (committed, renamed, baseline verified)
2. **Batch 2** — ✅ DONE (8a/8c/8e/10 already fixed, banner guard done)
3. **Batch 3** — Tokenise 13px (516 sites) + fix stray hexes (~30) + update manual + CI guard
4. **Batch 4a** — Female reproductive health (design settled, ready to build) — 2-3 days
5. **Batch 4b** — Safety contact sharing (design settled) — 1-2 days
6. **Batch 4c** — Healthcare header/toolbar standardisation (design settled) — 1 day
7. **Batch 4d** — Widget render and design check (grep first) — 0.5 day
8. **Batch 4e** — Demo data completeness (feature matrix) — 1 day
9. **Batch 4f** — Demo data display states (spot-check 3 modules) — 0.5 day
10. **Batch 5** — Port mockups, decide contactMerge, final verification

## How to use this plan

- **Other sessions:** Read this file first. It's the single source of truth for
  what needs doing and in what order.
- **Updating:** When you complete a task, update its status here AND in BACKLOG.md.
  Move completed items to the "Completed" section.
- **Adding items:** Add new ideas to the "Ideas" section with priority and effort.
  Challenge and scope before implementing.
- **Visual QA:** Use `C:\Users\kanem\visual-qa.ps1` for screen capture and analysis.
  Findings persist to `visual-qa-findings/` and can be appended to AUDITS.md.
- **Audit tracker:** `audit-tracker.json` tracks screen coverage and toggle status.
- **Toggle exercise:** `npx playwright test audit-toggle-exercise.spec.js` for §49a verification.

## Files reference

| File | Location | Purpose |
|------|----------|---------|
| PLAN.md | SHOS-V2/ | This file — plan and backlog summary |
| BACKLOG.md | SHOS-V2/ | Detailed item descriptions with challenge/scope/plan |
| AUDITS.md | SHOS-V2/ | Live audit findings log |
| audit-tracker.json | SHOS-V2/ | Screen coverage + toggle status |
| audit-toggle-exercise.spec.js | SHOS-V2/ | Playwright toggle tests |
| playwright.audit.config.js | SHOS-V2/ | Playwright config for audit |
| visual-qa.ps1 | C:\Users\kanem\ | Visual QA pipeline |
| visual-qa-config.json | C:\Users\kanem\ | Model chains + checks |
| shos-design-spec.txt | C:\Users\kanem\ | SHOS design system for AI analyst |
| VISUAL-QA-README.md | C:\Users\kanem\ | Pipeline documentation |
| pw-screenshot.js | C:\Users\kanem\ | Playwright screenshot utility |
