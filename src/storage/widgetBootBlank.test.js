// Widgets must blank BEFORE the device is unlocked after a reboot, not after.
//
// THE BUG THIS EXISTS FOR
// -----------------------
// The boot receiver shipped listening for ACTION_BOOT_COMPLETED alone, which
// looks like the obvious choice and is the wrong one. Android's own Direct Boot
// guide: BOOT_COMPLETED fires "after the user has unlocked the device".
//
// The thing that makes it matter is that Android's system_server re-paints a
// widget's last cached RemoteViews straight back onto the display after a
// reboot, WITHOUT running the app. So the receiver could not fire until someone
// entered a PIN - i.e. strictly after the disclosure it existed to prevent. A
// phone that was rebooted and then taken by someone else would sit on the lock
// screen showing the medication name and the DoxyPEP countdown until the owner
// unlocked it, and the "protection" would not have activated yet.
//
// The fix is ACTION_LOCKED_BOOT_COMPLETED, which fires while the user is still
// locked, and which only reaches a receiver marked android:directBootAware.
// Both halves are required: the action without the attribute is not delivered,
// and the attribute without the action changes nothing.
//
// Neither half was checked by any existing test, which is why it shipped broken
// with a green suite and a CI-green commit behind it.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const manifest = readFileSync(path.join(ROOT, "android/app/src/main/AndroidManifest.xml"), "utf8");
const receiver = readFileSync(
  path.join(ROOT, "android/app/src/main/java/com/shos/app/widget/WidgetBootReceiver.java"),
  "utf8",
);

/** The receiver's own <receiver> block, comments stripped, so assertions cannot
 *  be satisfied by the prose explaining the receiver. */
function receiverBlock() {
  const clean = stripXmlComments(manifest);
  const at = clean.indexOf("WidgetBootReceiver");
  expect(at, "WidgetBootReceiver is not declared in the manifest").toBeGreaterThan(-1);
  const start = clean.lastIndexOf("<receiver", at);
  const end = clean.indexOf("</receiver>", at);
  expect(end, "the WidgetBootReceiver block is never closed").toBeGreaterThan(start);
  return clean.slice(start, end);
}

/** Strips whole-line comments from Java, for negative assertions. */
function stripLineComments(src) {
  return src.split(/\r?\n/).filter((line) => !/^\s*\/\//.test(line)).join("\n");
}

/**
 * Strips XML comments from the manifest, for negative assertions.
 *
 * This exists because the guard was VACUOUS on its first run, caught by
 * mutation rather than by reading. The explanatory comment I had written into
 * the manifest contains `android:directBootAware="true"` as example code, so
 * deleting the real attribute from the tag left the assertion satisfied by the
 * comment about the attribute. It is the ninth recorded instance in this repo
 * of a guard being satisfied by the prose documenting the fix - and the second
 * one where the prose was written by the same hand, in the same edit, in the
 * very file being guarded.
 *
 * Non-greedy so it removes the whole comment rather than stopping at the first
 * `-->`, and it does not touch `//` inside attribute values.
 */
function stripXmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, "");
}

describe("widgets blank before first unlock, not after", () => {
  it("is marked directBootAware, without which no pre-unlock broadcast is delivered", () => {
    expect(receiverBlock()).toMatch(/android:directBootAware="true"/);
  });

  it("listens for LOCKED_BOOT_COMPLETED", () => {
    // The load-bearing assertion. BOOT_COMPLETED is also present and is
    // correct to keep - it is the pre-N fallback - but it is the one that fires
    // too late, so its presence must never be mistaken for coverage.
    expect(receiverBlock()).toMatch(/android\.intent\.action\.LOCKED_BOOT_COMPLETED/);
  });

  it("keeps BOOT_COMPLETED as the pre-N fallback", () => {
    // Deliberately kept rather than removed: before Android N there is no
    // direct-boot concept and BOOT_COMPLETED is the only boot signal that exists.
    expect(receiverBlock()).toMatch(/android\.intent\.action\.BOOT_COMPLETED/);
  });

  it("actually accepts both actions in code, not just in the manifest", () => {
    // A manifest can declare an action the receiver then rejects at runtime,
    // which is the same class of defect one layer down: everything is configured
    // and nothing happens.
    expect(receiver).toMatch(/ACTION_LOCKED_BOOT_COMPLETED/);
    expect(receiver).toMatch(/ACTION_BOOT_COMPLETED/);
    // It must NOT be an equality test against BOOT_COMPLETED alone, which is
    // precisely the original bug.
    const code = stripLineComments(receiver);
    expect(
      code.match(/!\s*Intent\.ACTION_BOOT_COMPLETED\.equals\(intent\.getAction\(\)\)/),
      "the receiver still rejects anything that is not BOOT_COMPLETED",
    ).toBeNull();
  });

  it("blanks by hiding the root, not with the setEmptyView API that does not exist", () => {
    // CI rejected setEmptyView(R.id.widget_root): the only overload takes two
    // arguments and sets a FALLBACK layout, so it would never have blanked
    // anything even had it compiled. Asserted so that approach cannot return.
    const code = stripLineComments(receiver);
    expect(code).toMatch(/setViewVisibility\(\s*R\.id\.widget_root\s*,\s*View\.GONE\s*\)/);
    expect(code, "setEmptyView cannot blank a widget; it sets a fallback view").not.toMatch(/\.setEmptyView\(/);
  });

it("every data widget with a layout is blanked, not just the first", () => {
    // Derived from the providers on disk rather than from a hardcoded list,
    // because hardcoding it means a provider added later is silently uncovered
    // and nothing says so. (The first draft of this assertion hardcoded the
    // names and was itself wrong about one of them - it guessed
    // `doxypep_widget` for what is actually `doxy_pep_widget`. A guard that
    // needs a maintainer to keep a list correct is a guard that will be wrong.)
    const blanked = new Set([...receiver.matchAll(/R\.layout\.(\w+)/g)].map((m) => m[1]));

    // Each data-bearing provider declares the layout it renders in AND reads
    // what it renders out of the encrypted widget store, so a provider that
    // reads stored data must have that layout blanked on boot.
    //
    // Reading WidgetPrefs is the discriminator rather than the file name,
    // because the QuickAdd widgets DO have layouts - they are launch icons, not
    // dataless - so filtering by "has a layout" swept them in, and filtering by
    // the name `QuickAdd` is a naming convention this guard would then have to
    // trust. A widget that renders nothing it stored cannot leak anything, so
    // "reads the store" is exactly the right test and it cannot be gamed by a
    // badly chosen filename.
    const providerDir = path.join(ROOT, "android/app/src/main/java/com/shos/app/widget");
    const layoutDir = path.join(ROOT, "android/app/src/main/res/layout");
    const onDisk = new Set(readdirSync(layoutDir).filter((f) => f.endsWith(".xml")).map((f) => f.replace(".xml", "")));
    const providers = readdirSync(providerDir).filter((f) => f.endsWith("WidgetProvider.java"));
    const dataProviders = providers.filter((f) => {
      const src = readFileSync(path.join(providerDir, f), "utf8");
      const layout = (src.match(/R\.layout\.(\w+)/) || [])[1];
      return layout && onDisk.has(layout) && /WidgetPrefs\.get\(/.test(src);
    });

    // Non-vacuity: if this filter ever matched nothing, the loop below would
    // assert nothing at all and report green.
    expect(
      dataProviders.length,
      "no provider that renders stored data was discovered - the assertion below would be vacuous",
    ).toBeGreaterThanOrEqual(7);

    for (const provider of dataProviders) {
      const src = readFileSync(path.join(providerDir, provider), "utf8");
      const layout = src.match(/R\.layout\.(\w+)/)[1];
      expect(blanked, `${provider} renders stored data as ${layout} but that layout is not blanked on boot`).toContain(layout);
    }
  });

  it("blanks exactly the data widgets, not the QuickAdd ones", () => {
    // Blankading a launch icon is harmless but wrong in a different way: it
    // would hide the icon the user deliberately placed, and QuickAdd providers
    // have no data layout to begin with.
    const blanked = [...receiver.matchAll(/R\.layout\.(\w+)/g)].map((m) => m[1]);
    for (const layout of blanked) {
      expect(layout, `${layout} is a QuickAdd shortcut, not data`).not.toMatch(/^quick_add_/);
    }
  });

  it("the manifest comment stripper is non-vacuous", () => {
    // A stripper that removed everything would make the directBootAware and
    // LOCKED_BOOT_COMPLETED assertions pass forever. Asserted against the real
    // file: tags must survive, comments must go, and - the part that matters -
    // the comment must be one that DOES mention directBootAware, so the guard
    // cannot pass by the stripper failing to remove exactly the thing it exists
    // to remove.
    const clean = stripXmlComments(manifest);
    expect(clean.length, "the stripper deleted the manifest").toBeGreaterThan(manifest.length * 0.5);
    expect(clean, "the stripper ate real XML").toMatch(/<application/);
    expect(manifest, "this guard no longer has a misleading comment to strip").toMatch(
      /<!--[\s\S]*directBootAware[\s\S]*-->/,
    );
  });

  it("the comment stripper is non-vacuous", () => {
    // Otherwise every negative assertion above would pass by deleting the file.
    const code = stripLineComments(receiver);
    expect(code.length).toBeGreaterThan(receiver.length * 0.5);
    expect(code).toMatch(/class WidgetBootReceiver/);
    expect(receiver).toMatch(/^\s*\/\/.*setEmptyView/m);
  });
});