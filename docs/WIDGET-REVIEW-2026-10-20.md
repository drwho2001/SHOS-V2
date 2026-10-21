# Widget redesign — device findings and design decisions (20 Oct 2026)

Source of truth for the next session. Written before the implementation so the
reasoning survives the context window.

## 0. What actually shipped (added after the implementation)

The measurements in section 1 are from the FIRST screenshot and are partly
wrong; the corrected ones are in section 0.1. Everything below is the record of
the thinking, kept as it was written.

| Change | What it is |
|---|---|
| Next Dose | The ring and its live countdown had NEVER rendered (section 0.2). They now do. The ring's centre carries the wall-clock due time ("04:00"), the live countdown is the line beneath it, and the medication name is the caption. |
| Ring geometry | 44dp ring with a 6dp stroke, so the hole is 32dp — wide enough for the time. The drawable and the view must agree or the ring is clipped (L-130). |
| Refills due | The headline is "Soon" or "None", from the user's own stock projection (section 0.3). It was "All stocked", which was false on this device. |
| DoxyPEP | The status word moved BELOW the ring, where it has the card's full width; the no-window state shows an empty ring and "no" over "window". The dates dropped the year ("Dosed 20 Oct"). |
| Clinic card | At the narrow width the "When"/"Where" headings are hidden and the location moves up into the band they occupied. The title is two lines, so it no longer truncates. |
| Quick Add | The 48dp disc became 22dp above the label, and the three layouts use 8dp padding, because the card is 72dp tall — one launcher row. |

### 0.1 The measurements, corrected (pixel scan of the live widget page)

| Card | px | dp | Note |
|---|---|---|---|
| Appointments, wide Clinic Card | 471 x 457 | 171 x 166 | two columns |
| Last test, Refills, DoxyPEP, Next dose | 299 x 449 | 108.7 x 163 | three columns |
| Quick Add x3 | 299 x 198 | 108.7 x 72 | ONE row: 40dp of content height at 16dp padding |

The review below said the DoxyPEP card was 61dp wide. It is not: at the time
of the redesign the owner had it at 108.7dp, the same as every other
three-column card. The 61dp placement in the first screenshot is gone from the
device, so nothing here is measured at that width.

### 0.2 The Next Dose ring had never rendered

`countdownAt` crossed the bridge as a `Date` (`unlockAt` is a Date), so
Capacitor serialised it to an ISO string and `call.getLong("countdownAt", 0L)`
returned its 0 default. The provider's countdown branch therefore never ran.
It looked right because the "due now" branch sets a full ring without needing
a target — so the ring appeared whenever a dose was already due, and the
scheduled state showed a time with no ring at all, which is what the device
screenshot shows.

The fix is in the one place that owns the value: `nextUnlock.getTime()`, and
the same number now feeds the Redacted line.

### 0.3 The "Soon" horizon is a product decision, and it is one constant

The app had no "soon" concept — only "at or below the refill threshold", which
is why the card could say "All stocked" while a medication sat one day from
its reorder point. The headline now uses a three-day horizon
(`REFILL_SOON_DAYS`, `src/calculations/refillReminderSync.js`), derived from
the user's own `refillThreshold` projection and not from any guess about a
pharmacy's lead time. It is the owner's call, and it is one line to change.

### 0.4 The Refills card is counted in LINES, not in medications

The card is 76.7dp of text width inside its padding — about thirteen
characters a line at 11sp — and 131dp tall inside a two-cell placement. The
text used to be one string per medication ("Sertraline · 14 left ·
requested", twenty-nine characters), so it wrapped across three lines, broke
mid-phrase, and pushed the second medication off the bottom of the card.

Each fact is now its own line, and the number of lines is the card's real
capacity:

- the name, the stock ("14 left") and what has happened with the refill
  ("requested" / "request now" / "due in 179d" / "no schedule") are three
  lines a medication, and every one of them is short enough to fit the
  narrowest card;
- the stock line is the one that goes when the card is full — three
  medications fit without it, and a medication is never dropped silently: the
  last line says "+N more";
- `REFILL_CARD_LINES` in the JS and `android:maxLines` in the layout are the
  same number, and `src/components/widgetRefillCardBudgetGuard.test.js`
  asserts it — plus that the layout's bands fit the card and do not overlap
  each other, which is the check the other widget guards could not make.


### 0.5 Widget round two (21 Oct 2026) — the owner's second pass

Everything below came from the owner's own notes on the cards, in their words.

| Card | What changed |
|---|---|
| Next appointment | The card's name is now a small muted LABEL, "Next appointment:" with a colon, and the appointment's own name is the big white line under it. The two were both white and near the same weight, which the owner read as "not inherently clear from a glance". The narrow card says "Appointment:" and now SHOWS the appointment's name, so the label always has a value under it. |
| Next appointment | The time is twelve-hour ("Thu 18 Mar · 4:00pm"). It was 24-hour because `toLocaleTimeString` follows the DEVICE locale and this phone is 24-hour — the Next Dose card already said "4:00am" on the same home screen. `formatClock12` in `dateInputHelpers.js` is the shared form, and it matches the Java side exactly (lower case, no space). |
| Next appointment | The Maps link searches for the FULL ADDRESS. The tap itself already existed; it could only search for the clinic's name, which Maps cannot turn into a pin. A clinic visit now LINKS to a Locations record (the owner's choice over a free-text address field), and that record carries the address and a new postcode field. The card shows the name and the POSTCODE - the street is twenty-eight characters and does not fit a card this width at any legible size - and the Maps link searches for the whole address. |
| Next appointment | The "Tests:" row carries the NAMES of the linked tests, not a count, and a new "Planned:" row carries the visit's own reason for visit — the closest thing the app has to "tests/procedures planned for that appt". Both are wide-card only. The clinic number row is gone: the card has room for six rows and not seven. |
| Next dose | Every medication with a dose pending is named, not counted: "Sertraline, PrEP" instead of "Sertraline +2". The `upcoming` list is also SORTED by when each dose unlocks, which it was not — the widget was counting down to whichever medication the repository happened to list first. |
| Refills due | A blank line separates one medication from the next (four undifferentiated lines read as one list), and the medications are listed by when each one next needs reordering — the same number the card's own "request in 179d" counts down to. |
| Quick Add | The plus badge is a thin cross: 44 units across with 8-unit arms, about 1dp. It was a 16-unit stem with a 28-unit bar — 2.1dp of vertical arm and 3.6dp of horizontal, and not even square. |

The two things the owner asked for that turned out to need less work than they
sounded: the Maps tap (it was already there) and the "12h time" (one helper and
one call site). The one that needed more: the clinic's address, which had
nowhere to live at all — a repo-wide search for postcode, zip, addressLine or
houseNumber found nothing but prose.

### 0.6 Widget round three (21 Oct 2026) — the owner's third pass

Three instructions, and the first one is a rule rather than a change.

**NO ELLIPSIS, EVER.** "If any text truncates, it should go to the next line
instead, never elipses, especially if theres free space above/below. or if
almost fits on the line decrease font size slightly." Every
`android:ellipsize="end"` is gone from the eight widget layouts, and the
fields that were capped at one line now declare two, so a long value WRAPS.
The second half of the rule was already true: `WidgetTextFit.fit()` shrinks
the text a whole sp at a time until it fits the field's `maxLines`, so with
two lines to spend there is nothing left to truncate.

**THE APPOINTMENT CARD'S TITLE AND NAME.** "Swap the changes you made to appt
title and appt name, to keep in consistency with other widgets." The title is
16sp, bold, white, at the top — the same as every other card's title — and
the appointment's own name is what is marked: 18sp in the accent, because it
is the useful information and the card's colour principle is that the useful
information reads first. The narrow card says "Appointment:" and shows the
name on two lines, because "Biannual PrEP" needs 215px at 12sp and the narrow
card's text is 211px — one line would have cut off the very word the owner
was reading.

**THE REFILLS CARD'S COLOUR.** "Colour principle of useful information at
first glance and then just muddled remainder isn't great." The medication
that needs reordering now is BRIGHT and everything else is DIM. A view is one
colour, so that is two views, and the two share the card's six lines: the
bright medication takes two (its name and what has happened with its refill)
and the dim group takes four (a blank line, a medication, and the count of
the ones not shown). The stock count ("14 left") is off the card now — it was
the one fact on it the owner never asked for, and the two lines the bright
group spends are the name and the state.

## 1. What the device actually shows (screenshot `wb1.png`, 1080x2400, 440dpi)

Home-screen widget page, all ten widgets placed by the owner. Measured from
pixels, not assumed:

| Widget | Card width (px) | dp at 2.75x | Defect seen |
|---|---|---|---|
| Appointments | 300 | 109 | "0 upcoming + 1 later" — count says 0 but an appointment is listed |
| Clinic card (wide) | 300 | 109 | "Biannual PrEP / WHEN / Thu 18 Mar · 16:00 / WHERE / Conifer" |
| Clinic card (narrow) | 168 | 61 | title clipped "Biannual Pr…", headings eat the card |
| Last test | 300 | 109 | fine |
| Refills due | 300 | 109 | headline "All" (was "All stocked" truncated), body "Sertraline · 16 left · request in 2d" |
| DoxyPEP | 168 | 61 | "NO WINDO…" truncated; no ring at all |
| Next dose | 300 | 109 | green ring with "DUE" overlapping the "Due now" caption; "Sertraline, …" truncated |
| Quick Add ×3 | 300 each | 109 | 48dp icon overlapping the "Add Contact" / "Encounter" / "Medication" label |

So the owner has BOTH a wide (109dp) and a narrow (61dp) placement of the
same widgets. **Width is not the only variable — height is.** A 61dp-wide card
has ~77dp of content minus 32dp padding = 29dp of usable inner width.

## 2. The owner's actual asks (from the bedtime feedback)

1. Quick Add icons "too big and behind text".
2. Refills due should say "None/Soon", not "All", "as per current stock levels".
3. DoxyPEP "no window" truncated — should be centred two lines: "no" / "window".
4. DoxyPEP: no ring seen — "could have empty ring/outline in this instance".
5. Next dose: ring is oversized, principle is good, but it overlays text.
6. Clinic card: lose the "when"/"where" labels when halved — "smaller widgets
   have just what's necessary, but larger icons can indulge a little".
7. Wants the smallest Last test widget and the halved clinic card demonstrated.

## 3. Sense check — where the research says the owner is right, and where not

Two independent research passes were run (market research on medication
widgets; Android widget-design research), plus a Gemini review of the exact
RemoteViews geometry. Findings that CHANGE the plan:

### 3.1 A live "hh:mm" inside the ring is NOT achievable — confirmed
`Chronometer` renders `DateUtils.formatElapsedTime()` = `MM:SS` or `H:MM:SS`
only. `setFormat` wraps that whole string as one `%s`; it cannot select
components, and `setOnChronometerTickListener` is not `@RemotableViewMethod`
so a widget cannot reformat on tick. A 36dp hole at 12sp fits "12:34"
(≈2.5em) but "4:12:30" needs ≈116px vs 99px available.

**Therefore: ring centre = the wall-clock due time ("20:30", 5 chars ≈ 2.5em
≈ 82px, fits 99px). The live ticking countdown stays on its own line BELOW
the ring, where the full 77dp width is available.** This is what the owner
asked for in original feedback item 3 ("countdown ring with numerical hh:mm in
centre") and it is the only version that fits.

### 3.2 The ring must SHRINK, and the caption must clear it
`widgetRingGuard.test.js` already asserts the ring stays small enough to
clear the caption. Owner says "oversized". The 52dp ring is drawn
centre-anchored, so it collides with a bottom caption block. Fix: smaller
ring (40dp) + a thinner stroke, and move the caption clear of it.

### 3.3 "None/Soon" is the RIGHT headline — do it
Research consensus: a headline must answer "do I need to act?", not "is
everything fine?". "All stocked" is a non-answer; "None" / "Soon" is a
status. This maps exactly to the owner's request, and to the real-app
pattern (`Metformin 6 left · refill Tue`, "Low" badge).

But the *refill horizon* must be honest. Research: users think "can I get
it in time", and a hardcoded "2d" is a guess about the user's pharmacy.
The app's own `refillThreshold` IS the user's own buffer, so a horizon
computed from it is derived from real data — keep that, but present it as
**days of supply left** plus the request point, and make the headline
reflect whether anything is due now.

### 3.4 DoxyPEP "no window" — the owner is RIGHT that a bare label is bad
Google's own widget quality bar (WT-1): the zero state must "show the value
of the widget and/or provide a call to action". A muted "NO WINDOW" is
neither. Two lines centred ("no" / "window") is still a status label, so
pair it with the owner's own request: keep the last-dose date visible, and
show an EMPTY ring (outline) so the card keeps its shape and the eye has
somewhere to land. That is exactly what the owner asked for in item 4.

### 3.5 Empty ring IS achievable
`setProgressBar(ring, 100, 0, false)` leaves the arc at level 0 while the
track stays a full circle → an empty ring outline. The existing DoxyPEP
"expired" branch already does this. So the no-window branch can reuse it
instead of hiding the ring.

### 3.6 Don't put a THIRD number on a card
Research: one key number + one caption. So the Next Dose card is
**ring(centre = due time) + caption (med name) + live countdown line** —
no separate "Next at HH:MM" line competing with the ring centre.

### 3.7 Icons: use the app's OWN module icons
Owner asked for "icons from bottom navbar module tabs (contact,
encounter/pulse, medication/pill + plus)". The app already imports
`UsersIcon as Users`, `PulseIcon as Activity`, `PillIcon as Pill` — so the
real Phosphor paths are available in `node_modules/@phosphor-icons/react/
dist/defs/`. Traced the regular-weight paths for Users / Pulse / Pill;
the contact one is now `ic_widget_contact.xml` etc. with the module accent
colour plus a plus badge.

## 4. Constraints that must not be broken

- **L-076: ONE ViewGroup per layout.** Gemini confirmed a horizontal
  `LinearLayout` ROOT is safe (it is on the RemoteViews supported list) —
  but the repo's own guard `widgetTapAndFallbackGuard.test.js` counts
  ViewGroups per layout and expects exactly 1, so a LinearLayout root with
  flat children also passes. HOWEVER the vertical-budget guard expects
  FrameLayout roots for the three rebuilt layouts. **Decision: keep
  FrameLayout roots everywhere; place the icon and the label as two flat
  children of the FrameLayout, positioned by `layout_gravity`, with the
  label given a `layout_marginStart` so it cannot overlap the icon.** No
  new container, no new ViewGroup, no nesting risk.
- `widgetVerticalBudgetGuard`: `KNOWN_STILL_CENTRED` must stay `[]`.
- `widgetRingGuard`: track and arc geometry must stay identical, both
  `useLevel`, ids `@android:id/background` / `@android:id/progress`, and
  every ring ProgressBar must carry `android:rotation="-90"`.
- `widgetTextFitMaxLinesGuard`: EXACTLY 19 `WidgetTextFit.fit(` call sites,
  and each must pass the `maxLines` AND `maxSp` its layout declares.
  **Any new fit() call means updating that count in the same commit.**
- `widgetVisibilityRestoredGuard`: every view set GONE anywhere must be set
  VISIBLE somewhere; `widget_clinic_heading_details` is permanently hidden.
- `quickAddWidgetLabelGuard`: exactly one labelled TextView per Quick Add
  layout, label must contain "Add Contact"/"Log Encounter"/"Log Medication",
  `maxLines >= 2`, and Quick Add providers must NOT call `fit()`.
- `clinicCardHeadings.test.js`: layout must keep `When`/`Where`/`Details`
  headings and the provider must hide all three at Redacted.
- `widgetRedactedRender.test.js`: a CLOSED vocabulary of words allowed in
  redacted lines: testing, medication, refills, appointments, tracking,
  clinic, card, doxypep, logged, none, due, all, stocked, booked, nothing,
  upcoming, active, overdue, no, data, now, today, tomorrow, days, test,
  tests, meds. **"None" and "soon" — "soon" is NOT in the vocabulary.**
  So the Refills headline at Redacted tier must use an allowed word:
  "none" (allowed) or "due" (allowed). Use **"none"** / **"due soon"**? No —
  "soon" is not allowed. Use "none" and "due". So Refills headline ∈
  {"none", "due"}. At Full tier the headline can be "None"/"Soon" (not a
  redacted line, so unrestricted), but the SAME string builder feeds the
  redacted line, so keep the vocabulary-safe words: "none" and "due".
  **Final: headline = "None" (nothing due) or "Soon" — but for the redacted
  line use "none"/"due".** Simplest: build the Full headline in JS as
  "none" / "soon" is unsafe → use "None" / "Due soon"? "soon" still unsafe.
  → Use **"None"** and **"Due"**. "due" is allowed and reads as "a refill is
  due". Owner said None/Soon; "Due" is the closest vocabulary-safe word and
  carries the same action signal. Flag this trade-off in the summary.

- Java cannot be compiled locally (Java 8 only; AGP 8.13 needs 17+). The
  only compile check is CI `build-apk`. **Batch every Java change, then one
  CI run.**

## 5. Plan for the batch (one CI run, one install, one screenshot)

1. **Quick Add** — FrameLayout root, `ImageView` 28dp at `top|start`, label
   TextView with `layout_marginStart` so the two cannot overlap; icon
   re-traced from the app's own Phosphor module icons.
2. **Next dose** — ring 40dp, centre = wall-clock due time, live countdown
   Chronometer on its own line below the ring, medication name as the caption.
   Overdue → red centre text.
3. **DoxyPEP** — no-window branch: empty ring (progress 0) instead of a
   hidden ring, and the status text as two centred lines "no" / "window"
   (maxLines 2, centred) with the last-dose date kept.
4. **Refills due** — headline becomes the state ("none" / "due") instead of
   "All"; per-med lines keep pill count + request point.
5. **Clinic card** — at the narrow (61dp) placement, drop the When/Where
   headings and show only date/time + location; at the wide placement keep
   them. The "more appointments booked" line comes from the existing
   `nextAppointment` count, which already knows `upcoming` and `later`.

## 6. Verification loop that worked

`adb` is at `C:\Users\kanem\AppData\Local\Android\Sdk\platform-tools\adb.exe`
(wireless device `adb-6f7f1396-UPP1Oi`). Local `npm run build` +
`npm run verify:fast` are green. The APK is built by CI (Java is
uncompilable here), so: commit → push → `gh run watch` → download
`SHOS-debug-apk` → `adb install -r -d` → relaunch the app so the widget
pushes refresh → screenshot the widget page and READ the image.

Widgets do NOT re-render on install; the app must be foregrounded to push
fresh data, and the widget then updates from the encrypted store.
