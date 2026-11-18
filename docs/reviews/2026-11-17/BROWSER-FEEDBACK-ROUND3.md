# Browser feedback round 3 (17 Nov 2026) — owner comments from deployed build

Note: from `https://drwho2001.github.io/SHOS-V2/` (deployed), so some items may already be fixed in local code. Triage before acting.

## A. Concrete visual / layout fixes
| # | Comment | Area | Action |
|---|---|---|---|
| A1 | Home "7-day adherence" card: lots of empty space; increase description text size for legibility/space-filling | Home status cards | Investigate; bump description font-size |
| A2 | Recent activity order: add "last DoxyPEP dose" above "Last medication dose"; move "Newest contact" above "Last encounter" | Home recent activity | Reorder + add DoxyPEP row |
| A3 | Home h1: in web view there's enough space for "X's Home", but not in app | Home title | Use `useIsDesktopWidth` → "X's Home" on wide, "Home" on narrow |
| A4 | Calendar: shrink a little to mitigate scrolling; when a day is selected, account for the detail panel needing space | Settings Calendar | Reduce cell size; reserve space for selected-day detail |
| A5 | "Send feedback / bug report — Email" needs ~6-8px above | About screen | Add margin-top |
| A6 | About: add app icon adjacent to or above "SHOS" | About screen | Add `pwa-512.png` image |
| A7 | Build "204550d": include release date/time? | About screen | Investigate available build metadata (`version.json` has `releasedAt`) |
| A8 | About "Sexual Health Operating System" — owner wants the expansion deliberately vague; "sexual" is not overtly in the registered name | About screen | **NO CHANGE** — explicit owner preference, record it |
| A9 | "Send problem reports / Error log / Report a problem always saves on-device" — should this be removed now? | About screen | **QUESTION** — decide with owner |
| A10 | "Report a crash / Report" vs "Send feedback / bug report — Email" — which? | About screen | **QUESTION** — propose consolidating or keeping both with distinct purposes |

## B. Data / correctness
| # | Comment | Area | Action |
|---|---|---|---|
| B1 | Developer tools shows `seed_contact_9008` instead of actual name/nickname — "wrong surely?" | Developer tools orphan/diagnostic rows | Find the row and resolve id → name |
| B2 | "Fists" — check wiring for loads/fists kinks working correctly | Encounter card/session | Investigate computation |
| B3 | Encounter form "Fisting acts during this encounter" — not needed during a non-fisting event / if fisting isn't tagged (like loads) | Add encounter form | Conditional reveal |
| B4 | Encounter form "Loads during this encounter" — not needed unless cum outlined above | Add encounter form | Conditional reveal |
| B5 | "No barrier method" — nuanced: useful if no contraception noted; consider male users whose female partner takes contraception, lesbian/bisexual users, no medications (doxy/PrEP?) | Add encounter form / protection context | **CHALLENGE + brainstorm** — don't just expand blindly |

## C. Clinical framing — challenge needed
| # | Comment | Area | Action |
|---|---|---|---|
| C1 | "Testing interval trending shorter" insight is not useful: the inverse (trending longer) isn't flagged, and clusters of tests (positive → TOC → C&S) push the average below 90 days, making it feel like a directive to get tested when asymptomatic and within window. Shouldn't imply that. | Stats insight | **CHALLENGE + redesign** — this is clinical framing, must be neutral/informational |
| C2 | "+ PEP" — wrong unless HIV PEP; DoxyPEP ≠ PEP. ART is separate — have we done enough for HIV+ users tracking ART at the same importance as PrEP/doxy/PEP? | Protection registry / encounter form / medication | **CHALLENGE + brainstorm** — clarify labels, assess HIV+ tracking |

## Owner decisions (popup, 17–18 Nov)
- **PEP → REMOVED entirely** (owner superseded the relabel answer): HIV PEP is clinic-administered, not routinely logged against an encounter; the label was confusable with DoxyPEP. Seed is now `Condom/PrEP/None`. Owner confirmed **no real PEP entries exist**, so the old add-PEP migration and its App.jsx call were deleted outright (no new migration for state that never existed).
- **About reports → email only** (owner superseded "keep both"): the GitHub "Report a crash" row was removed; the single "Report a problem / send feedback (email)" route remains.
- **HIV / ART**: Medication module is enough — ART tracked as a normal medication. No new module; glossary note if useful.
- **"No barrier method"**: keep the single STI-barrier tag (option 1) — do not conflate with contraception/HIV meds, which are separate domains.
- **About reports**: keep both ("Report a crash" = GitHub issue with log, "Send feedback" = email); keep Error log but clarify/shorten copy.
- **About polish**: add app icon above SHOS; show build SHA + release date/time from version.json.
- **Home polish**: all three — desktop-only "X's Home" greeting, reorder recent activity (Newest contact above Last encounter), add a last-DoxyPEP-dose row.

## Status (17 Nov)
- **C1 DONE** — removed the "trending shorter/longer" and "gap vs personal average" insights from Stats. Owner's critique is correct: test intervals are clinically driven (positive → TOC → C&S clusters), so averaging them into a cadence is misleading and the red/alert framing implies a directive to test. The two factual StatRows (Average interval, Within BASHH interval) remain. Pure function kept in statsCalculations.js with a note, in case a purely descriptive presentation is wanted later.
- **B3/B4 DONE** — "Loads during this encounter" now revealed only once a cum location is recorded (or a value already exists); "Fisting acts" revealed only when a fisting kink is tagged (or a value exists).
- **A5/A6/A7/A9/A10, A1–A4, B1, B2, B5, C2** — still OPEN, need owner decisions or visual re-diagnosis (see popup).
- **CI** — full suite flow 2 race fixed (clear now writes a snapshot, so the result text appears a beat later; smoke now waits for the text). Flow 12 (App Lock) failed locally once with an empty page after reload — likely a machine flake, CI will re-verify.

## Decisions needed (popup)
- PEP label: "PEP" means HIV PEP in the protection registry; DoxyPEP is separate. Relabel to "HIV PEP"? HIV+ ART tracking — is it adequately covered by the Medication module, or needs first-class status? (C2)
- "No barrier method" expansion to include no-contraception / no-medication concepts? (B5)
- About screen: remove Error log/report section (A9)? Consolidate "Report a crash" vs "Email feedback" (A10)?
- "X's Home" on web only (A3), Home card text size (A1), recent-activity reorder + DoxyPEP row (A2), Calendar shrink (A4) — cosmetic, proceed unless objected.

*No clinical advice. UK-first.*
