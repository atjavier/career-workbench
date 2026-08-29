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
type InterpretationKind = "direct_fact" | "capability" | "context" | "unknown" | "contradiction";
type TaskCategory = "purpose" | "ownership" | "users_workflow" | "outcome" | "metrics" | "deployment" | "collaboration" | "dates" | "role";
type Item = { key: string; name: string; category: Category; documents: Array<{ path: string; text: string }> };
export type CuratedFact = { fact: string; unknowns: string; sourcePath: string };

const taskQuestions: Record<TaskCategory, (name: string) => string> = {
  purpose: (name) => `What problem or need was ${name} intended to address?`,
  ownership: (name) => `What parts of ${name} did you personally build, design, or contribute?`,
  users_workflow: (name) => `Who was ${name} for, and what workflow did it support?`,
  outcome: (name) => `What capability or change did ${name} deliver?`,
  metrics: (name) => `Are there any measured results, scale details, or evaluation results for ${name}?`,
  deployment: (name) => `What was the deployment or usage status of ${name}?`,
  collaboration: (name) => `Did you work with anyone on ${name}, and what was your role?`,
  dates: (name) => `When did you work on ${name}?`,
  role: (name) => `What was your role or context for ${name}?`,
};

/** Only provenance-backed E blocks are facts. B blocks are research/proposals. */
export function parseCuratedFacts(text: string, sourcePath: string): CuratedFact[] {
  if (!/^# Resume Evidence \(Proposed \/ Unreviewed\)\s*$/m.test(text)) return [];
  const blocks = [...text.matchAll(/^### E-\d{3}\s*$([\s\S]*?)(?=^### E-\d{3}\s*$|(?![\s\S]))/gm)];
  return blocks.flatMap((block) => {
    const body = block[1];
    const fact = /^- Fact:\s*(.+?)\s*$/m.exec(body)?.[1]?.trim();
    const unknowns = /^- Explicit unknowns:\s*(.+?)\s*$/m.exec(body)?.[1]?.trim();
    const status = /^- Status:\s*Proposed\s*\/\s*unreviewed\s*$/mi.test(body);
    return fact && unknowns && status ? [{ fact, unknowns, sourcePath }] : [];
  });
}

const has = (facts: string, pattern: RegExp) => pattern.test(facts);

/** Facts are the only input. Unknown statements and E/B identifiers are not evidence. */
export function planClarifications(name: string, facts: string): Array<{ category: TaskCategory; question: string }> {
  const planned: TaskCategory[] = [];
  if (!has(facts, /\b(purpose|problem|intended to|designed to address|address|objective)\b/i)) planned.push("purpose");
  if (!has(facts, /\b(i |my role|personally|responsible for|contributed to)\b/i)) planned.push("ownership");
  if (!has(facts, /\b(user|users|researcher|student|client|workflow|used by)\b/i)) planned.push("users_workflow");
  if (!has(facts, /\b(enabled|delivered|result|outcome|evaluation|improved|streamlined)\b/i)) planned.push("outcome");
  if (!has(facts, /\b\d+\b|percent|respondents|score|ms|seconds|users\b/i)) planned.push("metrics");
  if (!has(facts, /\b(deployed|deployment|production|staging|released|demo(?: mode)?|used by)\b/i)) planned.push("deployment");
  if (!has(facts, /\b(team|collaborat|adviser|advisor|group)\b/i)) planned.push("collaboration");
  if (!has(facts, /\b20\d{2}\b|semester|ay\s*20/i)) planned.push("dates");
  if (!has(facts, /\b(role|developer|researcher|student|intern|contributor)\b/i)) planned.push("role");
  return planned.map((category) => ({ category, question: taskQuestions[category](name) }));
}

function normalizedAssertion(value: string): string {
  return value.toLowerCase().replace(/\b(?:not|no|without|never|none)\b/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Conservative contradiction detection: retain only direct inverse assertions. */
function contradictions(facts: CuratedFact[]): string[] {
  const results = new Set<string>();
  for (const fact of facts) {
    if (!/\b(?:not|no|without|never|none)\b/i.test(fact.fact)) continue;
    const normalized = normalizedAssertion(fact.fact);
    const opposite = facts.find((other) => other !== fact && !/\b(?:not|no|without|never|none)\b/i.test(other.fact) && normalizedAssertion(other.fact) === normalized);
    if (opposite) results.add(`Potentially conflicting evidence: “${opposite.fact}” / “${fact.fact}”`);
  }
  return [...results];
}

async function loadItems(workspaceId: string, appDataRoot?: string, workspaceRoot?: string): Promise<Item[]> {
  const paths = await resolveAppDataPaths(appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const rows = db.prepare("SELECT d.library_path, d.category FROM evidence_library_documents d JOIN evidence_library_imports i ON i.id = d.import_id JOIN resume_workspace_imports w ON w.import_id = i.id WHERE w.workspace_id = ? AND d.library_path LIKE '%/resume-evidence.md' ORDER BY d.library_path").all(workspaceId) as Array<{ library_path: string; category: Category }>;
    const groups = new Map<string, Item>();
    for (const row of rows) {
      const parts = row.library_path.split("/");
      const name = parts.at(-2);
      if (!name) continue;
      const key = `${row.category}:${name}`;
      const text = await readFile(join(evidenceLibraryRoot(workspaceRoot), ...parts.slice(1)), "utf8").catch(() => "");
      if (!text) continue;
      const item = groups.get(key) ?? { key, name, category: row.category, documents: [] };
      item.documents.push({ path: row.library_path, text });
      groups.set(key, item);
    }
    return [...groups.values()];
  } finally {
    db.close();
  }
}

function insertInterpretation(db: ReturnType<typeof openDatabase>, workspaceId: string, item: Item, kind: InterpretationKind, content: string, source: string, now: string) {
  db.prepare("INSERT OR IGNORE INTO resume_evidence_interpretations (id, workspace_id, item_key, item_name, item_category, kind, content, evidence_document_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(createUuidV7(), workspaceId, item.key, item.name, item.category, kind, content, source, now);
}

function reconcilePendingTasks(db: ReturnType<typeof openDatabase>, workspaceId: string, item: Item, planned: Array<{ category: TaskCategory; question: string }>, now: string) {
  const categories = planned.map((task) => task.category);
  const statement = categories.length
    ? `DELETE FROM resume_clarification_tasks WHERE workspace_id = ? AND item_key = ? AND status = 'pending' AND category NOT IN (${categories.map(() => "?").join(", ")})`
    : "DELETE FROM resume_clarification_tasks WHERE workspace_id = ? AND item_key = ? AND status = 'pending'";
  db.prepare(statement).run(workspaceId, item.key, ...categories);
  for (const task of planned) {
    insertInterpretation(db, workspaceId, item, "unknown", task.question, item.documents[0]!.path, now);
    db.prepare("INSERT OR IGNORE INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(createUuidV7(), workspaceId, item.key, item.name, item.category, task.category, task.question, now);
  }
}

export async function interpretWorkspaceEvidence(expectedWorkspaceId: string, options: { appDataRoot?: string; workspaceRoot?: string } = {}): Promise<boolean> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    if (readActiveResumeWorkspace(db).workspace?.id !== expectedWorkspaceId) return false;
    const items = await loadItems(expectedWorkspaceId, options.appDataRoot, options.workspaceRoot);
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      if (readActiveResumeWorkspace(db).workspace?.id !== expectedWorkspaceId) {
        db.exec("ROLLBACK");
        return false;
      }
      for (const item of items) {
        const facts = item.documents.flatMap((document) => parseCuratedFacts(document.text, document.path));
        const source = item.documents[0]!.path;
        for (const fact of facts) {
          insertInterpretation(db, expectedWorkspaceId, item, "direct_fact", fact.fact, fact.sourcePath, now);
          insertInterpretation(db, expectedWorkspaceId, item, "unknown", fact.unknowns, fact.sourcePath, now);
        }
        reconcileClarifiedEvidenceConflictsForItemInDatabase(db, { workspaceId: expectedWorkspaceId, itemKey: item.key, now });
        insertInterpretation(db, expectedWorkspaceId, item, "capability", item.category === "project" ? "Demonstrates project-based technical problem solving." : "Demonstrates documented professional experience.", source, now);
        for (const fact of facts.filter(({ fact }) => /\b(problem|purpose|workflow|user|intended)\b/i.test(fact)).map(({ fact }) => fact)) insertInterpretation(db, expectedWorkspaceId, item, "context", fact, source, now);
        for (const conflict of contradictions(facts)) insertInterpretation(db, expectedWorkspaceId, item, "contradiction", conflict, source, now);
        reconcilePendingTasks(db, expectedWorkspaceId, item, planClarifications(item.name, facts.map(({ fact }) => fact).join("\n")), now);
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
