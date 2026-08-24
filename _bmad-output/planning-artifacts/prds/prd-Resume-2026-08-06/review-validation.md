# PRD Quality Review — Personal Job Discovery and Application Materials Tool

## Overall verdict

**Verdict: adequate, with two high-priority decision gaps.** The PRD has a clear, unusually disciplined MVP thesis: private decision support and truthful drafting, bounded by source compliance and human control. Its journeys, source rules, functional requirements, data model, error states, and exclusions consistently carry that thesis. It is not yet fully implementation-ready because two product-level definitions—how fit labels are calculated and what “eligible/worth reviewing” means for its primary success metric—are deferred too far to make delivery outcomes objectively testable.

## Decision-readiness — adequate

The PRD makes consequential choices explicitly: manual-only refresh, fail-closed source access, no autonomous application actions, immutable Base Resume, local preservation on Google failure, and zero known unsupported export claims. §11 honestly labels technology and policy choices for architecture rather than disguising them as settled requirements.

### Findings

- **[high] Fit-label policy is an unresolved product decision, not only an implementation choice (§4.4, §11.7).** The three labels are defined in qualitative terms, but the required treatment of competing evidence, thresholds for “material” versus “significant” gaps, and the effect of unknown requirements/staleness are deferred wholesale. Two implementations could give materially different labels while meeting FR-8. *Fix:* Specify a v1 decision rubric (required vs. preferred qualifications, disqualifying conditions, uncertainty handling, and user-visible confidence/freshness treatment); leave scoring mechanics to architecture.

## Substance over theater — strong

The vision is product-specific rather than generic, and every principle constrains a feature. NFRs are not boilerplate: provenance, prompting disclosure, no-training default, spend caps, source restrictions, and local edit preservation directly match the risks of this private career tool.

## Strategic coherence — adequate

The product thesis—reduce fresh-graduate job-search and tailoring effort without overstating evidence or violating source boundaries—drives the scope. The counter-metrics appropriately constrain discovery volume, material speed, and AI use.

### Findings

- **[high] The primary discovery success measure is not operationally defined (§10, SM-1).** “Judged eligible or worth reviewing” leaves the user action, sampling period, denominator, and method of recording judgment undefined. The 80% target therefore cannot reliably validate the discovery thesis or distinguish source quality from ranking quality. *Fix:* Define the in-product signal(s) and measurement window, e.g., a saved/marked-worthy action on unique listings from a completed refresh over a specified evaluation set.

- **[medium] Personal-utility success is currently non-decidable (§10, SM-4).** It defers both threshold and measurement method, so it cannot determine whether the MVP reduced effort. *Fix:* Set a lightweight baseline and four-week comparison measure, or explicitly label SM-4 as a post-MVP research metric rather than a release success metric.

## Done-ness clarity — adequate

FR-1 through FR-16 all have acceptance criteria, and the error-state table supplies useful observable outcomes for risky paths. The explicit constraints on manual refreshes, source access, provenance, exporting, and sheet idempotency are especially testable.

### Findings

- **[medium] Several cross-cutting NFRs lack a measurable completion boundary (§7.1–§7.3).** “Secure authentication,” “securely” handled tokens, “accessible contrast … consistent with WCAG 2.2 AA intent,” and edit preservation “locally” are directionally correct but allow materially different outcomes. *Fix:* Establish acceptance bounds before delivery (authentication/session policy, encryption-at-rest/key-handling expectation, a named WCAG conformance target, and persistence/recovery behavior including browser/device limits). Technical implementation can remain architecture-owned.

## Scope honesty — strong

§9 names the major tempting expansions and prohibited behaviors, while §11 and the Assumptions Index make uncertainty visible. The four assumptions round-trip correctly and the architectural decision list does not relax any non-negotiable user constraints.

## Downstream usability — strong

The glossary uses stable domain language, IDs are contiguous (FR-1–FR-16; NFR-1–NFR-14; UJ-1–UJ-4; SM-1–SM-4), and relationships in §6 are sufficient for UX, architecture, and story decomposition. All journeys name Adrian and link to their relevant feature groups.

## Shape fit — strong

This is a meaningful private-user web workflow with several decision and recovery moments, so four concise journey-led narratives are proportionate. The PRD avoids both an overbuilt persona section and a feature-backlog-only shape, while its addendum usefully keeps mechanisms out of the main contract.

## Mechanical notes

- No detected FR, NFR, journey, or metric ID gaps/duplicates; references to UJ-1–UJ-4 resolve.
- All four inline `[ASSUMPTION]` entries are represented in the Assumptions Index; no `[NOTE FOR PM]` callouts are present.
- The product uses “Google Sheets Tracker” consistently. “Fit Assessment” is a data-model term and “Fit Label” is the user-facing classification; this distinction is clear enough to retain.
