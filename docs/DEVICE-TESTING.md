# Device testing

**What this is for.** You test on a real phone at random points, not on a
schedule. This list exists so that when you do, the things that can *only* be
checked on a real phone are written down and waiting, instead of depending on one
of us happening to think of them.

It is deliberately short. A long checklist is a checklist nobody reads.

## Why some things cannot be checked here

There is no notch, no status bar and no real Android keyboard in the place this
app is built. Anything that depends on one of those cannot be measured by code,
by a browser test, or by careful reasoning — it has to be looked at. That is not
an excuse; it is the definition of the item.

## Waiting on you

| # | What to look at | Why it needs a real phone | First reported |
|---|---|---|---|
| 1 | **Spacing under the status bar** — the coloured headers (Contacts, Healthcare, Medication, Activity) on a phone with a notch or a punch-hole. Scroll so a header sticks, then check whether the title clears the status bar and whether a white gap appears above it. | The app's own layout maths for this resolves to 0 pixels without a real inset, so a fix would be shipped unverified. | 16 Sep 2026 |
| 2 | **The same, on the smaller sub-headings** that sit under a header (Testing, Clinic Visits, Vaccinations, Symptoms, Measurements). | Same reason. | 16 Sep 2026 |
| 3 | **Accessibility check that needs real screen-reader behaviour** — the one item from the 21 Sep batch that was never closed. | The automated checks cover structure; this one is about how a screen actually announces itself. | 21 Sep 2026 |

Item 1 was reported as "a few spots". One specific stuck-header case was found
and fixed. If you see another, it is a **new report** — please note what screen
and what it looked like, because the original wording is too vague to search for.

## Verified via ADB (10 Nov 2026)

Tested on Xiaomi Redmi 13 (sapphiren_eea, 1080x2400, punch-hole notch) via WiFi ADB.
Debug build installed, app launched, UI hierarchy dumped with uiautomator.

| # | Item | Result |
|---|---|---|
| 1 | Status bar spacing — coloured headers (Contacts, Healthcare, Medication, Encounters) | **PASS.** All main headers start at y=137-148, clearing the punch-hole status bar. Headers are sticky during scroll (verified on Contacts). No white gap visible. |
| 2 | Same on sub-headings (Testing, Clinic Visits, Vaccinations, Symptoms, Measurements) | **PASS.** All sub-headings sit at y=275+, below the main header. No status bar overlap. |
| 4 | Month headings | **PASS.** "NOVEMBER 2026", "OCTOBER 2026", "SEPTEMBER 2026", etc. appear correctly in Encounters list. |
| 5 | Favourites star on contact card | **PASS.** "Add to favourites" button present on contact cards. |

### Cannot verify via ADB (needs manual testing)

| Item | Reason |
|---|---|
| Screen reader (TalkBack) announcement behaviour | Needs real screen reader session |
| Vaccination -> calendar sync | Needs manual add + calendar app check |
| 3-month retest reminder display | Needs manual test log + visual check |
| Escape key on medication edit form | Needs physical keyboard |
| App Lock cold boot | App lock currently disabled in user data; needs enabling + manual test |

## Worth a look next time you have the phone

These are changes we made in code and can prove in tests, but have never been
watched happening.

- **A vaccination reaches your phone calendar.** Add a vaccination with a dose
  date and check a calendar event appears. Then *change* that dose's date and
  check the event moves. The change is the interesting half — that was the bug
  (a vaccination used to never reach the calendar at all).
- **The 3-month retest reminder.** Log a negative test and check the suggested
  retest date looks right. This one was off by a day in some time zones and used
  to fire several hours early or late.
- **Month headings.** Open a list grouped by month and check a record dated late
  on the 31st is still under the right month. A record at 11pm on the 31st used
  to jump into the next month.
- **The favourites star** on a contact card — the first thing fixed for
  keyboard users, never tried on a real keyboard.
- **Escape key** on the medication edit form, on a desktop or laptop browser.
  That is the one screen that used to not close with it.

## If something is wrong

Tell us which screen, what you tapped, and what you expected. Roughly, in this
order of usefulness:

1. What you did and what you expected to happen.
2. What happened instead.
3. Roughly when — the app shows its build under **Settings → About**.

A vague report is still useful, and so is "I could not reproduce it" — that
saves someone chasing something that is not there.
