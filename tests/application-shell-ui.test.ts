import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("application shell presents Jobs first with human-facing destinations", async () => {
  const shell = await readFile(
    new URL("../src/components/common/application-shell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(shell, /Jobs/);
  for (const label of ["Resume", "Settings", "Review saved opportunities"])
    assert.match(shell, new RegExp(label));
  for (const label of [
    "Applications",
    "Evidence Library",
    "Google Sheets",
    "Career Assistant",
  ])
    assert.doesNotMatch(shell, new RegExp(`label: "${label}"`));
  const sidebar = await readFile(new URL("../src/components/common/workspace-sidebar.tsx", import.meta.url), "utf8");
  assert.match(sidebar, /aria-current/);
  assert.match(shell, /Skip to main content/);
  assert.match(sidebar, /app-sidebar-footer/);
  assert.match(sidebar, /navigation-icon/);
  assert.match(sidebar, /Private, local mode/);
});

test("home composition uses the application shell and human product identity", async () => {
  const shell = await readFile(
    new URL("../src/components/common/application-shell.tsx", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../src/app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /ApplicationShell/);
  assert.match(shell, /id="main-content"/);
  assert.match(page, /Jobs/);
  assert.doesNotMatch(page, /<h1>Personal Job Discovery<\/h1>/);
});

test("placeholder destinations retain the shell, route identity, and honest status", async () => {
  const placeholder = await readFile(
    new URL("../src/app/[section]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(placeholder, /<ApplicationShell active=\{content\.title\}>/);
  assert.match(placeholder, /This workspace is being prepared/);
  assert.match(placeholder, /generateStaticParams/);
});

test("shell styling uses the approved premium header and visible focus token", async () => {
  const styles = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(styles, /--header: rgb\(255 255 255 \/ 0\.7\)/);
  assert.match(styles, /--primary: #0058be/i);
  assert.match(styles, /--focus-ring: #005ac2/i);
  assert.match(styles, /outline: 3px solid var\(--focus-ring\)/);
  assert.match(styles, /input\[type="checkbox"\]/);
});

test("application shell removes Resume sub-items when no workspace is active and routes redirect to default /resume", async () => {
  const [shell, evidencePage, interviewPage, detailsPage, workspace] = await Promise.all([
    readFile(new URL("../src/components/common/application-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume/interview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence/details/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/resume/resume-workspace.tsx", import.meta.url), "utf8"),
  ]);

  // destinations does not statically attach subItems to Resume
  assert.doesNotMatch(shell, /subItems:\s*\[\s*\{\s*href:\s*"\/evidence"/);

  // Shell conditionally provides subItems only when an active workspace exists
  assert.match(shell, /hasActiveResumeWorkspace\s*=\s*Boolean\(workspaceState\.activeWorkspace\)/);
  assert.match(shell, /subItems:\s*hasActiveResumeWorkspace\s*\?\s*resumeSubItems\s*:\s*undefined/);

  // Sub-routes redirect to the default /resume when no workspace is active
  assert.match(evidencePage, /if\s*\(!workspaceState\.activeWorkspace\)\s*\{\s*redirect\("\/resume"\)/);
  assert.match(detailsPage, /if\s*\(!workspaceState\.activeWorkspace\)\s*\{\s*redirect\("\/resume"\)/);
  assert.match(interviewPage, /if\s*\(!state\.activeWorkspace\)\s*\{\s*redirect\("\/resume"\)/);

  // Resume default view cleanly handles when no workspace is active
  assert.match(workspace, /if\s*\(!workspaceState\.activeWorkspace\)/);
  assert.match(workspace, /ResumeOnboarding/);
});

test("Loading screen during evidence intake hides sub-tabs and keeps single base Resume tab", async () => {
  const [shell, evidencePage, interviewPage] = await Promise.all([
    readFile(new URL("../src/components/common/application-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume/interview/page.tsx", import.meta.url), "utf8"),
  ]);

  // Shell suppresses resumeSubItems during documenting phase
  assert.match(shell, /isDocumenting\s*=\s*phase === "documenting"/);
  assert.match(shell, /hasActiveResumeWorkspace\s*&&\s*!isDocumenting/);

  // Evidence routes redirect to interview intake screen when documenting
  assert.match(evidencePage, /phase === "documenting"[\s\S]*?redirect\("\/resume\/interview"\)/);

  // Interview page sets active to Resume when still processing
  assert.match(interviewPage, /shouldShowInterview\s*\?\s*"Coach Q&A"\s*:\s*"Resume"/);
});


