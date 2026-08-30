import Link from "next/link";
import type { ReactNode } from "react";
import { CompactNavigation } from "@/app/compact-navigation";
import { SidebarCollapseToggle } from "@/app/sidebar-collapse-toggle";

const destinations = [
  {
    href: "/",
    label: "Jobs",
    description: "Review saved opportunities",
    icon: "▣",
  },
  {
    href: "/resume",
    label: "Resume",
    description: "Shape your materials",
    icon: "▤",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Manage preferences and privacy",
    icon: "⚙",
  },
] as const;

export function ApplicationShell({
  active = "Jobs",
  children,
}: {
  active?: string;
  children: ReactNode;
}) {
  return (
    <div className="application-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="app-header" aria-label="Workspace navigation">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div className="brand-text">
            <span className="brand-overline">Workspace</span>
            <Link href="/" className="brand-link">
              Career Workspace
            </Link>
            <span className="brand-subtitle">Private, local mode</span>
          </div>
          <SidebarCollapseToggle />
        </div>
        <CompactNavigation destinations={destinations} active={active} />
        <nav className="primary-navigation" aria-label="Primary navigation">
          {destinations.map((destination) => (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={active === destination.label ? "page" : undefined}
              title={destination.description}
            >
              <span className="navigation-icon" aria-hidden="true">
                {destination.icon}
              </span>
              <span className="nav-label">{destination.label}</span>
            </Link>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <span className="app-local-status">Your workspace — local</span>
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
