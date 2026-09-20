import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import {
  cleanupAbandonedResumeTemplateStaging,
  cleanupResumeTemplate,
  readBundledResumeTemplate,
  readVerifiedResumeTemplatePdf,
  stageBundledResumeTemplate,
} from "@/files/resume-template";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readResumeGenerationState } from "@/persistence/candidate-profile-repository";
import {
  designateResumeTemplate,
  findBundledResumeTemplateByDigest,
  findDesignatedResumeTemplate,
  findResumeTemplateById,
  insertResumeTemplateSource,
  type ResumeTemplateSource,
} from "@/persistence/resume-template-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

type Options = { appDataRoot?: string };

function transaction<T>(
  root: string,
  work: (db: ReturnType<typeof openDatabase>) => T,
): T {
  const db = openDatabase(`${root}/workspace.sqlite`);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE;");
    try {
      const result = work(db);
      db.exec("COMMIT;");
      return result;
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    db.close();
  }
}

function unavailable(): WorkspaceError {
  return new WorkspaceError(
    "RESUME_TEMPLATE_UNAVAILABLE",
    "The Resume.pdf template is unavailable.",
    "Restore the bundled Resume.pdf file and try again.",
  );
}

function designateVerifiedTemplate(
  root: string,
  source: ResumeTemplateSource,
): ResumeTemplateSource {
  const selected = transaction(root, (db) => {
    const current = readResumeGenerationState(db);
    if (current.designatedTemplateId === source.id) return true;
    if (
      !designateResumeTemplate(
        db,
        current.revisionNumber,
        source.id,
        new Date().toISOString(),
      )
    )
      return false;
    appendAuditEvent(
      db,
      createAuditEvent({
        actor: "local-os-user",
        action: "resume.template_designated",
        outcome: "success",
        entityId: source.id,
        contentHash: source.contentDigest,
      }),
    );
    return true;
  });
  if (!selected)
    throw new WorkspaceError(
      "RESUME_TEMPLATE_STALE",
      "The Resume template changed before it could be designated.",
      "Refresh the Resume workspace and try again.",
    );
  return source;
}

async function stillCurrent(
  snapshot: Awaited<ReturnType<typeof readBundledResumeTemplate>>,
): Promise<boolean> {
  try {
    return (
      (await readBundledResumeTemplate()).contentDigest ===
      snapshot.contentDigest
    );
  } catch {
    return false;
  }
}

export async function bootstrapBundledResumeTemplate(
  input: Options = {},
): Promise<ResumeTemplateSource> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  let final: string | undefined;
  try {
    await cleanupAbandonedResumeTemplateStaging(input.appDataRoot);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const snapshot = await readBundledResumeTemplate();
      const existing = transaction(paths.root, (db) =>
        findBundledResumeTemplateByDigest(db, snapshot.contentDigest),
      );
      if (existing) {
        if (!(await readVerifiedResumeTemplatePdf(paths.root, existing)))
          throw unavailable();
        if (!(await stillCurrent(snapshot))) continue;
        const designated = designateVerifiedTemplate(paths.root, existing);
        if (!(await stillCurrent(snapshot))) continue;
        return designated;
      }

      const id = createUuidV7();
      const staged = await stageBundledResumeTemplate(
        input.appDataRoot,
        id,
        snapshot,
      );
      final = staged.final;
      if (!(await stillCurrent(snapshot))) {
        await cleanupResumeTemplate(paths.root, final).catch(() => undefined);
        final = undefined;
        continue;
      }

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
      const selected = transaction(paths.root, (db) => {
        const concurrent = findBundledResumeTemplateByDigest(
          db,
          snapshot.contentDigest,
        );
        const selectedSource = concurrent ?? source;
        if (!concurrent) insertResumeTemplateSource(db, source);
        const current = readResumeGenerationState(db);
        if (current.designatedTemplateId !== selectedSource.id) {
          if (
            !designateResumeTemplate(
              db,
              current.revisionNumber,
              selectedSource.id,
              new Date().toISOString(),
            )
          )
            throw new WorkspaceError(
              "RESUME_TEMPLATE_STALE",
              "The Resume template changed before it could be designated.",
              "Refresh the Resume workspace and try again.",
            );
          appendAuditEvent(
            db,
            createAuditEvent({
              actor: "local-os-user",
              action: "resume.template_designated",
              outcome: "success",
              entityId: selectedSource.id,
              contentHash: selectedSource.contentDigest,
            }),
          );
        }
        return selectedSource;
      });
      if (selected.id !== source.id) {
        await cleanupResumeTemplate(paths.root, final).catch(() => undefined);
      }
      final = undefined;
      if (!(await readVerifiedResumeTemplatePdf(paths.root, selected)))
        throw unavailable();
      if (!(await stillCurrent(snapshot))) continue;
      return selected;
    }
    throw unavailable();
  } catch (error) {
    await cleanupResumeTemplate(paths.root, final).catch(() => undefined);
    if (error instanceof WorkspaceError) throw error;
    throw unavailable();
  }
}

export async function readDesignatedResumeTemplatePdf(
  input: Options = {},
): Promise<Uint8Array | undefined> {
  try {
    const paths = await resolveAppDataPaths(input.appDataRoot);
    // This is a read path. Do not open BEGIN IMMEDIATE or apply migrations
    // here: a locked/read-only Windows app-data directory must still be able
    // to serve an already verified template preview.
    const db = openDatabase(paths.databasePath);
    let source: ResumeTemplateSource | undefined;
    try {
      source = findDesignatedResumeTemplate(db);
    } finally {
      db.close();
    }
    if (!source || source.origin !== "bundled" || source.state !== "verified")
      return undefined;
    const bytes = await readVerifiedResumeTemplatePdf(paths.root, source);
    if (!bytes) return undefined;
    const verifyDb = openDatabase(paths.databasePath);
    try {
      return findDesignatedResumeTemplate(verifyDb)?.id === source.id
        ? bytes
        : undefined;
    } finally {
      verifyDb.close();
    }
  } catch {
    return undefined;
  }
}

export async function readResumeTemplatePdf(
  input: Options & { templateId: string; templateDigest: string },
): Promise<Uint8Array | undefined> {
  try {
    const paths = await resolveAppDataPaths(input.appDataRoot);
    // Draft PDF previews only need a verified row and immutable bytes. A
    // write transaction here made previews fail with SQLITE_READONLY even
    // though the private template copy itself was readable.
    const db = openDatabase(paths.databasePath);
    let source: ResumeTemplateSource | undefined;
    try {
      source = findResumeTemplateById(
        db,
        input.templateId,
        input.templateDigest,
      );
    } finally {
      db.close();
    }
    if (!source) return undefined;
    return readVerifiedResumeTemplatePdf(paths.root, source);
  } catch {
    return undefined;
  }
}
