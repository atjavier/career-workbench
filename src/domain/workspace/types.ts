export type SafeWorkspaceErrorCode =
  | "APP_DATA_PATH_INVALID"
  | "WORKSPACE_INITIALIZATION_FAILED"
  | "AUDIT_PAYLOAD_FORBIDDEN"
  | "BASE_RESUME_PRIMARY_REQUIRED"
  | "BASE_RESUME_DUPLICATE"
  | "BASE_RESUME_INVALID"
  | "BASE_RESUME_IMPORT_FAILED"
  | "CURRENT_BASE_RESUME_INVALID"
  | "CURRENT_BASE_RESUME_DUPLICATE"
  | "CURRENT_BASE_RESUME_NOT_FOUND"
  | "CURRENT_BASE_RESUME_STALE"
  | "CURRENT_BASE_RESUME_UNRESOLVED"
  | "CURRENT_BASE_RESUME_HISTORY_ONLY"
  | "CANDIDATE_PROFILE_INVALID"
  | "CANDIDATE_PROFILE_NOT_FOUND"
  | "CANDIDATE_PROFILE_STALE"
  | "RESUME_WORKSPACE_INVALID"
  | "RESUME_WORKSPACE_NOT_FOUND"
  | "RESUME_WORKSPACE_STALE"
  | "RESUME_WORKSPACE_DELETE_CONFIRMATION"
  | "RESUME_TEMPLATE_UNAVAILABLE"
  | "RESUME_TEMPLATE_INVALID"
  | "RESUME_TEMPLATE_STALE"
  | "LOCAL_MODEL_CONFIGURATION_INVALID"
  | "LOCAL_MODEL_CONFIGURATION_UNAVAILABLE"
  | "LOCAL_MODEL_CONFIGURATION_STALE"
  | "EVIDENCE_INVALID"
  | "EVIDENCE_NOT_FOUND"
  | "EVIDENCE_STALE"
  | "EVIDENCE_BASE_RESUME_REQUIRED"
  | "EVIDENCE_LIBRARY_INVALID"
  | "EVIDENCE_LIBRARY_DUPLICATE"
  | "EVIDENCE_LIBRARY_EMPTY"
  | "EVIDENCE_DOCUMENTER_INVALID"
  | "EVIDENCE_DOCUMENTER_NOT_FOUND"
  | "EVIDENCE_DOCUMENTER_STALE"
  | "JOB_PREFERENCES_INVALID"
  | "JOB_PREFERENCES_STALE"
  | "JOB_PREFERENCES_UNAVAILABLE"
  | "SOURCE_CONFIGURATION_INVALID"
  | "SOURCE_CONFIGURATION_STALE"
  | "SOURCE_CONFIGURATION_UNAVAILABLE"
  | "SOURCE_CONFIGURATION_POLICY_UNRESOLVED"
  | "REFRESH_INVALID"
  | "REFRESH_UNAVAILABLE"
  | "REFRESH_POLICY_UNRESOLVED"
  | "JOB_LISTING_INVALID"
  | "JOB_LISTING_STALE"
  | "JOB_LISTING_NOT_FOUND"
  | "JOB_LISTING_CONFIRMATION_REQUIRED"
  | "OPPORTUNITY_CAPTURE_INVALID"
  | "OPPORTUNITY_TITLE_INVALID"
  | "OPPORTUNITY_COMPANY_INVALID"
  | "OPPORTUNITY_LOCATION_INVALID"
  | "OPPORTUNITY_WORK_STYLE_INVALID"
  | "OPPORTUNITY_REQUIREMENTS_INVALID"
  | "OPPORTUNITY_POSTED_DATE_INVALID"
  | "OPPORTUNITY_STORED_INVALID"
  | "FIT_ASSESSMENT_INPUT_MISSING"
  | "OPPORTUNITY_ASSESSMENT_INVALID"
  | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE"
  | "OPPORTUNITY_ASSESSMENT_STALE"
  | "RESUME_COACH_INVALID"
  | "RESUME_COACH_UNAVAILABLE"
  | "RESUME_COACH_PACKET_RECOVERY"
  | "MATERIAL_DRAFT_INVALID"
  | "MATERIAL_DRAFT_HANDOFF_DUPLICATE"
  | "DATA_STORAGE_UNAVAILABLE"
  | "DATA_ARTIFACT_NOT_FOUND"
  | "DATA_ARTIFACT_STALE"
  | "DATA_ARTIFACT_EXPIRED"
  | "DATA_CONFIRMATION_REQUIRED"
  | "DATA_ARTIFACT_INVALID";

export class WorkspaceError extends Error {
  readonly code: SafeWorkspaceErrorCode;
  readonly summary: string;
  readonly safeNextAction: string;
  readonly affectedEntityIds: string[];

  constructor(
    code: SafeWorkspaceErrorCode,
    summary: string,
    safeNextAction: string,
    affectedEntityIds: string[] = [],
  ) {
    super(summary);
    this.code = code;
    this.summary = summary;
    this.safeNextAction = safeNextAction;
    this.affectedEntityIds = affectedEntityIds;
  }
}

export type SafeWorkspaceError = Pick<
  WorkspaceError,
  "code" | "summary" | "safeNextAction" | "affectedEntityIds"
>;

export function toSafeWorkspaceError(error: unknown): SafeWorkspaceError {
  if (error instanceof WorkspaceError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/readonly database|SQLITE_READONLY|EACCES|EPERM|permission denied/i.test(message)) {
    return new WorkspaceError(
      "DATA_STORAGE_UNAVAILABLE",
      "The private workspace is currently read-only, so this change was not saved.",
      "Close any other copy of the app, then verify your user account can modify its PersonalJobDiscovery app-data folder and try again.",
    );
  }
  return new WorkspaceError(
    "WORKSPACE_INITIALIZATION_FAILED",
    "The private workspace could not be initialized.",
    "Check your user account's local app-data access, then try initialization again.",
  );
}
