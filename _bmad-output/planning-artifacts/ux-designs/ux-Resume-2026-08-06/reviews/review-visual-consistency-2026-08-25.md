# Visual Consistency Review — 2026-08-25

## Scope

Reference visual: [Jobs Browse](../mockups/key-jobs-browse.html). This review assesses visual consistency only; it does not reinstate its automated-retrieval or listing-feed behavior.

## What is already consistent

- The deep muted-forest application shell, compact brand mark, light low-glare canvas, and calm green affirmative action recur across Jobs, Resume, Experience & Projects, and Settings.
- Pages use the same system-font voice, thin green-grey borders, rounded task surfaces, visible green focus rings, and wide desktop reading canvas.
- Mobile treatments consistently reduce gutters to 16–18px, stack dense layouts, and reduce primary navigation to the active destination.
- The copy remains product-facing and local-first rather than exposing technical identifiers or database language.

## Required alignment decisions

| Area | Reference standard from Jobs Browse | Drift to resolve in future screens |
|---|---|---|
| Shell | 70px `#14382A` top bar, 26px bordered mark, understated local-status utility, active nav underline | Other mocks use near-equivalent but different `#173B2D` headers, 25px solid marks, and 68px bars. Adopt the Jobs Browse values exactly. |
| Core tokens | `#F5F7F3` canvas, `#FFFFFF` paper, `#EDF3EE` soft surface, `#17372B` ink, `#D6E1D8` line, `#2F7058` action | Near-match color substitutions make pages look related but not like one system. The final spine must define the Browse values as canonical. |
| Hierarchy | 31px page title, 15px body, 13px eyebrow/meta, 24px desktop gutters | Settings and other pages vary in max width and title scale. Narrow reading pages may constrain content, but must retain the same typography and gutters. |
| Surfaces | 10px controls, 12px bounded capture region, 15px prominent task surface, one soft forest-tinted shadow | Generic 14px panels and shadow-free forms dilute the selected polished-workspace character. |
| Jobs behavior | Browse mock supplies the composition language: header, page head, tabs, strong primary action, one prominent bounded work surface, then quiet records | Manual Opportunity Library keeps this composition but substitutes capture/review/saved records for search-result retrieval. It must not look like a generic two-column form or a job-board feed. |
| Naming | `Jobs`, `Resume`, `Settings`; Jobs subviews `All opportunities` and `Applied` | Retire visual labels and links that say `Browse`, `job results`, `Refresh`, `Source`, or `Listing` in forward mockups. |

## Reconciliation

- `key-jobs-browse.html` is the canonical visual reference for every forward screen.
- Its search-result content model is not canonical. Manual capture, immutable review, local records, and explicit external handoff remain the product behavior.
- Existing Resume, Applied, Experience & Projects, Settings, and Job Detail mocks should be revised only after this shared shell and component grammar is applied. No additional screen mockups are needed before that consistency pass.

## Implementation checklist for the next visual pass

1. Extract the reference shell and token values into shared CSS variables/components.
2. Apply the reference header, page-head, tab, primary-action, and surface metrics across every existing page.
3. Replace retrieval-specific Jobs copy with capture/library copy without changing the visual composition.
4. Re-check 320px reflow, keyboard focus, and visible status treatment after the shared visual pass.
