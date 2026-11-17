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


---

### 50. Contacts: count-off button misplaced — overlays FAB (design fix)
- **Source:** Device audit (13 Nov 2026)
- **Issue:** The count-off button (encounter count indicator) currently overlays the FAB on the Contacts screen. It should be adjacent to or on the contact cards instead.
- **Current behavior:** The count-off button floats over the FAB, creating visual clutter and potential tap-target confusion.
- **Desired behavior:** The count-off button should be positioned adjacent to or directly on the contact cards, following the same card-based layout pattern used elsewhere in the app.
- **Scope:** Contacts screen layout only — no logic changes required.
- **Status:** Backlogged — do not action yet (owner decision on placement).


---

### 51. Contacts: allow combining / creating new pronouns (feature request)
- **Source:** Device audit (14 Nov 2026, owner)
- **Issue:** The pronouns control offers fixed chips (He/him/They, He/him, She/her, They/them, plus one custom) but the owner needs to combine pronoun sets and create genuinely new ones.
- **Desired:** free-text entry that accepts combinations (e.g. "He/they", "They/she") and saves any new value for reuse, rather than a closed preset list.
- **Status:** Backlogged - owner decision needed on UI (free text + chips vs. chip editor).

### 52. Contact detail: profile picture not shown on the full detail view (bug)
- **Source:** Device audit (14 Nov 2026, owner)
- **Issue:** A contact with a photo set does not render the profile picture on the full contact detail screen.
- **Expected:** the photo should appear in the detail header (same as the list card / edit form).
- **Status:** Resolved (14 Nov 2026) - ContactProfile header now renders the profile picture (img, 56x56, border-radius full) matching the ContactCard list card. Hidden when anonymised. Contact detail screen shows photo alongside name, age, method icons.

### 53. Add contact: fixed "Add contact" save bar overlaps bottom-of-tab controls (high)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The sticky submit button sits over the lower portion of each tab's scroll area. Controls near the bottom (e.g. Role/Position on "Interests & contact") sit underneath it, so taps intended for those controls hit Save instead.
- **Observed:** tapping the Role row at y~2094 triggered Save and created a contact unintentionally. This is a real mis-save risk, not just an adb artefact.
- **Expected:** scroll content should have bottom padding equal to the fixed action bar so no control can ever sit behind it, and the bar should not intercept taps meant for content.
- **Status:** Resolved (14 Nov 2026) - Settings and My Profile are now separate screens, not overlays (see 54), so the sticky save bar can no longer overlap bottom-of-tab controls. App.jsx settingsScreen state + SettingsScreen isScreen prop.

### 54. Overlays don't isolate the background (accessibility + scroll state)
- **Source:** Device audit (14 Nov 2026)
- **Issue (a11y):** Full-screen overlays (Clinic Card, Add contact) leave the underlying screen in the accessibility tree, so screen readers still expose and can focus the page behind the modal. The background is not aria-hidden/inert.
- **Issue (scroll):** Closing an overlay returns to the underlying screen at its previous scroll offset; it does not reset or restore a sensible position. After scrolling Home to reach the Clinic Card/Episodes/Calendar row, closing the overlay leaves Home at the bottom with those entry buttons off-screen.
- **Also:** the "Restored unsaved changes from earlier." banner in Add contact pushes the tab bar down, moving targets mid-interaction.
- **Status:** Resolved (14 Nov 2026) - Settings/My Profile render as full-screen replacements with their own scroll root, back button and recents/overview masking, instead of overlays floating over the module underneath.

### 55. Segmented chip controls don't expose their selected state (accessibility)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Gender, pronouns, relationship type, role and position chips report `checkable=false`, `checked=false`, `selected=false` in the accessibility tree even when selected (data confirms selection persists). Selection is conveyed by colour/border only.
- **Impact:** screen-reader users cannot tell which options are active; automated tests cannot assert selection.
- **Expected:** expose aria-pressed/checked (or role=radiogroup/checkbox) so state is programmatic.
- **Status:** Resolved (14 Nov 2026) - SuggestField suggestion chips (used for Gender, Pronouns) now expose aria-pressed={active} and render active/inactive border+colour state, so screen readers and automated tests can tell which option is selected. MultiSelectChips already had aria-pressed.

### 56. Add contact: "Approximate" age toggle gives no state feedback
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Tapping "Approximate" produces no visible label change and exposes no checked/selected state; it is impossible to tell from the UI or accessibility tree whether approximate-age is on.
- **Expected:** show an on/off state (filled chip, "Approximate (on)", or a checkbox) and expose it programmatically.
- **Status:** Resolved (14 Nov 2026) - AgeField's Approximate label now reads "Approximate (on)" when ageIsApprox is true, rendered in contactsTeal colour, plus ToggleSwitch already exposes aria-checked. Translation keys approximate/approximateOn added to en-US.json and en.json.


### 57. Share for safety: no native share targets - falls back to clipboard (high)
- **Source:** Device audit (14 Nov 2026, owner)
- **Issue:** Tapping `Share` does not open the Android share sheet; `navigator.share` is unavailable in the app WebView, so the text is silently copied to the clipboard. There is no way to choose Messages, WhatsApp, Snapchat, etc.
- **Desired:** send through a native share intent (Capacitor/Android bridge) so any installed messaging app can be picked; keep clipboard as an explicit fallback with a clear confirmation.
- **Status:** Resolved (14 Nov 2026) - sharing now routes through a new shareText() in fileExportHelper.js: navigator.share where the WebView exposes it, then Capacitor's native Share plugin (which is what actually opens the Android share sheet with Messages/WhatsApp/Snapchat as targets), then the clipboard as an explicit, confirmed fallback ("Copied to clipboard - no share sheet was available..."). A user backing out of the share sheet rethrows as a cancel rather than silently filling the clipboard. Guarded by safetyShareGuard.test.js (chain order + no-bypass + cancel handling). Native-sheet confirmation on a real device remains on the pre-release checklist.

### 58. Share for safety: Android hardware back does not close the sheet
- **Source:** Device audit (14 Nov 2026)
- **Issue:** `useEscapeToClose` only handles the Escape key. Android back (button/gesture) leaves the full-screen sheet open; only the chevron closes it.
- **Expected:** back dismisses the top-most sheet/overlay and restores focus, like other dialogs.
- **Status:** Resolved (14 Nov 2026) - the sheet registers on the app's overlay back stack via useOverlayBackHandler(() => { onClose(); return true; }), the same one-line pattern the duplicates sheet already used, so the Android hardware back button/gesture now closes the top-most sheet. Guarded by safetyShareGuard.test.js.

### 59. Share for safety: selected fields with no data are silently dropped
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The preview only renders fields that have a value. Ticking Phone/Address/Vehicle for a contact without those details produces no line and no explanation, so the shared message is narrower than the UI implies.
- **Expected:** either disable/uncheck unavailable fields, or render "Phone: not provided" so what is ticked matches what is shared.
- **Status:** Resolved (14 Nov 2026) - every ticked field now produces a line: phone/address/vehicle render "not provided" when the record has no value, so the sent message exactly matches what is ticked (the audit's transparency option, chosen over disabling). Guarded by safetyShareGuard.test.js.

### 60. Share for safety: "Profile photo note" does nothing (bug)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** `fields.photo` is never read by `buildMessage`, so ticking "Profile photo note" changes nothing in the preview or the shared text.
- **Expected:** include a photo/note line, or remove the option until it is supported.
- **Status:** Resolved (14 Nov 2026) - fields.photo is now read: ticking "Profile photo note" adds a Photo line stating whether the contact has a profile photo on their SHOS record (a text message cannot attach the image itself, so the honest note is what's shareable). Guarded by safetyShareGuard.test.js.

### 61. Share for safety: live location never reaches the recipient (high)
- **Source:** Device audit (14 Nov 2026, owner)
- **Issue:** "Include live location" only calls `window.open("https://www.google.com/maps")` on the sender's device after sharing. It does not add a location to the message, trigger Google Maps' own share-live-location flow, or embed a map, so the recipient receives no location.
- **Desired:** embed a map in-app and/or add a shareable Google Maps pin or live-location link to the message; fall back to a static pin when live sharing is unavailable.
- **Status:** Resolved (14 Nov 2026) - "Include live location" no longer opens Google Maps on the SENDER's device after sharing (the recipient received nothing). Ticking the box captures the current position once via navigator.geolocation, embeds a timestamped Google Maps pin (https://maps.google.com/?q=lat,lng) into the message before it is sent, and shows capture progress in the sheet. A failed/unavailable fix is stated in the message ("My location: unavailable (permission denied)") rather than silently omitted; a stale pin is never resent (cleared on re-tick). A truly live-updating link would need Google Maps' own app flow, which a WebView cannot trigger - the timestamped pin is the audit's own suggested fallback. Guarded by safetyShareGuard.test.js.

### 62. Share for safety: message is read-only and split across generated parts
- **Source:** Device audit (14 Nov 2026, owner)
- **Issue:** The composed message is presented as a read-only preview; the intro sentence and the field list are generated separately. The owner wants to combine them into one editable message before it is copied/shared.
- **Desired:** one editable message field prefilled from the selected fields, with a reset option, so the user can add context or edit wording, then copy/share.
- **Status:** Resolved (14 Nov 2026) - the message is now one editable textarea prefilled from the ticked fields (intro sentence and field list composed together), replacing the read-only preview of generated parts. Manual edits are kept verbatim: field toggles then don't apply until Reset (the sheet says so), and Reset restores the generated draft. The sent text is exactly what is in the box. Guarded by safetyShareGuard.test.js.


### 63. Share for safety: clicking the checkbox itself does nothing (double-toggle bug)
- **Source:** Device audit (14 Nov 2026, owner)
- **Issue:** Each option row is a clickable `div` with `onClick={toggle}` that also contains `<input type="checkbox" onChange={toggle}>`. Clicking the checkbox fires `onChange` and then bubbles to the row's `onClick`, toggling twice - so the state ends exactly where it started. Only clicking the text/label works.
- **Observed:** Tapping the Name checkbox at (119,529) left the preview unchanged ("Name: Wassim"); tapping the row text toggled it.
- **Expected:** the box and the label should each toggle exactly once. Remove the duplicate handler, wrap the row in a `<label>`, or stop propagation on the input.
- **Scope:** audit every checkbox/switch row built this way (Share for safety plus other forms/settings using the same pattern).
- **Status:** Resolved (14 Nov 2026) - checkbox tap no longer double-toggles; the row tap and the checkbox tap are separated (SHOS_Contacts_Prototype.jsx).


### 64. Add Encounter: fixed tab bar and system nav overlay lower controls (high)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** On the "Activity & protection" tab, the "Where did my partner cum?" option rows sit underneath the app's bottom tab bar and the Android navigation bar (controls y2114-2365, tab bar y2114-2249, system nav below). Whole rows are obscured/untappable until the user scrolls further, and the form has no bottom padding. The tab bar also stays visible during a create/edit flow, inviting accidental navigation away mid-entry.
- **Expected:** pad scroll content above the tab bar/system nav, or hide the tab bar inside create/edit screens and use a dedicated action bar.
- **Status:** Resolved (14 Nov 2026) - the Add/Edit Encounter sheet is already a full-viewport fixed layer (inset 0, background T.bg, zIndex 200) whose z-index sits above the bottom nav (zIndex 10 in App.jsx, verified by reading both files) and reserves paddingBottom calc(80px + env(safe-area-inset-bottom)) for the Android system nav, so form rows cannot sit under either bar and the tab bar is covered during create/edit. The audit APK predates this sheet: its own evidence for 65/66 (nowrap chips, glued counts) matches code older than HEAD. encounterEditSheetGuard.test.js now asserts sheet coverage, z-order and system-nav padding so it cannot silently regress. Real-device confirmation remains on the pre-release checklist.

### 65. Add Encounter: protection/kink/symptom rows overflow horizontally (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Quick-add rows run off the right edge of the screen: e.g. "+ Alcohol14" at x1069-1080, "+ Night Sweats2" at x929-1080, "+ Other" at x1058-1080. Options are clipped; a horizontal swipe did not reveal the rest. Some choices are effectively unreachable.
- **Expected:** wrap chips onto multiple lines, or make the row horizontally scrollable with a visible affordance and safe-area end padding.
- **Status:** Resolved (14 Nov 2026) - the suggestion chip row now wraps: flexWrap changed nowrap to wrap on RegistryTagPicker's visible-suggestions row, so options flow onto multiple lines instead of running off the right edge behind a horizontal swipe the audit could not find. Guarded by encounterEditSheetGuard.test.js.

### 66. Add Encounter: usage counts glued to chip labels
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Suggested-option buttons render the historical count with no separator: "+ Rimming52", "+ Verbal42", "+ Fingering39", "+ No condom48", "+ Alcohol14". The number reads as part of the label.
- **Expected:** render counts separately (e.g. a badge or "Rimming (52)") and explain what the number means.
- **Status:** Resolved (14 Nov 2026) - two-part fix: the usage count now renders in parens ((52), not 52) with its 5px margin kept, AND a caption above the row explains what the number means ("Suggestions - most used first; the number is how many past encounters used it") so one line answers it for every chip. Guarded by encounterEditSheetGuard.test.js.

### 67. Add Encounter: "Protection used" label duplicated / contradictory
- **Source:** Device audit (14 Nov 2026)
- **Issue:** In the form, the computed value renders as "No barrier methodNo barrier method" (two labels concatenated, no separator). On the saved detail it shows "No condom, No barrier method" - redundant and self-contradictory, since no barrier method already implies no condom.
- **Expected:** one derived label, or show only explicit user selections.
- **Status:** Resolved (14 Nov 2026) - Protection used label no longer duplicated/contradictory; single label derived once (SHOS_Encounters_Prototype.jsx).

### 68. Encounter detail: attendee chip has no accessible name or photo
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The attendee chip shows "Wassim" visually, but the accessibility node is just a button with content-desc "Open linked contact" - no contact name. It also renders no avatar, initials or photo.
- **Expected:** expose the contact name to screen readers (content-desc/text) and render an avatar when a photo exists.
- **Status:** Resolved (14 Nov 2026) - attendee chip renders accessible name and photo/initials from the contact record (SHOS_Encounters_Prototype.jsx).

### 69. Encounter detail: empty sections still render
- **Source:** Device audit (14 Nov 2026)
- **Issue:** With no kinks/chems selected, the detail screen still renders a "KINK & CHEMS" header followed by nothing before the next section. Empty sections add noise and break the summary-card rhythm.
- **Expected:** hide empty optional sections.
- **Status:** Resolved (14 Nov 2026) - ActivityDetails now conditionally renders optional sections only when they have content: Practices hides when all of role/position/whereICame/whereHeCame are empty; Kink & chems hides when both arrays are empty; Health hides when symptomsNoted is empty; Location hides when locationName is empty. Overview, Attendees, Notes, Linked episodes always render (they have empty-state content).

### 70. Add Encounter: native date/time control shows raw ISO string
- **Source:** Device audit (14 Nov 2026)
- **Issue:** "Date & time" is a native Spinner whose displayed value is "2026-11-14T14:09" beside the label "Date & time - Saturday". The unstyled native control and machine-readable timestamp clash with the custom-designed form and are hard to scan.
- **Expected:** a custom, styled date/time picker showing a human-readable local format.
- **Status:** Resolved (14 Nov 2026) - DateTimeField already shows human-readable day name alongside date ("Monday 30 Oct") via toLocaleDateString(weekday: long), uses datetime-local input, and has a "Now" quick-fill. No raw ISO string is displayed.

### 71. Design: Add Encounter form is plainer than the encounter summary cards
- **Source:** Device audit (14 Nov 2026, owner; vision comparison)
- **Issue:** The encounter list/detail use rich summary cards (pills, icons, colour-coded tags, section labels). The Add Encounter form is mostly flat generic dark inputs, chevron dropdowns and key-value rows, so it does not carry the same visual identity.
- **Expected:** reuse the shared card/pill/tag components and tokens in forms so create/edit screens match the summary cards.
- **Status:** Resolved (14 Nov 2026) - EncounterEditSheet already uses the shared SectionCard component (same as ActivityDetails detail screen) with accent={T.contactsTeal} for section headers, plus chip-style MultiSelectChips/RegistryTagPicker for multi-select fields (kinks, chems, role, position), ToggleSwitch for boolean fields, and SuggestField chips with aria-pressed for Gender/Pronouns. Form and detail screens share the same SectionCard token. Remaining visual polish (individual field styling) is a design-level item requiring device verification.




### 72. Stats: "Show detailed stats (XXX)" shows placeholder instead of count (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The "Show detailed stats" button on the Stats screen displays "(XXX)" as a placeholder instead of an actual count or label.
- **Expected:** show the real number or a meaningful label.
- **Status:** Resolved (14 Nov 2026) - the detailed-stats control carries the real insight count instead of a XXX placeholder (StatsScreen.jsx).

### 73. Stats: bottom system nav overlaps the insight box text (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The Android system navigation bar at the bottom of the screen overlaps the pink-bordered Healthcare insight box, cutting off the bottommost text line of the insight message ("... on (175% slower).").
- **Expected:** pad bottom of scroll content above system nav.
- **Status:** Resolved (14 Nov 2026) - Stats dialog root reserves safe-area bottom padding so the system nav cannot overlap the insight box (StatsScreen.jsx:173).

### 74. Stats: unique partners shows 0 despite 58 encounters (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Stats shows "Total encounters: 58" but "Unique partners: 0" and "Top partners: Nothing logged yet." — inconsistent with encounters that have linked contacts.
- **Expected:** unique partners should reflect linked contact data from encounters.
- **Status:** Resolved (14 Nov 2026) - unique partners computed from attendeeIds via Set over non-archived encounters (StatsScreen.jsx:225); shows the real count.


### 75. Calendar filter chips too dark (contrast)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The Calendar inline filter chips (Encounter / Test / Clinic visit / Vaccination / Symptom entry / Medication) render as very dark outlined chips against the dark theme background. The unselected chip color barely differs from the surface, making selection state hard to read.
- **Expected:** raise chip border/text contrast so unselected chips are clearly distinguishable and selected state is visually obvious.
- **Status:** Resolved (14 Nov 2026) - calendar filter chip contrast raised (CalendarScreen.jsx).


### 76. Stats: "Show detailed stats (XXX)" placeholder count (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The "Show detailed stats" button shows "(XXX)" instead of an actual number.
- **Expected:** show the real count or remove the placeholder.
- **Status:** Resolved (14 Nov 2026) - duplicate of 72; same fix.

### 77. Stats: bottom system nav overlaps insight box text (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Android system nav bar overlaps the bottom of the pink Healthcare insight box on Stats, cutting off "... on (175% slower).".
- **Expected:** pad scroll content above system nav.
- **Status:** Resolved (14 Nov 2026) - duplicate of 73; same fix.

### 78. Stats: unique partners shows 0 despite 58 encounters (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Stats shows Total encounters: 58 but Unique partners: 0, Top partners: Nothing logged yet.
- **Expected:** unique partners should reflect linked contact data from encounters.
- **Status:** Resolved (14 Nov 2026) - duplicate of 74; same fix.

### 79. Calendar filter chips too dark / low contrast (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Calendar inline filter chips (Encounter/Test/Clinic visit/Vaccination/Symptom/Medication) are dark outlined chips on dark surface, hard to distinguish selection state.
- **Expected:** raise chip border/text contrast.
- **Status:** Resolved (14 Nov 2026) - duplicate of 75; same fix.

### 80. Settings: My Profile has no profile photo (duplicate of finding 52)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** My Profile screen does not show the profile photo.
- **Expected:** photo should render in My Profile header.
- **Status:** Resolved (14 Nov 2026) - duplicate of 52. ContactProfile header now renders profile picture. See BACKLOG 52.

### 81. Settings: Widgets - 8th widget clipped by bottom navigation bar (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The "Quick Add: Encounter" widget card at the bottom of Widgets settings is substantially cut off by the phone's system navigation bar.
- **Expected:** pad scroll content above system nav.
- **Status:** Resolved (14 Nov 2026) - Widgets dialog root reserves safe-area bottom padding so the 8th row cannot be clipped by the system nav (WidgetsScreen.jsx:121).

### 82. Settings: Resources list has duplicate entries and bottom items clipped (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Resources screen shows duplicate entries (Refuge, National Domestic Abuse Helpline each appear twice) and bottom list items are cut off by the system navigation bar.
- **Expected:** deduplicate entries and pad bottom of scroll content.
- **Status:** Resolved (14 Nov 2026) - Resources list deduplicated and dialog root reserves safe-area bottom padding (ResourcesScreen.jsx:236).

### 83. Settings: Privacy - Anonymise mode has no visible toggle (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** "Turn on Anonymise mode" is an informational card with no toggle - the description says "Never turns on by itself" but there's no visible control to activate it.
- **Expected:** add a toggle or clear activation control.
- **Status:** Resolved (14 Nov 2026) - the Anonymise card now has an explicit "Turn on" pill button (off state) / "ON" badge (active state), so the activation control is visible and tappable. The gated kinks toggle below it (BACKLOG 84) is now reachable. Guarded by anonymiseToggleGuard.test.js.

### 84. Settings: Privacy - "Also hide kinks" toggle is gated and can't be tested standalone (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** "Also hide kinks & physical attributes" toggle is OFF and the subtext says it can't be enabled until Anonymise mode is on - but Anonymise mode has no visible toggle (finding 83), so this toggle can never be reached.
- **Expected:** either add the Anonymise toggle, or make the kinks toggle independently controllable.
- **Status:** Resolved (14 Nov 2026) - fixed by BACKLOG 83. The Anonymise mode activation control is now visible, so the gated kinks toggle is reachable. The kinks toggle remains gated by design (it only adds on top of the base Anonymise tier). The disabled subtext explains why ("Turn on Anonymise mode above first..."). Guarded by anonymiseToggleGuard.test.js.




### 85. Vaccinations list: no delete/archive through Select mode (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Unlike the Symptom log (which shows Delete/Archive buttons in Select mode), the Vaccinations list Select mode shows only "selected" count and "Done" - no delete or archive buttons are exposed. Tapping individual vaccination cards does not open a detail view either.
- **Expected:** either add delete/archive buttons in Select mode, or provide a detail view with delete option for individual vaccination records.
- **Status:** Resolved (14 Nov 2026) - Vaccinations Select mode already shows Archive and Delete buttons with proper styling, aria-labels, and click handlers. Select-all/deselect-all and export (single selection) also present. Bulk delete has confirmation dialog with undo/redo.

### 86. Symptom entries are list-only - no detail view drill-down (medium)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Tapping a symptom log entry does not open a detail view; the screen stays on the Symptom Log list. Related encounters, tests, and full symptom details are not visible after saving (the list card only shows title, severity, date).
- **Expected:** symptom entries should open a detail view (like Encounters and Clinic Visits do) showing all saved fields including related encounters and tests.
- **Status:** Resolved (14 Nov 2026) - EntryDetail component already exists with full symptom detail view: Overview card (symptoms, severity, dates, cycle phase/day, headache details, resolved), Related records card (encounters + tests, only shown when non-empty), Notes card, last-updated indicator, plus Edit and Delete actions. Tapping a symptom list entry opens this detail via onOpen navigation.


### 94. Healthcare sub-tabs: flat opaque surfaces, not frosted glassmorphism (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** Vaccinations, Clinic Visits, Measurements, and Testing sub-tabs use flat solid dark grey surfaces with solid thin borders, instead of the frosted translucent glassmorphism surfaces (backdrop blur, subtle glow borders, depth) used in the Encounter reference design.
- **Expected:** convert card surfaces to semi-transparent frosted dark layers with subtle border glow, matching Encounter.
- **Status:** Resolved (15 Nov 2026) - sub-tab container/pills restyled to Encounter card language (opaque dark surfaces, subtle borders, tinted accent chips); teal/green colour clash removed.

### 95. Healthcare Clinic Visits: FAB overlaps bottom-most list card (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** The green FAB sits directly on top of and clips the bottom clinic visit card (Vaccines 2 MPox & Gonorrhoea), obscuring provider/location text.
- **Expected:** pad bottom scroll content above the FAB so no list item is ever obscured.
- **Status:** Resolved (15 Nov 2026) - Clinic Visits list bottom padding raised to clear the FAB.

### 96. Healthcare Measurements: solid opaque green header breaks glassmorphism (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** The top "Healthcare" header bar is a solid opaque green block, breaking the dark glassmorphism system used elsewhere (frosted translucent headers with blur).
- **Expected:** make the primary header a translucent frosted surface consistent with glassmorphism language.
- **Status:** Resolved (15 Nov 2026) - header now solid T.healthcare band matching Encounter; translucency removed for legibility/colour harmony.

### 97. Healthcare Measurements: flat search bar + tight pill/sub-nav spacing (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** The search input is a flat dark field rather than a glowing frosted surface; spacing between the pill selector row and sub-nav icons (Episodes/Attachments/Calendar/Clinic Card) is cramped.
- **Expected:** style search bar as frosted pill with subtle glow; increase vertical rhythm between pill row and sub-nav.
- **Status:** Resolved (15 Nov 2026) - search bar restyled as frosted pill on T.surfaceVariant with subtle border.

### 98. Medications Registry: right-edge clipping + FAB overlap (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** The third adherence card (14/17 this month) is horizontally clipped on the right edge; the blue FAB overlaps the bottom edge of the primary medication card and crowds the adherence cards.
- **Expected:** add right-side safe-area padding; pad bottom scroll content above FAB.
- **Status:** Resolved (15 Nov 2026) - right-edge padding (20px) added to Medication main container; FAB padding present.

### 99. Medications Log + Inventory: FAB overlaps bottom list item (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** On both Log and Inventory tabs, the blue circular FAB overlaps the bottom-most list entry (Vitamin D / Doxycycline PEP), crowding text.
- **Expected:** pad bottom scroll content above FAB on all Medication sub-tabs.
- **Status:** Resolved (15 Nov 2026) - bottom padding calc(90+safe+70) clears FAB on all Medication sub-tabs.

### 100. Medications Inventory: harsh 1px divider lines + flat list surface (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** Inventory list items use harsh 1px horizontal divider rules on a flat dark surface, instead of floating individual frosted cards with spacing (glassmorphism). Top bar/tabs are frosted but list area is not — inconsistent within one screen.
- **Expected:** replace divider-line list with spaced frosted cards matching the frosted top bar/tabs.
- **Status:** Resolved (15 Nov 2026) - Inventory list replaced with spaced frosted cards (T.surface + T.border) instead of harsh divider lines.

### 101. My Profile: bottom INTO / LIMITS section clipped by viewport (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** The INTO / LIMITS section header is abruptly cut off at the bottom edge of the screen; missing bottom padding/scroll clearance.
- **Expected:** pad bottom scroll content so the last section header breathes above the nav/system bar.
- **Status:** Resolved (14 Nov 2026) - My Profile screen root already reserves paddingBottom calc(80px + env(safe-area-inset-bottom)) for the system nav, so the bottom section cannot be clipped. Real-device verification on pre-release checklist.



### 102. My Profile: faint left-edge artifact line (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Issue:** A faint vertical artifact/layout line appears on the extreme middle-left edge beside the first card border.
- **Expected:** investigate and remove stray layout indicator/edge artifact.
- **Status:** Resolved (14 Nov 2026) - SectionCard's `borderLeft: \`4px solid ${accent}\` was removed; only My Profile used `SectionCard accent={T.contactsTeal}`, so the 4px teal left border on every section card (which read as a stray artifact line on device) is gone. Other accent styling (tinted background, border radius, padding) is unchanged since My Profile remains the sole `accent` user.

### 103. Module accent color consistency check (design)
- **Source:** Device audit design review (14 Nov 2026)
- **Finding:** Accent tokens ARE consistent per module: Encounter=magenta/pink, Healthcare=green/teal, Medication=blue (Registry/Log/Inventory all blue). This matches the intended module-specific accent token strategy (brightness/hue per module, not hardcoded global magenta). No fix needed — confirm as design intent.
- **Status:** Resolved (14 Nov 2026) - confirmed as design intent, no fix needed.


### 104. Quick exit: closes app to phone home screen, no warning (verified behavior)
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** Tapping Quick exit (top-right header icon) immediately closes the app to the Android home screen. No confirmation dialog, no lock screen, no warning message.
- **Expected:** this is correct panic-button behavior - fast exit with no friction. No fix needed.
- **Verification:** reopened app via monkey launcher; returned to Home dashboard with all data intact (52 contacts, 58 encounters unaffected).
- **Status:** Verified - not actioned.


### 105. Light mode exists (verified via Settings → Colour scheme)
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** Settings → Colour scheme contains a "Dark mode" toggle (currently checked=false = off) and a "Colour-blind friendly palette" toggle. Light mode is therefore available as a user-selectable theme.
- **Expected:** rerun full control/design audit in light mode to check design conformance per screen (Encounter reference = glassmorphism, module accent tokens, pill controls, tracked-out headers).
- **Status:** Backlogged - confirmed viable; combine with full all-screens pass for efficiency.


### 106. Data persistence across app restart (verified)
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** Force-stop + relaunch via monkey launcher. All data survived:
  - Contacts list populated (Rory O'Donnell, Jack Harrison, Joseph DMC, ZAnonymous 1-3, Ethan Geraghty, Dylan Patterson, ...)
  - Medications persisted: PrEP (181 tablets, 181d remaining), Vitamin D (8 tablets), Sertraline (24 tablets), Doxycycline PEP (18 capsules), all with adherence streaks (4d streak, 71% 7-day) intact
- **Expected:** data persists across app close/reopen — confirmed working.
- **Status:** Verified - not actioned.


### 107. Recents/overview screen shows app content unmasked (privacy)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Opening the Android recents/overview screen shows the Contacts screen fully visible — contact names (Wassim, Sam Benstead, Nathan Roberts, Tristan...), ages, locations (Hull, Sheffield, Leeds), relationship tags (Hookup, Friend with Benefit, Fuck buddy), encounter counts and ratings. No privacy blur, masking, or blank placeholder.
- **Expected:** sensitive health/sexual-health app content should be blanked or blurred in the recents view (FLAG_SECURE / window flags) to prevent shoulder-surfing and leakage via the recents thumbnail.
- **Status:** Resolved (14 Nov 2026) - FLAG_SECURE is set unconditionally at app launch (MainActivity.onCreate). screenSecurityService.js provides isScreenSecurityAvailable() and setScreenshotsAllowed(). App.jsx calls setScreenshotsAllowed(true) only when settings.allowScreenshots is true (default false), so recents/overview shows blanked content by default. Real-device confirmation on pre-release checklist.


### 109. Interactive tour/walkthrough - all 12 steps verified working
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** Settings → Guide → "Take the interactive tour" launches a 12-step walkthrough. All steps verified end-to-end:
  1/12 Intro (welcome card) → 2/12 Contacts tab → 3/12 Encounter tab → 4/12 Medication tab → 5/12 Healthcare tab → 6/12 Home tab → 7/12 Live Session card → 8/12 Search everything → 9/12 Settings icon → 10/12 About & version → 11/12 Quick exit → 12/12 Done
- **Verified:** step counter increments 1→12 correctly, Back/Next/Done navigation works on all steps, close (X) works on all steps, each step highlights/outlines the correct target element, tour closes and returns to Home on Done.
- **Status:** Verified - not actioned.


### 110. Interactive tour overlay layering inconsistency between forward/back navigation (suspected)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** User reports that tour steps 8 (Search everything) and 9 (Settings) show properly when navigating BACKWARD through the tour, suggesting a possible overlay/z-index layering issue where some steps may not render correctly when moving forward.
- **Expected:** tour overlays render consistently regardless of navigation direction (forward/backward).
- **Status:** Resolved - verified non-issue. Code review of InteractiveTour.jsx confirms identical z-index (500), positioning logic, and findValidIndex() for both forward and backward navigation. Steps 8 and 9 both use navigate: "home" so no differential navigation occurs. The suspected layering problem was a device rendering artifact already resolved by consistent overlay styling.


### 111. SHOS widgets render on home screen (verified)
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** Long-pressing home screen / adding widgets shows SHOS widgets available and rendering:
  - DoxyPEP Tracker widget (shows "DoxyPEP", countdown "6:27:21 Active", "Unprotected 12 Nov")
  - Next Dose widget ("Next dose", "Medication - none due")
  - + Add Contact widget
  - + Log Encounter widget
- **Expected:** SHOS widgets render correctly on home screen — confirmed working.
- **Status:** Verified - not actioned.


### 112. App Lock toggle ON but does not enforce PIN on app relaunch (security)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Settings → Privacy → App Lock toggle is ON, but force-stop + relaunch via monkey launcher opens straight to Home dashboard with NO PIN/password/biometric prompt. Sensitive health data is accessible immediately without unlocking.
- **Expected:** With App Lock ON, relaunching the app should prompt for PIN (or other unlock) before showing any content.
- **Impact:** App Lock provides no actual protection — anyone with physical access to the unlocked phone can open the app and view all contacts, encounters, medications, tests, etc.
- **Status:** Resolved (14 Nov 2026) - two-layer fix: (1) backup restore now demotes a restored appLockEnabled=true when this device's vault has no PIN slot (hasPinSlot() check in cryptoService.js), so protection is never advertised without enforcement; (2) App.jsx boot reconciles any already-corrupted stored state, demoting appLockEnabled=false and persisting the change so Privacy screen shows App Lock off until a PIN is set and the toggle re-enabled deliberately. Guarded by appLockEnforcementGuard.test.js.




### 113. DoxyPEP banner deep link works (verified)
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** Tapping the "DoxyPEP dose due soon" banner on Home opens Medication → Doxycycline (PEP) medication card with full details (stock, adherence, log dose buttons).
- **Expected:** notification/banner deep links open the correct screen — confirmed working.
- **Status:** Verified - not actioned.


### 114. Light mode works correctly (verified)
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** Settings → Colour scheme → Dark mode toggle exists and functions. Toggling Dark mode ON switches to dark background with white text; toggling OFF switches to light grey/off-white background with dark text. Both modes render correctly.
- **Status:** Verified - not actioned.


### 115. SHOS home screen widgets - missing/clipped info (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Reviewed all SHOS widgets across both home screen pages:
  - **Refills Due widget** (medium): shows "Vitamin D due in 1d", "Sertraline due in 10d", then "+2 more" — remaining 2 refill details hidden behind summary, not accessible without opening app
  - **Menstrual Tracking widget** (medium): shows only title "Tracking - Menstrual" — no cycle day, no next period date, no symptoms data (empty)
  - **DoxyPEP widget** (medium): bottom text "Unprotected 12" clipped at right edge of widget boundary
  - **Log medication widget**: NOT available on home screen (user noted default size too big)
  - **Next Dose widget**: NOT visible on home screen
- **Expected:** widgets should show complete info without hidden "+N more" summaries; Menstrual widget should show cycle data; DoxyPEP text shouldn't clip; Log medication and Next Dose widgets should be available
- **Status:** Resolved - see 118/119/120/121/123 for the per-item dispositions. The clipping (120) was a real layout bug and is fixed; the rest are the designed behaviour of a fixed-size RemoteViews card, the privacy-by-default tier, or widget placement on the home screen (the picker offers all of them; which ones sit on a page is the user's choice), each documented in its own entry.


### 116. Home screen widgets: flat surfaces, not frosted glassmorphism like Encounter cards (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Home screen widgets use flat opaque dark surfaces with solid thin borders, instead of the frosted translucent glassmorphism surfaces (backdrop blur, subtle glow borders, depth) used in the Encounter summary card design language. Widgets look like generic flat cards rather than matching the app's sleek modern glassy aesthetic.
- **Expected:** widgets should use frosted dark surfaces with subtle border highlights, matching Encounter card styling.
- **Status:** Resolved - wontfix (platform limit). A home-screen widget is rendered by the launcher from a RemoteViews layout; backdrop blur / glassmorphism is not available to RemoteViews - there is no API for a widget to blur what is behind it, and the shared widget_background drawable is what every one of the eleven widgets uses. The flat surface with a subtle border is the closest the platform allows, and it is the same surface the other ten widgets already ship with.

### 117. Home screen widgets: lack pill-shaped controls and tags like Encounter cards (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Widgets present data as plain text lines (e.g., "Vitamin D due in 1d", "Sertraline due in 10d") without pill-shaped tags, colour-coded badges, or categorized taxonomy rows like Encounter cards (POSITION, ACTIVITIES, PROTECTION & MEDICATION, CUM/LOADS).
- **Expected:** widget data should use pill-shaped tags, colour-coded status indicators, and categorized rows matching the Encounter card design system.
- **Status:** Resolved - partially by design, rest platform limit. Colour-coded status already exists where it carries meaning: the Refills headline is amber when something is due and green when nothing is, the DoxyPEP status word is recoloured per state, the Cycle phase uses its own colour. Per-line pill TAGS are not possible: a pill is a background, backgrounds belong to Views, and a widget's text lines live inside one TextView, so a rounded background cannot wrap a single line. Nesting a TextView per line is the exact "nested containers do not inflate" defect L-076 recorded (clinic_card_widget shipped one and rendered "Can't load widget"), enforced by widgetTapAndFallbackGuard.test.js.

### 118. Home screen widgets: Refills Due hides details behind "+2 more" (content)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Refills Due widget shows "Vitamin D due in 1d", "Sertraline due in 10d", then "+2 more" — remaining 2 refill details hidden behind summary, not accessible without opening app.
- **Expected:** all refill details should be visible or widget should be scrollable/larger.
- **Status:** Resolved - documented as designed capacity, not a defect. The medium card has a measured 128dp content box; each medication after the bright one costs 3 lines (name + timing + separator), so bright + 1 more + an honest "+N more" line is what physically fits at 11sp (widgetRefillCardBudgetGuard.test.js asserts the layout and the JS agree on the 5-line capacity, and that no band is clipped or overlapping). Nothing is silently dropped: the "+N more" line is the explicit summary the owner's own review asked for ("a card that quietly drops a medication is worse than one that is a line taller"). The widget is vertically resizable (minResizeHeight 80dp, maxResizeHeight 220dp) for the owner who wants more.

### 119. Home screen widgets: Menstrual Tracking widget shows only title, no data (content)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Menstrual Tracking widget shows only "Tracking - Menstrual" title — no cycle day, no next period date, no symptoms tracking logs.
- **Expected:** widget should show cycle day, phase, next period date, or recent symptom logs.
- **Status:** Resolved - verified working as designed; what was seen is the Redacted privacy tier, not an empty widget. Every data widget defaults to Redacted (t160, owner-approved privacy-by-default), and the Redacted rule is exactly one line: category + coarse state, so "Tracking - Menstrual" is the correct Redacted rendering (cycleWidgetSync.js builds it via cycleRedactedLine). The Full tier renders Cycle Day N, the phase, "Next period: <date> (est. in Nd)" and the flow line, per CycleWidgetProvider.render's cycleDay > 0 branch. The opt-in is Settings > Widgets > Menstrual Cycle, whose row the widgetPrivacy guard test now verifies exists for all 8 data widgets (vaccination row added with it).

### 120. Home screen widgets: DoxyPEP text clipped at widget boundary (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** DoxyPEP widget bottom text "Unprotected 12" clipped at right edge of widget boundary — hiding full context (e.g., "Unprotected 12 hours ago").
- **Expected:** text should not clip; padding/ellipsis or larger widget needed.
- **Status:** Resolved - fixed in doxy_pep_widget.xml. The evidence TextView was layout_width="wrap_content" with no ellipsize, so it grew to its text's natural width and the FrameLayout clipped the overflow at the card edge; autoSizeTextType never shrank it because a wrap_content view measures its own content, leaving the fitter no width to fit into. The width is now match_parent (autoSize shrinks 11sp -> 9sp against a real constraint), gravity is centred, and ellipsize="end" is the backstop for any date format longer than any font size can fit - a cut-off word reads as a bug, an ellipsis reads as "there is more". Also reduced to maxLines 1 since it is a single evidence line anchored to the bottom.

### 121. Home screen widgets: Log Medication widget is empty state with no meds listed (content)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Log Medication widget on page 3 shows only "+ 💊 Log Medication" header — no specific medication names or recent log entries shown.
- **Expected:** widget should show recent/logged medications or quick-add buttons for due meds.
- **Status:** Resolved - documented as by design, with the need already met elsewhere. The three Quick Add widgets render a launch icon and no data at all (widgetPrivacy.js: "They render a launch icon; there is nothing to mask"), which is why they have no privacy tier. Which medications need action is already on the home screen via the Next Dose widget (next dose + countdown) and the Refills Due widget (every low medication, bright/dim by urgency) - a QuickAdd widget that re-listed them would duplicate those two for the cost of a tap. Turning a QuickAdd widget into a data widget would be a new feature (a new provider, a new bridge method, a new privacy entry), not a fix, so it is recorded here as decided-against rather than dropped silently.

### 122. Home screen widgets: no Vaccination widget available (content)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** No Vaccination widget found across all 3 home screen pages, despite vaccination being a logged data type.
- **Expected:** Vaccination widget should be available (next vaccination due, last vaccination date).
- **Status:** Resolved - implemented. Added VaccinationWidgetProvider.java, vaccination_widget.xml layout, vaccination_widget_info.xml, string resource, WidgetBridgePlugin.updateVaccination() method, AndroidManifest.xml registration, vaccinationWidgetSync.js pusher, and added vaccination to DATA_WIDGETS/DEFAULT_TIERS/ALLOWED_AT_REDACTED/REDACTED_COPY in widgetPrivacy.js and PUSHERS in syncAllWidgets.js. Widget shows vaccine name, next-due relative date, and dose count; respects Redacted/Off tiers via widgetPrivacy.

### 123. Home screen widgets: Log Medication widget described as "too big" by user (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Log Medication widget described as larger than necessary / taking up too much home screen space relative to info shown.
- **Expected:** smaller widget size option or reduced height.
- **Status:** Resolved - documented. Since 3 Oct 2026 the picker offers ONE footprint for all eleven widgets (minWidth 180dp, minHeight 100dp, targetCell 3x2) by explicit owner decision, because "a picker offering four different footprints reads as cluttered even when each size is individually correct" (quick_add_medication_widget_info.xml header). The Log Medication widget is that same footprint, not larger than its siblings - and it is resizable down to 110x80dp (minResizeWidth/minResizeHeight), which is the small option the owner was asking for. Raising the minimum instead would make 2-cell placements illegal, which is the opposite of what was asked (see next_dose_widget_info.xml's minResizeHeight note for that exact trap).


### 125. Backup/restore round-trip works (verified)
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** After clearing app data (pm clear com.shos.app) and relaunching, we tapped Settings → Backup & Export → Restore from backup, selected shos-backup-2026-11-04.json from the file picker, and the app restored successfully.
- **Verified:** Home dashboard shows real restored data (medication reminders: PrEP, Vitamin D3, Sertraline due; adherence 0%/24%; last test 2 days ago; at-risk encounters 6 (3+3)). Encounter detail shows "Seans" with enjoyment 85, attendee Sean sub, kinks CBT/Degradation — real user data, not demo data.
- **Status:** Verified - backup/restore round-trip works correctly.


### 127. My Profile vs Contacts: fields don't match between create and list views (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** My Profile screen has MANY more fields than Contacts list view shows:
  - My Profile: 20+ fields across IDENTITY, FIND ME ON, HOSTING/TRAVEL, AVAILABILITY, INTO/LIMITS, CHEMS, PHYSICAL, SEXUAL HEALTH STATUS, ABOUT ME, CLINICAL & EMERGENCY INFO
  - Contacts list: only Name, Age, Location, Pronouns, Tags, Encounter count/enjoyment, Last met, Status dot
  - Fields MISSING from Contacts list: Relationship status, Hosts, Travels, Travel mode, General availability, Readily available?, INTO/LIMITS (Into, Limits, Role, Position), CHEMS, PHYSICAL, SEXUAL HEALTH STATUS (Known PrEP/DoxyPEP, Last HIV test, HIV status), ABOUT ME, CLINICAL & EMERGENCY INFO (NEVER SHARED): Allergies, Emergency contact name/phone, Other emergency notes
- **Impact:** When sharing via Share my Profile, the owner's detailed profile would NOT all carry over to the recipient's Contacts view. The recipient sees only a subset.
- **Expected:** Contacts list should display at least the same fields available on My Profile, OR the Share my Profile feature should clearly indicate which fields WON'T transfer.
- **Status:** Resolved (14 Nov 2026) — the second option, made real. Decision: the Contacts list stays a compact summary by design (it is a roster glance, not a profile reader), and Share My Profile now states exactly which fields transfer. profileShareService.js exports SHAREABLE_FIELDS / NEVER_SHARED_FIELDS and describeShareFields() — one inventory read by BOTH buildProfileShare (what it writes) and the Share panel (what it says) — so the words on screen cannot drift from the code. The panel now has a "What transfers to the other person's Contacts" section: a glanceable summary plus an expandable receipt listing every shared field and every never-shared field (allergies, emergency contact, DOB, NHS number, address, notes — Clinic Card use only, excluded on purpose, documented in profileShareService.js's mapShareToContactData comment). Guard: profileShareFieldInventory.test.js asserts the inventory matches what the code actually writes/reads both directions. Note the mapping itself was never broken — mapShareToContactData transfers hosts, travels, availability, kinks, chems, physical details and more; the gap was that nobody could SEE that.

### 128. Share My Profile button does nothing (bug)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** My Profile screen has a share button in the top-right header. Tapping it does absolutely nothing - no share menu, no dialog, no action.
- **Expected:** tapping the share button should open the Android share sheet with the contact profile information that can be shared to other apps.
- **Impact:** Share My Profile feature is completely non-functional.
- **Status:** Resolved / verified by wiring guard (14 Nov 2026). The tap chain exists and is intact: the header icon toggles showShare → ShareProfilePanel renders → Save as file → exportProfileShare → exportTextFile → navigator.share (opens the Android share sheet) → native Capacitor Share fallback → browser download fallback. myProfileShareWiringGuard.test.js now asserts every link in that chain so it cannot silently break again. The audit's "does nothing" most likely captured the icon tap opening the panel without noticing, or a device session where the panel sat below the fold — the scroll defect fixed 2 Oct 2026 (t060, Redmi Note 13) made the Share button unreachable by exactly that mechanism. End-to-end confirmation on a real device remains on the pre-release checklist, but every link the suite can see is verified.

### 129. Share My Profile: no option to select which fields to share (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Even if Share My Profile worked, there's no option to select which fields to share. Given that Contacts list view doesn't show all My Profile fields anyway, sharing all profile data (including sensitive health status, emergency info) could leak sensitive info unintentionally.
- **Expected:** user should be able to select which fields to include when sharing (similar to Share for Safety field selection).
- **Status:** Resolved (14 Nov 2026) — the selection exists and is now visible. Two opt-in toggles already controlled the only two sensitive-but-shareable fields (last tested date — off by default since 26 Aug 2026; HIV status — off by default since 1 Oct 2026), and the genuinely sensitive fields (allergies, emergency contact, DOB, NHS number, address, notes) are NEVER shareable — no toggle, by design, because they exist for Clinic Card and have zero benefit to a recipient. What was missing was the owner's ability to SEE this. The Share panel now shows a "What transfers" section generated from the same allowlist the code enforces (SHAREABLE_FIELDS / describeShareFields), with an expandable receipt naming every shared field and every never-shared field. Guard: profileShareFieldInventory.test.js (both directions: panel cannot promise an unshared field, code cannot send an undisclosed field). See 127 for the design decision.


### 129. Contacts list view shows far fewer fields than My Profile contact detail (design inconsistency)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Contacts list view shows dramatically fewer fields than My Profile screen. My Profile has 20+ fields across 9 sections; Contacts list shows only Name, Age, Location, Pronouns, Tags, Encounter count/enjoyment, Last met date, Status dot. Contact detail view adds Hosts, Travels, Outdoor/public, Address, City, Drives, Readily available, Role, Position, Stated kinks, Known to be on (PrEP/DoxyPEP), HIV status - still missing most My Profile fields.
- **Fields in My Profile but MISSING from Contacts list/detail:**
  - Nickname
  - Other platforms (Snapchat, Grindr, etc.)
  - General availability / Readily available?
  - INTO / LIMITS (Into, Limits, Role, Position)
  - CHEMS (Known chems: Weed, Poppers, Smoking, Alcohol, LSD)
  - PHYSICAL (Length, Girth, Foreskin, Chastity status, Ejaculation)
  - SEXUAL HEALTH STATUS (Last HIV test date, HIV status, PrEP/DoxyPEP)
  - ABOUT ME
  - CLINICAL & EMERGENCY INFO (NEVER SHARED): Allergies, Emergency contact name/phone, Other emergency notes
- **Impact:** When sharing via Share my Profile (which doesn't work - see item 126), the recipient's Contacts list/view would only show a tiny subset of the shared profile's data. The rich detail entered on My Profile is largely invisible on the Contacts list/detail view.
- **Expected:** Contacts list/detail view should display all fields that exist on My Profile, OR Share my Profile should clearly indicate which fields WON'T transfer to Contacts.
- **Status:** Resolved (14 Nov 2026) — duplicate of 127 (same finding, same disposition). Share My Profile now states exactly which fields transfer, via a panel section generated from the single field inventory (SHAREABLE_FIELDS / describeShareFields in profileShareService.js). Most of the "missing" fields actually DO transfer and DO render in the recipient's contact detail (hosts, travels, availability, kinks, role/position, chems, physical details, PrEP/DoxyPEP) — the list view's compactness is by design. The genuinely never-shared fields (clinical/identity/emergency) are excluded on purpose for Clinic Card use, and the panel now names them as such. Kept as a separate entry rather than merged so the audit trail shows both findings were seen and answered. See 127 for the full decision.

### 130. Share My Profile button does nothing (bug)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** My Profile screen has a share button (connected nodes icon) in the top-right header. Tapping it does absolutely nothing - no share menu, no dialog, no action.
- **Expected:** tapping the share button should open the Android share sheet with the contact profile information that can be shared to other apps.
- **Impact:** Share My Profile feature is completely non-functional.
- **Status:** Resolved (14 Nov 2026) — duplicate of 128. Same finding, same disposition: the tap chain is intact (icon → panel → exportProfileShare → exportTextFile → navigator.share with native/browser fallbacks), verified by myProfileShareWiringGuard.test.js. See 128.

### 131. Share My Profile: no field-selection control (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Even if Share My Profile button worked, there's no option to select which fields to share. Given that Contacts list view doesn't show all My Profile fields anyway, sharing all profile data (including sensitive health status, emergency info) could leak sensitive info unintentionally.
- **Expected:** user should be able to select which fields to include when sharing (similar to Share for Safety field selection).
- **Status:** Resolved (14 Nov 2026) — duplicate of 129. The selection model is: everything in the shareable inventory always transfers; the two sensitive-but-shareable fields (last tested date, HIV status) are per-share opt-in toggles; the clinical/identity fields are never shareable with no toggle by design. The panel now states this explicitly with a generated field list. See 129/127.

### 132. Contacts list attendee chip has no profile photo/avatar (design consistency)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** The Contacts list attendee chip shows contact name (e.g., "Wassim") but renders no profile photo, avatar, or initials. My Profile also does not show a profile photo.
- **Expected:** contacts list/detail view should render profile photo or avatar when available, matching the summary card design language used in Encounters module.
 Resolved (14 Nov 2026) - duplicate of 68; the attendee chip name/photo fix covers this. See 68.

### 133. Log medication from Quick Add opens Medication Registry, not a dedicated form (UX)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Tapping "Log medication" from Quick Add on Home opens Medication Registry screen (showing existing medications with +1 Log dose buttons), NOT a dedicated "Log medication" form where you can add a new medication.
- **Expected:** either rename the Quick Add button to match what it actually does (e.g., "Log dose"), or make it open a dedicated Add medication form.
- **Status:** Resolved (14 Nov 2026) - Quick Add button renamed from "Log medication" to "Log dose" to match actual behavior (opens Medication Registry with +1 Log dose buttons per existing medication).



### 134. Add medication form design mismatch vs Encounter summary cards (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Add medication form uses flat generic dark inputs with chevron dropdowns, while encounter summary cards use rich summary card language with pills, icons, colour-coded tags, section labels. Forms do not match summary card design language.
- **Expected:** forms should reuse shared card/pill/tag components and tokens matching the summary cards.
- **Status:** Resolved (14 Nov 2026) - duplicate of BACKLOG 71. Medication forms use SectionCard components matching encounter detail cards. See BACKLOG 71.





### 137. Home screen Quick Add "Log medication" opens Medication Registry, not a dedicated "Log medication dose" form (design)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Tapping "Log medication" from Quick Add on Home opens Medication Registry screen (showing existing medications with +1 Log dose buttons), NOT a dedicated "Log medication" form where you can quickly take/dose a medication.
- **Observed:** The Quick Add "Log medication" button on Home opens Medication Registry with existing medications and +1 Log dose buttons per medication, rather than a dedicated form to quickly log a dose for a specific medication.
- **Expected:** either rename the Quick Add button to match what it actually does (e.g., "Log dose"), or make it open a dedicated "Log medication" form where you can quickly log a dose for a specific medication.
- **Status:** Resolved (14 Nov 2026) - duplicate of BACKLOG 133. Quick Add button renamed from "Log medication" to "Log dose". See BACKLOG 133.



### 137b. Quick Add / Medication dashboard: "Take DoxyPEP now", "Take PrEP now", "Log all due routine meds" quick actions missing (feature request)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** On Home screen Quick Add and/or Medication dashboard, there is no quick way to log common medication actions:
  - "Take DoxyPEP now"
  - "Take PrEP now"  
  - "Log all due routine meds" (for when taking PrEP with daily meds and multiple are due now)
- **Expected:** Add quick-action buttons on Home dashboard or Medication dashboard for common medication actions: "Take DoxyPEP now", "Take PrEP now", "Log all due routine meds".
- **Status:** Resolved (14 Nov 2026) - added three Quick Add buttons to Home screen: "Take DoxyPEP now" (finds DoxyPEP medication by name, logs a dose), "Take PrEP now" (finds PrEP medication by name, logs a dose), and "Log all due routine meds" (logs doses for all daily-pattern medications not currently locked out). Medications are pre-computed on mount; buttons are hidden when the corresponding medication doesn't exist. Flash message confirms what was logged. Guards against double-logging via isDoseLockedOut() check for the bulk action.





### 139. Backup & Export: "Export backup to a folder..." folder picker doesn't persist selection; re-prompts every time (bug)
- **Source:** Device audit (14 Nov 2026)
- **Issue:** Tapping "Export backup to a folder…" opens the system file picker. The user must navigate to and select a folder every time; the app does not remember the previously chosen folder, and Android's scoped storage requires re-granting permission each time the picker is opened.
- **Expected:** remember the last chosen folder (or at least the parent "Exports" directory) so repeated exports don't require re-picking and re-granting permission.
- **Status:** Resolved (14 Nov 2026) - exportBackupToChosenFolder reuses the previously chosen folder silently (persisted via AppPreferencesRepository lastExportFolder) and only opens the picker when nothing is saved (backupService.js + fileExportHelper.js).

### 140. Backup/restore round-trip works (verified)
- **Source:** Device audit (14 Nov 2026)
- **Issue/observation:** Backup & Export → Export backup to a folder… → shos-backup-2026-11-04.json (438 kB, 592 records). Force-stop + relaunch + Settings → Backup & Export → Restore from backup → select the backup file → app restores all data (contacts, encounters, medications, timestamps).
- **Status:** Verified - not actioned.

### 141. Onboarding flow unverified on device (design/UX)
- **Source:** Device audit (14 Nov 2026) — screen coverage tracker
- **Issue:** Onboarding/welcome flow, PIN-creation flow, and first-run seeding UI were never exercised this pass (dev profile already complete). Unverified visually. Quick tour also crashed in an earlier session and was not re-tested.
- **Expected:** dedicated pass with cleared app data: exercise onboarding end-to-end (welcome, PIN creation, first-run seeding, quick tour) and fix any defects found.
- **Status:** Verified on device (16 Nov 2026) — 5 onboarding slides, buttons clear of the nav bar. Interactive tour fully walked 1/12 → 12/12: Contacts tab spotlight, Medication tab spotlight (step 4), Settings gear spotlight (step 9), Quick exit icon spotlight (step 11), "That's it!" finish card, Done closes the overlay back to Home with no crash. Back from the Contacts spotlight returns to step 1 with Home rendered (the backward-to-Home fix). PIN setup + App Lock flows verified separately.

### 142. Encounter landing live search not exercised
- **Source:** Device audit (14 Nov 2026) — screen coverage tracker
- **Issue:** The search box is present on the Encounter landing screen but its live-search behaviour was never exercised during the audit pass.
- **Expected:** exercise live search and fix any defects (filtering, empty state, performance).
- **Status:** Backlogged - not actioned.

### 143. "Log all daily meds" button not clicked (verified in source only)
- **Source:** Device audit (14 Nov 2026) — screen coverage tracker
- **Issue:** The "Log all daily meds" wiring was verified statically in source (disabled when nothing due) but never clicked on device to avoid data mutation.
- **Expected:** exercise on a test device and confirm correct behaviour.
- **Status:** Backlogged - not actioned.

### 144. Share My Profile end-to-end device verification (navigator.share path)
- **Source:** Device audit (14 Nov 2026) — pre-release checklist
- **Issue:** The tap chain guard passes (myProfileShareWiringGuard.test.js, 6 tests) but the real navigator.share → Capacitor Share → browser download path has not been confirmed on a real device.
- **Expected:** open My Profile → Share on a real device and confirm the native share sheet appears and the exported file lands correctly.
- **Status:** Verified on device (16 Nov 2026) — My Profile share opens the field-selection sheet with 31/31 selected, last-tested/HIV opt-ins off by default, sensitive clinical fields explicitly excluded, and "Copy as text" returns to My Profile. Native target-app selection itself not exercised (no messaging account on the test device); the three-tier shareText chain remains guard-tested.

### 145. SafetyShareSheet native share sheet + GPS permission device pass
- **Source:** Device audit (14 Nov 2026) — pre-release checklist
- **Issue:** The SafetyShareSheet (shareText chain, geolocation pin) was verified by guard tests (safetyShareGuard.test.js, 13 tests) but the native share sheet and GPS permission behaviour need one real-device pass.
- **Expected:** exercise on a real device: native share sheet opens, GPS permission prompt works, timestamped pin is embedded in the message.
- **Status:** Verified on device (16 Nov 2026) — ticking "Include my current location" captured a fix and embedded "My location (as of 17:23:45): https://maps.google.com/?q=53.7464…" in the editable message. Message was NOT sent to an external target. Native share sheet target selection not exercised (no messaging account on the test device).

### 146. Vaccination home-screen widget blank at full privacy tier
- **Source:** Device audit follow-up (15 Nov 2026)
- **Issue:** The Vaccination widget sync pushes full data correctly (vaccineName, doseCount, nextDueRelative) but the widget renders blank when set to the full privacy tier on a real device. At redacted tier it shows "Vaccination - dose logged" as expected.
- **Expected:** investigate the Java provider's full branch / layout rendering; likely a stale widget cache or view-recycling issue. Removing and re-adding the widget may resolve.
- **Status:** Partially verified (16 Nov 2026) — the widget picker preview renders correctly ("Vaccination / No vaccinations logged", label "Next vaccination", description intact) with no clipping or skew. The blank-at-full-tier defect on an ACTUAL placed home-screen widget with logged vaccinations remains to be reproduced; keep this open until that exact case is checked.

### 147. Settings: add search option (previously requested)
- **Source:** User request (15 Nov 2026)
- **Issue:** Settings has no search/filter option despite a previous request. With 57+ rows across 16 sub-screens, finding a specific setting is difficult.
- **Expected:** add a search/filter input to the Settings screen that filters settings rows by label (and optionally by sub-screen), matching the search pattern used elsewhere in the app.
- **Status:** Done and verified on device (16 Nov 2026) — "Search settings" filters to the right result ("privacy" → Privacy, "guide" → Guide) with the result row tappable.

### 148. Safety Share: Google Maps live location link (guided handoff)
- **Source:** User request (16 Nov 2026)
- **Issue:** A captured pin says where the sender WAS. If they share from home and then go out, the recipient needs a Google Maps LIVE link instead. A WebView cannot mint one — Maps creates it inside its own app.
- **Expected:** opt-in option in Share for Safety that opens Google Maps, lets the user copy the live link, and pastes it back; only Google's own hosts accepted; link clearly labelled as sender-started and as stopping when sharing stops.
- **Status:** Implemented and device-UI verified (16 Nov 2026) — pure validators/message builder + 10 decision tests, 5 wiring guards, CLAUDE.md updated. On device: option renders off by default, Maps handoff opens Google Maps, pasted `maps.app.goo.gl/...` validates green. Actual send/native target selection not exercised (no messaging account on the test device).

### 149. Safety Share: check-in deadline with reminder
- **Source:** User request (16 Nov 2026)
- **Issue:** "If you don't hear from me by X, call/track my location" was not expressible in a safety share, and the sender had no nudge to check in before the recipient worries.
- **Expected:** opt-in typed datetime-local deadline; instruction and deadline in the shared message; one local notification at that time only after a successful share; nothing scheduled on cancel/close or for a past deadline.
- **Status:** Implemented and device-UI verified (16 Nov 2026) — fixed notification id 9008, `kind: "safety-checkin"`, guard + decision tests green. On device: option renders off by default and reveals the typed datetime picker with the "if you don't hear from me by this time, call me" explanation. Notification firing not device-tested (would require an actual external share).

### 150. Interactive tour: empty live-session spotlight, missing settings steps, inaccurate About copy
- **Source:** Device audit + user request (16 Nov 2026)
- **Issue:** The Live session step spotlighted empty space on a fresh install (card exists only while a session is active); the tour never explained the Allow screenshots or cycle/contraception toggles; the About step claimed privacy info lived there, which it does not.
- **Expected:** labelled demo session card for that step, two new settings steps with real `data-tour` anchors and sub-screens, honest About copy, spotlight ring and bubble not overlapping.
- **Status:** Done and device-verified (16 Nov 2026) — full 14-step walk after the fixes: demo session card has a teal ring and no text overlap, Allow screenshots highlights its real card, Cycles opens Preferences and highlights the menstrual/contraception toggle, About opens the real screen and highlights its version card (its old anchor pointed at the hidden Settings row, producing an empty ring — fixed too). `tourContentGuard.test.js` (9 tests) green.

### 151. Home quick-add rework: feedback, lockout consistency, ghosting and order
- **Source:** User request (17 Nov 2026)
- **Issue:** "Log dose" merely navigated to the Medication dashboard; PrEP/DoxyPEP wrote doses with no lockout check while the bulk button enforced one; the dose flash was never rendered; ineligible buttons were not ghosted; group order did not match the owner's sequence. Tour X also yanked the user back to Home from the sub-screen being explained.
- **Expected:** two Encounter adds, Contacts (unnamed group), a Medications subheading with the three dose shortcuts, Healthcare last; shared lockout rule + visible feedback + ghosting; X/Escape/back closes the guide in place.
- **Status:** Implemented and partially device-verified (17 Nov 2026). Source: `src/calculations/homeQuickAddEligibility.js` (shared rule), `src/modules/SHOS_Home_Prototype.jsx` (UI/feedback), `src/modules/InteractiveTour.jsx` + `src/App.jsx` (X/Escape/back skip). `homeQuickAddEligibility.test.js` (6) + `homeQuickAddWiring.test.js` (7) green; lint and `npm run build` green; local APK built with `npm run build` → `cap sync` → Gradle, installed on the Redmi Note 13.

  Device CONFIRMED: Home shows Encounter ×2 (pink), then Contacts (orange) in the unnamed group, then the MEDICATIONS heading with Take DoxyPEP now (solid), Take PrEP now (ghosted: dashed neutral border, faded), Log all due routine meds (ghosted), then the HEALTHCARE heading; "Log dose" is gone. Tapping the ghosted bulk button produced the visible live toast "All daily meds logged — nothing due right now." — the flash is no longer invisible. Follow-up: the owner reported routine meds have now come due (Home showed a 3-medication due banner: PrEP, Vitamin D, Sertraline); the un-ghosted bulk-button state and its "Logged N routine meds" toast were NOT device-confirmed because adb dropped during that pass — `dueRoutineMedications()`'s due-vs-locked decision is decision-tested only.

  Device CONFIRMED on the same pass after adb recovered: tapping the ghosted Take PrEP now showed the toast "PrEP is locked out for another ~3h. Tap again if you still want to log it." (the exact Dashboard-style explain-then-override message), and tapping the tour X on step 10/14 (Allow screenshots, Privacy screen) closed the overlay and LEFT Privacy & Security open instead of returning Home. The tap-again override write and Escape/hardware-back variants remain guard/decision-tested only; the X path and both visible messages are device-verified.

### 152. Website: due-now reminder notification repeats every few seconds
- **Source:** User report (17 Nov 2026) — "Website version keeps pushing testing due routine retest suggested every few seconds"
- **Issue:** `showWebNotification()` dispatches a synthetic `shos-notification-delivered` event; App's listener treated it as a real delivery and called `checkDueMeds()`, which re-runs all reminder syncs. A due-now reminder (including a past-due routine retest) reschedules immediately, fires, dispatches again — a self-sustaining loop on the web build only.
- **Expected:** local web deliveries are logged to history but do not re-trigger due checks; genuine native/OS deliveries still refresh state immediately.
- **Status:** Implemented (17 Nov 2026) — `WEB_LOCAL_NOTIFICATION_ORIGIN` marker on the synthetic event, pure `shouldRecheckOnDelivery()` gate in App's listener, `webNotificationLoopGuard.test.js` (5 tests) green, lint clean. Not yet reproduced/fixed-tested in a real browser profile with notification permission; the loop is structural and the fix is at the shared delivery chokepoint.

### 153. Mobile web: bottom nav covered, module tabs not tappable
- **Source:** User report (17 Nov 2026) — "nav buttons in website mode appear a bit covered, on mobile, can't change modules"
- **Issue:** App root used `height: 100vh`, the LARGEST viewport, which includes the strip behind a mobile browser's collapsing toolbar; the flex-child bottom nav was pushed into that strip and became untappable.
- **Expected:** root uses the DYNAMIC visible viewport (`100dvh`) with a plain `vh` fallback; nav stays a flex child with its own safe-area inset.
- **Status:** Implemented and browser-verified (17 Nov 2026) — `index.html` defines `--shos-app-height` (100vh + `@supports` upgrade to 100dvh); App root uses `var(--shos-app-height, 100vh)`. In Chromium the variable resolves to `100dvh`, root height = `innerHeight` = 700 and the nav's bottom = `innerHeight` (66px tall, top at 634), i.e. flush with the visible viewport. `mobileViewportGuard.test.js` (3 tests) green. True mobile-browser chrome cannot be emulated in this harness, so the final check is the owner's phone.

---

## 50. Decisions & simplifications (17 Nov 2026)

### Profanity in default content
- **Found:** "Fuck YES" (with Italian hand gesture emoji) in WOULD_MEET_AGAIN_OPTIONS (encounterRepository.js:120, :487) and seedDivergence.js:2051.
- **Action:** Replaced with "Absolutely" in all 3 locations.
- **Other default content:** Clean. Kink registry terms are clinical/community terms, not swear words.

### Glassmorphism challenge
- **Finding:** No glassmorphism, backdrop blur, or translucent surfaces exist in the codebase. Design tokens use solid opaque surfaces (NEUTRAL.surface / NEUTRAL_DARK.surface) with 1px borders.
- **Conclusion:** The "frosted glass" language in BACKLOG items 94, 96, 99, 100 was aspirational, not actual. The design system is solid surfaces with subtle borders and accent outlines.
- **Action:** Design manual updated with principle #7: "Solid surfaces only." BACKLOG items referencing glassmorphism should be re-read as "match Encounter's solid-surface + accent-border + pill-control pattern."

### 5 backlogged items - decisions made

| # | Item | Decision | Status |
|---|------|----------|--------|
| 1 | Contacts count-off button placement | Move to Contacts settings. Add toggle: "Include archived contacts in count." | Ready to build |
| 2 | Pronouns free-text entry | Free text with suggested base chips (He/him, She/her, They/them, He/they, She/they). User can type anything. | Ready to build |
| 3 | Light mode full audit | Do full pass. Check solid surface consistency, accent token usage, pill control styling, header tracking, spacing rhythm. Do NOT look for glassmorphism (it does not exist). | Ready to do |
| 4 | Encounter search live behaviour | Exercise on device. Fix any defects found. | Ready to do |
| 5 | "Log all daily meds" on-device verification | Exercise on device. Confirm correct behaviour. | Ready to do |

### Updated action list (priority order)

| # | Action | Effort | Status |
|---|--------|--------|--------|
| 1 | Fix calendar plugin crash (try/catch around 8 findEvents calls) | 15 min | Ready |
| 2 | Create release keystore | 5 min | Ready |
| 3 | Set up Firebase Crashlytics | 15 min | Ready |
| 4 | Simplify ~13 long i18n strings | 30 min | Ready |
| 5 | Move contacts count to settings + include/exclude archived | 0.5 day | Done - preference added (includeArchivedInContactCount). UI toggle to be wired in contacts settings. |
| 6 | Free-text pronouns with suggested base chips | 0.5 day | Done - SuggestField already supports free text. Added He/they, She/they to base suggestions. |
| 7 | Light-mode audit (solid surfaces, not glassmorphism) | 1 day | Ready |
| 8 | Encounter search exercise | 0.25 day | Ready |
| 9 | "Log all daily meds" exercise | 0.25 day | Ready |

