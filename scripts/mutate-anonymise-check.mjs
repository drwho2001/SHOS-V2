// Mutation check for the two load-bearing anonymise guards.
//
// Backs up every file it touches and restores in a `finally` — a mutation
// harness that can leave the working tree broken is worse than none. Backed
// up because the first version of such a harness in this project crashed
// mid-restore and left a source file deliberately broken.
import { readFileSync, writeFileSync } from "node:fs";

const TARGETS = {
  search: {
    file: "src/modules/SHOS_GlobalSearch_Prototype.jsx",
    from: 'const searchText = [contactSearchText(c, anonymise), ...kinkNames].filter(Boolean).join(" ");',
    to: 'const searchText = [c.name, c.nickname, ...kinkNames].join(" ");',
  },
  dupPhone: {
    file: "src/modules/SHOS_Contacts_Prototype.jsx",
    from: "{!anonymise && (entry.city || entry.phone) &&",
    to: "{(entry.city || entry.phone) &&",
  },
  dupName: {
    file: "src/modules/SHOS_Contacts_Prototype.jsx",
    from: "{anonymise ? MASKED : (entry.nickname || entry.name)}{entry.isArchived",
    to: "{entry.nickname || entry.name}{entry.isArchived",
  },
  venueName: {
    file: "src/modules/SHOS_Encounters_Prototype.jsx",
    from: "{anonymise && e.relatedContactId ? ANONYMISED : e.name}",
    to: "{e.name}",
  },
};

const name = process.argv[2];
const target = TARGETS[name];
if (!target) {
  console.log(`unknown mutation: ${name}`);
  process.exit(2);
}

const original = readFileSync(target.file, "utf8");
if (!original.includes(target.from)) {
  // "The mutation did not apply" is a DIFFERENT failure from "the test did not
  // go red" — only the second says anything about the test.
  console.log(`MUTATION-NOT-APPLIED: pattern not found in ${target.file}`);
  process.exit(3);
}

try {
  writeFileSync(target.file, original.replace(target.from, target.to), "utf8");
  console.log(`MUTATION-APPLIED: ${name} -> ${target.file}`);
} catch (err) {
  console.log(`MUTATION-FAILED: ${err.message}`);
  process.exit(4);
}

try {
  const { execSync } = await import("node:child_process");
  try {
    execSync("npx vitest run src/calculations/anonymiseDisplay.test.js", {
      stdio: "pipe",
      shell: true,
    });
    console.log(`RESULT: ${name} -> SUITE STILL GREEN (test is vacuous!)`);
    process.exitCode = 5;
  } catch {
    console.log(`RESULT: ${name} -> suite went RED (guard is real)`);
  }
} finally {
  writeFileSync(target.file, original, "utf8");
  console.log(`RESTORED: ${target.file}`);
}
