// @vitest-environment jsdom
// ADDED 7 Oct 2026 (session B) - the render test for the broken-reference repair
// row, which the browser smoke suite structurally CANNOT reach.
//
// WHY A RENDER TEST AND NOT A SMOKE FLOW. `OrphanRow` renders only when the
// scan actually found a dangling relation-by-id, and this app's own data never
// has one. A smoke flow can therefore open Developer Tools, assert "Broken
// references" is on screen, and still never mount this component - which is the
// component that carries every piece of new interaction state.
//
// That is not hypothetical in this repo. Two form-render crashes have shipped
// past the whole gate suite: a `SelectField` that threw React error #31 on every
// My Profile edit (three published APKs), and a temporal-dead-zone crash in
// Clinic Card. Neither is reachable by a unit test that imports without
// rendering, which is what "every gate passed" actually means for JSX.
//
// Creating a genuine dangling reference through a real product path would mean
// importing a backup with references to records it does not contain - which
// would replace the shared page's contacts and break every flow after it. So
// the row is rendered here against a synthetic orphan instead, which is exactly
// the input that would have crashed it.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const ORPHAN = {
  recordType: "Encounter",
  recordLabel: "Sauna trip",
  recordId: "encounter_001",
  field: "attendeeIds",
  danglingId: "contact_gone",
  targetType: "Contact",
};

// Mocked so the test is about the RENDER PATH, not about the repair module -
// referenceRepair.test.js covers the repair logic, and a render test that also
// asserted the repair semantics would be two tests wearing one hat.
vi.mock("../calculations/referenceRepair", () => ({
  describeRepair: vi.fn(async () => ({ kind: "list", entryKey: null, canRepair: true, canRepoint: true, reason: null })),
  clearDanglingReference: vi.fn(async () => ({ previous: ["contact_1", "contact_gone"] })),
  repointDanglingReference: vi.fn(async () => ({ previous: [] })),
  repairOptions: vi.fn(async () => [{ id: "contact_1", label: "Alex" }]),
  undoRepair: vi.fn(async () => {}),
}));

const { describeRepair, clearDanglingReference, repairOptions, undoRepair } = await import("../calculations/referenceRepair");
const { OrphanRow } = await import("../modules/settings/DeveloperToolsScreen.jsx");

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  describeRepair.mockResolvedValue({ kind: "list", entryKey: null, canRepair: true, canRepoint: true, reason: null });
});

describe("OrphanRow renders", () => {
  it("mounts and names the record, the field and the missing target", () => {
    // The whole point: this component had never been rendered by any gate.
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    expect(screen.getByText(/Encounter: Sauna trip/)).toBeTruthy();
    expect(screen.getByText("attendeeIds")).toBeTruthy();
    expect(screen.getByText(/no longer exists/)).toBeTruthy();
  });

  it("offers both repair affordances when the field can be repaired", async () => {
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    const clear = await screen.findByLabelText("Clear the broken reference on attendeeIds");
    const repoint = await screen.findByLabelText("Point attendeeIds at a different Contact");
    expect(clear).toBeTruthy();
    expect(repoint).toBeTruthy();
  });

  it("shows nothing actionable while the shape is still being resolved", () => {
    // Before describeRepair resolves, `shape` is null. Rendering the actions
    // then would offer a repair whose shape is unknown - and an unknown shape
    // is exactly the case referenceRepair refuses to act on.
    describeRepair.mockReturnValue(new Promise(() => {}));
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    expect(screen.queryByLabelText(/Clear the broken reference/)).toBeNull();
    expect(screen.getByText(/Encounter: Sauna trip/)).toBeTruthy();
  });

  it("requires a second tap before clearing anything", async () => {
    const clear = await (async () => {
      render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
      return screen.findByLabelText("Clear the broken reference on attendeeIds");
    })();
    fireEvent.click(clear);
    // One tap must only ask. This is a destructive write to a medical record,
    // and the confirm step is the whole reason the row is safe to offer.
    expect(clearDanglingReference).not.toHaveBeenCalled();
    const yes = await screen.findByLabelText("Yes, clear the broken reference");
    fireEvent.click(yes);
    expect(clearDanglingReference).toHaveBeenCalledWith(ORPHAN);
  });

  it("cancels without writing anything", async () => {
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    fireEvent.click(await screen.findByLabelText("Clear the broken reference on attendeeIds"));
    fireEvent.click(await screen.findByLabelText("Cancel"));
    expect(clearDanglingReference).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Clear the broken reference on attendeeIds")).toBeTruthy();
  });

  it("says why it cannot repair rather than offering nothing", async () => {
    describeRepair.mockResolvedValue({
      kind: "list", entryKey: null, canRepair: false, canRepoint: false,
      reason: "This one lives inside a notification checklist item, so it is cleared by editing that list directly.",
    });
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    expect(await screen.findByText(/notification checklist item/)).toBeTruthy();
    expect(screen.queryByLabelText(/Clear the broken reference/)).toBeNull();
  });

  it("offers only Clear, never re-point, when no target of that type exists", async () => {
    describeRepair.mockResolvedValue({ kind: "scalar", entryKey: null, canRepair: true, canRepoint: false, reason: null });
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    expect(await screen.findByLabelText("Clear the broken reference on attendeeIds")).toBeTruthy();
    expect(screen.queryByLabelText(/Point attendeeIds/)).toBeNull();
  });

  it("shows the targets it offers when re-pointing", async () => {
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    fireEvent.click(await screen.findByLabelText("Point attendeeIds at a different Contact"));
    expect(await screen.findByLabelText("Point attendeeIds at Alex")).toBeTruthy();
    expect(repairOptions).toHaveBeenCalledWith(ORPHAN);
  });

  it("offers undo after a repair, and undo writes the prior value back", async () => {
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    fireEvent.click(await screen.findByLabelText("Clear the broken reference on attendeeIds"));
    fireEvent.click(await screen.findByLabelText("Yes, clear the broken reference"));
    const undo = await screen.findByLabelText("Undo the repair to attendeeIds");
    fireEvent.click(undo);
    expect(undoRepair).toHaveBeenCalledWith(ORPHAN, ["contact_1", "contact_gone"]);
  });

  it("reports a failed write instead of pretending it worked", async () => {
    clearDanglingReference.mockRejectedValueOnce(new Error("Storage is quarantined"));
    render(<OrphanRow orphan={ORPHAN} onRepaired={() => {}} darkMode={false} />);
    fireEvent.click(await screen.findByLabelText("Clear the broken reference on attendeeIds"));
    fireEvent.click(await screen.findByLabelText("Yes, clear the broken reference"));
    expect(await screen.findByText(/Storage is quarantined/)).toBeTruthy();
    // And critically, no undo is offered for something that did not happen.
    expect(screen.queryByLabelText(/Undo the repair/)).toBeNull();
  });
});