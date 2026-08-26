import Link from "next/link";

import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-commands";

export function MaterialDraftReview({ draft }: { draft: MaterialDraftView }) {
  return <div className="workspace-shell material-draft-review">
    <header className="resume-page-head"><div><p className="eyebrow">Local draft review</p><h1>Review local AI guidance</h1><p>This is a read-only local projection of the saved draft. It is not approved, rendered, exported, or a hiring prediction.</p></div><Link href="/resume">Back to Resume</Link></header>
    <section className="material-draft-review-state" aria-label="Review state"><h2>Review remains downstream</h2><p>Claim approval or resolution, Material Version creation, deterministic rendering, and export are still separate downstream gates. The saved Candidate Profile, Resume template, and approved evidence stay unchanged.</p></section>
    <section className="material-draft-review-content" aria-labelledby="review-guidance-heading"><h2 id="review-guidance-heading">Guidance</h2>{draft.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3><p>{section.text}</p></section>)}</section>
    <section className="material-draft-review-content" aria-labelledby="review-claims-heading"><h2 id="review-claims-heading">Grounded claims</h2><ul>{draft.claims.map((claim, index) => <li key={`${claim.text}-${index}`}><p>{claim.text}</p><p><strong>Supported by approved evidence:</strong> {claim.evidence.join("; ")}</p></li>)}</ul></section>
    {draft.unknowns.length ? <section className="material-draft-review-content" aria-labelledby="review-unknowns-heading"><h2 id="review-unknowns-heading">Unknowns to check</h2><ul>{draft.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></section> : null}
    <section className="material-draft-review-content" aria-labelledby="review-provenance-heading"><h2 id="review-provenance-heading">Pinned local provenance</h2><dl><div><dt>Profile</dt><dd>{draft.profileLabel}</dd></div><div><dt>Resume template</dt><dd>{draft.templateLabel}</dd></div><div><dt>Selected approved evidence</dt><dd><ul>{draft.evidenceLabels.map((label) => <li key={label}>{label}</li>)}</ul></dd></div>{draft.opportunityLabel ? <div><dt>Opportunity</dt><dd>{draft.opportunityLabel}</dd></div> : null}</dl></section>
  </div>;
}
