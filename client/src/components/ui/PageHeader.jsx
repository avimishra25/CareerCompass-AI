import React from "react";
import { cx } from "./utils";

// Page title, one-sentence description and the page's actions (one primary at most).
export default function PageHeader({ title, description, actions, className }) {
  return (
    <header className={cx("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
