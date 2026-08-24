import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { captureOpportunityDraft } from "../src/domain/opportunities/capture-draft";
import { opportunityCaptureAction } from "../src/app/actions";
import { listJobListings } from "../src/domain/discovery/job-listings";
import { openDatabase } from "../src/persistence/database";

const copiedDescription = `Product Designer\nCompany: Northstar Studio\nLocation: Makati, Philippines\nWork style: Hybrid\nPosted: 2026-08-20\n\nRequirements\n- Build accessible product experiences\n- Partner with engineering and research\n- Present clear design decisions to stakeholders.`;

async function fixture() { const root = await mkdtemp(join(tmpdir(), "opportunity-capture-")); return { root, appDataRoot: join(root, "private") }; }

test("creates a bounded local capture draft without inferring from the URL", () => {
  const draft = captureOpportunityDraft({ postingUrl: " https://jobs.example.test/role?ref=1 ", copiedDescription, now: () => new Date("2026-08-24T12:00:00.000Z") });
  assert.deepEqual(draft, {
    postingUrl: "https://jobs.example.test/role?ref=1",
    copiedDescription,
    capturedAt: "2026-08-24T12:00:00.000Z",
    title: "Product Designer",
    company: "Northstar Studio",
    location: "Makati, Philippines",
    workStyle: "Hybrid",
    requirements: ["Build accessible product experiences", "Partner with engineering and research", "Present clear design decisions to stakeholders."],
    postedAt: "2026-08-20T00:00:00.000Z",
  });
  const unknown = captureOpportunityDraft({ postingUrl: "https://company.example.test/jobs/senior-design-engineer", copiedDescription: "A deliberately plain posting without labelled company, location, work style, requirements, or posted date. It has enough copied content to validate without permitting the parser to invent anything from the address.", now: () => new Date("2026-08-24T12:00:00.000Z") });
  assert.equal(unknown.company, "Unknown"); assert.equal(unknown.location, "Unknown"); assert.equal(unknown.workStyle, "Unknown"); assert.deepEqual(unknown.requirements, ["Unknown"]); assert.equal(unknown.postedAt, "Unknown");
  const labelled = captureOpportunityDraft({ postingUrl: "https://jobs.example.test/role", copiedDescription: `Job title: Senior Product Designer\nCompany: Northstar Studio\n\nThis is a complete copied job posting with enough detail to be reviewed safely without using facts that came from its URL or another system.`, now: () => new Date("2026-08-24T12:00:00.000Z") });
  assert.equal(labelled.title, "Senior Product Designer");
  const proseFirst = captureOpportunityDraft({ postingUrl: "https://jobs.example.test/role", copiedDescription: `About the role\nCompany: Northstar Studio\n\nThis is a complete copied job posting with enough detail to be reviewed safely without converting its introductory section heading into a job title.`, now: () => new Date("2026-08-24T12:00:00.000Z") });
  assert.equal(proseFirst.title, "Unknown");
});

test("rejects URL and copied-description boundaries with safe capture errors", () => {
  const valid = { postingUrl: "https://jobs.example.test/role", copiedDescription, now: () => new Date("2026-08-24T12:00:00.000Z") };
  for (const postingUrl of ["", "http://jobs.example.test/role", "https://user:pass@jobs.example.test/role", `https://jobs.example.test/${"a".repeat(2049)}`]) assert.throws(() => captureOpportunityDraft({ ...valid, postingUrl }), { code: "OPPORTUNITY_CAPTURE_INVALID" });
  for (const text of [" ", "a".repeat(79), "a".repeat(200001)]) assert.throws(() => captureOpportunityDraft({ ...valid, copiedDescription: text }), { code: "OPPORTUNITY_CAPTURE_INVALID" });
  for (const posted of ["2026-02-30", "2025-02-29", "2026-13-01"]) assert.equal(captureOpportunityDraft({ ...valid, copiedDescription: copiedDescription.replace("2026-08-20", posted) }).postedAt, "Unknown");
  assert.equal(captureOpportunityDraft({ ...valid, copiedDescription: copiedDescription.replace("2026-08-20", "2024-02-29") }).postedAt, "2024-02-29T00:00:00.000Z");
});

test("capture drafts never write opportunity compatibility tables or audit history", async () => {
  const value = await fixture();
  try {
    await listJobListings(value);
    captureOpportunityDraft({ postingUrl: "https://jobs.example.test/role", copiedDescription, now: () => new Date("2026-08-24T12:00:00.000Z") });
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      for (const table of ["job_listings", "retained_job_source_records", "fit_assessments", "audit_events"]) assert.equal((database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count, 0);
    } finally { database.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("capture action returns a serializable review draft and field-specific recovery", async () => {
  const valid = new FormData(); valid.set("postingUrl", "https://jobs.example.test/role"); valid.set("copiedDescription", copiedDescription);
  const success = await opportunityCaptureAction({ status: "idle", summary: "" }, valid);
  assert.equal(success.status, "success"); assert.equal(success.draft?.postingUrl, "https://jobs.example.test/role"); assert.match(success.summary, /Nothing is saved yet/);
  assert.equal(success.submittedPostingUrl, "https://jobs.example.test/role"); assert.equal(success.submittedCopiedDescription, copiedDescription);
  const invalid = new FormData(); invalid.set("postingUrl", "http://jobs.example.test/role"); invalid.set("copiedDescription", copiedDescription);
  const failure = await opportunityCaptureAction({ status: "idle", summary: "" }, invalid);
  assert.equal(failure.status, "error"); assert.ok(failure.fieldErrors?.postingUrl); assert.equal(failure.draft, undefined);
});
