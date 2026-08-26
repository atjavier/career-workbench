# LocalModelGateway Contract

Implements AD-2 and AD-13. This is the only Resume Coach model path.

## Preconditions

- A saved Candidate Profile revision meets required-field validation.
- The request uses the locally configured exact `LM_STUDIO_MODEL` identifier and the fixed tokenless loopback endpoint at `127.0.0.1:1234`; no cloud credential or vault lookup is used.
- Each selected evidence revision is approved and belongs to reviewed Experience & Projects material; the opportunity revision is optional and immutable.
- Consent is recomputed for the exact request. It expires after one submission and is invalid after a profile, evidence, opportunity, template, model configuration, or request-text change.

```text
consentFingerprint = SHA-256(
  profileDigest + sorted(evidenceDigests) + optional(opportunityDigest) +
  templateDigest + configurationFingerprint + SHA-256(userRequest)
)
```

## Request

`CoachRequest` is server-only:

```text
configurationRevision, profileRevision, evidence[], optional opportunityRevision,
userRequest, consentFingerprint
```

Before `fetch`, validate UUIDv7/digests, required profile fields, evidence review state, exact current-selection fingerprints, control-character-free bounded text, and total request size. Send one tokenless local request to `POST /v1/chat/completions` with `store: false`; omit `previous_response_id`, integrations, tools, URLs, paths, credentials, and unselected content. Reject a response containing a response-chain identifier. Do not retry or fall back.

## Response schema

Only this logical JSON object is accepted:

```text
{
  schemaVersion: 1,
  selectionEcho: consentFingerprint,
  sections: [{ kind, text }],
  claims: [{ sectionIndex, text, evidenceIndexes: [number, ...] }],
  unknowns: [string, ...]
}
```

All arrays and strings are bounded; strings are plain text with control characters rejected. `selectionEcho` must match exactly. Every candidate-facing claim has a non-empty deduplicated `evidenceIndexes` list. The application resolves those indexes only against selected approved evidence, generates claim IDs itself, and writes all claim-support joins in the same transaction as the draft. An unresolvable reference, unsupported claim, invalid JSON/schema, timeout, unavailable model, or malformed response rejects the entire response; no partial draft is stored.

## Privacy and audit

The UI identifies LM Studio on this device, the configured model, and readable selected material names before submission. It does not reveal identifiers, digests, tokens, endpoints, raw adapter diagnostics, or provenance internals. Private draft-domain data may retain the reviewable request and proposal; audit events retain only UUIDv7 IDs, action/outcome, and SHA-256 hashes.

Audit actions: `resume.profile_saved`, `resume.template_designated`, `resume.coach_requested`, `resume.coach_failed`, `resume.material_draft_created`, `resume.material_draft_handed_off`, `resume.material_version_approved`, `resume.rendered`, and `resume.exported`.
