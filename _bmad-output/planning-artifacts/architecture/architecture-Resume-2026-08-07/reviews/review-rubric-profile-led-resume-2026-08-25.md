# Rubric Review — Profile-led Resume Architecture

**Scope:** `ARCHITECTURE-SPINE.md` (2026-08-25 update)
**Lens:** good-spine rubric — divergence rules, brownfield compatibility, and operational envelope
**Mechanical check:** `lint_spine.py` passed with zero findings.

## Verdict

**Needs targeted revision.** The spine now fixes the primary profile/template/Coach ownership boundaries well, but three implementation-level seams remain under-specified or conflict with the existing migration runner.

## Findings

### High — Migration atomicity conflicts with the brownfield runner

**Finding:** The new contract calls `0021_resume_profile_materials` a transactional migration, but the current `node:sqlite` runner executes migration SQL and records `schema_migrations` as separate operations without a transaction. A failure between them can leave partial schema/data state while the history is unrecorded.

**Action:** Amend the migration rule to require an explicit transaction in the migration runner covering both migration SQL and its history row (with rollback/error behavior), or explicitly defer this runner change and prohibit `0021` until it lands.

### High — Claim-support linkage is not a deterministic draft-creation contract

**Finding:** The response contract names `claims[]`, while the schema requires normalized claims and support joins, but it does not bind each returned claim to selected evidence references or state when a draft must be rejected rather than merely blocked later. Independent builders could either attach every selected item to every claim or create unsupported draft claims.

**Action:** Define a bounded claim object with application-validated references to the selected evidence snapshots (or require a review-only `unsupported` state). Require draft persistence to atomically create the normalized claim/support rows and reject unknown/out-of-selection references; reserve the later gate only for deliberately unsupported claims awaiting review.

### Medium — Template bootstrap cannot be transactionally atomic across filesystem and SQLite

**Finding:** The bootstrap rule asks for a private file copy/hash and database designation “in one transaction,” but a filesystem copy cannot share SQLite atomicity. A crash after placement or after database commit can create an orphaned file or a designated row whose bytes are missing.

**Action:** Specify a recoverable staging protocol: write/hash to a unique staging path, commit the verified metadata/designation, atomically rename to the final private path, then reconcile staged/orphaned/missing files at next explicit workspace validation. Preview must fail closed until reconciliation confirms the digest.

### Medium — Current-selection integrity needs an explicit single-profile and template replacement rule

**Finding:** `resume_generation_state` is the sole mutable pointer, yet no invariant says how it is initialized when no profile/template exists, how profile selection changes, or whether a later bundled template can replace the designated one. Builders could implement different singleton/upsert and replacement behaviors.

**Action:** State the empty-state row policy, require compare-and-set/current-revision validation for profile and template selection, and declare whether template designation is one-time for the MVP or an explicit versioned selection command with an audit event and consent invalidation.

## Positive coverage

- AD-13/AD-14 clearly prevent the legacy manual editor from becoming a second authority.
- The gateway's one-request, loopback-only, consent-fingerprint boundary is enforceable and appropriately excludes tools, fallback, and operational content logging.
- Rendering is correctly deferred and separated from template preview, draft creation, approval, and export.
