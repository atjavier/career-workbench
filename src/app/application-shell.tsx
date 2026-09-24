import Link from "next/link";
import type { ReactNode } from "react";
import { CompactNavigation } from "@/app/compact-navigation";
import { SidebarCollapseToggle } from "@/app/sidebar-collapse-toggle";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";

export type NavSubItem = {
  href: string;
  label: string;
  description: string;
};

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  subItems?: readonly NavSubItem[];
};

function JobsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const destinations: readonly NavItem[] = [
  {
    href: "/",
    label: "Jobs",
    description: "Review saved opportunities",
    icon: <JobsIcon />,
  },
  {
    href: "/resume",
    label: "Resume",
    description: "Shape your base resume and evidence",
    icon: <ResumeIcon />,
    subItems: [
      {
        href: "/resume",
        label: "Base Resume",
        description: "Coach review & live PDF canvas",
      },
      {
        href: "/evidence",
        label: "Experience & Projects",
        description: "Documented collections & folders",
      },
    ],
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Manage preferences and privacy",
    icon: <SettingsIcon />,
  },
] as const;

export async function ApplicationShell({
  active = "Jobs",
  activeSubItem,
  children,
}: {
  active?: string;
  activeSubItem?: string;
  children: ReactNode;
}) {
  const workspaceState = await readResumeWorkspaceState().catch(() => ({
    workspaces: [],
    activeWorkspace: undefined,
    revisionNumber: 0,
  }));
  const phase = workspaceState.activeWorkspace?.journey?.phase;

  const effectiveSubActive =
    activeSubItem ??
    (active === "Experience & Projects"
      ? "Experience & Projects"
      : active === "Coach Q&A"
        ? "Coach Q&A"
        : active === "Resume"
          ? "Base Resume"
          : active);

  const isResumeActive =
    active === "Resume" ||
    active === "Base Resume" ||
    active === "Experience & Projects" ||
    active === "Coach Q&A" ||
    effectiveSubActive === "Base Resume" ||
    effectiveSubActive === "Coach Q&A" ||
    effectiveSubActive === "Experience & Projects";

  const resumeSubItems: NavSubItem[] = [
    {
      href: "/resume",
      label: "Base Resume",
      description: "Coach review & live PDF canvas",
    },
    ...(phase === "interview"
      ? [
          {
            href: "/resume/interview",
            label: "Coach Q&A",
            description: "Clarification questions & evidence prep",
          },
        ]
      : []),
    {
      href: "/evidence",
      label: "Experience & Projects",
      description: "Documented collections & folders",
    },
  ];

  const effectiveDestinations: readonly NavItem[] = destinations.map(
    (destination) => {
      if (destination.label === "Resume") {
        return {
          ...destination,
          subItems: resumeSubItems,
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

                {destination.subItems && isResumeActive ? (
                  <div className="nav-sub-items" aria-label="Resume sections">
                    {destination.subItems.map((sub) => {
                      const isSubActive = effectiveSubActive === sub.label;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          aria-current={isSubActive ? "page" : undefined}
                          title={sub.description}
                          className={`nav-sub-link ${isSubActive ? "is-active" : ""}`}
                        >
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
