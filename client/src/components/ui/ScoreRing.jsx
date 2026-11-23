import React from "react";
import { cx } from "./utils";

const COLORS = { warning: "var(--warning)", brand: "var(--brand)", success: "var(--success)" };

// Below half the scale reads as a warning, three quarters and above as success.
export const scoreTone = (value, max = 100) => {
  const ratio = max ? value / max : 0;
  return ratio < 0.5 ? "warning" : ratio >= 0.75 ? "success" : "brand";
};

export const formatScore = (value, max = 100) => (max <= 10 ? Number(value).toFixed(1) : String(Math.round(value)));

// Single-colour ring with the score in the middle. `label` names the score for screen readers.
export default function ScoreRing({ value, max = 100, size = 64, label = "Score", className }) {
  const known = typeof value === "number" && Number.isFinite(value);
  const stroke = Math.max(4, Math.round(size / 12));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = known ? Math.min(Math.max(value / max, 0), 1) : 0;
  const text = known ? formatScore(value, max) : "–";
  return (
    <div
      role="img"
      aria-label={known ? `${label} ${text} out of ${max}` : `${label} not available`}
      className={cx("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {known && (
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={COLORS[scoreTone(value, max)]} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${circumference * ratio} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span aria-hidden="true" className={cx("absolute tabular font-semibold text-ink", size >= 72 ? "text-lg" : "text-sm")}>{text}</span>
    </div>
  );
}
