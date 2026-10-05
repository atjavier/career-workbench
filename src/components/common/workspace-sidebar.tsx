import Link from "next/link";
import { SectionIcon } from "./section-icon";
import type { NavItem } from "./application-shell";
import { CompactNavigation } from "./compact-navigation";
import { SidebarCollapseToggle } from "./sidebar-collapse-toggle";


export function WorkspaceSidebar({ destinations, activeSection, activeSubItem }: {
  destinations: readonly NavItem[];
  activeSection: string;
  activeSubItem: string;
}) {
  const selected = destinations.find(item => item.label === activeSection);
  const sections = selected?.subItems ?? (selected ? [selected] : []);
  return (
    <aside className="app-header" aria-label="Workspace navigation">
      <div className="workspace-icon-rail">
        <Link href="/" className="app-brand" aria-label="Career Workspace home" title="Career Workspace home">
          <svg className="brand-mark" width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M7 8h13l5 5H12L7 8Zm0 8h13l5 5H12l-5-5Zm0 8h13l5 5H12l-5-5Z" fill="currentColor" />
          </svg>
        </Link>
        <nav className="primary-navigation" aria-label="Primary navigation">
          {destinations.map(destination => (
            <Link key={destination.href} href={destination.href}
              aria-label={destination.label} title={destination.label}
              aria-current={activeSection === destination.label ? "location" : undefined}
              className={`nav-item-link${activeSection === destination.label ? " is-active" : ""}`}>
              <span className="navigation-icon" aria-hidden="true">{destination.icon}</span>
            </Link>
          ))}
        </nav>
        <div className="workspace-rail-footer"><SidebarCollapseToggle /></div>
      </div>
      <div className="workspace-section-panel" id="workspace-section-navigation">
        <Link href="/" className="brand-link">Career Workspace</Link>
        <div className="workspace-section-heading">
          <h2>{selected?.label ?? activeSection}</h2>
        </div>
        <nav className="nav-sub-items" aria-label={`${activeSection} sections`}>
          {sections.map(section => (
            <Link key={section.href} href={section.href} title={section.description}
              aria-current={activeSubItem === section.label || (sections.length === 1 && !selected?.subItems) ? "page" : undefined}
              className="nav-sub-link">
              <span className="sub-nav-icon" aria-hidden="true"><SectionIcon label={section.label} /></span>
              <span className="sub-nav-label">{section.label}</span>
            </Link>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <span className="app-local-status">Private, local mode</span>
          <span className="app-sidebar-help">Your data stays on this device.</span>
        </div>
      </div>
      <CompactNavigation destinations={destinations} active={selected?.subItems ? activeSubItem : activeSection} />
    </aside>
  );
}
