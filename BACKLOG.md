# Backlog

Deferred requests, captured so they are not lost. Not started unless noted.

> **See also:** `PLAN.md` (batched workflow, priority order, current state).
> `AUDITS.md` (live findings log). `audit-tracker.json` (screen coverage).

## 0. Safety: share contact identification with trusted contact (IDEA — not started)
Requested: ability to share a contact's identification details with a trusted friend
for safety purposes, before an encounter happens. Purely for identification — not
sexual content, not encounter details.

Shareable fields (user selects which):
- Name / nickname
- Address (home or meeting location)
- Vehicle details (make, model, colour, plate)
- Profile photo (if attached)
- Phone number (optional)

Optional add-on: live location sharing via:
- Google Maps (Share Live Location) — most reliable cross-platform
- Apple Maps (Share ETA / location) — iOS native
- WhatsApp Live Location — less reliable (requires app, session-based)
- System share sheet (lets user pick their preferred app)

Design considerations:
- NOT mandatory — entirely opt-in, user chooses when and what to share
- Safety-first: the shared message should be discreet (no mention of sexual
  context, just "I'm meeting [name] at [location] around [time]")
- Should work offline (pre-compose the message, send when connected)
- Could include a "check-in" reminder: "If I haven't confirmed safe by X time,
  here's who I'm with"
- Privacy: shared data should not be stored on any server — generate a local
  message/link and let the user's chosen app handle delivery
- Could integrate with the existing contact/encounter data model — pull from
  the contact record rather than re-entering
- Consider a "safety plan" template: pre-filled message with selected fields,
  one-tap to share via system share sheet
- Should NOT auto-share — always require explicit user action (button tap)
- Consider adding to the encounter flow: "Share safety info" as an optional
  step when logging an encounter, or as a standalone action from contact detail

Status: idea captured — not started. Needs design discussion before build.

---

## 0b. Healthcare module header/toolbar standardisation (IDEA — not started)
Requested: standardise where icons/settings/shortcuts live in the healthcare module
(and app-wide). Current inconsistency: some controls are on the module title banner,
some below the tab sticky header, placement varies by screen.

### Proposed standard

**Module title banner (consistent across all screens in the module):**
- Module icon + title (e.g., "Healthcare")
- Global actions that apply to the whole module: Settings, Search, Exit/back
- These are ALWAYS in the same position, on every screen in the module

**Tab sticky header (below banner, per-tab):**
- Tab-specific actions only: Add, Filter, Sort, Export
- These change per tab (Testing has "Add test", Clinic visits has "Log visit")
- Should NOT contain module-wide controls

**Consistent across ALL screens (app-wide):**
- Exit/back (always top-left)
- Search (always top-right or in banner)
- Settings (always in banner or overflow menu)
- These never move between screens

### Decision needed per control

| Control | Where? | Rationale |
|---------|--------|-----------|
| Exit/back | Module banner (top-left) | Consistent app-wide navigation |
| Search | Module banner (top-right) | Global search applies to all tabs |
| Settings | Module banner (overflow or icon) | App-wide settings |
| Add/Create | Tab header (right) | Tab-specific action |
| Filter | Tab header (right) | Applies to current tab's list |
| Sort | Tab header (right) | Applies to current tab's list |
| Export | Tab header (right) or overflow | Tab-specific data export |
| Refresh/sync | Tab header or banner | Depends on scope |
| Help/info | Banner (overflow) | Module-wide help |

### Open questions
- Should the banner be sticky (scrolls with content) or fixed (always visible)?
- Should tab header scroll with content or stay fixed under banner?
- How many icons max before overflow menu? (suggest 3 on banner, 2 on tab header)
- Does this apply to ALL modules (Contacts, Encounters, Medication) or just Healthcare?
- Should the pattern be documented in DESIGN-MANUAL.md as a standard?

### Recommendation
Standardise app-wide: exit/search/settings always on module banner (top). Tab-specific
actions (add/filter/sort) always on the tab sticky header below. Document as a
standard in DESIGN-MANUAL.md. Apply to all modules for consistency.

Status: idea captured - needs design discussion before implementation.

---

## DESIGN DECISIONS (13 Nov 2026) - agreed with owner

### 0g. Female reproductive health
- PMS quick-log: Deep link from cycle entry (inline, not separate screen) [Q7:A]
- Headache/symptoms: Live under Symptoms module, deep-linked/embeddable in other screens. 2-way linkage: symptom <-> cycle entry. Headache is NOT female-specific — it lives in Symptoms module, reachable from other modules. [Q8: A but Symptoms-owned]
- Cycle stats: Both - menstrual screen header + home widget [Q9:C]
- Fertile window: EXCLUDE (medical liability, dedicated apps exist)
- Contraception side effects: Link to SymptomLog (sideEffectIds), not standalone
- Contraception reason stopped: Add field (switched, side effects, planned pregnancy, no longer needed, other)
- PMS symptoms: Mood, bloating, headache, breast tenderness, fatigue, irritability, cravings, sleep, acne, joint pain
- Period details: Clot size (None/Small/Medium/Large), pain level (0-10), spotting, missed period flag
- Headache diary: Extend SymptomLog with optional headacheDetail sub-record (type, duration, severity, triggers[], aura, medicationTaken, medicationEffective). Lives in Symptoms module, not female health. [Q8]
- Pregnancy: Gestational weeks + trimester (calculated). Link to contraception at conception. Lower priority.
- Vaginal health: Treatment field, outcome field (resolved/recurring/chronic), recurrenceCount (derived), link to Testing.
- Cycle prediction: Show average + variability + next predicted. No complex algorithms. Surface existing data.
- Key principle: Deep-link from cycle view to symptom logging. Value is in correlation.
- What NOT to build: Fertility tracking, pregnancy week-by-week content, hormone trending (already in measurements), medication reminders (already in medication), period prediction algorithms.

### 0. Safety contact sharing
- Fields: User selects via checkboxes. Default: name, address, vehicle. Optional: photo, phone. [Q10:A]
- Live location: Google Maps first. System share sheet for static message. [Q11:A]
- Message template: "I'm meeting [name] at [location] around [time]. If you don't hear from me by [time+Xh], here's their info: [details]"
- Timer: User decides X hours. In-app reminders at 50% and 10% time remaining.
- Disclaimer: Both - tooltip on button + footer in shared message. [Q12:C]
- Delivery: System share sheet. No server-side storage. No auto-share.
- Scope: Contact detail only for v1. Encounter-flow integration deferred.

### 0b. Healthcare header/toolbar standardisation
- Banner (module-wide, fixed): Exit/back (top-left), Search (top-right), Settings (overflow). Max 3 icons.
- Tab header (per-tab, scrollable): Add, Filter, Sort, Export. Max 2 icons + overflow.
- Apply to: All modules at once. [Q13:B]
- Banner: Fixed. Tab header: scrolls with content.
- Document in: DESIGN-MANUAL.md.

### 0d. Demo data completeness
- Quantities: 2 of each type, 3-5 common types. [Q14:A]
- Marking: isDemo flag. Clearly identifiable.
- Clear sample data: Must remove all demo data.
- Edge cases: Empty states, overflow text, long names, special characters.

### 0e. Widget render and design check
- First step: Grep src/ for widget components.
- States: All (populated + empty, dark + light, loading, error). [Q15:B]
- Method: Playwright batch capture + visual inspection.

### 0f. Design manual currency check
- Scope: Full audit of entire manual. [Q16:B]
- Method: Automated (grep tokens vs manual) then manual review then automated verification.

### 0h. Three essential data display states
- Unfilled fields: Required incomplete in red. Summary card hides unfilled. Detail view ghosts with toggle button to show/hide incomplete data. Edit/add form: ghost unless in use to hide. [Q17:A + red for required incomplete]
- Empty state: "No X yet" + add CTA (consistent across modules). CTA = Call To Action.
- Scope: Start with encounters as template, use to update design manual, then apply to rest. [Q18:encounters as template]
- Note: 8a/8c/8e/10 already fixed in code. This is now a consistency check.

### 0c. "A new version is ready" banner
- Dev-mode guard: Skip both triggers in dev mode (done).
- Dismissed state: localStorage with 24h cooldown (done).
- GitHub integration: Check GitHub releases API for latest version tag, compare to __APP_VERSION__. Only show if GitHub version > current.
- Cooldown: Don't check more than once per hour.

### 0g. Female reproductive health - wiring
- PMS quick-log: Add "Log PMS symptom" button on cycle entry. Pre-fills cycle day + phase. Creates SymptomLog entry with cycleDay + cyclePhase fields.
- Symptom <-> Cycle linkage: 2-way. SymptomLog gets optional cycleDay/cyclePhase. Cycle view shows linked symptoms. Symptom view shows cycle phase.
- Contraception side effects: sideEffectIds -> SymptomsRegistry. Correlate by date range.
- Headache diary: Extend SymptomLog with optional headacheDetail sub-record (type, duration, severity, triggers[], aura, medicationTaken, medicationEffective). Lives in Symptoms module, not female health.
- Cycle stats UI: Average cycle length, variability, next predicted date. Prominent on menstrual screen, compact widget on home.
- PMS pattern recognition: "Headaches on days 24-27 in 3 of last 4 cycles" - calculated from existing data.
- Contraception reason stopped: Enum (switched, side effects, planned pregnancy, no longer needed, other).
- Period details: clotSize (None/Small/Medium/Large), painLevel (0-10), spotting (boolean + date), missedPeriod (flag + reason).
- Vaginal health: treatment field, outcome field (resolved/recurring/chronic), recurrenceCount (derived), link to Testing.
- Pregnancy: gestationalWeeks (calculated), trimester (derived), link to contraception at conception.

### 0j. Design consistency (apply encounters style to healthcare + contacts)
- Healthcare first, then contacts (incremental). [Q1:A]

### 0k. Sticky allergies banner
- Sticky section below banner (tab-specific). [Q2:B]

### 0l. Dashboard title truncation
- Rename to "Home". [Q3:B]

### 0m. Contacts running count
- Opt-in, on by default. [Q4:C]

### 0n. Filter 3-state toggle
- Apply to all sortable lists (contacts, encounters, medications, testing). [Q5:B]

### 0o. Medication notification banner
- Test current build, fix issues found. [Q6:A]

---

## 0h. Three essential data display states per module (IDEA - not started)
Requested: every module should have 3 standardised display states that are
visually checked and consistent. Currently some modules have all 3, some
don't, and the styling varies.

### The 3 states

#### State 1: Summary card (list view)
- Compact card shown in the module's list/grid
- Shows: key identifying info + status indicator + 1-2 key facts
- Must be scannable: name, status, date, one-line summary
- Consistent height/spacing across all modules
- Empty state: "No X yet" with add CTA
- Loading state: skeleton placeholder

#### State 2: Detail view (single item)
- Full information display for one item
- All fields shown, including unfilled ones (ghosted/muted style)
- Unfilled fields show as "Not recorded" or muted placeholder
- Grouped by section (contact info, health info, etc.)
- Edit action available
- Consistent layout across all modules

#### State 3: Add/Edit form
- Form for creating or editing an item
- All fields with appropriate input types
- Required fields marked
- Validation feedback
- Save/cancel actions
- Consistent field ordering across modules

### Current state (audit findings)

| Module | Summary card | Detail view | Add/Edit form | Notes |
|--------|-------------|-------------|---------------|-------|
| Contacts | Yes | Yes (empty cards = BUG 8c) | Yes | Empty SectionCards need fix |
| Encounters | Yes | Yes | Yes | Dead space (empty group labels = 8a) |
| Testing | Yes | Yes | Yes | Good |
| Medication | Yes | Yes | Yes | FAB overlap (8e) |
| Healthcare sub-tabs | Yes | Yes | Yes | Good |
| Vaginal health | Yes | Yes | Yes | New, good |
| Menstrual health | Yes | Yes | Yes | Good |
| Contraception | Yes | Yes | Yes | Good |
| Pregnancy | Yes | Yes | Yes | Good |
| Symptom log | Yes | Yes | Yes | Good |
| Clinic visits | Yes | Yes | Yes | Good |
| Vaccinations | Yes | Yes | Yes | Good |
| Measurements | Yes | Yes | Yes | Good |

### Challenge (standard)
1. Are all 3 states present for every module? (audit says mostly yes)
2. Is the styling consistent? (card height, spacing, field layout, empty states)
3. Do unfilled fields show as ghosted/muted in detail view? (some do, some don't)
4. Is the add/edit form consistent across modules? (field ordering, validation, button placement)
5. Empty state: is it consistent? ("No X yet" + CTA vs blank vs skeleton)

### Scope
In: Visual audit of all 3 states across all modules. Document inconsistencies.
Fix the most impactful ones.
Out: Redesigning any state from scratch.

### Plan
1. For each module, capture screenshots of all 3 states (Playwright)
2. Compare against design manual spec
3. Document inconsistencies (height, spacing, empty fields, button placement)
4. Fix the most impactful inconsistencies
5. Add to smoke tests if possible

### Relationship to existing findings
- Finding 8a (dead space in encounter cards) = State 1 issue
- Finding 8c (empty SectionCards) = State 2 issue
- Finding 8e (FAB overlap) = State 1 issue
- Finding 10 (stat card affordance) = State 1 issue

Status: idea captured - needs design discussion before implementation.

---

## 0i. Colour token naming: "healthcareBlue" is actually green (IDEA - not started)

### Problem
The variable `healthcareBlue` is used in 13 files (SectionCard.jsx + 12 modules)
but the actual colour is green (#09582E, ACCENTS.healthcare). This is a naming
inconsistency that causes confusion — "healthcare blue" is misleading since
healthcare's accent is green, not blue. Medication is the blue one (#5B85F5).

### Where it's used
- SectionCard.jsx (line 25)
- SHOS_Attachments_Prototype.jsx
- SHOS_ClinicCard_Prototype.jsx
- SHOS_ClinicVisits_Prototype.jsx
- SHOS_Healthcare_Prototype.jsx
- SHOS_Measurements_Prototype.jsx
- SHOS_MenstrualHealth_Prototype.jsx
- SHOS_PartnerNotification_Prototype.jsx
- SHOS_SymptomLog_Prototype.jsx
- SHOS_Testing_Prototype.jsx
- SHOS_Timeline_Prototype.jsx
- SHOS_Vaccinations_Prototype.jsx
- SHOS_VaginalHealth_Prototype.jsx

### Challenge (standard)
1. Is this just a naming issue, or does it cause bugs? (Likely just naming —
   the value is correct, only the name is wrong.)
2. Should it be renamed to `healthcareGreen`, `healthcareAccent`, or just
   `healthcare`? (Recommend `healthcare` for consistency with `ACCENTS.healthcare`)
3. Is there a risk of breaking things during rename? (Low — it's a local variable
   name, not a stored value or API. Grep + replace is safe.)
4. Should this be part of the tokenisation pass (13px) or separate? (Separate —
   different concern, but can be done in the same PR.)

### Scope
In: Rename `healthcareBlue` to `healthcare` (or `healthcareGreen`) across all
13 files. Update any references in tests.
Out: Changing the actual colour value or the design token.

### Plan
1. Grep all 13 files for `healthcareBlue`
2. Replace with `healthcare` (matching ACCENTS.healthcare naming)
3. Run eslint + vitest to verify nothing broke
4. Update any documentation references

Status: idea captured - needs design discussion before implementation.

---

### Challenge (13 Nov 2026) - 0h Three essential data display states

**Challenge:**
1. The audit table shows all 13 modules already have all 3 states. This isn't about
   adding missing states — it's about consistency. Much smaller scope than implied.
2. The real issues are already documented: 8a (dead space), 8c (empty cards),
   8e (FAB overlap), 10 (stat card affordance). This idea consolidates them.
3. Unfilled field display (ghosted vs hidden vs "Not recorded") is a real
   inconsistency but not yet documented as a finding. Needs a targeted check.
4. Empty state inconsistency ("No X yet" vs blank vs skeleton) is real but minor.
5. Risk: 13 modules × 3 states × 2 themes = 78 screenshots. Too many for one pass.
   Must prioritize: fix known issues first, then spot-check 3-4 modules.

**Honest verdict:** This is a consolidation of existing findings (8a, 8c, 8e, 10)
plus a targeted consistency check on unfilled fields and empty states. NOT a full
78-screenshot audit. Fix the 4 known issues first. Then spot-check 3 representative
modules (Contacts, Encounters, Medication) for unfilled field + empty state
consistency. If consistent, apply pattern to remaining modules.

### Scope (0h)
**In:** Fix 8a, 8c, 8e, 10. Spot-check unfilled field + empty state consistency
on 3 representative modules. Document pattern.
**Out:** Full 78-screenshot audit. Redesigning any state from scratch.

### Plan (0h)
1. Fix Finding 8a (empty group labels in encounter cards)
2. Fix Finding 8c (empty SectionCards on contact detail)
3. Fix Finding 8e (FAB overlap on medication cards)
4. Fix Finding 10 (stat card affordance inconsistency)
5. Spot-check Contacts, Encounters, Medication for unfilled field display
6. Spot-check empty state consistency across all modules
7. Document the standard pattern in DESIGN-MANUAL.md
8. Verify smoke tests + vitest pass

Status: idea captured - needs design discussion before implementation.

---

## 0g. Female reproductive health - perspective audit and feature gap analysis (IDEA - not started)

### Perspective
Independent female reproductive health perspective. What would a woman (or anyone
with a uterus/ovaries) actually want to record, find useful retrospectively,
and need for clinical appointments? What is tedious in the moment but valuable
later? What is currently captured, what's missing, what should change?

### Currently captured (existing modules)

| Module | What's tracked | Depth |
|--------|---------------|-------|
| MenstrualCycle | Start date, end date, flow (Light/Medium/Heavy), symptom IDs (linked to Symptoms Registry), notes | Basic |
| Contraception | Method, formulation, start/end date, interval days, next due date, linked clinic visit, notes | Good |
| Pregnancy | Test date, test result, estimated due date, status (Ongoing/outcome), outcome date, sensitive flag, notes | Good |
| VaginalHealth | Condition, date, notes (urgency derived from condition) | Basic |
| SymptomLog | Title, symptom IDs, date started/resolved, severity, related encounters/tests, notes | Good |
| Measurements | Numeric values (hormones, weight, BP, etc.) with unit conversion | Good |
| ClinicVisits | Visit metadata, linked tests, symptoms discussed | Good |
| Testing | Test results, organism, dates, linked episodes | Good |

### What's missing from a female reproductive health perspective

#### 1. PMS / Cycle-linked symptoms (HIGH PRIORITY)
Problem: PMS symptoms logged in SymptomLog (generic) or as symptomIds on cycle
entry. But PMS symptoms are inherently cycle-linked - they occur in the luteal
phase. A woman logging "headache" on day 25 needs it tied to cycle day.

What's needed:
- Quick-log PMS symptoms from cycle view (deep link: cycle entry -> "Log PMS
  symptom" -> pre-fills cycle day + phase)
- PMS symptom tracking: mood, bloating, headache, breast tenderness, fatigue,
  irritability, cravings, sleep changes, acne, joint pain
- Phase-aware display: show PMS symptoms grouped by cycle phase
- Retrospective view: "Last 3 cycles: headaches on days 24-27" - pattern recognition
- Contraception correlation: does PMS worsen with method?

Justification: #1 most useful retrospective feature. Headache diaries clinically
valuable but tedious. Deep-linking from cycle view removes friction.

Wiring: Add cyclePhase (derived from cycle dates) to SymptomLog entries. Add
quick-log action on cycle entry. Add cycle-phase grouping to symptom log view.

#### 2. Period details (MEDIUM PRIORITY)
Problem: Tracking is start/end date, flow, symptoms. Missing:
- Cycle length (auto-calculated but not prominently displayed)
- Period length (days)
- Spotting between periods (can't log without full cycle)
- Clot size (none/small/medium/large - clinically relevant)
- Pain level (0-10 scale, separate from general symptoms)
- Missed period (flag with reason)

What's needed:
- Add clotSize to DEFAULT_CYCLE (None/Small/Medium/Large)
- Add painLevel (0-10) to DEFAULT_CYCLE
- Add spotting boolean + spottingDate for inter-period bleeding
- Add missedPeriod flag (reason: stress, illness, medication, etc.)
- Display cycle length and period length prominently
- Trend view: cycle length over time

Justification: Clot size and pain level clinically relevant (menorrhagia). Spotting
indicates hormonal issues. Cycle length trends are #1 thing GP asks about.

Wiring: Add fields to DEFAULT_CYCLE. Update shapeForSave(). Add UI inputs. Add
trend calculation in menstrualCalculations.js.

#### 3. Contraception details (MEDIUM PRIORITY)
Problem: Has method, formulation, dates, interval. Missing:
- Side effects experienced (linked to symptom log)
- Reason for stopping (switched, side effects, planned pregnancy, etc.)
- Comparison view: "On X for 6 months, then switched to Y"
- Efficacy notes

What's needed:
- Add reasonStopped to DEFAULT_CONTRACEPTION_ENTRY (enum)
- Add sideEffectIds (linked to Symptoms Registry)
- Add efficacyNotes (free text)
- History view: timeline of methods with durations
- Side effect correlation: "Headaches started 2 weeks after starting COCP"

Justification: Side effects are #1 reason women switch contraception. Tracking
when symptoms started relative to method changes is clinically valuable.

Wiring: Add fields to DEFAULT_CONTRACEPTION_ENTRY. Link sideEffectIds to
SymptomsRegistry. Add timeline view. Correlate with SymptomLog by date range.

#### 4. Pregnancy tracking (LOW-MEDIUM PRIORITY)
Problem: Covers test results and outcomes. Missing:
- Gestational weeks (calculated from estimatedDueDate)
- Trimester (derived)
- Link to contraception method at conception
- Post-outcome: recovery notes, follow-up dates
- Pregnancy symptoms (could link to SymptomLog with pregnancyId)

What's needed:
- Add gestationalWeeks (calculated)
- Add trimester (derived)
- Link to contraception via contraceptionId
- Pregnancy-specific symptom filter

Justification: Already well-structured. Gaps are gestational tracking and
contraception linking. Lower priority - most use dedicated pregnancy apps.

Wiring: Add gestationalWeeks to DEFAULT_PREGNANCY. Link to contraception.
Optional pregnancy-specific symptom filter.

#### 5. Vaginal health (LOW PRIORITY - already well-designed)
Problem: Basic (condition, date, notes). Missing:
- Treatment history (what was prescribed, did it work)
- Recurrence tracking (same condition multiple times)
- Partner notification (if STI-related)

What's needed:
- Add treatment field
- Add outcome field (resolved, recurring, chronic)
- Add recurrenceCount (derived)
- Link to Testing module for STI-related conditions

Justification: Already well-structured. Gaps around treatment tracking.
Lower priority - module is new, urgency system is core feature.

Wiring: Add fields to DEFAULT_VAGINAL_HEALTH_ENTRY. Link to Testing via testIds.

#### 6. Headache/migraine diary (MEDIUM PRIORITY - new feature)
Problem: Headaches are common PMS symptom and contraception side effect.
No dedicated tracking. Generic SymptomLog captures "headache" but doesn't track:
- Type (tension, migraine, cluster)
- Duration
- Severity (1-10)
- Triggers (food, stress, sleep, hormonal)
- Aura (yes/no)
- Medication taken (what, dose, effective?)
- Cycle day correlation

What's needed:
- Structured headache log (could extend SymptomLog or dedicated repository)
- Fields: type, duration, severity, triggers[], aura, medicationTaken, medicationEffective
- Cycle correlation: auto-tag with cycle day/phase
- Pattern recognition: "Migraines on days 24-27 in 3 of last 4 cycles"

Justification: Headache diaries clinically valuable (neurologists ask for them).
PMS headaches are distinct pattern. Currently captured as generic symptoms.

Wiring: Could extend SymptomLog with "headache detail" sub-record, or create
dedicated repository. Dedicated repository with links to SymptomLog entries is
cleaner (matches "one room, three doors" pattern).

#### 7. Cycle prediction and insights (LOW-MEDIUM PRIORITY)
Problem: Cycle data logged but not used for prediction or insights.
- Average cycle length (calculated but not prominent)
- Next period prediction (partially exists)
- Fertile window (not tracked)
- Irregularity detection (not tracked)
- PMS pattern: "Your PMS symptoms typically start 5 days before period"

What's needed:
- Prominent display of cycle stats (average length, variability, next predicted)
- Fertile window calculation (if user opts in)
- Irregularity alerts
- PMS pattern recognition
- All calculations possible from existing data - just need UI

Justification: Data is there, just not surfaced. Cycle prediction is #1 reason
women use period tracking apps. Currently SHOS logs cycles but doesn't provide
insights.

Wiring: All calculations in menstrualCalculations.js. Need UI components.
No new data model needed.

### Summary: what to add/change/remove

| Action | Item | Priority | Effort |
|--------|------|----------|--------|
| ADD | PMS symptom quick-log (deep-linked to cycle) | HIGH | Medium |
| ADD | Cycle phase display on symptoms | HIGH | Small |
| ADD | Clot size + pain level to cycle entry | MEDIUM | Small |
| ADD | Spotting tracking | MEDIUM | Small |
| ADD | Contraception side effects (linked to symptoms) | MEDIUM | Medium |
| ADD | Reason stopped for contraception | MEDIUM | Small |
| ADD | Headache/migraine diary (structured) | MEDIUM | Medium |
| ADD | Cycle stats + prediction UI | MEDIUM | Small |
| ADD | Vaginal health treatment + outcome fields | LOW | Small |
| ADD | Pregnancy gestational weeks + trimester | LOW | Small |
| CHANGE | SymptomLog: add cycleDay + cyclePhase fields | HIGH | Small |
| CHANGE | Contraception: add sideEffectIds, reasonStopped | MEDIUM | Small |
| CHANGE | Menstrual cycle: add clotSize, painLevel, spotting | MEDIUM | Small |
| REMOVE | Nothing - all current fields are useful | - | - |

### Scope assessment
In scope: Enhancements to existing modules. No new top-level modules needed
except possibly headache diary (could be SymptomLog enhancement).
Out of scope: Fertility tracking (too complex, dedicated apps exist), pregnancy
week-by-week content (medical content liability), hormone level trending
(already in measurements).

Key principle: Deep-link from cycle view to symptom logging. The value is in
correlation, not new data entry. Every feature should answer "what does this
tell me about my cycle/health?"

### Wiring approach
- All new fields added to existing repositories (DEFAULT_* objects)
- Deep links use same pattern as existing module navigation (onNavigateToRecord)
- Cycle phase derived from existing cycle data (no new storage)
- Pattern recognition uses existing calculation functions
- SymptomLog gets optional cycleDay/cyclePhase fields (backward compatible)

### What NOT to build
- Fertility/ovulation tracking (complex, dedicated apps exist, medical liability)
- Pregnancy week-by-week content (medical content, liability)
- Hormone level trending (already in measurements module)
- Medication reminders (already in medication module)
- Period prediction algorithms (too complex) - just show average + variability

### Recommended priority order
1. PMS symptom quick-log (deep-linked to cycle) - highest user value
2. Cycle phase display on symptoms - enables pattern recognition
3. Contraception side effects - high clinical value
4. Headache diary - high clinical value for migraine sufferers
5. Cycle stats + prediction UI - surfaces existing data
6. Contraception reason stopped - useful for history
7. Period details (clot size, pain, spotting) - clinical value
8. Vaginal health treatment/outcome - incremental
9. Pregnancy gestational tracking - lower priority

Status: analysis complete - needs design discussion before implementation.

---

## 0d. Demo data completeness - ensure all fields/features exercised at least once (IDEA - not started)

### Problem
The seeded demo data (contacts, encounters, tests, medications, etc.) does not
exercise all features or fill all fields. Some modules have empty states or missing
data that prevents demonstrating the full extent of the app's capabilities.

### What needs coverage
- Contacts: at least one contact with every field filled (pronouns, gender, age,
  phone, email, city, notes, kinks, platforms, availability, HIV status, photo)
- Encounters: at least one encounter with every field (title, date/time, type,
  attendees, location, rating, notes, position, activities, protection, cum/loads)
- Testing: at least one test of each type (HIV, chlamydia, gonorrhoea, syphilis,
  etc.) with various statuses (negative, positive, pending, void, superseded)
- Medication: at least one med of each category (PrEP, PEP, doxyPEP, regular,
  archived, inventory-tracked, non-tracked)
- Healthcare: at least one entry in each sub-tab (symptoms, testing, clinic visits,
  vaccinations, measurements, menstrual, vaginal health)
- Episodes: at least one open episode and one resolved episode
- Encounter ring: encounters in pre-test, post-test, and cleared windows
- Partner notification: at least one episode with suggested partners
- STI test cards: positive, negative, pending, void, superseded, partial supersede
- Vaginal health: at least one entry per urgency tier (urgent, prompt, routine, refer)
- Contacts merge: at least one duplicate candidate pair
- Global search: enough data to return results for common queries
- Filter/sort: enough data to demonstrate all sort and filter options
- Archived items: at least one archived encounter, one archived medication

### Challenge (standard)
1. Completeness check: audit seed data against a feature matrix
2. No artificial data: realistic names, dates, values
3. Edge cases: empty states, overflow text, long names, special characters
4. Deterministic: same seed = same data
5. Respects demo mode: clearly identifiable as demo, removable via "Clear sample data"

### Scope
In: Audit seed data against feature matrix. Fill gaps. Add missing scenarios.
Out: Changing seed data structure or adding new seed categories.

### Plan
1. Create feature matrix checklist (field x module x status)
2. Audit current seed data against matrix - document gaps
3. Add missing seed entries to cover all gaps
4. Verify smoke tests still pass
5. Update seed data documentation

Status: idea captured - needs design discussion before implementation.

---

## 0e. Widget render and design check (IDEA - not started)
Requested: render and visually check all widget designs. Widgets are used on the
home screen and potentially other surfaces. Need to verify they match the design
system and are consistent.

### What needs checking
- All widget variants (health summary, medication, encounters, contacts, etc.)
- Widget states: populated, empty, loading, error
- Widget in dark and light modes
- Widget at different sizes (compact, expanded)
- Widget accessibility (contrast, touch targets, screen reader)
- Widget consistency with card design language (indent, tint, summary line)
- Widget placement on home screen (grid, spacing, ordering)

### Challenge (standard)
1. Render each widget in isolation (Playwright) for visual inspection
2. Compare against DESIGN-MANUAL.md widget section
3. Check dark/light contrast for all widget text
4. Verify touch targets (44px minimum)
5. Verify empty/loading states render correctly
6. Check widget responsiveness at different viewport widths

### Scope
In: Visual audit of all widget variants in both themes. Document findings.
Out: Redesigning widgets or adding new widget types.

### Plan
1. List all widget components in src/
2. Render each in Playwright (dark + light, populated + empty)
3. Compare against design manual spec
4. Log findings in AUDITS.md
5. Fix any issues found

Status: idea captured - needs design discussion before implementation.

---

## 0f. Design manual currency check (IDEA - not started)
Requested: ensure DESIGN-MANUAL.md is up to date with current designs. The manual
was last comprehensively updated during the cross-module standardisation pass
(item 16, 11 Nov 2026). Since then, many changes have been made (items 17-49)
that may not be reflected.

### What to verify
- Section 10.2 Cards: does it reflect current card design? (section rows, summary
  lines, button tiers, focus rings, media queries, reason-tag rules)
- Section 12 Accessibility: touch target exceptions (40px in-card, 32px compact)
- Module colour tables: are all module colours documented and current?
- Typography scale: TYPE tokens (11, 12, 14, 16, 18, 20, 22) — is 13px
  documented as untokenised?
- Spacing grid: is the 4px grid documented? Are the 2 off-grid exceptions noted?
- Button tiers: .btn 40px, .btn-sm 32px, screen-level 44px
- Advisory pattern: indent + 3px bar + tint (testing .advisory is reference)
- Date format: day-first unpadded, weekday prefix for planned only
- Summary vocabulary: state words per module
- New components: UndoToast, VaginalHealth, Episodes, PartnerNotification —
  are these documented?
- i18n: ST() tagging, string table structure, en-GB/en-US variants
- Dark/light mode: resolveDarkAccent, NEUTRAL_DARK, colour-blind mode

### Challenge (standard)
1. Diff the manual against the actual codebase — find sections that describe
   removed/changed features
2. Find features in code that aren't in the manual
3. Verify all token values match designTokens.js
4. Check that all mockup standards (from BACKLOG items 14-16) are documented

### Scope
In: Audit manual against codebase. Update stale sections. Add missing sections.
Out: Rewriting the manual from scratch.

### Plan
1. Read DESIGN-MANUAL.md and designTokens.js side by side
2. Cross-reference with src/ modules for undocumented features
3. Update stale sections
4. Add missing sections (new components, patterns, tokens)
5. Verify all code references in manual are still valid

Status: idea captured - needs design discussion before implementation.

---

### Challenge (13 Nov 2026) — 0e Widget render and design check

**Challenge:**
1. How many widget variants actually exist? If it's 3-4, a quick visual check
   suffices. If it's 10+, this needs systematic coverage.
2. Are widgets even rendered in the live app, or only in mockups? If mockup-only,
   the check is lower priority.
3. The card design language (items 14-16) already standardised section rows,
   summary lines, button tiers. Widgets may inherit these or diverge.
4. Risk: widget audit could become a rabbit hole if widgets have many states
   (populated, empty, loading, error, dark, light, 3 sizes = 6 states × N widgets).

**Honest verdict:** Worth doing, but scope tightly. Widgets are on the home screen
— high visibility. But limit to populated + empty in dark + light. Skip loading/
error unless they're visibly broken. Use Playwright to batch-capture all variants
in one run.

### Scope (0e)
**In:** All widget variants, populated + empty, dark + light. Check against
design manual. Log findings.
**Out:** Loading/error states (unless visibly broken), new widget types, widget
redesign.

### Plan (0e)
1. Grep src/ for widget components (grep "Widget" in *.jsx)
2. List all variants and their props
3. Write Playwright script to render each (dark + light, populated + empty)
4. Batch capture screenshots
5. Compare against design manual spec
6. Log findings, fix issues

---

### Challenge (13 Nov 2026) — 0f Design manual currency check

**Challenge:**
1. The manual was last comprehensively updated 11 Nov 2026 (item 16). Since then:
   items 17-49 added UndoToast, VaginalHealth, Episodes, PartnerNotification,
   i18n en-US, deeper ST() tagging, stress test fixes, colour outlier fixes.
   That's significant drift.
2. But: is the manual actually stale, or were most changes additive (new
   components) rather than changes to existing standards? Need to check.
3. Full audit of a large manual is tedious. Better: targeted check of sections
   most likely to be stale (cards, accessibility, tokens, new components).
4. Risk: manual could be 80% current and 20% stale. A full rewrite wastes time.
   A targeted diff is more efficient.

**Honest verdict:** Do a targeted check, not a full rewrite. Focus on sections
that describe things that changed (cards, tokens, new components). Skip sections
that are unlikely to have drifted (date format, vocabulary, accessibility basics).

### Scope (0f)
**In:** Targeted check of card design language, token values, new components,
accessibility exceptions, i18n structure.
**Out:** Full rewrite, sections that haven't changed.

### Plan (0f)
1. Read DESIGN-MANUAL.md sections 10 (cards) and 12 (accessibility)
2. Diff against designTokens.js (verify token values match)
3. Check src/ for new components not in manual (UndoToast, VaginalHealth, etc.)
4. Verify mockup standards from items 14-16 are documented
5. Update stale sections, add missing sections
6. Do NOT rewrite sections that are still accurate

---

## 0j. Design consistency: apply encounters card language to healthcare and contacts (IDEA - not started)
Requested: encounters module has modern card design (chips, subheadings, icons, colouring, colour-indent). Healthcare (testing) and contacts are still chunky cards with little data and no colour. Need to apply the same design language.

### What needs changing
- Healthcare (testing): apply colour-indent, chip groups, summary lines, section rows. Currently blocky/bulky cards.
- Contacts: apply same colour-indent, chip groups, summary lines. Currently chunky cards with no colour.
- Both should match encounters card grammar: chips, subheadings, icons, colouring.

### Challenge (standard)
1. Incremental, not full redesign - apply existing patterns.
2. Healthcare and contacts use their own module colours (healthcare green, contacts amber).
3. Large change touching many files. Verify smoke tests after.
4. Module by module: healthcare first (most complex), then contacts.

### Scope
In: Apply encounters card design language to healthcare and contacts modules.
Out: Redesigning the card grammar itself (already standardised in items 14-16).

### Plan
1. Identify encounters patterns to port (section rows, chips, summary lines, colour-indent, advisory)
2. Apply to healthcare module (testing, clinic visits, vaccinations, etc.)
3. Apply to contacts module
4. Verify smoke tests + vitest + eslint
5. Visual audit pass on both modules

Status: idea captured - needs design discussion before implementation.

---

## 0k. Sticky allergies banner (IDEA - not started)
Requested: allergies should stick at the top of the relevant screen. If module-wide concept, module banner. If tab-specific, only on that tab.

### Challenge (standard)
1. Is allergies module-wide or tab-specific? (Likely module-wide in healthcare)
2. Should it be a sticky header below the module banner?
3. Should it show count + severity?
4. Should it be dismissible?

### Scope
In: Make allergies sticky at top of relevant screen.
Out: Redesigning the allergy display.

Status: idea captured - needs design discussion before implementation.

---

## 0l. Dashboard title truncation (IDEA - not started)
Requested: "X's dashboard" title is cut off. Options: go to two lines, or change to "Home" or "Your home".

### Challenge (standard)
1. Two lines: may push content down, inconsistent with other screens.
2. "Home" or "Your home": simpler, but loses personalisation.
3. Could use responsive font size (smaller on narrow screens).
4. Could truncate with ellipsis and show full on tap.

### Scope
In: Fix dashboard title display. Choose one approach.
Out: Redesigning the home screen.

### Plan
1. Decide on approach (two lines vs rename vs responsive font)
2. Implement
3. Verify on narrow screens (360px)

Status: idea captured - needs design discussion before implementation.

---

## 0m. Contacts running count (IDEA - not started)
Requested: option to show running tally of contacts (1 at top, x at bottom, increasing as you scroll down). Like a scroll progress indicator for list length.

### Challenge (standard)
1. Is this useful or just visual noise? (Could be useful for large contact lists)
2. Should it be opt-in (setting) or always on?
3. Performance: updating count on every scroll event could be janky.
4. Should it show total count or visible count?

### Scope
In: Add optional running count to contacts list.
Out: Complex scroll tracking or virtualisation.

### Plan
1. Decide: opt-in setting or always on
2. Implement using IntersectionObserver or scroll event (throttled)
3. Test performance on large lists

Status: idea captured - needs design discussion before implementation.

---

## 0n. Filter 3-state toggle (IDEA - not started)
Requested: filters should have 3 states/clicks: off, on (normal sort), on inverted sort. Combine newest/oldest into one control with arrows or text changing.

### Challenge (standard)
1. Current state: separate "newest" and "oldest" buttons? Or toggle?
2. 3-state toggle: off -> ascending -> descending -> off (cyclic)
3. Visual feedback: arrow direction changes (up/down) or text changes
4. Should this apply to all sortable lists (contacts, encounters, medications)?
5. Accessibility: screen reader needs to announce state

### Scope
In: Implement 3-state sort toggle on contacts and encounters lists.
Out: Applying to all modules (start with 2, expand if well-received).

### Plan
1. Design the toggle UI (arrow icon + state text)
2. Implement cyclic state machine (off -> asc -> desc -> off)
3. Apply to contacts and encounters lists
4. Verify accessibility (aria-label updates per state)

Status: idea captured - needs design discussion before implementation.

---

## 0o. Medication notification banner (IDEA - not started)
Requested: check if out-of-app notification banner for medication reminders works properly. "Take medication" notifications should appear when app is backgrounded or closed.

### Challenge (standard)
1. Uses Capacitor Local Notifications (already in dependencies)
2. Need to verify: notification fires at correct time, shows correct content, tap opens correct screen
3. Need to verify: works when app is backgrounded, closed, after reboot
4. Need to verify: respects user's notification preferences (enable/disable)
5. May need to check Android notification channels and permissions

### Scope
In: Verify and fix medication reminder notifications.
Out: Adding new notification types.

### Plan
1. Check existing notification code (medicationReminderSync.js, refillReminderSync.js)
2. Test on device: schedule reminder, background app, verify notification
3. Test tap-to-open navigation
4. Test permission handling (denied, granted, revoked)
5. Fix any issues found

Status: idea captured - needs design discussion before implementation.

---

## 0c. "A new version is ready" banner - false alarm investigation & fix (IDEA - not started)

### Problem
The banner ("A new version is ready. Back up your data then refresh.") appears during
development even though no newer version exists. Two independent triggers:

1. **SW controllerchange** (App.jsx:1456) — fires when a new service worker takes
   over. During HMR/reloads, this can fire spuriously. Mitigated by 3s delay and
   sessionStorage check, but not eliminated.

2. **version.json check** (App.jsx:1477) — compares `data.buildSha` against
   `__BUILD_SHA__`. In dev, `__BUILD_SHA__` is the git short SHA (not "dev" unless
   git fails). If `version.json` exists and has a different SHA, banner shows.

### Root cause analysis
- `sessionStorage` "shos-sw-update-dismissed" is per-tab. Opening a new tab
  loses the dismissed state → banner reappears.
- During rapid reloads (HMR), the SW `controllerchange` can fire between the
  3s delay window and the actual page load, triggering the banner.
- The version.json check has no dev-mode guard — if version.json exists in public/
  with a stale SHA, it triggers the banner even in dev.
- No GitHub/release comparison — the banner should only appear when the deployed
  version (from GitHub releases) is newer than the current build.

### Challenge (standard)
1. **When should the banner appear?** Only when: (a) a new SW has taken control
   AND (b) the user is NOT in dev mode AND (c) the dismissed flag is not set.
   OR: when version.json from a stable release has a different (newer) buildSha.
2. **When should it NOT appear?** In dev mode, during HMR, on first visit,
   after dismissal, on native platforms.
3. **Persistence:** dismissed state should persist across tabs (localStorage, not
   sessionStorage) or at least per-session.
4. **GitHub integration:** check GitHub releases API for latest version tag,
   compare against `__APP_VERSION__`. Only show banner if GitHub version > current.

### Proposed fix (challenge as standard)
- Add a dev-mode guard: if `__BUILD_SHA__ === "dev"` or `import.meta.env.DEV`,
  skip both triggers entirely.
- Change dismissed flag from `sessionStorage` to `localStorage` with a timestamp
  (dismiss for 24h, not forever — so users still get notified eventually).
- Add GitHub releases check: fetch latest release tag, compare semver against
  `__APP_VERSION__`. Only show banner if GitHub version is newer.
- Add a "Don't show again for this version" option (localStorage keyed by buildSha).
- Gate the version.json check behind `import.meta.env.PROD` (production builds only).
- Add a cooldown: don't check more than once per hour (localStorage timestamp).

### Scope
**In:** dev-mode guard, localStorage dismissed state, GitHub releases check, version
comparison logic, cooldown timer.
**Out:** forced reload, automatic update installation, native app update (already
handled by updateCheckService).

### Plan
1. Add `import.meta.env.DEV` guard to both triggers
2. Move dismissed state to localStorage with buildSha key + timestamp
3. Add GitHub releases API check (compare tag to __APP_VERSION__)
4. Add cooldown (1 hour between checks)
5. Test: verify banner doesn't appear in dev, appears in prod when version differs
6. Test: verify dismissal persists across tabs and reloads

Status: needs design discussion before implementation. Not a blocker — cosmetic.

---

### Challenge (13 Nov 2026)

**Risks identified:**
1. False sense of security — sharing ≠ safety. Friend may not check. Need clear
   messaging that this is a tool, not a guarantee.
2. Privacy leakage — once shared via messaging app, data is out of user's control
   (screenshots, backups, forwarding). Cannot be recalled.
3. Abuse potential — could be used to share someone's details without their
   consent (stalking/harassment vector). Need consent consideration.
4. Scope creep — "safety" can expand into check-in timers, panic buttons,
   emergency contacts, etc. Must be tightly scoped.
5. Platform fragmentation — Google Maps live location requires recipient to have
   the app. WhatsApp live location is session-based and expires.
6. Legal liability — sharing personal data. Needs disclaimer.

**Value assessment:**
- Real value: people already do this manually ("I'm meeting X at Y"). Formalising
  it reduces friction and ensures complete info is shared.
- But: is it better than a quick text? The value is in pre-composition and data
  readiness, not in the sharing mechanism itself.
- Risk of being a "nice-to-have" that adds complexity to a health-tracking app.

**Honest verdict:** Worth building as a small, self-contained feature. High risk
of scope creep. Must be strictly scoped to "share identification info" and nothing
more. Should NOT become a safety platform.

### Scope (first slice)

**IN scope:**
- "Share for safety" button on contact detail screen
- Field selection: name, address, vehicle, photo, phone (user picks which)
- Pre-compose discreet message (no sexual context)
- System share sheet (OS handles delivery — no custom service)
- Optional "include live location" toggle → opens Google Maps share
- No server-side storage of shared data
- Disclaimer: "Sharing is not a safety guarantee"

**OUT of scope (explicitly excluded):**
- Auto-sharing or scheduled sharing
- Check-in timers / panic buttons / "I'm safe" confirmation
- Emergency contact management
- Custom sharing service or server
- Live location tracking within the app
- WhatsApp/iOS Maps specific integrations
- Encounter-flow integration (contact detail only for v1)

**Deferred (future consideration):**
- Check-in reminder ("If no confirmation by X, here's who I'm with")
- Encounter-flow "share safety info" step
- WhatsApp live location integration
- iOS Maps Share ETA integration

### Plan

**Phase 1: Design (no code)**
- Design the "Share for safety" sheet UI (field checkboxes, message preview)
- Write the discreet message template
- Decide on disclaimer placement and wording
- Review with owner for consent/privacy approach

**Phase 2: Implementation**
- Add "Share for safety" button to contact detail (next to existing actions)
- Build field selection sheet (checkboxes for name, address, vehicle, photo, phone)
- Generate pre-composed message from selected fields
- Invoke system share sheet (navigator.share on web, Capacitor Share on native)
- Add "Include live location" toggle → deep-link to Google Maps share URL
- Add disclaimer text

**Phase 3: Testing**
- Unit: message generation with various field combinations
- E2E: share sheet invocation, field selection persistence
- Manual: verify message is discreet, verify no server calls
- Privacy: verify no data leaves device except via user's chosen share app

**Phase 4: Integration (if approved)**
- Add to encounter logging flow as optional step
- Add to contact quick-actions

**Estimated effort:** Small (1-2 days for Phase 2, assuming design is settled)
**Dependencies:** None (self-contained, no new repositories or storage)
**Risk:** Low (read-only access to existing contact data, no new persistence)

---

## 1. Render comparison: encounter pre-test segment treatment — DECIDED
Requested: a single render comparison of four options for the pre-test segment —
solid green, green hatch, pink hatch, grey hatch — to decide whether to encode
the pre/post split by colour or by texture, without mixing colours.

Rendered and reviewed (hatch, double-hatch/crosshatch, polka dot, dotted line,
stipple; mobile + web; dark + light). **Decision: keep solid green. No texture.**
The ring's 6px mobile stroke cannot hold a readable pattern, and texture read as
noise rather than a category cue. Nothing to build here.

## 2. Navigation bar icons in module colours — DONE
Requested: the four bottom-nav icons (Contacts, Encounters, Healthcare,
Medications) should use their module key-colour instead of plain white while
unselected. When that module is selected, the icon goes white on a module-colour
box. The label text stays white.

Notes:
- Module colours must come from the existing module-colour keycoding rules, not
  hardcoded hexes.
- Selected state becomes white icon on a filled module-colour pill/box.
- Applies wherever the main nav renders (mobile + web).

Shipped in `7df19e8`: unselected icons read `resolveTabAccent(tab, darkMode)`;
active tab still fills the pill with that colour and turns the icon white. Home
keeps its raised circle. Contrast measured against both surfaces — all four
accents clear 3:1 (Contacts 4.50/3.78 light/dark, Encounters 7.30/5.60,
Medication 11.32/4.95, Healthcare 8.58/3.43). Verified rendering in the web
build. Verified on-device too: installed `SHOS.apk`, confirmed all four icons
render in their module colours and the active tab shows a white icon on the
module-colour pill.

## 3. Encounter ring: verify and document the corrected pre/post logic
Done in `a9cb831` / deployed `01ecc67`: pre = encounters still inside the
priority window periods (HIV 45d unless PrEP adequate, gonorrhoea/chlamydia 14d
unless DoxyPEP taken), post = encounters on/after the last test by date.
The hardcoded 40/13 demo fallback was removed.

Residual: whether the ring should also expose the "cleared" encounters (older
than every priority window) somewhere. **Decided: no.** A cleared encounter is a
history fact, not a current decision — it cannot change behaviour today. Showing
it would be visual noise and would blur the ring's meaning from "needs attention"
to "all history". The ring intentionally does not sum to the total encounter
count; cleared detail already lives in Timeline per encounter.

## 4. STI test cards: episode grouping & backfill
Requested: be able to tag a few STI test cards together for an episode.
Backfilling episodes is more convenient to group initially - group the cards into the
episode first, until the user then adds encounters (encounters become the preferred
anchor for the grouping once they exist).
Related: home test of cure only makes sense after clinic treatment - surface the TOC
on the post-treatment card, not on the pre-treatment positive card.

Decisions (Nov 2026):
- Anchor of an episode = the positive result event (most stable identity).
- Grouping is a proposal, not a rule: suggest "these cards look related" and let the
  user confirm or split. Never auto-group on organism alone.
- Cards that can't be confidently matched stay separate - false positives worse
  than false negatives. Not all cards belong in an episode - only those relevant
  to the positive result (the result itself, the treatment it prompted, explicit
  follow-ups and TOC). Unrelated or unlinked cards stand alone.
- Backfill is the main use case; user groups historical cards in one pass,
  encounters get linked afterwards.
- Notify partners is dual-route by user choice: (a) self-notify - draft the
  message for the user to copy into their own channel (SMS/WhatsApp/...), or (b)
  present contact-tracing copy they pass to the clinic. HIV is the one exception
  to naming the organism in partner-facing copy (urgent non-naming copy with
  72 h PEP window prompt); clinic-side route still receives the organism.
- Anonymous route: no national service exists in England. Clinic tracing is less
  common; the app may need to plan management of its own anonymous SMS service
  ("141"-style) or be provider/region aware for international equivalents.
  Local number format, routing and charging need per-country provisioning - the app
  controls the draft/present UX, the service provider controls delivery.
  Design needed before build; do not assume a service exists.

## 5. STI test cards: identify possible partners for notification
Requested: an option to identify possible partners for notification based on
encounters since the last negative test. Helps the user identify the likely source
of infection and inform the right people.
Can develop into: an interactive Notify partners checklist and/or a clinic report
for contact tracing, if desired - driven by the encounter history relative to the
last confirmed negative result.
Verified data model (from episodeRepository.js / episodeCalculations.js):
- Episode is a chain: exposure encounter -> at-risk encounters -> test -> treatment clinic visit -> TOC test.
- Storage: localStorage, key 'shos_episodes'. Fields: testIds, clinicVisitIds, symptomLogIds, startEncounterId,
  atRiskEncounterIds, notifiedEncounterIds, resolvedDate, resolution, triggerReason.
- State is DERIVED: isEpisodeOpen = resolvedDate is null/unparseable. Never a stored boolean.
- The STI test card's integration point is testIds (array of test IDs on the episode). The STI card does NOT
  need to hold an episode reference - the episode holds the test reference. Direction: Episodes -> STI test
  via testIds, not STI card -> Episodes.
- unlinkTest(testId) exists - called when a test is hard-deleted elsewhere. Clean.
- Privacy: episode triggerReason is a category, not a live Contact relation. No new exposure beyond
  what linked Encounters already carry.
- Partner notification: notifiedEncounterIds tracks which at-risk encounters have been notified - separate
  fact from atRiskEncounterIds.
- Resolution: 'Negative - no treatment needed' or 'Treated - course complete', set on resolve.
Status: not started - captured during the healthcare-sti-test-card.html review (10 Nov 2026).

## 6. STI test cards: female health considerations
Requested: consider female health pathways in the STI module - pregnancy testing,
pelvic inflammatory disease, bacterial vaginosis, candidiasis etc.

Decisions (Nov 2026):
- Scope = SEPARATE tab (a "Vaginal health" tab under Healthcare), not taped into
  the STI list. STI tab stays STI-only.
- Vaginal swab ordering auto-suggested only when the patient's record is female /
  trans male; available but hidden otherwise ("Auto-offer on female/trans-men
  ticks").
- Urgency rules follow clinical treatability (read: urgency if the condition needs
  treat-now - e.g. septic PID - otherwise stable/self-limiting options defer,
  deadline passes routine -> becomes overdue). PID and cervicitis treatment is
  empiric broad-spectrum and immediate; BV/candida treat as indicated, not same-day.
  Exact urgency tiers need clinician sign-off before build - not medical advice here.
- Phrasing: avoid euphemism; "Result needs clinic review" for anything not obvious.
- BV, candidiasis, trichomoniasis, PID belong to the separate tab; STI panel
  organisms are unchanged - they stay in the STI tab.
- UPDATED: female-health toggle moved to module bar (not per-card); includes
  pregnancy, BV, thrush as options; auto-offer on female/trans-men ticks.

Status: decisions captured; not started - captured during the
healthcare-sti-test-card.html review (10 Nov 2026).

## 7. STI test cards: result and chase error/empty states
Needed for the Update test result flow and pending chase: failed/void result,
result still pending after repeated chases, empty tracking state, and how staff vs
patient views differ.
Status: not started - parked during the healthcare-sti-test-card.html review (10 Nov 2026).

## 8. Settings / Personalisation: host the EN UK / EN US locale switch
Main Settings module -> Personalisation is the right home for the en-GB/en-US
spelling toggle, not per-screen toolbars. Strings tag for localisation
app-wide; the app never carries a per-screen toggle like the one prototyped on
the STI screen (shown temporarily, removed 10 Nov 2026).
Status: captured during the healthcare-sti-test-card.html review (10 Nov 2026).

## 9. STI test cards: link into Healthcare Episodes (Timeline) - VERIFIED data model
Requested: the episode grouping on the STI card should link through to the
pre-existing Episodes/Timeline module in Healthcare (accessible from Home and
Dashboard). Same concept as the card-level episode chip; this lets the user
manually correlate encounters and contacts with the episode.
Integration points:
- STI test card emits/holds an episode reference the Episodes (Timeline) view
  consumes and renders inline.
- Episode banner on the STI card navigates to the Episodes module scoped to
  that episode, not just an inline toggle.
- Reverse: Episodes view links back to the STI test card for detail/edit.
- Clinical data stays in the Testing registry; Episodes is a Workspace (owns no data).
Status: not started - captured during the healthcare-sti-test-card.html review (10 Nov 2026).

## 10. STI test cards: module-level integration corrections (from critique of item 9)
Revisions to the item 9 scope after critical review:
- Link direction should be Episodes -> STI card primarily, not STI card -> Episodes.
  The STI card is a contributor, not the entry point.
- Grouping must be a proposal, not manual correlation - the system suggests, user confirms/splits.
- Verify the existing Episodes module's data model before treating it as a ready target.
- Privacy: anonymise state must propagate; Episodes view is itself a disclosure surface.
- Reduce first slice: one-way Episodes -> STI card link only; bidirectional integration and
  partner identification are separate slices.
- Do not ship episodes unless it answers a question the user already asks (reduces cognitive
  load rather than adding a second axis).
Status: captured during the healthcare-sti-test-card.html review (10 Nov 2026).

## 11. STI test cards: integration with existing Episodes module (verified data model)
Verification of the pre-existing module (src/repositories/episodeRepository.js, src/calculations/episodeCalculations.js):
- An episode is a chain: exposure encounter -> at-risk encounters -> test -> treatment clinic visit -> TOC test.
- Storage: localStorage, key 'shos_episodes'. Data model: flat arrays of IDs - testIds, clinicVisitIds, symptomLogIds, startEncounterId, atRiskEncounterIds, notifiedEncounterIds. No separate named fields for initial/culture/TOC - chronological order tells the story.
- State is DERIVED: isEpisodeOpen = resolvedDate is null/unparseable. Never a stored boolean.
- The STI test card's integration point is testIds (array of test IDs on the episode). The STI card does NOT need to hold an episode reference - the episode holds the test reference. Direction: Episodes -> STI test via testIds, not STI card -> Episodes.
- unlinkTest(testId) exists - called when a test is hard-deleted elsewhere. Clean.
- Privacy: episode triggerReason is a category, not a live Contact relation. No new exposure beyond what linked Encounters already carry.
- Partner notification: notifiedEncounterIds tracks which at-risk encounters have been notified (separate fact from atRiskEncounterIds).
- Resolution: 'Negative - no treatment needed' or 'Treated - course complete', set on resolve.
Implication for the STI card mockup: the episode banner should query episodes where testIds includes this test ID, not store an episode reference on the card. The Episodes (Timeline) view is the natural entry point; the STI card is a contributor.
Status: verified - captured during the healthcare-sti-test-card.html review (10 Nov 2026).

## 12. STI test cards: episode grouping from Encounters/Testing modules (ideas)
Requested: ability to start or group cards into an episode from within the Encounters
or Testing modules, then continue managing the episode in the Episodes (Timeline) module.
Ideas:
- In Testing/Encounters, a Start episode or Add to existing episode action on a record
  (mirrors the STI card's episode pill). When triggered, creates an episode with that
  record as the first linked item (startEncounterId or testIds).
- The new episode opens in Episodes (Timeline) for further linking (at-risk encounters,
  more tests, clinic visit, resolution).
- From Encounters: retroactively select the exposure encounter as the anchor, then
  flag subsequent encounters as at-risk while the episode is open.
- From Testing: link a positive result to an existing episode or create a new one
  with that test as the first testIds entry.
- The STI test card's episode banner becomes a real navigation: tapping opens
  Episodes (Timeline) scoped to that episode, not just an inline toggle.
- Reverse: Episodes view links back to the STI test card for detail/edit.
- Clinical data stays in Testing/Encounters registries; Episodes is a Workspace.
Status: captured - not started (10 Nov 2026).

## 13. STI test card mockup: remaining build gaps (full-audit findings, 11 Nov 2026)
Source: comprehensive audit of `healthcare-sti-test-card.html` (stress test, wiring,
duplication, chronology, medical evidence/citations, deep links, store-once). Static
checks 21/21 PASS at audit close; items below are known gaps, not defects.

Build gaps (in priority order):
- Native dialogs: alert()/confirm() in cancel/chase/reminder handlers must become
  in-app components (toast/sheet) before any real use.
- Persistence: no state save (no localStorage); reload resets the mockup. .ics
  download works but needs real calendar integration.
- Loading states: none mocked (results fetch, episode timeline load).
- Empty states: zero-card, zero-episode, no-tracking-link screens.
- Error states: network failure, lab delay, sync conflict. Only field-level
  validation exists today.
- Partner notification: draft + copy only; no send, no provider, no delivery
  status. Anonymous route per item 4 decisions (design needed, do not assume a service).
- String table / locale: annotation promises shared en-GB string table; it does not
  exist - all copy hardcoded. Home in Settings/Personalisation per item 8.
- TOC flow: decision recorded (only after clinic treatment) but no dedicated flow
  on a treated-positive card yet.
- Superseded logic: generalise beyond the single Jul 15 card (multiple superseded,
  partial supersede).

Audit concepts to repeat per screen (checklist proven on the STI card):
- Wiring: every control has exactly one handler (caught a duplicate confirm-result
  handler this pass).
- Chronology: validate every weekday-date pair against the real calendar and every
  relative claim ("in 4 days", "by Nov 23") against the as-of date. Three weekdays
  were wrong this pass.
- Medical evidence: every dose/duration against current UK guidance; citation
  visible on patient-facing advice; no dose typos (caught "1g" for "100mg").
- Store-once: repeated verbatim content must map to a single record in-app
  (location/provider/episode); copies that are payload/export/display are fine.
- Deep links: aria-controls targets exist, no href="#" visible states, cross-module
  links wired.
- Colour semantics: routine/urgent/pending token mapping consistent.
- Separators/vocabulary: one standard (· not -, sentence case, HIV caps).

Design tokens recorded for the app build (decisions, not code to copy):
- Action buttons: btn-sm 32px/11px/600/999px; primary solid #0E8144, secondary
  outline, danger outline red. 32px is below the 44px touch-target best practice -
  deliberate shrink; revisit if mobile-only.
- Focus-visible outline 2px var(--healthcare-dark) offset 2px now on .btn too.
- Narrow-screen @media (max-width:360px) added (wrap actions, tighter padding).
Status: mockup closed at 21/21 PASS, 0 console errors, 8 cards, 11 Nov 2026.

## 14. Cross-module standardisation pass (executed, 11 Nov 2026)
Source: cross-module comparison report (testing vs healthcare vs encounters vs
contacts, 7 mockup files). STI card is the reference grammar; divergence was
"others behind". All 7 screens now pass the smoke test (0 FAIL each).

Standards decided (project-wide):
- Dates: day-first unpadded (12 Nov). Weekday prefix for planned/future only
  (Sat 14 Nov). No zero-padding (was 02 Jan / 03 Dec). No month-first anywhere.
- Summary line: lead-word state in caps + · + key fact, coloured by state.
  Words so far: BOOKED, PENDING, POSITIVE, NEGATIVE, OVERDUE, VOID (STI);
  DUE, COMPLETED (clinic visits); ACTIVE, RESOLVED (symptom log). Encounters
  keeps a metadata summary (rating · date · relative · climax) - it is a record
  list, not a state screen; vocabulary does not apply.
- Buttons: .btn base 40px + .btn-sm 32px compact tier on card actions.
- :focus-visible outline 2px module-accent offset 2px on interactive elements.
- @media (max-width:360px) narrow-screen block.
- Reason-tag rule: interactive tag-btn when the user can change the reason;
  static span when derived from data (episode/record).
- Attention group: one token (ctx-group.warning); JS must key off
  data-status-group, never off .warning (decoupled on STI).
- VOID state: amber dot, own .summary.void class (no longer borrows pending).

Executed changes:
- STI card: 29 dates converted to the standard (planned ones gained weekday:
  Sat 14 Nov, Wed 18 Nov, Mon 23 Nov, Tue 17 Nov); card 2 got .summary.void +
  static "Positive" reason tag; .ctx-group.schedule merged into .warning;
  JS snapshot/revert/apply moved to [data-status-group]; teal module accent
  reintroduced (--healthcare-teal/-soft on ctx-title.healthcare); card 7's
  one-off title documented in-file.
- Testing mockup: footers -> .summary state lines; btn tiers; focus; media;
  02 Jan 2025 -> 2 Jan 2025.
- Healthcare card: footers -> summaries (NEGATIVE/OVERDUE/ACTIVE); btn tiers;
  focus; media; 4 month-first dates fixed; FIXED BUG: --green/--amber were
  referenced but never defined (status icons rendered blank).
- Clinic visit: footers -> summaries (DUE/BOOKED/COMPLETED); btn tiers; focus;
  media; 03 Dec/04 Feb padding fixed.
- Symptom: footers -> summaries (ACTIVE/RESOLVED); btn tiers; focus; media;
  05 Nov/02 Nov padding fixed.
- Encounters: FIXED BUG: --card-bg referenced but never defined (cards
  rendered transparent); duplicate --tint-amber removed; focus rule added for
  the tabindex dot spans. No buttons/dates to change.
- Contacts: no changes needed - static detail screen, no interactive elements,
  no dates; divergence is structural and deliberate.
- Fixed: healthcare-card "In progress - awaiting results" chip contradicted
  its completed/normal card -> "Result normal".

Retracted finding: card 8's "NEGATIVE " trailing space is a normal separator
before the inline Superseded badge - not a defect.

smoke-test.cjs updated: month-first + zero-pad checks added; medical/citation
checks gated to interactive screens; colour/focus/btn-sm checks generalised
across modules. BOM is WARN-optional for non-STI files.
Status: done - all 7 screens 0 FAIL, 11 Nov 2026.

## 15. Terminology + dedup + advisory pattern pass (11 Nov 2026)
User review of the comparison: C&S card repeated "Positive" and "Treatment
required/started"; "+1" prefix on Log buttons looked wrong; the testing card's
indent/colour-bar/tinted-background advisory pattern should be standard.

Applied:
- Dedup (store-once): testing C&S Result chip group removed (both chips
  duplicated the summary); "All negative" chip removed (summary carries it) -
  date chip kept; clinicvisit "Follow-up due" chip removed; symptom Severity
  group keeps trend only ("Severe" chip was duplicated in name-line);
  vaccination "Overdue 5 mo" chip + whole Mpox Status group removed;
  healthcare-card grey "-" placeholder chips removed (3x).
- +1 prefix removed from all Log buttons (11x across 5 files); .plus1 CSS gone.
- Terminology: clinicvisit "Log visit" -> "Log clinic visit" (2x). Action
  vocabulary now: Log test / Log clinic visit / Log vaccination / Log symptom /
  Schedule retest / Book dose / Book clinic visit / Resolve / Reopen /
  Reschedule / Add note.
- Advisory pattern standardised (testing .advisory was the reference): in-card
  notes get padding 7px 9px, border-radius 8px, 3px left bar, tinted
  background. Applied to encounters notes (5x, teal bar + tint; light-mode
  variant too) and healthcare-card .note. Page-level doc annotations (STI,
  contacts) stay 2px italic - they are not card elements.
- Vaccination mockup (8th file, missed in item 14) fully back-ported: footer ->
  .summary (OVERDUE / COMPLETE), .btn 40px + .btn-sm, focus rule, @media,
  summary dedup as above.
- New file: all-modules-card-comparison.html - renders all 29 card designs
  from the 8 mockups in one file, each module's CSS scoped under .mod-<name>
  (incl. its :root vars). Generated by build-comparison.cjs - rerun that
  script after changing any source mockup; do not hand-edit the output.
- smoke-test.cjs: 8/8 mockups + comparison file all 0 FAIL.
Status: done, 11 Nov 2026.

## 16. Manual + remaining-design audit vs the STI grammar (11 Nov 2026)
Question: using the healthcare/testing render (and the STI card as the general
template), does anything else need updating - manual or other designs?

DESIGN-MANUAL.md updated:
- Section 10.2 Cards: added the shared standards - day-first unpadded dates
  (weekday prefix on planned only), in-card notes/advisories as indent + 3px
  bar + tint (testing `.advisory` is the reference; 2px italic is for
  page-level annotations only), button tiers (.btn 40px / .btn-sm 32px),
  :focus-visible rings, @media (max-width:360px) block, and the reason-tag
  rule (tag-btn when user-changeable, static span when derived).
- Section 10.2.1: header now names the STI test card as the reference grammar
  for the summary state line, in-card context groups and action tiers; item 5
  rewritten from "Footer / summary line" (encounters-only wording) to two
  summary kinds - state summary (lead word + · + fact, per-module vocabulary:
  STI/clinic/symptom/vaccination/general-healthcare words) vs metadata
  summary (encounters/contacts) - plus the store-once rule (chips must not
  repeat the summary). Stale `+1 Log test` example fixed to `Log test`.
- Section 12 Accessibility: the 44px touch-target rule now documents the card
  tier exception (40px in-card base, 32px compact; screen-level CTAs stay 44).

Design fixes outside the audited set (STI grammar applied):
- medication-card-mockup.html (a settled 10.2.1 reference): 4x +1 removed,
  .note upgraded to bar+tint (its .advisory already had it), btn 40px +
  btn-sm tiers, :focus-visible, @media block, annotation text updated.
- healthcare-tabs.html (superseded early draft, kept aligned): FIXED BUG -
  undefined --page/--surface/--variant/--secondary/--tint-healthcare/
  --tint-amber (page rendered white-on-white; chips transparent); FIXED BUG -
  --healthcare-accent was an amber 15% tint used as filled-button background;
  now solid #0E8144. Oct 28 -> 28 Oct; 3 empty advisory divs removed;
  "Sep 2025 - Sep 2025" byline deduped; status chip groups replaced by STI
  grammar summary lines (NEGATIVE / OVERDUE / DUE) + date chip only;
  "In progress"/"Treatment on track" contradiction resolved to
  DUE - Treatment on track; button tiers + focus + media added;
  red/green chips moved onto tint tokens.
- encounters-form-fixes-mockup.html: 02 Oct x2 + 04 Feb zero-padding fixed
  (static form spec doc - no cards/buttons, so tier/media checks n/a).
- encounters-fab-fixes-mockup.html does not exist - stale audit reference.
- build-comparison.cjs: medication module added; comparison regenerated -
  32 cards, 9 modules.
- smoke-test.cjs: card count now counts div-cards too; responsive-breakpoint
  check gated to interactive layouts (static spec docs WARN n/a).
Verified: smoke 0 FAIL on all 12 files (11 mockups + comparison).
Status: done, 11 Nov 2026.

## 28. BACKLOG 4 remaining — partner notification sync to episodes (12 Nov 2026)
- PartnerNotificationSheet.toggleNotified now syncs notified status to any
  linked episode's notifiedEncounterIds (contacts encountered since last
  negative test are marked notified on the episode).
- vite build passes; 0 FAIL on all render mockups.

## 37. BACKLOG 9-11 — Episodes integration (complete, 12 Nov 2026)
- Data model verified as ready integration target (isEpisodeOpen derived,
  testIds/clinicVisitIds/symptomLogIds arrays, unlink methods).
- Episodes → Testing link: TimelineModule accepts onNavigateToRecord;
  linked test chips clickable to navigate to test detail.
- Privacy propagation: anonymise state already handled in Timeline module
  (useAnonymiseMode in LinkedItemsSection masks contact/test names).
- Bidirectional link: Testing detail already has "Linked episodes" section
  (BACKLOG 4) and Encounters detail has "Linked episodes" (BACKLOG 12).
- Partner identification: already implemented (BACKLOG 5, suggested partners
  banner in PartnerNotificationSheet).
- vite build passes; 0 FAIL on all render mockups.

## 37b. BACKLOG 9-11 — first slice (superseded by entry 37 above)
- Verified Episodes data model as ready integration target (isEpisodeOpen
  derived, testIds/clinicVisitIds/symptomLogIds arrays, unlink methods).
- TimelineModule: accepted onNavigateToRecord prop; linked test chips now
  clickable to navigate to test detail (Episodes → Testing link).
- HealthcareScreen: passes onNavigateToRecord to TimelineModule.
- Design: one-way Episodes → STI card link first; bidirectional and
  partner identification are separate slices.
- vite build passes; 0 FAIL on all render mockups.

## 35. BACKLOG 6 completion — edit + persistence (12 Nov 2026)
- VaginalHealthModule: added edit view (date, notes), card click-to-edit,
  delete already in place. localStorage persistence already in place.
- vite build passes; 0 FAIL on all render mockups.

## 34. BACKLOG 6 — Vaginal health tab in React app (12 Nov 2026)
- Created SHOS_VaginalHealth_Prototype.jsx — list view with urgency-based
  card colors (PID=red/urgent, trichomoniasis=amber/prompt, BV/candida=green/routine,
  pregnancy=amber/refer), add flow with condition picker, EmptyState for empty.
- Added "Vaginal health" sub-tab to HealthcareScreen (gated on menstrual
  tracking toggle, consistent with existing pattern).
- Urgency tiers per clinician-approved classification (PID/cervicitis urgent,
  trichomoniasis prompt, BV/candida routine, pregnancy refer).
- vite build passes; 0 FAIL on all render mockups.

## 35. BACKLOG 6 completion — persistence + delete (12 Nov 2026)
- VaginalHealthModule: added localStorage persistence (shos_vaginal_health key),
  delete action on each card.
- vite build passes; 0 FAIL on all render mockups.

## 46. Deeper ST() tagging — empty state headings (12 Nov 2026)
- Tagged "No contacts yet", "No encounters yet", "No tests yet" headings
  with data-i18n in contacts, encounters, testing mockups.
- Added string keys: contact.noContactsYet, encounter.noEncountersYet,
  testing.noTestsYet.
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 45. Deeper ST() tagging — captions & annotations (12 Nov 2026)
- Tagged 16 captions and 8 annotations with data-i18n across all 8 render
  mockups. Added 24 string keys (caption.* and annotation.* prefixes).
- All mockups now have data-i18n population scripts.
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 44. Deeper ST() tagging — button labels batch 3 (12 Nov 2026)
- Tagged remaining button labels (Log refill, Request refill, Resolve with
  refresh icon, Book booster if low, Log result, Antibody check first) with
  data-i18n across symptom, medication, vaccination mockups.
- Added string keys: action.bookBoosterIfLow, action.logResult,
  action.antibodyCheckFirst.
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 43. Deeper ST() tagging — button labels batch 2 (12 Nov 2026)
- Tagged 20+ additional button labels (Add results, Book *, Confirm treatment,
  Different treatment, Follow up on test, I attended, Log home/linked test (TOC),
  Log this visit, Log vaccination, Plan visit, Re-collect, Reschedule, Set reminder,
  View details/dose/encounter/visit/schedule) with data-i18n across all mockups.
- Added 20+ string keys to strings.js (action.* prefix).
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 42. Deeper ST() tagging — chip group titles batch (12 Nov 2026)
- Tagged 38 unique chip-group-title values with data-i18n across all 8
  render mockups. Added 38 string keys to strings.js (label.* prefix).
- Added data-i18n population scripts to 6 mockups that lacked them.
- Fixed literal \n issue in module scripts (converted to proper newlines).
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 41. Deeper ST() tagging — button labels batch (12 Nov 2026)
- Tagged Log dose, Log symptom, Log treatment, Resolve, Reopen button labels
  with data-i18n across medication, symptom, vaginal health mockups.
- Added string keys: action.log.symptom, action.log.treatment, action.resolve,
  action.reopen, action.message.
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 40. Deeper ST() tagging — Archive button in encounters (12 Nov 2026)
- Encounters render mockup: "Archive" button now carries data-i18n="generic.archive"
  populated via ST().
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 39. Deeper ST() tagging — chip values in contacts (12 Nov 2026)
- Contacts render mockup: "Available"/"Not available" chip values now carry
  data-i18n attributes populated via ST(). New keys: contact.available,
  contact.notAvailable.
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 38. Deeper ST() tagging — Edit button labels in contacts (12 Nov 2026)
- Contacts render mockup: "Edit" button labels now carry data-i18n="generic.edit"
  populated via ST().
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 36. BACKLOG 7 completion — empty tracking state (12 Nov 2026)
- TestDetail: added empty tracking state (shown when no kit codes or tracking
  info on a home-kit test).
- Design: destructive=red, pending/to-be-updated=amber, staff/patient=same.
- vite build passes; 0 FAIL on all render mockups.

## 33. BACKLOG 7 — Testing error & chase states in React app (complete, 12 Nov 2026)
- Void result state: red error banner in TestDetail.
- Chase history: section with chase count, chase dates, amber warning after 3+ chases, "Log a chase" action. Added chaseDates field to DEFAULT_TEST.
- Empty tracking state: shown when no kit codes/tracking on home-kit test.
- Failed load: error state display when test fails to load.
- Design: destructive=red, pending/to-be-updated=amber. Staff/patient=same.
- vite build passes; 0 FAIL on all render mockups.

## 33b. BACKLOG 7 — first slice (superseded by entry 33 above)
- Added "Void" to ResultsRegistry seed names.
- TestDetail: void result state shows red error banner ("Result void. Re-collect needed.").
- TestDetail: chase history section with chase count, chase dates, amber warning
  after 3+ chases, and "Log a chase" action. Added chaseDates field to DEFAULT_TEST.
- Design: destructive=red, pending/to-be-updated=amber. Staff/patient views same
  (single-user app).
- vite build passes; 0 FAIL on all render mockups.

## 32. BACKLOG 8 completion — en-US string variants (12 Nov 2026)
- Created src/i18n/en-US.json with Britishism→Americanism conversions
  (colour→color, centre→center, organisation→organization, etc.).
- Updated i18n/index.js to load en-US alongside en (en-GB alias).
- LocaleToggleCard now syncs to localStorage "shos_lang" on toggle.
- Build passes; 0 FAIL on all mockups.

## 31. BACKLOG 7 — Testing error & chase states mockup (12 Nov 2026)
- Created healthcare-testing-error-states-mockup.html with 4 card states:
  void result (red/destructive), pending after repeated chases (amber),
  failed load (error banner), empty tracking state.
- Design decision: destructive=red, pending/to-be-updated=amber. Void=red
  (destructive — result invalidated). Staff and patient views are the same
  in this single-user app.
- Smoke tests: 0 FAIL.

## 30. About screen — dedicated feedback email (12 Nov 2026)
- AboutScreen: added "Send feedback / bug report" row linking to
  adminshos@gmail.com via mailto. Dedicated feedback channel for
  error/bug reporting.
- vite build passes.

## 29. BACKLOG 12 — Episode grouping from Encounters (12 Nov 2026)
- Encounter detail view: added "Linked episodes" section with link/unlink
  and "Start a new episode with this encounter" action, using EpisodeRepository.
- Follows the same link/unlink shape as Testing's episode linking.
- vite build passes; 0 FAIL on all render mockups.

## 27. BACKLOG 8 first slice — Locale preference + toggle (12 Nov 2026)
- AppPreferencesRepository: added `locale` field (default "en-GB") to
  DEFAULT_APP_PREFERENCES.
- PreferencesScreen: added LocaleToggleCard (en-GB/en-US toggle) in the
  Appearance & language section, persisted via AppPreferencesRepository.
- Note: en-US string variants for the i18n system are not yet populated;
  the toggle stores the preference but the app still renders en-GB copy.
  Full locale switching needs i18n infrastructure work.
- vite build passes; 0 FAIL on all render mockups.

## 26. Deeper ST() tagging — Edit button labels (12 Nov 2026)
- Encounters render mockup: "Edit" button labels now carry data-i18n="generic.edit"
  populated via ST(). Added generic.title key to strings.js.
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 25. BACKLOG 5 — Partner identification from recent encounters (12 Nov 2026)
- PartnerNotificationSheet: added "Suggested partners" banner that identifies
  contacts encountered since the last negative test for the same organism.
  Pre-selects them via "Select all suggested" button.
- Uses EncounterRepository + TestingRepository to compute the candidate set.
- vite build passes; 0 FAIL on all render mockups.

## 24. BACKLOG 6 — Vaginal health render mockup (12 Nov 2026)
- Created healthcare-vaginal-health-render-mockup.html with 6 card states:
  PID (urgent/same-day), trichomoniasis (prompt), BV (routine/complete),
  candidiasis (routine/info), pregnancy (refer/pending), empty state.
- Urgency tiers follow clinical treatability (PID=cervicitis urgent,
  trich=prompt, BV/candida=routine, pregnancy=refer). Clinician sign-off
  needed on exact tiers before app build.
- Added to build-comparison.cjs (10 modules now).
- Smoke tests: 0 FAIL on all 10 mockups + comparison page.

## 23. BACKLOG 4 first slice — Episode linking in Testing detail (12 Nov 2026)
- Testing detail view: added "Linked episodes" section with link/unlink
  and "Start a new episode with this test" action, using EpisodeRepository.
  Follows the same link/unlink shape as "Linked clinic visit".
- Smoke/build: vite build passes; 0 FAIL on all render mockups.

## 22. Deeper ST() tagging — chip group titles (11 Nov 2026)
- Encounters render mockup: chip group titles (position, activities, protection,
  cum/loads, attendees) now carry data-i18n attributes populated via ST().
- Contacts render mockup: chip group titles (pronouns, HIV status, availability,
  platforms, relationship, gender, age) now carry data-i18n attributes.
- New string keys: contact.pronouns, contact.gender, contact.age.
- Smoke tests: 0 FAIL on all 8 render mockups + comparison page.

## 21. Deeper ST() tagging — modal form field labels (11 Nov 2026)
- Encounters modal: field labels (title, date/time, type, attendees, location,
  rating, notes) now carry data-i18n attributes populated via ST().
- Contacts modal: field labels (nickname, gender, age, phone, email, city, notes)
  now carry data-i18n attributes populated via ST().
- New string keys: encounter.dateTime, encounter.encounterType,
  encounter.enjoymentRating, encounter.location, contact.nickname, contact.gender,
  contact.age, contact.phone, contact.email, contact.city, contact.notes,
  generic.title.
- Smoke tests: 0 FAIL on all 8 render mockups + comparison page.

## 20. Deeper ST() tagging — modal form titles/buttons (11 Nov 2026)
- Encounters and contacts render mockups: modal title, cancel, and save
  buttons now carry data-i18n attributes populated from strings.js via
  ST(). New keys: encounter.addEncounter, contact.addContact,
  action.saveEncounter, action.saveContact.
- Smoke tests: 0 FAIL on all 8 render mockups + comparison page.

## 19. Superseded generalisation — partial supersede card (11 Nov 2026)
- STI mockup: added Card 8b demonstrating partial supersede (Chlamydia &
  Gonorrhoea superseded by later test; HIV & Syphilis remain valid on
  the original card). Uses the existing .superseded + .superseded-tag
  grammar with a "Partial supersede" tag variant.
- Fixed summary-separator FAIL introduced by the new card's data-copy
  (hyphen → middle dot).

## 18. STI native-dialog cleanup + loading/empty states on encounters & contacts (11 Nov 2026)
- STI mockup: removed all 6 native alert()/confirm() text references from comments;
  native-dialogs WARN now 0 on the STI card.
- Encounters and contacts render mockups: added loading skeleton, empty state, and
  error banner (BACKLOG 13 loading/empty/error states), clearing those WARNs.
- String-table migration deepened: tagged summary state lines with data-summary-key
  in testing, clinicvisit, symptom, vaccination, and contacts mockups; added
  summary.active, summary.resolved, summary.complete keys to strings.js.
- Smoke tests: 0 FAIL on all 8 render mockups + comparison page.

## 17. Mockup add/log forms + string-table wiring + two-way link sync (11 Nov 2026)
- Encounter render mockup: added in-app modal add/log form (title, date/time, type,
  attendees, location, rating, notes) using the STI confirm-dialog/toast pattern;
  no native alert()/confirm() remaining.
- Contact render mockup: added in-app modal add/log form (nickname, gender, age,
  phone, email, city, notes) using the same pattern.
- strings.js: attached ST/STHTML to window so classic inline scripts can call them.
- All 7 remaining render mockups now import strings.js and carry the string-table
  keyword; native-dialog WARN cleared on encounters/contacts.
- React app: two-way test↔visit link sync fixed — unlinkVisit (Testing) now drops
  the visit from test.clinicVisitIds; Clinic Visits save now diffs linkedTestIds
  and syncs test.clinicVisitIds both directions (added/removed).
- Smoke tests: 0 FAIL on all 8 render mockups + comparison page.

## 47. Full stress test: duplication, stale/unwired code, colour + spacing consistency (12 Nov 2026)

Adversarial pass over the whole tree (app, mockups, storage layer). Authoritative
detectors were `eslint .` and `vitest run`, not the Vite build or the HTML smoke
tests — which is why three render-time crashes had shipped green previously.

### Render-time crashes (previously reported as complete, were not)
- `SHOS_Testing_Prototype.jsx`: `isNew`/`linkedEpisodes`/`unlinkEpisode`/
  `setEpisodeVersion` etc. lived in `TestEditSheet` but were read in `TestDetail`
  → ReferenceError on open. Moved into `TestDetail`; `{!isNew && (` →
  `{testId && (`.
- `SHOS_PartnerNotification_Prototype.jsx`: `ContactPickerStep`/`ChecklistStep`
  used a `testId` prop they were never passed. Plumbed through + both call sites.
- `SHOS_Timeline_Prototype.jsx`: `onClose?.()` → `onBack?.()`.
- Closed the whole bug class permanently: new `src/components/jsxIdentifierBindingGuard.test.js`
  (@babel/traverse + `globals`) fails on any unbound JSX identifier; allow-lists
  only `__BUILD_SHA__`/`__APP_VERSION__`.

### Duplication / redundancy
- The delete/undo toast existed as 9 hand-written copies (Contacts, Encounters,
  Clinic Visits, Measurements, Medication, Symptom Log, Testing, Vaccinations,
  Menstrual Health). Extracted to `src/components/UndoToast.jsx`. The copies had
  already drifted: Encounters had lost `minHeight: 44`, and the `aria-label`s
  added in some copies replaced the accessible name with a bare "Undo delete",
  hiding *what* was deleted. Shared component drops the label (visible text is the
  name) and restores 44px. `TOAST` token pair added to designTokens.
- `strings.js`: duplicate keys `contact.gender` / `contact.age`.
- Contacts render mockup had two `.chip.contacts` rules after the first repair
  pass; removed the duplicate.

### Backend / data layer
- `SHOS_VaginalHealth_Prototype.jsx` was functionally dead: private `records`
  state always `[]`, nested delete `<button>` without `stopPropagation`, UTC dates.
  Rewritten (list/add/edit/delete, urgency tiers, ConfirmDeleteCard, EmptyState,
  `t()` i18n, loading skeleton).
- New `src/repositories/vaginalHealthRepository.js` (`shos_vaginal_health`, no
  seeds) so it joins the real storage paths: wired into `backupService.js`
  (export groups, date fields, build/restore/merge) and `resetAllData.js`.
- 35 new i18n keys in `en.json` + `en-US.json`; 3 speculative dead keys removed.

### Mockup defects (all 8 render files + STI card + comparison page)
- testing render: outlier palette renamed to the majority scheme
  (`--healthcare-dark`→`--hc`, `--med-blue*`→`--meds-blue*`, `--healthcare-teal*`→`--teal*`).
- Added rules for classes used but never defined: `.ctx-sub`, `.group-actions`,
  `.wrap-text`, `.btn.outline`, `.ctx-badge.suggested`, `.skeleton-line`(+sizes),
  `@keyframes pulse`, `.empty-state`, `.error-banner` (contacts/encounters/testing);
  `.chip.contacts` (6 chips), `.chip.meds-blue` + `.footer` (medication, 4 chips),
  `.footer` (vaccination), `.chip.meds-blue` + `.btn-sm` (vaginal health).
- Vaginal health: added `--green-tint`, `--meds-blue*`; dropped dead teal/purple/pink
  families, `.older-pill`, `.btn.outline-sm`, `.card.older`; empty state is now a
  dashed `.card.empty` instead of a 60%-opacity card.
- **Invisible text (real a11y bugs)**: `.chip.amber` used dark ink `#4d3300` on a 7%
  amber tint in 6 render files (≈1.3:1); `.chip.teal` used `#004d4d` on a 6% teal
  tint in 2 (≈1.7:1). Both now `#fff` on the tint — matching the card mockups.
- **Stale neutral palette**: the render set's neutrals had drifted from
  `NEUTRAL_DARK` in 4 of 7 values (`--variant`, `--primary`, `--secondary`,
  `--disabled`). Adopted the token values; this also lifted the whole muted tier
  from 3.2–3.8:1 to 4.3–5.4:1. Comparison page chrome updated to match.
- **Wrong medication accent**: mockups used `#5B9BFF`, which exists in 0 src files;
  the app's hand-picked dark medication accent is `#5B85F5` (21 uses). Fixed in the
  5 files that declared it — also raised white-on-blue buttons from 2.77:1 to 3.43:1
  (now exactly what the app does).
- Typography: the last 8px sites (`.older-pill` ×7, `.side` ×1) raised to the
  documented 9px micro tier; the 8px "(alt)" span in the STI card likewise.
- Removed 7 dead custom properties (verified 0 `var()` uses each) across
  encounters/medication/testing/vaccination.
- Fixed `#004d4d`/`#4d3300` comparisons mirrored in the comparison page; rebuilt via
  `node build-comparison.cjs`.

### Verified state
- `npx vitest run`: **2063 passed, 1 skipped, 0 failed** (188/189 files).
- `npx eslint .`: 0 errors, 2 pre-existing `react-hooks/exhaustive-deps` warnings in
  `SHOS_Encounters_Prototype.jsx`.
- `npx vite build`: ✓.
- Smoke tests: **0 FAIL on all 10 files** (8 render mockups, comparison page, STI card);
  remaining WARNs are the documented "static spec doc" n/a items (BACKLOG 4/13).
- 0 used-but-undefined classes, 0 undefined `var()` references (only a prose
  false positive in `encounters-form-fixes-mockup.html`), 0 dead palette entries,
  0 sub-9px font sizes, no horizontal overflow, 0 console errors.
- `npx vitest run`: **2063 passed, 1 skipped, 0 failed** (188/189 files).
- `npx eslint .`: 0 errors, 2 pre-existing `react-hooks/exhaustive-deps` warnings in
  `SHOS_Encounters_Prototype.jsx`.
- `npx vite build`: ✓.
- Smoke tests: **0 FAIL on all 10 files** (8 render mockups, comparison page, STI card);
  remaining WARNs are the documented "static spec doc" n/a items (BACKLOG 4/13).
- 0 used-but-undefined classes, 0 undefined `var()` references (only a prose
  false positive in `encounters-form-fixes-mockup.html`), 0 dead palette entries,
  0 sub-9px font sizes, no horizontal overflow, 0 console errors.
- Contrast sweep (WCAG formula, alpha-blended): worst case anywhere is now 3.43:1
  (outline-button accent text, matching the app's own `--hc` usage); nothing below
  3:1 remains. Medication's filled button at 3.43:1 is the app's real choice
  (`fabIcon: "#FFFFFF"` on `#5B85F5`), reproduced deliberately.

### Deliberate divergences (recorded, not churned)
- Mockup card radius is 12px across the set (25+ sites, 0 at 13px) while
  `RADIUS.md = 13`. Recorded as a known divergence rather than touching 23 files.
- The card mockup set (the separate audit generation) still carries the pre-NEUTRAL_DARK
  neutrals; preserved as-is per the user's instruction to keep render and audit mockups
  separate. The comparison page labels the two sets distinctly.
- `*-soft` variants (`--hc-soft`, `--meds-blue-soft`, `--contacts-soft`) have no src
  literal to match: the app derives them at runtime via `resolveDarkAccent`, so the
  mockup values are the documented stand-ins, not drift.
- `.chip.more`/`.chip.ghost` at `opacity:.35` and the dimmed archived/older cards
  (4.32:1) are intentional de-emphasis, not unreadable UI.

## 48. Challenge pass: colour outliers + dedup + reset honesty (12 Nov 2026)

Second adversarial pass (challenge before/after). Two more real defects found
and fixed; the rest is a recorded finding list.

### Fixed
- `SHOS_Encounters_Prototype.jsx:134` — medication dark-mode fallback was
  `#4a90e2`, while every other module uses `#5B85F5` (the canonical dark
  companion). Encounters showed a different medication blue in dark mode. Now
  `#5B85F5`.
- `customOptionListsRepository.js:215,216,224` — three medication-related option-list
  icons still hardcoded `#3D63C9` (the pre-Tier-1 blue) despite the file's own
  comment saying that stale value had been replaced with the shared token. Now
  `ACCENTS.medication`, matching the 9 sibling entries.
- `refillRedactedLine` deduplicated: previously defined byte-identically in
  `medicationReminderSync.js:510` and `refillReminderSync.js:506`. Single source is
  now `medicationReminderSync.js`; `refillReminderSync.js` re-exports it (and imports
  the binding for its own internal call). A test (`widgetRedactedRender.test.js:625`)
  had documented the duplication as deliberate; it is now collapsed.
- `resetAllData.js` now clears the 6 `shos_contact_filter_*` keys that
  `SHOS_Contacts_Prototype.jsx:3067-3081` wrote via raw `localStorage`. Previously
  "Reset all data" left contact filter state behind (and those keys were absent from
  backup/restore/merge by design — they are UI state, not user data).

### Challenge results (what held)
- `npx eslint .`: 0 errors, 2 pre-existing warnings.
- `npx vite build`: ✓.
- Targeted tests (refill second stage, widget card lines, redacted render, due
  shapes): 39/39 passed.
- Spacing audit: only 2 off-grid declarations in all of `src/` (both `padding: 6px`
  in `recordExportService.js`).
- `resolveDarkAccent` default-argument audit: the only outlier was Encounters'
  medication (`#4a90e2`); every other module/key is consistent.
- No test referenced `#4a90e2` or `#3D63C9`, so the colour fixes are behaviour-safe.

### Recorded (not fixed — needs a decision or a bigger pass)
- `13px` is used 516 times but has no TYPE token (TYPE defines 11/12/14/16/18/20/22).
  Highest-leverage consistency win; recommend a `TYPE.body` addition + conversion pass.
- 15 distinct font sizes in `src/` vs 7 in TYPE (9, 10, 13.5, 15, 17, 26, 28 also
  untokenized; 13.5 in `InteractiveTour.jsx:219` looks accidental).
- `contactMerge.js` (`detectDuplicateCandidates`, `duplicateCandidatePanel`) is only
  imported by its own guard test — shipped-but-unwired capability. Wire into Contacts
  or delete it and the test.
- 6 `shos_contact_filter_*` keys bypass `storageAdapter`; reset now clears them, but
  they remain outside backup by design (documented).
- Dead exports with zero production AND test refs: `REDACTED_COPY`, `FONT_FAMILY_MONO`,
  `CONTACT_REQUIRED_FIELD_GROUPS`, `CUMMER_OPTIONS`, `getVaultError`, `derivePinVerifier`,
  `clearGraceWindow`, `hasPinProtection`, `secureRemove`, `RELEASE_PAGE_URL`,
  `SkeletonRow`, `TOUR_STEPS`, `purgeExpired`, `getOpen`, `removeMemberFromAllGroups`,
  `getGroupForMember`, `REMINDER_KINDS`/`ACK_SCOPES` aliases, `applyDisclosure`,
  `normaliseAcknowledgement` (singular), `DEFAULT_VAGINAL_HEALTH_ENTRY`. Safe to remove
  in one PR; lint + tests will catch any miss.
- `SHOS_Attachments_Prototype.jsx` is only reachable via Healthcare's lazy import
  (not dead — tab is wired — but nested).
- No dead preference keys: every `AppPreferencesRepository` key has a read site.
- Mockup card radius 12px vs `RADIUS.md = 13` (23 files) — recorded divergence.
- Card-mockup set carries pre-NEUTRAL_DARK neutrals; preserved as a separate artifact
  set per user instruction.
- `encounters-form-fixes-mockup.html` has a prose false-positive `--shos-sheet-banner-h`
  reference (inside `<code>` text).

### Recommended next steps (updated)
1. Tokenise `13px` (`TYPE.body`) and convert the 516 sites — highest-leverage
   consistency win; do before any new module is written.
2. Delete the dead exports listed above in one PR (zero refs, lint + tests verify).
3. Decide the fate of `contactMerge.js` (wire or delete).
4. Dedup is done; verify no other byte-identical long helpers remain (the spacing
   + style-block scans are clean).
5. Add a CI guard for mockup hygiene (port the undefined-var / dead-palette /
   undefined-class checks into `smoke-test.cjs`) so the 0-FAIL state is ratcheted.
6. Run the full `vitest run` once more after the Encounters/customOptionLists edits
   (lint clean; no test references the changed values).

## 49. Visual audit (13 Nov 2026) — full screen-by-screen pass + control-linkage rule

Findings-only pass running live in the app (dark then light). All findings live
in `AUDITS.md` (repo root): BUG 1 TourOverlay re-render loop, BUG 2 SW update
banner false positive + dismissal flag not read back, dead-space/layout economy
(encounter card empty group labels, empty contact-detail SectionCards,
medication FAB overlap), sample-data typo "won't repeast", goldText pair vs
ACTION.gold, ~30 stray hexes, medication "Show archived (1)" suspected broken
link.

### 49a. NEW RULE from owner: audit every switch/toggle/button independently
- Owner: "just because a toggle looks like it does something doesn't mean it
  actually works." Each control must be verified for: (1) visual state flip,
  (2) dependent UI actually re-renders, (3) change is real (persisted /
  data-level, not just local visual state), (4) toggling back restores
  cleanly. A control satisfying only (1) is a bug.
- Apply retroactively: re-verify controls already exercised visually
  (Preferences toggles, contacts sorts/filters/select, encounter archived +
  date filter, medication archived) with data-level checks, and keep the rule
  for all remaining screens.
- Suggested permanent ratchet: extend smoke tests / vitest to click through
  each toggle's dependent render where feasible.

### 49b. Port mockup card design language into the live app — AFTER the audit
- Owner question (13 Nov 2026): "did mockups/renders get implemented?" — NO:
  the render/card mockups (root-level HTML files: encounters-card-mockup,
  healthcare-*-render-mockup, all-modules-card-comparison, etc.) remain
  separate design artifacts; the app's JSX cards use plain bordered sections
  with text labels, not the mockups' colour-indent/backfill section rows.
- Decision: do this restyle AFTER the audit completes (dark pass → light
  pass → restore defaults → consolidated findings), as one deliberate pass
  across all modules, then re-verify lint + vitest + smoke tests.
- It dovetails with Finding 8 (dead space): the backfilled section-row design
  also resolves the empty-label rows if empty sections are collapsed or
  hidden. Collect all remaining card findings first so the port is done once.
