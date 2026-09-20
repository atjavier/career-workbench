import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initializeWorkspace } from "../src/domain/workspace/initialize-workspace";
import {
  createActivityHistoryExport,
  createLocalBackup,
  listDataStorage,
  permanentlyDeleteBackup,
  restoreActivityHistoryExport,
  trashActivityHistoryExport,
} from "../src/domain/data-storage/data-storage";
import { applyMigrations, openDatabase } from "../src/persistence/database";
import { importBaseResume } from "../src/domain/base-resume/import-base-resume";
import { addManualEvidence } from "../src/domain/evidence/evidence-commands";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "data-storage-test-"));
  await initializeWorkspace({ appDataRoot: root });
  return root;
}
test("local history exports are recoverable for 30 days and stale changes fail", async () => {
  const root = await fixture();
  try {
    const item = await createActivityHistoryExport({ appDataRoot: root });
    const before = await readFile(join(root, item.storageLocation), "utf8");
    await trashActivityHistoryExport({
      appDataRoot: root,
      artifactId: item.id,
      expectedRevision: item.localRevision,
      confirmed: true,
    });
    await assert.rejects(
      trashActivityHistoryExport({
        appDataRoot: root,
        artifactId: item.id,
        expectedRevision: item.localRevision,
        confirmed: true,
      }),
      { code: "DATA_ARTIFACT_NOT_FOUND" },
    );
    const trashed = (
      await listDataStorage({ appDataRoot: root })
    ).artifacts.find((artifact) => artifact.id === item.id)!;
    assert.equal(trashed.lifecycleState, "trashed");
    assert.equal(
      new Date(trashed.expiresAt!).getTime() -
        new Date(trashed.deletedAt!).getTime(),
      30 * 24 * 60 * 60 * 1000,
    );
    await restoreActivityHistoryExport({
      appDataRoot: root,
      artifactId: item.id,
      expectedRevision: trashed.localRevision,
      confirmed: true,
    });
    const restored = (
      await listDataStorage({ appDataRoot: root })
    ).artifacts.find((artifact) => artifact.id === item.id)!;
    assert.equal(
      await readFile(join(root, restored.storageLocation), "utf8"),
      before,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("backup is private and permanent deletion never mutates append-only audits", async () => {
  const root = await fixture();
  try {
    const backup = await createLocalBackup({ appDataRoot: root });
    assert.match(backup.storageLocation, /^backups\//);
    await permanentlyDeleteBackup({
      appDataRoot: root,
      artifactId: backup.id,
      expectedRevision: backup.localRevision,
      confirmed: true,
    });
    const db = openDatabase(join(root, "workspace.sqlite"));
    try {
      applyMigrations(db);
      assert.throws(() => db.exec("DELETE FROM audit_events"), /append-only/);
    } finally {
      db.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("Data & Storage never mutates imported Base Resume or evidence records", async () => {
  const root = await fixture();
  try {
    const imported = await importBaseResume({
      appDataRoot: root,
      files: [
        {
          name: "resume.tex",
          bytes: new TextEncoder().encode("Skills: TypeScript"),
        },
      ],
    });
    const evidence = await addManualEvidence({
      appDataRoot: root,
      factualText: "Built local tools",
      sourceDocument: "Interview notes",
      sourceSection: "Projects",
    });
    const before = await readFile(
      join(root, imported.baseResume.storageLocation),
      "utf8",
    );
    await createLocalBackup({ appDataRoot: root });
    await createActivityHistoryExport({ appDataRoot: root });
    const db = openDatabase(join(root, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db.prepare("SELECT COUNT(*) AS count FROM base_resumes").get() as {
            count: number;
          }
        ).count,
        1,
      );
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM evidence_records WHERE id = ?",
            )
            .get(evidence.evidenceId) as { count: number }
        ).count,
        1,
      );
    } finally {
      db.close();
    }
    assert.equal(
      await readFile(join(root, imported.baseResume.storageLocation), "utf8"),
      before,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
