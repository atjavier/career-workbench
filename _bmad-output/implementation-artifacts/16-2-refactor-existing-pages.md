---
title: 'Refactor Existing Pages'
status: done
created: '2026-10-04'
---

# Story 16.2: Refactor Existing Pages

Migrated every raw workspace-shell consumer, including Jobs, Resume/onboarding, Profile, Evidence collection/details, interview, settings, and secondary workspaces. Primary Jobs, Evidence, and Profile cards use ContentCard. Evidence grid minimum width now fits narrow containers.

Implementation and review evidence: [Epic 16 spec](spec-16-global-layout-container-standardization.md).

Verification: typecheck, 303 tests, production build, and Chromium layout checks pass. One GPT-6 Luna reviewer at high reasoning found no confirmed defects. Live PDF interactions were not exercised by the fixture; the existing Profile effect lint error and build tracing warnings are recorded in the spec.
