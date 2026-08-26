# Sprint Change Proposal — AI-Grounded Opportunity Assessment

## 1. Issue Summary

Story 3.2 was prepared to extend a deterministic, keyword-and-signal fit label. Adrian prefers a more meaningful local AI assessment that understands relationships between his approved resume evidence and a pasted job description, while remaining performant, private, grounded, and non-predictive.

The current Story 3.1 implementation is also tied to the superseded discovery `job_listings` model. The active product uses immutable Captured Opportunity revisions, so neither the input model nor the requested assessment experience should be extended as-is.

## 2. Impact Analysis

### Epic and story impact

- **Epic 3:** remains valid, but its primary fit explanation becomes an explicit, cached local AI assessment. Deterministic logic remains only for transparent safety disclosures: Unknown/stale data, unambiguous seniority signals, and location/work-style conflicts.
- **Story 3.1:** remains historical/review work. Its legacy assessment rows are retained; they are not migrated or reinterpreted.
- **Story 3.2:** must be rewritten before development. It should consume a confirmed Captured Opportunity revision, provide an explicit **Assess fit** request, cache the result by immutable inputs, explain evidence/provenance, and retain a separate Pursue/Priority decision.
- **Story 8.3:** becomes the implementation prerequisite. It must provide the shared consented loopback `LocalModelGateway`, configuration, bounded structured response, timeout/error behavior, and metadata-only audit pattern. It must not be duplicated in Jobs.
- **Story 8.4:** remains the downstream material-draft path; its claim-review/export gates must not be bypassed by a fit assessment.

### Artifact impact

- **PRD:** FR-8/FR-9 continue to require explainable, non-predictive fit. Clarify that a local AI assessment is allowed only when grounded in approved evidence and the user-provided captured description, with deterministic uncertainty disclosures.
- **Architecture:** AD-2 already provides the right secure gateway boundary. AD-3 must change from “deterministic fit calculation” to “versioned, locally generated, evidence-grounded assessment with deterministic safety disclosures.” The request must remain one explicit loopback call, no retry/fallback, no prompt/response logs, and must pin every input revision.
- **UX:** Jobs gets an explicit **Assess fit** action and a compact staged state: preparing locally, assessing, ready, unavailable/error. The result remains sectioned: strengths, gaps/uncertainty, safety disclosures, evidence links, captured excerpts, and an explicit host-labelled handoff.

## 3. Recommended Approach

**Direct adjustment with resequencing — moderate scope.** No completed feature needs rollback and no new epic is needed.

1. Implement Story 8.3 first as a reusable, consented, local-only AI request capability.
2. Replace Story 3.2 with an AI-grounded assessment story that reuses that capability.
3. Keep a compact deterministic preflight/disclosure layer. It never decides the overall fit and never claims semantic understanding.

### Performance plan

1. Create a short, versioned career summary only when approved profile/evidence changes.
2. Extract a compact structured job brief only when the captured revision changes.
3. For an assessment, send the summaries plus only the most relevant approved evidence and short captured excerpts—not every document.
4. Require a bounded JSON schema, low temperature, short `max_tokens`, one request, and no tools.
5. Cache the result by profile/evidence digest, captured-opportunity digest, model configuration fingerprint, and prompt/schema version. Reuse the cache only when all inputs match.
6. Show local progress and safe unavailable/error states. A response is advisory only and never a hiring prediction.

## 4. Detailed Change Proposals

### Story 8.3 — dependency and reusable contract

**Current:** A safe Coach request produces structured material drafts.

**Proposed:** Preserve that purpose, but define `LocalModelGateway` as the single shared, stateless request boundary for approved local AI capabilities. Its task-specific contracts remain separate: Resume Coach draft generation versus Job fit assessment. Both require explicit per-request consent, exact pinned input revisions, bounded structured output, loopback-only endpoint, no tools/MCP, no fallback/retry, and metadata-only audit.

**Rationale:** Avoids two security/configuration implementations and makes performance controls consistent.

### Story 3.2 — replace deterministic primary assessment

**Current:** A deterministic label based on captured requirements/evidence, with explanation, personal decision, and handoff.

**Proposed:** An explicit local AI assessment of an immutable Captured Opportunity and approved evidence. Persist an immutable result containing input digests, model/configuration fingerprint, prompt/schema version, structured strengths, gaps, uncertainty, evidence references, captured excerpts, and generated UTC time. Cache exact matching input snapshots. Separate Pursue/Priority remains a local append-only decision history and never changes the assessment.

**Rationale:** Delivers meaningful semantic comparison while retaining provenance, privacy, explicit control, and performance bounds.

### PRD / architecture / UX updates

Add an approved-change section to each artifact, preserving all existing non-predictive, provenance, local-only, accessibility, and explicit-handoff constraints. The source URL remains attribution and a handoff only; neither the model nor the app fetches it.

## 5. Implementation Handoff

**Scope:** Moderate — backlog reorganization and two updated stories.

- **Product/architecture documentation:** apply the approved FR/AD/UX clarification and rewrite Story 3.2.
- **Developer:** implement Story 8.3 first using the current no-token, loopback-only LM Studio setup, then Story 3.2 using the shared gateway.
- **Success criteria:** one explicitly consented local request; no cloud/fallback/retry/tools; bounded structured response; cached exact inputs; evidence/captured-excerpt provenance; semantic AI guidance clearly advisory; deterministic safety disclosures; separate Pursue/Priority; no employer automation.

## Approval

Approval is pending. No code or backlog order has been changed by this proposal.
