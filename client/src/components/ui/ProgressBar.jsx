import React from "react";
import { cx } from "./utils";

const FILL = { brand: "bg-brand", success: "bg-success", warning: "bg-warning", danger: "bg-danger", muted: "bg-ink-muted" };

export default function ProgressBar({ value, min = 0, max = 100, tone = "brand", label, className }) {
  const safe = Number.isFinite(value) ? value : min;
  const percent = max > min ? Math.min(Math.max(((safe - min) / (max - min)) * 100, 0), 100) : 0;
  return (
    <div
      role="progressbar" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={safe}
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-track", className)}
    >
      <div className={cx("h-full rounded-full transition-ui", FILL[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
}
