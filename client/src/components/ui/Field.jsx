import React, { useId } from "react";
import { ChevronDown } from "lucide-react";
import Icon from "./Icon";
import { charCount, controlClass, cx } from "./utils";

// Label, hint and error wiring shared by Input, Select and Textarea.
function Field({ id, label, hint, error, counter, hideLabel, className, children }) {
  const hintId = hint || counter ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx("min-w-0", className)}>
      {label && (
        <label htmlFor={id} className={cx("mb-1.5 block text-sm font-medium text-ink-secondary", hideLabel && "sr-only")}>{label}</label>
      )}
      {children([hintId, errorId].filter(Boolean).join(" ") || undefined)}
      {(hint || counter) && (
        <div id={hintId} className="mt-1.5 flex justify-between gap-3 text-xs text-ink-muted">
          <span>{hint}</span>
          {counter}
        </div>
      )}
      {error && <p id={errorId} className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Input({ id, label, hint, error, hideLabel, className, inputClassName, ...rest }) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <Field id={inputId} label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      {(describedBy) => (
        <input id={inputId} aria-describedby={describedBy} aria-invalid={error ? true : undefined}
          className={cx(controlClass, "h-9", error && "border-danger", inputClassName)} {...rest} />
      )}
    </Field>
  );
}

export function Select({ id, label, hint, error, hideLabel, options, className, selectClassName, children, ...rest }) {
  const generated = useId();
  const selectId = id || generated;
  return (
    <Field id={selectId} label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      {(describedBy) => (
        <div className="relative">
          <select id={selectId} aria-describedby={describedBy} aria-invalid={error ? true : undefined}
            className={cx(controlClass, "h-9 appearance-none pr-9", error && "border-danger", selectClassName)} {...rest}>
            {options ? options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : children}
          </select>
          <Icon icon={ChevronDown} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        </div>
      )}
    </Field>
  );
}

// `maxLength` here is the server's limit: the counter shows it, and going over turns the counter red
// (the text is not cut, so pasted text is never silently lost).
export function Textarea({ id, label, hint, error, hideLabel, maxLength, value, rows = 5, className, textareaClassName, ...rest }) {
  const generated = useId();
  const areaId = id || generated;
  const count = charCount(value);
  const over = maxLength != null && count > maxLength;
  const counter = maxLength != null
    ? <span className={cx("tabular shrink-0", over && "font-medium text-danger")}>{count} / {maxLength} characters</span>
    : null;
  return (
    <Field id={areaId} label={label} hint={hint} error={error} counter={counter} hideLabel={hideLabel} className={className}>
      {(describedBy) => (
        <textarea id={areaId} rows={rows} value={value} aria-describedby={describedBy} aria-invalid={error || over ? true : undefined}
          className={cx(controlClass, "py-2 leading-5", (error || over) && "border-danger", textareaClassName)} {...rest} />
      )}
    </Field>
  );
}
