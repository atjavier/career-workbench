import { access } from "node:fs/promises";
import { join } from "node:path";
import { privateAppDataRoot } from "@/files/app-data";
import { openDatabase } from "@/persistence/database";
import {
  listCurrentEvidence,
  type EvidenceRevision,
} from "@/persistence/evidence-repository";
import { WorkspaceError } from "@/domain/workspace/types";

export type StoredEvidenceState =
  | { evidence: EvidenceRevision[]; error?: undefined }
  | { evidence: EvidenceRevision[]; error: WorkspaceError };
export async function listStoredEvidence(): Promise<StoredEvidenceState> {
  const path = join(privateAppDataRoot(), "workspace.sqlite");
  try {
    await access(path);
    const database = openDatabase(path);
    try {
      return { evidence: listCurrentEvidence(database) };
    } finally {
      database.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { evidence: [] };
    return {
      evidence: [],
      error: new WorkspaceError(
        "EVIDENCE_INVALID",
        "Stored evidence cannot be loaded right now.",
        "Check local workspace storage access, then refresh the page.",
      ),
    };
  }
}
