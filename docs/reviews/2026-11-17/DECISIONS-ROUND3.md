# Decisions — round 3 popup (17 Nov 2026)

## Explanations given (simple terms)
- **Deep link:** a home-screen widget's "signpost/address" into the app — e.g. `clinic-visits?id=123` means "go to Healthcare → Clinic Visits → that specific visit". All current routes have a widget that uses them. A `contact?id=` route would be a signpost to a shop that isn't open (no widget needs it yet).
- **LOINC:** a barcode for a lab test. Dropped — nobody would type it and nothing scans SHOS exports.
- **Import (Clue CSV)** = one-off copy of a file; **health sync (Apple Health/Health Connect)** = automatic two-way conveyor belt. Kept separate: one-off now, sync later.

## Decisions (owner answers)
| Topic | Decision |
|---|---|
| Deep links | **Add NONE now** (changed from my earlier "add contact?id"). Only add a route when a widget actually needs it — same "doors with no keys" rule as Episodes/Calendar. |
| Import v1 | **Build**: SHOS own export round-trip + Clue-format period CSV. On-device, preview before save, explicit UK `dd/mm` vs US `mm/dd` choice (never guess). I will generate realistic synthetic Clue-format sample data for tests (owner has none). |
| Doctor summary | **Extend Clinic Card** into a one-page export (periods/symptoms/tests). No new module. |
| LOINC / health sync | LOINC field **dropped**. Apple Health / Health Connect **deferred** until after beta. |
| UK / US | Agree: mark links as "UK guidance", generic label for NHS number ("NHS / record number"), no US clinical content this round; UK first. |
| Menopause storage | **My Profile** + NEVER_SHARED (partner sharing) + read-only view in Reproductive health. Include optional **hysterectomy / no-uterus** field, neutral and not tied to gender or stage — a trans man may have had a hysterectomy without being post-menopausal. It WILL appear in Clinic Card (clinician-facing), which is correct. |
| R3 demo restore | **Build next** — snapshot-on-clear + Restore in Home banner and Developer tools. |
| R9 period overlap | **Build** — opening a second period while one is ongoing opens the first record to enter its end date (no auto-close), with "I don't remember → estimate duration" escape and a plain explanation. |
| F4 cycle stats | **Build refined** — annotate averages for hormonal contraception, soften (not hide) "irregular" advisory, never label 2 cycles "irregular". |

## Build order agreed
1. R3 restore demo data (owner's #1 ask)
2. R9 period overlap flow
3. F4 cycle-stats context
4. Import v1 (own export + Clue CSV, synthetic test data)
5. Clinic Card doctor-summary extension
6. Menopause status (Profile + NEVER_SHARED + FSRH view + hysterectomy)
7. Deep links: none until a widget needs them

*No clinical advice. UK-first; US compatibility as agreed.*

## Built 17 Nov (after these decisions)
- **R3 demo restore — SHIPPED.** `repositories/demoRestore.js` snapshots the exact removable records before clear (`getRemovableSampleCollections` bridge in `clearSampleData.js`, same predicate as clear), stores under an encrypted key, and restores by **merge-by-id via replaceAll** (never `create()` — that regenerates ids and breaks referential links; never overwrites real records added since the clear). Snapshot cleared after a successful restore; kept on partial failure for retry. Restore UI added to Home banner and Developer tools. Verified end to end in the browser: clear → "Demo data was cleared" + Restore → records back and demo banner returned. 6 unit tests for the merge rule + snapshot helpers.
- **R6 widget framework** — note: W1 contact-widget brainstorm written (`WIDGET-BRAINSTORM.md`); the deep-link key itself deferred (no widget yet).
- **Contrast bug fixed (owner-reported):** "Remove these 96 records" was white-on-white. `ConfirmDeleteCard` relied on `T.actionRed`, absent from bare NEUTRAL/DARK themes. Now derives from shared `ACTION` / `ACTION_TEXT_SAFE` tokens. Verified live: button `rgb(197,38,38)` on white text. This reaches all ~15 delete confirmations.
- Verification: eslint clean, 33 targeted tests pass, `vite build` success, negative-status + encoding pass. Full `--fast` gate times out locally (unit tests ~790s); CI is the gate.
