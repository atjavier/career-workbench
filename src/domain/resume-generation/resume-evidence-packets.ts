import { lstat, rename, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { createUuidV7 } from "@/audit/audit-event";
import { resolveAppDataPaths } from "@/files/app-data";
import { evidenceLibraryRoot } from "@/files/evidence-library";
import { WorkspaceError } from "@/domain/workspace/types";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";

type Category = "project" | "experience";
type Row = {
  itemName: string;
  itemCategory: Category;
  category: string;
  disposition: "answered" | "skipped";
  answer: string | null;
  createdAt: string;
  needsReview: number;
};
const safe = (value: string) => {
  const result = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  if (!result || result === "." || result === "..")
    throw new WorkspaceError(
      "EVIDENCE_LIBRARY_INVALID",
      "The managed evidence packet is unavailable.",
      "Refresh the intended resume workspace and try again.",
    );
  return result;
};
const inside = (root: string, target: string) => {
  const value = relative(root, target);
  return (
    Boolean(value) &&
    value !== ".." &&
    !value.startsWith(`..${sep}`) &&
    !value.includes(`${sep}..${sep}`)
  );
};
const packetPath = (workspaceId: string, category: Category, name: string) =>
  `resume-evidence/workspaces/${safe(workspaceId)}/${category === "project" ? "projects" : "experiences"}/${safe(name)}/resume-clarifications.md`;
export function workspaceEvidencePacketDirectory(
  workspaceRoot: string | undefined,
  workspaceId: string,
  category: Category,
  name: string,
): string {
  const root = evidenceLibraryRoot(workspaceRoot);
  const target = join(
    root,
    "workspaces",
    safe(workspaceId),
    category === "project" ? "projects" : "experiences",
    safe(name),
  );
  if (!inside(root, target))
    throw new WorkspaceError(
      "EVIDENCE_LIBRARY_INVALID",
      "The managed evidence packet location is unsafe.",
      "Refresh the intended resume workspace and try again.",
    );
  return target;
}
async function assertSafe(path: string, root: string) {
  for (let current = path; ; current = resolve(current, "..")) {
    const stat = await lstat(current).catch(() => undefined);
    if (stat?.isSymbolicLink())
      throw new WorkspaceError(
        "EVIDENCE_LIBRARY_INVALID",
        "The managed evidence packet contains an unsafe link.",
        "Remove the unsafe link and try again.",
      );
    if (current === root) return;
  }
}
function rowsFor(
  db: ReturnType<typeof openDatabase>,
  workspaceId: string,
  itemKey: string,
): Row[] {
  return db
    .prepare(
      "SELECT t.item_name AS itemName, t.item_category AS itemCategory, t.category, r.disposition, r.answer_text AS answer, r.created_at AS createdAt, EXISTS(SELECT 1 FROM resume_clarified_evidence e JOIN resume_clarified_evidence_conflicts c ON c.clarified_evidence_id = e.id AND c.workspace_id = e.workspace_id WHERE e.task_id = t.id AND e.workspace_id = t.workspace_id AND c.status = 'needs_review') AS needsReview FROM resume_clarification_tasks t JOIN resume_clarification_task_responses r ON r.task_id = t.id AND r.workspace_id = t.workspace_id WHERE t.workspace_id = ? AND t.item_key = ? ORDER BY r.created_at, r.id",
    )
    .all(workspaceId, itemKey) as Row[];
}
function upsert(
  db: ReturnType<typeof openDatabase>,
  workspaceId: string,
  itemKey: string,
  category: Category,
  name: string,
  status: "ready" | "recovery_needed",
) {
  db.prepare(
    "INSERT INTO resume_evidence_packets (workspace_id, item_key, packet_path, sync_status, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(workspace_id, item_key) DO UPDATE SET packet_path = excluded.packet_path, sync_status = excluded.sync_status, updated_at = excluded.updated_at",
  ).run(
    workspaceId,
    itemKey,
    packetPath(workspaceId, category, name),
    status,
    new Date().toISOString(),
  );
}
export async function markWorkspaceClarificationPacketRecovery(input: {
  appDataRoot?: string;
  workspaceId: string;
  itemKey: string;
}): Promise<void> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const rows = rowsFor(db, input.workspaceId, input.itemKey);
    if (rows[0])
      upsert(
        db,
        input.workspaceId,
        input.itemKey,
        rows[0].itemCategory,
        rows[0].itemName,
        "recovery_needed",
      );
  } finally {
    db.close();
  }
}
export async function writeWorkspaceClarificationPacket(input: {
  appDataRoot?: string;
  workspaceRoot?: string;
  workspaceId: string;
  itemKey: string;
}): Promise<void> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  let rows: Row[];
  try {
    applyMigrations(db);
    if (readActiveResumeWorkspace(db).workspace?.id !== input.workspaceId)
      throw new WorkspaceError(
        "RESUME_WORKSPACE_STALE",
        "That resume workspace changed before its evidence packet could be synchronized.",
        "Return to the intended resume and try again.",
      );
    rows = rowsFor(db, input.workspaceId, input.itemKey);
  } finally {
    db.close();
  }
  if (!rows!.length) return;
  const first = rows![0]!;
  const markdown =
    `# Resume Clarifications (Candidate-Provided)\n\n- Item: ${first.itemName}\n- Category: ${first.itemCategory}\n\n` +
    rows!
      .map(
        (row) =>
          `## ${row.category}\n\n- ${row.disposition === "skipped" ? "Explicit unknown: Candidate skipped this clarification." : `Candidate-provided answer: ${row.answer ?? ""}`}\n- Timestamp: ${row.createdAt}\n- Provenance: ${row.disposition === "skipped" ? "explicit_unknown" : "candidate_interview_answer"}\n- Conflict review: ${row.needsReview ? "needs_review" : "none"}\n`,
      )
      .join("\n");
  const root = evidenceLibraryRoot(input.workspaceRoot);
  const directory = workspaceEvidencePacketDirectory(
    input.workspaceRoot,
    input.workspaceId,
    first.itemCategory,
    first.itemName,
  );
  if (!(await lstat(directory).catch(() => undefined))) return;
  await assertSafe(directory, root);
  const temporary = join(directory, `.clarifications-${createUuidV7()}.tmp`);
  const target = join(directory, "resume-clarifications.md");
  try {
    await writeFile(temporary, markdown, { encoding: "utf8", flag: "wx" });
    const verify = openDatabase(paths.databasePath);
    try {
      applyMigrations(verify);
      if (readActiveResumeWorkspace(verify).workspace?.id !== input.workspaceId)
        throw new WorkspaceError(
          "RESUME_WORKSPACE_STALE",
          "That resume workspace changed before its evidence packet could be synchronized.",
          "Return to the intended resume and try again.",
        );
      await assertSafe(directory, root);
      await rename(temporary, target);
      upsert(
        verify,
        input.workspaceId,
        input.itemKey,
        first.itemCategory,
        first.itemName,
        "ready",
      );
    } finally {
      verify.close();
    }
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    await markWorkspaceClarificationPacketRecovery(input).catch(
      () => undefined,
    );
    throw error;
  }
}
