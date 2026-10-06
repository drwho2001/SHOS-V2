import React, { Children, useId, useRef } from "react";

/**
 * Accessible tabs for long Add/Edit forms. Panels stay mounted while hidden so
 * controlled fields and picker-local draft text survive a tab change.
 */
export function FormTabs({ tabs, activeKey, onChange, ariaLabel, accent, accentText, textColor, border, surface, children }) {
  const id = `form-tabs-${useId().replace(/:/g, "")}`;
  const tabRefs = useRef([]);
  const panels = Children.toArray(children);

  const handleKeyDown = (event, currentIndex) => {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    onChange(tabs[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          padding: "10px 0 8px",
          marginBottom: 4,
          borderBottom: `1px solid ${border}`,
        }}
      >
        {tabs.map((tab, index) => {
          const selected = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              ref={(node) => { tabRefs.current[index] = node; }}
              type="button"
              id={`${id}-tab-${tab.key}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={{
                flex: "0 0 auto",
                padding: "8px 12px",
                border: `1px solid ${selected ? accent : border}`,
                borderRadius: 999,
                background: selected ? `${accent}15` : surface,
                color: selected ? accentText : textColor,
                font: "inherit",
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: selected ? 700 : 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab, index) => {
        const selected = activeKey === tab.key;
        return (
          <div
            key={tab.key}
            id={`${id}-panel-${tab.key}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${tab.key}`}
            hidden={!selected}
            tabIndex={selected ? 0 : -1}
          >
            {panels[index]}
          </div>
        );
      })}
    </>
  );
}

export default FormTabs;
