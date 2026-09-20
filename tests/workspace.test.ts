import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createAuditEvent } from "../src/audit/audit-event";
import { resolveAppDataPaths } from "../src/files/app-data";
import { initializeWorkspace } from "../src/domain/workspace/initialize-workspace";
import { storageProtectionMessage } from "../src/domain/workspace/status-message";
import { saveCandidateProfile } from "../src/domain/resume-generation/candidate-profile-commands";
import {
  createResumeWorkspace,
  permanentlyDeleteResumeWorkspace,
  readResumeWorkspaceState,
  selectResumeWorkspace,
} from "../src/domain/resume-generation/resume-workspace-commands";
import { addManualEvidence } from "../src/domain/evidence/evidence-commands";
import { openDatabase } from "../src/persistence/database";
import { attachEvidenceToWorkspace } from "../src/persistence/resume-workspace-repository";

test("creates a private data root and initializes the same SQLite workspace twice", async () => {
  const root = await mkdtemp(join(tmpdir(), "job-workspace-test-"));

  try {
    const first = await initializeWorkspace({ appDataRoot: root });
    const second = await initializeWorkspace({ appDataRoot: root });

    assert.equal(first.workspaceId, second.workspaceId);
    assert.equal(first.initialization, "created");
    assert.equal(second.initialization, "validated");
    assert.match(first.databasePath, /workspace\.sqlite$/);
    assert.equal(first.auditEvent.action, "workspace.initialized");
    assert.equal(second.auditEvent.action, "workspace.validated");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an app-data root that is a file", async () => {
  const root = await mkdtemp(join(tmpdir(), "job-workspace-test-"));
  const filePath = join(root, "not-a-directory");
  await writeFile(filePath, "not a directory");

  try {
    await assert.rejects(resolveAppDataPaths(filePath), {
      code: "APP_DATA_PATH_INVALID",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("each resume workspace keeps an independent durable journey", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-journey-state-"));
  try {
    await initializeWorkspace({ appDataRoot: root });
    const first = await createResumeWorkspace({
      appDataRoot: root,
      name: "First",
    });
    const second = await createResumeWorkspace({
      appDataRoot: root,
      name: "Second",
      expectedRevisionNumber: first.revisionNumber,
    });
    const state = await readResumeWorkspaceState({ appDataRoot: root });
    assert.equal(state.activeWorkspace?.id, second.workspace.id);
    assert.equal(state.workspaces.length, 2);
    assert.ok(
      state.workspaces.every(
        (workspace) =>
          workspace.journey?.id &&
          workspace.journey.workspaceId === workspace.id,
      ),
    );
    assert.ok(
      state.workspaces.every(
        (workspace) =>
          workspace.journey?.phase === "onboarding" &&
          workspace.journey.nextAction === "complete_profile",
      ),
    );
    await selectResumeWorkspace({
      appDataRoot: root,
      workspaceId: first.workspace.id,
      expectedRevisionNumber: state.revisionNumber,
    });
    await saveCandidateProfile({
      appDataRoot: root,
      values: {
        firstName: "Adrian",
        lastName: "Javier",
        email: "adrian@example.com",
        phone: "+639171234567",
        school: "University",
        program: "Computer Science",
        graduationYear: "2027",
      },
    });
    const restored = await readResumeWorkspaceState({ appDataRoot: root });
    assert.equal(restored.activeWorkspace?.id, first.workspace.id);
    assert.equal(
      restored.workspaces.find(
        (workspace) => workspace.id === first.workspace.id,
      )?.journey?.phase,
      "ready_to_generate",
    );
    assert.equal(
      restored.workspaces.find(
        (workspace) => workspace.id === second.workspace.id,
      )?.journey?.phase,
      "onboarding",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("permanently deletes a resume workspace after it owns profile data", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-workspace-delete-"));
  try {
    await initializeWorkspace({ appDataRoot: root });
    const created = await createResumeWorkspace({
      appDataRoot: root,
      name: "Delete me",
      expectedRevisionNumber: 0,
    });
    const initialJourney = await readResumeWorkspaceState({
      appDataRoot: root,
    });
    assert.equal(initialJourney.activeWorkspace?.journey?.phase, "onboarding");
    assert.equal(
      initialJourney.activeWorkspace?.journey?.nextAction,
      "complete_profile",
    );
    const profile = await saveCandidateProfile({
      appDataRoot: root,
      expectedStateRevisionNumber: created.revisionNumber,
      values: {
        firstName: "Adrian",
        lastName: "Javier",
        email: "adrian@example.com",
        phone: "+639171234567",
        school: "University",
        program: "Computer Science",
        graduationYear: "2027",
      },
    });
    const profileJourney = await readResumeWorkspaceState({
      appDataRoot: root,
    });
    assert.equal(
      profileJourney.activeWorkspace?.journey?.phase,
      "ready_to_generate",
    );
    const evidence = await addManualEvidence({
      appDataRoot: root,
      factualText: "Built a local resume workflow.",
      sourceDocument: "project-notes.md",
      sourceSection: "Overview",
    });
    const paths = await resolveAppDataPaths(root);
    const database = openDatabase(paths.databasePath);
    try {
      attachEvidenceToWorkspace(
        database,
        created.workspace.id,
        evidence.evidenceId,
      );
      database
        .prepare(
          "INSERT INTO resume_generation_jobs (id, workspace_id, status, message, created_at, updated_at) VALUES (?, ?, 'queued', 'Waiting', ?, ?)",
        )
        .run(
          "pending-generation-job",
          created.workspace.id,
          new Date().toISOString(),
          new Date().toISOString(),
        );
    } finally {
      database.close();
    }
    const intakeDb = openDatabase(paths.databasePath);
    try {
      const now = new Date().toISOString();
      intakeDb
        .prepare(
          "INSERT INTO resume_evidence_intakes (id, workspace_id, status, message, created_at, updated_at) VALUES (?, ?, 'queued', 'Waiting', ?, ?)",
        )
        .run("pending-evidence-intake", created.workspace.id, now, now);
      intakeDb
        .prepare(
          "INSERT INTO resume_evidence_interpretations (id, workspace_id, item_key, item_name, item_category, kind, content, evidence_document_path, created_at) VALUES (?, ?, 'project:delete-me', 'Delete me', 'project', 'unknown', 'What is the outcome?', 'resume-evidence/projects/delete-me/resume-evidence.md', ?)",
        )
        .run("pending-interpretation", created.workspace.id, now);
      intakeDb
        .prepare(
          "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:delete-me', 'Delete me', 'project', 'outcome', 'What is the outcome?', ?)",
        )
        .run("pending-task", created.workspace.id, now);
    } finally {
      intakeDb.close();
    }
    await permanentlyDeleteResumeWorkspace({
      appDataRoot: root,
      workspaceId: created.workspace.id,
      expectedRevisionNumber: profile.stateRevisionNumber,
      confirmation: "DELETE",
    });
    const state = await readResumeWorkspaceState({ appDataRoot: root });
    assert.equal(state.workspaces.length, 0);
    assert.equal(state.activeWorkspace, undefined);
    const verify = openDatabase(paths.databasePath);
    try {
      assert.equal(
        Number(
          verify.prepare("SELECT count(*) AS value FROM evidence_records").get()
            .value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare("SELECT count(*) AS value FROM resume_generation_jobs")
            .get().value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare("SELECT count(*) AS value FROM resume_evidence_intakes")
            .get().value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare(
              "SELECT count(*) AS value FROM resume_evidence_interpretations",
            )
            .get().value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare("SELECT count(*) AS value FROM resume_clarification_tasks")
            .get().value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare(
              "SELECT count(*) AS value FROM resume_clarification_task_responses",
            )
            .get().value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare("SELECT count(*) AS value FROM resume_clarified_evidence")
            .get().value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare(
              "SELECT count(*) AS value FROM resume_clarified_evidence_conflicts",
            )
            .get().value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare("SELECT count(*) AS value FROM resume_workspace_journeys")
            .get().value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify.prepare("SELECT count(*) AS value FROM material_drafts").get()
            .value,
        ),
        0,
      );
    } finally {
      verify.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("audit events retain metadata but reject sensitive payload fields", () => {
  const event = createAuditEvent({
    actor: "local-os-user",
    action: "workspace.initialized",
    outcome: "success",
    entityId: "018f6a60-7c00-7000-8000-000000000001",
    contentHash:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });

  const serialized = JSON.stringify(event);
  assert.match(serialized, /workspace\.initialized/);
  assert.match(
    serialized,
    /sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/,
  );
  assert.match(
    event.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.doesNotMatch(serialized, /resume|prompt|token|credential/i);
  assert.throws(
    () =>
      createAuditEvent({
        actor: "local-os-user",
        action: "workspace.initialized",
        outcome: "success",
        unsafePayload: "resume text must never be logged",
      } as never),
    { code: "AUDIT_PAYLOAD_FORBIDDEN" },
  );
});

test("rejects an empty explicit app-data root", async () => {
  await assert.rejects(resolveAppDataPaths(""), {
    code: "APP_DATA_PATH_INVALID",
  });
});

test("storage protection copy is truthful and includes a safe next action", () => {
  const message = storageProtectionMessage();

  assert.match(message.summary, /Windows OS account/i);
  assert.match(message.detail, /full-disk encryption/i);
  assert.match(message.detail, /shared or unencrypted device/i);
  assert.equal(
    message.safeNextAction,
    "Review the device's full-disk encryption before importing career data.",
  );
});
