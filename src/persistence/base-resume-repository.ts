import type { DatabaseSync } from "node:sqlite";

export type StoredBaseResume = {
  id: string;
  primaryFilename: string;
  primaryDigest: string;
  importedAt: string;
  storageLocation: string;
};

export type StoredBaseResumeFile = {
  id: string;
  baseResumeId: string;
  filename: string;
  contentDigest: string;
  byteSize: number;
  storageLocation: string;
};

export function findBaseResumeByDigest(
  database: DatabaseSync,
  digest: string,
): StoredBaseResume | undefined {
  const row = database
    .prepare(
      "SELECT id, primary_filename, primary_digest, imported_at, storage_location FROM base_resumes WHERE primary_digest = ?",
    )
    .get(digest) as Record<string, string> | undefined;
  return (
    row && {
      id: row.id,
      primaryFilename: row.primary_filename,
      primaryDigest: row.primary_digest,
      importedAt: row.imported_at,
      storageLocation: row.storage_location,
    }
  );
}

export function insertBaseResume(
  database: DatabaseSync,
  resume: StoredBaseResume,
  files: StoredBaseResumeFile[],
): void {
  database
    .prepare(
      "INSERT INTO base_resumes (id, primary_filename, primary_digest, imported_at, storage_location) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      resume.id,
      resume.primaryFilename,
      resume.primaryDigest,
      resume.importedAt,
      resume.storageLocation,
    );
  const statement = database.prepare(
    "INSERT INTO base_resume_files (id, base_resume_id, filename, content_digest, byte_size, storage_location) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const file of files)
    statement.run(
      file.id,
      file.baseResumeId,
      file.filename,
      file.contentDigest,
      file.byteSize,
      file.storageLocation,
    );
}

export function listBaseResumes(database: DatabaseSync): StoredBaseResume[] {
  return (
    database
      .prepare(
        "SELECT id, primary_filename, primary_digest, imported_at, storage_location FROM base_resumes ORDER BY imported_at DESC",
      )
      .all() as Record<string, string>[]
  ).map((row) => ({
    id: row.id,
    primaryFilename: row.primary_filename,
    primaryDigest: row.primary_digest,
    importedAt: row.imported_at,
    storageLocation: row.storage_location,
  }));
}
