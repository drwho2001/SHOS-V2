// Anonymise mode — the 28 Sep 2026 security review's regression guard.
//
// WHY THIS FILE IS A SHAPE CONTRACT, NOT A BEHAVIOUR TEST:
//
// The review's actual finding was not a wrong value on a screen; it was that
// `privacySettingsRepository.anonymiseModeActive` was read in only 2 of the 9
// files that render a contact's name. Every value below therefore passed while
// the feature was 7/9 broken. A unit test on these pure helpers could never
// have seen that.
//
// So the load-bearing test here is the SECOND one: a structural sweep proving
// every screen that renders a contact's name now consults the shared helper.
// That is the property that actually regressed, and it is the one that would
// regress again the next time someone adds a new screen showing a name.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ANONYMISED,
  contactName,
  contactDetail,
  contactSearchText,
  attendeeNames,
} from "./anonymiseDisplay.js";

describe("anonymiseDisplay", () => {
  it("uses one shared placeholder string, and it is not a partial mask", () => {
    // A partial mask ("J*** D**") can still identify someone, which is the
    // reason the original 19 Aug implementation rejected it. Pinned so a
    // future "make it friendlier" change cannot quietly reintroduce one.
    expect(ANONYMISED).toBe("•••• hidden");
    expect(ANONYMISED).not.toMatch(/[*]/);
  });

  it("masks the name, and prefers nickname over real name when not masking", () => {
    const c = { name: "Alex Rivington", nickname: "Al" };
    expect(contactName(c, true)).toBe(ANONYMISED);
    expect(contactName(c, false)).toBe("Al");
    expect(contactName({ name: "Alex Rivington" }, false)).toBe("Alex Rivington");
    // A missing contact must not render as blank or throw.
    expect(contactName(undefined, false)).toBe("Unnamed contact");
    expect(contactName(undefined, true)).toBe(ANONYMISED);
  });

  it("masks age as a unit, so a placeholder name never sits beside a real age", () => {
    const c = { name: "Alex Rivington", age: 34, ageIsApprox: true };
    expect(contactDetail(c, true)).toBe(ANONYMISED);
    expect(contactDetail(c, false)).toBe("≈34");
    expect(contactDetail({ name: "Alex" }, false)).toBeNull();
  });

  // The index-level half. A masked name on screen while the real name stays
  // searchable defeats the feature: the user is trying to stop the name being
  // available, not just stop it being rendered.
  it("removes the real name from search text entirely while masking", () => {
    const c = { name: "Alex Rivington", nickname: "Al" };
    expect(contactSearchText(c, true)).toBe("");
    expect(contactSearchText(c, true)).not.toContain("Alex");
    expect(contactSearchText(c, false)).toBe("Alex Rivington Al");
  });

  it("does not disclose the attendee COUNT while masking", () => {
    expect(attendeeNames(["Alex", "Sam"], true)).toBe(ANONYMISED);
    // How many people you have seen is itself a disclosure, so a joined list
    // of placeholders would still leak it.
    expect(attendeeNames(["Alex", "Sam"], true)).not.toContain("2");
    expect(attendeeNames(["Alex", "Sam"], false)).toBe("Alex, Sam");
    expect(attendeeNames([], false)).toBe("—");
  });

  // The structural guard — the test that would have caught the original bug.
  it("every screen that renders a contact's name now consults the shared helper", () => {
    const modulesDir = join(process.cwd(), "src", "modules");
    const files = readdirSync(modulesDir).filter((f) => f.endsWith(".jsx"));

    // Screens known to render a person's name. Each was verified by reading
    // the real source, not by guessing from a filename — a file that stopped
    // showing names would simply drop off this list.
    const mustBeMasked = [
      "SHOS_Contacts_Prototype.jsx",
      "SHOS_Encounters_Prototype.jsx",
      "SHOS_GlobalSearch_Prototype.jsx",
      "SHOS_PartnerNotification_Prototype.jsx",
      "SHOS_Timeline_Prototype.jsx",
      "SHOS_MyProfile_Prototype.jsx",
      "SHOS_ClinicCard_Prototype.jsx",
    ];

    const offenders = [];
    for (const name of mustBeMasked) {
      const src = readFileSync(join(modulesDir, name), "utf8");
      if (!src.includes("anonymiseDisplay")) {
        offenders.push(`${name}: does not import anonymiseDisplay`);
      }
    }
    expect(offenders).toEqual([]);

    // And the invariant that actually broke: a second, private copy of the
    // placeholder string. That duplication is what let the two original
    // implementations drift, and re-introducing it would defeat the point of
    // the shared module. Comments are stripped first, because this file's own
    // comments discuss the removed constant by name.
    const dupes = [];
    // CHANGED 30 Sep 2026 (audit) — this used to look for the EXACT literal
    // '"•••• hidden"'. A module had drifted to FIVE dots ("••••• hidden"),
    // which is not a substring of the four-dot version, so the guard passed
    // while the drift it exists to prevent was sitting in the tree.
    //
    // A guard that misses its own target is worse than none: it reports
    // the invariant is held. So the check is now structural rather than an
    // exact match: any string literal that BEGINS with masking characters
    // and ends in "hidden" counts as a local placeholder, whatever the dot
    // count.
    //
    // The first version of this used `[...]*` and matched 43 sites, every
    // one of them `visibility: "hidden"` in an inline style - because `*`
    // allows ZERO masking characters, and all of those are literally the
    // string "hidden". Requiring at least one masking character at the START
    // is what separates a placeholder from an enum value.
    const localPlaceholder = /["'][•*.][^"']*hidden["']/;
    for (const f of files) {
      const stripped = readFileSync(join(modulesDir, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      if (localPlaceholder.test(stripped)) {
        dupes.push(f);
      }
    }
    expect(dupes, `these modules define their own masking placeholder instead of importing ANONYMISED: ${dupes.join(", ")}`).toEqual([]);

    // Proves the comment-stripper above still sees real code, so the
    // negative check cannot itself pass vacuously — the failure mode this
    // project has now hit several times.
    const sample = readFileSync(join(modulesDir, "SHOS_Contacts_Prototype.jsx"), "utf8");
    const strippedSample = sample
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(strippedSample).toContain("ANONYMISED");
    expect(strippedSample.length).toBeGreaterThan(1000);
  });

  it("Global Search keeps masked contacts OUT of the index, not just off screen", () => {
    // The single worst finding: the real name went into `searchText`, so a
    // contact was findable by typing their name while masking was on.
    const src = readFileSync(
      join(process.cwd(), "src", "modules", "SHOS_GlobalSearch_Prototype.jsx"),
      "utf8"
    );
    // The contact result must go through the helper, not a raw c.name.
    expect(src).toContain("contactSearchText(c, anonymise)");
    expect(src).toContain("title: contactName(c, anonymise)");
    // And the encounter attendee list must be emptied rather than resolved.
    expect(src).toMatch(/attendeeNames\s*=\s*anonymise\s*\?\s*\[\]/);
  });

  it("the duplicate checker no longer prints a phone number while masking", () => {
    // Rated above the search index on re-check, because a phone number is a
    // direct route to reaching the person rather than just their name.
    const src = readFileSync(
      join(process.cwd(), "src", "modules", "SHOS_Contacts_Prototype.jsx"),
      "utf8"
    );
    expect(src).toMatch(/!anonymise && \(entry\.city \|\| entry\.phone\)/);
    expect(src).toMatch(/anonymise \? MASKED : \(entry\.nickname \|\| entry\.name\)/);
  });

  it("Encounters masks a saved venue whose NAME embeds a contact's real name", () => {
    // Added after mutation testing found this one unguarded: reverting the
    // masking left the suite GREEN. That is the "measured nothing, looked
    // green" failure this project keeps paying for, caught this time by the
    // mutation harness rather than by a user.
    //
    // The rule is narrow on purpose — only entries LINKED TO A CONTACT are
    // masked, because those are the ones named "so-and-so's place". Masking
    // every registry entry would make the Chems and Symptoms pickers
    // unusable for no privacy gain.
    const src = readFileSync(
      join(process.cwd(), "src", "modules", "SHOS_Encounters_Prototype.jsx"),
      "utf8"
    );
    expect(src).toMatch(/anonymise && e\.relatedContactId \? ANONYMISED : e\.name/);
  });

  it("Encounters refuses to CREATE a venue from a real name while masking", () => {
    // The most consequential of the Encounters sites, because it is not a
    // display leak at all: tapping the suggestion ran findOrCreate() and wrote
    // a persistent "<real name>'s place" entry into the Locations registry,
    // which would then outlive Anonymise mode and reappear everywhere that
    // location is shown. Masking the label would have written a location
    // literally called "•••• hidden's place", so the shortcut is withheld.
    const src = readFileSync(
      join(process.cwd(), "src", "modules", "SHOS_Encounters_Prototype.jsx"),
      "utf8"
    );
    expect(src).toMatch(/const tapContactSuggestion = async \(contact\) => \{\s*\n\s*if \(anonymise\) return;/);
    expect(src).toMatch(/\{!anonymise && contactSuggestions\.map/);
    // And the "so-and-so's place" search branch must not match on a real name.
    expect(src).toMatch(/const name = anonymise \? "" : \(c\.nickname \|\| c\.name/);
  });

  it("Encounters' own search box no longer matches attendees by real name", () => {
    // A second, separate search-index leak found by reading the source rather
    // than by the original sweep: the Encounters tab has its own search box
    // which matched attendee names, so an encounter stayed findable by typing
    // a real name while masking was on.
    const src = readFileSync(
      join(process.cwd(), "src", "modules", "SHOS_Encounters_Prototype.jsx"),
      "utf8"
    );
    expect(src).toMatch(/const attendeeNames = anonymise \? \[\] : e\.attendeeIds\.map/);
  });
});
