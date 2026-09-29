// Source-level wiring guard for t025's HIV status UI.
//
// WHY THIS IS A SOURCE-LEVEL GUARD AND NOT A RENDER TEST: the property worth
// protecting is a wiring property - is the status actually displayed, and does
// the owner's own stated value actually reach it - and that survives layout
// refactors, which an assertion on rendered text would not. This repo has
// already shipped a feature whose hook worked perfectly in unit tests while a
// sweep silently failed to attach it to the components that mattered.
//
// NEGATIVE ASSERTIONS RUN AGAINST COMMENT-STRIPPED SOURCE. This is the third
// recorded instance in this repo of a guard matching the comment documenting
// the fix, so a negative check against raw source is worthless here. The
// stripper is proven non-vacuous by a test that requires it to leave real code
// behind.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");

const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const PROFILE = "src/modules/SHOS_MyProfile_Prototype.jsx";
const CONTACTS = "src/modules/SHOS_Contacts_Prototype.jsx";

const profileRaw = read(PROFILE);
const contactsRaw = read(CONTACTS);
const profile = stripComments(profileRaw);
const contacts = stripComments(contactsRaw);

describe("the comment stripper is non-vacuous", () => {
  it("removes real comments while leaving real code, or every negative check below is hollow", () => {
    // An earlier version of this test proved non-vacuity with a length ratio
    // (`stripped > raw / 2`), which failed on the module that happens to be
    // the most comment-heavy file in the app - a bound that says more about
    // how heavily commented a file is than about whether the stripper works.
    // The real property: a phrase that only ever appears in a comment is gone,
    // and real code is still present.
    expect(profileRaw).toContain("ADDED 29 Sep 2026");
    expect(profile).not.toContain("ADDED 29 Sep 2026");
    expect(contactsRaw).toMatch(/CHANGED \d+ \w+ 2026/);
    expect(contacts).not.toMatch(/CHANGED \d+ \w+ 2026/);
    // And it did not simply gut the file.
    expect(profile).toContain("SectionCard");
    expect(profile).toContain("useLoadedMemo");
    expect(contacts).toContain("ReadRow");
  });
});

describe("My Profile displays a resolved HIV status", () => {
  it("renders the status, not just the control that sets it", () => {
    expect(profile).toContain("describeHivStatus");
    expect(profile).toMatch(/HIV status/);
  });

  it("says when a value was entered by the user rather than derived", () => {
    expect(profile).toMatch(/source === "stated"/);
  });

  it("passes the user's stated value INTO the resolution, so it can win", () => {
    expect(profile).toMatch(/resolveHivStatus\(\s*form\.hivStatus/);
  });

  it("does NOT fall back to 'untested' before the records load", () => {
    // A default status as the useLoadedMemo fallback renders a confident
    // "Untested / unknown" for the moment before the real records arrive,
    // which reads as "you're clear". The sentinel must be null.
    const memo = profile.match(/const hivResolved = useLoadedMemo\([\s\S]*?\n\s*\);/);
    expect(memo).not.toBeNull();
    expect(memo[0]).toMatch(/,\s*null\s*\);/);
    expect(memo[0]).not.toMatch(/untested/);
  });
});

describe("Contacts records a stated status and never derives one", () => {
  it("shows the status on the profile", () => {
    expect(contacts).toMatch(/label="HIV status"/);
    expect(contacts).toContain("describeHivStatus");
  });

  it("masks it under Anonymise mode, unlike the rows above it", () => {
    // The most sensitive fact this app can hold about another person.
    expect(contacts).toMatch(/hideFurther \|\| anonymise/);
  });

  it("does NOT derive a contact's status from the owner's test records", () => {
    // The derivation reads the OWNER's tests. Applied to a contact it would
    // report the owner's results as someone else's status.
    expect(contacts).not.toMatch(/deriveHivStatus/);
  });

  it("shows 'Not recorded' rather than 'untested' when nothing is stated", () => {
    expect(contacts).toContain("Not recorded");
  });

  it("the edit control exists, so a contact's status can be set at all", () => {
    expect(contacts).toMatch(/label="HIV status \(if known\)"/);
  });
});

describe("both repositories store the field and default it defensively", () => {
  const myProfile = read("src/repositories/myProfileRepository.js");
  const contact = read("src/repositories/contactRepository.js");

  it("My Profile defaults it to null, not to a status", () => {
    expect(myProfile).toMatch(/hivStatus:\s*null/);
  });

  it("Contacts defaults it to null, not to a status", () => {
    expect(contact).toMatch(/hivStatus:\s*null/);
  });

  it("both merge their defaults on read, so an older saved record still has it", () => {
    expect(myProfile).toMatch(/\.\.\.DEFAULT_PROFILE,\s*\.\.\./);
    expect(contact).toMatch(/\.\.\.DEFAULT_CONTACT,\s*\.\.\./);
  });
});
