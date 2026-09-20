import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GET as getTemplatePdf } from "../src/app/api/resume-template/pdf/route";
import { createUuidV7 } from "../src/audit/audit-event";
import {
  saveCandidateProfile,
  readCandidateProfileState,
} from "../src/domain/resume-generation/candidate-profile-commands";
import {
  bootstrapBundledResumeTemplate,
  readDesignatedResumeTemplatePdf,
} from "../src/domain/resume-generation/resume-template-commands";
import { importCurrentBaseResume } from "../src/domain/current-base-resume/current-base-resume-commands";
import { createResumeWorkspace } from "../src/domain/resume-generation/resume-workspace-commands";
import {
  readVerifiedResumeTemplatePdf,
  stageBundledResumeTemplate,
} from "../src/files/resume-template";
import { applyMigrations, openDatabase } from "../src/persistence/database";
import { migrations } from "../src/persistence/migrations";
import type { ResumeTemplateSource } from "../src/persistence/resume-template-repository";

const validProfile = {
  firstName: " Adrian ",
  middleName: "",
  lastName: "Javier",
  email: "ADRIAN@example.com ",
  phone: "+63 917 123 4567",
  school: "Example University",
  program: "Bachelor of Science in Computer Science",
  graduationYear: "2027",
  gwa: "1.25",
  latinHonors: "",
  linkedInUrl: "https://www.linkedin.com/in/adrian-javier",
  githubUrl: "https://github.com/adrianjavier",
};

const sha256 = (bytes: Uint8Array) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const templateSnapshot = (bytes: Uint8Array) => ({
  bytes,
  byteSize: bytes.byteLength,
  contentDigest: sha256(bytes),
});

async function temporaryWorkspace(
  prefix: string,
): Promise<{ root: string; appDataRoot: string }> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  return { root, appDataRoot: join(root, "private") };
}

async function seedBundledTemplate(
  workspace: { appDataRoot: string },
  bytes: Uint8Array,
): Promise<ResumeTemplateSource> {
  await mkdir(workspace.appDataRoot, { recursive: true });
  const id = createUuidV7();
  const staged = await stageBundledResumeTemplate(
    workspace.appDataRoot,
    id,
    templateSnapshot(bytes),
  );
  const source: ResumeTemplateSource = {
    id,
    origin: "bundled",
    state: "verified",
    filename: "Resume.pdf",
    contentType: "application/pdf",
    contentDigest: staged.contentDigest,
    byteSize: staged.byteSize,
    storageLocation: staged.storageLocation,
    createdAt: new Date().toISOString(),
  };
  const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
  try {
    applyMigrations(db);
    db.prepare(
      "INSERT INTO resume_template_sources (id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      source.id,
      source.origin,
      source.state,
      source.filename,
      source.contentType,
      source.contentDigest,
      source.byteSize,
      source.storageLocation,
      null,
      source.createdAt,
    );
  } finally {
    db.close();
  }
  return source;
}

function designateSeededTemplate(
  workspace: { appDataRoot: string },
  source: ResumeTemplateSource,
): void {
  const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
  try {
    const state = db
      .prepare(
        "SELECT revision_number FROM resume_generation_state WHERE singleton = 1",
      )
      .get() as { revision_number: number };
    db.prepare(
      "UPDATE resume_generation_state SET designated_template_id = ?, revision_number = ?, updated_at = ? WHERE singleton = 1",
    ).run(source.id, state.revision_number + 1, new Date().toISOString());
  } finally {
    db.close();
  }
}

test("0021 preserves legacy metadata as a non-designated candidate and protects immutable profile revisions", async () => {
  const workspace = await temporaryWorkspace("resume-profile-migration-");
  try {
    await mkdir(workspace.appDataRoot, { recursive: true });
    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      db.exec(
        "CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
      );
      for (const migration of migrations.slice(0, 20)) {
        db.exec(migration.sql);
        db.prepare(
          "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
        ).run(migration.id, "2026-08-25T00:00:00.000Z");
      }
      const legacyId = "legacy-source-id-0000000000000000000";
      db.prepare(
        "INSERT INTO current_base_resume_sources (id, filename, content_digest, byte_size, storage_location, imported_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        legacyId,
        "Legacy CV.txt",
        sha256(new Uint8Array([1, 2, 3])),
        3,
        `current-base-resumes/${legacyId}/Legacy CV.txt`,
        "2026-08-25T00:00:00.000Z",
      );
      applyMigrations(db);
      assert.equal(
        (
          db
            .prepare(
              "SELECT designated_template_id FROM resume_generation_state WHERE singleton = 1",
            )
            .get() as { designated_template_id: string | null }
        ).designated_template_id,
        null,
      );
      const candidate = db
        .prepare(
          "SELECT origin, filename FROM resume_template_sources WHERE legacy_source_id = ?",
        )
        .get(legacyId) as { origin: string; filename: string };
      assert.equal(candidate.origin, "legacy_current_base_resume");
      assert.equal(candidate.filename, "Legacy CV.txt");
      assert.match(
        (
          db
            .prepare(
              "SELECT id FROM resume_template_sources WHERE legacy_source_id = ?",
            )
            .get(legacyId) as { id: string }
        ).id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      assert.throws(
        () => db.exec("DELETE FROM resume_generation_state"),
        /cannot be deleted/i,
      );
      assert.throws(
        () =>
          db
            .prepare(
              "UPDATE resume_generation_state SET designated_template_id = ?, revision_number = 1, updated_at = ? WHERE singleton = 1",
            )
            .run(
              (
                db
                  .prepare(
                    "SELECT id FROM resume_template_sources WHERE legacy_source_id = ?",
                  )
                  .get(legacyId) as { id: string }
              ).id,
              "2026-08-25T00:00:00.000Z",
            ),
        /verified bundled/i,
      );
    } finally {
      db.close();
    }

    await createResumeWorkspace({
      appDataRoot: workspace.appDataRoot,
      name: "Migration test",
    });
    for (const required of [
      "firstName",
      "lastName",
      "email",
      "phone",
      "school",
      "program",
      "graduationYear",
    ] as const) {
      await assert.rejects(
        saveCandidateProfile({
          appDataRoot: workspace.appDataRoot,
          values: { ...validProfile, [required]: "" },
        }),
        { code: "CANDIDATE_PROFILE_INVALID" },
      );
    }
    await assert.rejects(
      saveCandidateProfile({
        appDataRoot: workspace.appDataRoot,
        values: { ...validProfile, linkedInUrl: "http://not-secure.example" },
      }),
      { code: "CANDIDATE_PROFILE_INVALID" },
    );
    const saved = await saveCandidateProfile({
      appDataRoot: workspace.appDataRoot,
      values: validProfile,
    });
    assert.equal(saved.revision.revisionNumber, 1);
    assert.equal(saved.revision.values.firstName, "Adrian");
    assert.equal(saved.revision.values.email, "adrian@example.com");

    const next = await saveCandidateProfile({
      appDataRoot: workspace.appDataRoot,
      profileId: saved.profile.id,
      expectedStateRevisionNumber: saved.stateRevisionNumber,
      values: { ...validProfile, gwa: "1.20" },
    });
    assert.equal(next.revision.revisionNumber, 2);
    const unselectedProfileId = createUuidV7();
    const profileDb = openDatabase(
      join(workspace.appDataRoot, "workspace.sqlite"),
    );
    try {
      profileDb
        .prepare(
          "INSERT INTO candidate_profiles (id, created_at) VALUES (?, ?)",
        )
        .run(unselectedProfileId, new Date().toISOString());
    } finally {
      profileDb.close();
    }
    await assert.rejects(
      saveCandidateProfile({
        appDataRoot: workspace.appDataRoot,
        expectedStateRevisionNumber: next.stateRevisionNumber,
        values: validProfile,
      }),
      { code: "CANDIDATE_PROFILE_STALE" },
    );
    await assert.rejects(
      saveCandidateProfile({
        appDataRoot: workspace.appDataRoot,
        profileId: unselectedProfileId,
        expectedStateRevisionNumber: next.stateRevisionNumber,
        values: validProfile,
      }),
      { code: "CANDIDATE_PROFILE_STALE" },
    );
    assert.equal(
      (await readCandidateProfileState({ appDataRoot: workspace.appDataRoot }))
        .profile?.id,
      saved.profile.id,
    );
    await assert.rejects(
      saveCandidateProfile({
        appDataRoot: workspace.appDataRoot,
        profileId: saved.profile.id,
        expectedStateRevisionNumber: saved.stateRevisionNumber,
        values: validProfile,
      }),
      { code: "CANDIDATE_PROFILE_STALE" },
    );
    await assert.rejects(
      saveCandidateProfile({
        appDataRoot: workspace.appDataRoot,
        profileId: saved.profile.id,
        expectedStateRevisionNumber: next.stateRevisionNumber,
        values: { ...validProfile, phone: "+------1" },
      }),
      { code: "CANDIDATE_PROFILE_INVALID" },
    );

    const dbAfter = openDatabase(
      join(workspace.appDataRoot, "workspace.sqlite"),
    );
    try {
      dbAfter
        .prepare(
          "UPDATE resume_generation_state SET active_profile_revision_id = ?, revision_number = revision_number + 1, updated_at = ? WHERE singleton = 1",
        )
        .run(saved.revision.id, "2026-08-25T00:00:00.000Z");
      const selected = await readCandidateProfileState({
        appDataRoot: workspace.appDataRoot,
      });
      assert.equal(selected.revision?.id, next.revision.id);
      assert.throws(
        () =>
          dbAfter.exec(
            "UPDATE candidate_profile_revisions SET first_name = 'Changed'",
          ),
        /immutable/i,
      );
      assert.throws(
        () => dbAfter.exec("DELETE FROM candidate_profiles"),
        /immutable/i,
      );
      assert.equal(
        (
          dbAfter
            .prepare(
              "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'resume.profile_saved' AND outcome = 'success'",
            )
            .get() as { count: number }
        ).count,
        2,
      );
    } finally {
      dbAfter.close();
    }
  } finally {
    await rm(workspace.root, { recursive: true, force: true });
  }
});

test("bundled Resume.pdf bootstrap is verified, idempotent, private, and never falls back to legacy content", async () => {
  const workspace = await temporaryWorkspace("resume-template-");
  const priorLocalAppData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = workspace.root;
  workspace.appDataRoot = join(workspace.root, "PersonalJobDiscovery");
  try {
    const abandonedId = createUuidV7();
    await mkdir(
      join(workspace.appDataRoot, "resume-templates", ".staging", abandonedId),
      { recursive: true },
    );
    await writeFile(
      join(
        workspace.appDataRoot,
        "resume-templates",
        ".staging",
        abandonedId,
        "Resume.pdf",
      ),
      new Uint8Array([1, 2, 3]),
    );
    await utimes(
      join(workspace.appDataRoot, "resume-templates", ".staging", abandonedId),
      new Date(0),
      new Date(0),
    );
    const response = await getTemplatePdf(
      new Request("http://localhost/api/resume-template/pdf"),
    );
    assert.equal(response.status, 200);
    const first = await bootstrapBundledResumeTemplate({
      appDataRoot: workspace.appDataRoot,
    });
    const second = await bootstrapBundledResumeTemplate({
      appDataRoot: workspace.appDataRoot,
    });
    assert.equal(first.id, second.id);
    await assert.rejects(
      readFile(
        join(
          workspace.appDataRoot,
          "resume-templates",
          ".staging",
          abandonedId,
          "Resume.pdf",
        ),
      ),
    );
    await assert.rejects(
      stageBundledResumeTemplate(
        workspace.appDataRoot,
        createUuidV7(),
        templateSnapshot(new Uint8Array([1, 2, 3])),
      ),
    );
    assert.equal(
      await readVerifiedResumeTemplatePdf(workspace.appDataRoot, {
        ...first,
        storageLocation: "../../outside.pdf",
      }),
      undefined,
    );
    const bytes = await readDesignatedResumeTemplatePdf({
      appDataRoot: workspace.appDataRoot,
    });
    assert.ok(bytes && bytes.byteLength === first.byteSize);

    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(response.headers.get("content-disposition"), "inline");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(
      response.headers.get("cross-origin-resource-policy"),
      "same-origin",
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);

    await writeFile(
      join(workspace.appDataRoot, first.storageLocation),
      new Uint8Array([1, 2, 3]),
    );
    assert.equal(
      await readDesignatedResumeTemplatePdf({
        appDataRoot: workspace.appDataRoot,
      }),
      undefined,
    );
    const unavailable = await getTemplatePdf(
      new Request("http://localhost/api/resume-template/pdf"),
    );
    assert.equal(unavailable.status, 404);
    assert.doesNotMatch(
      await unavailable.text(),
      /resume-templates|sha256|[A-Z]:\\/i,
    );

    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'resume.template_designated' AND outcome = 'success'",
            )
            .get() as { count: number }
        ).count,
        1,
      );
      assert.throws(
        () =>
          db.exec(
            "UPDATE resume_template_sources SET filename = 'changed.pdf'",
          ),
        /immutable/i,
      );
    } finally {
      db.close();
    }
  } finally {
    if (priorLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = priorLocalAppData;
    await rm(workspace.root, { recursive: true, force: true });
  }
});

test("bundled template refresh snapshots current root bytes, reuses historical digests, and preserves immutable history", async () => {
  const workspace = await temporaryWorkspace("resume-template-refresh-");
  const priorLocalAppData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = workspace.root;
  workspace.appDataRoot = join(workspace.root, "PersonalJobDiscovery");
  try {
    const rootBytes = new Uint8Array(await readFile("Resume.pdf"));
    const old = await seedBundledTemplate(
      workspace,
      new TextEncoder().encode("%PDF-1.7\nold template\n"),
    );
    designateSeededTemplate(workspace, old);

    const refreshed = await bootstrapBundledResumeTemplate({
      appDataRoot: workspace.appDataRoot,
    });
    assert.notEqual(refreshed.id, old.id);
    assert.equal(refreshed.contentDigest, sha256(rootBytes));
    assert.deepEqual(
      await readVerifiedResumeTemplatePdf(workspace.appDataRoot, refreshed),
      rootBytes,
    );
    assert.deepEqual(
      await readVerifiedResumeTemplatePdf(workspace.appDataRoot, old),
      new TextEncoder().encode("%PDF-1.7\nold template\n"),
    );
    const route = await getTemplatePdf(
      new Request("http://localhost/api/resume-template/pdf"),
    );
    assert.equal(route.status, 200);
    assert.deepEqual(new Uint8Array(await route.arrayBuffer()), rootBytes);

    const historical = refreshed;
    const other = await seedBundledTemplate(
      workspace,
      new TextEncoder().encode("%PDF-1.7\nother template\n"),
    );
    designateSeededTemplate(workspace, other);
    const selected = await bootstrapBundledResumeTemplate({
      appDataRoot: workspace.appDataRoot,
    });
    assert.equal(selected.id, historical.id);
    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM resume_template_sources WHERE origin = 'bundled'",
            )
            .get() as { count: number }
        ).count,
        3,
      );
      const auditCount = (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'resume.template_designated'",
          )
          .get() as { count: number }
      ).count;
      await bootstrapBundledResumeTemplate({
        appDataRoot: workspace.appDataRoot,
      });
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'resume.template_designated'",
            )
            .get() as { count: number }
        ).count,
        auditCount,
      );
    } finally {
      db.close();
    }
  } finally {
    if (priorLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = priorLocalAppData;
    await rm(workspace.root, { recursive: true, force: true });
  }
});

test("a corrupt matching private template leaves the designation unchanged and the preview unavailable", async () => {
  const workspace = await temporaryWorkspace("resume-template-corrupt-match-");
  const priorLocalAppData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = workspace.root;
  workspace.appDataRoot = join(workspace.root, "PersonalJobDiscovery");
  try {
    const matching = await seedBundledTemplate(
      workspace,
      new Uint8Array(await readFile("Resume.pdf")),
    );
    const prior = await seedBundledTemplate(
      workspace,
      new TextEncoder().encode("%PDF-1.7\nprior template\n"),
    );
    designateSeededTemplate(workspace, prior);
    await writeFile(
      join(workspace.appDataRoot, matching.storageLocation),
      new Uint8Array([1, 2, 3]),
    );

    await assert.rejects(
      bootstrapBundledResumeTemplate({ appDataRoot: workspace.appDataRoot }),
      { code: "RESUME_TEMPLATE_UNAVAILABLE" },
    );
    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db
            .prepare(
              "SELECT designated_template_id FROM resume_generation_state WHERE singleton = 1",
            )
            .get() as { designated_template_id: string }
        ).designated_template_id,
        prior.id,
      );
    } finally {
      db.close();
    }
    const route = await getTemplatePdf(
      new Request("http://localhost/api/resume-template/pdf"),
    );
    assert.equal(route.status, 404);
    assert.doesNotMatch(
      await route.text(),
      /resume-templates|sha256|[A-Z]:\\/i,
    );
  } finally {
    if (priorLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = priorLocalAppData;
    await rm(workspace.root, { recursive: true, force: true });
  }
});

test("an invalid bundled template leaves the existing designation untouched", async () => {
  const workspace = await temporaryWorkspace("resume-template-invalid-bundle-");
  const originalCwd = process.cwd();
  try {
    const priorBytes = new Uint8Array(await readFile("Resume.pdf"));
    const prior = await seedBundledTemplate(workspace, priorBytes);
    designateSeededTemplate(workspace, prior);
    await writeFile(join(workspace.root, "Resume.pdf"), "not a PDF");
    process.chdir(workspace.root);

    await assert.rejects(
      bootstrapBundledResumeTemplate({ appDataRoot: workspace.appDataRoot }),
      { code: "RESUME_TEMPLATE_UNAVAILABLE" },
    );
    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db
            .prepare(
              "SELECT designated_template_id FROM resume_generation_state WHERE singleton = 1",
            )
            .get() as { designated_template_id: string }
        ).designated_template_id,
        prior.id,
      );
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM resume_template_sources WHERE origin = 'bundled'",
            )
            .get() as { count: number }
        ).count,
        1,
      );
    } finally {
      db.close();
    }
  } finally {
    process.chdir(originalCwd);
    await rm(workspace.root, { recursive: true, force: true });
  }
});

test("legacy Current Base Resume writes are disabled after 0021 without deleting retained history", async () => {
  const workspace = await temporaryWorkspace("resume-legacy-transition-");
  try {
    await mkdir(workspace.appDataRoot, { recursive: true });
    await assert.rejects(
      importCurrentBaseResume({
        appDataRoot: workspace.appDataRoot,
        filename: "Resume.pdf",
        bytes: new Uint8Array(await readFile("Resume.pdf")),
      }),
      { code: "CURRENT_BASE_RESUME_HISTORY_ONLY" },
    );
    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      applyMigrations(db);
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM current_base_resume_sources",
            )
            .get() as { count: number }
        ).count,
        0,
      );
    } finally {
      db.close();
    }
  } finally {
    await rm(workspace.root, { recursive: true, force: true });
  }
});

test("concurrent first template bootstrap converges on one immutable bundled source", async () => {
  const workspace = await temporaryWorkspace("resume-template-concurrent-");
  try {
    const [first, second] = await Promise.all([
      bootstrapBundledResumeTemplate({ appDataRoot: workspace.appDataRoot }),
      bootstrapBundledResumeTemplate({ appDataRoot: workspace.appDataRoot }),
    ]);
    assert.equal(first.id, second.id);
    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM resume_template_sources WHERE origin = 'bundled'",
            )
            .get() as { count: number }
        ).count,
        1,
      );
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'resume.template_designated'",
            )
            .get() as { count: number }
        ).count,
        1,
      );
    } finally {
      db.close();
    }
  } finally {
    await rm(workspace.root, { recursive: true, force: true });
  }
});

test("0028 upgrades an existing material draft schema that used opportunity_id", async () => {
  const workspace = await temporaryWorkspace("resume-draft-schema-compat-");
  try {
    await mkdir(workspace.appDataRoot, { recursive: true });
    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      db.exec(
        "CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);",
      );
      for (const migration of migrations.filter(
        (migration) => migration.id < "0028_resume_draft_schema_compat",
      ))
        db.prepare(
          "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
        ).run(migration.id, "2026-08-26T00:00:00.000Z");
      db.exec(
        "CREATE TABLE captured_opportunity_revisions (id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL, created_at TEXT NOT NULL);",
      );
      db.exec(
        "CREATE TABLE material_drafts (id TEXT PRIMARY KEY, kind TEXT NOT NULL, profile_revision_id TEXT NOT NULL, profile_content_digest TEXT NOT NULL, template_source_id TEXT NOT NULL, template_content_digest TEXT NOT NULL, opportunity_id TEXT, opportunity_content_digest TEXT, request_text TEXT NOT NULL, request_digest TEXT NOT NULL, content_json TEXT NOT NULL, content_digest TEXT NOT NULL, provenance_digest TEXT NOT NULL, created_at TEXT NOT NULL);",
      );
      applyMigrations(db);
      const columns = (
        db.prepare("PRAGMA table_info(material_drafts)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name);
      assert.ok(columns.includes("opportunity_id"));
      assert.ok(columns.includes("opportunity_revision_id"));
      assert.ok(
        db
          .prepare(
            "SELECT id FROM schema_migrations WHERE id = '0028_resume_draft_schema_compat'",
          )
          .get(),
      );
    } finally {
      db.close();
    }
  } finally {
    await rm(workspace.root, { recursive: true, force: true });
  }
});

test("material provenance accepts documented findings and refuses a symlinked template directory", async () => {
  const workspace = await temporaryWorkspace("resume-material-guards-");
  try {
    await mkdir(workspace.appDataRoot, { recursive: true });
    const db = openDatabase(join(workspace.appDataRoot, "workspace.sqlite"));
    try {
      applyMigrations(db);
      const hash = sha256(new TextEncoder().encode("snapshot"));
      const profileId = createUuidV7();
      const profileRevisionId = createUuidV7();
      const templateId = createUuidV7();
      const draftId = createUuidV7();
      const evidenceRevisionId = createUuidV7();
      const claimId = createUuidV7();
      db.prepare(
        "INSERT INTO candidate_profiles (id, created_at) VALUES (?, ?)",
      ).run(profileId, "2026-08-25T00:00:00.000Z");
      db.prepare(
        "INSERT INTO candidate_profile_revisions (id, profile_id, revision_number, parent_revision_id, first_name, middle_name, last_name, email, phone, school, program, graduation_year, gwa, latin_honors, linkedin_url, github_url, canonical_content, content_digest, created_at) VALUES (?, ?, 1, NULL, ?, NULL, ?, ?, ?, ?, ?, 2027, NULL, NULL, NULL, NULL, ?, ?, ?)",
      ).run(
        profileRevisionId,
        profileId,
        "Adrian",
        "Javier",
        "adrian@example.com",
        "+639171234567",
        "Example University",
        "Computer Science",
        "{}",
        hash,
        "2026-08-25T00:00:00.000Z",
      );
      db.prepare(
        "INSERT INTO resume_template_sources (id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at) VALUES (?, 'bundled', 'verified', 'Resume.pdf', 'application/pdf', ?, 10, ?, NULL, ?)",
      ).run(
        templateId,
        hash,
        `resume-templates/${templateId}/Resume.pdf`,
        "2026-08-25T00:00:00.000Z",
      );
      db.prepare(
        "INSERT INTO material_drafts (id, kind, profile_revision_id, profile_content_digest, template_source_id, template_content_digest, opportunity_revision_id, opportunity_content_digest, request_text, request_digest, content_json, content_digest, provenance_digest, created_at) VALUES (?, 'resume', ?, ?, ?, ?, NULL, NULL, 'Tailor this', ?, '{}', ?, ?, ?)",
      ).run(
        draftId,
        profileRevisionId,
        hash,
        templateId,
        hash,
        hash,
        hash,
        hash,
        "2026-08-25T00:00:00.000Z",
      );
      db.prepare(
        "INSERT INTO evidence_records (id, created_at) VALUES (?, ?)",
      ).run("unapproved-evidence", "2026-08-25T00:00:00.000Z");
      db.prepare(
        "INSERT INTO evidence_revisions (id, evidence_id, revision_number, origin, source_base_resume_id, source_document, source_section, factual_text, review_state, supersedes_revision_id, created_at, content_digest) VALUES (?, 'unapproved-evidence', 1, 'user_entered', NULL, 'manual', 'section', 'Unreviewed fact', 'unreviewed', NULL, ?, ?)",
      ).run(evidenceRevisionId, "2026-08-25T00:00:00.000Z", hash);
      db.prepare(
        "INSERT INTO material_draft_claims (id, draft_id, ordinal, claim_text, created_at) VALUES (?, ?, 0, 'Claim', ?)",
      ).run(claimId, draftId, "2026-08-25T00:00:00.000Z");
      assert.doesNotThrow(() =>
        db
          .prepare(
            "INSERT INTO material_draft_evidence (draft_id, evidence_revision_id) VALUES (?, ?)",
          )
          .run(draftId, evidenceRevisionId),
      );
      assert.doesNotThrow(() =>
        db
          .prepare(
            "INSERT INTO material_claim_support (claim_id, evidence_revision_id) VALUES (?, ?)",
          )
          .run(claimId, evidenceRevisionId),
      );
      const draftColumns = (
        db.prepare("PRAGMA table_info(material_drafts)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name);
      const versionColumns = (
        db.prepare("PRAGMA table_info(material_versions)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name);
      assert.ok(draftColumns.includes("opportunity_revision_id"));
      for (const column of [
        "accepted_at",
        "content_digest",
        "provenance_digest",
        "renderer_metadata",
        "export_metadata",
      ])
        assert.ok(versionColumns.includes(column));
    } finally {
      db.close();
    }

    const escaped = join(workspace.root, "outside");
    await mkdir(escaped, { recursive: true });
    await symlink(
      escaped,
      join(workspace.appDataRoot, "resume-templates"),
      "junction",
    );
    await assert.rejects(
      bootstrapBundledResumeTemplate({ appDataRoot: workspace.appDataRoot }),
      { code: "RESUME_TEMPLATE_UNAVAILABLE" },
    );
    await assert.rejects(readFile(join(escaped, ".staging", "Resume.pdf")));
  } finally {
    await rm(workspace.root, { recursive: true, force: true });
  }
});
