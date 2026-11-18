# SHOS — Consolidated Backlog (17 Nov 2026)

**Purpose.** One ranked, challenged list of everything genuinely open. It reconciles the contradictory status claims in `PLAN.md` (Batches 1–5 marked DONE in one table but "recommended next steps" still lists them), the device-audit ideas 0p–0av, the 14 Nov findings 51–103, `BACKLOG.md`'s "Recorded (not fixed)" block, the beta R1–R13 list, and the approved axes. **Source of truth for next work is this file + `PLAN.md` + `pool list`; the dated plans are records.**

**Challenge applied to every item:** is it real, already shipped, a duplicate, or should it be dropped? Items marked ❌ are explicitly rejected with the reason so a future session does not rebuild them.

---

## 0b. Built after the consolidated backlog (17 Nov, all pushed)
- **R1** update-banner dismiss fix + APK link removed on web; **R13** No-barrier canonical label + search/filter; **R3** reversible demo-data snapshot/restore; web-biometric gating; white-on-white confirm button fix; shared theme-key hardening + guard; round-2 visual fixes (6px confirm spacing, single-line INFERRED, conditional stray ·, Healthcare order Episodes/Calendar/Clinic Card/Attachments). CI guard failures from these were fixed as they surfaced (styleColourGuard, healthcareCalendarShortcutGuard, PWA auto-update smoke).
- **Challenged, NOT built (with evidence):** R6 dialog stack (test artifact), A2 "routine meds" (already includes BD/TDS/QDS, excludes PRN), A6 end time (already shown when data exists), deep-link gaps (no widget needs them — "doors with no keys").
- **Awaiting owner decisions:** Testing↔Measurements `sourceTestId` link (recommended yes), measurement-type suggestion bank (recommended yes), A3 medications horizontal scroll (needs visual re-diagnosis), A7 contacts sort (needs-attention default vs filter), import v1 + Clinic Card extension + menopause fields (approved, not built).

## 0. Shipped — DO NOT REBUILD (verified this session)
- **Update-banner dismiss** — was broken (sessionStorage "1" vs localStorage timestamp); fixed via `calculations/updateNotice.js`, all four guards + dismiss share it. APK link removed on web. (`R1`)
- **"No barrier method" canonical label + search/filter** — `canonicalProtectionNames()` folds "None"/"No condom" into one derived label; Encounter search + filter updated. (`R13`)
- **Biometric toggle gated on web** — no longer offered where it cannot work.
- **i18n `futureDateSuffix` spacing** — "a scheduledTest" regression corrected.
- **Prior-session work kept:** calendar `findEvents` crash guard, "Absolutely" wording, He/they pronouns, archived-contact-count preference, solid-surfaces design principle.
- Already shipped per repo history (do not re-open): medical card restyle, contactMerge wiring, dead-space fixes 8a/8c/8e/10, goldText tokens, `healthcareBlue` rename, Safety Share sheet itself, mockup restyle.

---

## 1. P0 — data loss / recovery (approved axes; rank above cosmetic)
| ID | Item | Challenge / status |
|---|---|---|
| A1 | **Backup → export → import round trip** on-device, including entries created during beta; then restore onto a fresh install | Not executable in browser (external action). Highest-stakes untested flow. Owner must do on device. |
| A2 | **Wrong-key / locked-vault cold start** path (`App.jsx:309`) and App re-lock timeout / "Skip re-verification briefly" | Never triggered. Data-integrity risk. |
| A3 | **Migration across versions** — `backupMigrations.js`, seed-id migration, old backups containing `vaginalHealth` | Ripped-open reasoning only; ties to D1 removal (must keep backup shim). |
| A4 | **Storage-quota-exceeded** user-visible failure (`save()` returns bool; call sites fire-and-forget) | Repo's own history flags this. Real data-loss path. |

## 2. P0/P1 — open ranked fixes (beta)
| ID | Item | Effort | Challenge |
|---|---|---|---|
| R2 | Icon 404s (~15 `contact-platform-icons/*.png`) + CSP font/meta errors | S–M | Real console errors; broken Contacts thumbnails seen live. |
| R3 | Restore demo data (snapshot-on-clear, D2=B) beside Clear in Home + Developer tools | M–L | Owner's #1 ask; guard-rail tests mandatory (never overwrite user data). |
| R5 | hCG fields on pregnancy form (urine default + serum value, D3) | M | Schema/backup migration; Testing already has sample type. |
| R7 | Remove vaginal health + migrate (D1=B) with read-only backup shim | L | Overrides 13 Nov decision; migration test required. |
| R4 | Repeated summary cards across Healthcare/Medication tabs + allergies green outline for NKDA/none/N/A | M | **SHIPPED 18 Nov** incl. M4.1 genuine per-tab stats, M4.2 compact 2-row tabs + More, M4.3 pregnancy link placement, Testing "Other" text, app-wide chip collapse. BKGD 0b header standardisation explicitly deferred by owner. |
| R6 | Multiple mounted dialogs (stack of `display:block` dialogs) | S–M | ⚠️ confirm intent — may be deliberate back-stack. |
| R9 | Two simultaneous "ongoing" periods allowed | S–M | ⚠️ confirm intent — real data integrity concern. |
| R8 | Transient all-zero counts in Developer tools / Stats on load | S | Misleading skeleton state. |

## 3. P1 — FSRH structure (owner decisions recorded, not built)
- **F1** Rename "Menstrual & Contraception" → "Reproductive health"; 3 inner sections; no 6th tab. (option 3)
- **F2** Pregnancy test = Testing-owned single source; Pregnancy = projection + prefilled "+ Log test"; migrate existing entries.
- **F3** Menopause: user-entered status + neutral NICE/FSRH/RCOG-aligned "discuss with clinician" prompt; **no referral/triage rule**; owner sign-off on copy.
- **F4** Cycle-stats context: annotate/suppress "irregular" advisory when hormonal contraception active (owner "yes, unsure" — scope at build).

## 4. P1/P2 — accessibility (approved axes; only a11y-tree read so far)
- **AX1** Run axe-core on every screen; fix contrast/labels/landmarks (repo has past axe findings).
- **AX2** Keyboard/focus order in dialogs; screen-reader pass.
- **AX3** Reduced-motion; **font-scale** (native `MainActivity` wires it — large text likely breaks dense cards).
- **AX4** Colour-blind palette visual verification across screens; full **light-mode** re-review.

## 5. P2 — responsive / fit-to-screen
- **RS1** Wide/desktop viewport (742px only tested; repo has `useIsDesktopWidth`).
- **RS2** Landscape 405dp (manual warns cards overflow); 360px phone.
- **RS3** Calendar fit-to-screen: grid should fit one viewport; event list is the only scroll region — do NOT `overflow:hidden` the whole view. Needs responsive rule + real-device check.

## 6. P2 — platform parity (beyond biometrics)
- **PP1** Calendar write-sync toggles on web — confirm reachability; gate if reachable and no-op.
- **PP2** Screen-security/FLAG_SECURE "Allow screenshots" toggle availability on web.
- **PP3** Native share/folder-export/install-prompt fallbacks on web — exercise.

## 7. P2 — 14 Nov device-audit findings 51–103 (BACKLOG items 0p–0av)
These are **open, device-found, owner-confirmed** — not duplicates of the beta list. Grouped:
- **Contacts:** 0p pronouns combine/create (partially done — base chips added), 0q contact-detail photo missing, 0r save bar overlaps bottom controls (HIGH), 0s overlay a11y + stale scroll, 0t chip selected-state a11y, 0aa-0ab encounter add form padding/rows.
- **Safety Share:** 0u native share targets (HIGH), 0v editable combined message, 0w real live-location link (HIGH), 0x empty-field handling + photo note (my R11 covers the empty-field part), 0y checkbox double-toggle (HIGH), 0z back closes sheet.
- **Encounters:** 0ac attendee a11y/empty sections, 0ad custom date/time + card styling, 0ae protection duplicate label (my R13 canonical label addresses the "duplicated protection label" symptom — verify overlap).
- **Stats/Calendar:** 0af filter-chip contrast, 0ag "(XXX)" placeholder, 0ah insight box clipped, 0ai unique partners, 0aa Calendar filter contrast.
- **Settings:** 0aj Widgets 8th clipped, 0ak Resources duplicates, 0al Anonymise missing toggle (⚠️ I SAW the toggle live — likely already fixed; verify), 0am kinks toggle gating.
- **Lists:** 0an Vaccinations delete/archive, 0ao Symptoms detail view (⚠️ I exercised a Symptom detail view live — verify/close).
- **Design:** 0ap glassmorphism (❌ REJECT — DESIGN-MANUAL principle #7 "solid surfaces only" explicitly rules it out; the aspirational notes were wrong), 0aq-0av FAB overlap/padding/dividers/left-edge artifacts across Healthcare/Medication/MyProfile.

## 8. P3 — consistency / hygiene (from BACKLOG "Recorded (not fixed)")
- 13px untokenised — **SHIPPED 18 Nov**: 137 raw sites → `TYPE.control.fontSize` + `fontSizeTokenGuard.test.js`.
- Dead exports — **SHIPPED 18 Nov**: re-verified each name in BACKLOG.md:1845; only the seven genuinely definition-only ones removed (`REDACTED_COPY`, `FONT_FAMILY_MONO`, `CONTACT_REQUIRED_FIELD_GROUPS`, `getOpen`, `removeMemberFromAllGroups`, `getGroupForMember`, `applyDisclosure`); `deadExportsGuard.test.js` locks it. Names now live (e.g. `DEFAULT_VAGINAL_HEALTH_ENTRY`, `TOUR_STEPS`) deliberately kept.
- `contactMerge.js` — **VERIFIED/CLOSED**: `duplicateCandidatePanel` is imported and used in SHOS_Contacts_Prototype.jsx:75,3370; the "unwired" note was stale. No change.
- Mockup radius 12 vs 13 — **SHIPPED 18 Nov**: 56 occurrences across 21 tracked mockups → 13px; live `public/` pages deliberately left alone. Two frosted-glass cards converted to solid surfaces (design manual #7).
- CI guard for mockup hygiene — **SHIPPED**: `mockupHygieneGuard.test.js` (4 tests) locks radius + no glassmorphism.

## 9. ❌ Rejected / closed (do not rebuild)
- Glassmorphism/frosted-glass (design manual #7).
- "Replay tour" (exists in Guide), "biometrics missing" (exists native), "no Backup in banner" (existed).
- Ovulation-window/fertility tracking (medical-liability exclusion).
- "Remove No condom option" (never a default option — canonical label fix shipped instead).
- Batches 1–5 in PLAN.md — already done per its own DONE tables; the "next steps" section is stale.

---

## Challenge pass on this backlog
1. **Volume is the risk.** ~70 items across 9 groups. Many P2/P3 are small but the repo's own rule is "one change, test between each" — batching them into one PR would repeat the double-encoding/merge mistakes in its history.
2. **Duplication is real and handled here:** R11 ⊂ 0x; R13 ≈ 0ae; 0al/0ao appear already fixed live — marked verify, not rebuild.
3. **Priorities inverted in the old docs:** PLAN.md lists 13px tokenisation and features as "next", but A1–A4 (recovery) are higher-stakes. This list corrects that.
4. **Owner decisions outstanding:** 0u/0w (Safety Share share targets) are HIGH but depend on platform parity (PP3); decide before building.
5. **Whatever is not verified is not done** — the audit's own caveat. AX/RS/PP items are recorded as untested, not as passed.

*No code changed. Nothing committed. Verification: full `npm run verify` passed all runnable gates (2165 tests); smoke skipped locally for RAM, CI on push.*
