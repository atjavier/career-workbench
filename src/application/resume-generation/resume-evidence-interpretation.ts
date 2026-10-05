import { createHash } from "node:crypto";
import { requestClarificationPlan, type LocalModelConnection } from "@/adapters/local-model/local-model-gateway";
import { readLocalModelGatewayConfiguration } from "@/domain/resume-generation/local-model-configuration-commands";
import { validateClarificationPlan, type ClarificationQuestion } from "@/domain/resume-generation/clarification-plan";
import { WorkspaceError } from "@/domain/workspace/types";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createUuidV7 } from "@/audit/audit-event";
import { resolveAppDataPaths } from "@/files/app-data";
import { evidenceLibraryRoot } from "@/files/evidence-library";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";
import { reconcileResumeWorkspaceJourney } from "@/domain/resume-generation/resume-workspace-journey";
import { reconcileClarifiedEvidenceConflictsForItemInDatabase } from "@/domain/resume-generation/resume-clarified-evidence";

type Category = "project" | "experience";
type InterpretationKind =
  "direct_fact" | "capability" | "context" | "unknown" | "contradiction";
export type TaskCategory = string;
type Item = {
  key: string;
  name: string;
  category: Category;
  documents: Array<{ path: string; text: string }>;
};
export type CuratedFact = {
  fact: string;
  unknowns: string;
  sourcePath: string;
};

/** Only provenance-backed E blocks are facts. B blocks are research/proposals. */
export function parseCuratedFacts(
  text: string,
  sourcePath: string,
): CuratedFact[] {
  if (!/^# Resume Evidence \(Proposed \/ Unreviewed\)\s*$/m.test(text))
    return [];
  const blocks = [
    ...text.matchAll(
      /^### E-\d{3}\s*$([\s\S]*?)(?=^### E-\d{3}\s*$|(?![\s\S]))/gm,
    ),
  ];
  return blocks.flatMap((block) => {
    const body = block[1];
    const fact = /^- Fact:\s*(.+?)\s*$/m.exec(body)?.[1]?.trim();
    const unknowns = /^- Explicit unknowns:\s*(.+?)\s*$/m
      .exec(body)?.[1]
      ?.trim();
    const status = /^- Status:\s*Proposed\s*\/\s*unreviewed\s*$/im.test(body);
    return fact && unknowns && status ? [{ fact, unknowns, sourcePath }] : [];
  });
}

function isUnhelpfulContext(text: string): boolean {
  const trimmed = text.trim();
  if (/^\*\*[^*]+\*\*:?$/.test(trimmed)) return true;
  return /^(?:not directly evidenced|unknown|none|n\/a)[.]?$/i.test(trimmed);
}

export function extractDocumentedContext(
  documents: Array<{ path: string; text: string }>,
): Array<{ text: string; sourcePath: string }> {
  const results: Array<{ text: string; sourcePath: string }> = [];

  for (const doc of documents) {
    const filename = doc.path.split("/").pop() ?? "";

    // 1. Extract from resume-summary.md
    if (filename === "resume-summary.md") {
      const lines = doc.text.split(/\r?\n/).map((l) => l.trim());
      for (const line of lines) {
        if (
          !line ||
          line.startsWith("#") ||
          line.startsWith("<!--") ||
          /^[-*+]\s+/.test(line)
        )
          continue;
        if (
          /^(?:Material Capabilities|Implementation Scope|Attribution|Explicit Unknowns|Evidence Gaps)/i.test(
            line,
          )
        )
          break;
        const cleaned = line
          .replace(
            /^(?:Project Identity|Problem\/Purpose|Intended User\/Workflow|Design Rationale)\s*:\s*/i,
            "",
          )
          .trim();
        if (cleaned.length >= 20 && !isUnhelpfulContext(cleaned)) {
          results.push({ text: cleaned, sourcePath: doc.path });
        }
      }
    }

    // 2. Extract from project-overview.md or experience-overview.md
    if (
      filename === "project-overview.md" ||
      filename === "experience-overview.md"
    ) {
      const lines = doc.text.split(/\r?\n/).map((l) => l.trim());
      for (const line of lines) {
        if (!line || line.startsWith("#") || line.startsWith("<!--")) continue;
        const clean = line.replace(/^[-*+]\s+/, "").trim();
        if (/^evidence is (?:absent|missing)|no direct evidence/i.test(clean))
          continue;
        if (clean.length >= 20 && !isUnhelpfulContext(clean)) {
          results.push({ text: clean, sourcePath: doc.path });
        }
      }
    }

    // 3. Extract from resume-bullet-candidates.md (Resume Context section)
    if (filename === "resume-bullet-candidates.md") {
      const lines = doc.text.split(/\r?\n/).map((l) => l.trim());
      for (const line of lines) {
        const match = line.match(
          /^(?:Purpose|User or workflow|Design rationale|Directly stated outcome):\s*(.+)$/i,
        );
        if (match && match[1]?.trim()) {
          const val = match[1].trim();
          if (
            !/^(?:not directly evidenced|unknown|none|n\/a)[.]?$/i.test(val) &&
            val.length >= 15
          ) {
            results.push({ text: val, sourcePath: doc.path });
          }
        }
      }
    }
  }

  return results;
}

export async function planClarifications(
  name: string, facts: string, category: Category = "project",
  options: { appDataRoot?: string; request?: typeof requestClarificationPlan; connection?: LocalModelConnection } = {},
): Promise<ClarificationQuestion[]> {
  const configured = options.connection ?? await readLocalModelGatewayConfiguration({ appDataRoot: options.appDataRoot });
  if (!configured) throw new WorkspaceError("LOCAL_MODEL_CONFIGURATION_UNAVAILABLE", "Local AI is not configured for evidence questions.", "Open Settings to configure local AI, then read the evidence again.");
  const connection = "configurationRevisionId" in configured ? configured : { configurationRevisionId: configured.id, configurationDigest: configured.configurationDigest, modelIdentifier: configured.modelIdentifier };
  return validateClarificationPlan(await (options.request ?? requestClarificationPlan)(connection, { name, facts, category }));
}

function normalizedAssertion(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(?:not|no|without|never|none)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Conservative contradiction detection: retain only direct inverse assertions. */
function contradictions(facts: CuratedFact[]): string[] {
  const results = new Set<string>();
  for (const fact of facts) {
    if (!/\b(?:not|no|without|never|none)\b/i.test(fact.fact)) continue;
    const normalized = normalizedAssertion(fact.fact);
    const opposite = facts.find(
      (other) =>
        other !== fact &&
        !/\b(?:not|no|without|never|none)\b/i.test(other.fact) &&
        normalizedAssertion(other.fact) === normalized,
    );
    if (opposite)
      results.add(
        `Potentially conflicting evidence: “${opposite.fact}” / “${fact.fact}”`,
      );
  }
  return [...results];
}

async function loadItems(
  workspaceId: string,
  appDataRoot?: string,
  workspaceRoot?: string,
): Promise<Item[]> {
  const paths = await resolveAppDataPaths(appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const rows = db
      .prepare(
        "SELECT d.library_path, d.category FROM evidence_library_documents d JOIN evidence_library_imports i ON i.id = d.import_id JOIN resume_workspace_imports w ON w.import_id = i.id WHERE w.workspace_id = ? AND d.library_path LIKE '%.md' ORDER BY d.library_path",
      )
      .all(workspaceId) as Array<{ library_path: string; category: Category }>;
    const groups = new Map<string, Item>();
    for (const row of rows) {
      const parts = row.library_path.split("/");
      const name = parts.at(-2);
      if (!name) continue;
      const key = `${row.category}:${name}`;
      const text = await readFile(
        join(evidenceLibraryRoot(workspaceRoot), ...parts.slice(1)),
        "utf8",
      ).catch(() => "");
      if (!text) continue;
      const item = groups.get(key) ?? {
        key,
        name,
        category: row.category,
        documents: [],
      };
      item.documents.push({ path: row.library_path, text });
      groups.set(key, item);
    }
    return [...groups.values()];
  } finally {
    db.close();
  }
}

function insertInterpretation(
  db: ReturnType<typeof openDatabase>,
  workspaceId: string,
  item: Item,
  kind: InterpretationKind,
  content: string,
  source: string,
  now: string,
) {
  db.prepare(
    "INSERT OR IGNORE INTO resume_evidence_interpretations (id, workspace_id, item_key, item_name, item_category, kind, content, evidence_document_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    createUuidV7(),
    workspaceId,
    item.key,
    item.name,
    item.category,
    kind,
    content,
    source,
    now,
  );
}

function reconcilePendingTasks(
  db: ReturnType<typeof openDatabase>,
  workspaceId: string,
  item: Item,
  planned: Array<{ category: TaskCategory; question: string }>,
  now: string,
) {
  const categories = planned.map((task) => task.category);
  let statement = categories.length
    ? `DELETE FROM resume_clarification_tasks WHERE workspace_id = ? AND item_key = ? AND status = 'pending' AND category NOT IN (${categories.map(() => "?").join(", ")})`
    : "DELETE FROM resume_clarification_tasks WHERE workspace_id = ? AND item_key = ? AND status = 'pending'";
  // A plan may replace untouched questions, never an interview already in progress.
  for (const table of ["resume_clarification_task_responses", "resume_interview_turns", "resume_interview_candidate_turns", "resume_interview_stream_reservations"])
    statement += ` AND NOT EXISTS (SELECT 1 FROM ${table} h WHERE h.task_id = resume_clarification_tasks.id)`;
  db.prepare(statement).run(workspaceId, item.key, ...categories);
  for (const task of planned) {
    const existing = db.prepare("SELECT id FROM resume_clarification_tasks WHERE workspace_id = ? AND item_key = ? AND category = ?").get(workspaceId, item.key, task.category) as { id: string } | undefined;
    if (existing && ["resume_clarification_task_responses", "resume_interview_turns", "resume_interview_candidate_turns", "resume_interview_stream_reservations"].some(table => db.prepare(`SELECT 1 FROM ${table} WHERE task_id = ? LIMIT 1`).get(existing.id))) continue;
    insertInterpretation(
      db,
      workspaceId,
      item,
      "unknown",
      task.question,
      item.documents[0]!.path,
      now,
    );
    db.prepare(
      "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, item_key, category) DO UPDATE SET question = excluded.question, item_category = excluded.item_category, item_name = excluded.item_name WHERE status = 'pending'",
    ).run(
      createUuidV7(),
      workspaceId,
      item.key,
      item.name,
      item.category,
      task.category,
      task.question,
      now,
    );
  }
}

export async function interpretWorkspaceEvidence(
  expectedWorkspaceId: string,
  options: { appDataRoot?: string; workspaceRoot?: string; planner?: typeof planClarifications } = {},
): Promise<boolean> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    if (readActiveResumeWorkspace(db).workspace?.id !== expectedWorkspaceId)
      return false;
    const items = await loadItems(
      expectedWorkspaceId,
      options.appDataRoot,
      options.workspaceRoot,
    );
    // Network calls run before any write transaction. Include answered/skipped
    // context and reject results if source material or interview state changes.
    const history = () => ({
      tasks: db.prepare("SELECT t.id, t.item_key, t.category, t.question, t.status, r.answer_text FROM resume_clarification_tasks t LEFT JOIN resume_clarification_task_responses r ON r.task_id = t.id WHERE t.workspace_id = ? ORDER BY t.id").all(expectedWorkspaceId),
      turns: db.prepare("SELECT * FROM resume_interview_turns WHERE workspace_id = ? ORDER BY id").all(expectedWorkspaceId),
      candidateTurns: db.prepare("SELECT * FROM resume_interview_candidate_turns WHERE workspace_id = ? ORDER BY id").all(expectedWorkspaceId),
      reservations: db.prepare("SELECT * FROM resume_interview_stream_reservations WHERE workspace_id = ? ORDER BY stream_request_id").all(expectedWorkspaceId),
    });
    const beforeHistory = history();
    const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const sourceFingerprint = fingerprint(items);
    const plans = new Map<string, ClarificationQuestion[]>();
    for (const item of items) {
      const facts = item.documents.flatMap(document => parseCuratedFacts(document.text, document.path));
      const context = extractDocumentedContext(item.documents);
      const itemTasks = beforeHistory.tasks.filter(row => row.item_key === item.key);
      const factsText = JSON.stringify({ documentedFacts: facts.map(({ fact }) => fact), explicitUnknowns: facts.map(({ unknowns }) => unknowns), documentedContext: context.map(({ text }) => text), candidateHistory: itemTasks, candidateTurns: beforeHistory.candidateTurns.filter(row => itemTasks.some(task => task.id === row.task_id)) });
      plans.set(item.key, await (options.planner ?? planClarifications)(item.name, factsText, item.category, { appDataRoot: options.appDataRoot }));
    }
    if (sourceFingerprint !== fingerprint(await loadItems(expectedWorkspaceId, options.appDataRoot, options.workspaceRoot))) return false;
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      if (readActiveResumeWorkspace(db).workspace?.id !== expectedWorkspaceId || fingerprint(beforeHistory) !== fingerprint(history())) {
        db.exec("ROLLBACK");
        return false;
      }
      for (const item of items) {
        const facts = item.documents.flatMap((document) =>
          parseCuratedFacts(document.text, document.path),
        );
        const source =
          item.documents.find((d) => d.path.endsWith("/resume-evidence.md"))
            ?.path ?? item.documents[0]!.path;
        for (const fact of facts) {
          insertInterpretation(
            db,
            expectedWorkspaceId,
            item,
            "direct_fact",
            fact.fact,
            fact.sourcePath,
            now,
          );
          insertInterpretation(
            db,
            expectedWorkspaceId,
            item,
            "unknown",
            fact.unknowns,
            fact.sourcePath,
            now,
          );
        }
        reconcileClarifiedEvidenceConflictsForItemInDatabase(db, {
          workspaceId: expectedWorkspaceId,
          itemKey: item.key,
          now,
        });
        insertInterpretation(
          db,
          expectedWorkspaceId,
          item,
          "capability",
          item.category === "project"
            ? "Demonstrates project-based technical problem solving."
            : "Demonstrates documented professional experience.",
          source,
          now,
        );
        for (const fact of facts
          .filter(({ fact }) =>
            /\b(problem|purpose|workflow|user|intended)\b/i.test(fact),
          )
          .map(({ fact }) => fact))
          insertInterpretation(
            db,
            expectedWorkspaceId,
            item,
            "context",
            fact,
            source,
            now,
          );
        const documentedContext = extractDocumentedContext(item.documents);
        for (const ctx of documentedContext) {
          insertInterpretation(
            db,
            expectedWorkspaceId,
            item,
            "context",
            ctx.text,
            ctx.sourcePath,
            now,
          );
        }
        for (const conflict of contradictions(facts))
          insertInterpretation(
            db,
            expectedWorkspaceId,
            item,
            "contradiction",
            conflict,
            source,
            now,
          );
        reconcilePendingTasks(db, expectedWorkspaceId, item, plans.get(item.key)!, now);
      }
      db.exec("COMMIT");
      await reconcileResumeWorkspaceJourney(expectedWorkspaceId, options);
      return true;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}
