// Small helpers shared by the UI components.
export const cx = (...classes) => classes.filter(Boolean).join(" ");

// Shared look for text inputs, selects and textareas.
export const controlClass = cx(
  "block w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink",
  "placeholder:text-ink-muted transition-ui focus-visible:border-brand",
  "disabled:cursor-not-allowed disabled:bg-hover disabled:text-ink-muted",
);

// Lengths are counted in code points, matching the server's limits.
export const charCount = (value) => [...(value || "")].length;
