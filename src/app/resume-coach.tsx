"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { materialDraftHandoffAction, resumeCoachAction, type MaterialDraftHandoffActionState, type ResumeCoachActionState } from "@/app/actions";

const initial: ResumeCoachActionState = { status: "idle", summary: "" };
const initialHandoff: MaterialDraftHandoffActionState = { status: "idle", summary: "" };

type Material = { id: string; label: string };
type Opportunity = { revisionId: string; label: string };

function CoachProposal({ response, evidenceLabels }: { response: NonNullable<ResumeCoachActionState["response"]>; evidenceLabels: string[] }) {
  return <section className="material-draft-proposal" aria-labelledby="material-draft-proposal-heading">
    <p className="eyebrow">Local AI guidance</p>
    <h3 id="material-draft-proposal-heading">Review the proposal before using it as a draft</h3>
    {response.sections.map((section) => <section key={section.heading}><h4>{section.heading}</h4><p>{section.text}</p></section>)}
    <section aria-labelledby="material-draft-claims-heading"><h4 id="material-draft-claims-heading">Grounded claims</h4><ul>{response.claims.map((claim, index) => {
      const support = [...new Set(claim.evidenceIndexes.map((evidenceIndex) => evidenceLabels[evidenceIndex]).filter((label): label is string => Boolean(label)))];
      return <li key={`${claim.text}-${index}`}><p>{claim.text}</p><p><strong>Supported by approved evidence:</strong> {support.join("; ")}</p></li>;
    })}</ul></section>
    {response.unknowns.length ? <section><h4>Unknowns to check</h4><ul>{response.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></section> : null}
  </section>;
}

export function ResumeCoach({ available, materials, opportunities }: { available: boolean; materials: Material[]; opportunities: Opportunity[] }) {
  const [state, action, pending] = useActionState(resumeCoachAction, initial);
  const [handoffState, handoffAction, handoffPending] = useActionState(materialDraftHandoffAction, initialHandoff);
  const [consentNonce, setConsentNonce] = useState("");
  const [dismissedDraftId, setDismissedDraftId] = useState<string | undefined>();
  if (!available) return <section className="resume-coach-unavailable" aria-labelledby="resume-coach-heading"><div className="resume-pane-head"><div><p className="eyebrow">Resume Coach</p><h2 id="resume-coach-heading">Resume Coach</h2></div></div><p>Local AI is not ready. You can still save your profile details.</p><Link className="affirmative-action" href="/settings">Set up local AI</Link></section>;
  const proposalVisible = Boolean(state.response && state.draftId && state.draftId !== dismissedDraftId);
  return <section className="resume-coach-unavailable" aria-labelledby="resume-coach-heading">
    <div className="resume-pane-head"><div><p className="eyebrow">Resume Coach</p><h2 id="resume-coach-heading">Resume Coach</h2></div></div>
    <p>Ask for grounded local AI guidance using your saved profile, protected Resume template, selected approved Experience &amp; Projects material, and an optional local opportunity. This is not a hiring prediction or a rendered resume.</p>
    <p className="resume-context">Before each request, LM Studio on this device (Qwen3.5-9B) receives your saved profile details, the approved material you select below, and the optional local opportunity only after you consent.</p>
    <form action={action} aria-busy={pending} onChange={(event) => { if ((event.target as HTMLElement).id !== "coach-consent") setConsentNonce(""); }}>
      <fieldset><legend>Approved material to include</legend>{materials.map((material) => <label key={material.id}><input type="checkbox" name="evidenceId" value={material.id} defaultChecked /> {material.label}</label>)}</fieldset>
      <label htmlFor="coach-opportunity">Optional local opportunity</label>
      <select id="coach-opportunity" name="opportunityRevisionId" defaultValue=""><option value="">No opportunity selected</option>{opportunities.map((opportunity) => <option key={opportunity.revisionId} value={opportunity.revisionId}>{opportunity.label}</option>)}</select>
      <label htmlFor="coach-request">What would you like to improve?</label><textarea id="coach-request" name="request" required minLength={2} maxLength={2000} />
      <input type="hidden" name="consentNonce" value={consentNonce} />
      <label><input id="coach-consent" type="checkbox" name="consent" value="yes" required checked={Boolean(consentNonce)} onChange={(event) => setConsentNonce(event.target.checked ? crypto.randomUUID() : "")} /> I consent to send this request and the selected local material to LM Studio on this computer once.</label>
      <button className="affirmative-action" type="submit" disabled={pending}>{pending ? "Asking Resume Coach..." : "Ask Resume Coach"}</button>
      {pending ? <p role="status" aria-live="polite">Resume Coach is preparing your local request.</p> : null}
    </form>
    {state.status !== "idle" ? <div role="status" aria-live="polite" aria-atomic="true" className={state.status === "error" ? "status status-error" : "status"}><p>{state.summary}</p>{state.safeNextAction ? <p>{state.safeNextAction}</p> : null}</div> : null}
    {proposalVisible ? <><CoachProposal response={state.response!} evidenceLabels={state.evidenceLabels ?? []} /><div className="material-draft-actions"><p>Your Resume template is unchanged. No resume PDF or export has been created.</p>{handoffState.status === "success" && handoffState.draftId === state.draftId ? <Link className="affirmative-action" href={`/resume/drafts/${state.draftId}`}>Review draft</Link> : <form action={handoffAction} aria-busy={handoffPending}><input type="hidden" name="draftId" value={state.draftId} /><button className="affirmative-action" type="submit" disabled={handoffPending}>{handoffPending ? "Using draft..." : "Use as draft"}</button></form>}<button type="button" onClick={() => setDismissedDraftId(state.draftId)}>Keep current</button>{handoffState.status !== "idle" ? <p role="status" aria-live="polite" aria-atomic="true" className={handoffState.status === "error" ? "status status-error" : "status"}>{handoffState.summary}</p> : null}</div></> : null}
  </section>;
}
