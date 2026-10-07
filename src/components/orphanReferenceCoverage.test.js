// ADDED 6 Oct 2026 (session B) - the guard for the guard.
//
// WHY THIS FILE EXISTS. `orphanReferenceCheck.js` is the app's ONLY
// data-integrity scanner, and Developer Tools renders its result as a
// confident "None found". That claim was FALSE, measured by enumerating
// every id-bearing field in every repository's DEFAULT_* literal and
// comparing: three live reference fields were checked by nothing.
//
// `linkedContactIds` and `relationshipContactIds` had been live for
// months. `routineRetestSourceTestId` had been live since the previous
// day - it shipped with the routine-retest feature (t072) and the one
// piece of code whose entire job is noticing newly added fields did not
// notice it. That is the same failure as t070 six days earlier, where
// the seed-snapshot regenerator read 11 of 14 repositories because its
// own list was hand-maintained, in a sibling hand-maintained list, in the
// same week.
//
// A guard that only asserts the CURRENT state is worth nothing here: the
// next field added tomorrow would pass it silently. This one asserts the
// RELATIONSHIP between the schema and the checker, so the next field
// fails it.
//
// WHY IT IS AN AST SWEEP AND NOT A REGEX. This repo has damaged itself
// with regex-over-source four times: truncating `aria-label` closing
// braces, mangling smoke-test flow labels, matching prose in comments
// when checking for an import, and - during the writing of this very
// change - matching a COMMENT describing a field that had been
// restructured three weeks earlier, which produced two of the three
// "missing fields" I first reported to the owner. `medicationsPrescribedIds`
// and `restockMedicationIds` were real fields once; they were merged into
// `takeHomeMedications` on 26 Sep, and the only place their old names still
// appear is the comment explaining the merge. A regex cannot tell a key
// from a comment quoting it. This parses and looks at real
// ObjectProperty nodes inside real object literals.
//
// WHY IT ASSERTS BOTH DIRECTIONS. A schema-only sweep would be vacuous
// for a whole class of fields. `takeHomeMedications` is declared as `[]` -
// its `{ medicationId, unit, quantity }` shape exists only at runtime, once
// a user adds an entry. No enumeration of DEFAULT_* literals can see that a
// reference lives inside it, so a schema-only guard scores this file
// complete while a genuinely dangling medication reference goes unreported.
// Asserting checker -> schema as well catches the opposite failure (a check
// pointing at a field that was deleted, which `checkArray`'s `ids || []`
// tolerates silently - this file already had one such dead check, removed
// 26 Sep, and its own comment says so).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const SRC = path.resolve("src");
const REPO_DIR = path.join(SRC, "repositories");
const CHECKER = path.join(SRC, "calculations", "orphanReferenceCheck.js");

// ADDED 6 Oct 2026 - explicit timeout for this guard, same reason and
// same measured justification as jsxCommentGuard.test.js: this is a real
// AST sweep over every repository on every run, and vitest's 5s default is
// not a budget for that work. A guard that times out reports a failure of
// an assertion it was never evaluating.
const AST_SWEEP_TIMEOUT_MS = 30000;

// Reference fields deliberately NOT checked, each with the reason it is
// not an integrity problem. A new entry without a reason fails the test
// below - an exemption list that grows silently is how a "scan every
// possible referencer" quietly stops doing that.
const EXEMPT = {
  // Both live only on records written by builds that predate the current
  // schema. Nothing writes them any more and nothing reads them; they are
  // retained purely so an old record's shape is not silently reshaped on
  // read. Flagging them would report a problem about a field the app
  // deliberately no longer keeps in sync.
  relatedSymptomIds: "Testing - deprecated field, kept only so old records round-trip; nothing writes or reads it.",
  symptomId: "Symptom Log - singular legacy shape, folded into symptomIds on read; nothing writes it.",
  // Lives on Partner Notification's per-item objects rather than on the
  // list itself, so it never appears in a DEFAULT_* literal. The checker
  // covers it explicitly as `items[N].contactId`; listed here so the
  // schema-side sweep does not read its absence as a gap.
  contactId: "Partner Notification - lives on each list item, not on the list record; checked as items[N].contactId.",
  // Found by this guard on its own first run, and a genuine property of
  // this codebase rather than a defect. `DEFAULT_LOG_ENTRY` declares only
  // reason/sideEffects/notes; every dose or refill log carries a
  // medicationId but it is never declared as a default, because defensive-
  // default merge on read means a record without one simply yields
  // undefined and checkSingle correctly skips a falsy id. So the check is
  // live and correct, and only the declared-default sweep cannot see the
  // field.
  //
  // This is the honest ceiling on what a DEFAULT_* sweep can prove, and it
  // is why the reason is written down rather than the assertion loosened:
  // declared defaults are NOT a complete schema in this repo. A repository
  // may declare a partial default on purpose. What this guard proves is
  // that nothing DECLARED goes unchecked, which is the gap that actually
  // existed; it cannot prove the absence of undeclared fields, and does not
  // claim to.
  medicationId: "Medication log - real on every log entry but deliberately absent from DEFAULT_LOG_ENTRY, which declares only three fields and relies on defensive-default merge.",
};

// Lower bounds on how much each sweep must find. Without these, a sweep
// that silently found nothing (a renamed directory, a parser option that
// stopped matching) would report every field as covered and pass. Measured
// at the time of writing: 26 schema id-keys, 24 checked fields.
const MIN_SCHEMA_ID_FIELDS = 20;
const MIN_CHECKED_FIELDS = 20;

function repositoryFiles() {
  return fs
    .readdirSync(REPO_DIR)
    .filter((f) => f.endsWith(".js") && !f.includes(".test."))
    .map((f) => path.join(REPO_DIR, f));
}

// Every key of every DEFAULT_* object literal, at any nesting depth, with
// a flag for whether it looks like a foreign key by name.
function collectSchemaFields() {
  const idKeys = new Map();   // name -> Set(repository file)
  const allKeys = new Map();  // name -> Set(repository file)
  for (const file of repositoryFiles()) {
    const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", errorRecovery: true });
    const repoName = path.basename(file);

    const recordObject = (obj) => {
      for (const prop of obj.properties || []) {
        if (prop.type !== "ObjectProperty" && prop.type !== "ObjectMethod") continue;
        const key = prop.key?.name || (prop.key?.value != null ? String(prop.key.value) : "");
        if (!key) continue;
        // A record's own `id` is its primary key, not a reference to
        // another record. Counting it would make the guard look like it
        // had covered something it never checked.
        const isReference = /Id(s)?$/.test(key) && key !== "id";
        for (const target of isReference ? [idKeys, allKeys] : [allKeys]) {
          if (!target.has(key)) target.set(key, new Set());
          target.get(key).add(repoName);
        }
        if (prop.value?.type === "ObjectExpression") recordObject(prop.value);
        if (prop.value?.type === "ArrayExpression") {
          for (const el of prop.value.elements || []) if (el?.type === "ObjectExpression") recordObject(el);
        }
      }
    };

    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "VariableDeclarator" && /^DEFAULT_/.test(node.id?.name || "") && node.init?.type === "ObjectExpression") {
        recordObject(node.init);
      }
      for (const k of Object.keys(node)) {
        if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
        const v = node[k];
        if (Array.isArray(v)) v.forEach((c) => walk(c));
        else if (v && typeof v === "object") walk(v);
      }
    };
    walk(ast.program);
  }
  return { idKeys, allKeys };
}

// The `field:` names the checker actually reports, read out of real
// ObjectProperty nodes rather than a regex over the file, for the same
// reason the schema side is parsed: a field name quoted in a comment (this
// file's own header quotes several) must not be mistaken for a live check.
//
// MUTATION TESTING CAUGHT A REAL DEFECT IN AN EARLIER VERSION OF THIS,
// and the reason is worth keeping. The first version collected any
// ObjectProperty whose key was `field` and took its string value - which
// only proves a LABEL exists. Replacing the checked expression with `null`
// while leaving `field: "routineRetestSourceTestId"` in place left the
// suite GREEN, because the label was all it looked at. That is this repo's
// recorded "a guard that only inspects one end of a wire proves nothing"
// failure: it read the name a check CLAIMS to check, not the field it
// actually READS.
//
// So a field counts as checked only when the ctx object that reports it
// also mentions that name somewhere else - i.e. the expression really does
// read it. Both halves must come from the same ObjectExpression, or a
// check could satisfy the label by borrowing another object's expression.
function collectCheckedFields() {
  const ast = parse(fs.readFileSync(CHECKER, "utf8"), { sourceType: "module", errorRecovery: true });
  const fields = new Set();
  const namesInside = (node) => {
    const found = new Set();
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (n.type === "Identifier") found.add(n.name);
      if (n.type === "MemberExpression" && !n.computed && n.property?.type === "Identifier") found.add(n.property.name);
      for (const k of Object.keys(n)) {
        if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
        const c = n[k];
        if (Array.isArray(c)) c.forEach(walk);
        else if (c && typeof c === "object") walk(c);
      }
    };
    walk(node);
    return found;
  };
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    // The shape is `checkArray(results, exists, e.attendeeIds, { ...ctx, field: "attendeeIds" })`
    // - the expression actually READ is a sibling ARGUMENT of the ctx object,
    // not a property inside it, so the whole call has to be inspected. An
    // earlier version looked inside the object literal and therefore found
    // nothing at all.
    if (node.type === "CallExpression") {
      const ctxObj = (node.arguments || []).find(
        (a) => a?.type === "ObjectExpression" &&
          (a.properties || []).some((p) => p.type === "ObjectProperty" && p.key?.name === "field" &&
            (p.value?.type === "StringLiteral" || p.value?.type === "TemplateLiteral")),
      );
      if (ctxObj) {
        const fieldProp = ctxObj.properties.find(
          (p) => p.type === "ObjectProperty" && p.key?.name === "field",
        );
        const raw = fieldProp.value.type === "StringLiteral"
          ? fieldProp.value.value
          : fieldProp.value.quasis?.[0]?.value?.cooked;
        if (raw) {
          // `items[0].contactId` interpolates its index; the stable part is
          // the field, and it is the stable part the expression also reads.
          const stable = String(raw).replace(/^items\[\d+\]\./, "");
          if (namesInside(node).has(stable)) fields.add(String(raw));
        }
      }
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      const c = node[k];
      if (Array.isArray(c)) c.forEach(walk);
      else if (c && typeof c === "object") walk(c);
    }
  };
  walk(ast.program);
  return fields;
}

// referenceRepair.js's ENTRY_ID_KEYS map - the fields whose ENTRIES are
// objects carrying a foreign key. Read out of real ObjectProperty nodes for
// the same reason as everything else here: the file's own header quotes
// several of these field names, and a regex would read a comment as a
// declaration.
const REPAIR = path.join(SRC, "calculations", "referenceRepair.js");
const OPTION_USAGE = path.join(SRC, "calculations", "optionListUsage.js");
const REGISTRY_USAGE = path.join(SRC, "calculations", "registryUsage.js");
// The `recordType:` and `targetType:` string literals the checker actually
// reports, read off real ObjectProperty nodes.
//
// WHY THIS MATTERS, and why the repair module's graceful fallback made it
// necessary. `referenceRepair.describeRepair` answers an unknown type with
// `canRepair: false` and a human-readable reason instead of throwing. That is
// correct runtime design and it is exactly why the gap was invisible: a new
// collection's dangling references would be DETECTED by this file's other
// assertions and silently UNREPAIRABLE by the fix, with the only evidence a
// sentence of prose in a screen the user may never open. A guard is the only
// thing that turns that into a test failure.
function collectCheckerTypes(propName) {
  const ast = parse(fs.readFileSync(CHECKER_FILE, "utf8"), { sourceType: "module", errorRecovery: true });
  const found = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "ObjectProperty" && node.key?.name === propName && node.value?.type === "StringLiteral") {
      found.add(node.value.value);
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      const c = node[k];
      if (Array.isArray(c)) c.forEach(walk);
      else if (c && typeof c === "object") walk(c);
    }
  };
  walk(ast.program);
  return found;
}

// Keys of RECORD_REPOSITORIES / TARGET_SOURCES in referenceRepair.js. Both are
// plain object literals, so objectKeys() reads them directly.
function repairKeys(varName) {
  return new Set(objectKeys(REPAIR, varName));
}

// Types deliberately not repairable in place, each with the reason. An entry
// without a reason fails the assertion below.
const REPAIR_EXEMPT = {
  // This one lives inside a notification checklist ITEM rather than on the list
  // itself, so clearing it means removing or editing an item - a different
  // operation with different consequences - and referenceRepair declines rather
  // than guessing. describeRepair says the same thing in prose; this makes it a
  // test failure if someone deletes the explanation without replacing it.
  "Partner Notification": "its dangling contactId lives inside a checklist item, so it is cleared by editing that list directly.",
};
const OPTION_LISTS_REPO = path.join(SRC, "repositories", "customOptionListsRepository.js");
const CHECKER_FILE = CHECKER;

// The `computeUsage:` bindings in Manage lists' own registry table, as
// [rowKey, functionSuffixName] pairs.
//
// Read from the BINDING and not from any mention, which is a correction: a
// first version matched `compute\w+Usage` anywhere in the file and so counted
// the import statement. That passed with a registry row bound to `null`,
// because the name was still imported - and this repo's rule is that a guard
// matching one end of a wire proves nothing about the other end. A function
// that is imported but never bound is exactly the state this guard exists to
// catch, so it has to look at the binding.
function manageListBindings() {
  const src = fs.readFileSync(path.join(SRC, "modules", "settings", "ManageListsScreen.jsx"), "utf8");
  const out = [];
  for (const line of src.split(/\r?\n/)) {
    const key = /key:\s*"([^"]+)"/.exec(line);
    const usage = /computeUsage:\s*compute([A-Za-z]+)Usage/.exec(line);
    if (key && usage) out.push([key[1], usage[1]]);
  }
  return out;
}

// Keys of a top-level object literal, read out of real ObjectProperty nodes.
function objectKeys(file, varName) {
  const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", errorRecovery: true });
  let keys = null;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclarator" && node.id?.name === varName && node.init?.type === "ObjectExpression") {
      keys = (node.init.properties || [])
        .filter((p) => p.type === "ObjectProperty")
        .map((p) => p.key?.name ?? String(p.key?.value));
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      const c = node[k];
      if (Array.isArray(c)) c.forEach(walk);
      else if (c && typeof c === "object") walk(c);
    }
  };
  walk(ast.program);
  return keys;
}

// Exported function names in a module, read off real ExportNamedDeclaration
// nodes so a name mentioned only in this file's own prose never counts.
//
// Note the node type: `export const X` parses as an ExportNamedDeclaration
// whose `declaration` is a VariableDeclaration CONTAINING declarators, not a
// VariableDeclarator. A collector that checks for VariableDeclarator there
// matches nothing and reports zero, which is how the sibling guard in
// sampleDataRepositoryCoverage.test.js found 0 exporters on its first run.
function exportedFunctions(file) {
  const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", errorRecovery: true });
  const names = [];
  for (const node of ast.program.body) {
    if (node.type !== "ExportNamedDeclaration" || !node.declaration) continue;
    const d = node.declaration;
    if (d.type === "FunctionDeclaration" && d.id?.name) names.push(d.id.name);
  }
  return names;
}

function collectEntryIdKeys() {
  const ast = parse(fs.readFileSync(REPAIR, "utf8"), { sourceType: "module", errorRecovery: true });
  const declared = new Map();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclarator" && node.id?.name === "ENTRY_ID_KEYS" && node.init?.type === "ObjectExpression") {
      for (const prop of node.init.properties || []) {
        if (prop.type !== "ObjectProperty") continue;
        const key = prop.key?.name || String(prop.key?.value ?? "");
        const value = prop.value?.type === "StringLiteral" ? prop.value.value : null;
        if (key && value) declared.set(key, value);
      }
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      const c = node[k];
      if (Array.isArray(c)) c.forEach(walk);
      else if (c && typeof c === "object") walk(c);
    }
  };
  walk(ast.program);
  return declared;
}

describe("orphanReferenceCheck coverage", () => {  it("finds the schema and the checker, so an empty sweep cannot pass as complete", () => {
    const { idKeys } = collectSchemaFields();
    const checked = collectCheckedFields();
    expect(idKeys.size).toBeGreaterThanOrEqual(MIN_SCHEMA_ID_FIELDS);
    expect(checked.size).toBeGreaterThanOrEqual(MIN_CHECKED_FIELDS);
  }, AST_SWEEP_TIMEOUT_MS);

  it("checks every foreign-key field the repositories declare", () => {
    const { idKeys } = collectSchemaFields();
    const checked = collectCheckedFields();
    const uncovered = [];
    for (const [field, repos] of [...idKeys].sort()) {
      if (checked.has(field)) continue;
      if (EXEMPT[field]) continue;
      uncovered.push(`${field} (${[...repos].join(", ")})`);
    }
    expect(
      uncovered,
      "these are live relation-by-id fields nothing checks, so Developer Tools' \"None found\" is not trustworthy",
    ).toEqual([]);
  }, AST_SWEEP_TIMEOUT_MS);

  it("gives every exemption a written reason", () => {
    for (const [field, reason] of Object.entries(EXEMPT)) {
      expect(typeof reason, `${field} needs a reason`).toBe("string");
      expect(reason.trim().length, `${field}'s reason must not be empty`).toBeGreaterThan(20);
    }
  });

  // The reverse direction. Without it, a field could be deleted from a
  // repository and left in the checker, where checkArray's `ids || []`
  // means the check silently stops checking anything rather than failing.
  it("only checks fields that still exist somewhere in the schema", () => {
    const { idKeys, allKeys } = collectSchemaFields();
    const checked = collectCheckedFields();
    const dead = [];
    for (const field of checked) {
      // `items[0].contactId` is reported with its array index interpolated;
      // the stable part is what has to exist.
      const stable = field.replace(/^items\[\d+\]\./, "");
      if (allKeys.has(stable)) continue;
      if (idKeys.has(stable)) continue;
      // An exempted field is exempt for exactly this reason - the schema
      // sweep cannot see it - so consulting the map here is not a loophole.
      // It stays a loophole if an entry is added whose reason does not
      // actually explain the invisibility, which is why each reason is
      // asserted to be substantive rather than merely present.
      if (EXEMPT[stable]) continue;
      dead.push(field);
    }
    expect(
      dead,
      "checkArray tolerates a missing field via `ids || []`, so a check pointing at a deleted field silently stops checking anything",
    ).toEqual([]);
  }, AST_SWEEP_TIMEOUT_MS);

  it("still covers the four gaps this guard was written for", () => {
    const { idKeys } = collectSchemaFields();
    const checked = collectCheckedFields();
    // These are the fields that were live and unchecked when this guard
    // was written, so a future refactor that dropped them from BOTH the
    // repository and the checker would otherwise look like a cleanup
    // rather than a silent loss of coverage.
    for (const field of ["linkedContactIds", "relationshipContactIds", "routineRetestSourceTestId"]) {
      expect(idKeys.has(field), `${field} should still exist in the schema`).toBe(true);
      expect(checked.has(field), `${field} should be checked`).toBe(true);
    }
    // The fourth is invisible to any DEFAULT_* scan by construction - its
    // declared default is an empty array, so the id it holds only exists
    // at runtime. Asserting it here is the only reason the "store raw,
    // index canonical" style shape cannot be dropped silently either.
    expect(checked.has("takeHomeMedications")).toBe(true);
  });

  // The third hand-maintained inventory, checked against the first two.
  // `referenceRepair.js` decides how to fix each dangling field, and it
  // decides by DERIVING the field's shape from the repository's own
  // declared default - except for the fields whose entries are objects,
  // which it has to state by hand because an empty default cannot say what
  // key sits inside an entry. That hand-stated list is exactly the kind of
  // thing that drifts, so it is asserted here.
  it("states an entry-id key for every field whose entries are objects", () => {
    const declared = collectEntryIdKeys();
    // Every kink-selection shape and the medication list must be here, and
    // the sweep must actually have found them - a sweep that found nothing
    // would pass the comparison below for the wrong reason.
    expect(declared.size).toBeGreaterThanOrEqual(4);
    for (const field of ["statedKinks", "limits", "kinksInvolved", "takeHomeMedications"]) {
      expect(declared.has(field), `${field} entries carry a foreign key but no entry key is stated`).toBe(true);
      expect(typeof declared.get(field)).toBe("string");
    }
  });

  // Every entry-id key stated must name a key that actually appears in
  // records. A typo here would make the repair silently match nothing -
  // the `ids || []` shape of bug again, one file over.
  it("only states entry-id keys that really exist in the checker", () => {
    const checked = collectCheckedFields();
    const declared = collectEntryIdKeys();
    for (const field of declared.keys()) {
      expect(checked.has(field), `${field} has a repair shape but nothing checks it`).toBe(true);
    }
  });
});

// The other two hand-maintained inventories. Both were MEASURED in sync at the
// time of writing - 17/17 option lists, 7/7 registries, no dead entries - so
// these are not fixes. They are the reason none of them needs one tomorrow.
//
// Same failure class as the orphan checker this file exists for: a list kept by
// hand next to the thing it must agree with, with nothing asserting the
// agreement. That is how four live reference fields went unchecked, and how the
// seed regenerator came to read 11 of 14 repositories.
describe("hand-maintained inventories stay in sync with what they claim to cover", () => {
  it("optionListUsage's SOURCES covers every list the repository declares", () => {
    const live = objectKeys(OPTION_LISTS_REPO, "OPTION_LIST_LABELS");
    const mapped = objectKeys(OPTION_USAGE, "SOURCES");
    expect(live.length, "the sweep found no lists, so nothing below can fail").toBeGreaterThanOrEqual(15);
    expect(mapped.length).toBeGreaterThanOrEqual(15);
    // A list with no SOURCES entry silently gets "N records use this: 0" and
    // no reassociate, which reads as "nothing uses this" rather than "nobody
    // implemented this list".
    const unmapped = live.filter((k) => !mapped.includes(k));
    expect(unmapped, `these lists cannot be scanned or reassociated: ${unmapped.join(", ")}`).toEqual([]);
  });

  it("optionListUsage's SOURCES has no entry for a list that no longer exists", () => {
    const live = objectKeys(OPTION_LISTS_REPO, "OPTION_LIST_LABELS");
    const mapped = objectKeys(OPTION_USAGE, "SOURCES");
    const dead = mapped.filter((k) => !live.includes(k));
    expect(dead, `these are dead entries: ${dead.join(", ")}`).toEqual([]);
  });

  it("registryUsage has a compute function per registry Manage lists offers", () => {
    // ManageListsScreen binds one computeUsage per registry. Reading that
    // screen's own list keeps the assertion about what the user can actually
    // reach, rather than re-deriving the registry list a third time.
    const wired = manageListBindings();
    expect(wired.length, "no computeUsage bindings found - the sweep found nothing").toBeGreaterThanOrEqual(6);
    const exported = exportedFunctions(REGISTRY_USAGE);
    for (const [key, name] of wired) {
      const fn = `compute${name}Usage`;
      expect(exported, `the "${key}" row binds ${fn}, which registryUsage.js does not export`).toContain(fn);
    }
  });

  it("registryUsage exports nothing Manage lists cannot reach", () => {
    const wired = new Set(manageListBindings().map(([, name]) => name));
    for (const fn of exportedFunctions(REGISTRY_USAGE)) {
      const name = fn.replace(/^compute/, "").replace(/Usage$/, "");
      expect(wired.has(name), `${fn} exists but no registry row uses it - dead or a missing binding`).toBe(true);
    }
  });
});

// The two maps referenceRepair.js still had no guard on when it shipped. Both
// were in sync when measured, so these are not fixes - they are why neither
// needs one tomorrow.
describe("every type the checker reports can actually be repaired", () => {
  it("has a repository for every recordType the checker reports", () => {
    const reported = collectCheckerTypes("recordType");
    const mapped = repairKeys("RECORD_REPOSITORIES");
    expect(reported.size, "the recordType sweep found nothing").toBeGreaterThanOrEqual(10);
    expect(mapped.size, "the RECORD_REPOSITORIES sweep found nothing").toBeGreaterThanOrEqual(10);
    const missing = [...reported].filter((t) => !mapped.has(t)).sort();
    expect(
      missing,
      `these are reported but not repairable - describeRepair will decline in prose and no test will notice: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("has a target source for every targetType the checker reports", () => {
    const reported = collectCheckerTypes("targetType");
    const mapped = repairKeys("TARGET_SOURCES");
    expect(reported.size, "the targetType sweep found nothing").toBeGreaterThanOrEqual(10);
    expect(mapped.size, "the TARGET_SOURCES sweep found nothing").toBeGreaterThanOrEqual(10);
    const missing = [...reported].filter((t) => !mapped.has(t)).sort();
    expect(missing, `these cannot be re-pointed at anything: ${missing.join(", ")}`).toEqual([]);
  });

  it("carries no recordType the checker stopped reporting", () => {
    const reported = collectCheckerTypes("recordType");
    const dead = [...repairKeys("RECORD_REPOSITORIES")].filter((t) => !reported.has(t)).sort();
    expect(dead, `these map a record type nothing reports: ${dead.join(", ")}`).toEqual([]);
  });

  it("carries no targetType the checker stopped reporting", () => {
    const reported = collectCheckerTypes("targetType");
    const dead = [...repairKeys("TARGET_SOURCES")].filter((t) => !reported.has(t)).sort();
    expect(dead, `these map a target type nothing reports: ${dead.join(", ")}`).toEqual([]);
  });

  it("gives every repair exemption a written reason", () => {
    for (const [type, reason] of Object.entries(REPAIR_EXEMPT)) {
      expect(typeof reason, `${type} needs a reason`).toBe("string");
      expect(reason.trim().length, `${type}'s reason must not be empty`).toBeGreaterThan(20);
    }
  });

  it("exempts nothing that is actually repairable", () => {
    // The reverse direction on the exemption map: an entry left behind after the
    // special case was fixed would make a real gap invisible, because the
    // coverage assertions above consult it.
    const reported = collectCheckerTypes("recordType");
    const mapped = repairKeys("RECORD_REPOSITORIES");
    for (const type of Object.keys(REPAIR_EXEMPT)) {
      expect(mapped.has(type), `${type} is exempted but referenceRepair already handles it - drop the exemption`).toBe(true);
    }
    // And the exemption must correspond to something real.
    for (const type of Object.keys(REPAIR_EXEMPT)) {
      expect(reported.has(type), `${type} is exempted but the checker never reports it`).toBe(true);
    }
  });
});