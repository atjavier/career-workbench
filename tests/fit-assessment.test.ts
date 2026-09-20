import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  calculateCapturedFitAssessment,
  FIT_RULESET,
} from "../src/domain/fit/fit-assessment";
import { applyMigrations, openDatabase } from "../src/persistence/database";

const preference = {
  id: "00000000-0000-7000-8000-000000000001",
  revisionNumber: 1,
  roleIntents: JSON.stringify(["junior"]),
  country: "PH",
  workStyleOrder: JSON.stringify(["remote", "hybrid", "onsite"]),
  preferNcrHybridOnsite: 1,
  contentDigest: `sha256:${"a".repeat(64)}`,
  createdAt: "2026-08-23T00:00:00.000Z",
};
const evidence = [
  {
    id: "00000000-0000-7000-8000-000000000002",
    evidenceId: "00000000-0000-7000-8000-000000000003",
    revisionNumber: 1,
    origin: "user_entered" as const,
    sourceDocument: "resume.tex",
    sourceSection: "Skills",
    factualText: "Software developer with TypeScript experience",
    reviewState: "approved" as const,
    createdAt: "2026-08-23T00:00:00.000Z",
    contentDigest: `sha256:${"b".repeat(64)}`,
  },
];
const opportunity = {
  id: "00000000-0000-7000-8000-000000000004",
  revisionId: "00000000-0000-7000-8000-000000000005",
  contentDigest: `sha256:${"c".repeat(64)}`,
  title: "Junior Software Developer",
  company: "Example",
  workStyle: "remote",
  location: "Philippines",
  postedAt: "2026-08-20T00:00:00.000Z",
  capturedAt: "2026-08-23T00:00:00.000Z",
  requirements: ["TypeScript software development"],
  copiedDescription: "x".repeat(80),
};

test("calculates an evidence-based deterministic fit from captured requirements", () => {
  const result = calculateCapturedFitAssessment({
    opportunity,
    evidence,
    preference,
    calculatedAt: "2026-08-23T00:00:00.000Z",
  });
  assert.equal(result.rulesetId, FIT_RULESET.id);
  assert.equal(result.label, "Strong");
  assert.equal(result.confidence, "high");
  assert.ok(
    result.factorOutcomes.some(
      (factor) =>
        factor.factor === "requirements" && factor.state === "aligned",
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /interview|offer|hiring|prediction/i,
  );
});

test("unknown requirements and stale postings never become Strong", () => {
  const result = calculateCapturedFitAssessment({
    opportunity: {
      ...opportunity,
      requirements: [],
      postedAt: "2020-01-01T00:00:00.000Z",
    },
    evidence,
    preference,
    calculatedAt: "2026-08-23T00:00:00.000Z",
  });
  assert.notEqual(result.label, "Strong");
  assert.ok(result.factorOutcomes.some((factor) => factor.state === "unknown"));
  assert.ok(result.factorOutcomes.some((factor) => factor.state === "stale"));
});

test("freshness is reproducible from the supplied calculation timestamp", () => {
  const input = {
    opportunity: { ...opportunity, postedAt: "2026-07-25T00:00:00.000Z" },
    evidence,
    preference,
    calculatedAt: "2026-08-23T00:00:00.000Z",
  };
  const first = calculateCapturedFitAssessment(input);
  const second = calculateCapturedFitAssessment(input);
  assert.deepEqual(first.factorOutcomes, second.factorOutcomes);
  assert.equal(first.contentDigest, second.contentDigest);
});

test("country names and NCR preference affect location deterministically", () => {
  const singapore = calculateCapturedFitAssessment({
    opportunity: { ...opportunity, location: "Singapore" },
    evidence,
    preference: { ...preference, country: "SG", preferNcrHybridOnsite: 0 },
    calculatedAt: "2026-08-23T00:00:00.000Z",
  });
  const provincial = calculateCapturedFitAssessment({
    opportunity: {
      ...opportunity,
      workStyle: "hybrid",
      location: "Cebu, Philippines",
    },
    evidence,
    preference,
    calculatedAt: "2026-08-23T00:00:00.000Z",
  });
  assert.equal(
    singapore.factorOutcomes.find((factor) => factor.factor === "location")
      ?.state,
    "aligned",
  );
  assert.equal(
    provincial.factorOutcomes.find((factor) => factor.factor === "location")
      ?.state,
    "mismatch",
  );
});

test("captured fit migration is installed", async () => {
  const root = await mkdtemp(join(tmpdir(), "captured-fit-"));
  const db = openDatabase(join(root, "workspace.sqlite"));
  try {
    applyMigrations(db);
    assert.ok(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'captured_fit_assessments'",
        )
        .get(),
    );
    assert.ok(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'captured_fit_assessment_evidence'",
        )
        .get(),
    );
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
