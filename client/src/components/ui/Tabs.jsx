import React, { useId, useRef } from "react";
import { cx } from "./utils";

// WAI-ARIA tabs with automatic activation: arrow keys, Home and End move and select.
// Render the selected panel with <TabPanel> using the same `idBase`.
export function Tabs({ tabs, value, onChange, label, idBase, className }) {
  const generated = useId();
  const base = idBase || generated;
  const refs = useRef({});
  const move = (event, index) => {
    const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = tabs[(keys[event.key] + tabs.length) % tabs.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cx("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => { refs.current[tab.id] = node; }}
            type="button" role="tab" id={`${base}-tab-${tab.id}`} aria-selected={selected}
            aria-controls={`${base}-panel-${tab.id}`} tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)} onKeyDown={(event) => move(event, index)}
            className={cx(
              "-mb-px inline-flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-ui",
              selected ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink-secondary",
            )}
          >
            {tab.label}
            {tab.count != null && <span className="tabular rounded-control bg-hover px-1.5 text-xs text-ink-secondary">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, id, className, children }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} tabIndex={0} className={cx("pt-5", className)}>
      {children}
    </div>
  );
}
