import React, { useEffect, useState } from "react";
import { Skeleton } from "./Feedback";
import { cx } from "./utils";

export const SLOW_AFTER_MS = 8000;
export const SLOW_MESSAGE = "Waking up the server, this can take up to a minute on first load.";

// True once `active` has stayed true for `delay` ms (resets when it turns false).
export function useSlowNotice(active, delay = SLOW_AFTER_MS) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) { setSlow(false); return undefined; }
    const timer = setTimeout(() => setSlow(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return slow;
}

// Page or section loading: skeleton blocks, then a plain explanation if the backend is cold
// (the free hosting tiers sleep when idle).
export default function LoadingState({ label = "Loading", rows = 3, className }) {
  const slow = useSlowNotice(true);
  return (
    <div role="status" aria-live="polite" className={cx("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={index === 0 ? "h-24" : "h-16"} />
      ))}
      {slow && <p className="text-sm text-ink-secondary">{SLOW_MESSAGE}</p>}
    </div>
  );
}
