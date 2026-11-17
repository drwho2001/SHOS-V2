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
