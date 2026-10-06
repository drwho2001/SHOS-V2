// duressNotificationLimitation.test.js
//
// A disclosure is only a disclosure if it is present, and the failure mode for
// copy like this is deletion in a later tidy-up - it reads as an aside rather
// than as a safety statement. The line above it in the UI makes a strong claim
// ("your real data stays completely untouched"), so a reader is actively
// encouraged to stop reading once they have that reassurance.
//
// So: the limitation is asserted alongside the claim it qualifies, which is the
// only way a test can notice if one survives and the other does not.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PRIVACY = readFileSync(
  path.join(process.cwd(), "src", "modules", "settings", "PrivacyScreen.jsx"),
  "utf8"
);

// THE FIRST VERSION OF THIS FILE WAS VACUOUS, and the mutation check is what
// caught it: deleting the user-visible disclosure left all four tests green.
// The rationale comment above it quotes "already scheduled", "still fire" and
// "lock screen" - so the comment satisfied the assertions once the UI line was
// gone. This is the third recorded instance in this repo of a guard matching
// the comment that documents the fix, and the first one where the comment was
// written in the same edit as the fix, by the same hand, in a test file whose
// header cites that lesson as its reason to exist. Reading a lesson is not the
// same as having absorbed it.
//
// So the UI assertions below run against comment-stripped source. The one test
// that deliberately checks the rationale comment uses the raw source, and says
// so, because that is its actual subject.
const codeOnly = PRIVACY
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("the duress PIN screen states the notification limitation", () => {
  it("tells the user that already-scheduled reminders still fire", () => {
    // Asserted on substance, not wording: the concepts that must survive a
    // copy edit are that reminders still fire, that the user can be seen
    // seeing it, and that the phone is the cause rather than the app.
    expect(codeOnly).toMatch(/already scheduled/i);
    expect(codeOnly).toMatch(/still (fire|appear)/i);
    expect(codeOnly).toMatch(/lock screen/i);
  });

  it("warns that duress mode does not hide launcher widgets and points to their privacy controls", () => {
    expect(codeOnly).toMatch(/home-screen widgets/i);
    expect(codeOnly).toMatch(/does not hide widgets/i);
    expect(codeOnly).toMatch(/continue showing/i);
    expect(codeOnly).toMatch(/Redacted or Off/i);
    expect(codeOnly).toMatch(/Settings → Widgets/i);
  });

  it("does not claim the decoy is total while qualifying it", () => {
    // The stronger claim is checked only to confirm it still exists to be
    // qualified - if a future edit weakens the claim without keeping the
    // qualification, the pairing is no longer needed and the test should be
    // revisited deliberately rather than silently passing.
    expect(codeOnly).toMatch(/completely untouched/i);
  });

  it("records why the behaviour was not changed, so it is not 'fixed' later", () => {
    // Raw source on purpose: the subject here IS the comment. Without it the
    // next reader sees an unaddressed safety gap and the obvious move is to
    // close it - which is the move already considered and rejected for a
    // health reason.
    expect(PRIVACY).toMatch(/coerced user/i);
    expect(PRIVACY).toMatch(/health consequence/i);
  });

  it("does not claim duress entry cancels notifications anywhere", () => {
    // Stripped source, since the rationale comment explicitly discusses
    // cancellation and a raw search would match the discussion of it.
    expect(codeOnly).not.toMatch(/cancel(s|led|ling)?\s+(all\s+)?(scheduled\s+)?notifications/i);
  });

  it("the stripper still sees the real UI text, so the checks above are not empty", () => {
    // Without this, a stripper that removed everything would make every
    // negative and positive assertion above pass for the wrong reason.
    expect(codeOnly).toMatch(/Duress PIN/);
    expect(codeOnly).toMatch(/decoy/i);
  });
});
