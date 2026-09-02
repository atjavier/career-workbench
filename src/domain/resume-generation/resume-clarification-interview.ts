import { createUuidV7 } from "@/audit/audit-event";
import { reconcileResumeWorkspaceJourneyInDatabase } from "@/domain/resume-generation/resume-workspace-journey";
import { persistClarifiedEvidenceForResponseInDatabase } from "@/domain/resume-generation/resume-clarified-evidence";
import { WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";
import {
  markWorkspaceClarificationPacketRecovery,
  writeWorkspaceClarificationPacket,
} from "@/domain/resume-generation/resume-evidence-packets";

type Status = "pending" | "answered" | "skipped";
export type InterviewTask = {
  id: string;
  itemName: string;
  itemCategory: "project" | "experience";
  category: string;
  question: string;
  status: Status;
  answer?: string;
  completedAt?: string;
  needsReview?: boolean;
};
export type InterviewTurn = {
  id: string;
  taskId: string;
  role: "coach" | "candidate";
  content: string;
  createdAt: string;
};
export type InterviewView = {
  completed: InterviewTask[];
  current?: InterviewTask;
  remaining: number;
  total: number;
  turns: InterviewTurn[];
};
type Options = { appDataRoot?: string; workspaceRoot?: string };
export type ResumeInterviewStreamStart = {
  question: string;
  context: string[];
  transcript: string[];
  clarificationUsed: boolean;
};
const plain = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const requestUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const transcriptContent = (value: string) => value.replace(/\s+/g, " ").trim();
const labels: Record<string, string> = {
  purpose: "purpose",
  ownership: "your contribution",
  users_workflow: "users and workflow",
  outcome: "outcome and impact",
  metrics: "results or scale",
  deployment: "deployment or usage",
  collaboration: "collaboration",
  dates: "dates",
  role: "role",
};

function view(
  db: ReturnType<typeof openDatabase>,
  workspaceId: string,
): InterviewView {
  // SAFETY: this fixed query selects and aliases every InterviewTask field from application-owned tables.
  const rows = db
    .prepare(
      "SELECT t.id, t.item_name AS itemName, t.item_category AS itemCategory, t.category, t.question, t.status, r.answer_text AS answer, r.created_at AS completedAt, EXISTS(SELECT 1 FROM resume_clarified_evidence e JOIN resume_clarified_evidence_conflicts c ON c.clarified_evidence_id = e.id AND c.workspace_id = e.workspace_id WHERE e.task_id = t.id AND e.workspace_id = t.workspace_id AND c.status = 'needs_review') AS needsReview FROM resume_clarification_tasks t LEFT JOIN resume_clarification_task_responses r ON r.task_id = t.id AND r.workspace_id = t.workspace_id WHERE t.workspace_id = ? ORDER BY t.created_at, t.id",
    )
    .all(workspaceId) as unknown as InterviewTask[];
  const normalized = rows.map((task) => ({
    ...task,
    answer: task.answer ?? undefined,
    completedAt: task.completedAt ?? undefined,
    needsReview: Boolean(task.needsReview),
  }));
  const completed = normalized.filter((task) => task.status !== "pending");
  const pending = normalized.filter((task) => task.status === "pending");
  // SQLite rows use a non-plain prototype; project them before crossing the Server/Client Component boundary.
  const turns = (
    db
      .prepare(
        "SELECT id, task_id AS taskId, role, content, created_at AS createdAt FROM (SELECT id, task_id, 'coach' AS role, content, created_at FROM resume_interview_turns WHERE workspace_id = ? UNION ALL SELECT id, task_id, 'candidate' AS role, content, created_at FROM resume_interview_candidate_turns WHERE workspace_id = ? UNION ALL SELECT r.id, r.task_id, 'candidate' AS role, CASE r.disposition WHEN 'skipped' THEN 'Marked unknown' ELSE r.answer_text END AS content, r.created_at FROM resume_clarification_task_responses r WHERE r.workspace_id = ? AND NOT EXISTS (SELECT 1 FROM resume_interview_candidate_turns c WHERE c.workspace_id = r.workspace_id AND c.task_id = r.task_id AND c.content = CASE r.disposition WHEN 'skipped' THEN 'Marked unknown' ELSE r.answer_text END)) ORDER BY created_at DESC, CASE role WHEN 'coach' THEN 1 ELSE 0 END DESC, id DESC LIMIT 80",
      )
      .all(workspaceId, workspaceId, workspaceId) as InterviewTurn[]
  )
    .toReversed()
    .map(
      (turn): InterviewTurn => ({
        id: turn.id,
        taskId: turn.taskId,
        role: turn.role,
        content: turn.content,
        createdAt: turn.createdAt,
      }),
    );
  return {
    completed,
    current: pending[0],
    remaining: pending.length,
    total: rows.length,
    turns,
  };
}
export function interviewCategoryLabel(category: string): string {
  return labels[category] ?? "additional context";
}
export async function readResumeClarificationInterview(
  workspaceId: string,
  options: Options = {},
): Promise<InterviewView | undefined> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    return readActiveResumeWorkspace(db).workspace?.id === workspaceId
      ? view(db, workspaceId)
      : undefined;
  } finally {
    db.close();
  }
}
export async function readBoundedResumeInterviewContext(
  workspaceId: string,
  taskId: string,
  options: Options = {},
): Promise<string[]> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    if (readActiveResumeWorkspace(db).workspace?.id !== workspaceId)
      throw new WorkspaceError(
        "RESUME_WORKSPACE_STALE",
        "That resume workspace changed before Coach Resume could continue.",
        "Return to the intended interview and try again.",
      );
    const task = db
      .prepare(
        "SELECT item_key AS itemKey FROM resume_clarification_tasks WHERE id = ? AND workspace_id = ? AND status = 'pending'",
      )
      .get(taskId, workspaceId) as { itemKey: string } | undefined;
    if (!task)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "That clarification question is no longer awaiting an answer.",
        "Refresh Coach Resume and continue with its current question.",
      );
    const documented = db
      .prepare(
        "SELECT content FROM resume_evidence_interpretations WHERE workspace_id = ? AND item_key = ? ORDER BY created_at, id LIMIT 12",
      )
      .all(workspaceId, task.itemKey) as Array<{ content: string }>;
    const clarified = db
      .prepare(
        "SELECT candidate_text AS content FROM resume_clarified_evidence WHERE workspace_id = ? AND item_key = ? ORDER BY created_at, id LIMIT 8",
      )
      .all(workspaceId, task.itemKey) as Array<{ content: string }>;
    return [...documented, ...clarified]
      .map((row) => row.content.trim())
      .filter((value) => value.length > 0 && value.length <= 1200)
      .slice(0, 20);
  } finally {
    db.close();
  }
}
export async function readBoundedResumeInterviewTranscript(
  workspaceId: string,
  taskId: string,
  options: Options = {},
): Promise<string[]> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    if (readActiveResumeWorkspace(db).workspace?.id !== workspaceId)
      throw new WorkspaceError(
        "RESUME_WORKSPACE_STALE",
        "That resume workspace changed before Coach Resume could continue.",
        "Return to the intended interview and try again.",
      );
    return (
      db
        .prepare(
          "SELECT role, content FROM (SELECT 'coach' AS role, content, created_at, id FROM resume_interview_turns WHERE workspace_id = ? AND task_id = ? UNION ALL SELECT 'candidate' AS role, content, created_at, id FROM resume_interview_candidate_turns WHERE workspace_id = ? AND task_id = ? UNION ALL SELECT 'candidate' AS role, CASE disposition WHEN 'skipped' THEN 'Marked unknown' ELSE answer_text END AS content, created_at, id FROM resume_clarification_task_responses WHERE workspace_id = ? AND task_id = ?) ORDER BY created_at DESC, CASE role WHEN 'coach' THEN 1 ELSE 0 END DESC, id DESC LIMIT 20",
        )
        .all(
          workspaceId,
          taskId,
          workspaceId,
          taskId,
          workspaceId,
          taskId,
        ) as Array<{ role: "coach" | "candidate"; content: string }>
    )
      .reverse()
      .map(
        (turn) =>
          `${turn.role === "coach" ? "Coach" : "Candidate"}: ${transcriptContent(turn.content)}`,
      );
  } finally {
    db.close();
  }
}
export async function recordResumeInterviewCoachTurn(
  input: Options & {
    workspaceId: string;
    taskId: string;
    candidateContent: string;
    coachContent: string;
  },
): Promise<void> {
  const candidateContent = input.candidateContent.trim();
  const coachContent = input.coachContent.trim();
  if (
    !candidateContent ||
    candidateContent.length > 1200 ||
    !coachContent ||
    coachContent.length > 1800
  )
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The local Coach Resume reply is unavailable.",
      "Try the saved clarification question again.",
    );
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (
        readActiveResumeWorkspace(db).workspace?.id !== input.workspaceId ||
        !db
          .prepare(
            "SELECT 1 FROM resume_clarification_tasks WHERE id = ? AND workspace_id = ? AND status = 'pending'",
          )
          .get(input.taskId, input.workspaceId)
      )
        throw new WorkspaceError(
          "RESUME_WORKSPACE_STALE",
          "That resume workspace changed before the Coach reply could be saved.",
          "Return to the intended interview and continue its current question.",
        );
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO resume_interview_candidate_turns (id, workspace_id, task_id, content, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(
        createUuidV7(),
        input.workspaceId,
        input.taskId,
        candidateContent,
        now,
      );
      db.prepare(
        "INSERT INTO resume_interview_turns (id, workspace_id, task_id, role, content, created_at) VALUES (?, ?, ?, 'coach', ?, ?)",
      ).run(createUuidV7(), input.workspaceId, input.taskId, coachContent, now);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}
export async function beginResumeInterviewCoachStream(
  input: Options & {
    workspaceId: string;
    taskId: string;
    candidateContent?: string;
    opening?: boolean;
    streamRequestId: string;
  },
): Promise<ResumeInterviewStreamStart> {
  const opening = input.opening === true;
  const candidateContent = (input.candidateContent ?? "").trim();
  if (
    !uuid(input.workspaceId) ||
    !plain(input.taskId, 80) ||
    !requestUuid(input.streamRequestId) ||
    (opening ? candidateContent !== "" : !plain(candidateContent, 1_200))
  )
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "Write a concise message before explicitly sending it to local Coach Resume.",
      "Review the local-only disclosure and try again.",
    );
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (readActiveResumeWorkspace(db).workspace?.id !== input.workspaceId)
        throw new WorkspaceError(
          "RESUME_WORKSPACE_STALE",
          "That resume workspace changed before Coach Resume could continue.",
          "Return to the intended interview and try again.",
        );
      const task = db
        .prepare(
          "SELECT item_key AS itemKey, question FROM resume_clarification_tasks WHERE id = ? AND workspace_id = ? AND status = 'pending'",
        )
        .get(input.taskId, input.workspaceId) as
        | { itemKey: string; question: string }
        | undefined;
      if (!task)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "That clarification question is no longer awaiting an answer.",
          "Refresh Coach Resume and continue with its current question.",
        );
      const reservation = db
        .prepare(
          "SELECT 1 FROM resume_interview_stream_reservations WHERE stream_request_id = ?",
        )
        .get(input.streamRequestId);
      if (reservation)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "That Coach Resume request was already used.",
          "Write a new message and explicitly send it again.",
        );
      const existing = db
        .prepare(
          "SELECT content FROM resume_interview_candidate_turns WHERE stream_request_id = ? AND workspace_id = ? AND task_id = ?",
        )
        .get(input.streamRequestId, input.workspaceId, input.taskId) as
        | { content: string }
        | undefined;
      if (existing && existing.content !== candidateContent)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "That Coach Resume request no longer matches its saved message.",
          "Write a new message and explicitly send it again.",
        );
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO resume_interview_stream_reservations (stream_request_id, workspace_id, task_id, status, created_at) VALUES (?, ?, ?, 'started', ?)",
      ).run(input.streamRequestId, input.workspaceId, input.taskId, now);
      if (!opening && !existing)
        db.prepare(
          "INSERT INTO resume_interview_candidate_turns (id, workspace_id, task_id, content, created_at, stream_request_id) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
          createUuidV7(),
          input.workspaceId,
          input.taskId,
          candidateContent,
          now,
          input.streamRequestId,
        );
      const context = [
        ...(db
          .prepare(
            "SELECT content FROM resume_evidence_interpretations WHERE workspace_id = ? AND item_key = ? ORDER BY created_at, id LIMIT 12",
          )
          .all(input.workspaceId, task.itemKey) as Array<{ content: string }>),
        ...(db
          .prepare(
            "SELECT candidate_text AS content FROM resume_clarified_evidence WHERE workspace_id = ? AND item_key = ? ORDER BY created_at, id LIMIT 8",
          )
          .all(input.workspaceId, task.itemKey) as Array<{ content: string }>),
      ]
        .map((row) => row.content.trim())
        .filter((value) => plain(value, 1_200))
        .slice(0, 20);
      const transcript = (
        db
          .prepare(
            "SELECT role, content FROM (SELECT 'coach' AS role, content, created_at, id FROM resume_interview_turns WHERE workspace_id = ? AND task_id = ? UNION ALL SELECT 'candidate' AS role, content, created_at, id FROM resume_interview_candidate_turns WHERE workspace_id = ? AND task_id = ? UNION ALL SELECT 'candidate' AS role, CASE disposition WHEN 'skipped' THEN 'Marked unknown' ELSE answer_text END AS content, created_at, id FROM resume_clarification_task_responses WHERE workspace_id = ? AND task_id = ?) ORDER BY created_at DESC, CASE role WHEN 'coach' THEN 1 ELSE 0 END DESC, id DESC LIMIT 20",
          )
          .all(
            input.workspaceId,
            input.taskId,
            input.workspaceId,
            input.taskId,
            input.workspaceId,
            input.taskId,
          ) as Array<{
          role: "coach" | "candidate";
          content: string;
        }>
      )
        .reverse()
        .map(
          (turn) =>
            `${turn.role === "coach" ? "Coach" : "Candidate"}: ${transcriptContent(turn.content)}`,
        );
      const clarificationUsed = Boolean(
        (
          db
            .prepare(
              "SELECT 1 FROM resume_interview_stream_reservations completed JOIN resume_interview_candidate_turns candidate ON candidate.stream_request_id = completed.stream_request_id JOIN resume_interview_turns coach ON coach.stream_request_id = completed.stream_request_id WHERE completed.workspace_id = ? AND completed.task_id = ? AND completed.status = 'completed' LIMIT 1",
            )
            .get(input.workspaceId, input.taskId) as { 1: number } | undefined
        ),
      );
      db.exec("COMMIT");
      return { question: task.question, context, transcript, clarificationUsed };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

export async function finalizeResumeInterviewCoachStream(
  input: Options & {
    workspaceId: string;
    taskId: string;
    streamRequestId: string;
    coachContent: string;
    opening?: boolean;
    signal?: AbortSignal;
  },
): Promise<void> {
  if (input.signal?.aborted) return;
  const coachContent = input.coachContent.trim();
  if (
    !uuid(input.workspaceId) ||
    !plain(input.taskId, 80) ||
    !requestUuid(input.streamRequestId) ||
    !coachContent ||
    coachContent.length > 1_800
  )
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The local Coach Resume reply is unavailable.",
      "Try the saved clarification question again.",
    );
  const paths = await resolveAppDataPaths(input.appDataRoot);
  if (input.signal?.aborted) return;
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const candidateTurn = db
        .prepare(
          "SELECT 1 FROM resume_interview_candidate_turns WHERE stream_request_id = ? AND workspace_id = ? AND task_id = ?",
        )
        .get(input.streamRequestId, input.workspaceId, input.taskId);
      if (
        readActiveResumeWorkspace(db).workspace?.id !== input.workspaceId ||
        !db
          .prepare(
            "SELECT 1 FROM resume_clarification_tasks WHERE id = ? AND workspace_id = ? AND status = 'pending'",
          )
          .get(input.taskId, input.workspaceId) ||
        (input.opening === true ? candidateTurn : !candidateTurn) ||
        !db
          .prepare(
            "SELECT 1 FROM resume_interview_stream_reservations WHERE stream_request_id = ? AND workspace_id = ? AND task_id = ?",
          )
          .get(input.streamRequestId, input.workspaceId, input.taskId)
      )
        throw new WorkspaceError(
          "RESUME_WORKSPACE_STALE",
          "That resume workspace changed before the Coach reply could be saved.",
          "Return to the intended interview and continue its current question.",
        );
      if (
        input.opening !== true &&
        db
          .prepare(
            "SELECT 1 FROM resume_interview_stream_reservations completed JOIN resume_interview_candidate_turns candidate ON candidate.stream_request_id = completed.stream_request_id JOIN resume_interview_turns coach ON coach.stream_request_id = completed.stream_request_id WHERE completed.workspace_id = ? AND completed.task_id = ? AND completed.status = 'completed' AND completed.stream_request_id <> ? LIMIT 1",
          )
          .get(input.workspaceId, input.taskId, input.streamRequestId)
      )
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "That clarification already has its one allowed follow-up.",
          "Continue with the saved answer or move to the current question.",
        );
      const completion = db
        .prepare(
          "UPDATE resume_interview_stream_reservations SET status = 'completed' WHERE stream_request_id = ? AND workspace_id = ? AND task_id = ? AND status = 'started'",
        )
        .run(input.streamRequestId, input.workspaceId, input.taskId);
      if (completion.changes) {
        db.prepare(
          "INSERT INTO resume_interview_turns (id, workspace_id, task_id, role, content, created_at, stream_request_id) VALUES (?, ?, ?, 'coach', ?, ?, ?)",
        ).run(
          createUuidV7(),
          input.workspaceId,
          input.taskId,
          coachContent,
          new Date().toISOString(),
          input.streamRequestId,
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

export async function readPriorResumeInterviewCandidateContent(
  input: Options & {
    workspaceId: string;
    taskId: string;
    streamRequestId: string;
  },
): Promise<string | undefined> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    if (readActiveResumeWorkspace(db).workspace?.id !== input.workspaceId)
      return undefined;
    const candidate = db
      .prepare(
        "SELECT content FROM resume_interview_candidate_turns WHERE workspace_id = ? AND task_id = ? AND stream_request_id IS NOT ? ORDER BY created_at DESC, id DESC LIMIT 1",
      )
      .get(input.workspaceId, input.taskId, input.streamRequestId) as
      | { content: string }
      | undefined;
    return candidate?.content;
  } finally {
    db.close();
  }
}

export async function respondToResumeClarification(
  input: Options & {
    workspaceId: string;
    taskId: string;
    answer?: string;
    skip?: boolean;
    coachContent?: string;
    streamRequestId?: string;
    signal?: AbortSignal;
  },
): Promise<InterviewView> {
  const terminalStream =
    input.coachContent !== undefined || input.streamRequestId !== undefined;
  const streamRequestId = input.streamRequestId ?? "";
  const coachContent = input.coachContent?.trim();
  if (
    (terminalStream &&
      (!requestUuid(input.streamRequestId) ||
        !coachContent ||
        coachContent.length > 1_800 ||
        /[\u0000\u007f-\u009f]/.test(coachContent))) ||
    input.signal?.aborted
  )
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The local Coach Resume reply is unavailable.",
      "Try the saved clarification question again.",
    );
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  let itemKey = "";
  let result: InterviewView;
  try {
    applyMigrations(db);
    const answer = input.answer;
    if (!input.skip && (!answer || !answer.trim() || answer.length > 2400))
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Enter a concise answer of up to 2,400 characters, or explicitly skip this question.",
        "Add the context you know, or choose I don't know.",
      );
    db.exec("BEGIN IMMEDIATE");
    try {
      if (input.signal?.aborted)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "The local Coach Resume reply is unavailable.",
          "Try the saved clarification question again.",
        );
      if (readActiveResumeWorkspace(db).workspace?.id !== input.workspaceId)
        throw new WorkspaceError(
          "RESUME_WORKSPACE_STALE",
          "That resume workspace changed before your answer could be saved.",
          "Return to the intended resume and answer its current question.",
        );
      const task = db
        .prepare(
          "SELECT status, item_key AS itemKey FROM resume_clarification_tasks WHERE id = ? AND workspace_id = ?",
        )
        .get(input.taskId, input.workspaceId) as
        | { status: Status; itemKey: string }
        | undefined;
      if (!task || task.status !== "pending")
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "That clarification question is no longer awaiting an answer.",
          "Refresh Coach Resume and continue with its current question.",
        );
      if (
        terminalStream &&
        (!db
          .prepare(
            "SELECT 1 FROM resume_interview_stream_reservations WHERE stream_request_id = ? AND workspace_id = ? AND task_id = ? AND status = 'started'",
          )
          .get(streamRequestId, input.workspaceId, input.taskId) ||
          !db
            .prepare(
              "SELECT 1 FROM resume_interview_candidate_turns WHERE stream_request_id = ? AND workspace_id = ? AND task_id = ?",
            )
            .get(streamRequestId, input.workspaceId, input.taskId) ||
          (!input.skip &&
            !db
              .prepare(
                "SELECT 1 FROM resume_interview_candidate_turns WHERE workspace_id = ? AND task_id = ? AND content = ?",
              )
              .get(input.workspaceId, input.taskId, answer?.trim() ?? "")))
      )
        throw new WorkspaceError(
          "RESUME_WORKSPACE_STALE",
          "That resume workspace changed before the Coach reply could be saved.",
          "Return to the intended interview and continue its current question.",
        );
      itemKey = task.itemKey;
      const now = new Date().toISOString();
      const disposition = input.skip ? "skipped" : "answered";
      const responseId = createUuidV7();
      db.prepare(
        "INSERT INTO resume_clarification_task_responses (id, workspace_id, task_id, disposition, answer_text, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        responseId,
        input.workspaceId,
        input.taskId,
        disposition,
        input.skip ? null : (answer ?? ""),
        now,
      );
      db.prepare(
        "UPDATE resume_clarification_tasks SET status = ? WHERE id = ? AND workspace_id = ? AND status = 'pending'",
      ).run(disposition, input.taskId, input.workspaceId);
      if (!input.skip && answer)
        persistClarifiedEvidenceForResponseInDatabase(db, {
          workspaceId: input.workspaceId,
          taskId: input.taskId,
          responseId,
          candidateText: answer,
          now,
        });
      if (terminalStream) {
        const completion = db
          .prepare(
            "UPDATE resume_interview_stream_reservations SET status = 'completed' WHERE stream_request_id = ? AND workspace_id = ? AND task_id = ? AND status = 'started'",
          )
          .run(streamRequestId, input.workspaceId, input.taskId);
        if (completion.changes !== 1)
          throw new WorkspaceError(
            "RESUME_WORKSPACE_STALE",
            "That Coach Resume request is no longer available.",
            "Return to the intended interview and continue its current question.",
          );
        db.prepare(
          "INSERT INTO resume_interview_turns (id, workspace_id, task_id, role, content, created_at, stream_request_id) VALUES (?, ?, ?, 'coach', ?, ?, ?)",
        ).run(
          createUuidV7(),
          input.workspaceId,
          input.taskId,
          coachContent ?? "",
          now,
          streamRequestId,
        );
      }
      reconcileResumeWorkspaceJourneyInDatabase(db, input.workspaceId, now);
      result = view(db, input.workspaceId);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
  try {
    await writeWorkspaceClarificationPacket({
      appDataRoot: input.appDataRoot,
      workspaceRoot: input.workspaceRoot,
      workspaceId: input.workspaceId,
      itemKey,
    });
  } catch {
    await markWorkspaceClarificationPacketRecovery({
      appDataRoot: input.appDataRoot,
      workspaceId: input.workspaceId,
      itemKey,
    });
    throw new WorkspaceError(
      "RESUME_COACH_PACKET_RECOVERY",
      "Your answer was saved, but its readable evidence packet still needs to be synchronized.",
      "Return to Coach Resume and retry the packet sync.",
    );
  }
  return result!;
}
