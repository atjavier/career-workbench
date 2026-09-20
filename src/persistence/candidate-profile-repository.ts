import type { DatabaseSync } from "node:sqlite";

export type CandidateProfile = { id: string; createdAt: string };
export type CandidateProfileValues = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  school: string;
  program: string;
  graduationYear: number;
  gwa?: string;
  latinHonors?: string;
  linkedInUrl?: string;
  githubUrl?: string;
};
export type CandidateProfileRevision = {
  id: string;
  profileId: string;
  revisionNumber: number;
  parentRevisionId?: string;
  values: CandidateProfileValues;
  canonicalContent: string;
  contentDigest: string;
  createdAt: string;
};
export type ResumeGenerationState = {
  activeProfileRevisionId?: string;
  designatedTemplateId?: string;
  currentModelConfigurationRevisionId?: string;
  revisionNumber: number;
  updatedAt: string;
};

const revisionColumns =
  "id, profile_id, revision_number, parent_revision_id, first_name, middle_name, last_name, email, phone, school, program, graduation_year, gwa, latin_honors, linkedin_url, github_url, canonical_content, content_digest, created_at";

function optional(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}
function profile(row: Record<string, unknown>): CandidateProfile {
  return { id: String(row.id), createdAt: String(row.created_at) };
}
function revision(row: Record<string, unknown>): CandidateProfileRevision {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    revisionNumber: Number(row.revision_number),
    parentRevisionId: optional(row.parent_revision_id),
    values: {
      firstName: String(row.first_name),
      middleName: optional(row.middle_name),
      lastName: String(row.last_name),
      email: String(row.email),
      phone: String(row.phone),
      school: String(row.school),
      program: String(row.program),
      graduationYear: Number(row.graduation_year),
      gwa: optional(row.gwa),
      latinHonors: optional(row.latin_honors),
      linkedInUrl: optional(row.linkedin_url),
      githubUrl: optional(row.github_url),
    },
    canonicalContent: String(row.canonical_content),
    contentDigest: String(row.content_digest),
    createdAt: String(row.created_at),
  };
}
function state(row: Record<string, unknown>): ResumeGenerationState {
  return {
    activeProfileRevisionId: optional(row.active_profile_revision_id),
    designatedTemplateId: optional(row.designated_template_id),
    currentModelConfigurationRevisionId: optional(
      row.current_model_configuration_revision_id,
    ),
    revisionNumber: Number(row.revision_number),
    updatedAt: String(row.updated_at),
  };
}

export function readResumeGenerationState(
  db: DatabaseSync,
): ResumeGenerationState {
  const row = db
    .prepare(
      "SELECT active_profile_revision_id, designated_template_id, current_model_configuration_revision_id, revision_number, updated_at FROM resume_generation_state WHERE singleton = 1",
    )
    .get() as Record<string, unknown> | undefined;
  if (!row)
    throw new Error("Resume generation state is unavailable after migration.");
  return state(row);
}

export function findCandidateProfile(
  db: DatabaseSync,
  id: string,
): CandidateProfile | undefined {
  const row = db
    .prepare("SELECT id, created_at FROM candidate_profiles WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? profile(row) : undefined;
}

export function latestCandidateProfileRevision(
  db: DatabaseSync,
  profileId: string,
): CandidateProfileRevision | undefined {
  const row = db
    .prepare(
      `SELECT ${revisionColumns} FROM candidate_profile_revisions WHERE profile_id = ? ORDER BY revision_number DESC LIMIT 1`,
    )
    .get(profileId) as Record<string, unknown> | undefined;
  return row ? revision(row) : undefined;
}

export function findCandidateProfileRevision(
  db: DatabaseSync,
  id: string,
): CandidateProfileRevision | undefined {
  const row = db
    .prepare(
      `SELECT ${revisionColumns} FROM candidate_profile_revisions WHERE id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? revision(row) : undefined;
}

export function insertCandidateProfile(
  db: DatabaseSync,
  item: CandidateProfile,
): void {
  db.prepare(
    "INSERT INTO candidate_profiles (id, created_at) VALUES (?, ?)",
  ).run(item.id, item.createdAt);
}

export function insertCandidateProfileRevision(
  db: DatabaseSync,
  item: CandidateProfileRevision,
): void {
  const values = item.values;
  db.prepare(
    `INSERT INTO candidate_profile_revisions (${revisionColumns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    item.id,
    item.profileId,
    item.revisionNumber,
    item.parentRevisionId ?? null,
    values.firstName,
    values.middleName ?? null,
    values.lastName,
    values.email,
    values.phone,
    values.school,
    values.program,
    values.graduationYear,
    values.gwa ?? null,
    values.latinHonors ?? null,
    values.linkedInUrl ?? null,
    values.githubUrl ?? null,
    item.canonicalContent,
    item.contentDigest,
    item.createdAt,
  );
}

export function selectActiveProfileRevision(
  db: DatabaseSync,
  expectedRevisionNumber: number,
  profileRevisionId: string,
  updatedAt: string,
): ResumeGenerationState | undefined {
  const result = db
    .prepare(
      "UPDATE resume_generation_state SET active_profile_revision_id = ?, revision_number = revision_number + 1, updated_at = ? WHERE singleton = 1 AND revision_number = ?",
    )
    .run(profileRevisionId, updatedAt, expectedRevisionNumber);
  if (result.changes !== 1) return undefined;
  return readResumeGenerationState(db);
}
