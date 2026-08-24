import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationDirectory = join(process.cwd(), "src", "persistence", "migrations");

export const migrations = [
  { id: "0001_workspace", sql: readFileSync(join(migrationDirectory, "0001_workspace.sql"), "utf8") },
  { id: "0002_workspace_singleton", sql: readFileSync(join(migrationDirectory, "0002_workspace_singleton.sql"), "utf8") },
  { id: "0003_base_resume", sql: readFileSync(join(migrationDirectory, "0003_base_resume.sql"), "utf8") },
  { id: "0004_evidence", sql: readFileSync(join(migrationDirectory, "0004_evidence.sql"), "utf8") },
  { id: "0005_data_lifecycle", sql: readFileSync(join(migrationDirectory, "0005_data_lifecycle.sql"), "utf8") },
  { id: "0006_evidence_library", sql: readFileSync(join(migrationDirectory, "0006_evidence_library.sql"), "utf8") },
  { id: "0007_evidence_library_windows_paths", sql: readFileSync(join(migrationDirectory, "0007_evidence_library_windows_paths.sql"), "utf8") },
  { id: "0008_current_base_resume", sql: readFileSync(join(migrationDirectory, "0008_current_base_resume.sql"), "utf8") },
  { id: "0009_current_base_resume_integrity", sql: readFileSync(join(migrationDirectory, "0009_current_base_resume_integrity.sql"), "utf8") },
  { id: "0010_evidence_documenter_proposals", sql: readFileSync(join(migrationDirectory, "0010_evidence_documenter_proposals.sql"), "utf8") },
  { id: "0011_job_preferences", sql: readFileSync(join(migrationDirectory, "0011_job_preferences.sql"), "utf8") },
  { id: "0012_source_configurations", sql: readFileSync(join(migrationDirectory, "0012_source_configurations.sql"), "utf8") },
  { id: "0013_filipino_manual_sources", sql: readFileSync(join(migrationDirectory, "0013_filipino_manual_sources.sql"), "utf8") },
  { id: "0014_source_configuration_hardening", sql: readFileSync(join(migrationDirectory, "0014_source_configuration_hardening.sql"), "utf8") },
  { id: "0015_refresh_runs", sql: readFileSync(join(migrationDirectory, "0015_refresh_runs.sql"), "utf8") },
  { id: "0016_job_listings", sql: readFileSync(join(migrationDirectory, "0016_job_listings.sql"), "utf8") },
  { id: "0017_job_listing_hardening", sql: readFileSync(join(migrationDirectory, "0017_job_listing_hardening.sql"), "utf8") },
  { id: "0018_fit_assessments", sql: readFileSync(join(migrationDirectory, "0018_fit_assessments.sql"), "utf8") },
  { id: "0019_captured_opportunities", sql: readFileSync(join(migrationDirectory, "0019_captured_opportunities.sql"), "utf8") },
] as const;
