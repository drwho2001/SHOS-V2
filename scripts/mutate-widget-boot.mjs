// Mutation check for the direct-boot blanking guard.
//
// This guards a property that shipped BROKEN behind a green suite and a green
// CI commit, so proving the assertions can fail matters more here than usual.
//
// "The mutation did not apply" is reported as a distinct outcome from "the suite
// stayed green", and only the second says anything about whether the guard can
// fail. The line ending is read off each file rather than assumed: these are
// CRLF files and a \n pattern matches nothing at all.
//
// Usage: node scripts/mutate-widget-boot.mjs [name]
//        no argument runs every mutation.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const RECEIVER = "android/app/src/main/java/com/shos/app/widget/WidgetBootReceiver.java";
const TEST = "src/storage/widgetBootBlank.test.js";

const TARGETS = {
  // THE ORIGINAL BUG, restored exactly: the pre-unlock broadcast removed, so
  // the receiver once again cannot fire until someone enters a PIN.
  "drop-locked-boot": {
    file: MANIFEST,
    from: '                <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" />\n',
    to: "",
  },

  // The action without the attribute is equally inert: a non-directBootAware
  // receiver is not delivered LOCKED_BOOT_COMPLETED at all.
  "drop-directbootaware": {
    file: MANIFEST,
    from: '            android:directBootAware="true">\n',
    to: "            >\n",
  },

  // The receiver rejects it again at runtime, one layer below the manifest.
  "receiver-ignores-locked": {
    file: RECEIVER,
    from: "        return Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)\n                || Intent.ACTION_BOOT_COMPLETED.equals(action);",
    to: "        return Intent.ACTION_BOOT_COMPLETED.equals(action);",
  },

  // The API that does not exist, which CI already rejected once. Asserted so a
  // later refactor cannot reintroduce an approach that never worked.
  "regress-to-setemptyview": {
    file: RECEIVER,
    from: "        empty.setViewVisibility(R.id.widget_root, View.GONE);",
    to: "        empty.setEmptyView(R.id.widget_root);",
  },

  // Drops one widget from blankAll, leaving it disclosed after a reboot.
  "unblank-refill": {
    file: RECEIVER,
    from: "        blank(manager, new ComponentName(context, RefillWidgetProvider.class), R.layout.refill_widget);",
    to: "",
  },
};

function runOne(name) {
  const target = TARGETS[name];
  const original = readFileSync(target.file, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const from = target.from.replace(/\n/g, eol);
  const to = target.to.replace(/\n/g, eol);

  if (!original.includes(from)) {
    console.log(`  ${name.padEnd(24)} NOT APPLIED  (pattern absent - proves nothing, and this is NOT a pass)`);
    return "not-applied";
  }
  writeFileSync(target.file, original.replace(from, to), "utf8");
  try {
    execSync(`npx vitest run ${TEST}`, { stdio: "pipe", shell: true });
    console.log(`  ${name.padEnd(24)} STILL GREEN  <-- the guard is vacuous`);
    return "vacuous";
  } catch {
    console.log(`  ${name.padEnd(24)} went red     guard is real`);
    return "red";
  } finally {
    writeFileSync(target.file, original, "utf8");
  }
}

if (process.argv[2] && !TARGETS[process.argv[2]]) {
  console.log(`unknown mutation: ${process.argv[2]}`);
  console.log(`known: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(2);
}

const names = process.argv[2] ? [process.argv[2]] : Object.keys(TARGETS);
console.log("=== widget boot blanking mutation check ===");
const results = names.map(runOne);
const bad = results.filter((r) => r !== "red");
console.log("");
console.log(bad.length === 0
  ? `ALL ${results.length} MUTATIONS WENT RED - every guard can fail`
  : `PROBLEM: ${bad.length} of ${results.length} did not prove the guard (${bad.join(", ")})`);
process.exit(bad.length === 0 ? 0 : 5);