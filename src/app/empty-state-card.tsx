"use client";

import type { ReactNode } from "react";

interface EmptyStateCardProps {
  title?: string;
  description: string;
  action?: ReactNode;
  headingLevel?: "h3" | "h4";
  className?: string;
  id?: string;
}

export function EmptyStateCard({
  title,
  description,
  action,
  headingLevel = "h3",
  className = "",
  id,
}: EmptyStateCardProps) {
  const HeadingTag = headingLevel;
  return (
    <div
      id={id}
      className={`jobs-empty-state empty-state-card ${className}`.trim()}
    >
      {title ? <HeadingTag>{title}</HeadingTag> : null}
      <p>{description}</p>
      {action}
    </div>
  );
}
