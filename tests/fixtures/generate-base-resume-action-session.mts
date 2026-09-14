import assert from "node:assert/strict";
import { mock } from "node:test";
import { join } from "node:path";

const activeWorkspaceId = "active-workspace";
const activeManagedRoot = join("/private", "resume-evidence", "workspaces", activeWorkspaceId, "projects", "active-project");
let sessionInput: { managedRoots: string[] } | undefined;
let generationInput: { fileReadSession?: unknown } | undefined;
const session = {
  roots: [{ rootId: "root-1", label: "managed-work" as const }],
  execute: async () => ({ ok: false as const, error: "invalid_request" as const }),
  validateCitation: () => false,
};
const database = {
  prepare: () => ({
    all: () => [
      {
        path: "resume-evidence/workspaces/active-workspace/projects/active-project/resume-evidence.md",
      },
      {
        path: "resume-evidence/workspaces/active-workspace/projects/active-project/resume-bullet-candidates.md",
      },
    ],
    run: () => undefined,
  }),
  exec: () => undefined,
  close: () => undefined,
};

mock.module("@/files/app-data", {
  exports: {
    resolveAppDataPaths: async () => ({ root: "/private", databasePath: "/private/workspace.sqlite" }),
  },
});
mock.module("@/persistence/database", {
  exports: { applyMigrations: () => undefined, openDatabase: () => database },
});
mock.module("@/domain/resume-agent/skill-registry", {
  exports: {
    getResumeAgentSkill: () => ({
      requiresConsent: true,
      workflow: ["make every visible Experience or Projects bullet candidate-facing, outcome-oriented, and linked to a host-validated file citation"],
    }),
  },
});
mock.module("@/domain/resume-generation/local-model-configuration-commands", {
  exports: {
    configureLocalModel: async () => ({ ready: true }),
    readLocalModelGatewayConfiguration: async () => ({ id: "configuration", configurationDigest: "sha256:configuration", modelIdentifier: "Qwen3.5-9B" }),
  },
});
mock.module("@/domain/resume-generation/candidate-profile-commands", {
  exports: {
    saveCandidateProfile: async () => undefined,
    readCandidateProfileState: async () => ({
      revision: { id: "profile-revision", contentDigest: "sha256:profile", canonicalContent: "profile" },
    }),
  },
});
mock.module("@/persistence/resume-workspace-repository", {
  exports: {
    readActiveResumeWorkspace: () => ({ workspace: { id: activeWorkspaceId } }),
    listWorkspaceDocumentedEvidenceIds: () => ["evidence-1"],
  },
});
mock.module("@/persistence/evidence-repository", {
  exports: {
    listCurrentEvidence: () => [{ id: "evidence-1", contentDigest: "sha256:evidence", factualText: "Built active project.", sourceDocument: "active-project", sourceSection: "README" }],
  },
});
mock.module("@/domain/resume-generation/resume-clarified-evidence", {
  exports: { listClarifiedEvidenceInDatabase: () => [] },
});
mock.module("@/persistence/resume-template-repository", {
  exports: { findDesignatedResumeTemplate: () => ({ id: "template", contentDigest: "sha256:template" }) },
});
mock.module("@/domain/base-resume/resume-template-contract", {
  exports: { readInitialResumeTemplateContract: async () => ({ baselineId: "baseline", baselineDigest: "sha256:baseline", sections: [] }) },
});
mock.module("@/domain/resume-generation/resume-workspace-journey", {
  exports: { reconcileResumeWorkspaceJourney: async () => ({ nextAction: "generate_resume" }) },
});
mock.module("@/files/evidence-library", {
  exports: {
    readManagedDocumentedArtifacts: async () => [
      {
        name: "active-project",
        category: "project",
        documents: [
          { absolutePath: join(activeManagedRoot, "resume-evidence.md"), libraryPath: "resume-evidence/workspaces/active-workspace/projects/active-project/resume-evidence.md", text: "# Evidence", contentDigest: "sha256:active-evidence" },
          { absolutePath: join(activeManagedRoot, "resume-bullet-candidates.md"), libraryPath: "resume-evidence/workspaces/active-workspace/projects/active-project/resume-bullet-candidates.md", text: "# Bullets", contentDigest: "sha256:active-bullets" },
        ],
      },
      {
        name: "other-project",
        category: "project",
        documents: [
          { absolutePath: "/private/resume-evidence/workspaces/other-workspace/projects/other-project/resume-evidence.md", libraryPath: "resume-evidence/workspaces/other-workspace/projects/other-project/resume-evidence.md", text: "# Other", contentDigest: "sha256:other" },
        ],
      },
    ],
    createResumeFileReadSession: async (input: { managedRoots: string[] }) => {
      sessionInput = input;
      return session;
    },
  },
});
mock.module("@/adapters/local-model/local-model-gateway", {
  exports: {
    requestBaseResumeGeneration: async (input: { fileReadSession?: unknown }) => {
      generationInput = input;
      return { schemaVersion: 1, sections: [], claims: [], unknowns: [], selectionEcho: "fingerprint" };
    },
    requestResumeCoachReview: async () => undefined,
    requestResumeInterviewCoach: async () => undefined,
    resumeCoachConsentFingerprint: () => "fingerprint",
    resumeInterviewCoachConsentFingerprint: () => "interview-fingerprint",
  },
});
mock.module("@/audit/audit-event", {
  exports: {
    createUuidV7: () => "nonce",
    createAuditEvent: () => ({}),
  },
});
mock.module("@/persistence/workspace-repository", { exports: { appendAuditEvent: () => undefined } });
mock.module("@/domain/resume-generation/resume-coach-commands", { exports: { persistResumeCoachDraft: () => ({ id: "draft" }) } });
mock.module("next/cache", { exports: { revalidatePath: () => undefined } });
mock.module("next/navigation", { exports: { redirect: () => undefined } });
mock.module("next/server", { exports: { after: () => undefined } });
mock.module("@/domain/resume-generation/editable-tex-drafts", {
  exports: {
    generateEditableTexDraft: async () => ({
      draftId: "tex-draft-1",
      revisionId: "tex-revision-1",
      displayName: "Platform role",
    }),
  },
});

const { generateBaseResumeAction } = await import("../../src/app/actions.ts");
const formData = new FormData();
formData.set("workspaceId", activeWorkspaceId);
const result = await generateBaseResumeAction({ status: "idle", summary: "" }, formData);

assert.equal(result.status, "success");
assert.deepEqual(sessionInput, { managedRoots: [activeManagedRoot] });
assert.equal(generationInput?.fileReadSession, session);
