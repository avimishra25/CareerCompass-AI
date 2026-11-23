import React, { cloneElement, useId, useState } from "react";
import { cx } from "./utils";

const SIDES = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

// Shows on hover and keyboard focus, hides on Esc. The trigger is described by the tooltip text.
// `disabled` renders the trigger alone (e.g. when its own label is already visible).
export default function Tooltip({ content, side = "top", disabled = false, className, children }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (disabled || !content) return children;
  return (
    <span
      className={cx("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
    >
      {cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" ") })}
      <span
        role="tooltip" id={id}
        className={cx(
          "pointer-events-none absolute z-50 w-max max-w-xs rounded-control bg-ink px-2 py-1 text-xs font-medium text-white shadow-overlay",
          SIDES[side], open ? "visible opacity-100" : "invisible opacity-0", "transition-ui",
        )}
      >
        {content}
      </span>
    </span>
  );
}
