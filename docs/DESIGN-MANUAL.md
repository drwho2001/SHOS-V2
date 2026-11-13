# SHOS Design Manual

This manual is a plain-English guide to how SHOS should look and behave. Start with the pictures, then use the code names when you need the exact value. It records what is settled, what is only recommended, and what still needs checking.

## 1. Scope and how to use this manual

- **Current** means the pattern is implemented and should be reused as-is.
- **Recommended** means the codebase has a common pattern, but it has not yet been promoted to a token or shared component. New work should follow the recommendation.
- **Exception** means a known gap, regression, or open audit item. Do not copy it as precedent.
- **Privacy rule for visuals:** screenshots and diagrams in this manual must use fictional demo data only. Blur or remove names, dates, locations, identifiers, notifications, status-bar details, and image metadata before publishing. Prefer token swatches and abstract mockups for public material.

The source of truth for colours, type, radius, and fonts is `src/calculations/designTokens.js`. The source of truth for module colour overrides is `src/repositories/moduleColorRepository.js`. This document should be updated in the same change when either of those changes.

## 2. Design principles

1. **Calm, local, private.** SHOS is a personal health tracker. Visual noise, identifying labels, and unnecessary motion work against the product.
2. **Module identity at a glance.** Each primary module has one accent colour. Use it for banners, active navigation, and primary actions within that module.
3. **Semantic colours mean one thing.** Red is destructive or alerting. Green is successful or positive. Amber is pending or warning. Gold is archived or low-priority. Do not use status colours as decoration.
4. **Accessibility before polish.** Contrast, touch targets, reduced motion, and screen-reader labels are part of the design, not a later pass.
5. **Shared components win.** If a presentational pattern appears in three or more modules, consolidate it before adding a fourth copy.
6. **Exceptions are named.** A deliberate deviation is documented here or in the relevant component. An undocumented deviation is drift.

![Colour roles](design-manual/color-roles.svg)

## 2.5 Quick visual guide

If you are new to the app’s look, start here:

- [Colour roles](design-manual/color-roles.svg)
- [Typography scale](design-manual/typography-scale.svg)
- [App shell](design-manual/app-shell.svg)
- [Title blocks](design-manual/title-blocks.svg)
- [Spacing scale](design-manual/spacing-scale.svg)
- [Borders and elevation](design-manual/elevation.svg)
- [Control states](design-manual/state-matrix.svg)

These pictures show the intended style. The code in `designTokens.js` is the final authority.

## 2.6 Plain-language glossary

- **Accent colour:** the main colour for a module, such as Contacts or Medication.
- **Action colour:** a colour with a fixed meaning, such as red for errors.
- **Safe-area inset:** space reserved for phone status bars and navigation bars.
- **Sticky header:** a header that stays visible while the page scrolls.
- **PWA:** the web version installed like an app.
- **Redacted tier:** a privacy mode that hides most details from a home-screen widget.
- **Token:** a named value in `designTokens.js`, such as `TYPE.screenTitle`.

## 3. Colour system

### 3.1 Neutral palette

| Token | Light | Dark | Use |
|---|---:|---:|---|
| `NEUTRAL.bg` / `NEUTRAL_DARK.bg` | `#F0F0F3` | `#121214` | Screen background |
| `NEUTRAL.surface` / `NEUTRAL_DARK.surface` | `#FFFFFF` | `#1C1C1F` | Cards and sheets |
| `NEUTRAL.surfaceVariant` / `NEUTRAL_DARK.surfaceVariant` | `#E7E7EB` | `#26262A` | Inputs and recessed areas |
| `NEUTRAL.border` / `NEUTRAL_DARK.border` | `#DCDCE1` | `#3A3A3F` | Borders and dividers |
| `NEUTRAL.textPrimary` / `NEUTRAL_DARK.textPrimary` | `#1B1B1F` | `#F2F2F4` | Primary text |
| `NEUTRAL.textSecondary` / `NEUTRAL_DARK.textSecondary` | `#5B5B62` | `#B8B8BE` | Secondary text |
| `NEUTRAL.textDisabled` / `NEUTRAL_DARK.textDisabled` | `#656568` | `#89898C` | Disabled or muted text |

### 3.2 Module accents

Default accents are defined in `DEFAULT_ACCENTS`. Users can override module accents and action red/green in Settings. Overrides apply on the next app reload, not instantly, because modules read these values at load time.

| Module | Token | Default |
|---|---|---:|
| Contacts | `ACCENTS.contacts` | `#B36205` |
| Encounters | `ACCENTS.encounters` | `#7F30A6` |
| Medication | `ACCENTS.medication` | `#003B6F` |
| Healthcare | `ACCENTS.healthcare` | `#09582E` |
| Home | `ACCENTS.home` | `#008585` |
| Menstrual | `ACCENTS.menstrual` | `#EB4799` |
| Kink registry | `ACCENTS.kink` | `#E5484D` |
| Protection registry | `ACCENTS.protection` | `#E24E9C` |

### 3.3 Action colours

| Token | Default | Meaning |
|---|---:|---|
| `ACTION.red` | `#D93838` | Destructive, alert, failed, or attention-required |
| `ACTION.green` | `#148A1E` | Success, complete, healthy, or positive |
| `ACTION.amber` | `#F59E0B` | Pending, warning, or needs review |
| `ACTION.gold` | `#7A6500` | Archived, low-priority, or historical |

### 3.4 Safe text-on-self-tint variants

Use these only where an accent is literally used as text on its own tinted background. They are darker stand-ins and must not replace the base accent in filled buttons, borders, or icons.

| Variant | Value | Notes |
|---|---:|---|
| Contacts safe text | `#9A6700` / text-safe equivalent | For contacts tinted badges |
| Home safe text | `#926100` | Used for Home summary labels |
| Menstrual safe text | `#B33370` | Added for menstrual accent text |
| Action red safe text | `#B53434` | For red text on red tint |
| Action green safe text | `#146818` | For green text on green tint |

### 3.5 Dark mode and custom colours

- Use `NEUTRAL_DARK` for dark-mode surfaces and text.
- Use `resolveDarkAccent(overrideKey, currentValue, defaultDarkValue)` where a module has a hand-picked dark-mode companion. Encounters, Medication, and Healthcare have such companions.
- Custom colours are stored through `ModuleColorRepository`. A change does not instantly repaint open screens; it applies on the next reload.
- Dark-mode resolution happens at render time in shared chrome such as the bottom navigation, not in the module-level `TABS` array, because the always-light restore preview must not resolve for dark mode.

### 3.6 Colour rules

- Do not hardcode hex values in new UI. Read from `NEUTRAL`, `NEUTRAL_DARK`, `ACCENTS`, `ACTION`, or a repository-backed override.
- Do not use `ACTION.red` for a module identity colour. Menstrual once reused red for lack of its own token; it now has `ACCENTS.menstrual`.
- Do not use a module accent as small body text on its own tint unless the safe-text variant is used.
- Check contrast for any new colour. White text on filled buttons needs 4.5:1. Icons and large text need at least 3:1.
- Dark-mode companions must clear both the dark surface contrast and white-text contrast where they are used as fills.

### 3.7 Known colour exceptions

- Home's active-session border previously used `ACCENTS.encounters` in dark mode without `resolveDarkAccent`. This is an open audit item, not a pattern to copy.
- Menstrual accent text reaches only 3.56:1 on white. It is accepted for icons, large text, and UI components, but not small body text.
- **Raw accents used as text/labels without dark resolution (B1–B9):** Contacts, Home, Menstrual and MyProfile have no dark companion, so their accents used as text fail in dark mode (3.78:1 for Contacts). DesignScreen's "Customise" link uses raw `ACCENTS.medication` (1.50:1). Encounters kink tags use raw `ACTION.red` as decoration (3.70:1). The "Incomplete" chip hardcodes light-only `#926100`/`#FFF3C4`. Contacts select-mode bar hardcodes `#1B1B1F`. Settings subscreens (About, Stats, Resources, Share, DeveloperTools) use raw accents as text/labels. Do not copy these; resolve with `resolveDarkAccent` and a hand-picked companion.

## 4. Typography

Fonts are self-hosted through `@fontsource/*` and imported in `src/main.jsx`. Do not add a render-blocking Google Fonts link.

- Body font: `FONT_FAMILY = "'Inter', sans-serif"`.
- Utility/mono font: `FONT_FAMILY_MONO = "'JetBrains Mono', monospace"`.

### 4.1 Type scale

| Token | Size / weight | Use |
|---|---:|---|
| `TYPE.screenTitle` | 22 / 700 | Primary module banner (Contacts, Encounters, Medication, Healthcare, Settings) |
| `TYPE.recordTitle` | 20 / 700 | Record or detail title |
| `TYPE.subScreenTitle` | 16 / 700 | Settings and drill-down headers |
| `TYPE.sheetTitle` | 18 / 700 | Full-bleed add/edit sheet title |
| `TYPE.sectionLabel` | 12 / 700, uppercase, letter-spacing 0.5 | Group labels and section headings |
| `TYPE.body` | 14 / 400 | Main readable content |
| `TYPE.bodyEmphasis` | 14 / 600 | Labels, values, short actions |
| `TYPE.caption` | 12 / 400 | Secondary information and helper text |
| `TYPE.captionEmphasis` | 12 / 600 | Status labels and compact metadata |
| `TYPE.control` | 13 / 400 | Standard control/button/field size. Named 13 Nov 2026 — was previously untokenised (516 sites hand-typed). Now tokenised as TYPE.control across 24 files. |
| `TYPE.controlEmphasis` | 13 / 600 | Emphasised control text (bold labels, values). |
| `TYPE.microLabel` | 11 / 600 | Micro-text floor: badges, chips, status lines. Do not go below 11px except the 9px DEMO badge (explicit exception) and uppercase 9px chip-group subtitles (encounter cards; explicit exception, letter-spacing 0.05em). |
| `TYPE.monoLabel` | 12, JetBrains Mono | Identifiers, codes, technical values |

![Typography scale](design-manual/typography-scale.svg)

### 4.2 Typography rules

- Set `FONT_FAMILY` explicitly on screen-level root containers. Healthcare previously rendered in the browser default because it omitted this.
- Do not invent new font sizes for a one-off. If a new recurring role appears, add a token.
- **List-card title:** 15px / 600. Encounters was the outlier at 700; corrected to 600. (C4)
- Use `TYPE.sectionLabel` for grouped field labels, not ad hoc uppercase styling.
- Use JetBrains Mono only for utility values, not general body text.

## 5. Spacing and layout

The app uses inline styles, so spacing is currently expressed directly. The most common values are 4, 8, 12, 14, 16, 20, and 24 pixels. New work should use this recommended scale:

| Step | Value | Common use |
|---:|---:|---|
| 1 | 4px | Tight gaps, icon padding |
| 2 | 8px | Control gaps, compact rows |
| 3 | 12px | Card padding, form spacing |
| 4 | 16px | Screen horizontal padding |
| 5 | 20px | Section gaps, banners |
| 6 | 24px+ | Major section separation |

### 5.1 Layout rules

- Screen horizontal padding is usually 16px.
- Cards usually use 12-14px internal padding.
- Vertical gaps between related fields are usually 8-12px.
- Use full-width cards with 16px side margins on phone layouts.
- Keep touch targets at least 44px high for interactive controls.
- Do not put `minHeight: 44` on an inline SVG icon. It scales the glyph. Use padding or a negative margin on the parent instead.

![Spacing scale](design-manual/spacing-scale.svg)

## 6. Shape, borders, and elevation

- `RADIUS.sm = 8` for inputs and small controls.
- `RADIUS.md = 13` for cards and standard containers.
- `RADIUS.lg = 24` for larger sheets.
- `RADIUS.full = 999` for pills, FABs, and circular controls.
- Standard cards use a 1px border in `T.border` and no shadow.
- Use shadows for floating or overlay surfaces: FABs, toasts, dialogs, and sheets.
- Prefer borders over shadows for ordinary cards. Borders are more stable across light and dark mode.
- **Elevation rule:** ordinary list cards get no shadow. Shadows are reserved for floating/overlay surfaces. Contacts was the only list card with a shadow; it has been removed (C2).

![Elevation](design-manual/elevation.svg)

## 7. App shell and navigation

![App shell](design-manual/app-shell.svg)

- Bottom navigation has five tabs: Contacts, Encounter, Home, Medication, Healthcare.
- Home is the raised centre tab and is visually distinct from the other four. It is an **intentional exception**: always-filled 48 dp circle, no label, no state change when active. Do not copy this as a pattern for other tabs.
- Tab accents come from `ACCENTS` and are resolved for dark mode at render time.
- The bottom nav stays on record/detail screens and hides on Settings and other full-screen stacks.
- Tab order can be customised, but Home remains in the centre position.
- My Profile is not a primary tab. It is reached from Home or Settings.
- Settings is reached from the gear icon on Home.
- Global Search is available from the header and searches across modules.

### 7.1 Header and title blocks

![Title blocks](design-manual/title-blocks.svg)

| Role | Token | Where |
|---|---|---|
| Primary module banner | `TYPE.screenTitle` | Bottom-nav module screens |
| Settings/drill-down header | `TYPE.subScreenTitle` | Settings and sub-screens |
| Add/edit sheet title | `TYPE.sheetTitle` | Full-bleed coloured sheet |
| Grouped field label | `TYPE.sectionLabel` | Card or form section |

- **Section-label colour has three roles, not one.** Module accent when the label names a group *of the module's own records*; `textSecondary` when it names a field group inside a form or card; `textDisabled` only for a label sitting directly above an already-disabled value. Same size and weight in all three — the colour carries the role, so do not add a fourth variant for emphasis.
- **Chip colour has three roles too.** Metadata chips (relationship type, role, position) are `textSecondary` on `surfaceVariant`; warning chips (`Incomplete`) use the amber pair; search-hit tags are accent-filled. Keep amber for one meaning per screen — a Contacts accent that is itself amber must not colour a second chip family on the same card.
- **Contacts cards carry a pronouns byline.** One line tight under the name (2 px), 10/500 `textSecondary`, flush-left with the name row — never inside the name row, where `marginLeft:auto` on the icon group pushed it to the far right. Hidden under Anonymise. Transport/host/outdoor icons are *not* repeated on the card; they stay reachable via the active-status dot.
- **A Contacts card has one rhythm.** Identity row (checkbox, photo, name + byline) at the top, then one wrapping chip cloud (status/relationship chips flush-left, social badges on the right), then the last-met line ("Last met" + relative time). The text column owns a single 8 px gap. Right-hand social icons must not add extra height to the row — the icon block's tap height is the icon height (22 px), not a 44 px minimum, so badges never push the left-hand lines apart. Do not add per-row `marginTop` — that is what made the gaps visibly unequal. Rating emoji sits at the *end* of the name line (name, age, city, emoji), never directly after the name. Encounter rating always reads as the average: `♥ N/100 avg.` whenever any rating exists — there is no "first rating" fallback.

- Module banners use the module accent background with white text.
- **Home header** is a non-banner title (22/700) with up to 5 icons (Lock, Search, My Profile, Settings, Quick exit) and a 4 px accent bar underneath. Keep the icon count to 4 on narrow screens to avoid title wrap.
- **Home quick add is grouped, not stacked.** One heading per group, rows divided by spacing. The first group sits directly under the "Quick add" heading with no label of its own; later groups ("Healthcare") carry a `textSecondary` label. Row order is owner-set: the first group reads Log medication, New contact, New encounter, New session; Healthcare reads Log test, Log symptom, New clinic visit, Schedule routine retest, Log vaccination. Each row is a `surface` fill with a 1 px **module-accent outline** (5 Nov 2026 — the accent belongs on the outline, not on a tinted fill, so the colour reads at a glance on white). Do not go back to one neutral-bordered card per action: with eight rows the outline is the only per-button identity cue. The three Home module shortcuts (Clinic Card, Episodes, Calendar) follow the same outline rule and must match each other: accent outline either way, with the teal tint fill in light mode and a plain surface in dark mode — on the dark background the tint reads as mud, so dark drops it and keeps only the outline (owner decision, 5 Nov 2026).
- Settings headers are sticky at `top: 0` inside a root that already carries the safe-area top padding.
- Sub-module sticky subheadings use `STICKY_SUBHEADING_TOP`.
- **Banner control budget (owner-verified):** title, then actions in a fixed left→right order — Search, the Select toggle, module-specific actions (e.g. Contacts' import), the My Profile action where present, Settings, and Quick exit always last (rightmost). The Select toggle lives in the banner (verified pattern in Contacts, Encounters, Medication); the bulk-action toolbar it opens sits directly beneath the banner and must wrap into the screen width (max-width, `boxSizing: border-box`, wrapping action row) instead of overflowing.

## 8. Sticky headers and safe areas

- Screen roots carry `paddingTop: env(safe-area-inset-top)`.
- Settings screen headers stick at `top: 0`, not at an additional safe-area offset. Adding the inset again creates a gap.
- Settings sub-screens keep `top: 0` inside their own fixed overlay root (which already carries the safe-area padding) — the pairing is the invariant.
- **Due-reminder banner offset (verified on device):** the global reminder stack is `position: fixed` (zIndex 100), so module headers pin *below* it via `--shos-top-banner-h` — a CSS variable on the app root holding the measured banner-stack height in px (no safe-area component). A primary module banner / detail header uses `top: var(--shos-top-banner-h, 0px)`, `padding: calc(16px + env(safe-area-inset-top)) 16px 14px`, and `marginTop: calc(-1 * env(safe-area-inset-top))`. The negative margin pulls the banner's background to the true screen edge (no black band above the header when the reminder is dismissed); the padding keeps title/icons below the notch. When the reminder is up, the header emerges from behind the banner card flush — no gap above, no overlap underneath. Detail screens in `<main>` flow (encounter detail, test detail) use the same pattern. `<main>` keeps `paddingTop: env + banner` so Home (which has no banner of its own) still clears the status bar.
- **Sheets are the exception:** full-screen sheets render at zIndex 200+, *above* the reminder banner (zIndex 100), so the banner never overlays them. Sheet headers therefore keep `top: 0` and get their safe-area reach from the sheet root's `paddingTop: env` plus an absolute notch-band child (`bottom: 100%`, height `env`, header's own background). Never apply the banner offset or negative margin inside a sheet — it leaves a scrolling gap. (This was tried on the encounter edit sheet and reverted on-device reasoning; do not copy it back.)
- Healthcare subheadings use `STICKY_SUBHEADING_TOP = calc(env(safe-area-inset-top) + 58px)`. This is the height of a **single-band** module banner. Only valid when the sticky header above is exactly one band. Multi-band headers (e.g. Healthcare's two-row sub-tab stack) need a measured height instead.
- **Sheet rule:** inside a sheet's own scroll container, the sticky offset is `0`, never the screen offset. Use a `stickyTop` prop (default `0`) on shared components like `FormTabs`.
- Do not copy a hardcoded sticky offset from another screen. Use the shared constant.
- Check comments near sticky code before changing it. Some values were settled by on-device measurement.

## 9. Icons

- Icons come from `@phosphor-icons/react` only. Do not import `lucide-react`.
- Alias Phosphor icons to their original lucide-style names in one import block.
- Common sizes: 12px for compact metadata, 14-16px for controls, 18-20px for headers, 22px for navigation.
- Common weights: `regular`, `bold`, and `fill` for active states.
- Icons are decorative unless they carry meaning. Provide an accessible label for icon-only controls.
- Icon-only elements are audited by `iconOnlyUIAudit.test.js`.
- **No emoji as icons.** Icons are Phosphor-only. Never use emoji as a stored data key (e.g. Testing's setting field used "🏠 Home" as a key). *Documented exception:* the Contacts rating is stored with its emoji embedded ("😍 Love") and the card displays only the emoji token — kept deliberately, but do not copy it as a general pattern; prefer a real icon for new designs.

## 10. Forms, cards, lists, and dialogs

### 10.1 Forms

- Group fields in `SectionCard` or an equivalent card.
- Use `RADIUS.sm` for inputs and `RADIUS.md` for cards.
- Inputs use `surfaceVariant` backgrounds and `border` outlines.
- Labels use `TYPE.bodyEmphasis` or `TYPE.caption`, depending on density.
- Keep related fields vertically spaced by 8-12px.
- Validation errors use `ACTION.red` text and appear directly under the failed field.
- **Standard search/filter field:** `surfaceVariant` background, 1px `border` outline, `RADIUS.sm`, 8/12px padding, 13px font, `minHeight: 44`, and an `aria-label` matching the placeholder. Applies to every list filter, including in-sheet pickers (Testing's link pickers, Menstrual's suggestion picker). The one deliberate exception is the global search bar, which is borderless inside its own container so the container reads as the field.

### 10.2 Cards

- Standard card: white/surface background, 1px border, `RADIUS.md`, 12-14px padding.
- Do not add a shadow to an ordinary card.
- Use module accent only for the card's label or primary action, not the whole card.
- **Colour-indent pattern (§49b, 13 Nov 2026):** Section cards now use a tinted background (`${accent}08`) with a 4px coloured left border (`border-left: 4px solid ${accent}`) and `RADIUS.md` (8px). Applied to `SectionCard` via the `accent` prop. All modules use their module accent: healthcare (green), contacts (amber), encounters (purple), medication (blue), etc. This replaces the previous plain bordered section. See `SectionCard.jsx` for implementation.
- **Dates** follow one standard: day-first unpadded (`12 Nov`), with a weekday
  prefix on planned/future dates only (`Sat 14 Nov`). Never month-first
  (`Nov 12`), never zero-padded (`02 Nov`).
- **In-card notes and advisories** use the testing-card pattern: indent, 3px
  accent left bar, and a tinted background (8px radius). The reference is
  `healthcare-testing-card-mockup.html`'s `.advisory`. Bare 2px italic rules
  are for page-level documentation annotations only, never inside a card.
- **Card action buttons** have two tiers: base `.btn` at 40px min-height and a
  compact `.btn-sm` at 32px for in-card actions. Interactive elements carry a
  `:focus-visible` ring (2px module-accent outline, 2px offset), and card
  layouts include the `@media (max-width:360px)` narrow-viewport block.
- **Reason tags**: a `tag-btn` when the user can change the reason, a static
  span when it is derived from data (episode, record). Never a button that
  leads nowhere.

### 10.2.1 Card anatomy (encounters, contacts, medication, healthcare)

Record cards in this app share one anatomy: **title row → byline → grouped chip cloud → summary line**. The settled references are the encounter card (`encounters-card-mockup.html`), the contact card (`contacts-card-mockup.html`), the medication card (`medication-card-mockup.html`), and the healthcare card (`healthcare-card-mockup.html`); all are 393dp dark-mode renderings and must agree with this section. The STI test card (`healthcare-sti-test-card.html`) is the reference grammar for the summary state line, in-card context groups, and card action tiers.

- **Healthcare cards** carry the module accent (`healthcare`, formerly `healthcareBlue`) on interactive elements only (quick-add buttons, pill outlines, action bar CTA). The card background is plain surface with a 1px `border` in `T.border`. Do not tint the whole card background with the module accent — dark mode drops the tint and keeps only the outline (same pattern as Home quick add buttons, 5 Nov 2026).

- **Healthcare list cards (audited 8 Nov 2026).** The four healthcare lists — Testing, Clinic visits, Symptom log, Vaccinations — are audited against this section, one mockup each: `healthcare-testing-card-mockup.html`, `healthcare-clinicvisit-card-mockup.html`, `healthcare-symptom-card-mockup.html`, `healthcare-vaccination-card-mockup.html`. Rules settled by that audit:
  - **The status dot means "does this need action"** in every healthcare list, not a per-module colour idea. Testing: result (red positive / green negative). Vaccinations: red overdue, accent up to date. Symptom log: severity while active, green once resolved. Clinic visits: accent booked/future, amber follow-up due, muted completed. A new healthcare list picks from those meanings rather than inventing one.
  - **Older-record treatment is one component.** Fade the card (`surface` → `surfaceVariant`, `textPrimary` → `textSecondary`, `textSecondary` → `textDisabled`) *and* show a grey pill in the title row — `Older test`, `Older visit`, `Older entry`, `Older dose`. A line of 11/700 text is not a substitute for the pill. An active/ongoing record and a future appointment are never faded.
  - **Samples / tense (STI and booked collection):** planned or future collection reads "Samples to be taken from"; once the appointment/result context is attended or past it reads "Samples taken from". Tense must follow the record's state, not just its date string.
  - **Treatment on STI/test cards:** do not show a treatment action when there is nothing to treat yet (pending/awaiting result). When a result is positive, treatment becomes actionable and is recorded through a **clinic visit** (the quick-add → New clinic visit form), not as a free-floating fact — capture medication/dose and how it was given (**Given at clinic / Started at clinic / Prescribed / For at home**) plus visit date. "Confirm" and "Different treatment" both route into that clinic-visit capture; the card shows the locked-in outcome (e.g. `Confirmed · Given at clinic`, `Manual · Prescribed`) and a "Added to clinic visit" note. Negative/void/overdue states carry no treatment-to-act-on.
  - **Red border** is reserved for "needs attention now": positive result (Testing), overdue (Vaccinations), active *and* severe (Symptom log). Clinic visits have no red-border state.
  - **Every card carries two actions**, primary filled + secondary outline (e.g. `Log test` / `Schedule retest`), not zero. Healthcare accent on the button, never on the card fill.
  - **Unresolved gaps in the shipped lists:** none of the four renders a grouped chip cloud or a summary footer, and all four stack 12px text lines instead of one 10px icon byline. Clinic visits has no status dot at all; Vaccinations has no older-record treatment. Fix toward the mockups as those files are next touched. The mockups themselves were brought onto the shared standards on 11 Nov 2026 (summary state lines, action tiers, focus rings, narrow-viewport block) and now pass the smoke test with zero failures. **Clinic visit renders** (next planned card set) must cover the full 1:1 of the form → card: a visit is the canonical owner of treatment given/prescribed and can be started from a test or from quick-add; the card must represent every capturable form fact (at least in summary/grouped form) even when some are collapsed, and must not invent concepts absent from the form.

- **Healthcare chip groups** (status/relationship chips): metadata chips are `textSecondary` on `surfaceVariant`; warning chips (`Overdue`) use the amber pair; search-hit tags are accent-filled. Attendee pills use the amber `#e0a166` fill with white text: full-name pill for a single attendee, initials pills for several, **3 pills + a `+N` overflow pill**. Encounter kinks/activities use the encounters purple accent, position uses teal, protection uses green, cum/loads uses pink. Medication schedule/dose-form group uses teal, stock chips use medication blue, refill-requested uses blue with an inline `×`.

1. **Title row.** Active/inactive dot (8px) aligned to the title baseline, then the title (15/600, no emoji in the title), then the record's facts *after* the name (age, pin+city). The identity emoji, where one exists, goes at the **end** of the line — never directly after the name. Favourite star is absolute top-right; reserve it with `paddingRight: 24` instead of overlaying.
2. **Byline.** One line tight under the title, 10/500 `textSecondary`, flush-left with the name. Recurring byline icons are 11px. Keep related facts on the *same* line rather than stacking lines: a medication byline reads "1 tablet · Daily · 4:00 PM" (quantity and timing together). State strength as the **total per dose**, not the strength of one unit — 2 × 150mg is "2 tablets · 300mg total" — and keep ingredient names when the title is a brand ("Zapain · 2 tablets · codeine 60mg/paracetamol 1000mg total"). A second, denser fact (last/next dose) is its own 11px line directly below, never at the bottom of the card. Anything that describes *this dose* — a timing advisory, the medication's notes — sits directly under that line, above stock.
3. **Chip groups.** Each group is an uppercase 9px `textDisabled` subtitle with 10px of space *above* it (so chips breathe before the next label) and 4px below (updated from 3px — the medication and encounters mockups both use `margin-bottom: 4px`). Chip colour is semantic per group, and each card carries its own family:
   - **Contacts** — metadata chips (relationship type, role, position) are `textSecondary` on `surfaceVariant`; warning chips (`Incomplete`) use the amber pair; search-hit tags are accent-filled. Attendee pills use the amber `#e0a166` fill with white text: full-name pill for a single attendee, initials pills for several, **3 pills + a `+N` overflow pill**. Contacts cards carry a pronouns byline. One line tight under the name (2 px), 10/500 `textSecondary`, flush-left with the name row — never inside the name row, where `marginLeft:auto` on the icon group pushed it to the far right. Hidden under Anonymise. Transport/host/outdoor icons are *not* repeated on the card; they stay reachable via the active-status dot. A Contacts card has one rhythm. Identity row (checkbox, photo, name + byline) at the top, then one wrapping chip cloud (status/relationship chips flush-left, social badges on the right), then the last-met line ("Last met" + relative time). The text column owns a single 8 px gap. Right-hand social icons must not add extra height to the row — the icon block's tap height is the icon height (22 px), not a 44 px minimum, so badges never push the left-hand lines apart. Do not add per-row `marginTop` — that is what made the gaps visibly unequal. Rating emoji sits at the *end* of the name line (name, age, city, emoji), never directly after the name. Encounter rating always reads as the average: `♥ N/100 avg.` whenever any rating exists — there is no "first rating" fallback.
   - **Encounters** — kinks/activities use the encounters purple accent, position uses teal, protection uses green, cum/loads uses pink.
   - **Medication** — schedule/dose-form group uses teal, stock chips use medication blue, refill-requested uses blue with an inline `×`.
    - **Landscape scaling** — on a ~405dp tall landscape viewport (status bar + app bar + bottom nav eat most of it), cards can overflow the screen. To avoid overflow, cards use internal scrolling (no fixed height) and tighter spacing: padding 12px vs 16px, gap 3px vs 4px, and reduced title font size (13px vs 15px) on landscape viewports.
   A progress bar that has a meaningful threshold (medication stock) draws that threshold as a marker on the track and states it beside the stock quantity itself ("22 capsules left — restock at 10 capsules"), not as one more chip among the rate/supplier/requested chips: the chips answer "what do I do next", the number answers "how low is low". The track is scaled to `max(stock on hand, container size)` so the bar reads full when the user holds at least a container's worth; scaling to the refill quantity alone pushed both fill and marker to 100% on multi-container supplies and hid the marker at the bar's end. The marker itself is red (`#F97316`-class action red) so it reads as the "refill needed" line regardless of fill level.
4. **Independent verdicts, not one averaged box.** Where a card reports several related rates (medication adherence), give each fact its own tile and its own status colour — streak, 7-day, this container can be green / amber / red independently. Never wrap them in one background that implies a single verdict. Thresholds for rate tiles: ≥80% green, ≥50% amber, below red. A live streak's flame is filled orange-red (`#F97316`); the 7-day tile carries an up/down trend arrow against the previous 7 days, shown only when both windows contain due days and the medication was already running in the previous week (a medication started this week has no baseline to climb from).
5. **Summary line.** Two kinds — never mix them on one card:
   - **State summary** (healthcare lists, STI tests): lead-word state in caps, a `·` separator, then the key fact — `NEGATIVE · Next due ~14 weeks`, `OVERDUE · Second dose missing since Jun 2025` — coloured by state (green for settled/complete, red for attention, amber for pending/due). The vocabulary is per module and must not be invented ad hoc: STI tests use BOOKED, PENDING, POSITIVE, NEGATIVE, OVERDUE, VOID; clinic visits use DUE, BOOKED, COMPLETED; the symptom log uses ACTIVE, RESOLVED; vaccinations use COMPLETE, OVERDUE; general healthcare records use NEGATIVE, OVERDUE, ACTIVE. A card's chips must not repeat what the summary line already states (store-once).
   - **Metadata summary** (encounters, contacts): count → rating → recency, 11px `textSecondary`, one wrapping row, with the heart inline on the rating. Climax/status markers use the module accent (filled drop = happened, drop-slash = didn't); never gold.
6. **Action affordances.** Filter-style toggles are labelled pills, not plain text (see the Show archived switch below); bulk-select bars wrap inside the card column width and never overflow.

### 10.2.2 Toggles and switches

- Compact boolean toggles are pills with `role="switch"` + `aria-checked`: text on the left, a 40×24 (compact rows: 32×18) track with a white knob, accent-pink fill when on (encounters) or the module accent, `T.border` when off. Label repeats as "Show …"/"Hide …".

### 10.3 Lists

- Rows should have consistent height and spacing.
- Empty states should use an icon, one sentence, and an optional action. Implement with the shared `EmptyState` component (`src/components/EmptyState.jsx`) rather than a new inline div; it is for list-level states only — field placeholders such as "No notes yet" stay plain text.
- **Undo toast (§49b):** Use the shared `UndoToast` component (`src/components/UndoToast.jsx`) for delete confirmations. Previously 9 hand-written copies existed (Contacts, Encounters, Clinic Visits, Measurements, Medication, Symptom Log, Testing, Vaccinations, Menstrual Health). All now use the shared component. The shared version restores `minHeight: 44` and removes bare `aria-label="Undo delete"` (visible text is the name).
- Archived or historical items should use `ACTION.gold` or muted styling, not red.

### 10.4 Dialogs and overlays

- Modal overlays should use `role="dialog"` and `aria-modal="true"` where appropriate.
- Escape-to-close should be wired with `useEscapeToClose`.
- Fixed overlays are not all modals. Review intent before adding dialog semantics.
- Overlay back behaviour should use the shared overlay back stack where applicable.

### 10.5 Loading, empty, and error states

![Control states](design-manual/state-matrix.svg)

- Loading states should preserve the final layout shape where practical. Use `SkeletonList` / `SkeletonRow` from `src/components/Skeleton.jsx` for inline module loads; keep a plain "Loading..." only for full-screen transitions (App launch, Settings full-screen push).
- Empty states should not look like errors. Use `EmptyState` from `src/components/EmptyState.jsx` — it supplies the icon, sentence and optional action, and defaults to the same 40/20 padding and 13px text the old inline divs used.
- Error states should use red only for the failed action or invalid value.
- Disabled controls should remain visible and keep their layout.

## 11. Responsive and desktop behaviour

- The app is phone-first.
- `useIsDesktopWidth` controls desktop-specific layout changes.
- Desktop layouts may use wider inputs, multi-column glossaries, and larger pickers.
- Do not assume a fixed phone width in new components.
- Test long translated strings and small screens.

## 11.5 Platform differences: Android APK, web, and PWA

SHOS ships the same React UI to all platforms, but the surrounding shell and capabilities differ. Design and test against the lowest common denominator, then add platform-specific affordances.

| Area | Android APK | Web | PWA |
|---|---|---|---|
| Shell | Capacitor WebView, native status bar, system navigation | Browser chrome and tabs | Installed app window, possible browser chrome |
| Back behaviour | Hardware back button plus in-app back | Browser back button | Browser/app back button |
| Safe areas | Status bar and navigation bar insets | Usually none, but browser UI can obscure content | Installed-mode insets vary by browser |
| Offline | Fully local by design | Depends on network unless cached | Service worker cache supports offline after install |
| Notifications | Local notifications and widget updates | Browser notification permission | Browser notification permission |
| Home-screen widgets | Supported through Android AppWidget | Not supported | Not supported |
| Files and sharing | Android storage access framework | Browser download/share APIs | Browser download/share APIs |
| Security | App Lock, biometrics, screenshot controls | PIN gate only where supported | PIN gate only where supported |
| Install/update | APK release | URL access | Install prompt and update checks |

### 11.5.1 Platform design rules

- Always provide in-app back and close controls. Do not rely only on the browser or hardware back button.
- Keep primary actions reachable without hover. Hover-only interactions do not work on touch devices.
- Use safe-area insets for fixed headers, bottom navigation, and bottom sheets.
- Avoid viewport assumptions that exclude browser chrome or system bars.
- Show clear offline/unavailable states when a platform capability is missing.
- Gate platform-only features behind capability checks rather than user-agent guesses where possible.
- Treat widget, notification, biometric, and file features as Android-only unless explicitly implemented elsewhere.
- Test web/PWA changes in a browser and Android changes on a device or CI APK.

### 11.5.2 Platform-specific UI

- Biometric unlock appears only where the platform supports it.
- The install prompt appears only in web/PWA contexts.
- Home-screen widgets are Android-only and must follow widget privacy and layout guards.
- Screenshot and screen-security controls are Android-specific.
- Deep links and URL handling need explicit testing in web/PWA.

## 12. Accessibility

- Reduced motion is supported through `useReducedMotion`. Respect it for transitions and animated UI.
- Quick exit is available on screens and must remain functional. A visible panic control that does nothing is worse than no control.
- Touch targets should be at least 44px high for interactive controls. The card action tiers are the documented exception: in-card `.btn` is 40px and `.btn-sm` is 32px so two actions fit a dense card row; screen-level primary CTAs still meet 44px.
- Use `aria-live="polite"` for status updates.
- Icon-only controls need accessible labels.
- Contrast must pass WCAG for text and UI components.
- Keyboard navigation should work for header icons and interactive elements.

## 13. Privacy-sensitive UI

- Do not put identifying health details in widget picker labels.
- Widget tiers are `full`, `redacted`, and `off`. Redacted uses default-deny allowlists.
- Fields not allowed at redacted tier must render as `GONE`, not blank.
- Structural labels at redacted tier should also be hidden when their rows are hidden.
- Disclosure level controls notification text only. It is separate from widget tier.
- Anonymise mode hides identifying details across notification surfaces.
- Screenshots and documentation must use fictional data only.

## 14. Common design mistakes and fixes

| Symptom | Likely cause | Preferred fix |
|---|---|---|
| Gap above a sticky settings header | Safe-area inset counted twice | Root carries top safe-area padding; sticky header uses `top: 0` |
| Subheading overlaps or gaps | Hardcoded sticky offset | Use `STICKY_SUBHEADING_TOP` |
| Screen renders in browser default font | Missing `FONT_FAMILY` on root | Set `FONT_FAMILY` explicitly |
| Accent text fails contrast on tint | Base accent used as text on its own tint | Use safe-text variant or darken stand-in |
| Dark-mode accent looks wrong | Raw `ACCENTS` value used without resolution | Use `resolveDarkAccent` |
| Chips or switches become oversized | `minHeight: 44` applied to inline SVG or chip | Use padding/negative margin on parent |
| Overlay does not close with Escape | Missing `useEscapeToClose` | Wire hook and check dialog semantics |
| Content scrolls through header | Scroll container lacks safe-area handling | Review sticky/safe-area comments before editing |
| Custom colour does not update immediately | Modules read accents at load time | Reload app; document as expected |
| Red used for a non-error state | Semantic colour misused | Use module accent or neutral styling |
| Empty card looks broken | Empty state not designed | Add icon, sentence, optional action |
| Long translated text overflows | Fixed width or missing wrap | Test long strings and small screens |
| Feature works on web but not APK/PWA | Platform capability assumed | Gate feature by capability and test on target platform |

## 15. Frequently asked questions

**Which title style should I use?**  
Use `screenTitle` for primary module banners, `subScreenTitle` for settings and drill-down headers, `sheetTitle` for full-bleed add/edit sheets, and `sectionLabel` for grouped fields.

**Should a new feature use a module accent or a status colour?**  
Use the module accent for identity and primary actions. Use action colours only for status, validation, or destructive actions.

**How do I handle dark mode?**  
Use `NEUTRAL_DARK`, resolve module accents with `resolveDarkAccent`, and check contrast. Do not assume a light-mode colour will work on a dark surface.

**When should I create a shared component?**  
When a presentational component or helper is duplicated in three or more modules, or has been the site of a repeated bug. Consolidate it and make deliberate differences props.

**How should I choose spacing?**  
Use the recommended scale. Prefer 16px horizontal screen padding, 12-14px card padding, and 8-12px field gaps.

**Which icons are allowed?**  
Phosphor icons only, imported through the established alias pattern. Do not add lucide-react.

**How do I show an empty state?**  
Use an icon, one sentence, and an optional action. Keep it visually distinct from an error.

**Can I include screenshots in documentation?**  
Yes, but only with fictional demo data and no identifying details. Prefer swatches and abstract mockups for public repositories.

## 16. New feature checklist

Before shipping a new screen or component, check:

- [ ] Uses tokens instead of hardcoded colours, fonts, and radii.
- [ ] Has a clear title role.
- [ ] Uses module accent for identity and action colours only for status.
- [ ] Works in light and dark mode.
- [ ] Uses safe-area handling correctly.
- [ ] Sticky headers use shared constants.
- [ ] Touch targets are at least 44px.
- [ ] Icons are Phosphor and have accessible labels where needed.
- [ ] Empty, loading, and error states are designed.
- [ ] Long translated strings and small screens are considered.
- [ ] Reduced motion is respected.
- [ ] Privacy-sensitive data is not exposed in labels, widgets, or screenshots.
- [ ] Platform differences (APK, web, PWA) have been considered.
- [ ] Any new shared pattern is documented or consolidated.

## 17. Known gaps and exceptions

These are current audit items. They are not standards and should not be copied. Each item should be checked against current code before it is treated as open work.

### 17.1 Resolved or no longer applicable

- Home's active-session border now uses the dark-mode accent resolver.
- Some settings screens already use the shared Escape handler; the blanket "settings screens lack Escape" claim is not accurate.
- The manual no longer lists i18n adoption, CRUD smoke-test coverage, or device validation as design-system issues. Those belong to their own work areas.

### 17.2 Needs verification before calling it open

- Settings Escape handling: several screens use it, but the full set has not been re-audited screen by screen.
- Settings touch targets: the old count of `cursor: pointer` sites does not prove the tap area is too small. Padding and surrounding controls also matter.
- Fixed overlays: a floating panel is not always a dialog. Each one needs an intent review before adding dialog semantics.

### 17.3 Confirmed open

- (Device validation moved to §11.5 platform testing guidance.)

## 18. Change policy

- Update `designTokens.js` and this manual in the same change when a token changes.
- Add a new token before introducing a new recurring visual value.
- Document deliberate exceptions in section 17 or the relevant component.
- Keep visual references privacy-safe.
- Do not turn observed variation into a rule without checking whether it is intentional.
- When a design pass changes the visual language, preserve semantic roles so accessibility and privacy behaviour remain stable.