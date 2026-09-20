import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { WorkspaceError } from "@/domain/workspace/types";
import {
  createDatabaseBackup,
  createHistoryExport,
  moveArtifact,
  removeArtifact,
  verifyArtifact,
  verifyDatabaseBackup,
} from "@/files/data-lifecycle";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import {
  getManagedArtifact,
  insertManagedArtifact,
  listManagedArtifacts,
  listSafeAuditEvents,
  markPermanentlyDeleted,
  storageCounts,
  updateManagedArtifact,
  type ManagedArtifact,
} from "@/persistence/data-lifecycle-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

type Options = { appDataRoot?: string };
type MutableInput = Options & {
  artifactId: string;
  expectedRevision: number;
  confirmed: boolean;
};
export type DataStorageView = {
  artifacts: ManagedArtifact[];
  restorableArtifactIds: string[];
  auditEvents: ReturnType<typeof listSafeAuditEvents>;
  inventory: {
    label: string;
    location: string;
    usage: string;
    connectedService: string;
  }[];
};
const now = () => new Date().toISOString();
const expiry = (timestamp: string) =>
  new Date(
    new Date(timestamp).getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
function audit(
  db: ReturnType<typeof openDatabase>,
  action: Parameters<typeof createAuditEvent>[0]["action"],
  outcome: "success" | "failure",
  entityId?: string,
  contentHash?: string,
) {
  appendAuditEvent(
    db,
    createAuditEvent({
      actor: "local-os-user",
      action,
      outcome,
      entityId,
      contentHash,
    }),
  );
}
async function database<T>(
  options: Options,
  work: (db: ReturnType<typeof openDatabase>) => T | Promise<T>,
): Promise<T> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    return await work(db);
  } finally {
    db.close();
  }
}
function transact<T>(db: ReturnType<typeof openDatabase>, work: () => T): T {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = work();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}
function requireConfirmation(input: MutableInput) {
  if (!input.confirmed)
    throw new WorkspaceError(
      "DATA_CONFIRMATION_REQUIRED",
      "Confirm the local data action before continuing.",
      "Review the local and recovery consequences, then confirm the action.",
    );
}
function currentArtifact(
  db: ReturnType<typeof openDatabase>,
  input: MutableInput,
  kind: ManagedArtifact["artifactKind"],
  state: ManagedArtifact["lifecycleState"],
): ManagedArtifact {
  const item = getManagedArtifact(db, input.artifactId);
  if (!item || item.artifactKind !== kind || item.lifecycleState !== state)
    throw new WorkspaceError(
      "DATA_ARTIFACT_NOT_FOUND",
      "That local data artifact is unavailable.",
      "Refresh Data & Storage and choose an available artifact.",
    );
  if (item.localRevision !== input.expectedRevision)
    throw new WorkspaceError(
      "DATA_ARTIFACT_STALE",
      "That local data artifact changed before your action completed.",
      "Refresh Data & Storage, review the current state, and try again.",
    );
  return item;
}
function recordFailure(
  db: ReturnType<typeof openDatabase>,
  action: Parameters<typeof createAuditEvent>[0]["action"],
  id?: string,
) {
  transact(db, () => audit(db, action, "failure", id));
}

export async function listDataStorage(
  options: Options = {},
): Promise<DataStorageView> {
  return database(options, (db) => {
    const counts = storageCounts(db);
    const artifacts = listManagedArtifacts(db);
    const currentTime = now();
    const artifactBytes = artifacts
      .filter(
        (item) =>
          item.lifecycleState === "active" ||
          (item.lifecycleState === "trashed" &&
            item.expiresAt &&
            item.expiresAt > currentTime),
      )
      .reduce((total, item) => total + item.byteSize, 0);
    return {
      artifacts: artifacts.filter((item) => item.lifecycleState !== "expired"),
      restorableArtifactIds: artifacts
        .filter(
          (item) =>
            item.lifecycleState === "trashed" &&
            item.expiresAt &&
            item.expiresAt > currentTime,
        )
        .map((item) => item.id),
      auditEvents: listSafeAuditEvents(db),
      inventory: [
        {
          label: "Base Resumes",
          location: "Private local app data (read-only)",
          usage: `${counts.baseResumes} record${counts.baseResumes === 1 ? "" : "s"}`,
          connectedService: "No connected service",
        },
        {
          label: "Candidate evidence",
          location: "Private local app data",
          usage: `${counts.evidence} record${counts.evidence === 1 ? "" : "s"}`,
          connectedService: "No connected service",
        },
        {
          label: "Activity history",
          location: "Private local app data",
          usage: `${counts.audits} metadata event${counts.audits === 1 ? "" : "s"}`,
          connectedService: "No connected service",
        },
        {
          label: "Managed local artifacts",
          location: "Private local app data / Local trash",
          usage: `${artifactBytes} bytes`,
          connectedService: "No connected service",
        },
      ],
    };
  });
}

export async function createLocalBackup(
  options: Options = {},
): Promise<ManagedArtifact> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const id = createUuidV7();
  const written = await createDatabaseBackup(paths, id);
  try {
    return await database(options, (db) =>
      transact(db, () => {
        const timestamp = now();
        const item: ManagedArtifact = {
          id,
          artifactKind: "backup",
          lifecycleState: "active",
          storageLocation: written.location,
          contentDigest: written.digest,
          byteSize: written.byteSize,
          localRevision: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        insertManagedArtifact(db, item);
        audit(db, "data.backup_created", "success", id, written.digest);
        return item;
      }),
    );
  } catch (error) {
    await removeArtifact(paths, written.location).catch(() => undefined);
    throw error;
  }
}

export async function createActivityHistoryExport(
  options: Options = {},
): Promise<ManagedArtifact> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const id = createUuidV7();
  const events = await database(options, (db) => listSafeAuditEvents(db));
  const written = await createHistoryExport(
    paths,
    id,
    JSON.stringify({ generatedAt: now(), events }, null, 2),
  );
  try {
    return await database(options, (db) =>
      transact(db, () => {
        const timestamp = now();
        const item: ManagedArtifact = {
          id,
          artifactKind: "activity_history_export",
          lifecycleState: "active",
          storageLocation: written.location,
          contentDigest: written.digest,
          byteSize: written.byteSize,
          localRevision: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        insertManagedArtifact(db, item);
        audit(db, "data.history_exported", "success", id, written.digest);
        return item;
      }),
    );
  } catch (error) {
    await removeArtifact(paths, written.location).catch(() => undefined);
    throw error;
  }
}

export async function trashActivityHistoryExport(
  input: MutableInput,
): Promise<void> {
  requireConfirmation(input);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  await database(input, async (db) => {
    let moved = false;
    let item: ManagedArtifact | undefined;
    const target = `trash/${input.artifactId}.json`;
    db.exec("BEGIN IMMEDIATE;");
    try {
      item = currentArtifact(db, input, "activity_history_export", "active");
      await moveArtifact(paths, item.storageLocation, target);
      moved = true;
      const timestamp = now();
      updateManagedArtifact(
        db,
        {
          ...item,
          lifecycleState: "trashed",
          storageLocation: target,
          localRevision: item.localRevision + 1,
          updatedAt: timestamp,
          deletedAt: timestamp,
          expiresAt: expiry(timestamp),
        },
        item.localRevision,
      );
      audit(db, "data.trashed", "success", item.id, item.contentDigest);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      if (moved && item)
        await moveArtifact(paths, target, item.storageLocation).catch(
          () => undefined,
        );
      throw error;
    }
  });
}

export async function restoreActivityHistoryExport(
  input: MutableInput,
): Promise<void> {
  requireConfirmation(input);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  await database(input, async (db) => {
    let moved = false;
    let item: ManagedArtifact | undefined;
    const target = `activity-history-exports/${input.artifactId}.json`;
    db.exec("BEGIN IMMEDIATE;");
    try {
      item = currentArtifact(db, input, "activity_history_export", "trashed");
      if (!item.expiresAt || item.expiresAt <= now())
        throw new WorkspaceError(
          "DATA_ARTIFACT_EXPIRED",
          "That local trash item has expired.",
          "Create a new activity-history export if you still need it.",
        );
      await verifyArtifact(paths, item.storageLocation, item.contentDigest);
      await moveArtifact(paths, item.storageLocation, target);
      moved = true;
      const timestamp = now();
      updateManagedArtifact(
        db,
        {
          ...item,
          lifecycleState: "active",
          storageLocation: target,
          localRevision: item.localRevision + 1,
          updatedAt: timestamp,
          deletedAt: undefined,
          expiresAt: undefined,
        },
        item.localRevision,
      );
      audit(db, "data.restored", "success", item.id, item.contentDigest);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      if (moved && item)
        await moveArtifact(paths, target, item.storageLocation).catch(
          () => undefined,
        );
      throw error;
    }
  });
}

export async function permanentlyDeleteBackup(
  input: MutableInput,
): Promise<void> {
  requireConfirmation(input);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  await database(input, async (db) => {
    let item: ManagedArtifact | undefined;
    let quarantined = false;
    const quarantine = `staging/deletions/${input.artifactId}.sqlite`;
    db.exec("BEGIN IMMEDIATE;");
    try {
      item = currentArtifact(db, input, "backup", "active");
      await verifyDatabaseBackup(
        paths,
        item.storageLocation,
        item.contentDigest,
      );
      await moveArtifact(paths, item.storageLocation, quarantine);
      quarantined = true;
      markPermanentlyDeleted(db, item.id, item.localRevision, now());
      audit(
        db,
        "data.permanently_deleted",
        "success",
        item.id,
        item.contentDigest,
      );
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      if (quarantined && item)
        await moveArtifact(paths, quarantine, item.storageLocation).catch(
          () => undefined,
        );
      throw error;
    }
    await removeArtifact(paths, quarantine);
  });
}

export async function cleanupExpiredTrash(
  options: Options & { confirmed: boolean },
): Promise<number> {
  if (!options.confirmed)
    throw new WorkspaceError(
      "DATA_CONFIRMATION_REQUIRED",
      "Confirm expired-trash cleanup before continuing.",
      "Review the local recovery consequence, then confirm cleanup.",
    );
  const paths = await resolveAppDataPaths(options.appDataRoot);
  return database(options, async (db) => {
    const expired = listManagedArtifacts(db).filter(
      (item) =>
        item.lifecycleState === "trashed" &&
        item.expiresAt &&
        item.expiresAt <= now(),
    );
    for (const item of expired) {
      const quarantine = `staging/expired/${item.id}.json`;
      let moved = false;
      db.exec("BEGIN IMMEDIATE;");
      try {
        const current = currentArtifact(
          db,
          {
            artifactId: item.id,
            expectedRevision: item.localRevision,
            confirmed: true,
          },
          "activity_history_export",
          "trashed",
        );
        await moveArtifact(paths, current.storageLocation, quarantine);
        moved = true;
        updateManagedArtifact(
          db,
          {
            ...current,
            lifecycleState: "expired",
            storageLocation: quarantine,
            localRevision: current.localRevision + 1,
            updatedAt: now(),
          },
          current.localRevision,
        );
        audit(
          db,
          "data.expired_cleanup",
          "success",
          current.id,
          current.contentDigest,
        );
        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        if (moved)
          await moveArtifact(paths, quarantine, item.storageLocation).catch(
            () => undefined,
          );
        throw error;
      }
      await removeArtifact(paths, quarantine);
    }
    return expired.length;
  });
}

export async function recordDataStorageFailure(
  options: Options & { artifactId?: string } = {},
): Promise<void> {
  const entityId =
    options.artifactId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      options.artifactId,
    )
      ? options.artifactId
      : undefined;
  await database(options, (db) =>
    recordFailure(db, "data.failed", entityId),
  ).catch(() => undefined);
}
