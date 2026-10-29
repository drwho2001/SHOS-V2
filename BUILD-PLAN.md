# Build Plan — SHOS-V2

## Pre-build
1. Set NODE_OPTIONS=--max-old-space-size=4096
2. Ensure clean working tree (commit or stash uncommitted)
3. Run lint: npx eslint .

## Build
4. npm run build (Vite) — expected ~1 min 6s
5. Verify dist/ output exists

## Test
6. npm run test — expected ~11 min (1957+ tests)
7. Verify 0 failures

## Deploy
8. Capacitor sync: npx cap sync android
9. Build APK: gradle assembleRelease
10. Upload to GitHub releases

## CI
11. GitHub Actions: build-apk.yml, web-alpha.yml
12. Docs gate: touch CLAUDE.md or docs/ on src changes

## Memory/timeout
- Build: 4GB RAM, 2 min timeout
- Tests: 4GB RAM, 15 min timeout
- Use NODE_OPTIONS=--max-old-space-size=4096

## Verified
- Build: PASS (1m 6s)
- Tests: PASS (1957 passed, 1 skipped)
- Lint: no errors
