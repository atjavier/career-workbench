import type { DatabaseSync } from "node:sqlite";

export type ResumeJourneyPhase =
  | "onboarding"
  | "documenting"
  | "interview"
  | "ready_to_generate"
  | "ready_for_preview"
  | "recovery";
export type ResumeJourneyNextAction =
  | "complete_profile"
  | "wait_for_documentation"
  | "answer_clarifications"
  | "generate_resume"
  | "view_resume"
  | "recover";
export type ResumeWorkspaceJourney = {
  id: string;
  workspaceId: string;
  phase: ResumeJourneyPhase;
  nextAction: ResumeJourneyNextAction;
  message: string;
  stateFingerprint: string;
  stateRevision: number;
  createdAt: string;
  updatedAt: string;
};
type Row = {
  id: string;
  workspace_id: string;
  phase: ResumeJourneyPhase;
  next_action: ResumeJourneyNextAction;
  message: string;
  state_fingerprint: string;
  state_revision: number;
  created_at: string;
  updated_at: string;
};
const map = (row: Row): ResumeWorkspaceJourney => ({
  id: row.id,
  workspaceId: row.workspace_id,
  phase: row.phase,
  nextAction: row.next_action,
  message: row.message,
  stateFingerprint: row.state_fingerprint,
  stateRevision: row.state_revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function insertResumeWorkspaceJourney(
  db: DatabaseSync,
  value: ResumeWorkspaceJourney,
): void {
  db.prepare(
    "INSERT INTO resume_workspace_journeys (id, workspace_id, phase, next_action, message, state_fingerprint, state_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    value.id,
    value.workspaceId,
    value.phase,
    value.nextAction,
    value.message,
    value.stateFingerprint,
    value.stateRevision,
    value.createdAt,
    value.updatedAt,
  );
}
export function readResumeWorkspaceJourney(
  db: DatabaseSync,
  workspaceId: string,
): ResumeWorkspaceJourney | undefined {
  const row = db
    .prepare(
      "SELECT id, workspace_id, phase, next_action, message, state_fingerprint, state_revision, created_at, updated_at FROM resume_workspace_journeys WHERE workspace_id = ?",
    )
    .get(workspaceId) as Row | undefined;
  return row ? map(row) : undefined;
}
export function listResumeWorkspaceJourneys(
  db: DatabaseSync,
): ResumeWorkspaceJourney[] {
  return (
    db
      .prepare(
        "SELECT id, workspace_id, phase, next_action, message, state_fingerprint, state_revision, created_at, updated_at FROM resume_workspace_journeys",
      )
      .all() as Row[]
  ).map(map);
}
export function updateResumeWorkspaceJourney(
  db: DatabaseSync,
  value: Pick<
    ResumeWorkspaceJourney,
    "workspaceId" | "phase" | "nextAction" | "message" | "stateFingerprint"
  > & { updatedAt: string },
): ResumeWorkspaceJourney | undefined {
  db.prepare(
    "UPDATE resume_workspace_journeys SET phase = ?, next_action = ?, message = ?, state_fingerprint = ?, state_revision = state_revision + 1, updated_at = ? WHERE workspace_id = ? AND (phase <> ? OR next_action <> ? OR message <> ? OR state_fingerprint <> ?)",
  ).run(
    value.phase,
    value.nextAction,
    value.message,
    value.stateFingerprint,
    value.updatedAt,
    value.workspaceId,
    value.phase,
    value.nextAction,
    value.message,
    value.stateFingerprint,
  );
  return readResumeWorkspaceJourney(db, value.workspaceId);
}
