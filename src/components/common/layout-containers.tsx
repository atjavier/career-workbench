import type { HTMLAttributes } from "react";

type ContainerProps = Omit<HTMLAttributes<HTMLElement>, "style">;

export type WorkspaceContainerProps = ContainerProps & {
  /** Pages scroll naturally; the studio fills the application content area. */
  mode?: "page" | "studio";
};

export function WorkspaceContainer({
  children,
  className = "",
  mode = "page",
  ...props
}: WorkspaceContainerProps) {
  return (
    <div
      {...props}
      className={`workspace-container workspace-container-${mode} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export type ContentCardProps = ContainerProps & {
  as?: "div" | "section" | "article" | "li";
};

export function ContentCard({
  as: Element = "div",
  children,
  className = "",
  ...props
}: ContentCardProps) {
  return (
    <Element {...props} className={`content-card ${className}`.trim()}>
      {children}
    </Element>
  );
}
