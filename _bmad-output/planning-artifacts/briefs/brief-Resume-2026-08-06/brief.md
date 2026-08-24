---
title: "Product Brief: Personal Job Discovery and Resume Tailoring Tool"
status: draft
created: 2026-08-06
updated: 2026-08-06
---

# Product Brief: Personal Job Discovery and Resume Tailoring Tool

## Executive Summary

This private web tool helps Adrian Javier run a more focused, evidence-led job search as a fresh Computer Science graduate. It turns the existing resume and documented project work into a maintained candidate profile, discovers eligible Philippines-first software-engineering opportunities, and ranks them by demonstrable fit. Rather than hiding imperfect matches, it separates strong-fit, potential-fit, and stretch roles and explains why.

For a role Adrian chooses to pursue, the tool prepares an ATS-friendly tailored resume and cover-letter draft using only supported facts from the base profile and selected job posting. Adrian reviews every document before export; the base resume is never overwritten. The tool opens the original application link and maintains the search and application record in Adrian's Google Sheet.

The MVP optimizes for two outcomes: finding worthwhile roles faster and producing more relevant, truthful application materials. It is intentionally a personal assistant, not an autonomous applicant: job refreshes are manual and no application is submitted automatically.

It serves Adrian as a fresh Computer Science graduate pursuing junior and associate software-engineering roles, cadetships, paid training programs, and comparable entry pathways. The initial market is the Philippines, with remote work preferred, then hybrid or onsite roles in the National Capital Region; country remains configurable.

## The Problem

Entry-level software roles often require searching several changing sources, comparing vague requirements with a fragmented record of projects and experience, and repeatedly adapting application materials. The manual process makes it easy to miss fresh-graduate pathways, spend time on weak matches, lose track of deadlines and interview rounds, or use a generic resume that fails to surface relevant evidence to an applicant tracking system (ATS).

Existing job boards can return broad listings, but they do not reliably explain a candidate's evidence-based fit, preserve a single private application record across sources, or tailor materials without inventing claims. A personal tool can keep the candidate profile, job evidence, and application history together while leaving judgment and submission with Adrian.

## Product Principles

- Truth before optimization: generated material may reframe or prioritize supported evidence, never manufacture it.
- Human approval before export or application: drafts are reviewable and editable; the base resume remains intact.
- Transparent ranking: fit labels are evidence-based guidance, not predictions of hiring outcomes.
- Respect source and user boundaries: collection follows platform permissions; refreshes are user-triggered; Google access is scoped to the user's own tracker.
- ATS readability without gaming: standard structure and truthful relevant terminology improve discovery without deceptive techniques.

## The Solution

The tool presents a searchable job workspace and manually refreshes listings from company careers pages, permitted feeds, and user-configured search URLs for platforms such as JobStreet, Kalibrr, and LinkedIn. It normalizes and de-duplicates each listing, shows its freshness, and assigns a Strong fit, Potential fit, or Stretch label with matching evidence, gaps, seniority signals, and work-style/location compatibility.

For a selected listing, it produces reviewable ATS-friendly resume and cover-letter drafts from Adrian's supported evidence and the posting. After one-time Google authorization, it synchronizes job details, fit rationale, material versions, status, follow-ups, and interview rounds to Adrian's Google Sheet, then opens the original application link without submitting a form.

## Success Criteria

The first version succeeds when it materially reduces the effort to find suitable openings and produces stronger, truthful material for selected roles. Signals include:

- A manual refresh returns normalized, de-duplicated eligible jobs with source links, freshness, and a clear fit explanation.
- Adrian can identify a promising role and create reviewable tailored resume and cover-letter drafts in one workflow.
- Every generated claim is traceable to the candidate profile or selected job posting; unsupported claims are blocked or flagged.
- The Google Sheet accurately mirrors saved opportunities and application progress, including multiple interview rounds.
- Adrian judges the fit explanations and tailored materials more useful than manually searching and adapting a generic resume.

## MVP Scope

The MVP includes:

- Candidate-profile extraction from the existing resume and documented project/experience materials, with user review and edits.
- User-configurable Philippines-first searches for fresh-graduate software-engineering roles and remote/hybrid/NCR preferences.
- Manual retrieval from company careers pages, permitted feeds, and user-configured platform search URLs, with source-specific compliance controls.
- Listing normalization, de-duplication, freshness tracking, and evidence-based Strong fit / Potential fit / Stretch labels.
- Per-listing explanations of matched skills, gaps, seniority requirements, work-style/location alignment, and direct application links.
- Reviewable, ATS-friendly tailored resume and cover-letter drafts; PDF and editable-source export; base-resume preservation.
- Google OAuth connection and a Google Sheets tracker with job details, documents, status, dates, follow-ups, notes, and interview rounds.

The MVP explicitly excludes automatic application submission, scheduled/background scraping, guarantees of interview or hiring outcomes, fabricated content, and collection methods that violate a source's terms or technical controls.

## Risks, Constraints, and Open Decisions

- Job-board permissions, page formats, rate limits, and available integration methods vary and can change. Each source must be independently enabled only when a permitted access approach is available.
- A fit label can aid prioritization but cannot estimate employer acceptance. Requirements may be incomplete, stale, or inconsistent.
- ATS systems differ. Conventional formatting and relevant supported terminology improve compatibility but cannot guarantee selection or parsing behavior.
- Google Sheets and AI drafting require third-party authorization or processing. The tool must disclose this, minimize shared data, and keep credentials and candidate data private.
- The quality of tailoring depends on an accurate candidate profile and complete job posting. The user remains the final reviewer.

The PRD and architecture must resolve the first permitted source integrations and fallbacks; the candidate-profile editing and claim-provenance experience; AI provider, model, cost, and retention controls; editable-document rendering; and Google OAuth scopes, tracker ownership, and revoked-access recovery.

## Later, Not MVP

Once the personal workflow is reliable, the tool could add optional alert scheduling, broader country presets, analytics over application outcomes, reusable application-question answers, and richer employer research. These remain out of scope until the private, manual-refresh MVP proves it saves time and improves material quality.
