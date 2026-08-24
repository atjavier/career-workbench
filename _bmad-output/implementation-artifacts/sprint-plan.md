# Sprint Plan — Personal Job Discovery and Application Materials Tool

**Planning basis:** approved epics, canonical SPEC and acceptance criteria, and architecture decisions AD-1 through AD-10. This is a realistic sequential plan for one developer. Stories remain in approved epic and story order; later sprint work does not begin until the prior sprint's release gate passes.

## Release sequence

| Milestone | Sprint | Outcome |
| --- | --- | --- |
| M0: Security posture decided | 0 | Local encryption-at-rest posture is explicitly selected and recorded before sensitive workspace use. |
| M1: Private resume-evidence foundation | 1 | A private, recoverable workspace holds a reviewed evidence library and editable, versioned PDF-derived base resume. |
| M2: Compliant discovery | 2 | Manually refreshed, policy-bounded sources produce normalized listings. |
| M3: Evidence-backed decisions | 3 | Deterministic fit assessments and provenance support pursue/skip decisions. |
| M4: Truthful materials | 4 | Local-model drafts become validated, versioned ATS-readable materials that require approval before export. |
| M5: Local application tracking | 5 | Saved applications, follow-ups, and interviews work locally with no automated applications. |
| M6: Optional Sheets mirror MVP | 6 | User-authorized Google Sheets mirroring is idempotent, local-authoritative, and recoverable. |

## Sprint 0 — Decision gate and implementation setup

**Goal:** close the security decision required for the local workspace.

1. Decide and document the local encryption-at-rest posture before Story 1.1. Record the chosen protection boundary, key/storage approach if applicable, recovery implications, and the user-visible warning/expectation.
2. Establish development machine prerequisites and test fixtures without storing production career data.

**Release gate:** `decision-local-encryption-at-rest` is closed. This blocks Story 1.1.

**Primary risk:** a decision that overpromises browser-only protection or leaves backups/recovery inconsistent with AD-1 and AD-7.

## Sprint 1 — Epic 1: Private career evidence workspace

**Goal:** establish the local system of record and evidence review flow.

| Sequence | Story | Assignment | Key dependencies |
| --- | --- | --- | --- |
| 1 | 1.1 Start a private local workspace | Sprint 1 | Sprint 0 encryption posture; AD-1, AD-7, AD-10 |
| 2 | 1.2 Import and preserve the Base Resume | Sprint 1 | 1.1; AD-4, AD-8 |
| 3 | 1.3 Review candidate evidence | Sprint 1 | 1.2; AD-3, AD-4 |
| 4 | 1.4 Control local data, recovery, and audit history | Sprint 1 | 1.1–1.3; AD-7, AD-10 |
| 5 | 1.5 Build resume evidence library | Sprint 1 | 1.1–1.4; approved change proposal 2026-08-22 |
| 6 | 1.6 Parse and version Current Base Resume | Sprint 1 | 1.5; local PDF parser |
| 7 | 1.7 Document project for resume | Sprint 1 | 1.5; 1.6; local LM Studio gateway |
| 8 | 1.8 Create resume-evidence-documenter skill | Sprint 1 | approved 1.5 evidence schema |

**Release milestone:** M1. Verify the evidence library, PDF parse/update/review path, optional AI proposal path, 30-day trash, recovery/backup behavior, deletion, and metadata-only audit records before moving on.

## Sprint 2 — Epic 2: Compliant job discovery

**Goal:** deliver manual-only, source-policy-compliant discovery.

| Sequence | Story | Assignment | Key dependencies |
| --- | --- | --- | --- |
| 5 | 2.1 Set job eligibility preferences | Sprint 2 | M1 |
| 6 | 2.2 Approve permitted discovery sources | Sprint 2 | Source catalog and rate-budget decision; AD-5 |
| 7 | 2.3 Run a bounded source refresh | Sprint 2 | 2.2; manual refresh and rate budgets; AD-5 |
| 8 | 2.4 Inspect normalized job listings | Sprint 2 | 2.3; provenance retention; AD-3, AD-5 |

**Decision gate:** before Story 2.2, approve the initial permitted-source catalog and per-source rate budgets. The catalog must define allowed access method, terms/policy evidence, refresh rules, normalization fields, and failure/backoff behavior.

**Release milestone:** M2. Demonstrate no scheduled/automatic refresh, no scraping outside approved methods, and each listing's source/provenance.

**Primary risks:** source terms/API constraints, anti-bot behavior, changing source formats, and accidental feature drift toward automated discovery.

## Sprint 3 — Epic 3: Evidence-backed fit and decisions

**Goal:** make fit explainable, reproducible, and reviewable before materials are drafted.

| Sequence | Story | Assignment | Key dependencies |
| --- | --- | --- | --- |
| 9 | 3.1 Calculate a versioned fit assessment | Sprint 3 | M2; evidence model and deterministic scoring; AD-3 |
| 10 | 3.2 Inspect fit provenance and decide to pursue | Sprint 3 | 3.1; outbound link handling; AD-3, AD-4, AD-10 |

**Release milestone:** M3. A changed job/evidence input creates a versioned result and every fit explanation traces to stored source/evidence rather than an unsupported model assertion.

**Primary risks:** ambiguous matching rules, stale inputs, and score explanations that cannot be reconstructed.

## Sprint 4 — Epic 4: Truthful application materials

**Goal:** safely produce, validate, render, approve, and export tailored materials locally.

| Sequence | Story | Assignment | Key dependencies |
| --- | --- | --- | --- |
| 11 | 4.1 Connect the local drafting model safely | Sprint 4 | M3; LM Studio loopback configuration; AD-2 |
| 12 | 4.2 Generate provenance-backed draft content | Sprint 4 | 4.1; reviewed evidence and claim validation; AD-2, AD-4 |
| 13 | 4.3 Render versioned structured materials | Sprint 4 | local renderer decision; 4.2; revised AD-8, AD-9 |
| 14 | 4.4 Approve and export immutable material versions | Sprint 4 | 4.3; explicit approval/export gate; AD-4, AD-8 |

**Decision gate:** before Story 4.3, identify and test a local structured-material renderer that produces an ATS-readable PDF and editable source, including a known-good output, failure capture, and recovery guidance.

**Release milestone:** M4. Resume and cover-letter artifacts derive from the approved structured base-resume version and reviewed evidence, claims are reviewable before inclusion, and export cannot occur without explicit approval. Automated applications remain out of scope.

**Primary risks:** LM Studio availability or unstructured output, unsupported claims, template/escaping failures, and machine-specific TeX path differences.

## Sprint 5 — Epic 5: Local application tracking

**Goal:** complete local tracking before adding an external mirror.

| Sequence | Story | Assignment | Key dependencies |
| --- | --- | --- | --- |
| 15 | 5.1 Save and update a local application record | Sprint 5 | M4; material version references; AD-6, AD-7 |
| 16 | 5.2 Manage follow-ups and interview rounds | Sprint 5 | 5.1; no automated applications; AD-6, AD-10 |

**Release milestone:** M5. The local database is visibly authoritative, application changes are auditable, and no action sends an application or triggers an external application flow.

**Primary risks:** mutable records breaking version references, missed audit events, or design drift toward automatic follow-up/action behavior.

## Sprint 6 — Epic 6: Google Sheets mirror

**Goal:** add opt-in desktop OAuth and resilient synchronization without compromising local authority.

| Sequence | Story | Assignment | Key dependencies |
| --- | --- | --- | --- |
| 17 | 6.1 Authorize and identify a Sheets tracker | Sprint 6 | M5; Google desktop OAuth configuration; AD-6 |
| 18 | 6.2 Create an idempotent tracker mirror | Sprint 6 | 6.1; stable UUID/revision/hash schema; AD-6 |
| 19 | 6.3 Reconcile sync failures and remote divergence | Sprint 6 | 6.2; audit/retry model; AD-6, AD-10 |

**Release milestone:** M6. A user can explicitly connect a Sheets tracker, sync a local-authoritative mirror without duplicate rows, and recover from offline, token, schema, and conflict conditions.

**Primary risks:** OAuth redirect/client setup, token handling, Sheets quota/network failures, schema drift, and remote changes that conflict with the local source of truth.

## Cross-sprint controls

- Preserve all CAP-1 through CAP-16 and AD-1 through AD-10 as binding acceptance references for every implementation and review.
- Maintain manual-only refresh, source-policy compliance, provenance-backed fit explanations, evidence review before claims, explicit draft approval/export, local-authoritative Sheets sync, and no automated applications.
- At each milestone, run the applicable acceptance criteria and verify recovery/audit behavior alongside the functional path.
- Do not begin a blocked story until its named decision gate is recorded as closed in `sprint-status.yaml`.
