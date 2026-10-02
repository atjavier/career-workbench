import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string | ReactNode;
  subtitle?: ReactNode;
  titleAddon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  titleAddon,
  actions,
  className = "",
  eyebrow,
}: PageHeaderProps) {
  return (
    <header className={`page-header resume-page-head ${className}`.trim()}>
      <div className="resume-head-copy">
        {eyebrow ? (
          <div className="eyebrow-row">
            <p className="eyebrow">{eyebrow}</p>
          </div>
        ) : null}
        <div className="resume-head-title-row">
          {typeof title === "string" ? <h1>{title}</h1> : title}
          {titleAddon}
        </div>
        {subtitle ? (
          typeof subtitle === "string" ? <p>{subtitle}</p> : subtitle
        ) : null}
      </div>
      {actions ? (
        <div className="page-header-actions jobs-header-controls">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
