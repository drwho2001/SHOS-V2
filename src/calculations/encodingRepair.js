// encodingRepair.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Repairs mojibake (double-encoded text) in the OWNER'S OWN stored data.
// Added 25 Sep 2026 after the owner found corrupted characters in his
// real records, having already found the same corruption committed in
// CLAUDE.md and the Vaccinations module.
//
// WHY THIS IS A TARGETED MAP AND NOT A BYTE ROUND-TRIP
// -----------------------------------------------------
// The obvious "fix" is to run every string through a CP1252->UTF-8 decode.
// That is DANGEROUS here, and this file exists specifically to avoid it.
// A blanket round-trip decodes mojibake to *a* valid character, but not
// always the character that was originally meant, and it will happily
// mangle text that was never broken. Two real examples found while
// repairing this repo's own source, where the naive decode was WRONG:
//   * the anonymise mask U+00E2 U+20AC U+00A2 decodes to the euro sign,
//     but was actually the app's own bullet mask
//   * U+00E2 U+2030 U+00A5 decodes to a percent-ish char, but was ">="
// It would also destroy the characters the owner explicitly wants to
// KEEP: the multiplication sign, almost-equal-to, greater-or-equal, both
// arrow shapes, em dash, middle dot, bullet, degree, plus-minus,
// ellipsis, and every emoji in the seed data (which are legitimately
// stored as UTF-8 already).
//
// So instead: only the exact mojibake sequences are matched, and only
// those specific characters can ever be produced. The lead characters
// required by every pattern (U+00E2, U+00C2, U+00C3, U+00E3) never occur
// in any character the owner wants to keep, so those are structurally
// unreachable - the keep-list is not a filter that could be got wrong,
// it is a consequence of what the code is even capable of matching.
//
// Anything that LOOKS like corruption but is not in the map is REPORTED,
// never guessed at. Guessing at a real person's medical notes is not an
// acceptable failure mode.

// The verified repair table. Every entry was confirmed against real prose
// in this repo before being added - see CLAUDE.md's "Recently shipped"
// entry for 25 Sep 2026.
const C = (...cps) => String.fromCodePoint(...cps);

export const MOJIBAKE_MAP = [
  // lead sequence        -> intended character   where it was confirmed
  [C(0x00e2, 0x20ac, 0x201d), C(0x2014), "em dash (-)"],
  [C(0x00e2, 0x2020, 0x2019), C(0x2192), "rightwards arrow (->)"],
  [C(0x00e2, 0x2020, 0x201d), C(0x2194), "left-right arrow (<->)"],
  [C(0x00c3, 0x2014), C(0x00d7), "multiplication sign"],
  [C(0x00e2, 0x20ac, 0x00a2), C(0x2022), "bullet - NOT the euro sign"],
  [C(0x00c2, 0x00b7), C(0x00b7), "middle dot"],
  [C(0x00e2, 0x20ac, 0x201c), C(0x201c), "left double quote"],
  [C(0x00e2, 0x20ac, 0x00a6), C(0x2026), "horizontal ellipsis"],
  [C(0x00e2, 0x2030, 0x02c6), C(0x2248), "almost equal to"],
  [C(0x00c2, 0x00b0), C(0x00b0), "degree sign"],
  [C(0x00c2, 0x00b1), C(0x00b1), "plus-minus"],
  [C(0x00e2, 0x2030, 0x00a5), C(0x2265), "greater-than or equal"],
  // ADDED 26 Sep 2026 — two more, each confirmed against real surrounding
  // usage before being added rather than decoded blind, which is the rule
  // the module's own guard output insists on. Both were reintroduced by a
  // PowerShell read/write round-trip on a source file during the Healthcare
  // restructure, so they are a case that will genuinely recur here.
  //
  //   U+2500 (box drawing light horizontal) is UTF-8 E2 94 80; read as
  //   CP1252 that is "â" + curly-double-quote + euro, i.e. exactly the
  //   U+00E2 U+201D U+20AC seen in a `// ── Add/Edit sheet ──` divider.
  //   Confirmed by reading the line it appears on: a section comment, used
  //   as a horizontal rule and for nothing else in the codebase.
  [C(0x00e2, 0x201d, 0x20ac), C(0x2500), "box drawing light horizontal (section divider)"],
  //   U+2605 (black star) is UTF-8 E2 98 85; read as CP1252 that is
  //   "â" + tilde-above + ellipsis. Confirmed by the line it appears on:
  //   the "★" marking a symptom entry the user flagged as the reason for
  //   the visit, in JSX alongside `isPrimary`.
  [C(0x00e2, 0x02dc, 0x2026), C(0x2605), "black star (primary symptom marker)"],
];

// Characters that must survive untouched. Used only by the self-test /
// reporting to prove the repair cannot reach them - the map itself already
// guarantees it, since none of these can be produced by any pattern.
export const MUST_PRESERVE = [
  C(0x00d7), // multiplication
  C(0x2248), // almost equal
  C(0x2265), // >=
  C(0x2192), // ->
  C(0x2194), // <->
  C(0x2014), // em dash
  C(0x00b7), // middle dot
  C(0x2022), // bullet
  C(0x00b0), // degree
  C(0x00b1), // plus-minus
  C(0x2026), // ellipsis
  C(0x2019), // curly apostrophe
  C(0x1f600), // emoji
];

// Characters that can begin a mojibake sequence. Used to spot corruption
// the map does NOT recognise, so it gets reported instead of guessed at.
const LEAD_CHARS = [C(0x00e2), C(0x00c2), C(0x00c3), C(0x00e3)];

/**
 * Repair a single string.
 * @returns {{ text: string, changed: boolean, fixes: Array<{from:string,to:string,label:string}>, unknown: string[] }}
 */
export function repairString(input) {
  if (typeof input !== "string" || input.length === 0) {
    return { text: input, changed: false, fixes: [], unknown: [] };
  }
  let text = input;
  const fixes = [];
  for (const [find, repl, label] of MOJIBAKE_MAP) {
    if (!text.includes(find)) continue;
    const count = text.split(find).length - 1;
    text = text.split(find).join(repl);
    fixes.push({ from: find, to: repl, label, count });
  }
  // Report (never repair) any lead character still present afterwards.
  const unknown = [];
  for (let i = 0; i < text.length; i++) {
    if (LEAD_CHARS.includes(text[i])) {
      const frag = text.substr(i, 3);
      if (!unknown.includes(frag)) unknown.push(frag);
    }
  }
  return { text, changed: text !== input, fixes, unknown };
}

/**
 * Walk any JSON-ish value, repairing every string it contains.
 * @returns {{ value: any, changed: boolean, changes: Array<{path:string,from:string,to:string,label:string}>, unknown: Array<{path:string,frag:string}> }}
 */
export function repairDeep(value, path = "") {
  const changes = [];
  const unknown = [];

  const walk = (node, p) => {
    if (typeof node === "string") {
      const r = repairString(node);
      if (r.changed) {
        changes.push({ path: p, from: node, to: r.text, label: r.fixes.map((f) => f.label).join(", ") });
        return r.text;
      }
      for (const frag of r.unknown) unknown.push({ path: p, frag });
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((item, i) => walk(item, `${p}[${i}]`));
    }
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v, p ? `${p}.${k}` : k);
      return out;
    }
    return node;
  };

  const repaired = walk(value, path);
  return { value: repaired, changed: changes.length > 0, changes, unknown };
}
