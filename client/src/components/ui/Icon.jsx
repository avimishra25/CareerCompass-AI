import React from "react";

// lucide icon with the design-system defaults: 16px (20px in navigation), stroke 1.75.
// Decorative by default; pass `label` when the icon is the only content that carries meaning.
export default function Icon({ icon: Glyph, size = 16, label, className, ...rest }) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      className={className}
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      {...rest}
    />
  );
}
