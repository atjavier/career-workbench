import { createHash } from "node:crypto";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { findCandidateProfile, findCandidateProfileRevision, insertCandidateProfile, insertCandidateProfileRevision, latestCandidateProfileRevision, readResumeGenerationState, selectActiveProfileRevision, type CandidateProfile, type CandidateProfileRevision, type CandidateProfileValues, type ResumeGenerationState } from "@/persistence/candidate-profile-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { attachProfileToWorkspace, readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";
import { reconcileResumeWorkspaceJourney } from "@/domain/resume-generation/resume-workspace-journey";

type Options = { appDataRoot?: string };
export type CandidateProfileInput = { firstName: string; middleName?: string; lastName: string; email: string; phone: string; school: string; program: string; graduationYear: string | number; gwa?: string; latinHonors?: string; linkedInUrl?: string; githubUrl?: string };
export type SaveCandidateProfileInput = Options & { profileId?: string; expectedStateRevisionNumber?: number; values: CandidateProfileInput };
export type CandidateProfileState = { state: ResumeGenerationState; profile?: CandidateProfile; revision?: CandidateProfileRevision };

function transaction<T>(root: string, work: (db: ReturnType<typeof openDatabase>) => T): T {
  const db = openDatabase(`${root}/workspace.sqlite`);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE;");
    try { const result = work(db); db.exec("COMMIT;"); return result; } catch (error) { db.exec("ROLLBACK;"); throw error; }
  } finally { db.close(); }
}

function digest(value: string): string { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function plainText(value: string | undefined, field: string, required: boolean, maximum: number): string | undefined {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    if (required) throw new WorkspaceError("CANDIDATE_PROFILE_INVALID", `${field} is required.`, `Enter your ${field.toLowerCase()} and try again.`);
    return undefined;
  }
  if (normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) throw new WorkspaceError("CANDIDATE_PROFILE_INVALID", `${field} is unavailable.`, `Use plain text for your ${field.toLowerCase()} and try again.`);
  return normalized;
}
function optionalUrl(value: string | undefined, field: string): string | undefined {
  const normalized = plainText(value, field, false, 2048);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" || !url.hostname) throw new Error("invalid");
    return url.toString();
  } catch {
    throw new WorkspaceError("CANDIDATE_PROFILE_INVALID", `${field} must be a valid HTTPS URL.`, `Enter a complete HTTPS ${field.toLowerCase()} or leave it blank.`);
  }
}
function normalize(values: CandidateProfileInput): CandidateProfileValues {
  const email = plainText(values.email, "Email", true, 254)! .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkspaceError("CANDIDATE_PROFILE_INVALID", "Email must be valid.", "Enter an email address such as name@example.com.");
  const phone = plainText(values.phone, "Phone number", true, 40)!;
  if (!/^[+()\-\s\d]{7,40}$/.test(phone) || (phone.match(/\d/g) ?? []).length < 7) throw new WorkspaceError("CANDIDATE_PROFILE_INVALID", "Phone number must be valid.", "Enter a phone number with at least seven digits.");
  const yearValue = String(values.graduationYear ?? "").trim();
  if (!/^\d{4}$/.test(yearValue) || Number(yearValue) < 1900 || Number(yearValue) > new Date().getUTCFullYear() + 20) throw new WorkspaceError("CANDIDATE_PROFILE_INVALID", "Graduation year must be valid.", "Enter a four-digit expected or graduation year.");
  const gwa = plainText(values.gwa, "GWA", false, 20);
  if (gwa && !/^[0-5](?:\.\d{1,3})?$/.test(gwa)) throw new WorkspaceError("CANDIDATE_PROFILE_INVALID", "GWA must be a valid number.", "Enter a GWA from 0 to 5, or leave it blank.");
  return { firstName: plainText(values.firstName, "First name", true, 120)!, middleName: plainText(values.middleName, "Middle name", false, 120), lastName: plainText(values.lastName, "Last name", true, 120)!, email, phone, school: plainText(values.school, "School", true, 240)!, program: plainText(values.program, "Program", true, 240)!, graduationYear: Number(yearValue), gwa, latinHonors: plainText(values.latinHonors, "Latin honors", false, 120), linkedInUrl: optionalUrl(values.linkedInUrl, "LinkedIn URL"), githubUrl: optionalUrl(values.githubUrl, "GitHub URL") };
}
function canonicalContent(values: CandidateProfileValues): string { return JSON.stringify({ firstName: values.firstName, middleName: values.middleName ?? null, lastName: values.lastName, email: values.email, phone: values.phone, school: values.school, program: values.program, graduationYear: values.graduationYear, gwa: values.gwa ?? null, latinHonors: values.latinHonors ?? null, linkedInUrl: values.linkedInUrl ?? null, githubUrl: values.githubUrl ?? null }); }

export async function saveCandidateProfile(input: SaveCandidateProfileInput): Promise<{ profile: CandidateProfile; revision: CandidateProfileRevision; stateRevisionNumber: number }> {
  const values = normalize(input.values);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  let savedWorkspaceId: string | undefined;
  const saved = transaction(paths.root, (db) => {
    const workspaceState = readActiveResumeWorkspace(db); const workspace = workspaceState.workspace;
    if (!workspace) throw new WorkspaceError("RESUME_WORKSPACE_NOT_FOUND", "Create a resume workspace before saving profile details.", "Name your first resume workspace to begin.");
    savedWorkspaceId = workspace.id;
    const expectedStateRevisionNumber = input.expectedStateRevisionNumber ?? (workspace.activeProfileRevisionId ? Number.NaN : workspaceState.revisionNumber);
    if (!Number.isSafeInteger(expectedStateRevisionNumber) || expectedStateRevisionNumber !== workspaceState.revisionNumber) throw new WorkspaceError("CANDIDATE_PROFILE_STALE", "Your profile changed before it could be saved.", "Refresh your profile details and try again.");
    const activeRevision = workspace.activeProfileRevisionId ? findCandidateProfileRevision(db, workspace.activeProfileRevisionId) : undefined;
    if (workspace.activeProfileRevisionId && (!activeRevision || input.profileId !== activeRevision.profileId)) throw new WorkspaceError("CANDIDATE_PROFILE_STALE", "Your profile changed before it could be saved.", "Refresh your profile details and try again.");
    if (!workspace.activeProfileRevisionId && input.profileId) throw new WorkspaceError("CANDIDATE_PROFILE_STALE", "Your profile changed before it could be saved.", "Refresh your profile details and try again.");
    const now = new Date().toISOString();
    const profile = activeRevision ? findCandidateProfile(db, activeRevision.profileId) : { id: createUuidV7(), createdAt: now };
    if (!profile) throw new WorkspaceError("CANDIDATE_PROFILE_NOT_FOUND", "That candidate profile is unavailable.", "Refresh your profile details and try again.");
    const previous = activeRevision ? latestCandidateProfileRevision(db, activeRevision.profileId) : undefined;
    if (!activeRevision) insertCandidateProfile(db, profile);
    const canonical = canonicalContent(values);
    const revision: CandidateProfileRevision = { id: createUuidV7(), profileId: profile.id, revisionNumber: (previous?.revisionNumber ?? 0) + 1, parentRevisionId: previous?.id, values, canonicalContent: canonical, contentDigest: digest(canonical), createdAt: now };
    insertCandidateProfileRevision(db, revision);
    if (!attachProfileToWorkspace(db, workspace.id, profile.id, revision.id, now)) throw new WorkspaceError("CANDIDATE_PROFILE_STALE", "Your profile changed before it could be saved.", "Refresh your profile details and try again.");
    appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "resume.profile_saved", outcome: "success", entityId: revision.id, contentHash: revision.contentDigest }));
    return { profile, revision, stateRevisionNumber: workspaceState.revisionNumber + 1 };
  });
  if (savedWorkspaceId) await reconcileResumeWorkspaceJourney(savedWorkspaceId, input);
  return saved;
}

export async function readCandidateProfileState(input: Options = {}): Promise<CandidateProfileState> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  return transaction(paths.root, (db) => {
    const state = readResumeGenerationState(db); const workspaceState = readActiveResumeWorkspace(db);
    if (!workspaceState.workspace?.activeProfileRevisionId) return { state: { ...state, revisionNumber: workspaceState.revisionNumber, activeProfileRevisionId: undefined } };
    const revision = findCandidateProfileRevision(db, workspaceState.workspace.activeProfileRevisionId);
    if (!revision) return { state };
    return { state, profile: findCandidateProfile(db, revision.profileId), revision };
  });
}
