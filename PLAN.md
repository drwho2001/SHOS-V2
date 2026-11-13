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

## Batch 4 — New features (needs design discussion first)
**Risk: Medium. Design before code.**

| # | Task | Prerequisite | Effort |
|---|------|-------------|--------|
| 4a | Female reproductive health (0g) — PMS quick-log, cycle phase, contraception side effects | Design discussion | 2-3 days |
| 4b | Safety contact sharing (0) — field selection + share sheet | Design discussion | 1-2 days |
| 4c | Healthcare header/toolbar standardisation (0b) — design decision | Design discussion | 1 day |
| 4d | Widget render and design check (0e) — Playwright batch capture | None | 0.5 day |
| 4e | Demo data completeness (0d) — fill gaps | Feature matrix | 1 day |
| 4f | Demo data display states (0h) — fix 8a/8c/8e/10, spot-check | Batch 2 done | 0.5 day |

**Order:** 4d first (no deps). Then 4a/4b/4c need design. 4e/4f after Batch 2.

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
| 0i | Colour token naming: "healthcareBlue" → "healthcare" | Low | 0.5 day |

## Recommended next steps (in priority order)

1. **Batch 1** — Commit + rename + dead exports + baseline (protect work)
2. **Batch 2** — Fix 8a/8c/8e/10 + banner guard (known, scoped)
3. **Batch 3** — Tokenise 13px + fix hexes + update manual + CI guard
4. **Batch 4** — Female reproductive health (highest-value new feature)
5. **Batch 4** — Safety sharing (design discussion first)
6. **Batch 4** — Widget audit (no dependencies)
7. **Batch 4** — Demo data completeness
8. **Batch 5** — Port mockups, decide contactMerge, final verification

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
