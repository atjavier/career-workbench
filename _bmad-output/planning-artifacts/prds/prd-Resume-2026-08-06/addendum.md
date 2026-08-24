# PRD Addendum: Architecture Decision Register

This addendum captures technical choices deferred by the PRD. They are not approved designs and must be resolved without violating the PRD's privacy, source-compliance, truthfulness, manual-refresh, and human-review requirements.

## A. Source adapters and compliance registry

Architecture must define an allowlist-backed source registry, a documented approval workflow, and the adapter boundary for company-career sources, permitted feeds, and user-configured platform search URLs. It must specify how terms, rate limits, robots/access rules, authentication requirements, field mappings, and source changes are reviewed. An adapter must fail closed when permission is uncertain.

## B. Fit assessment implementation

Decide whether Fit Labels are implemented by deterministic rules, constrained model-assisted extraction plus deterministic labeling, or another auditable approach. The design must retain the factors and candidate/posting evidence behind every label, account for unknowns and staleness, and prohibit conversion into a hiring prediction.

## C. AI processing and cost boundary

Choose an AI provider and model after confirming data-retention, training, regional processing, security, and cost capabilities. Define minimal prompt payloads, redaction/minimization, no-training default, per-request accounting, monthly/user caps, timeout and retry behavior, and how evidence validation prevents a model output from becoming a candidate claim without support.

## D. Google OAuth and Sheets synchronization

Select the OAuth client architecture and minimum scopes. Decide how tokens are encrypted, how spreadsheet selection/creation works, the normalized sheet/table layout, stable entity keys, write idempotency, conflict handling for user edits in Sheets, and recovery after expired/revoked access. The spreadsheet must remain understandable and useful to the user without the product.

## E. Document editing and exports

Choose the editable-source format and document-generation path. Validate that templates remain ATS-readable, semantic content survives edits, exported PDF matches the approved Draft, and versions are immutable. The solution must not write to the Base Resume and must preserve material provenance.

## F. Private deployment and retention

Decide authentication model, data store, encrypted fields, retention/deletion interface, backups, and recovery. The user should be able to understand what data is retained locally versus shared with Google and the selected AI provider.
