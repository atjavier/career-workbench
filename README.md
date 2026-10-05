# Career Workbench

Career Workbench is a private, local-first cross-platform desktop application (macOS, Windows, Linux) for compliant job discovery, evidence-backed resume engineering, and application tracking.

It is designed around a core principle: **your career data stays entirely on your computer, under your control, with zero cloud transmission.** Every consequential operation is explicit, bounded, verifiable, and recoverable.

---

## Key Capabilities

- **Single-Instance Desktop Experience**: Packaged as a dedicated desktop application powered by Electron and Next.js Standalone, enforcing a single application instance to prevent multi-tab state desynchronization and database write conflicts across macOS, Windows, and Linux.
- **Evidence-First Resume Builder**: Ground every bullet point and claim in reviewed repository documentation, technical notes, and interview answers.
- **Interactive Local AI Coach**: Conduct clarification interviews and draft refinements using a locally hosted LLM (via LM Studio or Ollama on loopback) without sending data to external APIs.
- **Native LaTeX PDF Compilation**: Compiles publication-quality, ATS-optimized resumes using an embedded or system Tectonic engine, with live split-view preview and direct editable `.tex` draft support.
- **Opportunity CRUD**: Review supplied job descriptions, add opportunities, view/edit saved details, and permanently delete opportunities with their attached tailored resumes.
- **One Tailored Resume per Opportunity**: Use the single base resume automatically; successful regeneration replaces the current tailored resume. Opportunity edits recommend regeneration. Fit assessment is outside the MVP.
- **Jobs Navigation**: All Opportunities and Applied are sidebar subsections. Application tracking is not implemented yet; Applied provides a truthful empty state and a link back to opportunities.
- **100% Private & Local Authority**: Uses Node's built-in `node:sqlite` (in WAL mode) as the single source of truth, secure OS Keychain/Credential Manager storage via `@napi-rs/keyring`, and metadata-only audit logging.

---


## Opportunity workflow

Select **Add opportunity** to open `/opportunities/new`. Paste the reference URL and job description, then select **Add opportunity**. The dedicated **Job Opportunity Reader** uses your configured local model to identify cited job facts and organize the full description; the application checks structure, bounds and source evidence, formats the content, saves it and opens details. There is no draft approval or follow-up metadata form. Role titles use Title Case. Genuinely missing facts use the existing Unknown storage convention; one focused AI retry may recover missing identity. Unavailable or malformed AI preserves your URL and paste for retry and saves nothing. Fields are disabled while processing. The URL is a reference and is never retrieved. Saved details remain editable; original source stays separate and collapsed. Delete uses **Cancel / Delete opportunity** without typing confirmation and physically removes the opportunity, its descriptions and attached tailored resume.

Open a saved opportunity to view, edit or delete it. Permanent deletion removes its revisions and attached tailored output while preserving the base resume and unrelated opportunities.

Tailoring requires a ready base resume and explicit local AI consent. One current tailored output is stored per opportunity; failed regeneration leaves it unchanged. Review the output before PDF download. The initial tailoring implementation selects/reorders existing verified bullets rather than inventing or paraphrasing facts.

Current behavior and test evidence: [_bmad-output/implementation-artifacts/spec-opportunities-component-driven-crud.md](_bmad-output/implementation-artifacts/spec-opportunities-component-driven-crud.md) and [_bmad-output/implementation-artifacts/spec-single-opportunity-tailored-resume.md](_bmad-output/implementation-artifacts/spec-single-opportunity-tailored-resume.md).

## Desktop Application Architecture

Career Workbench runs as a native desktop application orchestrating an embedded Next.js Standalone server:

```text
┌─────────────────────────────────────────────────────────────┐
│             macOS / Windows / Linux Operating System        │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                 Electron Main Process               │   │
│   │                                                     │   │
│   │   • Single-Instance Lock (app.requestSingleInstanceLock)│
│   │   • Standalone Server Supervisor & Healthcheck      │   │
│   │   • Native Window (macOS Inset / Windows & Linux Chrome)│
│   │   • External Link Routing (shell.openExternal)      │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │ loads loopback URL           │
│   ┌──────────────────────────▼──────────────────────────┐   │
│   │               Next.js Standalone Server             │   │
│   │                 (http://127.0.0.1:PORT)             │   │
│   │                                                     │   │
│   │   • React 19 / Server Components & Server Actions   │   │
│   │   • Node built-in SQLite (node:sqlite WAL mode)     │   │
│   │   • OS Keychain / Credential Vault (@napi-rs/keyring)   │
│   │   • Local TeX Compiler Pipeline (Tectonic)          │   │
│   │   • Local Model Gateway (127.0.0.1:1234 LM Studio)  │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Why a Standalone Desktop App?

In a multi-tab web browser, opening multiple tabs against a local single-writer SQLite database leads to desynchronization: actions in one tab advance database revisions and task IDs while other open tabs hold stale DOM state, resulting in optimistic concurrency rejections (`RESUME_WORKSPACE_STALE`).

The desktop wrapper fundamentally eliminates this:
1. **Single-Instance Enforcement**: `app.requestSingleInstanceLock()` guarantees only one window and process runs. Attempting to open a second instance immediately focuses the existing window.
2. **Zero-Terminal Management**: Spawns the Next.js standalone server on an available loopback port dynamically, monitors HTTP health, and terminates the server tree cleanly with `SIGTERM` when quitting.
3. **Web Security Boundary**: Non-loopback links (such as job postings and external docs) are intercepted and opened in your operating system's default browser, preventing untrusted remote content from executing inside the app.

---

## Prerequisites

- **Operating System**: macOS (Apple Silicon or Intel), Windows 10/11, or Linux (Ubuntu, Debian, Fedora, Arch, etc.)
- **Node.js**: `>=24.18.0` (uses built-in `node:sqlite` `DatabaseSync`)
- **Tectonic** (Optional, for LaTeX PDF compilation):
  - **macOS**: `brew install tectonic`
  - **Windows**: `winget install tectonic`
  - **Linux**: `sudo apt install tectonic` (or package manager equivalent)
- **LM Studio** or **Ollama** (Optional, for local AI Coach and fit assessments):
  - Accessible on loopback `http://127.0.0.1:1234`
  - Recommended model: `Qwen 2.5 7B/14B Instruct` or equivalent

---

## Getting Started

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/atjavier/career-workbench.git
cd career-workbench
npm install
```

### 2. Running in Desktop Mode (Recommended)

To start the local development server and open the native desktop application window:

```bash
npm run desktop:dev
```

To build and run the production standalone desktop application:

```bash
npm run desktop:build
npm run desktop:start
```

### 3. Packaging Standalone Binaries

Package self-contained installers and bundles for your platform via `electron-builder`:

```bash
# Package for current platform (directory output)
npm run desktop:pack

# macOS (.dmg and .zip for arm64 / x64)
npm run desktop:pack:mac

# Windows (.exe installer via NSIS and portable .exe)
npm run desktop:pack:win

# Linux (AppImage and .deb)
npm run desktop:pack:linux

# All platforms
npm run desktop:pack:all
```
The packaged bundles will be generated in the `release/` directory.

### 4. Running in Web Mode (Headless / Browser)

You can also run Career Workbench as a standard local web service:

```bash
# Development server (http://127.0.0.1:3000)
npm run dev

# Production build and run
npm run build
npm start
```

---

## Verification & Testing

Career Workbench maintains a strict test suite covering persistence integrity, optimistic concurrency, LaTeX compilers, local model boundaries, accessibility (WCAG 2.2 AA), and cross-platform desktop lifecycle management:

```bash
# Run all unit, integration, and security tests (283 tests)
npm test

# Typecheck both Next.js/React and Electron TypeScript
npm run typecheck

# Lint codebase
npm run lint
```

---

## Project Structure

```text
├── electron/                  # Electron main, preload, and server lifecycle supervisor
│   ├── main.ts                # Single-instance lock, cross-platform windowing, and menu configuration
│   ├── server-manager.ts      # Standalone server process supervisor & port discovery
│   ├── preload.ts             # Context-isolated secure desktop bridge
│   └── tsconfig.json          # TypeScript build configuration for Electron
├── src/
│   ├── app/                   # Next.js App Router (UI pages, layouts, and Server Actions)
│   ├── domain/                # Core business logic (resume generation, fit scoring, intake)
│   ├── persistence/           # SQLite repositories and linear migration scripts
│   ├── adapters/              # Local model gateways (LM Studio), PDF parsers, OS vault
│   ├── files/                 # Private app-data filesystem storage and evidence handling
│   └── audit/                 # Append-only metadata audit event logging
├── tests/                     # Automated test suite (node:test)
├── scripts/                   # Local execution, standalone build, and dev scripts
├── electron-builder.json      # Cross-platform packaging configuration (macOS, Windows, Linux)
└── next.config.ts             # Next.js standalone output configuration
```

---

## Privacy & Security Invariants

- **No Remote Telemetry**: Telemetry is disabled (`NEXT_TELEMETRY_DISABLED=1`).
- **Loopback-Only Binding**: Servers bind strictly to `127.0.0.1` and refuse connections from external network interfaces (`0.0.0.0`).
- **Metadata-Only Auditing**: Audit logs record UUIDv7 IDs, action types, and SHA-256 hashes—never personal candidate details, raw resumes, prompt bodies, or model completions.
- **OS-Level Keyring**: AI API tokens and sensitive preferences are stored in the OS Keychain/Credential Store via native `@napi-rs/keyring` (macOS Keychain, Windows Credential Manager, Linux Secret Service).

---

## License

Private / Personal Workspace. All rights reserved.


Agent responsibilities and boundaries: [Application AI agents](docs/application-ai-agents.md). Repository architecture findings and follow-up recommendations: [Codebase structure review](docs/codebase-structure-review-2026-10-05.md).


Evidence clarification questions now come from the selected local AI using an Engineering Manager for experiences and a Principal/Staff Engineer for projects. Labels are generated for each missing context rather than chosen from fixed categories. Supplied role/dates and existing answers are part of the context. If question planning fails, use **Read evidence again** in Experience & Projects or the failed intake to retry saved evidence without reimporting folders. Existing databases receive a forward category upgrade that preserves interview history.

AI/source orchestration lives in `src/application`; domain contracts remain in `src/domain`, model instructions/feature gateways in `src/adapters/local-model`, and feature Server Actions in `src/app/actions`. `npm start` uses standalone output after `npm run build`, binds loopback, and keeps evidence in the original workspace. Packaged Electron uses a writable user-data workspace; `CAREER_WORKBENCH_WORKSPACE_ROOT` can explicitly select an existing evidence location.
