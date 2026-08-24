# Validation Report — Personal Job Discovery and Application Materials Tool

- **DESIGN.md:** `DESIGN.md`
- **EXPERIENCE.md:** `EXPERIENCE.md`
- **Run at:** 2026-08-07 (Asia/Taipei)

## Overall verdict

The initial rubric found the spine pair adequate and implementation-usable: all four PRD journeys and the manual-only, evidence-led, approval-gated, local-authoritative constraints were present. It found two medium contract gaps: missing behavioral definitions for shared visual primitives and no explicit successful-zero-results state.

The accessibility and privacy review raised three high and five medium gaps. The spines have been updated to address the actionable UX-contract gaps: Data & storage, separate AI training consent and transfer preview, a Google account/sheet/data preview, accessible status and review acknowledgement rules, focus/target/reorder requirements, and safe outbound handoff. Final retention periods, deletion mechanics, source policy, fit thresholds, export format, and Sheets conflict policy remain explicitly open release-blocking decisions; they are not treated as resolved product policy.

## Category verdicts

- Flow coverage — strong
- Token completeness — strong
- Component coverage — thin → resolved in amended spine
- State coverage — adequate → resolved in amended spine
- Visual reference coverage — strong
- Bloat & overspecification — adequate
- Inheritance discipline — adequate
- Shape fit — strong

## Findings by severity

### High (3)

**Accessibility/privacy — Data lifecycle UX missing** (§ Foundation, Data & storage)

Added a Data & storage surface and destructive-action state covering data classes, recovery copies, export/delete effects, sign-out protection, remote-Sheets consequence, and reauthentication. Retention/deletion policy remains an explicit release blocker.

**Accessibility/privacy — AI consent and minimization missing** (§ Foundation; Draft workspace)

Added a per-action data-transfer preview and a separate, recorded training/improvement opt-in that defaults off; local drafting remains available.

**Accessibility/privacy — Google authorization preview insufficient** (§ Google connection and sync status; UJ-4)

Added a review-before-connect step for account, least-privilege scope, spreadsheet/worksheet, mirrored data categories, notes defaulting local-only, and reconfirmation on material connection changes.

### Medium (7)

**Component coverage — Shared primitives lacked behavior** (§ DESIGN.md Components; EXPERIENCE.md Component Patterns)

Added behavioral contracts for `button-primary` and `panel`, including keyboard activation, unavailable-state remediation, semantic heading, and reflow rules.

**State coverage — Successful zero results missing** (§ EXPERIENCE.md State Patterns)

Added a distinct successful-refresh/filter zero-results state that preserves source outcomes and filters, without conflating it with first use or failure.

**Accessibility/privacy — Status announcements incomplete** (§ Accessibility Floor)

Added a persistent programmatic status-region rule, terminal-outcome cadence, blocking-error priority, and explicit-focus behavior.

**Accessibility/privacy — Focus, targets, and ordered rounds incomplete** (§ Accessibility Floor)

Added target-size/spacing exception, unobscured high-contrast focus, keyboard Move up/Move down controls, and dense-record reading-order requirements.

**Accessibility/privacy — Draft review completion ambiguous** (§ Approval and export controls; UJ-3)

Added an accessible review summary and explicit acknowledgement, re-required after material edits.

**Accessibility/privacy — Outbound handoff boundary unclear** (§ Interaction Primitives)

Added destination-host labeling, destination privacy boundary, no-prefill/no-transfer rule, and explicit—not inferred—return-stage recording.

**Accessibility/privacy — Disabled/status contrast underspecified** (§ DESIGN.md Components and Do's and Don'ts)

Added text-forward unavailable-control and repair-action requirements; visual contrast remains governed by the documented WCAG 2.2 AA intent.

## Low (0)

No unresolved low-severity findings.

## Reviewer files

- `review-rubric.md`
- `review-accessibility-privacy.md`
