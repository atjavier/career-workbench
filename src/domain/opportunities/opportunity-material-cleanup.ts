import type { DatabaseSync } from "node:sqlite";
import { lstat, rm } from "node:fs/promises";
import { join } from "node:path";
import { openDatabase } from "@/persistence/database";

/** Delete only drafts whose job revision belongs to this opportunity. Caller owns transaction. */
export function deleteOpportunityRecords(db: DatabaseSync, opportunityId: string) {
  const tables = [
    "captured_opportunities", "captured_opportunity_revisions", "captured_opportunity_duplicate_suggestions",
    "opportunity_decision_revisions", "ai_opportunity_assessment_evidence", "ai_opportunity_assessments",
    "captured_fit_assessment_evidence", "captured_fit_assessments", "material_versions",
    "material_draft_handoffs", "material_claim_support", "material_draft_claims", "material_draft_evidence", "material_drafts",
  ];
  // Schema changes and deletion are transactional; restore the original guards before commit.
  const guards = tables.flatMap(table => db.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? AND name LIKE '%immutable_delete'",
  ).all(table) as Array<{ name: string; sql: string }>);
  for (const guard of guards) db.exec(`DROP TRIGGER "${guard.name}"`);
  const drafts = db.prepare(`SELECT id FROM material_drafts WHERE opportunity_revision_id IN
    (SELECT id FROM captured_opportunity_revisions WHERE opportunity_id = ?)`).all(opportunityId) as Array<{ id: string }>;
  db.prepare("DELETE FROM opportunity_tailored_resumes WHERE opportunity_id = ?").run(opportunityId);
  for (const { id } of drafts) {
    db.prepare("INSERT OR IGNORE INTO opportunity_file_cleanup(relative_path) VALUES (?)").run(`pdf-cache/${id}.pdf`);
    db.prepare("DELETE FROM material_versions WHERE source_draft_id = ?").run(id);
    db.prepare("DELETE FROM resume_workspace_drafts WHERE draft_id = ?").run(id);
    db.prepare("DELETE FROM material_draft_handoffs WHERE draft_id = ?").run(id);
    db.prepare("DELETE FROM material_claim_support WHERE claim_id IN (SELECT id FROM material_draft_claims WHERE draft_id = ?)").run(id);
    db.prepare("DELETE FROM material_draft_claims WHERE draft_id = ?").run(id);
    db.prepare("DELETE FROM material_draft_evidence WHERE draft_id = ?").run(id);
    db.prepare("DELETE FROM material_drafts WHERE id = ?").run(id);
  }
  db.prepare("DELETE FROM opportunity_decision_revisions WHERE opportunity_id = ?").run(opportunityId);
  db.prepare("DELETE FROM ai_opportunity_assessment_evidence WHERE assessment_id IN (SELECT id FROM ai_opportunity_assessments WHERE opportunity_id = ?)").run(opportunityId);
  db.prepare("DELETE FROM ai_opportunity_assessments WHERE opportunity_id = ?").run(opportunityId);
  db.prepare("DELETE FROM captured_fit_assessment_evidence WHERE assessment_id IN (SELECT id FROM captured_fit_assessments WHERE opportunity_id = ?)").run(opportunityId);
  db.prepare("DELETE FROM captured_fit_assessments WHERE opportunity_id = ?").run(opportunityId);
  db.prepare("DELETE FROM captured_opportunity_duplicate_suggestions WHERE opportunity_id = ? OR probable_duplicate_opportunity_id = ?").run(opportunityId, opportunityId);
  db.prepare("DELETE FROM captured_opportunity_revisions WHERE opportunity_id = ?").run(opportunityId);
  db.prepare("DELETE FROM captured_opportunities WHERE id = ?").run(opportunityId);
  for (const guard of guards) db.exec(guard.sql);
}

export async function drainOpportunityFileCleanup(root: string, databasePath: string) {
  const db = openDatabase(databasePath);
  let incomplete = false;
  try {
    const rows = db.prepare("SELECT relative_path FROM opportunity_file_cleanup").all() as Array<{ relative_path: string }>;
    for (const row of rows) {
      if (!/^pdf-cache\/[0-9a-f-]{36}\.pdf$/i.test(row.relative_path)) { incomplete = true; continue; }
      try {
        const parent = await lstat(join(root, "pdf-cache")).catch(error => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
          throw error;
        });
        if (parent?.isSymbolicLink() || (parent && !parent.isDirectory())) { incomplete = true; continue; }
        await rm(join(root, row.relative_path), { force: true });
        db.prepare("DELETE FROM opportunity_file_cleanup WHERE relative_path = ?").run(row.relative_path);
      } catch { incomplete = true; }
    }
  } finally { db.close(); }
  return { cleanupIncomplete: incomplete };
}
