# Application-Native Resume Architect

## Product intent

Resume Architect is a host-controlled local workflow for creating a credible,
ATS-compatible base resume from consented, workspace-owned evidence. It combines
evidence mining, candidate positioning, recruiter judgement, hiring-manager
credibility review, and resume copywriting without giving the local model the
authority to access a folder, skill file, shell, network, or arbitrary tool.

The application runs the stages. “Agents” are versioned instructions used in
bounded local-model calls; product skills in
`src/domain/resume-agent/skill-registry.ts` are application contracts, not
model-callable tools and not Codex or CLI skills.

## Host-controlled orchestration

1. **Folder Document Stage** — after explicit folder consent, the host creates a
   bounded source snapshot and documents a project or experience separately. It
   captures provenance-backed atomic facts, purpose, problem, workflow or
   users, rationale, contribution, supported outcomes, and unknowns.
2. **Curated handoff** — the host persists all evidence for provenance, but
   sends only `resume-evidence.md` and `resume-bullet-candidates.md` to later
   resume stages. Architecture, setup, deployment, source-tree, configuration,
   route, and raw-documentation material is never writer or coach input.
3. **Resume Architect / base generation** — the host provides the saved profile
   plus current workspace handoffs. The model mines evidence, selects relevant
   material, writes concise candidate-facing content, checks recruiter/ATS
   readability and claim integrity, and returns a reviewable base draft.
4. **Resume Coach / revision** — the host gives the independent coach the saved
   ordered draft and the same curated handoffs. The coach critiques clarity,
   relevance, credibility, specificity, hierarchy, and ATS readability. It may
   make a small material, user-requested, evidence-supported revision; it does
   not silently regenerate a resume merely because the Resume page is opened.

The host validates model output before persistence. Every visible Experience or
Projects bullet must correspond to supported evidence. Unsupported claims,
metrics, scope, seniority, technologies, source leakage, generic filler, and
hiring predictions are rejected rather than presented as candidate facts.

## Evidence and integrity rules

- Resume writing follows: information → evidence → positioning → relevance →
  content → optimization → validation.
- Strong verbs and qualitative outcomes are encouraged only where supported.
  Missing ownership, users, metrics, dates, results, or scope remain explicit
  unknowns; the model must not manufacture them.
- A project is described through its problem or purpose, contribution, approach,
  supported capabilities, and qualitative result—not filenames, endpoints,
  environment variables, setup instructions, or raw technical documentation.
- Skills are extracted from documented candidate evidence, never copied from a
  prospective job description.
- A workspace owns its evidence, drafts, and jobs. Deleting a workspace removes
  those owned records; the shared root `Resume.pdf` is not a workspace artifact.

## Current supported behavior

The current product supports two resume-writing modes:

- **Base resume:** onboarding or an explicit material-generation request uses
  the saved profile and all current workspace curated handoffs.
- **Supported revision:** Resume Coach critiques a saved draft and can apply a
  narrow, explicitly requested evidence-supported change.

The app does not yet expose broad intake fields for target role, market,
career objective, certifications, leadership, volunteer work, or similar
categories. It also does not silently select an opportunity or create a tailored
resume. Those are deferred workflows that require explicit user selection and
their own persisted intake contract. In their absence, generation produces a
truthful untailored base resume rather than inventing candidate positioning or
fit.

## Oboda v22 PDF contract

Generated PDFs use the TeX pipeline and follow the Oboda v22 one-page visual
and editorial hierarchy:

1. Experience
2. Education
3. Projects
4. Technical Skills

There is no generic Professional Summary. When no employment evidence exists,
Experience is omitted rather than replaced by a placeholder; Education,
Projects, and Technical Skills remain in that order. The shared root
`Resume.pdf` is preserved and never deleted as part of workspace deletion.

`resume-template.tex` and `src/domain/resume-generation/resume-tex.ts` are the
checked-in TeX authoring contract. The host escapes all profile and evidence
text before compilation. The fixed local compiler uses a private temporary
scratch directory and removes it after compilation; the durable payload is the
workspace-owned draft, not a persistent generated-PDF file. The PDF route
compiles that saved draft on demand.
