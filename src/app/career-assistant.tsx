"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { evidenceLibraryAction, type WorkspaceActionState } from "@/app/actions";
import type { StoredDocumenterProposal } from "@/persistence/evidence-documenter-repository";

const initial: WorkspaceActionState = { status: "idle", summary: "No folder selected. Choose a local project folder when you are ready." };
type Props = { proposals: StoredDocumenterProposal[]; error?: { summary: string; safeNextAction: string } };

export function CareerAssistant({ proposals, error }: Props) {
  const [state, action, pending] = useActionState(evidenceLibraryAction, initial);
  const [folder, setFolder] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const isError = state.status === "error" || Boolean(error);
  const message = error ? { status: "error" as const, ...error } : state;
  const selectedFolderName = folder.split(/[\\/]/).filter(Boolean).at(-1) ?? "No folder selected";
  const cancelledBeforeInspection = cancelled && state.status === "idle" && !error;

  return <section aria-labelledby="career-assistant-heading" className="panel"><h2 id="career-assistant-heading">Start with one project</h2><p>Career Assistant is a local guide for organizing project evidence. It does not verify facts, change source folders, submit applications, or make decisions for you.</p>
    <nav className="career-assistant-links" aria-label="Career Assistant starting actions"><a href="#add-project-evidence">Add project evidence</a><Link href="/evidence#evidence-heading">Review existing evidence</Link></nav>
    <section id="add-project-evidence" className="career-assistant-card" aria-labelledby="assistant-folder-heading"><h3 id="assistant-folder-heading">Add project evidence</h3><p><strong>No folder selected:</strong> choose a local project folder below. The assistant reads only after you explicitly start inspection.</p>
      <form action={action} onSubmit={() => setCancelled(false)}><input type="hidden" name="libraryCommand" value="document-for-resume" /><label htmlFor="assistant-project-folder">Selected local folder</label><input id="assistant-project-folder" name="sourceDirectory" value={folder} onChange={(event) => { setFolder(event.currentTarget.value); setCancelled(false); }} required aria-invalid={isError} aria-describedby="assistant-scope assistant-status" placeholder="Paste a local project folder" />
        <div id="assistant-scope" className="assistant-disclosure"><p><strong>Selected local folder:</strong> {selectedFolderName}.</p><p>Inspection is bounded to readable Markdown in this selected folder and its permitted subfolders. The source folder is never changed, and only the folder value you explicitly submit is inspected.</p><p>With your confirmation, the selected Markdown is processed only by your configured local LM Studio model. There is no remote fallback. Results are unreviewed proposals, not verified facts, and each needs an individual decision before separate Evidence Review.</p></div>
        <label><input type="checkbox" name="localModelDisclosure" value="yes" required /> I confirm that this selected folder&apos;s bounded Markdown may be processed by my local LM Studio model.</label>
        <button type="submit" disabled={pending}>{pending ? "Inspecting the selected local folder..." : "Inspect project for evidence"}</button> <button type="reset" className="secondary-action" disabled={pending} onClick={() => { setFolder(""); setCancelled(true); }}>Cancel</button>
      </form>
    </section>
    <p id="assistant-status" role="status" aria-live="polite" className={isError ? "status status-error" : "status"}>{cancelledBeforeInspection ? "Inspection cancelled before inspection started. No local source or evidence was changed." : state.status === "idle" && !error ? state.summary : message.summary}{!cancelledBeforeInspection && "safeNextAction" in message && message.safeNextAction ? <> <strong>Safe next action:</strong> {message.safeNextAction}</> : null}</p>
    <section className="career-assistant-recovery" aria-labelledby="assistant-recovery-heading"><h3 id="assistant-recovery-heading">If something needs attention</h3><ul><li><strong>Inaccessible folder:</strong> check the folder path and readable Markdown, then try again.</li><li><strong>No usable evidence:</strong> no proposal is created; choose another project or add clearer project notes.</li><li><strong>Partial available results:</strong> any proposals already shown remain available for individual review; no missing result is invented.</li></ul></section>
    <section aria-labelledby="assistant-proposals-heading"><h3 id="assistant-proposals-heading">Ready for your review</h3><p>Assistant output is a proposal, not verified fact. Accepting or editing creates unreviewed evidence only; complete separate <Link href="/evidence#evidence-heading">Evidence Review</Link> before using it in a resume or fit assessment.</p>
      {error ? <p className="status status-error" role="status">Proposal list is unavailable. <strong>Safe next action:</strong> {error.safeNextAction}</p> : proposals.length ? <ul className="assistant-proposal-list">{proposals.map((proposal) => <li key={proposal.id} className="career-assistant-card"><p><strong>Unverified proposal.</strong> Review the source and unknowns before deciding.</p><p>{proposal.factualText}</p><p><strong>Sources:</strong> {proposal.sourcePaths.join(", ")}.</p><p><strong>Unknowns:</strong> {proposal.unknowns.join("; ")}.</p><p><strong>Proposal state:</strong> {proposal.state === "proposed" ? "Ready for your review" : proposal.state === "accepted" ? "Accepted as unreviewed evidence" : proposal.state === "edited" ? "Edited as unreviewed evidence" : "Not using"}.</p>{proposal.state === "proposed" ? <div className="assistant-proposal-actions"><form action={action}><input type="hidden" name="libraryCommand" value="resolve-document-proposal" /><input type="hidden" name="proposalId" value={proposal.id} /><input type="hidden" name="expectedRevisionId" value={proposal.revisionId} /><input type="hidden" name="decision" value="accepted" /><button className="affirmative-action" type="submit" disabled={pending}>Accept as unreviewed evidence</button></form><form action={action}><input type="hidden" name="libraryCommand" value="resolve-document-proposal" /><input type="hidden" name="proposalId" value={proposal.id} /><input type="hidden" name="expectedRevisionId" value={proposal.revisionId} /><label htmlFor={`assistant-proposal-${proposal.id}`}>Edit proposal wording</label><textarea id={`assistant-proposal-${proposal.id}`} name="factualText" defaultValue={proposal.factualText} required /><button className="neutral-action" type="submit" name="decision" value="edited" disabled={pending}>Save edited as unreviewed evidence</button><button type="submit" className="danger-action" formNoValidate name="decision" value="rejected" disabled={pending}>Reject proposal</button></form></div> : null}</li>)}</ul> : <p>No evidence proposals are ready yet. Select one local project folder to begin.</p>}
    </section>
  </section>;
}
