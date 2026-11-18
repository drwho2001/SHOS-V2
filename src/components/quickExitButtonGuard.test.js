// BACKLOG 0b — the one action shared by every top bar (Quick Exit, a safety
// control) is rendered by ONE component so it cannot drift again.
//
// Scope note: the audit line "Home 4 icons vs Encounter 2 vs Healthcare 1"
// was challenged and rejected — those screens genuinely have different
// actions, and inventing matching icons would be dishonest. What was a real
// defect is this shared control: it had drifted into bold/regular weight,
// 32px vs 44px hit targets, title on only some, and hardcoded English labels.
// Testing's bottom EXIT row and Partner Notification's sheet footer are not
// top bars and keep their own contextual layout; they are out of scope here.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const COMPONENT = read("src/components/QuickExitButton.jsx");
const TOP_BARS = [
  "src/modules/SHOS_Home_Prototype.jsx",
  "src/modules/SHOS_Encounters_Prototype.jsx",
  "src/modules/SHOS_Healthcare_Prototype.jsx",
  "src/modules/SHOS_Contacts_Prototype.jsx",
  "src/modules/SHOS_Medication_Dashboard_Prototype.jsx",
];

describe("standardised Quick Exit control", () => {
  it("owns one consistent treatment: size, weight, 44px target, a11y, translated label", () => {
    expect(COMPONENT).toMatch(/size=\{24\}/);
    expect(COMPONENT).toMatch(/weight="bold"/);
    expect(COMPONENT).toMatch(/padding: 10, margin: "-10px 0"/); // 24 + 2*10 = 44px
    expect(COMPONENT).toMatch(/role="button"/);
    expect(COMPONENT).toMatch(/tabIndex=\{0\}/);
    expect(COMPONENT).toMatch(/aria-label=\{label\}/);
    expect(COMPONENT).toMatch(/title=\{label\}/);
    expect(COMPONENT).toMatch(/t\("home\.quickExit", "Quick exit"\)/);
    expect(COMPONENT).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
  });

  it("takes only a colour (a real banner constraint) and the optional tour id", () => {
    const sig = /export function QuickExitButton\(\{([^}]*)\}\)/.exec(COMPONENT);
    expect(sig, "could not read component props").not.toBeNull();
    const props = sig[1].split(",").map((s) => s.trim());
    expect(props).toEqual(expect.arrayContaining(["onQuickExit", "color", "tourId"]));
    expect(props.length).toBe(3);
  });

  it("every top bar uses the shared component, not its own SignOut render", () => {
    for (const rel of TOP_BARS) {
      const src = read(rel);
      expect(src, `${rel} must import QuickExitButton`).toMatch(/import QuickExitButton/);
      expect(src, `${rel} must render QuickExitButton`).toMatch(/<QuickExitButton/);
      expect(src, `${rel} still renders its own SignOut`).not.toMatch(/<SignOut\b/);
    }
  });

  it("Home keeps the tour hook the Interactive Tour targets", () => {
    expect(read("src/modules/SHOS_Home_Prototype.jsx")).toMatch(/tourId="quick-exit"/);
    expect(read("src/modules/InteractiveTour.jsx")).toMatch(/target: "quick-exit"/);
  });
});
