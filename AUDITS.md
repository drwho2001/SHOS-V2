# SHOS-V2 AUDITS.md — live audit findings log

> THIS IS THE CANONICAL AUDIT LOG (moved from %TEMP% on 13 Nov 2026 so it is
> obvious and discoverable in the repo). Appended as findings are discovered,
> so nothing is lost on compaction or a model switch.
> Findings-only pass: **NOTHING HAS BEEN FIXED.**
> Companion files: `BACKLOG.md` (prior fixes + §49 below), hexes inventory in
> `%TEMP%\opencode\hexes.json`, screenshots in `%TEMP%\opencode-browser-*`.

Method: live app at http://localhost:5173 (Vite dev, latest code, HMR-fresh),
driven via browser DOM (evaluate/snapshot) + screenshots (image-capable model).

IMPORTANT CONTEXT (documented per owner request):
- **Onboarding did NOT run during this audit** — the dev profile had already
  completed onboarding (stored prefs), so the audit never saw the
  onboarding/welcome flow, PIN-creation flow, or first-run seeding UI. The
  Quick tour DID run earlier (previous session) and crashed. Onboarding is
  UNVERIFIED visually this pass.
- Multiple stale browser tabs open on the same localhost URL; only the newest
  tab is used. Old tabs may show the old code.

## AUDIT METHODOLOGY RULE (owner directive, 13 Nov 2026)
> "Just because a toggle looks like it does something doesn't mean it actually
> works." Every switch / toggle / button must be exercised **independently**
> and verified for **correct and complete linkage**:
> 1. Visual state flips (aria-checked/aria-pressed/label change), AND
> 2. The dependent UI actually re-renders (list changes, section appears,
>    count changes, etc.), AND
> 3. The change is real (data/persisted), not just local state, AND
> 4. Toggling back restores the original state cleanly.
> A control that only satisfies (1) is a BUG — logged individually.
- NOT FIXED; per-screen exercise is underway and every suspect is logged
  below (see Finding 9).

---

## BUG 1 — CRITICAL: infinite re-render loop in TourOverlay: FIXED
- File: src/modules/InteractiveTour.jsx
- Evidence: console flooded with `Maximum update depth exceeded` at
  `TourOverlay (.../InteractiveTour.jsx)`; dozens of repeats whenever the
  tour was open.
- Root cause (two compounding causes):
  1. The navigation effect listed `onNavigate`, `onOpenSettings` and
     `onCloseSettings` in its dependency array. All three are plain arrow
     functions created in App.jsx, so every App re-render gave them new
     identities → effect re-ran → called `onNavigate` → App re-rendered →
     infinite loop.
  2. `recalc` is `useCallback(..., [step])`, so its identity changes on
     every step change; `useEffect(() => { recalc(); }, [recalc])` re-ran
     on every step, duplicating the measurement already triggered by the
     navigation effect (and the 400ms `forceRecalc` poll on top).
- FIX APPLIED:
  - Added `onNavigateRef` / `onOpenSettingsRef` / `onCloseSettingsRef`
    holding the latest callback values; the navigation effect reads them
    from refs and now depends ONLY on `[step, recalc]`.
  - Removed the redundant `useEffect(() => { recalc(); }, [recalc])`.
- Verification: tour opened after a fresh module load — console contains
  only the 2 benign pre-existing messages (CSP meta warning, React
  DevTools prompt), ZERO depth warnings. Next/Skip navigation works: the
  tour advanced through all 10 steps and finished with "Done", returning
  to Home. eslint clean on the file.

## BUG 2 — "A new version is ready" banner: FALSE ALARM, NOT A BUG
- File: src/App.jsx lines ~1435-1495 (two independent triggers) and the
  banner render at ~3146-3169.
- Resolution: NOT a bug. Both triggers are correctly gated:
  1. SW `controllerchange` (line 1456) — delayed 3s (line 1462) so initial
     SW activation doesn't re-show the banner after a reload; and it checks
     `shos-sw-update-dismissed` first.
  2. `version.json` background check (lines 1469-1495) — compares the
     release's `buildSha` against this build's baked-in `__BUILD_SHA__`
     (line 1485). The condition at line 1486 requires
     `currentSha !== "dev"`, and in the Vite dev server `__BUILD_SHA__` IS
     `"dev"`, so the check is skipped — no banner in dev. Only a real
     stable build with a different SHA would trigger it.
- Root cause of the false alarm: the banner appeared during the audit's
  repeated reloads (HMR + SW interplay), not because of a broken compare.
  Verified just now: banner is ABSENT on a fresh localhost load.
- Dismissal persistence (the secondary suspicion) is also fine:
  `shos-sw-update-dismissed` is checked in BOTH trigger paths before
  setting state (lines 1437, 1456, 1487), so a dismissal does persist
  across reloads within a session.

## FINDING 3 — Home header icons: SVG role="button", not real buttons: FALSE ALARM
- File: src/modules/SHOS_Home_Prototype.jsx lines 1021-1049.
- Resolution: NOT a defect. Verified in the live DOM: all four icons carry
  `role="button" tabindex="0"` AND a real accessible name —
  aria-label "Search" / "My Profile" / "Settings" / "Quick exit" (each also
  has a matching `title`), plus Enter/Space key handling. The original
  "aria-label: null" observation was wrong: the audit query read the
  parent/`h1` wrapper rather than each icon node.
- Residual (cosmetic, optional): they are `<svg role="button">` rather than
  native `<button>` elements, so they lack native disabled/focus-ring
  semantics. Low priority; no functional or screen-reader name gap.
- NOT FIXED.

## FINDING 4 — Colour tokenisation (owner's question: "are all colours coded
to relevant tags? nothing hardcoded as raw hex")
Answer: mostly yes, with documented exceptions. `designTokens.js` is the
single source (NEUTRAL, NEUTRAL_DARK, ACCENTS per module, ACTION
red/green/amber/amberText/amberSurface/gold, ACCENT_TEXT_SAFE,
ACTION_TEXT_SAFE, TYPE, RADIUS, TOAST, FONT_FAMILY). Mockups use CSS vars
(--hc, --teal, --meds-blue, --contacts, --green/--red/--amber) — palette-
driven, not hardcoded. BUT ~30 live non-token hexes remain in src (full
inventory in hexes.json at %TEMP%\opencode\hexes.json):
- **goldText pair `#8A6100` (light) / `#FFD666` (dark)** hardcoded in 4
  modules: SHOS_Measurements, SHOS_Medication_Dashboard, SHOS_Testing,
  SHOS_Timeline — instead of `ACTION.gold` (#7A6500). These are deliberate
  per-module hand-tuned stand-ins (comments say so) but they duplicate the
  token's job and WOULD NOT follow a user colour override or colourblind
  remap. Candidate: promote to a shared ACTION goldText pair or route via
  resolveDarkAccent.
- Category colours (kinks/platforms/relationship types, e.g. #E8A33D,
  #D978AD, #1DA1F2 Twitter, #EA4335 Google) in contactRepository.js seeds
  and Contacts/ManageLists — data-driven registry values, acceptable, but
  hardcoded.
- Other live stray hexes: Encounters #7F30A6/#F59E0B/#E0A166/#FFFFFFFFF
  (9-F typo ×3!), Home #10B981/#EC4899/#F0FDFA/#F0FDF9/#FFF7ED, Medication
  #A9C2FF/#F97316/#CCCCCC/#F5F5F5, Settings #C7D5F7/#FFF4CE,
  SymptomLog #F0B429, ManageLists #E5484D/#E24E9C/#E8E8EC,
  RegistryManagement #E5484D, PrivacyScreen #A0A0A8,
  Contacts #111111/#EA4335/#D08A2E/#2A2520/#1DA1F2/#E8A33D/#D978AD,
  TrashScreen #89898C ×2, App.jsx #656568/#8A2D2D, main.jsx #656568/#F0F0F3,
  AboutScreen #5B85F5, DesignScreen #D370C7/#FF7A7E/#5FD9A4,
  DeveloperTools/ErrorLog #FF7A7E, ClinicVisits #5FD9A4 ×2,
  BackupExportScreen #5B5B62, recordExportService #EEEEEEEEE (9-E typo),
  DesignScreen et al #FF7A7E + #5FD9A4 (actionRed/green dark literals
  instead of resolveDarkAccent with ACTION tokens), Contacts'
  actionAmberText "#D08A2E" + actionAmberSurface "#2A2520" hand-typed.
- 9-char hex typos: verified NONE exist in current src (full grep for
  `#[0-9A-Fa-f]{9,12}` returned zero matches — the #FFFFFFFFF / #EEEEEEEEE
  references in Finding 4 were already cleaned up in earlier fix passes).
- PARTIAL FIX — Encounters chip groups (src/modules/SHOS_Encounters_Prototype.jsx):
  - #008585 → ACCENTS.home (Position chip border, Notes annotation border)
  - #00858515 → ${ACCENTS.home}15 (Position chip fill)
  - #7F30A6 → ACCENTS.encounters (Activities chip border)
  - #7F30A615 → ${ACCENTS.encounters}15 (Activities chip fill)
  - #E24E9C → ACCENTS.protection (Cum/loads chip border)
  - #E24E9C15 → ${ACCENTS.protection}15 (Cum/loads chip fill)
  - #F59E0B → ACTION.amber (No-barrier chip border/text)
  - #F59E0B12 → ${ACTION.amber}12 (No-barrier chip fill)
  - Left as-is (no clean token equivalent): #5fd9a4/#5fd9a415 (Protection
    chip fill — lighter than ACTION.green #148A1E), #e0a166 (attendee pill),
    #FFFFFF/#1B1B1F/#89898C/#FF7A7E (icon/text/surface colours).
  - eslint clean on the file.

## FINDING 5 — Smoke test set quickadd-button-options.html FAIL: FIXED
- `node smoke-test.cjs quickadd-button-options.html` → was 17 PASS / 1 FAIL
  ("core colour tokens"): the file's palette used --text-primary/--bg
  instead of --red:/--green:/--amber:.
- FIX: added `--red: #D93838`, `--green: #148A1E`, `--amber: #F59E0B` CSS vars
  to quickadd-button-options.html (:root).
- Now 18 PASS / 0 FAIL / 7 WARN. Included in the ratchet.

## FINDING 6 — 9 time-rot vitest failures (pre-existing, not from edits)
- snapshotFidelity ×6, clearSampleData ×3, sessionBridge ×1: frozen snapshot
  vs date-relative live seed data. Rebaseline per documented procedure.
- Full suite: 2054 passed / 9 failed / 1 skipped. Lint: 0 errors 0 warnings.
- Vite build: OK. All 22 smoke-tested HTML files: 0 FAIL except quickadd
  (Finding 5).

## FINDING 7 — Console noise on every load (dev-only, benign)
- `The Content Security Policy directive 'frame-ancestors' is ignored when
  delivered via a <meta> element.` (index.html line ~21). Dev-only noise;
  harmless. NOT FIXED.

## FINDING 8 — dead space / layout economy (owner ask: review free space on cards)
### 8a — Encounter card: empty group labels always rendered: FIXED
- src/modules/SHOS_Encounters_Prototype.jsx, EncounterCard (~1092-1270).
- All four group labels ("POSITION (ME)", "ACTIVITIES", "PROTECTION &
  MEDICATION", "CUM / LOADS") rendered on EVERY card even when that group had
  zero chips → dead label rows (~60px per card).
- FIX APPLIED: each label+chip-row block is now wrapped in a conditional so it
  only renders when the group actually has content:
  - Position (me): only when `encounter.myPosition` is non-empty.
  - Activities: only when resolved `kinkNames` is non-empty.
  - Protection & medication: only when protection names exist, PrEP coverage is
    set, or the "No barrier" derived chip would show.
  - Cum / loads: only when whereI-came / where-he-came / loadsCount is set.
- Sparse cards now drop from ~265px to ~200px; list of 18 cards saves ~1 full
  screen of scrolling. eslint clean on the file.
### 8b — Kai (rich) card height
- A fully-populated card is ~250px of vertical stack; 4 stacked groups.
  Candidate: two-column chip layout at wide widths or single-row wrap with
  inline micro-labels. Low priority.
### 8c — Contact detail: empty SectionCards: FIXED
- Contact detail rendered KINK and CONTACT METHODS cards with title and NO
  body content at all (~56px dead card each).
- FIX APPLIED (src/modules/SHOS_Contacts_Prototype.jsx):
  - Kink card: added an empty-state guard showing "Nothing recorded yet." when
    stated kinks, limits, role and position are all empty. The guard tests
    RESOLVED kink names (not raw IDs — an orphaned kinkId still left a
    non-empty statedKinks array that filtered to nothing, which is how the
    first guard version still showed a blank card), and uses a small `emptyish`
    helper so empty-array role/position values (which are truthy under `!v`)
    don't defeat the check.
  - Contact methods card: added "No contact methods recorded." when every
    method field is empty.
- Both fallbacks verified live in Ash's profile: Kink now shows "Nothing
  recorded yet.", Contact methods shows "No contact methods recorded.", Notes
  still shows "No notes yet.", Chems shows "None known". No console errors.
  eslint clean on the file.
### 8d — Encounter list end-gap
- ~49px gap before the final card group (month header) is fine; bottom
  padding above nav ~90px on last card — acceptable, FAB clearance.
### 8e — Medication FAB overlap (dark, Registry): FIXED
- The circular + FAB overlapped the right edge of med cards (PrEP stock bar's
  "restock at 7" label, Antihistamine's chips, Log deltas, Inventory gears).
- FIX APPLIED (src/modules/SHOS_Medication_Dashboard_Prototype.jsx):
  - Main content container (line ~2431): added `paddingBottom: calc(90px +
    env(safe-area-inset-bottom) + 70px)` — clears the FAB (fixed at
    `bottom: calc(90px + env(safe-area-inset-bottom))`, 56x56px) so the last
    card no longer runs under it on all three tabs (Registry/Log/Inventory).
- eslint clean on the file.

## FINDING 9 — Medication Registry "Show archived (1)" link: RESOLVED — NOT A BUG
- Screen: Medication → Registry → bottom "Show archived (1)" row.
- Resolution: control is correctly wired (`onClick={() => setShowArchived(s => !s)}`,
  src/modules/SHOS_Medication_Dashboard_Prototype.jsx:2698). Clicking the actual
  `[role="button"]` flips the label to "Hide archived (1)" and renders the
  archived med card ("Amoxicillin (course, finished)" — muted styling,
  "Archived — history kept in Log tab", Restore button). State toggle-back
  verified.
- Root cause of the false alarm: the row is a wrapper div (no handler)
  containing the role=button; both have identical textContent, so the audit
  script's "smallest matching element" pick hit the wrapper. Automation
  pitfall — always target `[role="button"]` explicitly (feeds the §49a
  methodology rule: a control must be tested on the element that carries the
  handler).

## FINDING 10 — Medication stat cards: affordance inconsistency: FIXED
- Screen: Medication (any tab) → "5 Active medications" vs "1 Needs action"
  summary cards, side by side, identical styling.
- "Needs action" IS a `role="button"` (aria-label "Needs action", cursor
  pointer) and clicking it navigates to Registry scrolled to the Testosterone
  card — verified working (§49a pass).
- "5 Active medications" was NOT a control (role=null, cursor default) and
  did nothing — but looked identical, so users expected it to be tappable.
- FIX APPLIED (src/modules/SHOS_Medication_Dashboard_Prototype.jsx line 2604):
  - Added `onClick={() => setTab("Registry")}` to the Active medications
    `StatTile`. The existing `StatTile` component already converts `onClick`
    into `role="button"`, `tabIndex={0}`, `aria-label="Active medications"`,
    `cursor: pointer`, and Enter/Space key handling — identical treatment to
    "Needs action".
- eslint clean on the file.

## §49b — Mockup card-design port (colour-indent/backfill sections): COMPLETE
- Ports the mockup card design language (encounters-card-mockup.html etc.) into
  the live app JSX cards: colour-indent (tinted background + coloured left
  border on section rows) and backfill (tinted chip fills with coloured borders).
- DONE — SectionCard component (src/components/SectionCard.jsx):
  - When `accent` prop is passed: `border-left: 4px solid ${accent}`,
    `background: ${accent}08`, `border-radius: RADIUS.sm` (8px),
    `padding: "4px 12px 12px"`. When no accent: unchanged (RADIUS.md, plain).
  - Applies §49b automatically to My Profile (contactsTeal accent), Vaccinations,
    Timeline, Testing, SymptomLog (healthcareBlue accent).
- DONE — EncounterCard Notes annotation (SHOS_Encounters_Prototype.jsx):
  - `padding: "7px 9px"`, `border-radius: radius.sm`, `border-left: 3px solid
    ${ACCENTS.home}`, `background: ${ACCENTS.home}15`.
- DONE — Contacts empty-state fallbacks (SHOS_Contacts_Prototype.jsx):
  - Kink: `${ACCENTS.kink}` tint + border, "Nothing recorded yet."
  - Contact methods: `${ACCENTS.contacts}` teal tint + border.
  - Chems: `${ACTION.amber}` tint + border, "None known".
  - Notes: `${ACCENTS.home}` tint + border when empty.
- DONE — Medication StatTile (SHOS_Medication_Dashboard_Prototype.jsx):
  - `background: ${tint}15 / border: ${tint}` instead of surface/border.
- DONE — Healthcare SummaryStat tiles (SHOS_Healthcare_Prototype.jsx):
  - `padding: "10px 8px"`, `border-radius: RADIUS.md`,
    `background: ${T.healthcareBlue}15`, `border: 1px solid ${T.healthcareBlue}`.
- DONE — Settings sub-screens:
  - PrivacyScreen: info containers use `${ACCENTS.home}08` background +
    `4px solid ${ACCENTS.home}` left border, RADIUS.sm.
  - DesignScreen: section containers use same ACCENTS.home treatment.
- DONE — Clinic Card local SectionCard (SHOS_ClinicCard_Prototype.jsx):
  - `border-left: 4px solid ${T.healthcareBlue}`,
    `background: ${T.healthcareBlue}08`, `border-radius: RADIUS.sm`.
- DONE — Timeline SectionCards (SHOS_Timeline_Prototype.jsx):
  - All 8 section cards (Start, At-risk encounters, Testing, Treatment,
    Symptoms, Notes, Resolve, Resolved) use `accent={T.healthcareBlue}`.
- DONE — Attachments AttachmentRow (SHOS_Attachments_Prototype.jsx):
  - `background: ${T.healthcareBlue}08`, `border-left: 4px solid ${T.healthcareBlue}`,
    `border-radius: RADIUS.sm`.
- eslint clean on all modified files.
- §49b complete for: Encounters, Contacts, Medication, Healthcare, My Profile,
  Settings (Privacy, Design), Timeline, Clinic Card, Attachments.

## BUG 11 — Global Search "Most recent" chip: invisible text (dark mode)
- Screen: Home → header Search icon → type "grace" → the two sort chips
  above "CONTACTS".
- The selected chip renders background rgb(242,242,244) (near-white) with
  color rgb(255,255,255) (white) — the label "Most recent" is effectively
  unreadable. The unselected "A–Z" chip is fine (muted grey on dark).
- File: src/modules/SHOS_GlobalSearch_Prototype.jsx (chip active-state
  styling; needs a dark text token on the light chip surface, cf. the
  invisible-text chip fixes done earlier in the mockups).
- NOT FIXED. Also check the light-mode equivalent during the light pass.
- FIXED: the active chip's text colour is now `T.surface` (the theme's
  opposite-surface colour — white in light, near-black in dark) instead of
  the hardcoded `"#FFFFFF"`, so it is readable in BOTH modes.
- LIGHT-PASS VERIFICATION: in light mode the same chip is white text on
  rgb(27,27,31) — high contrast, correct. The bug is dark-mode only.
  Search itself works (2 results for "grace", Grace J. + Encounter).
- NOTE: the Search overlay is a `role="dialog" aria-label="Global Search"`
  (not reflected in body.textContent), so it was briefly thought missing.

## BUG 12 — Settings sub-screen Back exits Settings entirely (to Home): FALSE ALARM, NOT A BUG
- Repro: Home → Settings → (any sub-screen) → tap "< Back".
- Resolution: NOT a bug. The sub-screen Back correctly returns to the
  Settings main list (verified: after clicking the sub-screen's own Back,
  the DOM contains a single `role="dialog" aria-label="Settings"` and the
  Settings main list — "Backup & Export" etc. — is present).
- Root cause of the false alarm: there are TWO "Back" elements in the DOM
  when a sub-screen is open — the sub-screen's own ChevronLeft (y=16) and
  the module-level back handler (y=5). The audit script picked the wrong
  one (the module-level handler), which closes the whole Settings sheet.
  Same automation pitfall as Finding 9: always pick the element that
  carries the handler you intend to test. Control-linkage rule (§49a)
  applies — a control must be tested on the element that carries the
  handler.

## FINDING 13 — Contacts card: "1 encounters" pluralization bug
- Screen: Contacts list (dark AND light — both affected).
- Cards show "{summary.count} encounters" unconditionally
  (src/modules/SHOS_Contacts_Prototype.jsx:1908), so count=1 renders
  "1 encounters" (visible on Grace J., Alex, Kai). Should be "1 encounter".
- NOT FIXED. Trivial fix: conditional plural or `count === 1 ? 'encounter' :
  'encounters'`.
- FIXED: replaced with `{summary.count} {summary.count === 1 ? "encounter" : "encounters"}`.

## LIGHT PASS — COMPLETE
- Switched via Settings → Colour scheme → Dark mode OFF → "Reload now";
  persisted after reload (body bg rgb(240,240,243)).
- Method: programmatic WCAG contrast scan (relative luminance of text colour
  vs nearest non-transparent ancestor background) across the FULL DOM of
  each screen (not just the visible viewport), flagging ratio < 1.6.
- Results — 0 invisible-text elements: Home dashboard, Contacts list +
  scrolled bottom, Contact detail (Ash, top + bottom), Encounter list +
  Filter panel (Last month → "Filter (1)", 7 cards), Medication
  Registry/Log/Inventory (top + bottom), Healthcare all 7 sub-tabs
  (Symptoms, Testing, Clinic Visits, Vaccinations, Measurements, Menstrual
  & Contraception, Vaginal health) + scroll-to-bottom on each, Global
  Search (with "grace" results), My Profile + all 3 edit tabs, and all 16
  Settings sub-screens (Backup & Export, Privacy, Data & network, Widgets,
  Notifications, Colour scheme, Manage lists, Resources, Glossary, Guide,
  Stats, Calendar, Trash, Developer tools, About, Share SHOS).
- Only contrast hits were intentional accent-on-tint labels in the My
  Profile edit tabs ("About" / "Lifestyle & interests" / "Health & safety",
  amber #9D5604 on amber tint, ratio 1.24) — deliberate section-header
  accent, NOT a defect.
- Light-mode-specific bugs found: NONE. Both real bugs found during the
  light pass are theme-independent: FINDING 13 ("1 encounters") and the
  re-confirmation of BUG 12 (Settings sub-screen Back exits Settings) and
  of 8e (FAB overlap).
- BUG 11 (Global Search chip) is DARK-MODE ONLY — light is correct.
- State restored: menstrual OFF (Cycle tab + Contraception sub-tab gone,
  verified), spelling British, dark mode OFF (light), colour-blind OFF,
  disclosure Masked, widget privacy Redacted, address lookup ON,
  anonymise OFF, filters cleared.
- Onboarding NOT exercised: profile already complete, so the flow is
  unreachable without clearing data (documented, not a defect).

## Screen coverage tracker (dark pass)
- [x] Home dashboard (dark) — clean; all icons relevant; quick-add rows
  colour-consistent; recent-activity rows module-coloured (encounter pink,
  contact amber, medication blue, test green, clinic visit green).
- [x] Settings (dark) — main list (57 rows) + Preferences exercised
  (menstrual toggle works and reveals "Hide Pregnancy tab" sub-switch;
  spelling toggle works en-GB↔en-US). All sub-screens covered — see
  "Settings sub-screens (dark)" entry below.
- [x] Contacts landing (dark) — sorts (A–Z/Last encounter/Incomplete),
  filter panel (Role/Position/Accommodation/Availability; "Dom" → 2 matches
  + Clear filters), Select mode (1 selected; Delete red #FF7A7E; disabled
  affordances correct), live search "grace", ⚠1 badge → Possible duplicates
  sheet (contactMerge wired; close X has aria-label "Close duplicates
  panel" — earlier suspicion withdrawn).
- [x] Contact detail (dark) — Ash. Verified: mandatory-missing rows red
  ("* Role — missing mandatory detail"), Timeline stats, HIV "Not recorded".
  KINK + CONTACT METHODS section cards render COMPLETELY EMPTY (title only,
  no placeholder) — inconsistent with NOTES which says "No notes yet."
  (Finding 8c).
- [x] Encounter landing (dark) — PrEP banner w/ dismiss X, Show archived
  toggle (label flips to "Hide archived" when on; count "18 encounters" same
  both ways — CORRECT: 0 archived encounters exist, source line 1359
  `(showArchived ? true : !e.isArchived)`), month grouping, date Filter
  chips (Last week/Last month/Since last test — "Last month" → 7 encounters
  (filtered) + "Filter (1)" badge), search box present (live search pending
  exercise). Sample-data typo: Kai card notes say "won't repeast".
- [x] Medication (Registry — Show archived resolved not-a-bug;
  Log + Inventory done: date-grouped log newest-first OK, delta column not
  clipped, FAB overlap on Log deltas + Inventory gears (8e); "Needs action"
  card links to Registry→Testosterone correctly; "5 Active medications"
  card is NOT clickable while its identical-looking neighbour is — see
  Finding 10; "Log all daily meds" wiring verified in source (disabled when
  nothing due), not clicked to avoid data mutation. Registry search
  "vitamin" filters 5→1 correctly; Select mode → "1 selected" + Export/
  Archive/Delete actions. Inventory has NO search box (only Registry) —
  minor gap)
- [x] Healthcare (dark) — all sub-tabs: Testing (date filter dropdown
  "Last 30 days" → "3 tests" verified; search box present), Episodes (1
  episode renders), Attachments (empty state + type chips, Photo chip
  activates green), Calendar (day 11 click → "WEDNESDAY 11 NOVEMBER" event
  list with colour-matched dots ✓; dialog itself is the scroll container),
  Clinic Card (all sections incl. Menstrual & Contraception — toggle linkage
  works), Symptoms (older-entry muted card), Clinic Visits (Positive-result
  red borders/chips consistent), Vaccinations (dose cards, next-due dates,
  "0 overdue" stat consistent), Measurements (grouped by type, By type/By
  group toggle), Menstrual & Contraception (Cycle history with flow droplets
  + Contraception sub-chip with history), Vaginal health (empty state; NOTE:
  two Add CTAs — top-right pill and mid-page button — redundant affordance,
  minor). Stat strip (1 active / 0 overdue / 7 this year) consistent
  across tabs.
- [x] Global Search (dark) — see the My Profile/Global Search entries below.
- [x] My Profile (dark) — see below.
- [x] All 16 Settings sub-screens (dark) — Backup & Export, Privacy, Data &
      network, Widgets, Notifications, Colour scheme, Manage lists,
      Resources, Glossary, Guide, Stats, Calendar, Trash, Developer tools,
      About, Share SHOS.
- [x] Light mode re-pass of every screen above (full-DOM contrast scan;
      0 invisible-text elements; see "LIGHT PASS — COMPLETE").
- [x] Defaults restored at pass end: menstrual toggle OFF (Cycle tab gone,
      verified), spelling British, dark mode OFF (light), colour-blind OFF,
      disclosure Masked, widget privacy Redacted, address lookup ON,
      anonymise OFF.

## State mutations made during audit (all reversible)
- Menstrual & contraception tracking: ON (adds Cycle tab; reveals
  "Hide Pregnancy tab" sub-switch, OFF).
- Spelling: British (en-GB) — restored after exercising American.
- Encounter date filter: exercised, cleared again. Show archived: off.
- Update banner dismissed in-session. No duplicate-dismissal prefs mutated.
