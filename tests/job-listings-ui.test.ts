import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Jobs surface exposes a truthful local Opportunity Library and accessible duplicate confirmation", async () => {
  const [ui, page, actions] = await Promise.all([readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8")]);
  for (const text of ["Your opportunities", "Add opportunity", "All opportunities", "Applied", "Original page", "Unknown", "Confirm duplicate change", "Reverse duplicate change", "Safe next action:"]) assert.match(ui, new RegExp(text.replace(/[.?]/g, "\\$&")));
  assert.match(ui, /useActionState/); assert.match(ui, /role="status"/); assert.match(ui, /aria-live="polite"/); assert.match(ui, /toLocaleDateString/); assert.match(page, /<JobListings/); assert.match(actions, /jobListingsAction/);
  assert.match(ui, /<form action=\{action\} id=\{`duplicate-confirmation-/);
  assert.doesNotMatch(ui, /fetch\s*\(|setInterval|setTimeout|automatic refresh|Retry now|crawler|browser automation/i);
});

test("Jobs home leads with local search, filters, result context, and truthful empty states", async () => {
  const ui = await readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8");
  for (const text of ["Search opportunities", "All fits", "Strong fit", "Potential fit", "Clear filters", "matching saved opportunities", "No saved opportunities match your current search or filters", "No opportunities saved yet"]) assert.match(ui, new RegExp(text));
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /filteredListings/);
  for (const text of ["No opportunities saved yet", "No saved opportunities match your current search or filters"]) assert.match(ui, new RegExp(text));
  for (const text of ["Refresh Run", "Permitted Sources", "Choose a permitted source", "sourceRecords.map"]) assert.doesNotMatch(ui, new RegExp(text.replace(/[.?]/g, "\\$&")));
});

test("Job cards expose a safe external handoff without discovery provenance", async () => {
  const ui = await readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8");
  for (const text of ["Open original page", "Submission happens outside this workspace", "target=\"_blank\"", "rel=\"noreferrer\""]) assert.match(ui, new RegExp(text));
  assert.match(ui, /sourceRecords\.find\(\(record\) => record\.jobListingId === listing\.id\)/);
  for (const text of ["retained source records", "Source revision", "First seen", "last observed"]) assert.doesNotMatch(ui, new RegExp(text));
});

test("Jobs preserves error truthfulness, inline duplicate confirmation, and narrow reflow", async () => {
  const [ui, domain, styles] = await Promise.all([readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"), readFile(new URL("../src/domain/discovery/job-listings.ts", import.meta.url), "utf8"), readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")]);
  assert.match(ui, /error \? <p className="status status-error"/);
  assert.match(domain, /jobListingId: string/);
  assert.match(ui, /aria-expanded/);
  assert.doesNotMatch(ui, /aria-modal/);
  assert.match(styles, /overflow-wrap: anywhere/);
});

test("Jobs uses the canonical Browse visual frame while retaining a manual local library", async () => {
  const [shell, ui, page, styles] = await Promise.all([readFile(new URL("../src/app/application-shell.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")]);
  for (const text of ["brand-mark", "app-local-status", "jobs-workspace-header", "jobs-subnavigation", "opportunity-capture", "job-listing-saved", "job-fit"]) assert.match(`${shell}\n${ui}`, new RegExp(text));
  assert.doesNotMatch(page, /workspace-header/);
  for (const token of ["#F5F7F3", "#14382A", "#2F7058", "min-height: 70px", "font-size: 31px", "padding: 36px 24px 70px", "OpportunityCapture open={captureOpen}", "view.hasListings ? <>"]) assert.ok(`${styles}\n${ui}`.includes(token));
  for (const token of ["state.status !== \"idle\"", "status.status-error", "width: min(640px, calc(100% - 48px))", "flex-direction: row"]) assert.ok(`${styles}\n${ui}`.includes(token));
});

test("Add opportunity opens one retained modal capture flow from either Jobs view", async () => {
  const ui = await readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8");
  for (const text of ["captureTrigger", "captureOpen", "setCaptureOpen(true)", "<OpportunityCapture open={captureOpen} onClose={closeCapture}", "captureTrigger.current = event.currentTarget", "requestAnimationFrame(() => captureTrigger.current?.focus())"]) assert.ok(ui.includes(text));
  assert.match(ui, /view\.hasListings \|\| jobsView === "applied" \|\| error \? <button className="affirmative-action add-opportunity-action"/);
  assert.match(ui, /!view\.hasListings \? <section className="jobs-empty-state jobs-library-empty"/);
  assert.doesNotMatch(ui, /href="#opportunity-capture"/);
});

test("active Jobs action feedback keeps retired discovery terms out of the local Opportunity Library", async () => {
  const [actions, listings, fit] = await Promise.all([readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8"), readFile(new URL("../src/domain/discovery/job-listings.ts", import.meta.url), "utf8"), readFile(new URL("../src/domain/fit/fit-assessment.ts", import.meta.url), "utf8")]);
  assert.match(actions, /saved opportunity's duplicate grouping was changed locally/);
  for (const source of [actions, listings, fit]) assert.doesNotMatch(source, /Refresh Job Listings/);
  assert.doesNotMatch(actions, /Retained source records are unchanged/);
});
