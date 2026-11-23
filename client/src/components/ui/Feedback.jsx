import React from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import Button from "./Button";
import Icon from "./Icon";
import { cx } from "./utils";

// Icon + one sentence + one action. For lists and pages with nothing to show yet.
export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cx("flex flex-col items-center px-4 py-10 text-center", className)}>
      {icon && (
        <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-hover text-ink-secondary">
          <Icon icon={icon} size={20} />
        </span>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Placeholder blocks while data loads. With `label`, the group is announced as a status.
export function Skeleton({ className, lines = 1, label }) {
  const blocks = Array.from({ length: lines }, (_, index) => (
    <div key={index} aria-hidden="true"
      className={cx("animate-pulse rounded-control bg-track", lines > 1 && index === lines - 1 && "w-2/3", className || "h-4")} />
  ));
  if (!label) return lines > 1 ? <div className="space-y-2">{blocks}</div> : blocks[0];
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">{label}</span>
      {blocks}
    </div>
  );
}

const ALERT = {
  danger: { icon: CircleAlert, className: "border-[#FECDCA] bg-danger-tint text-danger" },
  warning: { icon: TriangleAlert, className: "border-[#FEDF89] bg-warning-tint text-warning" },
  success: { icon: CircleCheck, className: "border-[#ABEFC6] bg-success-tint text-success" },
  info: { icon: Info, className: "border-[#99F6E4] bg-brand-tint text-brand" },
};

// Inline message in place of alert() and loose red text. Errors are announced immediately.
export function InlineAlert({ tone = "danger", title, children, action, onDismiss, className }) {
  const { icon, className: toneClass } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-card border px-4 py-3 text-sm", toneClass, className)}>
      <Icon icon={icon} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "text-ink-secondary")}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && <Button variant="ghost" size="sm" icon={X} aria-label="Dismiss" onClick={onDismiss} className="-my-1 -mr-2" />}
    </div>
  );
}
