# Sprint Change Proposal — CV Builder-Inspired Career Workspace Visual System

Date: 2026-08-24  
Project: Resume  
Change scope: Moderate — Epic 0 UX-plan adjustment

## 1. Issue Summary

The approved Jobs-first Career Workspace foundation now has a stronger visual reference: a polished CV Builder. The product must feel like one modern, human-oriented application rather than a set of technical workflow panels. The reference calls for a dark premium shared header, warm orange primary actions, guided Resume steps, evidence/skill chips, and a responsive editor-and-preview Resume workspace.

The visual direction cannot weaken the product's existing boundaries: Jobs remains the primary destination; local data remains authoritative; directory access and evidence review remain explicit; technical metadata is progressively disclosed; and accessibility is a release requirement.

Evidence gathered during UX validation:

- The proposed white text on `#F59E4A` primary actions is about 2.1:1 contrast and fails WCAG AA.
- The Resume preview needed a clear local, revision-aware, safe-rendering contract.
- Compact navigation, narrow record layouts, and the Career Assistant's operational states were under-specified.

## 2. Impact Analysis

### Epic and story impact

Epic 0 remains valid and stays in progress. No completed Epic 1–6 domain story is removed, rolled back, or rewritten.

| Story | Planned adjustment | Dependency / status |
|---|---|---|
| 0.4 Resume and Evidence Library | Add guided Resume steps, evidence/skill chips, responsive editor/preview, local preview safety, and the shared visual system. | Remains `in-progress`; its dedicated route composition is done, but the approved visual behavior still requires implementation and verification. |
| 0.5 Career Assistant | Specify consent-led directory selection, proposal review, local/manual default processing, and entry/error/recovery states; reuse shared visual patterns. | Remains backlog; depends on 0.4 shared Resume/Evidence patterns. |
| 0.6 Google Sheets | Reuse shared dark header, accessible action hierarchy, human states, and responsive cards without altering the local-authoritative mirror contract. | Remains backlog; can proceed after shell visual contract is available. |
| 0.7 Humanize content, states, and responsive behavior | Expand into the cross-app visual-system and validation story. | Remains backlog; follows 0.4–0.6 to validate the integrated product. |

Stories 0.1–0.3 remain complete and are not reopened. Future domain stories consume these UX patterns when they add their real data, rather than duplicating navigation or visual rules.

### Artifact impact

- **UX:** `DESIGN.md` and `EXPERIENCE.md` need the accessible visual tokens, shared-shell/compact-navigation rules, local preview contract, Career Assistant state model, record-to-card mapping, and Inspiration & Anti-patterns section.
- **Epics/stories:** `epics.md` and Story 0.4 need the clarified acceptance criteria and dependencies. Stories 0.5–0.7 need targeted acceptance-criteria additions.
- **Sprint tracking:** `sprint-status.yaml` keeps completed stories intact and retains 0.4 as `in-progress`; no epic or story renumbering is needed.
- **Architecture:** no technology, data model, API, or integration change. Add only a UX boundary note that UI preview and directory workflows stay local, explicit, non-executing, and non-authoritative.
- **PRD:** no change. Existing Jobs-first, local-first, accessibility, evidence, and consent requirements remain the source of truth.

### Technical impact

The code work is presentation and verification focused: shared tokens and components, application-shell behavior, Resume composition, responsive record layouts, and UI-contract tests. It must not add a watcher, automatic scan/retry, external request, cloud/AI fallback, new data authority, export shortcut, or fabricated record.

## 3. Recommended Approach

### Selected path: Direct Adjustment

Adjust the existing Epic 0 UX plan and finish the visual work through its already-planned stories. This is lower-risk than a rollback and preserves progress on the Jobs-first shell, Jobs home, Applications workspace, and dedicated Resume/Evidence routes.

**Effort:** Medium.  
**Risk:** Medium, concentrated in responsive accessibility and preview truthfulness.  
**Timeline effect:** Story 0.4 gains implementation/validation work; 0.5–0.7 inherit the contract. No new epic or backend replan is necessary.

Alternatives considered:

- **Rollback:** not justified; the completed shell and workspace work are compatible with the revised system.
- **MVP reduction:** not recommended; the change clarifies the existing product promise rather than adding a new domain capability.

## 4. Detailed Change Proposals

### 4.1 Accessible warm primary system

**Artifact:** `DESIGN.md` colors and `button-primary` component.

**Before:** primary `#F59E4A` with white foreground.

**After:** retain warm orange `#F59E4A`, use dark plum `#201126` foreground, record a verified AA contrast result, and reserve warm primary actions for affirmative/forward commitments. Delete, revoke, discard, and other irreversible actions use a distinct danger treatment with explicit effect copy.

**Reason:** preserves the desired visual identity while correcting the shared contrast failure.

### 4.2 Guided Resume, local preview, and narrow-screen review

**Artifacts:** `DESIGN.md`, `EXPERIENCE.md`, Story 0.4.

**Before:** a generic editor beside a read-only preview on large screens and stacked on narrow screens.

**After:** Resume includes a labelled guided stepper, evidence/skill chips that retain source/state/actions, and a revision-aware local preview. On narrow screens, a named review summary/warning count precedes editing and labelled jumps reach Editor, Preview, Warnings, and Provenance. Stale or unsaved preview state is visible and invalidates acknowledgement. The preview never executes document content, loads remote assets, uses telemetry, or silently falls back to a remote/AI service. A safe text/failure view preserves edits when preview rendering is unavailable.

**Reason:** makes the split editor/preview both polished and trustworthy.

### 4.3 Shared dark shell and responsive Job/Application records

**Artifacts:** `DESIGN.md`, `EXPERIENCE.md`, Story 0.7.

**Before:** responsive navigation and stacked records are required generally but not defined as a specific interaction or record contract.

**After:** every workspace uses the dark premium header, clear active destination, text-first local/remote connection status, visible focus, and the shared action hierarchy. The compact navigation is a labelled native control exposing the current destination, supporting keyboard and Escape, restoring focus, and preserving unsaved-edit protection. At 320 CSS px and 400% zoom, Jobs and Applications use labelled cards that preserve the record name, all required fields, filters/sort/result count, status, and actions without unjustified two-dimensional scrolling.

**Reason:** turns the visual direction into a usable cross-device application shell.

### 4.4 Epic 0 story alignment

**Artifacts:** `epics.md`, Story 0.4, `sprint-status.yaml`.

**Before:** Story 0.4 covers dedicated Resume/Evidence routes but not CV Builder visual behavior; 0.5 and 0.6 are independent workspace plans; 0.7 is a general polish story.

**After:** 0.4 gains the Resume visual/review contract; 0.5 and 0.6 explicitly reuse shared visual patterns without changing their privacy/domain contracts; 0.7 becomes the cross-app visual-system, content-state, responsive, and accessibility validation story. 0.4 remains in progress; 0.5–0.7 remain backlog.

**Reason:** sequences the foundation before workspaces that depend on it and preserves truthful delivery tracking.

### 4.5 Career Assistant and privacy UX completion

**Artifacts:** `EXPERIENCE.md`, `DESIGN.md`, Story 0.5.

**Before:** the assistant is a destination with high-level directory/evidence guidance, but its states and consent boundaries are incomplete.

**After:** the assistant explains its local project-evidence purpose, exact selected folder and bounded scope, source non-mutation, cancellation, individual proposal review, and first-use/no-folder/inspecting/no-evidence/inaccessible-folder/cancelled/partial-result states. Local/manual processing is the default; any future non-local transfer requires fresh, explicit consent and cannot silently fall back. Add an Inspiration & Anti-patterns section that adopts the premium header, warm affirmative action, guided steps, chips, and clear editor/preview while rejecting fake progress, opaque AI behavior, hidden technical truth, and decorative controls that obscure review/privacy boundaries.

**Reason:** keeps the assistant useful and product-like without making it an uncontrolled chatbot.

### 4.6 Scope preservation and validation handoff

**Artifacts:** architecture UX-boundary note and Story 0.7 validation plan.

**Before:** existing PRD/architecture protections are implicit to the visual change; validation does not enumerate the new high-risk UX paths.

**After:** retain PRD and architecture domain decisions unchanged; state the local/non-executing/non-authoritative UI boundary. Validate contrast, keyboard/screen-reader paths, 320px/400%-zoom reflow, long values, compact navigation, stale-preview/warnings, and no network/scan/fallback regressions.

**Reason:** makes the desired polish measurable without changing product scope.

## 5. Implementation Handoff

**Classification:** Moderate — backlog reorganization and Developer implementation.

| Recipient | Responsibility |
|---|---|
| Product Owner / planning workflow | Apply the approved UX, Epic 0, Story 0.4–0.7, architecture boundary-note, and sprint-status edits. |
| Developer | Complete Story 0.4’s visual/editor-preview scope, then implement 0.5–0.7 in dependency order. Preserve current domain behavior and update UI-contract tests. |
| Code Review | Verify acceptance criteria, contrast, keyboard and responsive behavior, truthful status/privacy copy, and regressions after each implementation story. |

### Success criteria

1. Every main workspace visibly belongs to one Jobs-first premium application shell.
2. Warm actions pass AA contrast and do not disguise destructive commitments.
3. Resume’s stepper, chips, editor, and preview preserve local-first evidence review on desktop and phone.
4. Career Assistant and Google Sheets remain explicit, human-oriented, and consent-led.
5. Existing backend/domain behavior, local authority, and completed stories remain intact.

