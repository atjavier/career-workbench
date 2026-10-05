import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ContentCard,
  WorkspaceContainer,
} from "../src/components/common/layout-containers";

test("workspace containers render defaults and forward landmarks and content", () => {
  const html = renderToStaticMarkup(
    createElement(
      WorkspaceContainer,
      { id: "workspace", className: "jobs-page-shell", "aria-label": "Jobs" },
      createElement("h1", null, "Saved jobs"),
    ),
  );
  assert.match(html, /id="workspace"/);
  assert.match(html, /aria-label="Jobs"/);
  assert.match(html, /class="workspace-container workspace-container-page jobs-page-shell"/);
  assert.match(html, /<h1>Saved jobs<\/h1>/);
  assert.doesNotMatch(html, /style=|workspace-shell/);
  const studio = renderToStaticMarkup(createElement(WorkspaceContainer, { mode: "studio" }));
  assert.match(studio, /class="workspace-container workspace-container-studio"/);
});

test("content cards retain semantic sections and interactive list item props", () => {
  const section = renderToStaticMarkup(
    createElement(ContentCard, { as: "section", id: "profile", "aria-labelledby": "profile-title" },
      createElement("h2", { id: "profile-title" }, "Profile")),
  );
  assert.match(section, /^<section /);
  assert.match(section, /class="content-card"/);
  assert.match(section, /aria-labelledby="profile-title"/);
  assert.match(section, /<h2 id="profile-title">Profile<\/h2><\/section>$/);

  let activated = false;
  const onClick = () => { activated = true; };
  const onKeyDown = () => { activated = true; };
  const item = ContentCard({ as: "li", className: "experience-project-row", role: "button", tabIndex: 0, onClick, onKeyDown, children: "Evidence" });
  assert.equal(item.type, "li");
  assert.equal(item.props.role, "button");
  assert.equal(item.props.tabIndex, 0);
  assert.equal(item.props.onClick, onClick);
  assert.equal(item.props.onKeyDown, onKeyDown);
  item.props.onKeyDown();
  assert.equal(activated, true);
  assert.match(renderToStaticMarkup(item), /class="content-card experience-project-row"/);
});

test("major routes adopt shared containers without raw shell wrappers", async () => {
  const paths = [
    "src/app/page.tsx",
    "src/components/resume/resume-workspace.tsx",
    "src/components/resume/resume-profile-workspace.tsx",
    "src/components/evidence/experience-projects-workspace.tsx",
    "src/components/evidence/experience-projects-details-workspace.tsx",
    "src/app/resume/interview/page.tsx",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /<WorkspaceContainer/, path);
    assert.doesNotMatch(source, /workspace-shell/, path);
  }
});

test("shared CSS separates page scrolling from studio height and owns responsive spacing", async () => {
  const styles = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const rule = (selector: string) => {
    const start = styles.indexOf(`${selector} {`);
    assert.ok(start >= 0, selector);
    return styles.slice(start, styles.indexOf("}", start));
  };
  const base = rule(".workspace-container");
  assert.match(base, /box-sizing: border-box/);
  assert.match(base, /min-width: 0/);
  assert.match(base, /padding: var\(--workspace-padding-block\) var\(--workspace-padding-inline\) var\(--workspace-padding-end\)/);
  const page = rule(".workspace-container-page");
  assert.match(page, /height: auto/);
  assert.match(page, /max-height: none/);
  assert.match(page, /overflow: visible/);
  const studio = rule(".workspace-container-studio");
  assert.match(studio, /flex: 1 1 auto/);
  assert.match(studio, /height: 100%/);
  assert.match(studio, /overflow: hidden/);
  assert.match(styles, /main:has\(\.workspace-container-studio\)/);
  assert.match(rule(".content-card"), /padding: var\(--content-card-padding\)/);
  assert.match(styles, /@media \(max-width: 40rem\) \{\s*:root \{[^}]*--workspace-padding-inline: 1rem;[^}]*--content-card-padding: 1rem;/);
  assert.doesNotMatch(styles, /workspace-shell|:not\(\.resume-onboarding-workspace\)/);
});
