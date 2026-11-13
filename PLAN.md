# SHOS-V2 — Plan & Backlog (canonical, kept current)

> **For other sessions:** This is the single source of truth for what needs doing.
> Read this first. Update it when you complete or add items.
> Companion: `BACKLOG.md` (detailed item descriptions), `AUDITS.md` (findings log),
> `audit-tracker.json` (screen coverage + toggle status).

## Current state
- **Visual audit (Finding 49):** Dark pass mostly complete. Light pass complete.
  Onboarding UNVERIFIED. Control-linkage rule (§49a) requires retroactive
  verification of all toggles.
- **Uncommitted changes:** 37 files, 1685 insertions (audit/fix work from
  sessions 11-13 Nov). Needs committing.
- **Tests:** vitest 2063 passed / 1 skipped / 0 failed. eslint 0 errors, 2
  pre-existing warnings. Smoke tests 0 FAIL on 10 files.
- **Open findings:** 8a, 8c, 8e, 10 (minor). Finding 4 (~30 stray hexes).
  Challenge pass: 13px untokenised (516 sites), dead exports, contactMerge.js.

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
| 4a | Female reproductive health (0g) — PMS quick-log, cycle phase, contraception side effects, headache diary | Design settled | 2-3 days | Deep link from cycle; symptoms live under Symptoms module with 2-way linkage; headache extends SymptomLog; cycle stats on both screens; exclude fertility tracking |
| 4b | Safety contact sharing (0) — field selection + share sheet + timer | Design settled | 1-2 days | User selects fields (default: name/address/vehicle); Google Maps first; system share sheet; user-defined timer with 50%/10% reminders; disclaimer both places |
| 4c | Healthcare header/toolbar standardisation (0b) — banner + tab header | Design settled | 1 day | Banner (fixed): exit/search/settings. Tab header (scrollable): add/filter/sort/export. Healthcare first, then all modules. |
| 4d | Widget render and design check (0e) — Playwright batch capture | Grep first | 0.5 day | Grep for widgets first, then capture all states (populated+empty, dark+light) |
| 4e | Demo data completeness (0d) — fill gaps | Feature matrix | 1 day | 2 of each type, 3-5 common types, isDemo flag, clear sample data |
| 4f | Demo data display states (0h) — fix + spot-check | Batch 2 done | 0.5 day | Required incomplete in red; summary hides unfilled; detail ghosts with toggle; edit form ghost unless in use. Encounters as template. |
| 4g | Design consistency (0j) — apply encounters card language to healthcare + contacts | None | 2-3 days | Healthcare first, then contacts. Incremental. |
| 4h | Sticky allergies banner (0k) | None | 0.5 day | Sticky section below banner (tab-specific) |
| 4i | Dashboard title truncation (0l) | None | 0.5 day | Rename to "Home" |
| 4j | Contacts running count (0m) | None | 0.5 day | Opt-in, on by default |
| 4k | Filter 3-state toggle (0n) | None | 1 day | All sortable lists |
| 4l | Medication notification banner (0o) | None | 1 day | Test current build, fix issues |
| 4m | Design manual full audit (0f) | None | 0.5 day | Full audit of entire manual |

**Order:** 4a first (highest value). Then 4b, 4c. Then 4g (design consistency). Then 4d, 4e, 4f, 4h-4m.

---

## Batch 5 — Infrastructure (after audit completes)
**Risk: Low. Do last.**

| # | Task | Prerequisite |
|---|------|-------------|
| 5a | Port mockup design language into live app | Audit complete (§49b) |
| 5b | Decide contactMerge.js fate (wire or delete) | None |
| 5c | Run full vitest after all changes | All batches done |
| 5d | Final smoke test on all mockups | All batches done |

---

## Open findings (not yet fixed)

| Finding | Description | Priority | Batch |
|---------|-------------|----------|-------|
| 4 | ~30 stray hexes, goldText pair vs ACTION.gold | Medium | 3b |
| 8a | Encounter card dead space (empty group labels) | Minor | 2a |
| 8c | Empty SectionCards on contact detail | Minor | 2b |
| 8e | Medication FAB overlap | Minor | 2c |
| 10 | Stat card affordance inconsistency | Minor | 2d |
| Challenge | 13px untokenised (516 sites) | Medium | 3a |
| Challenge | Dead exports (zero refs) | Low | 1c |
| Challenge | contactMerge.js (wire or delete) | Low | 5b |

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

## Recommended next steps (in priority order)

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
