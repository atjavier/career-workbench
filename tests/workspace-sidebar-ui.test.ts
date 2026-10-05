import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceSidebar } from "../src/components/common/workspace-sidebar";
import type { NavItem } from "../src/components/common/application-shell";

const destinations: NavItem[] = [
  { href: "/", label: "Jobs", description: "Jobs", icon: null,
    subItems: [{ href: "/", label: "All Opportunities", description: "Saved jobs" }, { href: "/applications", label: "Applied", description: "Applied" }] },
  { href: "/resume", label: "Resume", description: "Resume", icon: null,
    subItems: [
      { href: "/resume/profile", label: "Your Details", description: "Details" },
      { href: "/evidence", label: "Experience & Projects", description: "Evidence" },
      { href: "/resume", label: "Resume Preview", description: "Preview" },
    ] },
  { href: "/settings", label: "Settings", description: "Settings", icon: null },
];
const render = (activeSection: string, activeSubItem: string, items = destinations) =>
  renderToStaticMarkup(createElement(WorkspaceSidebar, { destinations: items, activeSection, activeSubItem }));

test("sidebar distinguishes selected workspace from current page and shows only its sections", () => {
  const html = render("Resume", "Your Details");
  assert.match(html, /aria-label="Resume"[^>]*aria-current="location"/);
  assert.match(html, /aria-label="Resume sections"/);
  assert.match(html, /<a(?=[^>]*href="\/resume\/profile")(?=[^>]*aria-current="page")[^>]*>/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.ok(html.indexOf("Your Details</span>") < html.indexOf("Experience &amp; Projects</span>"));
  assert.doesNotMatch(html, /href="\/"[^>]*class="nav-sub-link"/);
  for (const label of ["Jobs", "Resume", "Settings"]) assert.ok(html.includes(`aria-label="${label}"`));
  assert.match(html, /aria-expanded="true" aria-controls="workspace-section-navigation"/);
});

test("Jobs has All Opportunities and Applied while Settings retains a current-page link", () => {
  const jobs = render("Jobs", "All Opportunities");
  assert.match(jobs, /aria-label="Jobs sections"/);
  assert.match(jobs, /aria-current="page"[^>]*href="\/"/);
  assert.match(jobs, /href="\/applications"/);
  assert.doesNotMatch(jobs, /Your Details<\/span>/);
  assert.match(render("Settings", "Settings"), /<a(?=[^>]*href="\/settings")(?=[^>]*aria-current="page")[^>]*>/);
});

test("Resume without available sub-tabs retains a usable Resume link", () => {
  const items = destinations.map(item => item.label === "Resume" ? { ...item, subItems: undefined } : item);
  const html = render("Resume", "Resume Preview", items);
  assert.match(html, /<a(?=[^>]*href="\/resume")(?=[^>]*aria-current="page")[^>]*>/);
  assert.doesNotMatch(html, /href="\/resume\/profile"|href="\/evidence"/);
  assert.match(html, /Current destination: Resume/);
});
