import { createUuidV7 } from "@/audit/audit-event";
import { openDatabase } from "@/persistence/database";

export type ClarifiedEvidence = {
  id: string;
  taskId: string;
  responseId: string;
  itemName: string;
  itemCategory: "project" | "experience";
  category: string;
  candidateText: string;
  provenance: "candidate_interview_answer";
  createdAt: string;
  needsReview: boolean;
};

function inverseAssertion(value: string): {
  normalized: string;
  negative: boolean;
} {
  const expanded = value.toLowerCase().replace(/n't\b/g, " not");
  const negative = /\b(?:not|no|without|never|none)\b/i.test(expanded);
  return {
    negative,
    normalized: expanded
      .replace(/\b(?:not|no|without|never|none)\b/g, "")
      .replace(/\b(?:the|this) project\b|\bit\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/** Records only an exact inverse assertion; different details are not presumed contradictory. */
function directlyConflicts(
  candidateText: string,
  documentedFact: string,
): boolean {
  const candidate = inverseAssertion(candidateText);
  const documented = inverseAssertion(documentedFact);
  return Boolean(
    candidate.normalized &&
    candidate.normalized === documented.normalized &&
    candidate.negative !== documented.negative,
  );
}

export function persistClarifiedEvidenceForResponseInDatabase(
  db: ReturnType<typeof openDatabase>,
  input: {
    workspaceId: string;
    taskId: string;
    responseId: string;
    candidateText: string;
    now: string;
  },
): void {
  const task = db
    .prepare(
      "SELECT item_key AS itemKey, item_name AS itemName, item_category AS itemCategory, category FROM resume_clarification_tasks WHERE id = ? AND workspace_id = ?",
    )
    .get(input.taskId, input.workspaceId) as
    | {
        itemKey: string;
        itemName: string;
        itemCategory: "project" | "experience";
        category: string;
      }
    | undefined;
  if (!task)
    throw new Error(
      "Clarification task ownership changed before evidence could be preserved.",
    );
  const id = createUuidV7();
  db.prepare(
    "INSERT INTO resume_clarified_evidence (id, workspace_id, task_id, response_id, item_key, item_name, item_category, category, candidate_text, provenance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate_interview_answer', ?)",
  ).run(
    id,
    input.workspaceId,
    input.taskId,
    input.responseId,
    task.itemKey,
    task.itemName,
    task.itemCategory,
    task.category,
    input.candidateText,
    input.now,
  );
  reconcileClarifiedEvidenceConflictsForItemInDatabase(db, {
    workspaceId: input.workspaceId,
    itemKey: task.itemKey,
    now: input.now,
  });
}

/** Rechecks both ordering directions: evidence intake may finish after a Coach answer. */
export function reconcileClarifiedEvidenceConflictsForItemInDatabase(
  db: ReturnType<typeof openDatabase>,
  input: { workspaceId: string; itemKey: string; now: string },
): void {
  const clarified = db
    .prepare(
      "SELECT id, candidate_text AS candidateText FROM resume_clarified_evidence WHERE workspace_id = ? AND item_key = ?",
    )
    .all(input.workspaceId, input.itemKey) as Array<{
    id: string;
    candidateText: string;
  }>;
  const documented = db
    .prepare(
      "SELECT id, content FROM resume_evidence_interpretations WHERE workspace_id = ? AND item_key = ? AND kind = 'direct_fact'",
    )
    .all(input.workspaceId, input.itemKey) as Array<{
    id: string;
    content: string;
  }>;
  for (const clarification of clarified)
    for (const fact of documented)
      if (directlyConflicts(clarification.candidateText, fact.content))
        db.prepare(
          "INSERT OR IGNORE INTO resume_clarified_evidence_conflicts (id, workspace_id, clarified_evidence_id, documented_interpretation_id, created_at) VALUES (?, ?, ?, ?, ?)",
        ).run(
          createUuidV7(),
          input.workspaceId,
          clarification.id,
          fact.id,
          input.now,
        );
}

export function listClarifiedEvidenceInDatabase(
  db: ReturnType<typeof openDatabase>,
  workspaceId: string,
): ClarifiedEvidence[] {
  return db
    .prepare(
      "SELECT e.id, e.task_id AS taskId, e.response_id AS responseId, e.item_name AS itemName, e.item_category AS itemCategory, e.category, e.candidate_text AS candidateText, e.provenance, e.created_at AS createdAt, EXISTS(SELECT 1 FROM resume_clarified_evidence_conflicts c WHERE c.clarified_evidence_id = e.id AND c.workspace_id = e.workspace_id AND c.status = 'needs_review') AS needsReview FROM resume_clarified_evidence e WHERE e.workspace_id = ? ORDER BY e.created_at, e.id",
    )
    .all(workspaceId)
    .map((row) => ({
      ...row,
      needsReview: Boolean(row.needsReview),
    })) as ClarifiedEvidence[];
}
