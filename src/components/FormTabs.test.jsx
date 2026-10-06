import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FormTabs } from "./FormTabs.jsx";

const tabs = [
  { key: "about", label: "About" },
  { key: "health", label: "Health & safety" },
  { key: "notes", label: "Notes" },
];

function renderTabs(activeKey = "about", onChange = vi.fn()) {
  return {
    onChange,
    ...render(
      <FormTabs
        tabs={tabs}
        activeKey={activeKey}
        onChange={onChange}
        ariaLabel="Profile form sections"
        accent="#008585"
        accentText="#007373"
        textColor="#52525A"
        border="#DCDCE1"
        surface="#FFFFFF"
      >
        <div>About fields</div>
        <div>Health fields</div>
        <div>Notes fields</div>
      </FormTabs>
    ),
  };
}

describe("FormTabs", () => {
  it("exposes the selected panel and keeps other panels hidden but mounted", () => {
    renderTabs();

    const aboutTab = screen.getByRole("tab", { name: "About" });
    const healthTab = screen.getByRole("tab", { name: "Health & safety" });
    const aboutPanel = document.getElementById(aboutTab.getAttribute("aria-controls"));
    const healthPanel = document.getElementById(healthTab.getAttribute("aria-controls"));
    expect(aboutTab.getAttribute("aria-selected")).toBe("true");
    expect(aboutPanel.hidden).toBe(false);
    expect(healthPanel.hidden).toBe(true);
    expect(healthPanel.textContent).toContain("Health fields");
  });

  function StatefulTabs() {
    const [activeKey, setActiveKey] = useState("about");
    return (
      <FormTabs
        tabs={tabs}
        activeKey={activeKey}
        onChange={setActiveKey}
        ariaLabel="Profile form sections"
        accent="#008585"
        accentText="#007373"
        textColor="#52525A"
        border="#DCDCE1"
        surface="#FFFFFF"
      >
        <div><DraftField /></div>
        <div>Health fields</div>
        <div>Notes fields</div>
      </FormTabs>
    );
  }

  function DraftField() {
    const [value, setValue] = useState("");
    return <input aria-label="About draft field" value={value} onChange={(event) => setValue(event.target.value)} />;
  }

  it("changes panels from a click", () => {
    render(<StatefulTabs />);

    fireEvent.click(screen.getByRole("tab", { name: "Health & safety" }));

    expect(screen.getByRole("tab", { name: "Health & safety" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Health fields").closest('[role="tabpanel"]').hidden).toBe(false);
    expect(screen.getByLabelText("About draft field").closest('[role="tabpanel"]').hidden).toBe(true);
  });

  it("supports left/right and Home/End keyboard navigation", () => {
    render(<StatefulTabs />);
    const first = screen.getByRole("tab", { name: "About" });

    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Health & safety" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Health & safety" }));

    fireEvent.keyDown(screen.getByRole("tab", { name: "Health & safety" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Notes" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Notes" }));

    fireEvent.keyDown(screen.getByRole("tab", { name: "Notes" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "About" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "About" }));
  });

  it("preserves unfinished field state when switching between mounted panels", () => {
    render(<StatefulTabs />);
    const field = screen.getByLabelText("About draft field");
    fireEvent.change(field, { target: { value: "keep this unsaved" } });
    fireEvent.click(screen.getByRole("tab", { name: "Health & safety" }));
    fireEvent.click(screen.getByRole("tab", { name: "About" }));
    expect(screen.getByLabelText("About draft field").value).toBe("keep this unsaved");
  });
});
