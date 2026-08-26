# Application-native resume agent skill contract

The configured local LLM receives only the selected, bounded file material and typed tool results that the application grants. It never receives a shell, arbitrary filesystem API, network client, credential, database handle, watcher, or Codex/developer-session instruction.

## Registry

Each skill registration is immutable configuration with:

- stable `skillId` and human-readable purpose;
- typed input and output schemas;
- required user consent and allowed invocation surface;
- readable root(s), allowlisted extensions, excluded directories, maximum depth/files/bytes, and no-link policy;
- writable destinations limited to a designated staging/output root and review store;
- prohibited capabilities: shell/process, network/cloud, credentials, database, background/retry, source mutation, and invoking another unregistered skill.

The runtime validates the request and every tool call against this declaration. A malformed result, undeclared path, limit breach, link/reparse point, or source snapshot change fails closed and publishes no partial artifact.

## Skills

### `resume.document-source-folder`

The sole user-facing documentation skill. It accepts a category (`project` or `experience`) and one explicitly selected source folder. It calls only the bounded local file-inspection tools, then returns exactly three proposed/unreviewed Markdown artifacts: `project-overview.md`, `resume-evidence.md`, and `resume-bullet-candidates.md`. It writes no source file and makes no claim eligible.

### `resume.inspect-source`

Internal helper for ordered, bounded inventory of documentation, manifests, configuration, source, and test text. It returns safe file handles/content slices and source-relative line maps, never absolute paths or binary/dependency/generated content.

### `resume.extract-atomic-evidence`

Internal helper that accepts inspected text and line maps, emits only direct atomic facts with heading/line provenance and explicit unknowns, and rejects inference of ownership, metrics, users, dates, outcomes, deployment, or skills.

### `resume.compose-review-artifacts`

Internal helper that renders the fixed three templates, links bullet candidates to evidence IDs, validates proposed/unreviewed state, and stages output atomically outside the source.

### `resume.validate-documentation`

Internal final gate that checks exact artifact names, schema, provenance, bounds, source snapshot equality, and forbidden content before publication.

The internal helpers are not independently invokable by the user or model; only the top-level skill can orchestrate them, and the registry prevents recursive or undeclared skill use.
