"use client";

import { useActionState } from "react";
import { currentBaseResumeAction, type WorkspaceActionState } from "@/app/actions";
import type { CurrentBaseResumeDraft, CurrentBaseResumeProposal, CurrentBaseResumeVersion } from "@/persistence/current-base-resume-repository";

const initial: WorkspaceActionState = { status: "idle", summary: "Choose a text-readable PDF to create a Current Base Resume." };
type Props = { sourceCount: number; draft?: CurrentBaseResumeDraft; proposals: CurrentBaseResumeProposal[]; versions: CurrentBaseResumeVersion[]; error?: { summary: string; safeNextAction: string } };
const fields: Array<keyof CurrentBaseResumeDraft["content"]> = ["contact", "summary", "experience", "projects", "education", "skills", "other"];
export function CurrentBaseResume({ sourceCount, draft, proposals, versions, error }: Props) {
  const [state, action, pending] = useActionState(currentBaseResumeAction, initial);
  const message = error ? { status: "error" as const, ...error } : state;
  return <section aria-labelledby="current-base-resume-heading" className="panel">
    <h3 id="current-base-resume-heading">Current Base Resume</h3>
    <p>Import a text-readable PDF. The original stays unchanged; this creates a private source copy and an editable structured draft.</p>
    <form action={action}><input type="hidden" name="currentResumeCommand" value="import" /><label htmlFor="current-resume-pdf">Current Base Resume PDF</label><input id="current-resume-pdf" name="currentResumePdf" type="file" accept="application/pdf,.pdf" required aria-invalid={message.status === "error"} aria-describedby={message.status === "error" ? "current-resume-error" : undefined} /><button type="submit" disabled={pending}>Import PDF</button></form>
    <p id={message.status === "error" ? "current-resume-error" : undefined} role="status" aria-live="polite" className={message.status === "error" ? "status status-error" : "status"}>{message.summary}</p>
    {"safeNextAction" in message && message.safeNextAction ? <p><strong>Safe next action:</strong> {message.safeNextAction}</p> : null}
    {sourceCount ? <p>{sourceCount} retained PDF source {sourceCount === 1 ? "is" : "are"} available.</p> : <p>No Current Base Resume PDF has been imported yet.</p>}
    {draft ? <>
      <form action={action} className="draft-editor"><input type="hidden" name="currentResumeCommand" value="save" /><input type="hidden" name="draftId" value={draft.id} /><h4>Editable structured draft</h4>{fields.map((field) => <label key={field} htmlFor={`draft-${field}`}>{field[0].toUpperCase() + field.slice(1)}<textarea id={`draft-${field}`} name={field} defaultValue={draft.content[field].join("\n")} /></label>)}<button type="submit" disabled={pending}>Save draft revision</button></form>
      <form action={action}><input type="hidden" name="currentResumeCommand" value="propose" /><input type="hidden" name="draftId" value={draft.id} /><button type="submit" disabled={pending}>Update Base Resume from approved evidence</button></form>
      <section aria-labelledby="proposal-heading"><h4 id="proposal-heading">Proposed changes</h4>{proposals.length ? <ul>{proposals.map((proposal) => <li key={proposal.id}><p>{proposal.proposedText}</p><p>Evidence support revision: <code>{proposal.evidenceRevisionId}</code>.</p>{proposal.decision === "open" ? <form action={action}><input type="hidden" name="currentResumeCommand" value="resolve" /><input type="hidden" name="proposalId" value={proposal.id} /><input type="hidden" name="expectedDecisionRevisionId" value={proposal.decisionRevisionId} /><label htmlFor={`proposal-${proposal.id}`}>Edited wording (optional)</label><textarea id={`proposal-${proposal.id}`} name="proposalText" /><button name="decision" value="approved" type="submit">Approve</button> <button name="decision" value="edited" type="submit">Save edited</button> <button name="decision" value="rejected" type="submit">Reject</button></form> : <p>Resolved: {proposal.decision}</p>}</li>)}</ul> : <p>No proposed changes have been generated.</p>}</section>
      <form action={action}><input type="hidden" name="currentResumeCommand" value="approve-version" /><input type="hidden" name="draftId" value={draft.id} /><label><input type="checkbox" name="explicitApproval" value="yes" required /> I approve this Current Base Resume version.</label><button type="submit" disabled={pending}>Approve Current Base Resume version</button></form>
    </> : null}
    <section aria-labelledby="versions-heading"><h4 id="versions-heading">Retained Current Base Resume versions</h4>{versions.length ? <ul>{versions.map((version) => <li key={version.id}>{version.sourceFilename}, draft revision {version.draftRevisionNumber}, approved {new Date(version.approvedAt).toLocaleString()}. Evidence support revisions: {version.evidenceRevisionIds.length ? version.evidenceRevisionIds.map((id) => <code key={id}> {id}</code>) : " none"}.</li>)}</ul> : <p>No Current Base Resume version has been approved yet.</p>}</section>
  </section>;
}
