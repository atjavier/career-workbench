import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OpportunityCreateForm } from "../src/components/jobs/opportunity-create-form";

test("Add opportunity starts with URL and description and one direct save action", () => {
  const html = renderToStaticMarkup(createElement(OpportunityCreateForm));
  for (const name of ["postingUrl", "copiedDescription"]) assert.ok(html.includes(`name="${name}"`));
  assert.ok(!html.includes('name="title"'));
  assert.match(html, /Add opportunity/); assert.doesNotMatch(html, /Enter details manually/); assert.match(html, /Cancel/);
  assert.match(html, /does not retrieve/);
  assert.doesNotMatch(html, /Generate draft|Review opportunity|Import job|Review capture|local draft|<dialog/i);
});
test("library links to the add page, and save validates before redirecting", async () => {
  const [jobs, empty, page, actions, form] = await Promise.all([
    readFile("src/components/jobs/job-listings.tsx", "utf8"),
    readFile("src/components/jobs/opportunity-empty-state.tsx", "utf8"),
    readFile("src/app/opportunities/new/page.tsx", "utf8"),
    readFile("src/app/opportunities/actions.ts", "utf8"),
    readFile("src/components/jobs/opportunity-create-form.tsx", "utf8"),
  ]);
  for (const source of [jobs, empty]) assert.match(source, /href="\/opportunities\/new"/);
  assert.match(page, /PageHeader title="Add opportunity"/);
  assert.match(actions, /createFormattedOpportunity/);
  assert.match(form, /sourceSnapshot/);
  assert.match(form, /role="alert"/);
  assert.match(form, /disabled=\{pending\}/);
  assert.doesNotMatch(jobs, /OpportunityCapture|captureOpen|openCapture/);
});

test("paste extraction fills stated job fields without retrieval", async () => {
  const { opportunityDetailsFromDescription } = await import("../src/domain/opportunities/capture-draft");
  const details = opportunityDetailsFromDescription("Role: Engineer\nCompany: Studio\nLocation: Remote\nWork style: Remote\nRequirements\n- Build accessible web applications\n- Collaborate with product designers");
  assert.equal(details.title, "Engineer");
  assert.equal(details.company, "Studio");
  assert.equal(details.location, "Remote");
  assert.deepEqual(details.requirements, ["Build accessible web applications", "Collaborate with product designers"]);
});
