# Remaining work plan (weekend-ready follow-up)

## 1. Quick-exit on Testing & Encounters (no header rows)
- Testing: add a small header bar with SignOut icon (encounters/home color) at top of module root.
- Encounters: add header to screenContent wrapper with SignOut.
- Mitigation: minimal change, mirror Contacts/Medication pattern.

## 2. Settings i18n audit (DesignScreen, StatsScreen)
- DesignScreen: add useTranslation, convert all user-facing strings to t("design.xxx", "default").
- StatsScreen: same.
- Add keys to src/i18n/en.json.
- Mitigation: do screen-by-screen, commit each.

## 3. Contrast audit (designTokens.js)
- Check NEUTRAL.textSecondary (#5B5B62) on NEUTRAL.bg for 4.5:1.
- Check DARK.textSecondary (#B8B8BE) on DARK.bg.
- Fix any failing tokens.

## 4. Reduced motion (low priority)
- Audit animated components for useReducedMotion; disable transitions when true.
- Already done in Home StatusRing.

## Order of execution
1. Quick-exit Testing/Encounters (small, high value)
2. DesignScreen i18n
3. StatsScreen i18n
4. Contrast audit
5. Reduced motion
Each committed separately to keep CI green.
