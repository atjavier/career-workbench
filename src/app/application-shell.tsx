import Link from "next/link";
import type { ReactNode } from "react";
import { CompactNavigation } from "@/app/compact-navigation";

const destinations = [
  { href: "/", label: "Jobs", description: "Review saved opportunities" },
  { href: "/resume", label: "Resume", description: "Shape your materials" },
  { href: "/settings", label: "Settings", description: "Manage preferences and privacy" },
] as const;

export function ApplicationShell({ active = "Jobs", children }: { active?: string; children: ReactNode }) {
  return <div className="application-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header">
      <div className="app-brand"><span className="brand-mark" aria-hidden="true" /><Link href="/" className="brand-link">Career Workspace</Link></div>
      <CompactNavigation destinations={destinations} active={active} />
      <nav className="primary-navigation" aria-label="Primary navigation">
        {destinations.map((destination) => <Link key={destination.href} href={destination.href} aria-current={active === destination.label ? "page" : undefined} title={destination.description}>{destination.label}</Link>)}
      </nav>
      <span className="app-local-status">Your workspace — local</span>
    </header>
    <main id="main-content" tabIndex={-1}>{children}</main>
  </div>;
}

export const applicationDestinations = destinations;
