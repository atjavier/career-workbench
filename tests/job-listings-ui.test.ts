import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Jobs renders the captured Opportunity Library rather than legacy discovery listings", async () => {
  const [ui, page, settings] = await Promise.all([
    readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/[section]/page.tsx", import.meta.url), "utf8"),
  ]);
  for (const token of [
    "CapturedOpportunityLibraryItem",
    "capturedAt",
    "originalUrl",
    "Open original page",
    "All opportunities",
    "Add opportunity",
    "No captured opportunities saved yet",
  ])
    assert.match(
      `${ui} ${page} ${settings}`.replace(/\s+/g, " "),
      new RegExp(token.replace(/\s+/g, " ")),
    );
  assert.match(page, /listCapturedOpportunities/);
  for (const token of [
    "listJobListings",
    "JobListingsView",
    "sourceRecords",
    "firstSeenAt",
    "calculate-fit",
    "Change duplicate group",
    "Refresh Run",
    "Permitted Sources",
  ])
    assert.ok(!`${ui}\n${page}\n${settings}`.includes(token));
});

test("Captured opportunity cards preserve local attribution and an explicit outbound handoff", async () => {
  const ui = await readFile(
    new URL("../src/app/job-listings.tsx", import.meta.url),
    "utf8",
  );
  for (const token of [
    "Open original page",
    'target="_blank"',
    'rel="noreferrer"',
    "Submission happens outside this workspace",
    "Captured ",
    "No fit guidance yet",
  ])
    assert.match(
      ui.replace(/\s+/g, " "),
      new RegExp(token.replace(/\s+/g, " ")),
    );
  assert.doesNotMatch(
    ui,
    /fetch\s*\(|setInterval|setTimeout|browser automation|adapter|source configuration|refresh|credential/i,
  );
});

test("Jobs keeps the capture dialog, local search, accessible states, and narrow reflow contracts", async () => {
  const [ui, styles] = await Promise.all([
    readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const token of [
    "Search opportunities",
    "Clear search",
    'role="status"',
    'aria-live="polite"',
    "captureTrigger",
    "headerCaptureTrigger",
    "trigger?.isConnected",
    "<OpportunityCapture open={captureOpen} onClose={closeCapture}",
    "onReturnToAllOpportunities",
    'setJobsView("all"); setQuery(""); closeCapture()',
    "Applied opportunities are not available yet",
  ])
    assert.ok(ui.replace(/\s+/g, " ").includes(token.replace(/\s+/g, " ")));
  for (const token of [
    "copiedDescription",
    "contentDigest",
    "revisions.at(-1)",
  ])
    assert.ok(!ui.includes(token));
  assert.ok(styles.includes("overflow-wrap: anywhere"));
  assert.match(styles, /\.job-listing-list\s*\{\s*display: grid;/);
  assert.match(
    styles,
    /grid-template-columns:\s*repeat\(auto-fit, minmax\(15\.5rem, 1fr\)\)/,
  );
});

test("Fit explanation requires consent and preserves local-AI provenance and handoff safety", async () => {
  const [ui, assessment] = await Promise.all([
    readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/opportunity-assessment.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  for (const token of [
    "OpportunityAssessment",
    "Fit explanation",
    "Assess fit",
    "local AI decision support",
    "not a hiring prediction",
    "Approved evidence revision",
    "Captured posting excerpt",
    "Safety context",
    "Save personal decision",
    "expectedDecisionId",
    'role="status"',
  ])
    assert.ok(`${ui}\n${assessment}`.includes(token));
  assert.doesNotMatch(
    `${ui}\n${assessment}`,
    /fetch\s*\(|iframe|automation|refresh|source configuration|credential/i,
  );
});

test("Stitch Job Board provides company logo badge, search clear ref, and safe outbound host parsing", async () => {
  const [ui, styles] = await Promise.all([
    readFile(new URL("../src/app/job-listings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const token of [
    "company-logo-badge",
    "job-listing-identity",
    "job-title",
    "jobs-search-box",
    "searchInputRef",
    "handleClearSearch",
    "sourceHost",
    "Return to all opportunities",
  ])
    assert.match(
      ui.replace(/\s+/g, " "),
      new RegExp(token.replace(/\s+/g, " ")),
    );
  assert.match(styles, /\.company-logo-badge\s*\{/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /#opportunity-search::-webkit-search-cancel-button/);
});
