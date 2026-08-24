"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { opportunityCaptureAction, opportunityConfirmationAction, type OpportunityCaptureActionState, type OpportunityConfirmationActionState } from "@/app/actions";

const initial: OpportunityCaptureActionState = { status: "idle", summary: "Paste the page link and copied description when you are ready." };

export function OpportunityCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState(opportunityCaptureAction, initial);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const postingUrlRef = useRef<HTMLInputElement>(null);
  const confirmationPendingRef = useRef(false);
  const [captureStateAtSubmission, setCaptureStateAtSubmission] = useState<OpportunityCaptureActionState | null>(null);
  const [postingUrl, setPostingUrl] = useState("");
  const [copiedDescription, setCopiedDescription] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const urlError = state.fieldErrors?.postingUrl;
  const descriptionError = state.fieldErrors?.copiedDescription;
  const draftIsCurrent = Boolean(state.draft && state.submittedPostingUrl === postingUrl && state.submittedCopiedDescription === copiedDescription);
  const setConfirmationStatus = (value: boolean) => { confirmationPendingRef.current = value; setConfirmationPending(value); };
  const lockCaptureSubmission = () => setCaptureStateAtSubmission(state);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) { dialog.showModal(); requestAnimationFrame(() => postingUrlRef.current?.focus()); }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  const captureActionLocked = captureStateAtSubmission === state;
  const formPending = pending || confirmationPending || captureActionLocked;

  return <dialog ref={dialogRef} id="opportunity-capture" className="opportunity-capture" aria-labelledby="opportunity-capture-heading" aria-describedby="opportunity-capture-description" onCancel={(event) => { if (formPending || confirmationPendingRef.current || captureActionLocked) event.preventDefault(); }} onClose={onClose}>
    <header className="opportunity-capture-intro"><div><h2 id="opportunity-capture-heading">Add an opportunity</h2><p id="opportunity-capture-description">Paste the page link and the job description you copied. We do not open the link. Both inputs stay in this private workspace for your review.</p></div><div className="opportunity-capture-utilities"><span className="capture-local-status">Local draft</span><form method="dialog" className="opportunity-capture-dismiss"><button type="submit" className="neutral-action" disabled={formPending}>Close</button></form></div></header>
    <form action={action} className="opportunity-capture-form" noValidate onSubmit={lockCaptureSubmission}>
      <div className="opportunity-capture-fields">
        <div><label htmlFor="opportunity-posting-url">Original posting URL</label><p id="opportunity-posting-url-help" className="field-help">Use the HTTPS link for attribution. The app will not open it.</p><input ref={postingUrlRef} id="opportunity-posting-url" name="postingUrl" type="url" inputMode="url" autoComplete="url" value={postingUrl} onChange={(event) => setPostingUrl(event.target.value)} disabled={formPending} aria-invalid={urlError ? true : undefined} aria-describedby={urlError ? "opportunity-posting-url-error" : "opportunity-posting-url-help"} />{urlError ? <p id="opportunity-posting-url-error" className="field-error">{urlError}</p> : null}</div>
        <div><label htmlFor="opportunity-copied-description">Copied role details</label><p id="opportunity-copied-description-help" className="field-help">Paste at least 80 characters of the role details you chose to copy.</p><textarea id="opportunity-copied-description" name="copiedDescription" rows={6} value={copiedDescription} onChange={(event) => setCopiedDescription(event.target.value)} disabled={formPending} aria-invalid={descriptionError ? true : undefined} aria-describedby={descriptionError ? "opportunity-copied-description-error" : "opportunity-copied-description-help"} />{descriptionError ? <p id="opportunity-copied-description-error" className="field-error">{descriptionError}</p> : null}</div>
      </div>
      <button className="affirmative-action" type="submit" disabled={formPending}>{pending ? "Preparing local review…" : "Review capture"}</button>
    </form>
    <p className={state.status === "error" ? "status status-error" : "status"} role="status" aria-live="polite"><strong>{state.summary}</strong>{state.safeNextAction ? <> <strong>Safe next action:</strong> {state.safeNextAction}</> : null}</p>
    {draftIsCurrent && state.draft ? <OpportunityConfirmation draft={state.draft} onPendingChange={setConfirmationStatus} /> : null}
  </dialog>;
}

function OpportunityConfirmation({ draft, onPendingChange }: { draft: NonNullable<OpportunityCaptureActionState["draft"]>; onPendingChange: (pending: boolean) => void }) {
  const initialConfirmation: OpportunityConfirmationActionState = { status: "idle", summary: "Review or correct the details, then explicitly save this local opportunity." };
  const [state, action, pending] = useActionState(opportunityConfirmationAction, initialConfirmation);
  const error = (field: keyof NonNullable<OpportunityConfirmationActionState["fieldErrors"]>) => state.fieldErrors?.[field];
  const saved = state.status === "success";
  useEffect(() => { onPendingChange(pending); return () => onPendingChange(false); }, [onPendingChange, pending]);
  const field = (name: "title" | "company" | "location" | "workStyle" | "requirements" | "postedAt", label: string, value: string, multiline = false) => <div className="opportunity-confirmation-field"><label htmlFor={`opportunity-${name}`}>{label}</label>{multiline ? <textarea id={`opportunity-${name}`} name={name} rows={4} defaultValue={value} disabled={pending || saved} aria-invalid={error(name) ? true : undefined} aria-describedby={error(name) ? `opportunity-${name}-error` : undefined} /> : <input id={`opportunity-${name}`} name={name} type="text" defaultValue={value} disabled={pending || saved} aria-invalid={error(name) ? true : undefined} aria-describedby={error(name) ? `opportunity-${name}-error` : undefined} />}{error(name) ? <p id={`opportunity-${name}-error`} className="field-error">{error(name)}</p> : null}</div>;
  return <section className="opportunity-capture-draft opportunity-confirmation" aria-labelledby="opportunity-capture-draft-heading"><h4 id="opportunity-capture-draft-heading">Review capture</h4><p>Nothing is saved yet. The original page is attribution only. This record stays local; the app does not open the link or submit anything to an employer.</p><dl><div><dt>Original URL</dt><dd>{draft.postingUrl}</dd></div><div><dt>Captured</dt><dd>{new Date(draft.capturedAt).toLocaleString()}</dd></div></dl><form action={action} className="opportunity-confirmation-form" noValidate onSubmit={() => onPendingChange(true)}><input type="hidden" name="postingUrl" value={draft.postingUrl} /><input type="hidden" name="copiedDescription" value={draft.copiedDescription} /><div className="opportunity-confirmation-fields">{field("title", "Title", draft.title)}{field("company", "Company", draft.company)}{field("location", "Location", draft.location)}{field("workStyle", "Work style", draft.workStyle)}{field("requirements", "Requirements", draft.requirements.join("\n"), true)}{field("postedAt", "Posted date", draft.postedAt === "Unknown" ? "Unknown" : draft.postedAt.slice(0, 10))}</div><button className="affirmative-action" type="submit" disabled={pending || saved}>{pending ? "Saving opportunity…" : saved ? "Opportunity saved" : "Confirm and save opportunity"}</button></form><p className={state.status === "error" ? "status status-error" : "status"} role="status" aria-live="polite"><strong>{state.summary}</strong>{state.safeNextAction ? <> <strong>Safe next action:</strong> {state.safeNextAction}</> : null}{state.status === "success" && state.probableDuplicate ? <> A similar saved opportunity was found locally; both records remain separate.</> : null}{state.status === "success" ? <> <a href="#job-listings">Return to All opportunities</a></> : null}</p></section>;
}
