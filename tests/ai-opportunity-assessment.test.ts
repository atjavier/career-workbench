import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createUuidV7 } from "../src/audit/audit-event";
import { assessCapturedOpportunity } from "../src/domain/fit/ai-opportunity-assessment";
import { confirmCapturedOpportunity } from "../src/domain/opportunities/captured-opportunities";
import { saveCandidateProfile } from "../src/domain/resume-generation/candidate-profile-commands";
import { configureLocalModel } from "../src/domain/resume-generation/local-model-configuration-commands";
import { createResumeWorkspace } from "../src/domain/resume-generation/resume-workspace-commands";
import { openDatabase } from "../src/persistence/database";

const hash = (value: unknown) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const modelList = () =>
  new Response(
    JSON.stringify({
      models: [
        {
          type: "llm",
          key: "qwen/qwen3.5-9b",
          display_name: "Qwen3.5-9B",
          params_string: "9B",
          loaded_instances: [{ id: "one", context_length: 30000 }],
        },
      ],
    }),
    { status: 200 },
  );

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ai-assessment-"));
  const appDataRoot = join(root, "private");
  const workspace = await createResumeWorkspace({
    appDataRoot,
    name: "Assessment test",
  });
  const profile = await saveCandidateProfile({
    appDataRoot,
    values: {
      firstName: "Adrian",
      lastName: "Javier",
      email: "adrian@example.test",
      phone: "+639171234567",
      school: "Northstar University",
      program: "Product Design",
      graduationYear: "2026",
    },
  });
  const captured = await confirmCapturedOpportunity({
    appDataRoot,
    postingUrl: "https://jobs.example.test/product-designer",
    copiedDescription:
      "Product Designer role at Northstar Studio with accessibility, research, and collaboration responsibilities. This copied description is intentionally long enough to be a valid local capture.",
    capturedAt: "2026-08-20T10:30:00.000Z",
    title: "Product Designer",
    company: "Northstar Studio",
    location: "Makati",
    workStyle: "Hybrid",
    requirements: "Accessible design\nResearch",
    postedAt: "Unknown",
  });
  const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
  const now = "2026-08-25T00:00:00.000Z";
  const templateId = createUuidV7();
  const evidenceId = createUuidV7();
  const evidenceRevisionId = createUuidV7();
  try {
    db.prepare(
      "INSERT INTO resume_template_sources (id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at) VALUES (?, 'bundled', 'verified', 'Resume.pdf', 'application/pdf', ?, 1, ?, NULL, ?)",
    ).run(
      templateId,
      hash("template"),
      `resume-templates/${templateId}.pdf`,
      now,
    );
    db.prepare(
      "UPDATE resume_generation_state SET designated_template_id = ?, revision_number = revision_number + 1, updated_at = ? WHERE singleton = 1",
    ).run(templateId, now);
    db.prepare(
      "INSERT INTO evidence_records (id, created_at) VALUES (?, ?)",
    ).run(evidenceId, now);
    db.prepare(
      "INSERT INTO evidence_revisions (id, evidence_id, revision_number, origin, source_base_resume_id, source_document, source_section, factual_text, review_state, supersedes_revision_id, created_at, content_digest) VALUES (?, ?, 1, 'user_entered', NULL, 'Portfolio', 'Case study', 'Designed accessible research-led interfaces.', 'approved', NULL, ?, ?)",
    ).run(evidenceRevisionId, evidenceId, now, hash("evidence"));
    db.prepare(
      "INSERT INTO resume_workspace_evidence (workspace_id, evidence_id) VALUES (?, ?)",
    ).run(workspace.workspace.id, evidenceId);
  } finally {
    db.close();
  }
  await configureLocalModel({
    appDataRoot,
    modelIdentifier: "qwen/qwen3.5-9b",
    fetcher: async () => modelList(),
  });
  return {
    root,
    appDataRoot,
    opportunityId: captured.opportunity.id,
    evidenceRevisionId,
  };
}

test("assessment cache is invalidated by a configuration fingerprint change", async () => {
  const value = await fixture();
  try {
    let calls = 0;
    const input = {
      appDataRoot: value.appDataRoot,
      opportunityId: value.opportunityId,
      evidenceIds: [value.evidenceRevisionId],
      consent: true,
    };
    const invoke = async (
      request: Parameters<typeof assessCapturedOpportunity>[1] extends (
        request: infer R,
      ) => unknown
        ? R
        : never,
    ) => {
      calls += 1;
      return {
        schemaVersion: 1 as const,
        selectionEcho: request.consentFingerprint,
        strengths: [
          {
            text: "Accessible interface work relates to the captured role.",
            evidenceIndexes: [0],
            excerpt: { start: 0, end: 24 },
          },
        ],
        gaps: [],
        unknowns: [],
      };
    };
    assert.equal(
      (await assessCapturedOpportunity(input, invoke)).cached,
      false,
    );
    assert.equal((await assessCapturedOpportunity(input, invoke)).cached, true);
    assert.equal(calls, 1);
    await configureLocalModel({
      appDataRoot: value.appDataRoot,
      modelIdentifier: "qwen/qwen3.5-9b",
      fetcher: async () => modelList(),
    });
    assert.equal(
      (await assessCapturedOpportunity(input, invoke)).cached,
      false,
    );
    assert.equal(calls, 2);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("invalid model output creates no assessment record", async () => {
  const value = await fixture();
  try {
    await assert.rejects(
      assessCapturedOpportunity(
        {
          appDataRoot: value.appDataRoot,
          opportunityId: value.opportunityId,
          evidenceIds: [value.evidenceRevisionId],
          consent: true,
        },
        async (request) => ({
          schemaVersion: 1,
          selectionEcho: request.consentFingerprint,
          strengths: [
            {
              text: "You will get hired.",
              evidenceIndexes: [0],
              excerpt: { start: 0, end: 20 },
            },
          ],
          gaps: [],
          unknowns: [],
        }),
      ),
      { code: "OPPORTUNITY_ASSESSMENT_INVALID" },
    );
    const db = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db
            .prepare("SELECT COUNT(*) AS count FROM ai_opportunity_assessments")
            .get() as { count: number }
        ).count,
        0,
      );
    } finally {
      db.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("tokenless local configuration invokes assessment without vault material", async () => {
  const value = await fixture();
  try {
    let called = false;
    await assessCapturedOpportunity(
      {
        appDataRoot: value.appDataRoot,
        opportunityId: value.opportunityId,
        evidenceIds: [value.evidenceRevisionId],
        consent: true,
      },
      async (request) => {
        called = true;
        return {
          schemaVersion: 1,
          selectionEcho: request.consentFingerprint,
          strengths: [],
          gaps: [],
          unknowns: [],
        };
      },
    );
    assert.equal(called, true);
    const db = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db
            .prepare("SELECT COUNT(*) AS count FROM ai_opportunity_assessments")
            .get() as { count: number }
        ).count,
        1,
      );
    } finally {
      db.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});
