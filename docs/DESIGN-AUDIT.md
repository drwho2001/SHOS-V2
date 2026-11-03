# SHOS Visual Audit — 3 November 2026

This is the report behind the open items in `docs/DESIGN-MANUAL.md`. It records what was checked, what is actually broken, what is only inconsistent, and what looked wrong but is not. No application code was changed for this pass.

Baseline: commit `20987f1`. `src/modules/SHOS_Encounters_Prototype.jsx` had an uncommitted edit in another session during the audit, so Encounters line numbers below can shift by about 9 lines from `435` onward. Every finding is stated with a searchable identifier as well as a line, so it survives that drift.

## 1. How this was checked

Two independent passes, then reconciled:

1. **Source pass** — all 54 JSX files, `designTokens.js`, `moduleColorRepository.js`, and the existing guards.
2. **Device pass** — the debug APK on a real handset (`23124RA7EO`, `sapphiren_eea`), 1080×2400 at 440 dpi, i.e. a **393 × 873 dp** viewport with 3-button system navigation. Light and dark, plus scrolled states and both overlay types (sheet, sticky bar).

A finding only becomes **device-confirmed** when the rendered pixels show it. Code that looks wrong but never renders wrong is **code-only**, and is labelled as such. Screenshots live in the untracked `.audit-shots/` folder because they contain real personal data; they are not published and must not be committed.

### Severity

| Level | Meaning |
|---|---|
| **P1** | Content is occluded, unreadable, or unreachable. Fix before any new work. |
| **P2** | A colour, contrast, or theme defect. Correct but wrong; fails in dark mode. |
| **P3** | Drift. Two places disagree and a reader cannot tell which is right. |
| **P4** | Accessibility below the manual's own stated floor. |

### Headline counts

| | Count |
|---|---:|
| P1 blocking | 5 |
| P2 dark-mode / colour | 7 |
| P3 inconsistency | 15 |
| P4 accessibility | 3 |
| Investigated and **not** defects | 12 |
| Manual corrections needed | 12 |

One existing unit test, `src/components/stickySubheadingGuard.test.js`, is **already red** and its failure is finding C10 — the guard is correctly reporting two hardcoded sticky offsets. Fixing C10 turns it green.

---

## 2. P1 — content is occluded

### A1 · The refill "requested, not collected" strip covers Home's header

**Symptom.** When a refill is marked requested, a blue strip appears at the top of Home but the header stays where it was, so the strip sits on top of the title and icons.

**Evidence.**
- Device, light mode: strip rendered over the Home title row.
- Code: `src/App.jsx` renders the strip from the `refillAwaitingVisible` branch with **no `ref`**. The main wrapper at `src/App.jsx:3170` sets `paddingTop` to the sum of `dueBannerHeight + refillBannerHeight + testingBannerHeight + clinicVisitBannerHeight + vaccinationBannerHeight`. Every other banner is measured by `useMeasuredBannerHeight()`; this strip is not measured and is not in the sum.

**Why it matters.** The header is the only route to Search, My Profile and Settings. This is the same class of bug the file's own comment at `src/App.jsx:1381` says was fixed for the due-meds banner.

**Fix.** Give the strip the same measured-height treatment as the banners above it and add its height to the `paddingTop` sum. Do not special-case the number: the strip is two lines for one refill and one line for several, so it needs `ResizeObserver`, not a constant.

**Related.** The strip's own colour is the raw `ACCENTS.medication` fill. On a coloured fill that is correct; it is the *height* here that is wrong.

---

### A2 · Healthcare's sticky subheading paints over its own sub-tabs

**Symptom.** Scroll the Healthcare list and the `CLINIC VISITS / Select` bar pins on top of the Testing / Vaccinations pills and cuts their labels in half. Testing and Vaccinations become hard to tap while scrolled.

**Evidence (device, confirmed).**
- Pixels: the Healthcare sticky stack (`banner + two pill rows`) ends at **y ≈ 571 device px**. The subheading pins at `safe-area + 58px` ≈ **y ≈ 226 device px**, and being later in the DOM at the same `z-index: 6`, it paints on top.
- That is roughly **125 dp** of overlap — a third of the header.
- Code: `src/modules/SHOS_ClinicVisits_Prototype.jsx:1785` uses `top: STICKY_SUBHEADING_TOP`. The parent at `src/modules/SHOS_Healthcare_Prototype.jsx:240` is a *two-band* sticky stack (`banner` + `8px 16px` pill grid of `minHeight: 44` pills) with `zIndex: 6`.
- The same constant is used by the other four Healthcare sub-lists — `SHOS_Vaccinations_Prototype.jsx:874`, `SHOS_Measurements_Prototype.jsx:859`, `SHOS_SymptomLog_Prototype.jsx:695` — so **all five sub-tabs carry the same latent bug**, whether or not each has been scrolled on device yet.

**Root cause.** `STICKY_SUBHEADING_TOP = calc(env(safe-area-inset-top) + 58px)` is really *"the height of one single-band module banner"*. It was measured against Contacts' banner, and it silently assumes every sticky header above a subheading is that same height. Healthcare's is not, and its height changes with the number of enabled sub-tabs (Menstrual is opt-in, which adds a row).

**Fix.** Stop encoding header height as a constant. Publish the sticky header's measured height from the screen that owns it (a CSS custom property set from a `ResizeObserver`, e.g. `--shos-sticky-header-h`) and have subheadings use `top: var(--shos-sticky-header-h, 0px)`. As an interim, Healthcare should not stack a second sticky layer at all: the sub-list's own header can be non-sticky, or sticky inside its own scroll region below the header.

---

### A3 · The Add/Edit sheet's tab bar floats 58 dp down and overlaps the first card

**Symptom.** Open Add contact. The `About / Meeting & profile / Interests & contact` bar sits in the middle of the Identity card, cutting through the PhotoPicker, with a permanent empty grey band above it.

**Evidence (device, confirmed).** Screenshot shows the tab bar overlaying the white card with `IDENTITY` above it and the avatar below it, and ~58 dp of empty sheet background between the sheet's coloured banner and the tab bar.

**Code.** `src/components/FormTabs.jsx:27` sets `top: "calc(env(safe-area-inset-top) + 58px)"`. It is used inside the sheet's own scroll container at `src/modules/SHOS_Contacts_Prototype.jsx:2055` (`overflowY: "auto"`). A sticky `top` is relative to **the scrollport**, not to the screen — so inside a sheet, whose banner is already outside the scroller, `58px` offsets the bar *into* the content and guarantees overlap at every scroll position.

**Fix.** `FormTabs` must take its sticky offset as a prop (default `0`), or detect that it is inside `[data-contact-sheet]` and use `top: 0`. A sticky offset should never be inherited from screen chrome into a modal.

---

### A4 · Home's header has too many icons for the title to fit

**Symptom.** On a 393 dp-wide screen the title wraps to two lines — `Kane's` / `dashboard` — and the 4 px teal accent bar underneath then reads as a divider between two blocks rather than as a header underline.

**Evidence (device, confirmed, light and dark).**
- `src/modules/SHOS_Home_Prototype.jsx:886` renders the title and the icon row in one `h1` with `justifyContent: space-between`.
- The icon row (`:888`) holds up to **five** 24 px icons at `gap: 14`: Lock (conditional), Search, My Profile, Settings, Quick exit. Icon box = 24 + 4 + 4 padding = 32 dp; 5 icons + 4 gaps = **216 dp** of a **361 dp** content width, leaving 145 dp for a 22/700 title.
- Device shows four icons (App Lock off) and the title already wraps.

**Why it matters.** It is not only cosmetic: the accent bar is the screen's module identity, and once it sits under a wrapped title it stops reading as identity.

**Fix.** Cap the header at four icons and move the fifth (Lock is conditional, so choose one of Profile/Settings) into the existing overflow or the Settings screen. Alternatively shorten the title (`'{name}'s dashboard'` → `'{name}'`), but that changes product copy, which is the owner's call, not a design fix. Preference: cap the icon set, keep the title.

---

### A5 · Home's "Last medication dose" label collapses to three lines

**Symptom.** The label wraps to `Last` / `medication` / `dose` because the value on the right expands to fill the row.

**Evidence (device, confirmed).** `SummaryRow` at `src/modules/SHOS_Home_Prototype.jsx:858` is `display: flex; justify-content: space-between` with no `flex` basis on either side, so the long value (`PrEP, Vitamin D, Sertraline, Doxycycline (PEP) · 2 Nov, 05:29`) takes what it needs and squeezes the label.

**Fix.** Give the label `flexShrink: 0` and the value `textAlign: right; minWidth: 0`, or use a two-line layout for this row (`label` above, value below) when the value exceeds a character budget. A `minWidth: 0` alone will not fix it — the label needs to be protected.

---

## 3. P2 — dark mode and colour correctness

Every item here is a raw token read that bypasses the module's own resolved colour set. The pattern in this codebase is correct: modules build a theme object with `resolveDarkAccent(...)` and read `T.foo`. These are the places that step outside it.

### B1 · The "Customise" link is unreadable in dark mode

`src/modules/settings/DesignScreen.jsx:211` uses `color: ACCENTS.medication` (`#003B6F`) on the dark card (`#1C1C1F`).

**Contrast: 1.50:1.** It renders as dark navy on near-black — device-confirmed, effectively invisible. The same raw value colours the segmented control's selected border at `:221-222`.

**Fix.** Resolve it: `darkMode ? resolveDarkAccent("medication", ACCENTS.medication) : ACCENT_TEXT_SAFE.medication`. It is text on a surface, so the text-safe variant is the right one, not the fill colour.

### B2 · Design screen swatches show light-mode colours in dark mode

`src/modules/settings/DesignScreen.jsx:388` — `const currentValue = overrides[key] || ACCENTS[key]`.

**Device-confirmed:** the Contacts dot is raw `#B36205` amber, the Medication dot is the unreadable navy. The row preview dot at `:189` uses the same value. Against a dark card these read as *different modules than the ones the app actually draws*, because every module screen brightens its accent in dark mode.

**Fix.** Resolve for display: `darkMode ? resolveDarkAccent(key, value) : value`. Keep the *stored* value raw — only the preview is resolved, and label it so the user knows the stored value is the light one.

### B3 · Home's Contacts accent is not dark-resolved

Two sites read `ACCENTS.contacts` directly while their neighbours read resolved variables:

- `src/modules/SHOS_Home_Prototype.jsx:1171` — the `Newest contact` summary row, `moduleColor={ACCENTS.contacts}`.
- `src/modules/SHOS_Home_Prototype.jsx:1266` — the `New contact` quick-add card, `color={ACCENTS.contacts}`.

**Contrast: 3.78:1** for `#B36205` on `#1C1C1F` at 13 px/600 — below 4.5:1. Every other row on that list uses `medsBlue`, `healthcareColor`, `encountersColor`, all resolved. Device-confirmed: the label is visibly duller than its neighbours in dark mode.

**Fix.** Add `contactsColor` next to `encountersColor` (`src/modules/SHOS_Home_Prototype.jsx:206`) and use it in both places.

### B4 · Encounters kink tags use red as decoration, unresolved

`src/modules/SHOS_Encounters_Prototype.jsx` — the kink/practice tag span sets `border: 1px solid ACTION.red` and `color: ACTION.red`, with no `T.` prefix while every sibling control uses `T.actionRed`.

Two separate problems:

1. **Contrast:** `#D93838` on `#1C1C1F` = **3.70:1** at 11 px — fails AA for small text.
2. **Semantics:** the manual says red is destructive/alerting and must not be decoration. A kink tag is identity, not a warning.

**Fix.** Resolve the colour and change the role: use the encounters accent (or a neutral chip) for kink tags, and reserve red for the "flagged — don't meet again" state that already uses it correctly.

### B5 · The "Incomplete" chip is a light-mode island

`src/modules/SHOS_Contacts_Prototype.jsx:1868` hardcodes `color: "#926100"` and `background: "#FFF3C4"`.

The chip's own contrast is fine (**4.80:1**), and that is not the problem. The problem is that a cream chip with brown text floats on a `#1C1C1F` card in dark mode — device-confirmed — while every other badge on the same card switched theme. The same two literals are reused at `:2064`, `:2065`, `:2071`, `:3104` and `:3141-3142` (duplicate-confidence chips), so fixing one site leaves five.

**Fix.** Promote an `ACTION.amberSurface` / `ACTION.amberText` pair into `designTokens.js` with dark companions, and replace all six sites. Amber-as-warning is the correct semantic; only the values are wrong.

### B6 · The Contacts select-mode bar loses its elevation in dark mode

`src/modules/SHOS_Contacts_Prototype.jsx:3200` sets `background: "#1B1B1F"` — a hardcoded *light-theme* neutral — as the bar that separates select mode from the list.

In light mode it reads as a deliberate dark action bar. In dark mode it sits on `#121214` at **1.06:1** against the page, so the bar's edges disappear and the white text floats free. This is code-only (select mode was not re-captured in dark), but the numbers decide it.

**Fix.** Use `T.textPrimary` as the inverse surface in both themes, or add an `inverseSurface` / `inverseText` token pair. A fixed hex cannot be right in both themes.

### B7 · Testing stores icons as emoji

`src/modules/SHOS_Testing_Prototype.jsx:956` and `:1280` branch on `form.setting === "🏠 Home"`, and the picker stores `"🏠 Home"` / `"🏥 Clinic - Routine"` as the *value*.

This breaks two rules at once: icons are Phosphor-only, and a display glyph is being used as a data key. It also means renaming the label requires a data migration.

**Fix.** Store a stable key (`home`, `clinicRoutine`, …) and render the Phosphor icon beside the label. The two `=== "🏠 Home"` branches become `=== "home"`. This is the one finding here that needs a small data migration, so it should be its own change.

---

## 4. P3 — inconsistency

### C1 · Duplicate DEMO badge in Encounters

The encounter card title row contains the same `isDemo` span **twice, back to back**, in `src/modules/SHOS_Encounters_Prototype.jsx` (search `common.demo` in the card header). Contacts (`:1725`), Clinic Visits (`:1934`) and Testing (`:1590`) each render exactly one.

**Correction to an earlier note:** this is **not** in Contacts. That claim came from a card that had both a DEMO badge and an Incomplete chip; the counts are 1 and 1, not 2.

**Fix.** Delete one span.

### C2 · Contacts is the only list card with a shadow

`src/modules/SHOS_Contacts_Prototype.jsx:1637` adds `boxShadow: "0 1px 3px rgba(0,0,0,.06)"`. Encounter, Clinic Visit and Testing cards have border only. The manual says ordinary cards get no shadow.

At 6% black the difference is subtle in isolation, but it means Contact cards lift off the page while the other three lists sit flat — visible when switching tabs.

**Fix.** Remove the shadow. If a lift is wanted, add it to all four or to none.

### C3 · The Contacts search field is a different control from every other search field

| Screen | Padding | Font | Border | Background |
|---|---|---|---|---|
| Contacts (`:3262`) | none (bare `<input>`) | 14 | none | transparent |
| Medication (`:2496`) | 8 / 12 | 13 | 1 px `border` | `surfaceVariant` |
| Clinic Visits (`:1836`) | 8 / 12 | 13 | 1 px `border` | `surfaceVariant` |
| Testing link picker (`:612`) | 8 / 10 | 12 | 1 px `border` | `surfaceVariant` |

Contacts therefore has no visible field boundary and a tap target about 20 dp tall. It also drops the magnifier inside the input — the other three do not.

**Fix.** Adopt one list-search component and use it in all four. The filled `surfaceVariant` variant is the majority; make Contacts match it and give the field `minHeight: 44`.

### C4 · Encounters' card title is the odd weight

- Encounters: 15 / **700**
- Contacts: 15 / 600
- Clinic Visits: 15 / 600
- Testing: 15 / 600

**Fix.** Pick 15/600 (the majority) and note the list-card title role in the manual so it stops being re-decided per module.

### C5 · Banner control sets are arbitrary, and Select lives in two different places

| Module | Banner holds |
|---|---|
| Contacts | Select, Export, My Profile, Settings, Quick exit (5) |
| Encounters | Select, Export, Quick exit (3) |
| Medication | Select, Search, Export, Quick exit (4) |
| Healthcare | Quick exit only (1) |

Healthcare is the real break: its Select sits *inside* the content, in the Clinic Visits subheading, so the control moves position between sub-tabs. Nothing in the manual says what a banner may hold, so each module answered the question separately.

**Fix.** Decide a budget and write it down: title, then at most **two** module actions, then the two global actions (Quick exit always last). Move Select into a list-level toolbar in every module, matching Healthcare — which is the pattern that scales, because a banner cannot own a control for content that scrolls.

### C6 · Home's quick-add cards use saturated module borders

`QuickAddButton` at `src/modules/SHOS_Home_Prototype.jsx:871` sets `border: 1px solid ${color}` — the full accent on the whole card border — for eight cards across three colour families.

The manual's own rule (§10.2) says the accent goes on the label or the primary action, "not the whole card". The rendered effect is a column of orange, purple and blue outlines that competes with the module banners.

**Fix.** Either move the accent to the icon and a 1px neutral border, or accept it and change the manual. The current state is a documented rule being broken in the app's most-visited screen, which is the worst of both.

### C7 · "New encounter" and "New session" use the same icon

`src/modules/SHOS_Home_Prototype.jsx:1271` and `:1272` both use `Activity`. They are different actions with different outcomes (a record vs a container).

**Fix.** Give sessions their own Phosphor glyph (`Stack` is already imported and used for containers).

### C8 · Section labels have three colour roles but the manual documents one

`TYPE.sectionLabel` is used 51 times, in three colours:

- module accent — card group headings, e.g. Contacts `:343`, Encounters `:167`
- `textSecondary` — field groups, e.g. Encounters `:1540`, Contacts `:3273`
- `textDisabled` — sub-labels, e.g. Encounters `:365`, `:369`

The manual says section labels are grey. All three uses are defensible; the missing piece is the rule that says which one applies.

**Fix.** Document it: accent when the label names a group *of the module's own records*; secondary when it names a field group inside a form or card; disabled only for a label that sits directly above an already-disabled value.

### C9 · Text below the documented scale

The manual's smallest role is 12 px. The app uses:

| Size | Where |
|---|---|
| 9 px | `DEMO` badge — Contacts `:1725`, Encounters, Clinic Visits `:1934`, Testing `:1590` |
| 10 px | `Incomplete` chip `:1868`; role/position/tag chips `:1847`, `:1850`, `:1857`; `(customised)` in Design `:191` |
| 11 px | kink tags; "Older visit"; status lines; `Customise` link `:211` |

Some of these are justified: a fixed-width badge cannot grow without breaking the card rhythm. Most are not.

**Fix.** Add `TYPE.microLabel = 11 / 700` as the documented floor and migrate the 10–11 px sites to it. Keep 9 px only for the DEMO badge and say so explicitly — a badge that must not attract attention is a legitimate exception, an unlabelled one is not.

### C10 · Two sticky offsets still hardcode their own number (guard is red)

`stickySubheadingGuard.test.js` fails today with exactly two offenders:

```
components/FormTabs.jsx:27                top=calc(env(safe-area-inset-top) + 58px)
modules/SHOS_Encounters_Prototype.jsx:1463 top=calc(env(safe-area-inset-top) + 60px)
```

Note `60` vs the shared `58` — the drift the guard exists to prevent, still present.

**Fix.** FormTabs gets the prop described in A3. Encounters imports `STICKY_SUBHEADING_TOP`. This is a two-line change that turns a red test green, and it should ship with A2/A3 because it is the same defect class.

### C11 · The active nav pill radius is an untokenised literal

`src/App.jsx:3296` sets `borderRadius: 14`. Every other rounded control uses `RADIUS.sm/md/lg/full`. 14 is not any of them.

**Fix.** Use `RADIUS.md` (13) so the pill matches card corners, or add `RADIUS.navPill` if 14 is deliberate.

### C12 · Record metadata indents by 16 dp in two lists and not the third

Clinic Visits (`:1937-1940`) and Testing (`:1598-1605`) set `marginLeft: 16` on every metadata line. Encounters does not.

The indent lines the metadata under the title *after* the 8 dp status dot plus gap. Without it, Encounters' subtitle starts 16 dp to the left of its siblings — visible when moving between the three lists.

**Fix.** Use one shared list-row layout. If it stays inline, add the indent to Encounters for consistency.

### C13 · Home's centre tab has no active or inactive state

`src/App.jsx:3279` gives Home an always-filled 48 dp circle in `resolveTabAccent(tab)`, with **no label** and no change when it is the current tab. The other four tabs are flat until active, then get a filled pill with icon and label (`:3296`).

On the Home screen the centre tab and, say, the Contacts tab can both look "selected" — one by being filled, one by being an active pill — which makes the nav ambiguous at exactly the moment it should be clearest.

This is **intentional** (the comment at `:3268` records the user's ask for a raised centre bump), so it is not a defect to fix by accident.

**Fix.** Keep the bump and add the missing state cue: dim the circle when Home is not active, or show the label under it when active. Then document the exception so the next reader does not "fix" it.

### C14 · The bottom nav stays on record detail and disappears in Settings

Device-confirmed: Contact detail keeps the five-tab bar; Settings hides it. Both are reasonable (a record is still "inside" a module; Settings is a separate stack), but nothing states the rule, and the two were not decided together.

**Fix.** Document the rule in the manual. No code change is required if the rule is "record screens keep the nav; settings and other full-screen stacks replace it".

### C15 · List titles sit at three different weights *and* the metadata rules differ per module

Covered partly by C4 and C12. The combined effect on device is that Encounters, Clinic Visits and Testing read as three different list components that happen to share a colour. They share a shape (border, radius, 14 px padding) and nothing else.

**Fix.** Extract one `ModuleListRow` with props for accent, status dot, demo badge, metadata indent and title weight. The manual already says to consolidate at three copies — this is the third copy.

---

## 5. P4 — accessibility

### D1 · Contacts search tap target is about 20 dp tall

Same site as C3. The input has no height, padding, or container, so the tappable row is the text line. Manual requires 44 dp.

### D2 · "Select all" / "Deselect all" is a bare 13 px span

`src/modules/SHOS_Contacts_Prototype.jsx:3207` — text-only, no padding, no minimum height, inside the select-mode bar. Roughly 18 dp tall and 80 dp wide.

**Fix.** Give it `padding: "12px 8px"` and `minHeight: 44`, or promote it to a real button. The same applies to the `Done`/`Select` spans in the Contacts and Encounters banners: they are 13 px text with no tap padding.

### D3 · Module-banner icon buttons are 32 dp, not 44 dp

Home's header icons (`:908`, `:914`, `:918`, `:927`, `:930`) are `size: 24` with `padding: 4` → **32 × 32 dp**. Encounters' and Healthcare's Quick exit use `padding: 4` with no `minHeight`. Only Contacts and Medication add `minHeight: 44`, and even they stay 32 dp wide.

The manual states 44 dp twice (§5.1 and §12). The most-used controls in the app miss it.

**Fix.** Standardise on a `HeaderIconButton` with `minWidth: 44, minHeight: 44`, centred glyph, `margin: -6` so the layout does not grow. This also removes five copies of the same keydown boilerplate.

---

## 6. Investigated and **not** defects

Recorded so these do not get "fixed" later.

| Observation | Verdict |
|---|---|
| Grey vertical line at the left screen edge | Android edge overlay / system UI, not app chrome. Present on every screen including the launcher. |
| Contact detail's record name is 20/700 | Correct `TYPE.recordTitle`. Not a title-size defect. |
| Contact detail uses an icon-only header with the name in the content | Intentional for record screens; the banner would duplicate the name. |
| Contact detail subtitle is indented 24 dp | Deliberately aligns under the avatar, not under the dot. |
| Settings hides the bottom nav | Intentional focused mode — see C14 for the documentation gap, not a bug. |
| Section label colour varies by context | Defensible; the problem is the missing rule (C8), not the variation. |
| Clinic Visits renders older visits on `surfaceVariant` with muted text | Deliberate recency treatment. |
| Testing's "Pending — expected {date}" is italic and 12 px | Deliberate provisional state. |
| Bottom padding clips the last row | **Mid-scroll only.** At true scroll end on Home, Contacts and Settings the content clears the nav. Not a safe-area bug. |
| FormTabs' selected "About" pill is a faint tint | It also has a 1 px accent border and accent text — adequate, and consistent with the other two tabs' structure. |
| Raw font sizes are inconsistent | Sizes alone are not the defect — roles are. Handled by C4 and C9. |
| `FONT_FAMILY` appears in fewer places than expected | The token count does not prove a missing font; Healthcare and every screen root checked do set it. |

---

## 7. Corrections needed in `docs/DESIGN-MANUAL.md`

| # | Section | Correction |
|---|---|---|
| M1 | §7.1 | Add Home's header as its own title role: no filled banner, 4 px accent bar, icon row. State the icon budget (A4). |
| M2 | §8 | `STICKY_SUBHEADING_TOP` is the height of a **single-band** banner, and is only valid when the sticky header above is exactly one band. Say so, and say what to do when it is not (A2). |
| M3 | §8 | Add the sheet rule: inside a sheet's own scroll container the sticky offset is `0`, never the screen offset (A3). |
| M4 | §7.1 | Define what a module banner may contain, and where Select belongs (C5). |
| M5 | §4.1 | Add `TYPE.microLabel` (11 px) and an explicit floor; list the 9 px exception (C9). |
| M6 | §6 / §10.2 | Restate elevation as "borders only on list cards" and close the Contacts exception (C2). |
| M7 | §10.1 | Add the standard search/filter field spec, including 44 dp (C3, D1). |
| M8 | §4.1 | Fix one list-card title weight (C4). |
| M9 | §7 | Document the Home centre tab as an intentional always-filled, label-less exception, so it is not copied and not "fixed" (C13). |
| M10 | §7 | Document when the bottom nav persists vs hides (C14). |
| M11 | §3.7 | Replace the vague "open audit item" with the actual raw-accent inventory: Home summary + quick-add, Design screen link/swatches/segmented border, Encounters kink tag, Incomplete chip, Contacts select bar (B1–B6). |
| M12 | §9 | Add "no emoji as icons, and never as a stored value" (B7). |

Two further manual fixes with no code counterpart:

- §4.1 claims `TYPE.screenTitle` is "primary module banner". Home does not use a banner at all, and Contact detail uses `recordTitle` instead. The table should name the *screens*, not just the role.
- §17.3's only confirmed-open item is about device validation, which is a process item, not a visual defect. Move it to §11.5 and keep §17 for the visual items above.

---

## 8. Proposed order of work

Five batches, each independently shippable. Nothing here needs a redesign; every fix is local.

**Batch 1 — occlusion (P1 + C10).** The three overlaps share one root cause: fixed heights used where the real height is measured.
1. A1 — measure the refill-awaiting strip and add it to the padding sum.
2. A2 — replace the constant with a measured header height; fix Healthcare first, then the other four sub-tabs.
3. A3 — FormTabs sticky offset becomes a prop.
4. C10 — Encounters imports the constant. Turns `stickySubheadingGuard` green.

**Batch 2 — dark mode (B1–B6).** Add the missing dark resolution in five files, plus amber tokens. B7 (emoji) is separate because it needs a migration.
- Add a guard: module render bodies may not read `ACCENTS.*` / `ACTION.*` in a style value — only the resolved variables. That test would have caught B1–B4 mechanically.

**Batch 3 — list and control consistency (C1–C7, C11, C12).** Extract `ModuleListRow` and `ListSearchField`, then delete the four hand-rolled copies. Delete the duplicate DEMO span and the card shadow on the way through.

**Batch 4 — typography, icons, touch (C9, C13, D1–D3).** Add `microLabel`, the header icon button, and the emoji migration.

**Batch 5 — manual (M1–M12).** Last, so it documents what shipped rather than what was planned.

### Tests worth adding

- Extend `stickySubheadingGuard` to assert that any `position: sticky` inside a `[data-*-sheet]` subtree uses `top: 0`.
- New AST guard: no raw accent reads in JSX style values (Batch 2).
- New guard: no hex literals in JSX colour positions outside `designTokens.js` — would have caught B5 and B6.
- Extend `paletteContrast.test.js` from the default palette to the pairs actually rendered: accent-as-text-on-dark-surface, and accent-text-on-own-tint (B3, B4, B5).
- A layout guard is not practical, so A4/A5 stay manual device checks. Add both to the new-feature checklist instead: "does the header still fit at 393 dp with every icon shown?"

---

## 9. Not covered by this pass

- Gesture navigation (the device uses 3-button nav). Bottom-inset behaviour with a gesture bar is unverified.
- Landscape and tablet widths.
- Localisation: only English strings were rendered; the long-string rule was not exercised.
- Animated transitions and reduced-motion behaviour.
- The five other Healthcare sub-tabs were verified in code against A2, not scrolled on device.
- The three pre-existing CI failures (lint at `storageAdapter.js:148`, unit test at `clearSampleData.test.js:510`, smoke flow 1/32) are unrelated to this audit and still open.
