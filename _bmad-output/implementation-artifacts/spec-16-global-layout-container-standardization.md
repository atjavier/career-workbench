---
title: 'Epic 16: Global Layout Container Standardization'
type: 'refactor'
created: '2026-10-04'
status: 'done'
route: 'dispatch'
baseline_commit: 'fbebb9cb1cd12f216acf9fca6c5ef36c439c4355'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — approved implementation plan in conversation">

## Intent

**Problem:** Jobs, Profile, Evidence, and Resume use inconsistent wrappers and repeated CSS overrides for page spacing, width, and scrolling. New pages must copy those rules, making alignment difficult to maintain.

**Approach:** Introduce WorkspaceContainer and ContentCard, consolidate layout rules, and migrate the existing major routes. Shared gutters align pages while an explicit studio variant preserves Resume Preview's fixed-height canvas. Implement both Epic 16 stories as one cohesive layout refactor.

## Boundaries & Constraints

**Always:** Accept children, safely appended className, id, and semantic/ARIA attributes. Use global CSS for layout. Preserve page headings, list semantics, tab roles, actions, redirects, profile saving, and evidence details navigation. Preserve existing uncommitted work; review only changes made during this run. Use one implementation agent and one GPT-6 Luna reviewer at high reasoning, per the user's instructions.

**Never:** Change database schemas, AI prompts, categories, resume generation, PDF compilation, deletion behavior, or application-shell navigation. Introduce inline layout styles or new dependencies. Commit, push, or deploy without further instruction.

</frozen-after-approval>

## Code Map

- `src/components/common/layout-containers.tsx` — new pure React primitives usable from both server and client component graphs; no hooks or client directive required.
- `src/app/globals.css` — repeated workspace-shell declarations, profile sizing, Evidence gutters, and negative-selector Resume studio rules must consolidate into explicit page/studio rules. Keep feature-specific internal layouts.
- `src/app/page.tsx` — Jobs outer wrapper; JobListings owns its content.
- `src/components/resume/resume-workspace.tsx` — two onboarding branches and active preview; only preview needs studio sizing.
- `src/components/resume/resume-profile-workspace.tsx` — dedicated Profile outer wrapper and danger-zone section. Preserve modal and delete action.
- `src/components/resume/resume-profile-form.tsx` — semantic profile card; retain form content and error summary.
- `src/components/evidence/experience-projects-workspace.tsx` — Evidence collection wrapper with shared PageHeader.
- `src/components/evidence/experience-projects-details-workspace.tsx` — found/missing detail wrappers and missing-item card.
- `src/components/evidence/experience-projects.tsx` and `src/components/jobs/opportunity-card.tsx` — semantic list-item cards with existing interactions.
- `src/app/resume/interview/page.tsx`, settings, placeholder, and pro workspace components — remaining raw workspace-shell consumers; migrate wrappers so obsolete shell rules can disappear safely.
- `tests/resume-profile-ui.test.ts` and shared UI tests — existing source assertions tied to layout selectors; adjust only expectations that deliberately change.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/common/layout-containers.tsx` — implement WorkspaceContainer with page/studio modes and ContentCard with div/section/article/li semantics and DOM prop forwarding.
- [x] `src/app/globals.css` — consolidate shared gutters, flow spacing, card padding and frame; remove duplicate shell rules and migrated surface declarations. Keep specific card hover and content rules.
- [x] Jobs, Profile, Resume, and Evidence files listed above — replace outer wrappers and primary card surfaces; distinguish page versus studio behavior explicitly.
- [x] Remaining raw workspace-shell consumers — replace wrappers, retaining content and navigation.
- [x] `tests/layout-containers-ui.test.ts` and affected UI tests — verify prop/semantic forwarding, preserved event handlers, default styling, route adoption, and explicit sizing modes.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — register Epic 16 and both story states with evidence from this run.

**Acceptance Criteria:**
- Given a new page or card, when a developer imports the standard component, then global spacing and responsive constraints apply without extra CSS classes.
- Given Jobs, Evidence, Profile, and Resume, when navigating between them, then outer gutters and standard card padding come from one shared CSS contract.
- Given Resume Preview, when rendered, then the canvas remains constrained to the available height with toolbar and scrolling behavior preserved.
- Given onboarding, Profile, or long Evidence content, when rendered, then normal page scrolling remains available and content is not clipped by studio constraints.
- Given list and section cards, when migrated, then element semantics, labels, ids, and keyboard handlers remain intact.

## Implementation Notes

The user approved the implementation plan and single-reviewer arrangement before invocation. Context compilation and implementation run inline to honor the request for only one sub-agent, reserved for later review. Initial typecheck passes. Initial sandbox tests: 297/299 pass, with two local-listener EPERM failures; rerun outside sandbox.

Verification before review: typecheck passes; all 303 tests pass; production build succeeds. Build reports three dynamic filesystem tracing warnings in unchanged evidence/compiler files. Incremental review diff is /private/tmp/epic16-review.diff, computed against the pre-run working-tree snapshot to exclude existing work.

## Spec Change Log

## Review Triage Log

- **false — width-cap concern:** Profile and Evidence Details deliberately adopt the same full-width outer container as Jobs and Evidence, matching the approved uniform alignment goal. The removed page-specific caps are visible behavior changes, not accidental CSS loss.
- **medium — browser verification gap, resolved:** Source/SSR tests alone cannot verify CSS cascade and geometry. Added `tests/fixtures/layout-containers-browser.cjs`, which runs real primitives with globals.css inside Chromium. Equal gutters/card frames, page scrolling, and grid reflow pass at 1280, 900, 640, and 320px. Studio fills the available main area without overflowing.
- **medium — Evidence grid narrow overflow, resolved:** Chromium exposed a 290px minimum card width exceeding the 262px inner area at 320px. Capping the grid minimum with `min(100%, clamp(...))` fixes it; the fixture now passes.
- **maybe-false — live PDF interaction coverage:** The fixture verifies the studio parent constraints with representative markup; it does not exercise live PDF zoom, compilation, or the actual toolbar/scroller. Internal ResumePreview code is unchanged. No regression was found by the reviewer; a walkthrough of a real populated resume remains useful.

Independent review used one context-free GPT-6 Luna agent at high reasoning, then re-engaged the same agent for the final browser fixture and grid fix. Both passes reported no confirmed correctness defects.

## Design Notes

WorkspaceContainer owns outer spacing; pages never nest a second padded workspace. ContentCard owns the visual frame and padding while feature classes own internal grids, typography, and interaction states. Prefer explicit studio mode to exclusions based on route class names. Preserve semantic HTML through a small supported element set rather than converting every surface to a div.

## Verification

- `npm run typecheck` — zero errors, including Electron.
- `npm test` — all tests pass with local-listener permissions.
- `npm run build` — production build succeeds and checks server/client imports.
- Inspect the incremental diff against the pre-run snapshot; reviewer checks shared CSS ownership, responsive spacing, semantic preservation, and preview height constraints. Browser checks should cover narrow and desktop gutters if a browser runner is available; otherwise record that visual behavior still needs human confirmation.

## Final Verification Results

- `npm run typecheck`: pass.
- `npm test`: 303/303 pass with local-listener permissions.
- `npm run build`: pass; three existing dynamic filesystem tracing warnings in unchanged compiler/evidence files.
- `node_modules/.bin/electron tests/fixtures/layout-containers-browser.cjs`: pass, exit 0. Synthetic layout content only; no private data or model requests.
- ESLint on new primitives and tests: pass. Broader selected-file lint encounters an existing `react-hooks/set-state-in-effect` error in ResumeProfileForm; verified identical in the pre-run snapshot.
- No raw `workspace-shell` consumers remain in src. Existing staged/unstaged work is preserved. No commit or push was made because this run started with unrelated changes, including a staged PDF deletion.
