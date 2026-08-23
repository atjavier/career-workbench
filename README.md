# Career Workbench

Career Workbench is a local-first workspace for compliant job discovery, evidence-backed resume development, and application preparation.

It is designed around a simple principle: career data stays under the user's control, and every consequential action is explicit, bounded, auditable, and recoverable.

## What it does

The application runs on a user's computer and provides a private workspace for:

- importing and preserving a read-only Base Resume;
- managing a reviewed library of resume evidence from projects and experience;
- maintaining a versioned Current Base Resume without overwriting historical sources;
- configuring role, country, location, and work-style preferences;
- recording permitted job-discovery sources with policy, retention, and rate-limit metadata;
- running explicit, bounded refresh attempts against approved source adapters;
- preserving source-level refresh outcomes, including partial, blocked, throttled, and failed results; and
- recording metadata-only audit events for important local actions.

## Current implementation

The repository currently covers the first two discovery milestones and the private evidence workspace.

### Private workspace and evidence

- Loopback-only Next.js application bound to `127.0.0.1`.
- SQLite and private OS-user app data as the local authority.
- Immutable Base Resume imports with content digests and companion-file metadata.
- Evidence extraction, manual evidence entry, individual review actions, immutable revisions, and provenance.
- Project and experience evidence library with explicit imports and source-folder preservation.
- Optional local-model project documentation that produces review-only evidence proposals.
- Versioned Current Base Resume drafts and evidence-backed proposal review.
- Local backup, activity-history export, trash/recovery, and deletion flows.

### Job eligibility preferences

- Philippines-first country preference.
- Fresh-graduate, junior, associate, cadetship, and paid-training role intents.
- Remote-first and NCR hybrid/onsite work-style priorities.
- Append-only local preference revisions with optimistic-concurrency checks and metadata-only audit events.

### Permitted source policy

- Eight conservative initial sources are recorded as manual-browser-only and disabled for application retrieval.
- Source records require controlled source type and access path, HTTPS URLs without embedded credentials, policy review date/revision, retention rules, failure guidance, and bounded request/rate values.
- Retrieval enablement requires an approved, current policy and one of the controlled methods: `official-api`, `published-feed`, or `policy-reviewed-html`.
- Configuration changes are local-only; saving a source never opens, tests, scans, or retrieves it.

### Bounded source refresh

- Refresh requires an explicit source selection and confirmation.
- Refresh runs are persisted with UUIDv7 identities and source-configuration revision links.
- Per-source outcomes include `completed`, `partial`, `failed`, `blocked`, and `throttled` states with timestamps and recovery guidance.
- Request budgets and per-minute limits are enforced before adapter attempts.
- The adapter registry is intentionally finite and source-specific; an enabled URL is never treated as permission to perform generic scraping.
- The current seeded catalog has no retrieval-enabled source, so the default refresh experience correctly explains the browser-handoff/manual-import path and makes zero network requests.
- There is no scheduler, polling, background refresh, automatic retry, proxying, credential reuse, or access-control bypass.

## Architecture

Career Workbench is a local-first modular monolith:

```text
Browser UI
    |
Next.js App Router on 127.0.0.1
    |
Domain commands -> SQLite transactions -> metadata-only audit
    |
Explicit, policy-gated adapters (when approved)
```

The project is organized by responsibility:

```text
src/app/                 Next.js UI and Server Actions
src/domain/              Commands, validation, and business rules
src/persistence/         SQLite repositories and migrations
src/adapters/            Local document and source adapter boundaries
src/files/               Private app-data and lifecycle handling
src/audit/               Append-only metadata audit events
tests/                   Unit, integration, accessibility, and safety tests
```

Important invariants include:

- local state is authoritative;
- revisions are immutable where provenance matters;
- stored times are UTC ISO 8601;
- local identities use UUIDv7;
- audit records contain metadata and content digests, never sensitive bodies, prompts, tokens, credentials, or raw responses; and
- successful partial work is preserved when an individual source or adapter fails.

## Technology

- Node.js `>=24.18.0`
- Next.js `16.3.0`
- React `19.2.3`
- TypeScript `5.9.3`
- SQLite through Node's built-in `node:sqlite`
- PDF text parsing with `pdfjs-dist`

No public service, product login, cloud database, or hosted worker is required for the current application.

## Run locally

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

The development and start scripts bind Next.js to `127.0.0.1`.

Run the production build:

```bash
npm run build
npm run start
```

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The test suite covers persistence integrity, optimistic concurrency, source-policy enforcement, accessibility semantics, metadata-only auditing, bounded refresh behavior, safe failure, and regression behavior across the workspace.

## Roadmap

The next planned capability is normalized Job Listing inspection: retaining source attribution, preserving unknown fields, and making probable duplicate groups inspectable without deleting source records. Later milestones cover evidence-based fit explanations, truthful tailored materials, local application tracking, and an optional Google Sheets mirror.

## Project status

This is an actively developed MVP. The current implementation favors conservative boundaries and explicit user control over unattended discovery or opaque automation.

