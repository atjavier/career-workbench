import { createUuidV7 } from "@/audit/audit-event";
import { documentResumeEvidenceFolder } from "@/domain/evidence/evidence-library";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";
import { interpretWorkspaceEvidence } from "@/domain/resume-generation/resume-evidence-interpretation";
import { reconcileResumeWorkspaceJourney } from "@/domain/resume-generation/resume-workspace-journey";

import { persistClarifiedEvidenceForResponseInDatabase } from "@/domain/resume-generation/resume-clarified-evidence";

export type ResumeEvidenceIntake = {
  id: string;
  workspaceId: string;
  status: "queued" | "running" | "ready" | "failed";
  message: string;
  updatedAt: string;
};
export type ResumeEvidenceIntakeWorkItem = {
  category: "project" | "experience";
  name: string;
  sourceDirectory: string;
  startDate?: string;
  endDate?: string;
  role?: string;
};
type Row = {
  id: string;
  workspace_id: string;
  status: ResumeEvidenceIntake["status"];
  message: string;
  updated_at: string;
};
const view = (row: Row): ResumeEvidenceIntake => ({
  id: row.id,
  workspaceId: row.workspace_id,
  status: row.status,
  message: row.message,
  updatedAt: row.updated_at,
});

export async function beginResumeEvidenceIntake(
  workspaceId: string,
): Promise<ResumeEvidenceIntake> {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    if (readActiveResumeWorkspace(db).workspace?.id !== workspaceId)
      throw new WorkspaceError(
        "RESUME_WORKSPACE_STALE",
        "That resume workspace was changed before evidence intake could start.",
        "Open the intended resume and try again.",
      );
    const now = new Date().toISOString();
    const intake = {
      id: createUuidV7(),
      workspaceId,
      status: "queued" as const,
      message: "Preparing your selected folders for evidence interpretation.",
      updatedAt: now,
    };
    const result = db
      .prepare(
        "INSERT INTO resume_evidence_intakes (id, workspace_id, status, message, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(workspace_id) DO UPDATE SET id = excluded.id, status = excluded.status, message = excluded.message, updated_at = excluded.updated_at, completed_at = NULL WHERE resume_evidence_intakes.status IN ('ready', 'failed')",
      )
      .run(
        intake.id,
        intake.workspaceId,
        intake.status,
        intake.message,
        now,
        now,
      );
    if (result.changes !== 1)
      throw new WorkspaceError(
        "RESUME_WORKSPACE_STALE",
        "Evidence intake is already running for this resume.",
        "Wait for it to finish before starting another intake.",
      );
    return intake;
  } finally {
    db.close();
  }
}
export async function readResumeEvidenceIntake(
  id: string,
): Promise<ResumeEvidenceIntake | undefined> {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const row = db
      .prepare(
        "SELECT id, workspace_id, status, message, updated_at FROM resume_evidence_intakes WHERE id = ?",
      )
      .get(id) as Row | undefined;
    return row ? view(row) : undefined;
  } finally {
    db.close();
  }
}
export async function readLatestResumeEvidenceIntake(
  workspaceId: string,
): Promise<ResumeEvidenceIntake | undefined> {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const row = db
      .prepare(
        "SELECT id, workspace_id, status, message, updated_at FROM resume_evidence_intakes WHERE workspace_id = ?",
      )
      .get(workspaceId) as Row | undefined;
    return row ? view(row) : undefined;
  } finally {
    db.close();
  }
}
async function update(
  id: string,
  status: ResumeEvidenceIntake["status"],
  message: string,
) {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE resume_evidence_intakes SET status = ?, message = ?, updated_at = ?, completed_at = CASE WHEN ? IN ('ready', 'failed') THEN ? ELSE NULL END WHERE id = ?",
    ).run(status, message, now, status, now, id);
  } finally {
    db.close();
  }
}
async function claim(id: string): Promise<ResumeEvidenceIntake | undefined> {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const now = new Date().toISOString();
    if (
      db
        .prepare(
          "UPDATE resume_evidence_intakes SET status = 'running', message = ?, updated_at = ? WHERE id = ? AND status = 'queued'",
        )
        .run(
          "Reading your selected local folders and documenting resume evidence.",
          now,
          id,
        ).changes !== 1
    )
      return undefined;
    const row = db
      .prepare(
        "SELECT id, workspace_id, status, message, updated_at FROM resume_evidence_intakes WHERE id = ?",
      )
      .get(id) as Row | undefined;
    return row ? view(row) : undefined;
  } finally {
    db.close();
  }
}
export async function runResumeEvidenceIntake(
  id: string,
  work: ResumeEvidenceIntakeWorkItem[],
): Promise<void> {
  const intake = await claim(id);
  if (!intake) return;
  await reconcileResumeWorkspaceJourney(intake.workspaceId);
  try {
    for (const item of work) {
      if (!(await readResumeEvidenceIntake(id))) return;
      try {
        await documentResumeEvidenceFolder({
          ...item,
          expectedWorkspaceId: intake.workspaceId,
          disclosed: true,
        });
      } catch (error) {
        if (
          error instanceof WorkspaceError &&
          error.code === "EVIDENCE_LIBRARY_DUPLICATE"
        )
          continue;
        throw error;
      }
    }
    if (!(await interpretWorkspaceEvidence(intake.workspaceId))) {
      if (await readResumeEvidenceIntake(id))
        await update(
          id,
          "failed",
          "Evidence intake stopped because this resume workspace was changed. Return to it and start the intake again.",
        );
      await reconcileResumeWorkspaceJourney(intake.workspaceId, {
        requireActive: false,
      });
      return;
    }
    const paths = await resolveAppDataPaths();
    const db = openDatabase(paths.databasePath);
    try {
      applyMigrations(db);
      const now = new Date().toISOString();
      for (const item of work) {
        const dateText = [item.startDate, item.endDate]
          .filter(Boolean)
          .join(" - ")
          .trim();
        if (dateText) {
          const task = db
            .prepare(
              "SELECT id, item_key AS itemKey, item_name AS itemName FROM resume_clarification_tasks WHERE workspace_id = ? AND item_name = ? AND category = 'dates' AND status = 'pending'",
            )
            .get(intake.workspaceId, item.name) as
            { id: string; itemKey: string; itemName: string } | undefined;
          if (task) {
            const responseId = createUuidV7();
            db.prepare(
              "INSERT INTO resume_clarification_task_responses (id, workspace_id, task_id, disposition, answer_text, created_at) VALUES (?, ?, ?, 'answered', ?, ?)",
            ).run(responseId, intake.workspaceId, task.id, dateText, now);
            db.prepare(
              "UPDATE resume_clarification_tasks SET status = 'answered' WHERE id = ? AND workspace_id = ?",
            ).run(task.id, intake.workspaceId);
            persistClarifiedEvidenceForResponseInDatabase(db, {
              workspaceId: intake.workspaceId,
              taskId: task.id,
              responseId,
              candidateText: dateText,
              now,
            });
          }
        }
        if (item.role) {
          const roleTask = db
            .prepare(
              "SELECT id, item_key AS itemKey, item_name AS itemName FROM resume_clarification_tasks WHERE workspace_id = ? AND item_name = ? AND category = 'role' AND status = 'pending'",
            )
            .get(intake.workspaceId, item.name) as
            { id: string; itemKey: string; itemName: string } | undefined;
          if (roleTask) {
            const responseId = createUuidV7();
            db.prepare(
              "INSERT INTO resume_clarification_task_responses (id, workspace_id, task_id, disposition, answer_text, created_at) VALUES (?, ?, ?, 'answered', ?, ?)",
            ).run(responseId, intake.workspaceId, roleTask.id, item.role, now);
            db.prepare(
              "UPDATE resume_clarification_tasks SET status = 'answered' WHERE id = ? AND workspace_id = ?",
            ).run(roleTask.id, intake.workspaceId);
            persistClarifiedEvidenceForResponseInDatabase(db, {
              workspaceId: intake.workspaceId,
              taskId: roleTask.id,
              responseId,
              candidateText: item.role,
              now,
            });
          }
        }
      }
    } finally {
      db.close();
    }
    if (!(await readResumeEvidenceIntake(id))) return;
    await update(
      id,
      "ready",
      "Your work is documented. Resume Coach will ask about any details the folders could not establish.",
    );
    await reconcileResumeWorkspaceJourney(intake.workspaceId);
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    if (await readResumeEvidenceIntake(id))
      await update(id, "failed", safe.summary);
    await reconcileResumeWorkspaceJourney(intake.workspaceId, {
      requireActive: false,
    }).catch(() => undefined);
  }
}
