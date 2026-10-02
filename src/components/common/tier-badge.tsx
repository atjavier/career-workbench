"use client";

import type { ReactNode } from "react";

export type TierLevel = "excellent" | "good" | "polish" | "attention";

interface TierBadgeProps {
  level: TierLevel;
  children: ReactNode;
  className?: string;
}

export function TierBadge({ level, children, className = "" }: TierBadgeProps) {
  return (
    <span className={`rating-tier-badge tier-${level} ${className}`.trim()}>
      {children}
    </span>
  );
}

export function fitLabelToTier(
  label?: "Strong" | "Potential" | "Stretch",
): TierLevel {
  switch (label) {
    case "Strong":
      return "excellent";
    case "Potential":
      return "good";
    case "Stretch":
      return "polish";
    default:
      return "good";
  }
}

export function scoreToTier(
  score: number,
): { level: TierLevel; label: string } {
  if (score >= 4.5) return { level: "excellent", label: "Excellent" };
  if (score >= 3.5) return { level: "good", label: "Good" };
  if (score >= 2.5) return { level: "polish", label: "Needs Polish" };
  return { level: "attention", label: "Attention Needed" };
}
