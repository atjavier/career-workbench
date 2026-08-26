---
name: Personal Job Discovery and Application Materials Tool
description: Private, evidence-led job discovery, material review, and application tracking workspace.
status: final
sources:
  - ../../prds/prd-Resume-2026-08-06/prd.md
updated: 2026-08-26
colors:
  surface-base: '#F5F7F3'
  surface-raised: '#FFFFFF'
  surface-subtle: '#EDF3EE'
  ink-primary: '#17372B'
  ink-secondary: '#62766D'
  border: '#D6E1D8'
  header: '#14382A'
  header-foreground: '#F6F8F4'
  primary: '#2F7058'
  primary-foreground: '#FFFFFF'
  active: '#DCECE1'
  success: '#1F6B4F'
  warning: '#75620A'
  danger: '#B42318'
  focus-ring: '#126C4A'
typography:
  display: { fontFamily: 'system-ui, sans-serif', fontSize: 31px, fontWeight: '700', lineHeight: '1.2' }
  heading: { fontFamily: 'system-ui, sans-serif', fontSize: 20px, fontWeight: '650', lineHeight: '1.3' }
  body: { fontFamily: 'system-ui, sans-serif', fontSize: 15px, fontWeight: '400', lineHeight: '1.5' }
  meta: { fontFamily: 'system-ui, sans-serif', fontSize: 14px, fontWeight: '400', lineHeight: '1.4' }
rounded: { sm: 6px, md: 10px, lg: 14px }
spacing: { '1': 4px, '2': 8px, '3': 12px, '4': 16px, '5': 24px, '6': 32px }
components:
  button-primary: { background: '{colors.primary}', foreground: '{colors.primary-foreground}', radius: '{rounded.md}' }
  panel: { background: '{colors.surface-raised}', border: '{colors.border}', radius: 12px }
  application-header: { background: '{colors.header}', foreground: '{colors.header-foreground}', width: full-bleed }
  selected-tab: { background: '{colors.active}', foreground: '{colors.ink-primary}' }
---

# Personal Job Discovery and Application Materials Tool - Design Spine

Paired with `EXPERIENCE.md`; the spines win on conflict with future mocks or imports. The visual identity supports a polished, Jobs-first career workspace rather than an admin or API console.

## Brand & Style

The workspace should feel like Adrian's calm, personal career workspace: focused, grounded, useful at a glance, and trustworthy when details matter. It adopts the selected **Polished modern workspace** direction: a stronger deep-forest product shell, a compact abstract brand mark, soft message bubbles, an elevated resume-paper preview, and compact status chips. Its muted-forest visual language remains quiet rather than bright or celebratory. Jobs are the visual anchor on entry. The primary destinations are **Jobs** and **Resume**; secondary capabilities appear where they help a current task, rather than each claiming a place in the primary navigation.

The visual experience follows familiar job-discovery conventions found in established job boards: a scan-friendly results list, plain search and filters, clear application state, and a focused detail view. It borrows interaction conventions, not another product's brand, copy, or exact layout. It communicates evidence and system status plainly: a Fit Label is decision support, never a hiring prediction; a draft is not export-ready until Adrian has reviewed it; a tracker mirror never obscures the local record. Avoid debug-console presentation, raw implementation terms, API-shaped forms, unexplained database/status language, and a screen whose primary purpose is merely exposing every backend capability.

The selected Direction 2 is retained for visual context in [refined Muted Forest directions](mockups/refined-muted-forest-directions.html); this spine wins on conflict with that reference.

## Colors

Muted forest neutrals reserve saturated color for meaning and action. `{colors.surface-base}` provides a soft, low-glare canvas; `{colors.surface-raised}` is a clean working surface; `{colors.surface-subtle}` and `{colors.active}` group secondary content and selected state without visual noise. `{colors.primary}` identifies an intentional, affirmative action such as **Search**, **Save application**, **Generate draft**, **Export**, or **Retry**; it does not represent delete, revoke, discard, or another irreversible commitment. `{colors.success}`, `{colors.warning}`, and `{colors.danger}` communicate outcome states only; they are always paired with plain-language text and never carry meaning alone. Fit Labels use text plus their defined explanation; they must not imply a probability through color intensity. `{colors.primary}` `#2F6B57` with `{colors.primary-foreground}` `#FFFFFF` meets WCAG 2.2 AA for normal text. Load-bearing status pairs must likewise meet at least 4.5:1.

## Typography

System typography favors calm, fast scanning of job metadata, evidence, and version histories. `display` is for page titles only; `heading` groups an evidence or workflow section; `body` is the reading/editing default; `meta` holds timestamps, source attribution, Freshness, and provenance. Long source text and editable draft content preserve wrapping and avoid truncating material facts. Dense technical identifiers are available only through a deliberately opened detail or troubleshooting view.

## Layout & Spacing

Responsive web uses persistent primary navigation on larger screens and a labelled compact-navigation control on smaller screens. The compact control exposes the current destination, supports keyboard and Escape, restores focus to its trigger when closed, and preserves unsaved-edit protection. `{components.application-header}` runs edge-to-edge; its inner navigation may have its own responsive inset and is never constrained to the body content margin. The desktop content container may use up to 1440 CSS px and 24 CSS-px side gutters; it deliberately uses more horizontal space than the earlier compact layout. Tablet gutters are 20 CSS px and phone gutters are 16 CSS px. A Resume editing surface may use the available wide container for its paired panes; record-reading columns remain legible rather than artificially narrow.

Browse Jobs follows a familiar search-results rhythm: search and high-value filters lead; an honest result count and sorting follow; listings scan vertically; selecting one reveals job detail without turning every card into a form. At 320 CSS px and 400% zoom, Jobs and Applied use labelled record cards: title/company is the accessible record name; required fields remain visible as label/value pairs; filters, sorting, result count, statuses, and actions retain their state. No two-dimensional scrolling is allowed except an explicitly justified data region. Use `{spacing.5}` between major workflow sections, `{spacing.4}` within panels, and `{spacing.2}` for label/value pairs. Long URLs, filenames, and source text wrap or safely break without concealing material facts.

## Elevation & Depth

Borders and tonal surfaces establish grouping. The selected direction permits a single soft, low-opacity shadow around the primary workspace and the resume-paper preview, giving the product a more finished, modern depth without using floating-card clutter. Other borders remain thin and low-contrast; temporary layers such as a confirmation dialog, select menu, or mobile navigation may use slightly stronger elevation. A visible focus ring uses `{colors.focus-ring}`. Never rely on hover or elevation to expose a required action or a warning.

## Shapes

`{rounded.sm}` applies to compact controls and status markers, `{rounded.md}` to inputs, buttons, rows, and panels, and `{rounded.lg}` to dialogs. Fit Labels and skills may be compact markers but remain text-forward; decorative pills, gradients, excessive badges, and celebration treatments are out of scope.

## Components

All inspection panels use `{components.panel}`. The following visual names intentionally match `EXPERIENCE.md.Component Patterns`.

| Component | Visual specification |
|---|---|
| **Manual refresh control** | `{components.button-primary}` with an explicit verb label; adjacent source scope is readable before activation. |
| **button-primary** | Calm forest affirmative/forward commitment control using the verified AA color pair. Its unavailable state retains readable explanatory text and a reachable repair action; disabled styling never carries the reason by itself. |
| **panel** | `{components.panel}` grouping for a bounded task. It preserves heading, status, and action order at zoom and in stacked layouts; it is never hover-only. |
| **Application header** | `{components.application-header}` spans the viewport, visually separate from the content container. It uses the deep-forest shell, compact abstract brand mark, quiet destination labels, and a small account/status utility; Jobs and Resume are the only primary product destinations. |
| **Jobs sub-tab** | Plain text-labelled Browse and Applied controls. `{components.selected-tab}` marks the current view with text and non-color indication. There is no standalone Applications destination. |
| **Job search and filters** | Search-first control group with a small, high-value set of familiar filters (for example location, work style, date, or source when available), an honest result count, and a separate sort control. Advanced filters and technical source detail stay progressively disclosed. |
| **Job listing card** | Bordered, scan-friendly job-board record with job title and company as the anchor; location/work style, freshness, and a plain application state follow. The card presents one clear next step and does not expose raw normalized fields, IDs, or diagnostic data. Illustrated in [Jobs Browse mock](mockups/key-jobs-browse.html). |
| **Selected job detail** | Focused reading surface for posting details and a clear application action. **Use as resume context** opens Resume Coach with this listing explicitly selected; it is never an autonomous application or hidden AI action. Illustrated in [Job Detail mock](mockups/key-job-detail.html). |
| **Applied job record** | Compact record in Jobs > Applied that leads with role, company, application stage, next follow-up, and interview progress. The optional tracker link and Google connection/sync status are subordinate contextual utilities. Illustrated in [Applied mock](mockups/key-jobs-applied.html). |
| **Resume mini-tab** | Plain text-labelled **Edit** and **Experience & Projects** controls within Resume, using the same type scale, baseline, divider, selected underline, focus indicator, and responsive spacing on both surfaces. The latter replaces the separate Evidence Library destination and offers no online repository import. Illustrated in [Experience & Projects collection mock](mockups/key-resume-experience-projects-collection.html). |
| **Experience & Projects collection** | A compact single-column collection beneath the Resume mini-tabs. A text-labelled inner tab selects **Projects** or **Experiences**; the selected state uses the same non-color underline convention as the Resume mini-tabs. Each closed row leads with its readable name, one bounded summary line, document count, and review state. An explicit **View details** control expands the row in place; it never reveals a local path, identifier, digest, prompt, or raw parser diagnostic. |
| **Resume Coach** | The sole working interface in Resume's left pane: a calm, contained chat that asks for intent, provides employer-screening and resume-specialist guidance, and offers reviewable change proposals. It does not expose a wall of resume-section forms. Coach guidance uses a soft forest-tint message bubble; Adrian's prompt or response uses a raised neutral bubble, giving the conversation quiet structure. Visible context, data-transfer disclosure, proposal diff, Accept / Keep current controls, and opt-in action are more prominent than decorative chat styling. |
| **Local draft status chip** | Compact text-first status treatment in the Resume preview header, such as **Ready to review** or **Needs review**. It pairs wording with state and never implies that an export or employer review occurred. |
| **Experience / skill chip** | Compact rounded label for a reviewed skill, experience, or evidence category. It wraps at narrow widths and never makes eligibility depend on color. |
| **Resume editor and preview** | Desktop vertical split workspace with a clearly labelled Resume Coach pane and a clearly labelled read-only preview pane of comparable prominence. The preview sits on a soft tonal backing, while the resume document has a clean paper surface and the selected restrained shadow. The preview changes only after Adrian accepts a named Coach proposal. Visible local revision/time state, unsaved-state warning, and review acknowledgement remain close to the affected material. On narrow screens, a named review summary/warning count precedes Coach, with labelled jumps to Coach, Preview, Warnings, and Provenance; the layout then stacks without sticky content obscuring focus. Preview rendering is local and non-executing: it loads no remote assets, script, telemetry, or silent AI/cloud fallback. A safe text/failure view preserves edits if rendering is unavailable. Illustrated in [Resume Edit mock](mockups/key-resume-edit.html). |
| **Source outcome row** | Compact text-first row with a state marker, timestamp, source name, and recovery action; semantic state does not depend on color. |
| **Duplicate group** | Nested source-record treatment with a clear group boundary; retained attribution is visually subordinate but never hidden. |
| **Fit Explanation** | Sectioned panel that gives matched evidence, gaps, signals, alignment, Freshness, and posting language equal readable hierarchy; label and definition remain adjacent. |
| **Evidence review row** | Source reference and review state lead the row; extracted versus user-entered origin has text and non-color differentiation. |
| **Draft claim/provenance view** | Document content with inline, inspectable evidence and Job Listing references; warnings remain visually anchored to affected claims. |
| **Blocking claim warning** | `{colors.danger}`-supported inline plus summary treatment; alert icon/text and repair action remain visible until resolved or removed. |
| **Approval and export controls** | Disabled/unavailable presentation distinguishes unmet review requirements from a system failure; available PDF and editable-source actions identify their output. |
| **Application record editor** | Grouped form regions inside Jobs > Applied for Application Stage, notes, Follow-ups, versions, and ordered Interview Rounds; field labels remain visible. |
| **Google connection and sync status** | Subordinate context within Jobs > Applied: connection identity, last attempt, outcome, affected entity detail, tracker link, and recovery action share one stable status region. It must never imply a connected or synced state without a real user-authorized connection and outcome. |
| **Confirmation dialog** | `{rounded.lg}` temporary layer for consequential authorization, revocation, export, discard, deletion, and duplicate-override decisions; clear effect statement, local/remote data consequence, and non-destructive exit. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Make Jobs and Resume feel like focused places to complete the next career task | Turn every backend capability into a tab, card, or always-visible control |
| Use familiar job-board scanning patterns without copying another product's branding | Recreate LinkedIn, JobStreet, Bossjob, or Indeed layouts, names, or visual identity |
| Keep search, filters, result count, and a clear next action visually simple | Put raw normalized fields, record IDs, audit values, or technical states in the normal listing path |
| Pair every Fit Label with accessible, inspectable reasoning | Present a label as an interview, offer, or hiring forecast |
| Make user-initiated action and resulting status visible | Suggest refreshes, retries, submissions, or syncs happened automatically |
| Preserve source attribution, Freshness, and unknown states | Fill missing listing details with plausible-looking values |
| Keep Base Resume, approved Draft, and Material Versions visibly distinct | Make a draft edit look like it overwrote the Base Resume |
| Surface source, claim, and Sheets failures with recovery paths | Hide partial results, unsynchronized records, or blocking warnings |
| Keep unavailable controls explanatory and actionable | Use faint or disabled styling as the only reason an action cannot proceed |

## Approved Change - 2026-08-24: Manual Opportunity Capture

This change supersedes discovery-first and refresh-first visual direction. **Jobs** is Adrian's Opportunity Library: a personal collection of roles he deliberately saved, not a feed the product claims to have found. Its primary action is **Add opportunity**. The capture composition gives URL and copied posting text a clear, calm entry path; the later confirmation view makes structured fields, unknowns, and attribution easy to review without looking like an API form.

The compact Jobs views are **All opportunities** and **Applied**. Search and filters operate only on saved local opportunities. There is no Refresh control, source selector, source-outcome dashboard, permitted-source destination, browser-automation control, or implied automatic URL reading. A supplied URL is visual attribution and the explicit outbound handoff; it is not a promise that the app fetched or verified the page.

The selected polished-modern workspace system remains in force. The visual contract now applies its strongest affordance treatment to **Add opportunity**, **Review capture**, **Use as resume context**, and the Resume Coach's explicit proposal controls. Future mocks must depict capture/library states rather than discovery states.

## Approved Change - 2026-08-25: Opportunity Library Visual Frame

Jobs must no longer resemble a search-results page or feed. It is a private, deliberate library with two calm states: **capture a role Adrian found elsewhere** and **review roles he already saved**. The primary composition is a wide workspace header, one focused capture card, and a quiet saved-record region. Search and filters appear only when saved records exist; they are secondary library tools, never the visual lead.

The capture card is a bounded, progressive workflow rather than a dense form wall. Its initial stage foregrounds **Original page URL** and **Copied role details**, with local-only reassurance and one **Review capture** action. The review stage retains the card frame, adds a compact provenance strip, and presents derived fields in a readable two-column editing grid. The confirmation action anchors the lower edge of the card with its local-only consequence. Empty library state is intentionally spacious, names that no opportunities are saved, and directs attention back to **Add opportunity** without fabricated listing rows.

The canonical visual reference is [Jobs Browse mock](mockups/key-jobs-browse.html). Its shell, dimensions, type scale, token values, tabs, primary action, and surface hierarchy govern every forward page. Its retrieved-listing content does not: manual capture/review and local saved Opportunities replace that behavior.

## Approved Change - 2026-08-25: Cross-page Consistency Standard

Use the exact Jobs Browse visual grammar everywhere: the 70px deep-forest application header; its compact outlined brand mark; 31px page title; 15px body copy; 13px metadata; 24px desktop and 16px narrow-screen gutters; `#F5F7F3` canvas; `#FFFFFF` raised surface; `#EDF3EE` soft surface; `#17372B` primary ink; `#D6E1D8` divider; and `#2F7058` affirmative action. Use 10px controls, 12px bounded workflow regions, and 15px prominent task surfaces with the single restrained forest-tinted shadow. This standard supersedes approximate token, header, radius, and spacing variants in any existing mock.

## Approved Change - 2026-08-25: Opportunity Capture Dialog

**Add opportunity** opens a centered, elevated dialog rather than expanding a page-level capture card. The dialog is a focused working surface, not a shrunken page: on desktop it is 640px wide (or the available viewport minus 48px), has a 15px radius, `#F8FBF8` surface, `#C9DDD0` boundary, and the same restrained forest-tinted shadow used by key task surfaces. A low-opacity deep-forest backdrop quiets the library beneath it without making the workspace feel blocked or heavy.

The dialog header leads with **Add an opportunity**, a single short local-only reassurance, and a compact text-close control aligned at the upper right. The entry stage contains URL first, then copied role details, with a narrow vertical rhythm: 12px label-to-input grouping, 16px between fields, and an end-aligned **Review capture** action. The text area is intentionally compact at entry; the larger, editable review stage earns the extra vertical space only after Adrian chooses to review the capture. At phone widths, the dialog becomes a near-full-width sheet with 16px inset; it still retains the same raised-surface and single-column hierarchy. This change supersedes earlier capture-card placement guidance while retaining the canonical [Jobs Browse mock](mockups/key-jobs-browse.html) visual grammar.

## Approved Change - 2026-08-25: Profile-led Resume Workspace

This change supersedes every conflicting Resume editor, Current Base Resume, proposal, warning, evidence-panel, version-approval, and technical-status treatment above. Resume keeps the shared Jobs Browse visual grammar and its two mini-tabs, **Edit** and **Experience & Projects**, but Edit is reduced to the content a jobseeker needs to see.

The desktop workspace has a balanced split: **Profile & Resume Coach** on the left and **Resume template** on the right. The left pane begins with one compact, scannable profile card, not a section-by-section resume editor. It groups First Name, optional Middle Name, Last Name, email, phone number, education, GWA, optional Latin honors, and optional LinkedIn/GitHub URLs into readable personal/contact and education regions. One clear **Save details** action follows the fields. No internal record state, source count, audit term, draft revision, warning count, evidence chip, raw identifier, or developer-focused status appears in this composition.

Below the profile card, a contained **Resume Coach** conversation is the sole tailoring interface. Its default state uses one short introductory message and a single natural-language prompt. When the configured local LLM is ready, it exposes one intentional **Generate resume** action after the chat has enough context. A proposal, when present, shows concise resume wording and only **Use this version** / **Keep current** controls; provenance and detailed claim review remain outside this primary screen. The model must never be represented as editing the PDF itself.

The right pane is titled **Resume template**, with a restrained read-only label and the native PDF page view on a soft backing. It is an immutable visual reference from `Resume.pdf`, never a live mirror of profile typing or chat content. If the local LLM is unavailable, the left pane collapses to one quiet unavailable state with one **Set up local AI** action; the profile card and template preview remain readable, while chat, generation, proposal, and export controls do not appear. The unavailable state names no endpoint, token, diagnostic, or implementation detail.

At narrow widths, the profile card, Coach/unavailable state, and template preview form one named vertical sequence. Inputs remain one column; no horizontal scrolling or hidden action is permitted at 320 CSS px or 400% zoom. The design continues to use `{colors.surface-base}`, `{components.panel}`, `{components.button-primary}`, `{rounded.md}`, and the single restrained preview shadow. The canonical visual reference will be [Resume Edit mock](mockups/key-resume-edit.html); this spine wins on conflict.

## Approved Change - 2026-08-25: AI-Grounded Fit Assessment

An Opportunity detail presents **Assess fit** as one explicit local-AI action after a concise disclosure of the selected profile/evidence and captured role details. The assessment state is calm and bounded: preparing, assessing, ready, unavailable, or error. A ready Fit Explanation has equally clear sections for strengths, gaps and uncertainty, deterministic safety disclosures, approved evidence, and short captured-posting language. It says “AI guidance, not a hiring prediction” beside the assessment summary.

The normal view never shows raw IDs, digests, model diagnostics, the full copied description, or hidden reasoning. Provenance controls name Approved evidence and Captured posting excerpt. A cached matching assessment indicates that it is based on the current selected material without implying a background refresh. **Pursue** and **Priority** are clearly personal choices, visually and semantically separate from the AI guidance. **Open original page on {host}** remains an explicit outbound handoff with the existing no-prefill/no-submission explanation.

## Approved Change - 2026-08-26: Compact Experience & Projects Collection

This change supersedes earlier visual treatment that presents Experience & Projects as a generic Evidence Library, a multi-form action wall, a side review dashboard, or a Base Resume extraction surface. It preserves the polished Muted Forest tokens and Resume mini-tab grammar exactly. The active page uses the same 31px Resume title, 15px supporting copy, tab underline, `{colors.border}` divider, `{colors.surface-raised}` collection surface, `{rounded.md}` controls, and `{colors.focus-ring}` focus treatment as Resume > Edit.

The page contains one compact add control for the selected inner tab and one collection. Projects and Experiences are never visually mixed. A collection row contains a readable title, one bounded summary line, document count, and plain-language review state. Expanding a row reveals the source Markdown document names and its unreviewed/approved evidence items with their existing individual review controls. It does not expose local absolute paths, parser diagnostics, raw evidence IDs, Base Resume records, or `Resume.pdf` as an extraction source.

The add flow is a compact inline panel or one native dialog, never a parallel wall of forms. **Add project folder** and **Add experience folder** use identical control shape and feedback placement; each names that only readable Markdown in the chosen local folder will be copied, that source files remain unchanged, and that review is still required. The empty state retains one forward action for the selected inner tab. The reference composition is [Experience & Projects collection mock](mockups/key-resume-experience-projects-collection.html); this spine wins on conflict.

## Approved Change - 2026-08-26: Source-folder resume documentation

### Application-native correction (2026-08-26)

The collection actions invoke the registered local-LLM resume documentation skill after explicit consent. The page never displays a Codex prompt or developer handoff. Progress, proposed-document completion, and safe recovery use the compact Resume status treatment; private prompts, tool traces, raw paths, model diagnostics, and credentials remain hidden.

This supersedes the Markdown-folder add flow above. The selected Project or Experience folder is an actual working folder that may contain source code, tests, documentation, manifests, configuration, assets, and generated material. The page does not copy or parse that raw folder as evidence. Instead, its compact action is **Document project folder** or **Document experience folder**, which invokes the dedicated, explicitly selected-source resume-evidence documentation skill.

The skill is local, bounded, and read-only. It examines safe textual documentation, manifest, configuration, source, and test material under a declared exclusion policy; it never follows links, reads arbitrary binary/generated/dependency material, changes the source, watches it, or approves evidence. It produces three proposed/unreviewed Markdown artifacts outside the source: `project-overview.md`, `resume-evidence.md`, and `resume-bullet-candidates.md`. Those artifacts require explicit import and individual evidence approval before Resume Coach can use them.

Collection summaries derive only from the generated `project-overview.md`, not source code or an AI assertion: ignore front matter, comments, headings, blank lines, and fences; normalize one leading list marker; display the first meaningful paragraph's first sentence within 240 characters; otherwise show **No summary found yet.** Details may show generated artifact names and individual evidence review controls, never raw source paths, IDs, digests, prompts, model output, or diagnostics. `Resume.pdf` remains the immutable Resume Edit template and never appears in this flow.
