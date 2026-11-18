// R9 (18 Nov 2026) — two "ongoing" periods must never coexist.
//
// Owner's decision: do NOT auto-close the previous period. When a second
// "Log period" is attempted while one is still open, open the FIRST record's
// edit sheet so the person enters the end date themselves, with a plain
// explanation and an "I don't remember — estimate duration" escape. Then
// resume the original "log a new period" intent.
//
// This is a source guard. It proves it is reading the real module (a guard
// that read nothing would pass), then asserts each part of the flow is
// present AND that the previous auto-allowing paths are gone.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const modulePath = path.join(process.cwd(), "src", "modules", "SHOS_MenstrualHealth_Prototype.jsx");
const repoPath = path.join(process.cwd(), "src", "repositories", "menstrualCycleRepository.js");
const src = readFileSync(modulePath, "utf8");
const repo = readFileSync(repoPath, "utf8");

// The CycleTab + CycleSheet region only, so an identical helper in another
// tab (Pregnancy/Contraception) cannot satisfy an assertion by accident.
const cycleTabSrc = src.slice(src.indexOf("function CycleTab("), src.indexOf("// ═", src.indexOf("function CycleTab(")));
const cycleSheetSrc = src.slice(src.indexOf("function CycleSheet("), src.indexOf("function CycleTab("));

describe("R9 menstrual overlap guard", () => {
  it("is reading the real module and repository", () => {
    expect(src.length).toBeGreaterThan(50_000);
    expect(src).toContain("function CycleTab(");
    expect(src).toContain("function CycleSheet(");
    expect(repo).toContain("getAveragePeriodLengthDays");
  });

  it("detects an ongoing period (no end date) and opens THAT record, not a new one", () => {
    expect(cycleTabSrc).toMatch(/\.filter\(\(c\) => !c\.endDate\)/);
    expect(cycleTabSrc).toMatch(/name: "edit", id: ongoing\.id, overlapGuard: true, resumeAdd: true/);
    // The FAB no longer opens the add sheet directly.
    expect(cycleTabSrc).not.toMatch(/onClick=\{\(\) => setScreen\(\{ name: "add" \}\)\}/);
    expect(cycleTabSrc).toMatch(/onClick=\{requestAdd\}/);
  });

  it("re-checks at save time too, so a stale list or a second open period cannot slip through", () => {
    expect(cycleTabSrc).toMatch(/MenstrualCycleRepository\.getAll\(\)[\s\S]*?\.filter\(\(c\) => !c\.isArchived && !c\.endDate\)/);
    // The old one-line create() that blindly wrote the record is gone.
    expect(cycleTabSrc).not.toMatch(/const create = async \(data\) => \{ await MenstrualCycleRepository\.create\(data\)/);
  });

  it("resumes the new-period form after the overlap is resolved", () => {
    expect(cycleTabSrc).toMatch(/screen\.resumeAdd \? \{ name: "add" \}/);
  });

  it("waits for the list to load before resolving a quick-add (no race against the loader)", () => {
    expect(cycleTabSrc).toMatch(/setPendingAdd\(true\)/);
    expect(cycleTabSrc).toMatch(/if \(!pendingAdd \|\| !cyclesReady\) return/);
    expect(cycleTabSrc).toMatch(/const cyclesReady = rawCycles !== null/);
  });

  it("shows the plain explanation and an estimate escape — no auto-close", () => {
    expect(cycleSheetSrc).toMatch(/A new period can't start until the previous one has ended/);
    expect(cycleSheetSrc).toMatch(/I don't remember — estimate duration/);
    // The estimate is user-driven and flagged, never silent.
    expect(cycleSheetSrc).toMatch(/endDateApproximate: true/);
    expect(cycleSheetSrc).toMatch(/\+\s*\(days - 1\)/); // inclusive duration, matches the average
  });

  it("requires an end date in the guard sheet so the overlap actually resolves", () => {
    expect(cycleSheetSrc).toMatch(/canSave = !!form\.startDate && \(!overlapNotice \|\| !!form\.endDate\)/);
  });

  it("stores and surfaces the estimate flag honestly", () => {
    expect(repo).toMatch(/endDateApproximate: false/);
    expect(src).toMatch(/End date was estimated — edit this record to correct it/);
    // Manual end-date edits clear the estimate flag.
    expect(cycleSheetSrc).toMatch(/endDateApproximate: false/);
  });
});
