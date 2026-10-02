// ADDED 1 Oct 2026 - tests for making HIV status shareable, opt-in.
//
// The properties worth protecting here are not "it round-trips". They are the
// three ways this feature can leak, each of which would look like working code:
//
//   1. The status appears in an export WITHOUT the user asking. The default has
//      to stay "not shared", and not merely "shared when set" - someone whose
//      status is set is exactly the person who must not leak by default.
//   2. Redaction is visible. A "not-disclosed" sentinel, or a `hiv_shared:false`
//      marker, tells the recipient something was withheld - and in a
//      sub-population where withholding HIV status while disclosing everything
//      else is presumed positive, that inference IS the leak. Absence and
//      never-known have to be indistinguishable.
//   3. "Undetectable" is collapsed to "positive" on the way out. That would
//      export a 1990s framing to a sexual partner, and would contradict the
//      app's own Glossary - which explains U=U.
import { describe, it, expect, beforeEach, vi } from "vitest";

const getProfile = vi.fn();
vi.mock("../repositories/myProfileRepository.js", async (orig) => {
  const actual = await orig();
  return { ...actual, MyProfileRepository: { getProfile: (...a) => getProfile(...a) } };
});

const {
  buildProfileShare,
  mapShareToContactData,
  parseProfileShare,
} = await import("./profileShareService.js");
const { HIV_STATUS, describeHivStatus, hivStatusSharePayload } = await import(
  "../calculations/hivStatusCalculations.js"
);

const SUPPRESSED = HIV_STATUS.POSITIVE_SUPPRESSED;
const UNSUPPRESSED = HIV_STATUS.POSITIVE_UNSUPPRESSED;

beforeEach(() => {
  getProfile.mockReset();
  getProfile.mockResolvedValue({ displayName: "Sam", hivStatus: null, hivStatusInformedDate: "" });
});

describe("HIV status is opt-in, and the default shares nothing", () => {
  it("omits the key entirely when the caller does not opt in", async () => {
    getProfile.mockResolvedValue({ displayName: "Sam", hivStatus: SUPPRESSED });
    const share = await buildProfileShare({
      // DELIBERATELY passing a resolvable status. An earlier version of this test
      // omitted it, and the suite stayed GREEN when the opt-in gate was deleted
      // entirely - because with no resolved status the payload was null and
      // nothing was spread regardless. It proved the payload builder works, not
      // that the gate exists. The gate is only under test when there is
      // something for it to leak.
      resolvedHivStatus: { status: SUPPRESSED, since: "2026-03-14T10:00:00.000Z" },
    });
    // `in` rather than a truthiness check: a null value would still tell the
    // recipient the field exists and was deliberately blanked.
    expect("hivStatus" in share.data).toBe(false);
    expect("hivStatusDate" in share.data).toBe(false);
  });

  it("omits it even when the profile HAS a status set", async () => {
    // The default must not be "shared unless blank" - the person most exposed
    // by this is exactly the one with a status recorded.
    getProfile.mockResolvedValue({ displayName: "Sam", hivStatus: SUPPRESSED });
    const share = await buildProfileShare({
      includeHivStatus: false,
      resolvedHivStatus: { status: SUPPRESSED, since: "2026-03-14T10:00:00.000Z" },
      hivStatusInformedDate: "2026-01-02",
    });
    expect("hivStatus" in share.data).toBe(false);
    expect("hivStatusDate" in share.data).toBe(false);
  });

  it("includes it only when explicitly requested", async () => {
    getProfile.mockResolvedValue({ displayName: "Sam", hivStatus: HIV_STATUS.NEGATIVE });
    const share = await buildProfileShare({
      includeHivStatus: true,
      resolvedHivStatus: { status: HIV_STATUS.NEGATIVE, since: "2026-03-14T10:00:00.000Z" },
    });
    expect(share.data.hivStatus).toBe(HIV_STATUS.NEGATIVE);
    expect(share.data.hivStatusDate).toBe("2026-03-14T10:00:00.000Z");
  });
});

describe("redaction is indistinguishable from never-known", () => {
  it("a redacted share lands on the contact as null, exactly like never-stated", () => {
    const redacted = mapShareToContactData({ data: { displayName: "Sam" } });
    const neverStated = mapShareToContactData({
      data: { displayName: "Sam", hivStatus: null },
    });
    expect(redacted.hivStatus).toBeNull();
    expect(neverStated.hivStatus).toBeNull();
    expect(redacted.hivStatusInformedDate).toBe("");
    expect(neverStated.hivStatusInformedDate).toBe("");
  });

  it("carries no metadata that a field was withheld", () => {
    const contact = mapShareToContactData({ data: { displayName: "Sam" } });
    // Anything like hivShared/hivStatusShared would turn the omission into a
    // signal, which is the whole failure this design avoids.
    expect(Object.keys(contact).filter((k) => /shar/i.test(k))).toEqual([]);
  });

  it("a garbage status from a hand-edited file cannot become a real value", () => {
    // The payload is a file the user can open in a text editor.
    const contact = mapShareToContactData({ data: { hivStatus: "definitely-negative-promise" } });
    expect(contact.hivStatus).toBeNull();
  });
});

describe("the undetectable distinction survives the round trip", () => {
  it.each([
    ["undetectable", SUPPRESSED],
    ["detectable", UNSUPPRESSED],
  ])("exports %s as itself, never collapsed to a bare positive", async (_name, status) => {
    getProfile.mockResolvedValue({ displayName: "Sam", hivStatus: status });
    const share = await buildProfileShare({
      includeHivStatus: true,
      resolvedHivStatus: { status, since: "2026-03-14T10:00:00.000Z" },
    });
    expect(share.data.hivStatus).toBe(status);
    expect(share.data.hivStatus).not.toBe("positive");
  });

  it("keeps a STATED undetectable status on its own, as the export must", () => {
    const payload = hivStatusSharePayload({ status: SUPPRESSED, source: "stated" }, "2026-01-02");
    expect(payload.hivStatus).toBe(SUPPRESSED);
  });
});

describe("the date rides with the status, and the right one", () => {
  it("uses the test date for a DERIVED status", () => {
    const payload = hivStatusSharePayload({ status: HIV_STATUS.NEGATIVE, since: "2026-03-14" }, "");
    expect(payload.hivStatusDate).toBe("2026-03-14");
  });

  it("uses the informed date for a STATED status", () => {
    // A status typed by hand has no test record here, so the only date that
    // means anything is when the user was told.
    const payload = hivStatusSharePayload({ status: HIV_STATUS.NEGATIVE, source: "stated" }, "2026-01-02");
    expect(payload.hivStatusDate).toBe("2026-01-02");
  });

  it("does not borrow a test date to date a stated status", () => {
    const payload = hivStatusSharePayload(
      { status: HIV_STATUS.NEGATIVE, source: "stated", since: "2026-03-14" },
      "",
    );
    // The `since` on a stated status is leftover from the derived half; using it
    // would claim a test date the user never had.
    expect(payload.hivStatusDate).toBeNull();
  });

  it("returns null for an unresolvable status, so the key is never spread", () => {
    expect(hivStatusSharePayload(null, "2026-01-02")).toBeNull();
    expect(hivStatusSharePayload({ status: "nonsense" }, "")).toBeNull();
  });
});

describe("an undated status must not read as reassurance", () => {
  it("an undated NEGATIVE is not rendered as a plain negative", () => {
    // A negative is time-bounded and a 4th-gen test has a window period, so
    // undated it is unquantifiable reassurance - reads as "you are clear".
    const line = describeHivStatus({ status: HIV_STATUS.NEGATIVE, since: null });
    expect(line).toMatch(/unverified|out of date/i);
    expect(line).not.toBe("Negative");
  });

  it("an undated UNDETECTABLE says the result needs a date", () => {
    // U=U rests on suppression being sustained, which a date-less entry cannot
    // show - and undetectable is the reassuring state, so the caveat matters.
    const line = describeHivStatus({ status: SUPPRESSED, since: null });
    expect(line).toMatch(/no date recorded/i);
  });

  it("untested is still its own plain answer", () => {
    expect(describeHivStatus({ status: HIV_STATUS.UNTESTED, since: null })).toBe("Untested / unknown");
  });

  it("a dated negative reads normally again", () => {
    const line = describeHivStatus({ status: HIV_STATUS.NEGATIVE, since: "2026-03-14T10:00:00.000Z" });
    expect(line).toMatch(/as of/);
    expect(line).not.toMatch(/unverified/i);
  });
});

describe("the payload is still a valid share document", () => {
  it("every profile field this feature reads has a default, so a record saved before it existed still shares cleanly", async () => {
    // This one was green when the field was REMOVED from DEFAULT_PROFILE, i.e.
    // nothing asserted it. The defensive-default merge is this repo's standing
    // rule for exactly this case: a record written by an older build has no
    // `hivStatusInformedDate` key at all, and the share path reads it.
    const { DEFAULT_PROFILE } = await import("../repositories/myProfileRepository.js");
    expect(Object.keys(DEFAULT_PROFILE)).toContain("hivStatusInformedDate");
    expect(DEFAULT_PROFILE.hivStatusInformedDate).toBe("");

    // And a pre-field record shares without throwing and without a stray key.
    getProfile.mockResolvedValue({ displayName: "Sam", hivStatus: HIV_STATUS.NEGATIVE });
    const share = await buildProfileShare({
      includeHivStatus: true,
      resolvedHivStatus: { status: HIV_STATUS.NEGATIVE, source: "stated", since: null },
    });
    expect(share.data.hivStatus).toBe(HIV_STATUS.NEGATIVE);
    expect(share.data.hivStatusDate).toBeNull();
  });

  it("round-trips through parse and map with the status intact", async () => {
    getProfile.mockResolvedValue({ displayName: "Sam", hivStatus: SUPPRESSED });
    const share = await buildProfileShare({
      includeHivStatus: true,
      resolvedHivStatus: { status: SUPPRESSED, since: "2026-03-14T10:00:00.000Z" },
    });
    const parsed = parseProfileShare(JSON.stringify(share));
    const contact = mapShareToContactData(parsed);
    expect(contact.hivStatus).toBe(SUPPRESSED);
    expect(contact.hivStatusInformedDate).toBe("2026-03-14T10:00:00.000Z");
    expect(contact.name).toBe("Sam");
  });
});
