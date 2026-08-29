"use client";

import { useActionState, useState } from "react";
import { resumeWorkspaceAction, type WorkspaceActionState } from "@/app/actions";

type Workspace = { id: string; name: string; journey?: { phase: string; message: string } };
const journeyLabel = (workspace: Workspace) => ({ onboarding: "Needs profile", documenting: "Preparing evidence", interview: "Coach questions", ready_to_generate: "Ready to generate", ready_for_preview: "Resume ready", recovery: "Needs attention" }[workspace.journey?.phase ?? "onboarding"] ?? "Needs attention");
const initial: WorkspaceActionState = { status: "idle", summary: "Choose or create a separate resume workspace." };
export function ResumeWorkspacePicker({ workspaces, activeWorkspaceId, revisionNumber }: { workspaces: Workspace[]; activeWorkspaceId?: string; revisionNumber: number }) {
  const [state, action, pending] = useActionState(resumeWorkspaceAction, initial); const [deleting, setDeleting] = useState(false);
  const freshSession = !activeWorkspaceId && workspaces.length > 0;
  return <section className="resume-workspace-picker panel" aria-labelledby="resume-workspace-heading"><div><p className="eyebrow">Resume workspace</p><h2 id="resume-workspace-heading">{workspaces.find((item) => item.id === activeWorkspaceId)?.name ?? (freshSession ? "Choose a resume" : "Start a resume")}</h2>{!workspaces.length ? <p>Start with your basic information. You will then add one local project or evidence folder for review.</p> : null}</div>
    {workspaces.length ? <form action={action}><input type="hidden" name="workspaceCommand" value="select" /><input type="hidden" name="expectedRevisionNumber" value={revisionNumber} /><label htmlFor="resume-workspace-select">{freshSession ? "Choose a saved resume" : "Switch resume"}</label><select id="resume-workspace-select" name="workspaceId" defaultValue={activeWorkspaceId ?? workspaces[0]?.id}>{workspaces.map((item) => <option value={item.id} key={item.id}>{item.name} — {journeyLabel(item)}</option>)}</select><button type="submit" disabled={pending}>{freshSession ? "Open resume" : "Switch"}</button></form> : null}
    <form action={action}><input type="hidden" name="workspaceCommand" value="create" /><input type="hidden" name="expectedRevisionNumber" value={revisionNumber} /><label htmlFor="resume-workspace-name">{workspaces.length ? "New resume name" : "Resume name"}</label><input id="resume-workspace-name" name="name" required maxLength={120} /><button className="affirmative-action" type="submit" disabled={pending}>{workspaces.length ? "Add a new resume" : "Continue with basic information"}</button></form>
    {activeWorkspaceId ? <div><button type="button" className="danger-action" onClick={() => setDeleting((value) => !value)}>Permanently delete this resume</button>{deleting ? <form action={action}><input type="hidden" name="workspaceCommand" value="delete" /><input type="hidden" name="workspaceId" value={activeWorkspaceId} /><input type="hidden" name="expectedRevisionNumber" value={revisionNumber} /><label htmlFor="delete-resume-confirmation">Type DELETE to permanently remove this resume and its private workspace data.</label><input id="delete-resume-confirmation" name="confirmation" required /><button className="danger-action" type="submit" disabled={pending}>Confirm permanent deletion</button></form> : null}</div> : null}
    <p role="status" aria-live="polite" className={state.status === "error" ? "status status-error" : "status"}>{state.summary}{state.safeNextAction ? ` ${state.safeNextAction}` : ""}</p>
  </section>;
}
