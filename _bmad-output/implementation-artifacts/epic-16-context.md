# Epic 16 Context: Global Layout Container Standardization

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make the application's pages feel cohesive through reusable layout containers that own page gutters, responsive constraints, and card spacing. Developers should be able to compose a new page without copying layout CSS. This is a presentation refactor of the existing local career workbench.

## Stories

- Story 16.1: Core Layout Components
- Story 16.2: Refactor Existing Pages

## Requirements & Constraints

Jobs, Resume, Profile, and Evidence must share outer alignment and consistent card spacing. Containers accept children, an appended className, and id. All shared layout styling belongs in globals.css, with no inline layout styles. Preserve keyboard operation, accessible headings and labels, list semantics, and responsive reflow. Long source text must wrap without hiding actions. Existing local-first workflows and persisted data remain authoritative.

## Technical Decisions

Use reusable React wrappers in src/components/common/layout-containers.tsx. Keep layout ownership in shared CSS rather than scattered page-specific overrides. Preserve the existing application shell, navigation, and UI action/domain/persistence boundaries. This epic requires no database or AI changes.

## UX & Interaction Patterns

Borders and restrained surfaces group bounded tasks. Shared gutters contract on narrow screens; controls and required information remain available at 320 CSS px and magnification. Resume Preview deliberately uses a full-height studio while Evidence and Profile use scrollable pages; shared alignment must accommodate these different content behaviors.

## Cross-Story Dependencies

Story 16.2 consumes the components and CSS contract established in Story 16.1. Integrate with the dedicated Profile route introduced by Epic 15.
