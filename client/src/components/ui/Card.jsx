import React from "react";
import { cx } from "./utils";

const PADDING = { none: "", sm: "p-4", md: "p-4 sm:p-5" };

// White surface, 1px border, 10px radius, subtle shadow. Optional header row.
export default function Card({ as: Tag = "div", padding = "md", title, description, actions, headingLevel = 2, className, children, ...rest }) {
  const Heading = `h${headingLevel}`;
  return (
    <Tag className={cx("rounded-card border border-line bg-surface shadow-card", PADDING[padding], className)} {...rest}>
      {(title || actions) && (
        <div className={cx("flex flex-wrap items-start justify-between gap-3", children && "mb-4")}>
          <div className="min-w-0">
            {title && <Heading className="text-base font-semibold text-ink">{title}</Heading>}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
