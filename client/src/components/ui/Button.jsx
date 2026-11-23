import React, { forwardRef } from "react";
import { LoaderCircle } from "lucide-react";
import Icon from "./Icon";
import { cx } from "./utils";

const VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-hover border border-transparent",
  secondary: "bg-surface text-ink-secondary border border-line-strong hover:bg-hover",
  ghost: "bg-transparent text-ink-secondary border border-transparent hover:bg-hover",
  danger: "bg-danger text-white border border-transparent hover:bg-[#912018]",
};
const SIZES = {
  sm: { text: "h-8 px-3 gap-1.5", square: "h-8 w-8" },
  md: { text: "h-9 px-4 gap-2", square: "h-9 w-9" },
};

// One button for the whole app. Icon-only buttons need an aria-label.
const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", icon, iconRight, loading = false, disabled, type = "button", className, children, ...rest },
  ref,
) {
  const iconOnly = !children;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-control text-sm font-medium transition-ui",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant], iconOnly ? SIZES[size].square : SIZES[size].text, className,
      )}
      {...rest}
    >
      {loading ? <Icon icon={LoaderCircle} className="animate-spin" /> : icon && <Icon icon={icon} />}
      {children}
      {iconRight && !loading && <Icon icon={iconRight} />}
    </button>
  );
});

export default Button;
