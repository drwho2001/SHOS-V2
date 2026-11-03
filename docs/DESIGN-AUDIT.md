# SHOS Visual Audit — 3 November 2026

This is the report behind the open items in `docs/DESIGN-MANUAL.md`. It records what was checked, what is actually broken, what is only inconsistent, and what looked wrong but is not. One application-code change was made during the audit (C17: contact-card spacing collapse in `SHOS_Contacts_Prototype.jsx`); all other findings are documentation-only.

Baseline: commit `20987f1`. `src/modules/SHOS_Encounters_Prototype.jsx` had an uncommitted edit in another session during the audit, so Encounters line numbers below can shift by about 9 lines from `435` onward. Every finding is stated with a searchable identifier as well as a line, so it survives that drift.

**Coverage honesty.** This is not a complete "all screens, all platforms, light and dark" audit. Android device coverage is strong for the module screens and the main settings list, but settings subscreens and Healthcare sub-tabs were code-checked rather than measured on device, and the dark-mode settings pass was visual only (no contrast numbers). Web/PWA coverage is Home + Settings only. Empty states (C19), loading states (C20) and reduced motion (D5, partial) are now code-checked. Error states follow manual §10.1 (ACTION.red text under the failed field) — verified in PrivacyScreen, AutomaticBackupsScreen and App.jsx; no new finding. Gesture navigation, landscape, localisation and dark-mode web remain unchecked. See §10.

## 1. How this was checked

Two independent passes, then reconciled:

1. **Source pass** — all 50 non-test JSX files (54 including tests), `designTokens.js`, `moduleColorRepository.js`, and the existing guards.
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
| P2 dark-mode / colour | 9 |
| P3 inconsistency | 19 |
| P4 accessibility | 5 |
| Web/PWA specific | 1 |
| Investigated and **not** defects | 12 |
| Manual corrections needed | 15 |

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

**Code.** `src/components/FormTabs.jsx:33` sets `top: "calc(env(safe-area-inset-top) + 58px)"` (the element opens at :27). It is used inside the sheet's own scroll container at `src/modules/SHOS_Contacts_Prototype.jsx:2055` (`overflowY: "auto"`). A sticky `top` is relative to **the scrollport**, not to the screen — so inside a sheet, whose banner is already outside the scroller, `58px` offsets the bar *into* the content and guarantees overlap at every scroll position.

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

**Fix.** Resolve it: `darkMode ? resolveDarkAccent("medication", ACCENTS.medication, "#5B85F5") : ACCENTS.medication` (the same companion Medication already uses). Note: `ACCENT_TEXT_SAFE` has no `medication` key, so the text-safe variant cannot be used here; the resolved fill gives 4.94:1 on the dark card and the raw accent gives 8.6:1 on light.

### B2 · Design screen swatches show light-mode colours in dark mode

`src/modules/settings/DesignScreen.jsx:388` — `const currentValue = overrides[key] || ACCENTS[key]`.

**Device-confirmed:** the Contacts dot is raw `#B36205` amber, the Medication dot is the unreadable navy. The row preview dot at `:189` uses the same value. Against a dark card these read as *different modules than the ones the app actually draws*, because every module screen brightens its accent in dark mode.

**Fix.** Resolve for display: `darkMode ? resolveDarkAccent(key, value) : value`. Keep the *stored* value raw — only the preview is resolved, and label it so the user knows the stored value is the light one.

### B3 · Home's Contacts accent is not dark-resolved (subsumed by B8)

B3's two sites (`:1171`, `:1266`) are part of B8's inventory. Kept as a separate line only because it was the first place the missing dark companion was noticed; the fix is B8's. B8 also covers `homeColor` (`:191`) and `menstrualColor` (`:199`), which the challenger flagged as the same defect class.

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

The chip's own contrast is fine (**4.80:1**), and that is not the problem. The problem is that a cream chip with brown text floats on a `#1C1C1F` card in dark mode — device-confirmed — while every other badge on the same card switched theme. The same two literals appear on 8 lines (`:1868`, `:2064`, `:2065`, `:2071`, `:3103`, `:3104`, `:3141`, `:3142`) across 5 distinct uses, so fixing one site leaves the rest.

**Fix.** Promote an `ACTION.amberSurface` / `ACTION.amberText` pair into `designTokens.js` with dark companions, and replace all six sites. Amber-as-warning is the correct semantic; only the values are wrong.

### B6 · The Contacts select-mode bar loses its elevation in dark mode

`src/modules/SHOS_Contacts_Prototype.jsx:3200` sets `background: "#1B1B1F"` — a hardcoded *light-theme* neutral — as the bar that separates select mode from the list.

In light mode it reads as a deliberate dark action bar. In dark mode it sits on `#121214` at **1.09:1** against the page, so the bar's edges disappear and the white text floats free. This is code-only (select mode was not re-captured in dark), but the numbers decide it.

**Fix (needs a decision).** The defect is the hardcoded hex, not the dark-bar intent. Preserve the "dark action bar in both themes" look by using a theme-aware dark surface (e.g. `NEUTRAL_DARK.surface` in dark, `NEUTRAL.textPrimary` in light), or add an `inverseSurface` token. Do not blindly swap to `T.textPrimary`, which would turn the bar light in dark mode and change the intended language.

### B7 · Testing stores icons as emoji

`src/modules/SHOS_Testing_Prototype.jsx:956` and `:1280` branch on `form.setting === "🏠 Home"`, and the picker stores `"🏠 Home"` / `"🏥 Clinic - Routine"` as the *value*.

This breaks two rules at once: icons are Phosphor-only, and a display glyph is being used as a data key. It also means renaming the label requires a data migration.

**Fix.** Store a stable key (`home`, `clinicRoutine`, …) and render the Phosphor icon beside the label. The two `=== "🏠 Home"` branches become `=== "home"`. This is the one finding here that needs a small data migration, so it should be its own change.

### B8 · Contacts, Home and Menstrual have no dark companion, so their accents used as text fail in dark mode

The same call without a third argument appears in three modules:

- `src/modules/SHOS_Contacts_Prototype.jsx:156` and `:161` — `contactsTeal` / `contactsTealText`
- `src/modules/SHOS_Home_Prototype.jsx:191` — `homeColor`
- `src/modules/SHOS_Home_Prototype.jsx:199` — `menstrualColor`

In all three, `defaultDarkValue` falls back to the raw light value, so the accent is byte-identical in light and dark mode. Encounters, Medication and Healthcare pass a hand-picked companion; these three do not. Where the accent is used as text or an icon on a dark surface, it fails contrast (Contacts 3.78:1; Home teal on `#1C1C1F` is 5.2:1 but visibly dull; Menstrual pink is 3.6:1 at 13 px).

**Contrast on `#1C1C1F`:** `#B36205` = **3.78:1** at 13 px/600 — below 4.5:1. At 10 px (the role/position/tag chips at `:1847`, `:1850`, `:1857`) it is worse, and those chips render as brown text on a `contactsTeal 15` tint, which is `#B36205` at 8% alpha over `#1C1C1F` — effectively brown on near-black. Device-confirmed: the relationship and tag chips on a dark contact card are barely legible, and the section labels (`IDENTITY`, etc.) are visibly duller than the same label in Encounters/Healthcare.

**Sites affected (all Contacts-accent-as-text):** Home summary row `:1171`, Home quick-add `:1266`, relationship chips `:1847/1850/1857`, role/position chips, section labels `:343`, `:1868` (Incomplete chip, which also hardcodes its own light colours — see B5).

**Fix.** Give Contacts a dark companion the way Medication and Healthcare have one. A value near `#D08A2E` measures ≈6.0:1 on `#1C1C1F`; run it through `paletteContrast.test.js` before adopting. Then pass it as the third argument to both `resolveDarkAccent` calls. This single change clears B3, B5's adjacent sites, and the chip readability problem together — it is the same defect as B3, generalised.

### B9 · Settings subscreens use raw accents as text/labels in dark mode

`AboutScreen.jsx` (5 links, `ACCENTS.medication` at 13 px), `StatsScreen.jsx` (section labels at `ACCENTS.encounters/healthcare/medication/contacts` plus a "View source guidance" link at 11 px), `ResourcesScreen.jsx` (links at `ACCENTS.healthcare`, 11 px), `ShareScreen.jsx` (links, 11 px) and `DeveloperToolsScreen.jsx` (text at `ACCENTS.home`, 11–14 px) all read the raw accent directly, with no `resolveDarkAccent`. In dark mode these are the same 1.50–3.78:1 failures as B1/B8. `TrashScreen.jsx` uses `ACCENTS.medication` for selected-state borders (`:187`) — a fill/border use, which is acceptable as-is, but should be resolved for consistency.

`AutomaticBackupsScreen`, `BackupExportScreen`, `CalendarScreen`, `DataNetworkScreen`, `ManageListsScreen`, `NotificationsScreen`, `PreferencesScreen`, `PrivacyScreen` use raw accents only for fills, borders and toggles, which is correct — those screens are clean on colour.

**Fix.** Resolve the four text/link sites the same way as B1 (use the companion when in dark mode). `StatsScreen`'s section labels should use the same pattern as the module screens (resolved accent or neutral secondary).

---

## 4. P3 — inconsistency
### C1 · Duplicate DEMO badge in Contacts and Encounters

Both the contact card title row (`src/modules/SHOS_Contacts_Prototype.jsx:1725`) and the encounter card title row (`src/modules/SHOS_Encounters_Prototype.jsx`, search `common.demo` in the card header) contain the same `isDemo` span **twice, back to back**. Clinic Visits (`:1934`) and Testing (`:1590`) each render exactly one.

**Correction (third pass):** my earlier correction was wrong. `SHOS_Contacts_Prototype.jsx:1725` does contain two DEMO spans back-to-back; the original claim was right. The "1 and 1, not 2" note was an error.

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

**Fix (needs a decision).** The manual is ambiguous here: §10.2 says accent for label/primary action, "not the whole card," but these cards *are* the primary action. Either move the accent to the icon plus a neutral border, or update §10.2 to permit accent borders on primary-action cards. The current state is a rule being broken on the app's most-visited screen — or a rule that was never precise enough.

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
components/FormTabs.jsx:33                top=calc(env(safe-area-inset-top) + 58px) (element opens at :27)
modules/SHOS_Encounters_Prototype.jsx:1463 top=calc(env(safe-area-inset-top) + 60px)
```

Note `60` vs the shared `58` — the drift the guard exists to prevent, still present.

**Fix.** FormTabs gets the prop described in A3. Encounters imports `STICKY_SUBHEADING_TOP`. This is a two-line change that turns a red test green, and it should ship with A2/A3 because it is the same defect class.

### C11 · The active nav pill radius is an untokenised literal

`src/App.jsx:3296` sets `borderRadius: 14`. Every other rounded control uses `RADIUS.sm/md/lg/full`. 14 is not any of them.

**Fix.** Use `RADIUS.md` (13) so the pill matches card corners, or add `RADIUS.navPill` if 14 is deliberate.

**Scope note (challenger):** this is broader than the one site. Literals 12, 10, 8 and 4 appear throughout (`SHOS_Vaccinations_Prototype.jsx`, `SHOS_Contacts_Prototype.jsx:3137`, etc.). Manual §6 only defines sm/md/lg/full. A full radius audit is a separate pass; this finding is the most visible instance.

### C12 · Record metadata indents by 16 dp in two lists and not the third

Clinic Visits (`:1937-1940`) and Testing (`:1598-1605`) set `marginLeft: 16` on every metadata line. Encounters does not.

The indent lines the metadata under the title *after* the 8 dp status dot plus gap. Without it, Encounters' subtitle starts 16 dp to the left of its siblings — visible when moving between the three lists.

**Fix.** Use one shared list-row layout. If it stays inline, add the indent to Encounters for consistency.

### C14 · The bottom nav stays on record detail and disappears in Settings

Device-confirmed: Contact detail keeps the five-tab bar; Settings hides it. Both are reasonable (a record is still "inside" a module; Settings is a separate stack), but nothing states the rule, and the two were not decided together.

**Fix.** Document the rule in the manual. No code change is required if the rule is "record screens keep the nav; settings and other full-screen stacks replace it".

### C15 · List titles sit at three different weights *and* the metadata rules differ per module

Covered partly by C4 and C12. The combined effect on device is that Encounters, Clinic Visits and Testing read as three different list components that happen to share a colour. They share a shape (border, radius, 14 px padding) and nothing else.

**Fix.** Extract one `ModuleListRow` with props for accent, status dot, demo badge, metadata indent and title weight. The manual already says to consolidate at three copies — this is the third copy.

### C20 · Loading states are text placeholders, not skeletons

Manual §10.5 says "Loading states should preserve the final layout shape where practical." The files that show a loading state render a bare "Loading..." string (8 sites across 5 files: `App.jsx` ×2, `SHOS_Settings_Prototype.jsx` ×2, `SHOS_Healthcare_Prototype.jsx` ×1, `SHOS_MyProfile_Prototype.jsx` ×2, plus `CalendarScreen.jsx` "Loading calendars…" which was omitted from the earlier count). `DeveloperToolsScreen.jsx:173` is a button busy-label, not a loading state, and is excluded. Contacts and MyProfile also have inline "Searching…" indicators (`SHOS_Contacts_Prototype.jsx:624`, `SHOS_MyProfile_Prototype.jsx:326`) not counted here. None preserves the final layout shape. Low severity, but inconsistent with the manual.

**Fix.** Add skeleton placeholders matching the final row/card shape for the lists that load asynchronously (contacts, encounters, medications). Keep "Loading..." only for full-screen transitions.

### C19 · Empty states are text-only, with no icon or action

Manual §10.5 says "Empty states should use an icon, one sentence, and an optional action." The list-level empty states in Contacts (`:3354`), Encounters (`:1535`), Clinic Visits (`:1855`) and Testing (`:1515`) render a single line of italic text with no icon and no action. (Field-level placeholders such as "No notes yet" at `SHOS_Contacts_Prototype.jsx:2853` and `SHOS_Encounters_Prototype.jsx:1814` are a different category and are not counted here.) The 69 "empty-text" sites across 25 files conflate the two; only the list-level ones are in scope for this finding. The Medication dashboard empty state (`:925–928`) is non-italic, so the "all italic" claim does not hold.

**Fix.** Add a shared `EmptyState` component (icon + sentence + optional action) and migrate the list-level sites. Consolidate at the manual's three-copy threshold.

### C18 · `FONT_FAMILY` is bypassed in 43 of 46 files:

`src/calculations/designTokens.js` exports `FONT_FAMILY = "'Inter', sans-serif"`. It is consumed in only two files (`SHOS_GlobalSearch_Prototype.jsx`, `SHOS_Healthcare_Prototype.jsx`) plus its own definition. The other 43 files that set a font use the literal `"'Inter', sans-serif"` string (263 sites). Visually identical, but it means a font change requires editing 263 sites and the token is not the single source of truth the manual claims it is (manual §4, §4.2). The audit's earlier "not defect" line ("Healthcare and every screen root checked do set FONT_FAMILY") was wrong: Healthcare is one of only two consumers.

**Fix.** Replace the literal with the token everywhere. A codemod is safe here because the string is byte-identical; the only risk is files that import the token under a different name.

### C17 · Contact card: the travel/social icon row leaves a gap above the relationship chips

`src/modules/SHOS_Contacts_Prototype.jsx:1720` renders the name and the travel/social/contact-method icons on one flex row with `marginBottom: 4`; the relationship-type chips below (`:1829`) carry `marginTop: 4`. The icons are pushed right by `marginLeft: "auto"`, so when the icon cluster is narrow it sits well to the right of the name and never reaches the chips' `marginLeft: 16` start. The result is an 8 px vertical gap between the name and the relationship line that exists only because of the icon row, plus a horizontal gap the icons do not fill.

**Fix applied (this pass, verify in diff):** `marginBottom: 4` → `0` on the name row (`:1720`) and `marginTop: 4` → `0` on the relationship-type row (`:1830`), collapsing the gap the icon line created. The role/position/tag/Incomplete rows at `:1845`, `:1855`, `:1868` retain `marginTop: 4` (untouched, since the request was specifically about the name-to-relationship gap). The icons remain right-aligned.

### C16 · Home's quick-add section hierarchy is encoded by one grey step

`src/modules/SHOS_Home_Prototype.jsx:1263-1293` renders three labels at identical `TYPE.sectionLabel` (12 / 700, uppercase) with the same `marginBottom: 6`:

- `Quick add` — `textSecondary`
- `Personal` — `textDisabled`
- `Healthcare` — `textDisabled`

On device these read as three peers, not as a parent and two children. The colour difference is one step of grey at the same size, with no indent, so `Personal` and `Healthcare` look like separate top-level sections. The same block also uses three card treatments at once — the Calendar card is a tinted fill (`homeColor 22` + accent border), the quick-add cards are `surface` + accent border, and the summary rows above are flat dividers — so the screen has no single card language.

**Fix.** Make the hierarchy structural: either indent the children, drop them to `TYPE.caption`, or nest them under the parent with a leading rule. Pick one card treatment for the whole screen and apply it to the Calendar card too.

---

## 5. P4 — accessibility

### D1 · Contacts search tap target is about 20 dp tall

Same site as C3. The input has no height, padding, or container, so the tappable row is the text line. Manual requires 44 dp.

### D2 · "Select all" / "Deselect all" is a bare 13 px span

`src/modules/SHOS_Contacts_Prototype.jsx:3207` — text-only, no padding, no minimum height, inside the select-mode bar. Roughly 18 dp tall and 80 dp wide.

**Fix.** Give it `padding: "12px 8px"` and `minHeight: 44`, or promote it to a real button. The same applies to the `Done`/`Select` spans in the Contacts and Encounters banners: they are 13 px text with no tap padding.

### D3 · Module-banner icon buttons are 32 dp, not 44 dp

Home's header icons (`:910`, `:916`, `:920`, `:929`, `:932`) are `size: 24` with `padding: 4` → **32 × 32 dp**. Encounters' and Healthcare's Quick exit use `padding: 4` with no `minHeight`. Only Contacts and Medication add `minHeight: 44`, and even they stay 32 dp wide.

The manual states 44 dp twice (§5.1 and §12). The most-used controls in the app miss it.

**Fix.** Standardise on a `HeaderIconButton` with `minWidth: 44, minHeight: 44`, centred glyph, `margin: -6` so the layout does not grow. This also removes five copies of the same keydown boilerplate.

### D4 · `minHeight: 44` is applied to inline SVG icons

Manual §5.1 states: "Do not put `minHeight: 44` on an inline SVG icon. It scales the glyph. Use padding or a negative margin on the parent instead." Of the 117 `minHeight: 44` sites across 15 files, approximately 11 are on inline Phosphor icons (e.g. `SHOS_Timeline_Prototype.jsx`, `SHOS_Medication_Dashboard_Prototype.jsx:1013–1014`, `SHOS_Contacts_Prototype.jsx`, `SHOS_Settings_Prototype.jsx:411–412`, `SHOS_Measurements_Prototype.jsx:865`). The rest are on buttons/containers where the rule does not apply. The glyph is enlarged by the constraint, which is the opposite of the intended touch-target padding.

**Fix.** A codemod that moves `minHeight: 44` from the icon's style to its parent container's style, replacing the icon's own with `padding`/`margin`. High-risk on dense rows; do file-by-file with a screenshot check per module.

### D5 · Four settings screens animate toggles without respecting reduced motion

`AutomaticBackupsScreen.jsx`, `DataNetworkScreen.jsx`, `DesignScreen.jsx` and `PrivacyScreen.jsx` render toggle switches with `transition: "left 0.15s"` / `"background 0.15s"` and do not import `useReducedMotion`. Manual §12 requires reduced motion to be respected. (No other settings screen in the repo uses this toggle pattern, so these four are the entire population.)

**Fix.** Add `const reducedMotion = useReducedMotion();` and make each transition conditional, matching the pattern in the other nine screens.

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
| Home centre tab has no active/inactive state | Intentional (user's explicit ask, `App.jsx:3268–3270`). Documented via M9, not a defect. (C13 reclassified.) |

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
| M13 | §11 | State the desktop cap and how it is applied (W1). |

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

**Batch 2 — dark mode (B1–B8).** Add the missing dark resolution in five files, plus amber tokens and a Contacts dark companion (B8). B7 (emoji) is separate because it needs a migration.
- Add a guard: module render bodies may not read `ACCENTS.*` / `ACTION.*` in a style value — only the resolved variables. That test would have caught B1–B4 mechanically.

**Batch 3 — list and control consistency (C1–C7, C11, C12).** Extract `ModuleListRow` and `ListSearchField`, then delete the four hand-rolled copies. Delete the duplicate DEMO span and the card shadow on the way through.

**Batch 4 — typography, icons, touch (C9, D1–D5).** Add `microLabel`, the header icon button, the emoji migration, and the reduced-motion/toggle fixes. (C13 is reclassified as not a defect; see §6.)

**Batch 5 — manual (M1–M13).** Last, so it documents what shipped rather than what was planned.

**Batch 6 — web/PWA (W1).** Cap the root width. (W2 withdrawn — the update notice is already correctly positioned.) Can ship independently of the device work.

### Tests worth adding

- Extend `stickySubheadingGuard` to assert that any `position: sticky` inside a `[data-*-sheet]` subtree uses `top: 0`.
- New AST guard: no raw accent reads in JSX style values (Batch 2).
- New guard: no hex literals in JSX colour positions outside `designTokens.js` — would have caught B5 and B6.
- Extend `paletteContrast.test.js` from the default palette to the pairs actually rendered: accent-as-text-on-dark-surface, and accent-text-on-own-tint (B3, B4, B5).
- A layout guard is not practical, so A4/A5 stay manual device checks. Add both to the new-feature checklist instead: "does the header still fit at 393 dp with every icon shown?"
- Add a guard that the root container has a `maxWidth` on viewports above the phone width, so W1 cannot regress silently.

---

## 9. Web and PWA

Checked against the same build on `http://localhost:5174/` in the desktop review browser (742 × 620 CSS px), both themes, with the service-worker update notice and the App Lock dialog dismissed. The web build runs the same React code, so every colour, spacing and sticky finding in §§2–4 applies unchanged. Two web-only items:

### W1 · The root has no max-width, so the phone-first UI stretches on desktop

`browser.evaluate` found that **`#root` itself has no max-width** (`maxWidth: "none"`), so the app's outer container stretches to the viewport. Component-level caps do exist (30+ sites use `maxWidth` for individual cards, dialogs and empty states), but none caps the root container, so the phone-first UI still stretches to the full window width. On a 742 px window the Home header is 695 px wide and cards run the full width. The manual (§11) says the app is phone-first and that `useIsDesktopWidth` controls desktop-specific layout. It is imported in ~30 files and used for component-level tweaks (empty states, grids, padding); no site caps the *root* container width. The `maxWidth: 560` at `App.jsx:805` is the only cap on a top-level container, and it applies to one empty-state, not the root. The result is a stretched phone: 695 px text lines, full-width bottom nav, and the icon-budget problem from A4 only manifesting on phones.

**Fix.** Cap the root at ~560 px and centre it when `!isDesktopWidth` is false (or always cap and let the desktop path opt out). This is the single change that makes the web/PWA build read as a designed desktop surface rather than a resized phone.

### W2 (withdrawn)

The earlier claim that the update notice was a static top block was wrong. The code at `src/App.jsx:3126–3150` renders it as `position: fixed; bottom: calc(76px + env(safe-area-inset-bottom))` with `zIndex: 300`, i.e. a fixed toast stacked above the bottom nav, and its buttons carry `pointerEvents: "auto"` to override the container's `pointerEvents: "none"`. It is correctly positioned and does not overlap the nav or the module header. **No finding; removed.**

The web/PWA specific count in the headline table drops from 2 to 1.

### Web/PWA items checked and found clean

- Safe-area handling: `env(safe-area-inset-*)` resolves to 0 on desktop, so sticky headers sit at `top: 0` with no gap — correct. On a notched PWA install the browser supplies the insets.
- Dynamic viewport: the root uses `100dvh` (verified via `CSS.supports`), so the bottom nav is not cut off by a mobile browser's collapsing address bar.
- Theme: the app keeps its own light/dark toggle rather than following `prefers-color-scheme`; consistent with Android. All colour findings in §§2–4 apply to web.
- Navigation: Settings is presented as a dialog on web vs a full screen on Android — a deliberate platform difference, documented in §11.5. In-app back controls are present.
- The App Lock prompt is a dialog on web — same as Android.

---

## 10. Not covered by this pass

- Gesture navigation (the device uses 3-button nav). Bottom-inset behaviour with a gesture bar is unverified.
- Landscape and tablet widths on the device (the web pass was desktop-width only).
- Localisation: only English strings were rendered; the long-string rule was not exercised.
- Reduced motion on module screens: all module files that animate import `useReducedMotion` (verified); 4 settings screens do not (D5). Coverage is code-level only.
- Dark-mode web: not checked (web pass was Home + Settings in light only).
- The five other Healthcare sub-tabs were verified in code against A2, not scrolled on device.
- The three pre-existing CI failures (lint at `storageAdapter.js:148`, unit test at `clearSampleData.test.js:510`, smoke flow 1/32) are unrelated to this audit and still open.
- Settings subscreens were sampled in dark mode. The *layout* (sticky header, spacing, safe area) is clean, but the *colour* pass found raw-accent-as-text reads in AboutScreen, StatsScreen, ResourcesScreen, ShareScreen and TrashScreen — see B9 (new). Privacy, Widgets, Notifications, Preferences, Manage lists, Calendar, My Profile, Backup & Export and Colour scheme were checked and are clean on colour. DeveloperTools and Design are flagged (B9 and B1/B2 respectively). Light mode for the same screens was covered in the earlier pass.

### Known blind spots not yet audited (challenger-flagged)

These are sites the manual's rules would flag but this pass did not enumerate as defects. Raw counts are review candidates, not violation counts — they include legitimate uses (designTokens definitions, intentional dark surfaces, accent fills). Listed so the next pass has a starting point.

- **`minHeight: 44` on inline SVGs** (manual §5.1): ~11 inline Phosphor icons (of 117 total `minHeight: 44` sites). See D4.
- **Hardcoded hex beyond the cited sites:** 495 hex literals across 41 files. Examples: `#FFF3C4`/`#926100` at `SHOS_Contacts_Prototype.jsx:2064–2071, 3103–3104, 3141–3142` (B5 lists six; the `#B42318`/`#FEE4E2` pair at `:3141–3142` is a second colour family), `#1B1B1F` toast bars, `#656568` disabled buttons in `SHOS_Settings_Prototype.jsx`.
- **RADIUS literals beyond 14** (see C11's scope note): 299 `borderRadius: <number>` sites across 41 files using 12, 10, 8, 4.
- **FONT_FAMILY bypass:** most screens use the literal `"'Inter', sans-serif"` rather than the token. Visually identical but token drift.
- (Resolved above: dark companions for Home and Menstrual are now part of B8.)
- **Empty states** (manual §10.5): code-checked (C19); device verification of the actual empty states not done.
- **Loading states** (manual §10.5): code-checked (C20); device verification not done.
- **Error states** (manual §10.5): code-checked; follow §10.1 (ACTION.red under the failed field). No new finding.
- **Reduced motion on module screens** (manual §12): code-checked — all animating module files use `useReducedMotion`; 4 settings screens do not (D5). Device verification not done.
- **Safe-area double-counting on other screens:** only Settings/Healthcare/FormTabs were checked; Vaccinations/Measurements/SymptomLog/ClinicVisits share `STICKY_SUBHEADING_TOP` with different header heights.
