import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("evidence intake provides actionable next-step routing and Base Resume warns when stale", async () => {
  const [actions, library, coach, styles] = await Promise.all([
    readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-coach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  // Actions provide nextUrl routing based on journey phase
  assert.match(actions, /nextUrl\s*=\s*["']\/resume\/interview["']/);
  assert.match(actions, /nextUrl\s*=\s*["']\/resume["']/);
  assert.match(actions, /safeNextAction/);

  // Evidence library renders the actionable banner and CTA link
  assert.match(library, /evidence-action-banner/);
  assert.match(library, /action-banner-cta/);
  assert.match(library, /Go to Coach Q&A →/);
  assert.match(library, /Go to Resume →/);

  // Resume Coach renders the stale status pill and update alert when generationNeeded is true
  assert.match(coach, /preview-status-stale/);
  assert.match(coach, /Out of date — Changes detected/);
  assert.match(coach, /resume-update-alert/);
  assert.match(coach, /Resume update available/);

  // CSS contains the styling rules for the alert and banner
  assert.match(styles, /\.preview-status-stale/);
  assert.match(styles, /\.resume-update-alert/);
  assert.match(styles, /\.evidence-action-banner/);
  assert.match(styles, /\.action-banner-cta/);
});

test("removing a documented project prompts regeneration and detects changes", async () => {
  const actions = await readFile(
    new URL("../src/app/actions.ts", import.meta.url),
    "utf8",
  );

  // Deleting documented item routes to /resume and notifies of changes detected
  assert.match(actions, /command === "delete-documented-item"/);
  assert.match(
    actions,
    /Changes detected — your base resume needs updating/,
  );
  assert.match(
    actions,
    /safeNextAction\s*=\s*["']Go to Resume to regenerate your draft with updated evidence\.["']/,
  );
});

test("Base Resume remains accessible across journey phases and documentation displays clear loading feedback", async () => {
  const [shell, workspace, coach, library, styles] = await Promise.all([
    readFile(new URL("../src/app/application-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-coach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  // ApplicationShell retains Resume sub-items and includes Coach Q&A when interview phase is active
  assert.match(shell, /resumeSubItems/);
  assert.match(shell, /phase === "interview"/);
  assert.match(shell, /label: "Coach Q&A"/);
  assert.match(shell, /destination\.subItems && isResumeActive/);

  // ResumeWorkspace preserves access to existing draft even if interview or documenting is in flight
  assert.match(
    workspace,
    /!draftState\.draft\s*&&\s*\["documenting",\s*"interview",\s*"recovery"\]/,
  );
  assert.match(workspace, /hasPendingInterview/);

  // ResumeCoach displays Coach Q&A link in update alert when clarification questions are pending
  assert.match(coach, /hasPendingInterview/);
  assert.match(coach, /Coach Q&A/);

  // Evidence documentation modal provides an accessible loading status indicator
  assert.match(library, /modal-documenting-status/);
  assert.match(library, /Documenting with local AI…/);
  assert.match(library, /modal-documenting-spinner/);
  assert.match(library, /disabled=\{pending\}/);

  // CSS contains the styling for the documentation modal loading state and spinner
  assert.match(styles, /\.modal-documenting-status/);
  assert.match(styles, /\.modal-documenting-spinner/);
  assert.match(styles, /\.btn-spinner/);
});


