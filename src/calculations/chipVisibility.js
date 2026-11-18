// chipVisibility.js — one rule for long chip/tag rows across the app.
// Selected chips always stay visible (so a user's choices never disappear);
// the remaining options are capped and the rest sit behind a "more" chip.
// Pure so every module's chip row behaves the same way.
export function collapseChips(options, selected = [], maxVisible = 8, showAll = false, valueOf = (o) => o) {
  // selected holds plain strings in every app caller; tolerate an object too.
  const chosen = new Set(selected.map((v) => (v && typeof v === "object" ? valueOf(v) : v)));
  const picked = (options || []).filter((o) => chosen.has(valueOf(o)));
  const rest = (options || []).filter((o) => !chosen.has(valueOf(o)));
  const budget = Math.max(0, maxVisible - picked.length);
  const shownRest = showAll ? rest : rest.slice(0, budget);
  return {
    shown: [...picked, ...shownRest],
    hiddenCount: rest.length - shownRest.length,
  };
}
