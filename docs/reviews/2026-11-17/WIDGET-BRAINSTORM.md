# Widget brainstorm (17 Nov 2026)

**Simple explanation (analogy):** a widget is a **window on your phone's home screen looking into the app**. Some windows show a snapshot (e.g. "next dose in 2h"), and tapping them walks you through the door to the right room. There are 11 windows today. Adding a new one needs: (1) a picture layout, (2) a "walk through the door" address (deep link), (3) a rule for what to show when there's no data, and (4) a privacy tier (Full/Redacted/Off) so it never leaks health info onto a locked screen.

## What exists (11 widgets)
DoxyPEP window, Next medication dose, Refills due, Quick-add medication, Cycle (period day), Test due, Vaccination, Appointment (clinic visit), Live session, Clinic Card, Quick-add encounter, Quick-add contact — each with its own deep link.

## Suggested new widgets — ranked by value vs effort

| # | Widget | What it shows | Tap opens | Round |
|---|---|---|---|---|
| W1 | **Upcoming contact** (your suggestion) | Next person/meeting from Encounters (e.g. "Priya — Sat") | That specific contact/encounter (needs `contact?id=` / `encounter?id=` deep link) | **Framework now** |
| W2 | **Next test due** | Days to next routine retest (BASHH 3-mo) | Prefilled "Log test" | Now-later |
| W3 | **Contraception due** | Days until renewal (Depot/IUD) | Contraception sub-tab | Later |
| W4 | ** symptom / episode** | Active symptom count or ongoing episode | Symptom list | Later |
| W5 | **PrEP adherence** | 7-day adherence % (already on Home) | Medication dashboard | Later (data exists) |
| W6 | **Safety check-in** | Countdown to a check-in deadline (from Safety Share) | Safety Share sheet | Later (privacy-sensitive) |

## W1 — the contact widget, properly scoped (owner's idea)
This is the best candidate because it turns the "door with no key" problem into a real key:
- **Framework now (cheap, low risk):** add a generic `recordId` consumer to the deep-link handler so a widget can say "open this specific contact/encounter". Add the pure route `contact?id=` (mirrors the tested `clinic-visits?id=`) and a guard test that the consumer exists — same pattern as `deepLinkConsumerGuard.test.js`. **No Java widget yet** — just the key and the lock.
- **Widget later (bigger, native):** a small "next contact" widget reading Encounters and showing the nearest upcoming person. Needs a native provider, layout, privacy tier (Redacted shows "1 contact" only), and empty state. Native APK build + device test required.
- **Privacy:** contacts are sensitive — widget must honour the existing `widgetPrivacy` tiers; default redacted.

## Decision for this round
- **Build the W1 framework** (deep-link key + guard test) alongside the R3 restore work — it's small, pure, tested, and unblocks the widget later. This reverses my previous "add no deep links": the owner's widget idea gives the route a real future key, so it's no longer a door to nowhere.
- **Do not build the native widget this round** — it needs device testing and the APK pipeline; schedule after the clinical features.
- W2–W6: note in BACKLOG as candidates; build only when their data source and privacy tier are confirmed.

*No code changed yet. UK-first; nothing clinical in widgets.*
