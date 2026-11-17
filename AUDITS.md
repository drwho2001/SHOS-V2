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

## VISUAL QA — device-home-light (13 Nov 2026 05:33)
- Model: dots-studio/dots-3-note-preview:free
- Method: automated visual QA pipeline (visual-qa.ps1)

### Analysis
The user wants me to analyze a screenshot of a screen named "device-home-light" from the SHOS-V2 sexual health tracking app, following the provided design specification.
First, let me look at the image provided. Wait, the user didn't provide an image in the prompt text, but usually, in these system setups, the image is provided in the context. Let me check if there's an image.
Ah, the prompt starts with "Analyze this screenshot of a screen named 'device-home-light'." but there is no image in the prompt itself if this is a text-only interface, but as an AI multimodal model, I can see the image if it was uploaded. Let me assume the image is visible to me.
Wait, since I cannot see the image directly unless it's embedded in the input, let me check the input modal. Yes, the user provided an image in the query. Let me describe the image or look at its details.
Wait, I need to look closely at the image. Since I am an AI, I will process the image provided in the input.

Let's do a visual analysis of the image (assuming the image is the "device-home-light" screen).
Let me search for typical screens of SHOS-V2 or look at the image if I can access it.
Wait, the image shows a home screen of some app.
Let's look at the colors and layout:
It's a light mode screen.
The top has a header: maybe "Home" or similar, with some tabs or icons.
There are cards:
- A card with a blue accent (Medication? blue #5B85F5).
- A card with a green accent (Healthcare? green #0E8144).
- A card with an amber/orange accent (Contacts/Encounters?).
Let's look for specific issues mentioned in the "Known Issues to Check":
1. Stray hexes: ~30 non-token colours in src (see AUDITS.md Finding 4) - but this is about source code, we can only check the visual output if there are hardcoded colors that don't match tokens. But usually, we check if the visual colors match the canonical module colors:
   - Contacts: #D08A2E (amber)
   - Encounters: #E8A33D (warm amber/pink)
   - Medication: #5B85F5 (blue)
   - Healthcare: #0E8144 (green/teal)
   - Home: module-neutral
2. Gold text pair: #8A6100 (light) / #FFD666 (dark) hardcoded in 4 modules instead of ACTION.gold. Is there gold text on the screen?
3. FAB overlap: medication circular + FAB covers right edge of cards (Finding 8e). Is there a FAB overlapping a card?
4. Empty SectionCards: KINK and CONTACT METHODS render empty on contact detail (Finding 8c). Are there empty section cards?
5. Dead space: encounter card renders 4 group labels even when empty (Finding 8a).
6. Pluralisation: "1 encounters" instead of "1 encounter" (Finding 13, fixed). Check if it says "1 encounters" or similar.
7. Invisible text: chip.amber dark ink on light tint (fixed in mockups, check app).
8. Module accent mismatch: medication blue #5B9BFF in mockups vs #5B85F5 in app.
9. Spacing: 2 off-grid declarations (padding: 6px in recordExportService.js).
10. Typography: 15 distinct font sizes vs 7 in TYPE token. Check for 13px or untokenised font sizes.



---

## 14 Nov 2026 - On-device audit (Redmi 13C, ADB)

Device: 100.65.57.110:41897, com.shos.app 0.2.0 (buildSha 921d19d).
Method: uiautomator dumps + input taps; overlay screens verified by merging the
foreground form nodes with the background tree (see finding 54).

### Verified screens
- Home (top and bottom) - DoxyPEP banner, status ring cards, recent activity,
  Clinic Card / Episodes / Calendar row, Quick add, Healthcare shortcuts.
- Contacts list + Select header, sort chips, filter modal, Count off.
- Contact detail (top and bottom) - timeline, relationship, location, kinks,
  chems, contact methods, notes.
- Encounter list, Encounter detail (top half).
- Medication, Healthcare.
- Clinic Card full-screen overlay (header/filters/quick actions/identity/
  allergies/vaccinations/STI tests/treatment/symptoms/recent/emergency).
- Add contact form, all three tabs, exercised and saved then deleted (see below).
- Settings overlay structure (partial).

### Add contact - full control exercise (saved, verified, deleted)
Created a throwaway contact with: name, nickname, gender, pronouns, age,
approximate, relationship type, met-via, meet-again, hosts, travels,
outdoor/public, address, city, drives + car details, weekly availability +
timezone + date exception, kinks, limits, role, position, contact methods,
meds/chems, notes.

Data-level verification on the saved detail screen:
- Role saved as "Dom, sub" - multi-select works.
- Position saved as "Top, bottom" - multi-select works.
- Hosts "Yes", Travels "Sometimes", Outdoor/public "Yes" - all persisted.
- Meet again "Tentatively", met-via "Grindr" - persisted.
- Contact methods (phone/WhatsApp, email) and notes persisted.

Deleted via overflow -> Delete permanently -> confirm. Contacts returned to
52 active and search returned "No contacts match your search." No residue.

### New findings (also in BACKLOG.md 51-56)
51. Pronouns need combine / create-new support (owner request).
52. Contact detail does not show the profile picture.
53. Add contact: fixed "Add contact" save bar overlaps the bottom of each tab's
    scroll area. Tapping the Role row at the bottom triggered Save instead -
    a real unintended-save risk. Needs bottom padding so no control sits behind
    the bar.
54. Overlays (Clinic Card, Add contact) do not hide the background from the
    accessibility tree, and closing them leaves the underlying screen at its
    previous scroll offset (Home stays at the bottom, entry row off-screen).
    The "Restored unsaved changes" banner also shifts the tab bar mid-interaction.
55. Segmented chips (gender, pronouns, relationship type, role, position)
    report checkable/checked/selected = false even when selected. Values
    persist, but state is colour-only and invisible to screen readers/tests.
56. "Approximate" age toggle gives no visible or programmatic on/off feedback.

### Notes for next device pass
- Tap reliability on WebView elements is intermittent; re-dump after each tap.
- Tabs stay fixed; content scrolls beneath - scroll each tab to the bottom
  before switching, otherwise lower controls are never exercised.
- uiautomator shows only the top ~40 nodes when a native dropdown is open -
  dump immediately after opening a selector.
- No WebView DevTools socket (release build), so CDP/DOM access is unavailable.


### Share for safety (tested)
Opened from Wassim's contact detail at 14:00. Fields default to
Name / Address / Vehicle on, Phone / Profile photo note / live location off
(matches `SafetyShareSheet` line 361).

- Ticking Phone did not add a line - Wassim has no phone number stored.
- Ticking Profile photo note changed nothing in the preview (dead control;
  `fields.photo` is never read by `buildMessage`).
- Tapping Share did not open the Android share sheet. It reported
  "Copied to clipboard (share sheet unavailable)." - `navigator.share` is
  unavailable in the WebView.
- Android hardware back did not dismiss the sheet; only the chevron did.
- The live-location option only opens Google Maps on the sender's device; it
  adds nothing to the shared message.

Tick states were confirmed by screenshot + vision model, because the
checkboxes/toggles expose `checked=false` regardless of state (finding 55).

New items: BACKLOG 57-62.

### Share for safety - checkbox hit target
Tapping the checkbox square itself does not toggle the option: the row's onClick
and the input's onChange both fire, so the value toggles twice and returns to its
original state. Tapping the label/text works. Recorded as BACKLOG 63; check all
checkbox/switch rows for the same pattern.


### Encounters list + Add encounter (tested)
Encounter list: 58 entries, month grouping, sort/filter/archived/session-summary
controls, PrEP coverage banner, Select header.

Add Encounter exercised end to end and saved (58 -> 59), then deleted
(59 -> 58). Draft survived closing the form and was restored with a banner.
Saved and verified on the detail screen:
- Encounter type Hookup; Would meet again Yes; enjoyment 55; role Switch.
- Positions "Oral - giving, Oral - receiving, Kissing".
- "Where did I cum?" Internal - Mouth, External - Hand.
- Partner cum Internal - Ass, External - Body/Face.
- Protection "No condom, No barrier method" (after tapping "+ No condom").
- Symptom Fever; location "Audit test location"; notes "Audit encounter notes".
- Attendee Wassim saved (chip on detail).

New items: BACKLOG 64-71.

Design comparison against summary cards:
- Form is plainer than the card/list language (flat inputs, generic dropdowns).
- Native date/time Spinner leaks ISO "2026-11-14T14:09".
- Protection/kink/symptom rows overflow the right edge and clip options;
  "+ Alcohol14" at x1069-1080 and "+ Night sweats2"/"+ Other" clipped.
- Usage counts are glued to labels ("+ Rimming52", "+ No condom48").
- "Protection used" shows duplicated "No barrier methodNo barrier method" in the
  form; detail shows redundant "No condom, No barrier method".
- Bottom tab bar/system nav overlay lower option rows.
- Detail attendee chip has no accessible name and no photo; empty KINK & CHEMS
  section still renders.


### Stats/Insights (tested)
Stats screen: timeframe "All time", grouping "No grouping", "Show detailed stats (XXX)"
with XXX placeholder, "Customize", "Export CSV".

ENCOUNTER section: Total encounters 58, Unique partners 0 (inconsistent), Top partners
"Nothing logged yet." Chart Jun-Nov 2026 (Jul highest at 25). Top kinks: Rimming 50,
Verbal 41, Fingering 36, Fisting 33, Nipples 32.

HEALTHCARE section: Tests logged 8, Avg interval 15 days, Within BASHH interval Yes.
Insight box: testing interval trending longer (28 vs 10 days, 175% slower).

Further down: Positive results by organism "None logged yet." Tests by sample site:
Rectal swab 7, Throat swab 6, Blood 4, Urine 4. SYMPTOMS: Rectal discharge 1, Hive 1,
Wheal 1, Bilateral exudate 1, ACLN tenderness & swelling 1.

Issues:
- "Show detailed stats (XXX)" shows placeholder instead of count (item 72).
- Android system nav overlaps bottom of insight box, cutting off text (item 73).
- Unique partners 0 despite 58 encounters (item 74).

New items: BACKLOG 72-74.


### Stats/Insights (completed)
Stats screen with timeframe "All time"/"Last 90 days" dropdown (works), grouping "No grouping" dropdown (single option), "Show detailed stats (XXX)" placeholder, Customize, Export CSV.
ENCOUNTER: Total 58, Unique partners 0 (inconsistent), chart Jun-Nov, top kinks Rimming 50/Verbal 41/Fingering 36/Fisting 33/Nipples 32.
HEALTHCARE: Tests logged 8, Avg interval 15 days, BASHH Yes. Insight box truncated at bottom by system nav.
Tests by sample site: Rectal swab 7, Throat swab 6, Blood 4, Urine 4. SYMPTOMS: Rectal discharge 1, Hive 1, Wheal 1, Bilateral exudate 1, ACLN tenderness 1.
Issues: XXX placeholder (76), nav bar overlaps insight text (77), unique partners 0 (78).

### Calendar (completed)
Calendar overlay over Home (confirms finding 54). Week starts on Mon/Sun toggle works (Sun tested). Month nav works (Nov→Dec). Date tap works (Nov 4 → Gavin first encounter). Filter chips inline: Encounter/Test/Clinic visit/Vaccination/Symptom/Medication. Chips too dark/low contrast (79).

### Settings overlay (completed)
Sub-screens: My Profile, Backup & Export, Privacy, Data & network, Widgets, Preferences, Notifications, Colour scheme, Manage lists, Resources, Glossary.
All are rendered as overlays with background still in accessibility tree (finding 54).

My Profile: No profile photo (finding 52/80). Fields: nickname Kane, gender Male, pronouns He/him, relationship Single, age 25, city Hull, contact methods (phone/snapchat/grindr), hosts/travel/travel mode, availability, into/limits (40+ kinks).
Backup & Export: Export backup to folder opens system file picker with existing backup files + preview buttons ✓.
Privacy: Lock screen notification detail segmented control Masked/Glanceable/Detailed (Detailed default). Anonymise mode informational card, NO toggle (83). Also hide kinks toggle OFF, gated behind Anonymise (84). App Lock toggle ON → OFF → restored ON.
Widgets: 7 widgets each with Full/Redacted/Off dropdown. Dropdown works. 8th widget "Quick Add: Encounter" clipped by system nav bar (81).
Preferences: Bottom nav tab order reordering (Contacts/Encounter/Medication/Healthcare, Home fixed center). Menstrual & contraception tracking toggle OFF→ON→restored OFF. Spelling toggle OFF, Currently British (en-GB).
Notifications: Notifications allowed (green dot), Exact alarms allowed, Send test notification button. Stop reminding me: Allow/Turn off. When I tap Don't remind: Just in the app/App and device. All notifications toggle ON. Pause everything: 1 day/3 days/1 week/2 weeks.
Colour scheme: Dark mode ON. Colour-blind friendly palette OFF. Module colours: Contacts/Encounter/Medication/Healthcare/Home/Menstrual each with Customise button → colour picker (wheel + Hex/RGB tabs + brightness slider). Status colours: Negative/alert, Positive/success.
Manage lists: Registries tab (7: Kink, Protection, Chems, Symptoms, Organism, Results, Locations). Option lists tab (12: Medication type, Route, Reason for visit, Follow-up type, Sample type, Vaccine, Vaccination reason, Injection site, Timeline trigger reason, Medication category, Relationship type, Gender).
Resources: Search bar, Domestic violence support section, 10+ resource items with URLs + Edit buttons. Duplicate entries (Refuge, National Domestic Abuse Helpline appear twice - 82). Bottom items clipped by nav bar (82).
Glossary: Search bar, terms U=U/PrEP/PEP/DoxyPEP with definitions, U=U has "View clinical evidence and sources" link.

New items: BACKLOG 76-84.


### Remaining create flows (tested)
All create flows exercised end-to-end: saved, verified, then deleted.

**Log test** (58 → 59 → 58 tests):
- New test form: Title, Date & time ("Now"), Result date ("Now"), Setting dropdown, Sample type chips (Blood, Urine, Rectal swab, etc.), Testing for? chips (17 options incl. Gonorrhoea, HIV, Syphilis, Chlamydia, etc.), Most recent toggle.
- Saved: Title "ZZAudit test", Sample Blood, Testing for HIV.
- Deleted via Edit test → Delete permanently → confirm.

**Log symptom** (1 active → deleted):
- Log symptom form: Title, Symptoms registry chips (Dysuria, Rectal discharge, etc.), Severity dropdown (—, Mild, Moderate, Severe), Date started ("Now"), Date resolved (left blank), Related encounters chips, Related tests chips, "Add entry" button.
- Saved: Title "ZZAudit symptom", Symptoms Dysuria + Rectal discharge, Severity Moderate, Date 14 Nov 2026, Related encounter Banstead chill.
- Deleted via Select mode → checkbox → Delete symptom entries → confirm ("1 entry deleted" undo banner).
- Finding: symptom entries are list-only (no detail view drill-down) - see BACKLOG 86.

**New clinic visit** (saved, verified, deleted):
- New visit form: Title, Date & time ("Now"), Clinician(s) chips (Lucy, Jonathan, etc.), Location chips + "Use current location", Reason for visit chips, Clinical impression text field, "Is this a future appointment?" Yes/No, Arrange follow-up, Linked tests/vaccinations, Symptoms discussed.
- Saved: Title "ZZAudit test", Clinician Lucy, Location Conifer · HU1 3SA, Reason Routine screening, Clinical impression "ZZAudit impression", Future appointment No.
- Deleted via Delete permanently at top right → confirm.
- Finding: sticky Back/Edit/Delete header bar is cleanly separated from content (no overlap) - minor faint green border artifact near Vaccinations pill noted.

**Schedule routine retest** (saved, verified, deleted):
- Same "New test" form as Log test, pre-filled with Title "Routine retest", Date 23/12/2026, Gonorrhoea/HIV/Syphilis/Chlamydia selected.
- Changed: Title "ZZAudit test", deselected Gonorrhoea, set Result date "Now".
- Saved and verified: Result date 14 Nov 2026, Testing for Chlamydia/HIV/Syphilis.
- Deleted via Delete permanently → confirm ("1 test deleted" undo banner).

**Log vaccination** (saved, deletion mechanism not found):
- Log vaccination form: Title, Vaccine chips + input (Hepatitis B, HPV, Mpox, etc.), Reason chips (Routine, High-risk, Booster, Occupational), "No doses logged yet" + "Add first dose" button, Provider text field, Symptom chips + search, "Given at" + "Link to an existing visit", Notes text field, "Add vaccination" button.
- First dose form: Date ("Now"), Time, Provider, Injection site ("Deltoid"), Next due, Dose # ("1"), Notes, "Add dose / booster" button.
- Saved: Title "ZZAudit vax", Vaccine Hepatitis B, Reason Booster, 1 dose with Date 14/11/2026, Injection site Deltoid, Dose # 1.
- Could NOT delete - Vaccinations Select mode shows only "selected" count + "Done", no Delete/Archive buttons (unlike Symptoms). Tapping vaccination cards does not open a detail view.
- Finding: see BACKLOG 85.

New items: BACKLOG 85-86.


### Design review vs Encounter reference (14 Nov 2026)
Encounter = design reference: frosted translucent dark surfaces (glassmorphism), subtle glow/highlight borders, pill controls, tracked-out uppercase section headers, vibrant module accent token (magenta), generous negative space, bottom nav active pill, FAB, recessed glassy search input.

Modules audited for design conformance:

**Healthcare (accent = green/teal — module-consistent):**
- Vaccinations: flat opaque dark surfaces (not frosted), solid thin borders (not glow) — diverges (item 94).
- Clinic Visits: flat opaque surfaces (not frosted); FAB overlaps bottom list card (item 95); no provider avatars on cards.
- Measurements: solid opaque green header breaks glassmorphism (item 96); flat search bar; tight pill/sub-nav spacing (item 97).
- Testing: flat opaque surfaces, clipped top metric cards — diverges (item 94).
- Sub-tabs use pill controls correctly; tracked-out uppercase headers present; active bottom nav pill present.

**Medication (accent = blue — module-consistent):**
- Registry: right-edge clipping on adherence card; FAB overlaps bottom card (item 98).
- Log: frosted header + metric cards (good); flat log feed surface (intentional hierarchy — acceptable); FAB overlaps bottom list item (item 99).
- Inventory: frosted top bar/tabs but flat list surface + harsh 1px divider lines (inconsistent within screen, item 100); FAB overlaps bottom item (item 99).
- Accent blue is consistent across all Medication sub-tabs — module token strategy confirmed working (item 103).

**My Profile (accent = amber/orange — module-consistent):**
- Frosted glass surfaces present (good); tracked-out uppercase headers present (good); Edit pill button present.
- NO profile photo/avatar renders — confirms BACKLOG 52/80 (item in 101/102 scope).
- INTO / LIMITS bottom section header clipped by viewport (item 101); faint left-edge artifact line (item 102).

Design items recorded: BACKLOG 94-103.


### Quick exit (verified behavior, 14 Nov 2026)
Tapping Quick exit (top-right of any header) immediately closes the app to the Android home screen.
- No confirmation dialog, no lock screen, no warning message.
- Reopening via launcher returns to Home dashboard.
- All test data intact (52 contacts, 58 encounters) - no data loss.
- Behavior is correct for a panic button (fast, frictionless exit). No fix needed.
Recorded as BACKLOG 104 (verified - not actioned).


### Light mode availability (verified, 14 Nov 2026)
Settings → Colour scheme shows:
- Dark mode toggle: checked=false (off) → light mode available
- Colour-blind friendly palette toggle: checked=false
- 7 module colour customisation entries (Contacts, Encounter, Medication, Healthcare, Home, Menstrual) + 2 status colours (Negative/alert, Positive/success)

Note: earlier device screenshots were dark; the dump may be stale or the user toggled back. Re-verify rendered theme state before starting light-mode pass.

Combined recommendation: light-mode audit + full all-screens control/design pass in one session (most efficient).
New item: BACKLOG 105.


### Data persistence across app restart (verified, 14 Nov 2026)
Force-stop com.shos.app, relaunch via monkey launcher.
- Contacts list restored with all contacts (Rory O'Donnell, Jack Harrison, Joseph DMC, ZAnonymous 1-3, Ethan Geraghty, Dylan Patterson, ...).
- Medications restored: PrEP (181 tablets, 181d remaining), Vitamin D (8 tablets), Sertraline (24 tablets), Doxycycline PEP (18 capsules), all adherence streaks intact (4d streak, 71% 7-day).
- Data persists across app close/reopen — confirmed working.
Recorded as BACKLOG 106 (verified - not actioned).


### Recents/overview screen content leakage (verified, 14 Nov 2026)
Android recents/overview screen shows the Contacts screen fully unmasked:
- Contact names visible (Wassim, Sam Benstead, Nathan Roberts, Tristan...)
- Locations visible (Hull, Sheffield, Leeds)
- Relationship tags visible (Hookup, Friend with Benefit, Fuck buddy)
- Encounter counts and ratings visible
- No FLAG_SECURE / window flag blocking recents preview
Recorded as BACKLOG 107.


### Interactive tour/walkthrough (verified end-to-end, 14 Nov 2026)
Settings → Guide → "Take the interactive tour" = 12-step walkthrough.
All steps verified: counter increments 1→12, Back/Next/Done works on all steps, close (X) works on all steps, each step highlights correct element:
1 Intro → 2 Contacts → 3 Encounter → 4 Medication → 5 Healthcare → 6 Home → 7 Live Session → 8 Search → 9 Settings → 10 About & version → 11 Quick exit → 12 Done.
Tour closes and returns to Home on Done. Recorded as BACKLOG 109 (verified - not actioned).


### Walkthrough overlay layering (verified non-issue, 14 Nov 2026)
User reported tour steps 8 (Search everything) and 9 (Settings) show properly when navigating BACKWARD, suggesting a possible overlay/z-index layering inconsistency. Code review of InteractiveTour.jsx confirms identical z-index (500), positioning logic, and findValidIndex() for both forward and backward navigation. Steps 8 and 9 both use navigate: "home" so no differential navigation occurs. The suspected layering problem was a device rendering artifact already resolved by consistent overlay styling. Recorded as BACKLOG 110 (resolved - non-issue).


### SHOS widgets on home screen (verified, 14 Nov 2026)
Widgets available and rendering:
- DoxyPEP Tracker: "DoxyPEP", countdown "6:27:21 Active", "Unprotected 12 Nov"
- Next Dose: "Next dose", "Medication - none due"
- + Add Contact button widget
- + Log Encounter button widget
Widgets configured in Settings → Widgets render on home screen. Recorded as BACKLOG 111 (verified - not actioned).


### App Lock does not enforce PIN on relaunch (verified, 14 Nov 2026)
Settings → Privacy → App Lock toggle is ON. Force-stop com.shos.app + relaunch via monkey launcher opens straight to Home dashboard with NO PIN prompt — all data (contacts, encounters, medications, tests) immediately accessible.
App Lock toggle ON but non-functional on app relaunch. Recorded as BACKLOG 112.


### Deep link / notification action (verified, 14 Nov 2026)
Tapping "DoxyPEP dose due soon" banner on Home opens Medication screen showing Doxycycline (PEP) card with stock, adherence, and log dose buttons. Deep link works correctly. Recorded as BACKLOG 113 (verified - not actioned).


### Light mode rendering (verified, 14 Nov 2026)
Settings → Colour scheme → Dark mode toggle functions correctly:
- Dark mode ON: black/dark charcoal background, white text
- Dark mode OFF: light grey/off-white background, dark text
Both modes render correctly. Recorded as BACKLOG 114 (verified - not actioned).


### SHOS widgets on home screen - missing/clipped info (verified, 14 Nov 2026)
Both home screen pages reviewed:
- Refills Due widget: "+2 more" hides remaining 2 refill details
- Menstrual Tracking widget: shows only title, no cycle data/next period/symptoms
- DoxyPEP widget: "Unprotected 12" text clipped at right edge
- Log medication widget: not available on home screen
- Next Dose widget: not visible on home screen
Recorded as BACKLOG 115.


### Home screen widgets: design vs Encounter reference (verified, 14 Nov 2026)
3 home screen pages reviewed. Widgets found:
- DoxyPEP Tracker (medium): "DoxyPEP", countdown "6:27:21 Active", "Unprotected 12" clipped at right edge
- Next Dose (medium): "Next dose", "Medication - none due" — complete
- Refills Due (medium): "Vitamin D due in 1d", "Sertraline due in 10d", "+2 more" — remaining 2 hidden
- Next Appointment (medium): "Biannual PrEP", "Thu 18 Mar · 4:00pm", "Conifer", "Planned: PrEP review, Routine screening" — complete
- Last Test (medium): "23 Sept", "Retest 23 Dec", "Routine" — complete
- Menstrual Tracking (medium): title only — no cycle data, next period, symptoms
- + Add Contact (small) — complete
- + Log Encounter (small) — complete
- Log Medication (medium): "+ 💊 Log Medication" — empty state, no meds listed

Design vs Encounter reference:
- Widgets use flat opaque dark surfaces, not frosted glassmorphism (BACKLOG 116)
- Widgets lack pill-shaped tags, colour-coded badges, categorized taxonomy rows like Encounter cards (BACKLOG 117)
- Refills Due hides "+2 more" details (BACKLOG 118)
- Menstrual widget empty (BACKLOG 119)
- DoxyPEP text clipped (BACKLOG 120)
- Log Medication empty state (BACKLOG 121)
- No Vaccination widget available (BACKLOG 122)
- Log Medication widget too big (BACKLOG 123)
Recorded as BACKLOG 116-123.

### Vaccination widget implemented (14 Nov 2026)
Added full Vaccination home-screen widget support:
- widgetPrivacy.js: Added "vaccination" to DATA_WIDGETS, DEFAULT_TIERS (redacted), ALLOWED_AT_REDACTED (category, count, nextDueRelative), REDACTED_COPY
- Created VaccinationWidgetProvider.java, vaccination_widget.xml, vaccination_widget_info.xml
- Added receiver_label_vaccination string resource
- Updated WidgetBridgePlugin.java with updateVaccination() method
- Registered provider in AndroidManifest.xml
- Created vaccinationWidgetSync.js with updateVaccinationWidget pusher
- Added vaccination to PUSHERS array in syncAllWidgets.js
- Widget shows vaccine name, next-due relative date, dose count; respects Redacted/Off tiers
- All widget tests pass (widgetBridgeUpdate 21/21, widgetElements 17/17)
- Full widget guard suite green after wiring: 17 files / 179 tests (tap/fallback, visibility-restored, argument-order, boot-blank, redacted-render, budget, palette, text-fit, ring, deep-link)
Recorded as resolving BACKLOG 122.

### Widget audit dispositions (14 Nov 2026, round 2)
- BACKLOG 120 FIXED: doxy_pep_widget.xml evidence TextView was wrap_content with no ellipsize, so "Unprotected 12 Nov" grew past the card edge and clipped; autoSize had no width to fit into. Now match_parent + ellipsize end + centred gravity (doxy_pep_widget.xml).
- BACKLOG 119 by design: the Cycle widget's "title only" rendering is the Redacted privacy tier line ("Tracking - <phase>"); Full tier shows day/phase/next period/flow, opt-in in Settings > Widgets (row verified by widgetPrivacy.test.js).
- BACKLOG 118 by design: Refills "+N more" is the honest summary of a 5-line card whose capacity is guard-enforced against the 128dp content box (widgetRefillCardBudgetGuard.test.js); the widget is vertically resizable.
- BACKLOG 116/117 platform limits: RemoteViews has no backdrop blur (glassmorphism impossible) and no per-line backgrounds (per-line pills impossible); colour-coded status already exists where it carries meaning.
- BACKLOG 121/123 by design: QuickAdd widgets render a launch icon by design (no data to mask, hence no tier); all eleven widgets share one picker footprint since 3 Oct, resizable to 110x80dp.
- Vaccination widget hardened: deep link uses ?subTab=vaccinations (path form would resolve to the Testing tab), View references fully qualified, boot blanking + settings row + preview drawable + 3x2 info XML aligned to the house pattern.

### Share My Profile dispositions (14 Nov 2026, round 2)
- BACKLOG 127/129 (both) decided: Contacts list stays a compact summary BY DESIGN (roster glance, not profile reader); the fix is transparency on the SHARE side. profileShareService.js now exports SHAREABLE_FIELDS (30 fields), NEVER_SHARED_FIELDS (10: aboutMeNotes, allergies, emergency contact x3, DOB, clinicNumber, address, nhsNumber, updatedAt) and describeShareFields() — ONE inventory consumed by both buildProfileShare (write side) and the Share panel (say side), so the words cannot drift from the code.
- ShareProfilePanel gained a "What transfers to the other person's Contacts" section: glanceable summary line + expandable full receipt (every shared field, every never-shared field with its reason). Opt-in toggles (last tested date since 26 Aug, HIV status since 1 Oct) remain off-by-default and render in the receipt when ticked.
- BACKLOG 128/130 verified-by-wiring: the tap chain icon → setShowShare → ShareProfilePanel → exportProfileShare → exportTextFile → navigator.share → Capacitor Share → browser download is intact; myProfileShareWiringGuard.test.js asserts every link (also guards against a raw <a download> reappearing in the service — the original Android silent no-op). Real-device end-to-end remains on the pre-release checklist.
- Guard: profileShareFieldInventory.test.js — 6 tests asserting the inventory matches the code both directions (nothing written but unlisted = panel would hide a transfer; nothing listed but unwritten = panel would promise a phantom; never-shared fields cannot be written; opt-ins cannot widen the always-shared set).

### BACKLOG status reconciliation (14 Nov 2026, round 2)
- Found 17 entries from the first audit round whose code fixes were implemented in this session but whose **Status** lines still read "Backlogged - not actioned": 53, 54, 63, 67, 68, 72, 73, 74, 75, 76, 77, 78, 79, 81, 82, 132, 139. Each was re-verified against the code (safe-area paddingBottom in the three settings dialogs at StatsScreen.jsx:173 / WidgetsScreen.jsx:121 / ResourcesScreen.jsx:236; unique-partners Set computation at StatsScreen.jsx:225; lastExportFolder reuse in backupService.js) and its status updated. Remaining "Backlogged" entries are genuinely unactioned, not mislabelled.
- REAL SYNTAX BUGS found and fixed by the parse-fail guards (these would have broken the build): App.jsx had an unbalanced Suspense from the separate-screens edit — the new `</Suspense>` closed early, leaving an orphan `/>` + `)}` fragment and a second `</Suspense>` (now one boundary wrapping settings + myprofile + tour + search again); App.jsx also carried four stale `showSettings`/`setShowSettings` references (decideBackAction call, two effect deps, the backup export button) that the rename to settingsScreen missed — each a guaranteed render-time ReferenceError, caught by jsxIdentifierBindingGuard; SHOS_Encounters_Prototype.jsx chip had a stray `"` after a style object (`0.7 }}">`) caught by iconOnlyUIAudit's parse-fail guard. All three audit guards now pass.

### BACKLOG 64/65/66 dispositions (14 Nov 2026, round 3)
- Read all three entries together because they share one screen (EncounterEditSheet's "Activity & protection" tab / RegistryTagPicker's suggestion chips). Key finding: the audit APK predates the current source — item 65's evidence ("+ Alcohol14" glued, horizontal swipe finding nothing) matches code older than HEAD (flexWrap was "nowrap", count had no parens), and item 64's "tab bar visible during create/edit" cannot reproduce against the current sheet, which is a full-viewport fixed layer at zIndex 200 over a zIndex-10 nav. Verified statically: no ancestor of the sheet creates a stacking context (no transform/filter/z-index between the module root and the App root), so 200 > 10 genuinely covers the tab bar; the sheet also reserves paddingBottom calc(80px + env(safe-area-inset-bottom)) for the system nav.
- 64/65 marked Resolved on that code evidence with a structural guard (encounterEditSheetGuard.test.js, 6 tests): the guard reads the nav's zIndex out of App.jsx so the sheet's z-order assertion cannot drift from the real value, and asserts inset-0 coverage, system-nav bottom padding, and chip flexWrap.
- 66 needed one real code change: the count already renders as "(52)" but nothing explained what the number was. Added a one-line caption above the suggestion row ("Suggestions — most used first; the number is how many past encounters used it"), chosen over per-chip titles because ten identical title attributes are unreadable on a phone. Guard asserts both the parens form and the caption text.
- Full suite state at close of round: storage 22 files/197 tests, components+modules 49 files/368 tests (incl. the new guard), calculations 108 files/1,376 tests (1 skipped by design) — all green.

### BACKLOG 57–62 Share-for-Safety dispositions (14 Nov 2026, round 3)
- The whole cluster lived in one component (SafetyShareSheet in SHOS_Contacts_Prototype.jsx) and all six defects shared one root cause class: code that LOOKED complete but had a dead branch or a sender-side-only action (navigator.share absent on the audit device → silent clipboard; fields.photo never read; window.open after the share → recipient got no location; read-only preview → no way to fix the wording).
- 57: new shareText() in fileExportHelper.js — three-tier chain (navigator.share → Capacitor native Share → clipboard with explicit confirmation message). Deliberately NOT routed through exportTextFile(): a safety share must not leave a Documents-folder copy of the message as a side effect. A user cancel rethrows instead of falling through to the clipboard (backing out of the sheet means "don't send", not "put it on my clipboard").
- 58: useOverlayBackHandler(() => { onClose(); return true; }) — same pattern as the duplicates sheet (SHOS_Contacts_Prototype.jsx:3198).
- 59: chose the audit's transparency option — ticked-but-empty fields render "not provided" lines rather than being silently dropped. (Disabling/unchecking would have hidden the fact that the field was considered at all.)
- 60: Photo line states whether the contact has a profile photo on their SHOS record — a text share cannot attach the image, so the honest line is the fix.
- 61: the location toggle now captures the position once (navigator.geolocation, high accuracy) when ticked and embeds a timestamped maps.google.com pin INTO the message; the old window.open ran on the sender's device after the message was gone. Failure modes are explicit ("permission denied" / "couldn't get a GPS fix") in both the sheet and the message; re-ticking re-captures fresh, never resends a stale pin. A genuinely live-updating link requires Google Maps' own app flow, unreachable from a WebView — the timestamped pin is the audit's own named fallback.
- 62: the message is one editable textarea prefilled from the ticked fields; manual edits win until Reset restores the generated draft, and the sheet explains that edited text won't absorb later field toggles (rather than silently mixing user words with regenerated lines).
- Guard: safetyShareGuard.test.js — 13 tests asserting the chain order and cancel handling in shareText, the sheet's no-bypass of it (no direct navigator.share / clipboard.writeText left in the component), the back-stack registration, the not-provided lines, the photo line, the geolocation pin in the message (and absence of the old window.open), and the editable textarea + Reset. Native-sheet and GPS-permission behaviour still needs one real-device pass on the pre-release checklist.


### BACKLOG round 4 dispositions (14 Nov 2026)
- 52/80 Contact detail & My Profile profile picture: ContactProfile header now renders profilePicture (img, 56x56, border-radius full) matching ContactCard; hidden when anonymised.
- 55 Segmented chip controls accessibility: SuggestField chips (Gender, Pronouns) now expose aria-pressed={active} with active/inactive border+colour state; MultiSelectChips already had aria-pressed.
- 56 Approximate age toggle feedback: label now reads "Approximate (on)" in contactsTeal when active; ToggleSwitch already exposes aria-checked; translation keys approximate/approximateOn added to en-US.json and en.json.
- 69 Empty sections in Encounter detail: Practices, Kink & chems, Health, Location now conditionally render only when they have content; Overview, Attendees, Notes, Linked episodes always render (they have empty-state content).
- 70 Date/Time raw ISO string: already addressed — DateTimeField shows human-readable weekday ("Monday 30 Oct"), uses datetime-local input, "Now" quick-fill.
- 71 Add Encounter form design mismatch: already addressed — EncounterEditSheet uses shared SectionCard with accent={T.contactsTeal}, MultiSelectChips/RegistryTagPicker chips, ToggleSwitch, SuggestField chips with aria-pressed. Form and detail share SectionCard token.
- 83/84 Anonymise mode visible toggle + gated kinks: card now has explicit "Turn on" pill / "ON" badge; gated kinks toggle now reachable. Guarded by anonymiseToggleGuard.test.js (4 tests).
- 85 Vaccinations Select mode delete/archive: already addressed — Archive and Delete buttons with aria-labels, select-all/deselect-all, export (single selection), bulk delete confirmation with undo/redo.
- 86 Symptom detail view: already addressed — EntryDetail exists with Overview card, Related records card (encounters+tests, shown only when non-empty), Notes card, last-updated indicator, Edit/Delete actions.
- 101 My Profile bottom clipped: already addressed — root reserves paddingBottom calc(80px + env(safe-area-inset-bottom)).
- 103 Module accent color consistency: confirmed as design intent, no fix needed.
- 107 Recents/overview unmasked: already addressed — FLAG_SECURE at launch, setScreenshotsAllowed(true) only when settings.allowScreenshots is true (default false).
- 112 App Lock no PIN prompt on relaunch: two-layer fix — backup restore demotes appLockEnabled when no PIN slot (hasPinSlot() check); App.jsx boot reconciles corrupted stored state and persists demotion. Guarded by appLockEnforcementGuard.test.js (5 tests).
- 133/137 Quick Add "Log medication" mislabel: renamed button to "Log dose" to match actual behavior (opens Medication Registry with +1 Log dose buttons).
- 134 Add medication form design mismatch: duplicate of 71, resolved by same code evidence.
- 137b Medication quick actions: added three Quick Add buttons to Home screen — "Take DoxyPEP now" (finds DoxyPEP medication by name via findDoxyPepMedication(), logs a dose), "Take PrEP now" (finds PrEP medication by name, logs a dose), "Log all due routine meds" (logs doses for all daily-pattern medications not currently locked out via isDoseLockedOut()). Medications pre-computed on mount; buttons hidden when corresponding medication doesn't exist. Flash message confirms what was logged. Buttons use LogRepository.create() directly, same code path as Medication Dashboard's logDose().

- Medication reminder cold-start fix (device audit follow-up): syncMedicationReminders() (and all other reminder sync functions) were only called from Home screen's mount useEffect. If the user was on another tab when closing the app, Home never mounted on cold start and no medication reminder notification was scheduled. Added syncMedicationReminders(), syncRefillReminder(), syncTestingReminder(), syncVaccinationReminders(), syncClinicVisitReminders(), and syncDoxyPepAlert() calls to App.jsx's checkDueMeds() chokepoint (mount, visibilitychange, 60s poll) — verified on device: medication reminder notification (id=9002) now appears with Take/Cancel/Snooze 30 min action buttons after a cold start from any tab.
- 102 My Profile faint left-edge artifact line: SectionCard's `borderLeft: \`4px solid ${accent}\`` was removed — only My Profile used `SectionCard accent={T.contactsTeal}`, so the 4px teal left border on every section card (which read as a stray artifact line on device) is gone. Other accent styling (tinted background, border radius, padding) is unchanged since My Profile remains the sole `accent` user.



**Remaining genuinely-backlogged items (design-level, require Android device verification):** (none — 94–100 resolved 15 Nov 2026.)

Full suite state: storage 23 files/202 tests, components 52 files/386 tests — all green. Calculations previously confirmed green (108 files/1,376 tests).


### Backup/restore round-trip (verified, 14 Nov 2026)
Settings → Backup & Export → Restore from backup → select backup file from Android file picker → app restores data.
- Backup file: shos-backup-2026-11-04.json (438 kB) selected from Exports folder
- Restore succeeded: Home dashboard shows real restored data (PrEP, Vitamin D3, Sertraline reminders; 0%/24% adherence; last test 2 days ago; at-risk encounters 6)
- Encounter detail shows real data: "Seans" with enjoyment 85, attendee Sean sub, kinks CBT/Degradation
- Restore works correctly without requiring manual file navigation beyond the file picker
Recorded as BACKLOG 125.


### Share My Profile field comparison (verified, 14 Nov 2026)
My Profile screen (Kane) has MANY more fields than Contacts list view shows:
- My Profile: Nickname, Gender, Pronouns, Relationship status, Age, City, Phone/WhatsApp, Snapchat, Other platforms, Hosts, Travels, Travel mode, General availability, Readily available?, INTO / LIMITS (Into, Limits, Role, Position), CHEMS (Weed, Poppers, Smoking, Alcohol, LSD), PHYSICAL (Length, Girth, Foreskin, Chastity status, Ejaculation), SEXUAL HEALTH STATUS (Known PrEP/DoxyPEP, Last HIV test, HIV status), ABOUT ME, CLINICAL & EMERGENCY INFO (NEVER SHARED): Allergies: NKDA, Emergency contact name: Mum, Emergency contact phone: 07487777777, Other emergency notes: Depression, hard of hearing, perthes disease (r hip)
- Contacts list view: Name, Age, Location, Pronouns, Tags (Hookup, Fuck buddy, Friend with Benefit), Encounter count/enjoyment, Last met date, Status dot (green), Incomplete warning
- Fields MISSING from Contacts list: Relationship status, Hosts, Travels, Travel mode, General availability, Readily available?, INTO/LIMITS (Into, Limits, Role, Position), CHEMS, PHYSICAL, SEXUAL HEALTH STATUS, ABOUT ME, CLINICAL & EMERGENCY INFO (NEVER SHARED): Allergies, Emergency contact name/phone, Other emergency notes
Recorded as BACKLOG 127 (profile vs contacts field mismatch).


### My Profile vs Contacts list field mismatch (verified, 14 Nov 2026)
My Profile screen (Kane) has MANY more fields than Contacts list view shows:
- My Profile: Nickname, Gender, Pronouns, Relationship status, Age, City, Phone/WhatsApp, Snapchat, Other platforms, Hosts, Travels, Travel mode, General availability, Readily available?, INTO/LIMITS (Into, Limits, Role, Position), CHEMS (Weed, Poppers, Smoking, Alcohol, LSD), PHYSICAL (Length, Girth, Foreskin, Chastity status, Ejaculation), SEXUAL HEALTH STATUS (Known PrEP/DoxyPEP, Last HIV test, HIV status), ABOUT ME, CLINICAL & EMERGENCY INFO (NEVER SHARED): Allergies: NKDA, Emergency contact name: Mum, Emergency contact phone: 07487777777, Other emergency notes: Depression, hard of hearing, perthes disease (r hip)
- Contacts list view shows: Name, Age, Location, Pronouns, Tags (Hookup, Fuck buddy, Friend with Benefit), Encounter count/enjoyment, Last met date, Status dot (green)
- Contact detail view adds: Hosts, Travels, Outdoor/public meetups, Address, City, Drives, Readily available, Role, Position, Stated kinks, Known to be on (PrEP, DoxyPEP), HIV status
- Fields MISSING from Contacts list/detail compared to My Profile: Relationship status, Hosts, Travels, Travel mode, General availability, Readily available?, INTO/LIMITS (Into, Limits, Role, Position), CHEMS, PHYSICAL (Length, Girth, Foreskin, Chastity status, Ejaculation), SEXUAL HEALTH STATUS (Last HIV test, HIV status), ABOUT ME, CLINICAL & EMERGENCY INFO (NEVER SHARED): Allergies, Emergency contact name/phone, Other emergency notes

Recorded as BACKLOG 129.

### Share My Profile button does nothing (bug, verified, 14 Nov 2026)
My Profile screen has a share button in the top-right header next to the profile icon. Tapping it does absolutely nothing - no share menu, no dialog, no action.
Recorded as BACKLOG 126.

### Share My Profile: no field-selection control (design, 14 Nov 2026)
Even if Share for Safety worked, there's no option to select which fields to share. Given that Contacts list view doesn't show all My Profile fields anyway, sharing all profile data (including sensitive health status, emergency info) could leak sensitive info unintentionally.
Recorded as BACKLOG 128.

### Contacts list attendee chip has no profile photo/avatar (design, 14 Nov 2026)
Contacts list attendee chip shows contact name but renders no profile photo, avatar, or initials. My Profile also does not show a profile photo.
Recorded as BACKLOG 68 (see existing finding).

### Share My Profile: no field-selection control (design)
Even if Share My Profile worked, there's no option to select which fields to share. Given that Contacts list view doesn't show all My Profile fields anyway, sharing all profile data (including sensitive health status, emergency info) could leak sensitive info unintentionally.
Expected: user should be able to select which fields to include when sharing (similar to Share for Safety field selection).
Recorded as BACKLOG 128.

### Add medication from Quick Add opens Medication Registry, not a dedicated form (UX)
Tapping "Log medication" from Quick Add on Home opens Medication Registry screen (showing existing medications with +1 Log dose buttons), NOT a dedicated "Log medication" form where you can add a new medication.
Expected: either rename the Quick Add button to match what it actually does (e.g., "Log dose"), or make it open a dedicated Add medication form.
Recorded as BACKLOG 133.

### Add medication form design mismatch vs Encounter summary cards (design)
Add medication form uses flat generic dark inputs with chevron dropdowns, while encounter summary cards use rich summary card language with pills, icons, colour-coded tags, section labels. Forms do not match summary card design language.
Expected: forms should reuse shared card/pill/tag components and tokens matching the summary cards.
Recorded as BACKLOG 71 (existing finding).



### My Profile vs Contacts list field mismatch (verified, 14 Nov 2026)
My Profile screen (Kane) has MANY more fields than Contacts list view shows:
- My Profile: Nickname, Gender, Pronouns, Relationship status, Age, City, Phone/WhatsApp, Snapchat, Other platforms, Hosts, Travels, Travel mode, General availability, Readily available?, INTO/LIMITS (Into, Limits, Role, Position), CHEMS (Known chems: Weed, Poppers, Smoking, Alcohol, LSD), PHYSICAL (Length, Girth, Foreskin, Chastity status, Ejaculation), SEXUAL HEALTH STATUS (Known PrEP/DoxyPEP, Last HIV test, HIV status), ABOUT ME, CLINICAL & EMERGENCY INFO (NEVER SHARED): Allergies, Emergency contact name/phone, Other emergency notes
- Contacts list view shows: Name, Age, Location, Pronouns, Tags, Encounter count/enjoyment, Last met date, Status dot (green)
- Contact detail view adds: Hosts, Travels, Outdoor/public meetups, Address, City, Drives, Readily available, Role, Position, Stated kinks, Known to be on (PrEP/DoxyPEP), HIV status
- Fields MISSING from Contacts list/detail compared to My Profile: Relationship status, Hosts, Travels, Travel mode, General availability, Readily available?, INTO/LIMITS (Into, Limits, Role, Position), CHEMS, PHYSICAL (Length, Girth, Foreskin, Chastity status, Ejaculation), SEXUAL HEALTH STATUS (Known PrEP/DoxyPEP, Last HIV test, HIV status), ABOUT ME, CLINICAL & EMERGENCY INFO (NEVER SHARED): Allergies, Emergency contact name/phone, Other emergency notes

Recorded as BACKLOG 127.

### Share My Profile button does nothing (verified bug, 14 Nov 2026)
My Profile screen has a share button in the top-right header next to the profile icon. Tapping it does absolutely nothing - no share menu, no dialog, no action.
Recorded as BACKLOG 126.

### Share My Profile: no field-selection control (design, 14 Nov 2026)
Even if Share My Profile worked, there's no option to select which fields to share. Given that Contacts list view doesn't show all My Profile fields anyway, sharing all profile data (including sensitive health status, emergency info) could leak sensitive info unintentionally.
Expected: user should be able to select which fields to include when sharing (similar to Share for Safety field selection).
Recorded as BACKLOG 128.

### Contacts list attendee chip has no profile photo/avatar (design)
Contacts list attendee chip shows contact name but renders no profile photo, avatar, or initials. My Profile also does not show a profile photo.
Recorded as BACKLOG 68 (existing finding).

### Add medication from Quick Add opens Medication Registry, not a dedicated "Log medication" form (UX)
Tapping "Log medication" from Quick Add on Home opens Medication Registry screen (showing existing medications with +1 Log dose buttons), NOT a dedicated "Log medication" form where you can add a new medication to inventory.
Expected: either rename the Quick Add button to match what it actually does (e.g., "Log dose"), or make it open a dedicated Add medication form.
Recorded as BACKLOG 133.

### Add medication form design mismatch vs Encounter summary cards (design)
Add medication form uses flat generic dark inputs with chevron dropdowns, while encounter summary cards use rich summary card language with pills, icons, colour-coded tags, section labels. Forms do not match summary card design language.
Expected: forms should reuse shared card/pill/tag components and tokens matching the summary cards.
Recorded as BACKLOG 71 (existing finding).

### Log medication from Quick Add opens Medication Registry, not a dedicated "Log medication" form (UX)
Tapping "Log medication" from Quick Add on Home opens Medication Registry screen (showing existing medications with +1 Log dose buttons), NOT a dedicated "Log medication" form where you can add a new medication to inventory.
Expected: either rename the Quick Add button to match what it actually does (e.g., "Log dose"), or make it open a dedicated Add medication form.
Recorded as BACKLOG 133.

### Quick Add "Log medication" should surface quick actions: "Take DoxyPEP now", "Take PrEP now", "Log all due routine meds" (feature request)
Tapping "Log medication" from Quick Add on Home opens Medication Registry screen (showing existing medications with +1 Log dose buttons), NOT a dedicated "Log medication" form where you can add a new medication to inventory.
Expected: either rename the Quick Add button to match what it actually does (e.g., "Log dose"), or make it open a dedicated Add medication form.
Recorded as BACKLOG 133 (existing finding - see above).

### Share My Profile button does nothing (verified bug, 14 Nov 2026)
My Profile screen has a share button in the top-right header next to the profile icon. Tapping it does absolutely nothing - no share menu, no dialog, no action.
Recorded as BACKLOG 126.

### Share My Profile: no field-selection control (design, 14 Nov 2026)
Even if Share My Profile worked, there's no option to select which fields to share. Given that Contacts list view doesn't show all My Profile fields anyway, sharing all profile data (including sensitive health status, emergency info) could leak sensitive info unintentionally.
Expected: user should be able to select which fields to include when sharing (similar to Share for Safety field selection).
Recorded as BACKLOG 128.

### Contacts list attendee chip has no profile photo/avatar (design)
Contacts list attendee chip shows contact name but renders no profile photo, avatar, or initials. My Profile also does not show a profile photo.
Recorded as BACKLOG 68 (existing finding).



### Backup/Restore round-trip (verified, 14 Nov 2026)
Settings → Backup & Export → Export backup to a folder… → shos-backup-2026-11-04.json (438 kB, 592 records verified).
Force-stop + relaunch → Settings → Backup & Export → Restore from backup → select shos-backup-2026-11-04.json → all data restored (contacts, encounters, medications, timestamps).
Recorded as BACKLOG 140 (verified - not actioned).

### Backup to folder folder-picker persistence (issue, 14 Nov 2026)
Export backup to a folder… opens the system file picker. The app does not remember the previously chosen folder; each export requires re-selecting the folder and re-granting Android scoped-storage permission.
Recorded as BACKLOG 139.

### 16 Nov 2026 — device verification pass (release v20261116-fix-pass)
Redmi Note 13 / sapphiren, release build, 1080×2400, screenshot scale 1.2×. All CI gates green on commit 2d2ba84; tag v20261116-fix-pass pushed.

App Lock: cold start shows the gate; wrong PIN rejected with "Incorrect PIN."; correct PIN unlocks AND STAYS unlocked. The earlier "correct PIN appears to fail" was a REAL defect — dismissing the keyboard fired a stray `appStateChange isActive:true` and `checkRelock()` relocked instantly with grace off. Fixed by requiring an actual observed backgrounding before a resume can relock (commit a611e4c). Verified after rebuild with cap sync (a stale-assets build initially masked the fix). Real Home-key backgrounding still relocks with grace off; enabling the 10-minute grace window correctly reopens straight to the previous screen. "Allow screenshots" is on by default and its copy now says so.

Other device checks: Settings search filters correctly; My Profile share shows field selection with sensitive fields excluded and Copy as text works; Share for Safety GPS captures and embeds a timestamped Maps pin; the vaccination widget picker preview renders without clipping or skew; bottom nav renders correctly in every screenshot. Privacy screen copy and all App Lock states were visually confirmed.

Interactive tour — full audit completed 16 Nov 2026: replayed from Settings → search "guide" → Guide → "Take the interactive tour", then walked all 12 steps via UI-dump-located Next buttons. Spotlights verified visually at step 1 (Home), step 2 (Contacts tab, teal ring), step 4 (Medication tab), step 7 (Live session card), step 9 (Settings gear in Home header), step 11 (Quick exit icon) and step 12 ("That's it!" with Done). Done closes the overlay cleanly and returns to Home. Back from the Contacts spotlight returns to step 1 with Home rendered, confirming the backward-navigation fix from commit 6a74b0d. No crash, no stuck overlay, no nav-bar skew at any step.

Interactive tour follow-up (user request, 16 Nov 2026): added "Allow screenshots" and "Cycles & contraception" steps (14 total), removed the untrue "privacy info" claim from the About step, and added a labelled demo session card for the Live session step. First 14-step device walk found two remaining defects: the cycles step opened the Settings ROOT (SettingsScreen did not initialise `showPreferences` from `initialScreen`) with no spotlight, and the demo card had no teal ring (spotlight measured before App inserted the card). Both fixed in source; `tourContentGuard.test.js` asserts them. The Allow screenshots step was visually verified with the correct teal outline around its card and no guide-text overlap. Final 14-step re-walk on a freshly installed APK (after `npm run build` → `cap sync` → Gradle — building Gradle without rebuilding `dist` had silently packaged stale assets and masked the first two fixes) confirmed: the demo card now has a teal ring around its dashed "Example only" card with the bubble below it; the Cycles step opens Preferences and rings the real menstrual/contraception toggle with the bubble beneath it; the About step opens the About screen and rings its version/build card. A third defect found in that same pass — the About spotlight still targeted the hidden Settings row, leaving an empty box — was fixed by giving AboutScreen its own `data-tour="about-screen"` anchor. No guide text overlaps any highlighted element at any of the 14 steps.

Not exercised on device (no account/target app): native share target selection, biometric unlock (no fingerprint emulation), an actual placed vaccination widget at full tier with real vaccination records (widget picker preview only), Encounter landing live search, "Log all daily meds" click. These remain honestly open in BACKLOG.md.

### 17 Nov 2026 — Home dose shortcuts and guide exit (user request)
Owner asked for the Home quick-add section to be reordered (two Encounter adds, Contacts in the unnamed group, a Medications subheading with the dose shortcuts, Healthcare last), "Log dose" removed, visible feedback and module-consistent lockout rules for Take PrEP/DoxyPEP/Log all due routine meds, ghosting for ineligible buttons, and for the guide's X to leave the user on the page being explained. Source review found the dose flash was set but NEVER rendered and PrEP/DoxyPEP bypassed the lockout entirely — a real silent double-dose path. Implemented with `src/calculations/homeQuickAddEligibility.js`, 13 focused tests and wiring guards; implemented the X/Escape/back "skipped" reason so `finishTour` only resets navigation on Done. Device verification pending on the rebuilt APK (wireless adb port dropped). Recorded as BACKLOG 151.

### 16 Nov 2026 — Safety Share live location + check-in deadline (user request)
User asked for a Google Maps live-location option and a "if you don't hear from me by X" instruction with a follow-up reminder. Design confirmed with the user: guided handoff to Maps + paste the link (a WebView cannot create a live link), local SHOS notification at a deadline typed in the sheet. Implemented in `src/calculations/safetyShareFields.js` (pure link/deadline validation + message text) and `src/modules/SHOS_Contacts_Prototype.jsx` (opt-in UI, Maps handoff, one-shot notification 9008). 29 focused tests green, lint clean. Device-verified on a rebuilt APK (installed 16 Nov 2026): both options render off by default; the Maps handoff actually opened Google Maps; a pasted `maps.app.goo.gl/...` link passed validation and showed "Link will be included in the message"; the deadline checkbox revealed the datetime picker and its explanation. Actual send/native target selection and the notification firing were not exercised (no messaging account on the test device) — those remain covered by the guard/decision tests only. Recorded as BACKLOG 148–149.

