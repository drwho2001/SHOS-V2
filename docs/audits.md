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