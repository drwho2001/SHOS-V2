// loadedRepositoryState.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real groundwork for encryption at rest (see CLAUDE.md's Known Issues
// / the Notion Development log for the full plan). storage.load() —
// behind every Repository.getX() call in this app — is slated to
// become async once real encryption lands, because the Web Crypto API
// (crypto.subtle, the same one backupService.js already uses for
// encrypted backup export) has no synchronous form. A `useState` lazy
// initializer or `useMemo` can't await a Promise — both run
// synchronously by React's own contract.
//
// The 4 Sep audit found this exact conflict at roughly 100 real call
// sites across ~20 module files — `useState(() => Repo.getX())` and
// `useMemo(() => Repo.getX(), deps)`, repeated throughout the app for
// nearly every repository. clinicCardVisibilityPreference.js already
// proved the fix (a mount-time `useEffect` instead of a lazy
// initializer) at one real site; these two hooks generalize that same
// fix into a shared, reusable primitive instead of hand-writing a
// bespoke effect at each of the ~100 sites — safer (one correct
// implementation, not ~100 similar-but-manually-typed ones) and the
// mechanical swap this many sites needs: `useState(() => X)` becomes
// `useLoadedState(() => X, deps, fallback)`, `useMemo(() => X, deps)`
// becomes `useLoadedMemo(() => X, deps, fallback)` — same shape, same
// call-site ergonomics, no other code change required at the site
// itself.
//
// Deliberately NOT touching storageAdapter.js or any repository here —
// storage.load()/save() are still synchronous today. This only fixes
// the specific structural conflict (a synchronous-only React contract
// depending on a value that will eventually need to be awaited); the
// real async conversion of storageAdapter itself is later work.
import { useState, useEffect } from "react";

// Mirrors useState's own [value, setValue] tuple exactly, so a call
// site keeps working unchanged even where it later calls the setter
// directly (e.g. `setPrefs(updated)` after a save) — only the initial
// load moves from a synchronous lazy initializer to a mount/deps-time
// effect. `fallback` is shown for the one render before the effect
// resolves, same brief loading moment already proven safe on Clinic
// Card's own visibility toggles.
export function useLoadedState(loader, deps, fallback) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    // CHANGED — real groundwork step: awaiting loader()'s result (rather
    // than assigning it directly) is a no-op for every call site today,
    // since every repository is still 100% synchronous — `await` on a
    // plain value just resolves immediately. This is what actually lets
    // a repository's methods start returning real Promises later,
    // repository-by-repository, with zero further change needed at any
    // of this hook's ~100 call sites. `cancelled` guards against setting
    // state after this effect's own cleanup (deps changed, or unmount)
    // — harmless today (nothing is ever actually async yet), becomes a
    // real guard once a loader can take real time to resolve.
    let cancelled = false;
    (async () => {
      const result = await loader();
      if (!cancelled) setValue(result);
    })();
    return () => { cancelled = true; };
    // deps is caller-supplied and intentionally the only real
    // dependency — loader is a fresh closure every render by design,
    // matching how the useMemo/useState call sites this replaces
    // already worked (their own deps arrays never included the
    // function either).
  }, deps);
  return [value, setValue];
}

// Mirrors useMemo's own return-value-only shape for the read-only/
// derived case — no setter, recomputes whenever `deps` changes.
export function useLoadedMemo(loader, deps, fallback) {
  const [value] = useLoadedState(loader, deps, fallback);
  return value;
}
