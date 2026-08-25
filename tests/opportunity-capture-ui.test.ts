import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Opportunity capture is an accessible local review flow, not a source retrieval flow", async () => {
  const [capture, actions, jobs, styles, domain] = await Promise.all([
    readFile(new URL("../src/app/opportunity-capture.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../src/domain/opportunities/capture-draft.ts", import.meta.url), "utf8"),
  ]);
  for (const text of ["Paste the page link and the job description you copied", "Original posting URL", "Copied role details", "Local draft", "Review capture", "Nothing is saved yet", "Confirm and save opportunity", "Return to All opportunities", "original page is attribution only"]) assert.match(capture, new RegExp(text));
  assert.match(capture, /useActionState/); assert.match(capture, /<textarea/); assert.match(capture, /aria-invalid/); assert.match(capture, /aria-describedby/); assert.match(capture, /role="status" aria-live="polite"/); assert.match(capture, /noValidate/); assert.match(capture, /disabled=\{formPending\}/); assert.match(capture, /draftIsCurrent && state\.draft/);
  assert.match(actions, /opportunityCaptureAction/); assert.match(actions, /opportunityConfirmationAction/); assert.match(actions, /captureOpportunityDraft/); assert.match(jobs, /<OpportunityCapture/);
  assert.match(styles, /\.opportunity-capture/); assert.match(styles, /\.opportunity-capture-fields/); assert.match(styles, /\.opportunity-capture-draft/); assert.match(styles, /\.opportunity-confirmation-fields/); assert.match(styles, /\.opportunity-capture-intro/); assert.match(styles, /\.capture-local-status/); assert.match(styles, /\.opportunity-confirmation-field/);
  assert.doesNotMatch(styles, /\.capture-coming-next/);
  for (const source of [capture, domain]) assert.doesNotMatch(source, /fetch\s*\(|window\.open|setInterval|setTimeout|browser automation|source configuration|refresh|adapter|repository|audit/i);
  const captureAction = actions.slice(actions.indexOf("export async function opportunityCaptureAction"), actions.indexOf("export async function opportunityConfirmationAction"));
  assert.doesNotMatch(captureAction, /resolveAppDataPaths|openDatabase|applyMigrations|revalidatePath|importManualJobListing/);
  const confirmationAction = actions.slice(actions.indexOf("export async function opportunityConfirmationAction"), actions.indexOf("export async function initializeWorkspaceAction"));
  assert.doesNotMatch(confirmationAction, /fetch\s*\(|setInterval|setTimeout|window\.open|applyDuplicateOverride|importManualJobListing|adapter|source configuration|refresh/i);
});

test("Opportunity capture uses a focus-safe, centered native modal with vertically ordered compact fields", async () => {
  const [capture, styles] = await Promise.all([readFile(new URL("../src/app/opportunity-capture.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")]);
  for (const text of ["<dialog", "dialogRef", "showModal()", "postingUrlRef.current?.focus()", "method=\"dialog\"", "onCancel", "formPending", "onClose={onClose}", "aria-describedby=\"opportunity-capture-description\"", "captureStateAtSubmission", "onPendingChange(true)", "const saved = state.status === \"success\"", "key={state.draft.capturedAt}", "name=\"capturedAt\"", "onReturnToAllOpportunities = onClose", "onReturnToAllOpportunities", "scrollIntoView({ block: \"start\" })"]) assert.ok(capture.includes(text));
  assert.ok(capture.indexOf("Original posting URL") < capture.indexOf("Copied role details"));
  for (const token of ["border-radius: 15px", "inset: 0", "margin: auto", "position: fixed", "width: min(640px, calc(100% - 48px))", "max-height: calc(100dvh - 48px)", "background: #F8FBF8", "border: 1px solid #C9DDD0", "box-shadow: 0 18px 48px", "position: sticky", "min-height: 44px", "color: #405B50", ".opportunity-capture::backdrop", "rgb(20 56 42 / 32%)", ".opportunity-capture:not([open])", "grid-template-columns: 1fr", "height: clamp(5rem, 18dvh, 7rem)", "min-height: 0", "resize: vertical", "width: calc(100% - 32px)", "max-width: calc(100% - 32px)"]) assert.ok(styles.includes(token));
  assert.doesNotMatch(styles, /width: min\(50vw, 42rem\)|width: min\(40rem, calc\(100vw - 48px\)\)/);
});
