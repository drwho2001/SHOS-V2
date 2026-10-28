# Audits — SHOS-V2

Consolidated audit findings. Each entry: scope, finding, action/pool task.

## Touch targets
- Scope: all modules + App.jsx + settings.
- Finding: interactive icons <20px across 12 modules, App.jsx, settings.
- Action: enlarged to 20px + padding. Shipped ff37902, 963ecae, fc75a12, 2f7eb4e. Settings still has ~100 cursor:pointer sites without minHeight:44 (t184).

## Icon-only UI
- Scope: all src.
- Finding: only 2 icon-only elements (Contacts Star, Warning) with reasoned verdicts.
- Action: gated by iconOnlyUIAudit.test.js; no changes needed.

## Escape-to-close
- Scope: 21 modules.
- Finding: only Home/Healthcare lack useEscapeToClose; neither has role=dialog overlays. No gaps.

## Backup coverage
- Scope: 29 data repositories.
- Finding: all wired in backupService; only clearSampleData/resetAllData (utilities) absent. No gaps.

## Widget default redaction
- Scope: widgetPrivacy.js.
- Finding: defaults redacted, allowlists fail-closed. No code changes.

## Meta
- All findings also logged in session bus (notices #511-#538).

## Escape-to-close (settings)
- Scope: 20 settings screens with role=dialog.
- Finding: none use useEscapeToClose.
- Action: extracted to pool (t185).
## Touch targets (settings)
- Scope: settings screens.
- Finding: ~100 cursor:pointer sites without minHeight:44.
- Action: extracted to pool (t186).
## Dark-mode accent resolution
- Scope: modules.
- Finding: Home active-session border uses ACCENTS.encounters in dark mode without resolveDarkAccent.
- Action: extracted to pool (t187).
## Modal overlays (role=dialog)
- Scope: modules.
- Finding: many fixed overlays lack role=dialog (e.g., Medication 14 fixed/8 dialog, Contacts 9/3). Not all fixed overlays are modals; needs manual review.
- Action: extracted to pool (t192 finding).
## ARIA labels (settings)
- Scope: settings screens.
- Finding: role=button elements without aria-label all have visible text. No gaps.
## Quick audits (batch)
- Dark-mode accent: only Home active-session border uses ACCENTS.encounters without resolveDarkAccent (line 958). Action: t187.
- Modal overlays: many fixed overlays lack role=dialog (Medication 14/8, Contacts 9/3). Needs manual review. Action: t192 finding.
- Escape-to-close: modules complete (only Home/Healthcare lack, no dialogs); settings 20 screens with dialogs lack it. Action: t185.
- ARIA labels: settings role=button elements without aria-label all have visible text. No gaps.
## Medium audits
- Orphan reference coverage: 17/17 pass.
- Backup preference/migrations/seed-import: 36/36 pass.
- Icon-only UI audit: 5/5 pass.
## Large audits
- Widget privacy: 22/22 pass.
- Seed id collision/routing: 57/57 pass.
- Disclosure copy guard: 9/9 pass.
- Widget visibility restored: 9/9 pass.
## Large audits (remaining)
- i18n: Settings module has 0 t()/tr() calls; adoption uneven. Action: t193.
- Smoke test: 32 flows; CRUD gaps for encounter, testing, clinic visit, medication. Action: t194.
- Native/device validation: requires CI build-apk + real device; not runnable locally.
- Accessibility contrast/live regions: manual audit pending.
## Remaining audits
- Accessibility contrast/live regions: manual audit pending. Action: t195.
- Native/device validation: CI build-apk + real device. Action: t196.
## Manual audits (28 Oct 2026)
- Bubble/chip height regression: fixed (removed accidental minHeight:44 from chips/bubbles, t197).
- PrEP coverage calculation: fixed (encounter form passed DoxyPEP logs where PrEP logs were meant; brand/genus detection widened). Recheck on device with Descovy/Truvada (t199, t205).
- Streak spacing regression: fixed. Root cause was minHeight:44 on the 11px AdherencePill info icon, which stretched the streak row; tap target is now padding:16/margin:-16 with the row height unchanged (t200, t206).
- Session workflow: attendee list now stores on the Session and per-activity role cards split Top/Bottom for fisting; still needs a manual pass (t201-t204, t207, t208).
- Live Session widget: manual device test required (t174).
- Vaccine smoke flow: retired from CI; manual check required (t173).
