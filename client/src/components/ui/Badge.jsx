import React from "react";
import Icon from "./Icon";
import { cx } from "./utils";

const TONES = {
  neutral: "bg-hover text-ink-secondary border-line",
  success: "bg-success-tint text-success border-transparent",
  warning: "bg-warning-tint text-warning border-transparent",
  danger: "bg-danger-tint text-danger border-transparent",
  brand: "bg-brand-tint text-brand border-transparent",
};

export default function Badge({ tone = "neutral", icon, className, children, ...rest }) {
  return (
    <span
      className={cx("inline-flex max-w-full items-center gap-1 rounded-control border px-2 py-0.5 text-xs font-medium", TONES[tone], className)}
      {...rest}
    >
      {icon && <Icon icon={icon} size={12} className="shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}
