import Link from "next/link";
import type { ReactNode } from "react";
import { CompactNavigation } from "@/app/compact-navigation";
import { SidebarCollapseToggle } from "@/app/sidebar-collapse-toggle";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";

export type NavSubItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
};

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
  subItems?: readonly NavSubItem[];
};

const destinations: readonly NavItem[] = [
  {
    href: "/",
    label: "Jobs",
    description: "Review saved opportunities",
    icon: "▣",
  },
  {
    href: "/resume",
    label: "Resume",
    description: "Shape your base resume and evidence",
    icon: "▤",
    subItems: [
      {
        href: "/resume",
        label: "Base Resume",
        description: "Coach review & live PDF canvas",
        icon: "▤",
      },
      {
        href: "/evidence",
        label: "Experience & Projects",
        description: "Documented collections & folders",
        icon: "🗂",
      },
      {
        href: "/resume/interview",
        label: "Coach Q&A",
        description: "Interactive evidence clarifications",
        icon: "✦",
      },
    ],
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Manage preferences and privacy",
    icon: "⚙",
  },
] as const;

export async function ApplicationShell({
  active = "Jobs",
  children,
}: {
  active?: string;
  children: ReactNode;
}) {
  const workspaceState = await readResumeWorkspaceState().catch(() => ({
    workspaces: [],
    activeWorkspace: undefined,
    revisionNumber: 0,
  }));
  const phase = workspaceState.activeWorkspace?.journey?.phase;
  const isInterviewFinished =
    phase === "ready_to_generate" || phase === "ready_for_preview";

  const isResumeActive =
    active === "Resume" ||
    active === "Base Resume" ||
    active === "Experience & Projects" ||
    active === "Coach Q&A";

  const effectiveDestinations: readonly NavItem[] = destinations.map(
    (destination) => {
      if (destination.label === "Resume" && !isInterviewFinished) {
        return {
          href: destination.href,
          label: destination.label,
          description: destination.description,
          icon: destination.icon,
        };
      }
      return destination;
    },
  );

  return (
    <div className="application-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="app-header" aria-label="Workspace navigation">
        <div className="app-brand-row">
          <div className="app-brand">
            <span className="brand-mark" aria-hidden="true" />
            <Link href="/" className="brand-link">
              Career Workspace
            </Link>
          </div>
          <SidebarCollapseToggle />
        </div>
        <CompactNavigation
          destinations={effectiveDestinations}
          active={active}
        />
        <nav className="primary-navigation" aria-label="Primary navigation">
          {effectiveDestinations.map((destination) => {
            const isMainActive =
              destination.label === "Resume"
                ? isResumeActive
                : active === destination.label;

            return (
              <div key={destination.href} className="nav-group">
                <Link
                  href={destination.href}
                  aria-current={isMainActive ? "page" : undefined}
                  title={destination.description}
                  className={`nav-item-link ${isMainActive ? "is-active" : ""}`}
                >
                  <span className="navigation-icon" aria-hidden="true">
                    {destination.icon}
                  </span>
                  <span className="nav-label">{destination.label}</span>
                </Link>

                {destination.subItems &&
                isResumeActive &&
                isInterviewFinished ? (
                  <div className="nav-sub-items" aria-label="Resume sections">
                    {destination.subItems.map((sub) => {
                      const isSubActive =
                        active === sub.label ||
                        (active === "Resume" && sub.label === "Base Resume");
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          aria-current={isSubActive ? "page" : undefined}
                          title={sub.description}
                          className={`nav-sub-link ${isSubActive ? "is-active" : ""}`}
                        >
                          <span className="sub-nav-icon" aria-hidden="true">
                            {sub.icon}
                          </span>
                          <span className="sub-nav-label">{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="app-sidebar-footer">
          <span className="app-local-status">Private, local mode</span>
          <span className="app-sidebar-help">
            Your data stays on this device.
          </span>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export const applicationDestinations = destinations;
