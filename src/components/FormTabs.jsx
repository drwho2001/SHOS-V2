import React, { Children, useId, useRef } from "react";
import { FONT_FAMILY } from "../calculations/designTokens";

/**
 * Accessible tabs for long Add/Edit forms. Panels stay mounted while hidden so
 * controlled fields and picker-local draft text survive a tab change.
 */
export function FormTabs({ tabs, activeKey, onChange, ariaLabel, accent, accentText, textColor, border, surface, tabListPadding = "10px 0 8px", stickyTop = 0, children }) {
  const id = `form-tabs-${useId().replace(/:/g, "")}`;
  const tabRefs = useRef([]);
  const panels = Children.toArray(children);
  const scrollerRef = useRef(null);

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

  // ADDED — real ask: when switching to a tab that has no entered data,
  // scroll to the top so the new tab's fields start from the beginning.
  // The sheet's own scroll container is the nearest scrollable ancestor,
  // so we walk up to the first ancestor with overflow-y scroll/auto and
  // reset its scrollTop. A bare window.scrollTo would miss the sheet
  // container (the sheet is position:fixed with overflowY:auto).
  const handleChange = (key) => {
    const prev = activeKey;
    onChange(key);
    // Defer so the new panel is rendered before we measure/reset.
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      let node = el.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          node.scrollTop = 0;
          break;
        }
        node = node.parentElement;
      }
    });
  };

  return (
    <>
      <div ref={scrollerRef} style={{ display: "contents" }}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        style={{
          position: "sticky",
          top: stickyTop,
          zIndex: 5,
          background: surface,
          display: "flex",
          gap: 6,
          overflowX: "auto",
          padding: tabListPadding,
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
              onClick={() => handleChange(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={{
                flex: "0 0 auto",
                padding: "8px 12px",
                border: `1px solid ${selected ? accent : border}`,
                borderRadius: 999,
                background: selected ? `${accent}15` : surface,
                color: selected ? accentText : textColor,
                font: "inherit",
                fontFamily: FONT_FAMILY,
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
      </div>
    </>
  );
}

export default FormTabs;
