import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Jobs renders the captured Opportunity Library rather than legacy discovery listings", async () => {
  const [ui, page, settings] = await Promise.all([readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/[section]/page.tsx", import.meta.url), "utf8")]);
  for (const token of ["CapturedOpportunityLibraryItem", "capturedAt", "originalUrl", "Open original page", "All opportunities", "Add opportunity", "No captured opportunities saved yet"]) assert.ok(`${ui}\n${page}\n${settings}`.includes(token));
  assert.match(page, /listCapturedOpportunities/);
  for (const token of ["listJobListings", "JobListingsView", "sourceRecords", "firstSeenAt", "calculate-fit", "Change duplicate group", "Refresh Run", "Permitted Sources"]) assert.ok(!`${ui}\n${page}\n${settings}`.includes(token));
});

test("Captured opportunity cards preserve local attribution and an explicit outbound handoff", async () => {
  const ui = await readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8");
  for (const token of ["Open original page", "target=\"_blank\"", "rel=\"noreferrer\"", "Submission happens outside this workspace", "Captured ", "No fit guidance yet"]) assert.ok(ui.includes(token));
  assert.doesNotMatch(ui, /fetch\s*\(|setInterval|setTimeout|browser automation|adapter|source configuration|refresh|credential/i);
});

test("Jobs keeps the capture dialog, local search, accessible states, and narrow reflow contracts", async () => {
  const [ui, styles] = await Promise.all([readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/globals.css", import.meta.url), "utf8")]);
  for (const token of ["Search opportunities", "Clear search", "role=\"status\"", "aria-live=\"polite\"", "captureTrigger", "headerCaptureTrigger", "trigger?.isConnected", "<OpportunityCapture open={captureOpen} onClose={closeCapture}", "onReturnToAllOpportunities", "setJobsView(\"all\"); setQuery(\"\"); closeCapture()", "Applied opportunities are not available yet"]) assert.ok(ui.includes(token));
  for (const token of ["copiedDescription", "contentDigest", "revisions.at(-1)"]) assert.ok(!ui.includes(token));
  assert.ok(styles.includes("overflow-wrap: anywhere"));
});
