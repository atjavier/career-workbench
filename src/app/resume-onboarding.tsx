"use client";

import Link from "next/link";
import { startTransition, useActionState, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { chooseLocalEvidenceFolderAction, resumeOnboardingAction, type FolderPickerActionState, type WorkspaceActionState } from "@/app/actions";

const initial: WorkspaceActionState = { status: "idle", summary: "Complete your basics and choose your local work folders." };
const pickerInitial: FolderPickerActionState = { status: "idle", summary: "Choose a local folder." };
type Work = { id: number; category: "project" | "experience"; folderPath?: string; folderName?: string };

function WorkFolderPicker({ item, onSelected }: { item: Work; onSelected: (id: number, result: FolderPickerActionState) => void }) {
  const [state, action, pending] = useActionState(chooseLocalEvidenceFolderAction, pickerInitial);
  useEffect(() => { if (state.folderPath) onSelected(item.id, state); }, [item.id, onSelected, state]);
  return <div className="local-folder-picker">
    <div className="local-folder-input" aria-label="Local folder selector"><span>{item.folderName ?? "No folder selected"}</span><button type="button" onClick={() => startTransition(() => action())} disabled={pending}>{pending ? "Opening..." : "Browse"}</button></div>
    <p role="status">{item.folderName ? `${item.folderName} selected. Its path is used only for this local inspection and is not retained.` : state.status === "error" ? state.summary : "Choose a Project or Experience folder from this computer."}</p>
  </div>;
}

export function ResumeOnboarding({ localAiReady }: { localAiReady: boolean }) {
  const [state, action, pending] = useActionState(resumeOnboardingAction, initial);
  const router = useRouter();
  const [work, setWork] = useState<Work[]>([{ id: 0, category: "project" }]);
  const [selectionMessage, setSelectionMessage] = useState<string>();
  const update = (id: number, value: Partial<Work>) => setWork((items) => items.map((item) => item.id === id ? { ...item, ...value } : item));
  const recordSelectedFolder = useCallback((id: number, result: FolderPickerActionState) => {
    if (!result.folderPath) return;
    setSelectionMessage(undefined);
    setWork((items) => items.map((item) => item.id === id ? { ...item, folderPath: result.folderPath, folderName: result.folderName } : item));
  }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (work.some((item) => !item.folderPath)) { setSelectionMessage("Choose a local folder for every Project or Experience before creating this resume."); return; }
    const data = new FormData(event.currentTarget);
    data.set("workCount", String(work.length));
    work.forEach((item, index) => { data.set(`category-${index}`, item.category); data.set(`sourceDirectory-${index}`, item.folderPath!); });
    startTransition(() => action(data));
  };
  useEffect(() => {
    if (state.status === "success" && state.workspaceId) router.replace("/resume");
  }, [router, state.status, state.workspaceId]);
  const addWork = () => setWork((items) => items.length < 12 ? [...items, { id: Math.max(...items.map((item) => item.id)) + 1, category: "project" }] : items);
  return <section className="resume-onboarding panel" aria-labelledby="resume-onboarding-heading">
    <p className="eyebrow">Start a resume</p>
    <h2 id="resume-onboarding-heading">Your basic information and local work folders</h2>
    <p>Add every Project and Experience you want to start with. The local evidence agent reads each chosen folder directly within its allowlist and safety limits. Folder paths and raw files are not retained.</p>
    {!localAiReady ? <p className="status">Set up local AI before submitting folders. <Link className="resume-coach-setup-link" href="/settings">Set up local AI</Link></p> : null}
    <form onSubmit={submit}>
      <label htmlFor="resume-name">Resume name</label>
      <input id="resume-name" name="resumeName" required maxLength={120} />
      <div className="resume-onboarding-fields">
        <label>First name<input name="firstName" required maxLength={120} /></label><label>Middle name (optional)<input name="middleName" maxLength={120} /></label><label>Last name<input name="lastName" required maxLength={120} /></label><label>Email<input name="email" type="email" required maxLength={254} /></label><label>Phone<input name="phone" required maxLength={40} /></label><label>School<input name="school" required maxLength={240} /></label><label>Degree or program<input name="program" required maxLength={240} /></label><label>Expected or graduation year<input name="graduationYear" inputMode="numeric" required maxLength={4} /></label><label>GWA (optional)<input name="gwa" maxLength={20} /></label><label>Latin honors (optional)<input name="latinHonors" maxLength={120} /></label><label>LinkedIn URL (optional)<input name="linkedInUrl" type="url" maxLength={2048} /></label><label>GitHub URL (optional)<input name="githubUrl" type="url" maxLength={2048} /></label>
      </div>
      <fieldset className="onboarding-work">
        <legend>Projects and Experiences</legend>
        {work.map((item, index) => <section key={item.id} className="onboarding-work-item">
          <div><label htmlFor={`work-category-${item.id}`}>Work type</label><select id={`work-category-${item.id}`} value={item.category} onChange={(event) => update(item.id, { category: event.target.value as Work["category"] })}><option value="project">Project</option><option value="experience">Experience</option></select></div>
          <div><label htmlFor={`work-name-${item.id}`}>Name</label><input id={`work-name-${item.id}`} name={`itemName-${index}`} required maxLength={120} /></div>
          <div><span>Local folder</span><WorkFolderPicker item={item} onSelected={recordSelectedFolder} /></div>
          {work.length > 1 ? <button type="button" className="secondary-action" onClick={() => setWork((items) => items.filter((entry) => entry.id !== item.id))}>Remove this item</button> : null}
        </section>)}
      </fieldset>
      <button type="button" className="secondary-action" onClick={addWork}>Add another Project or Experience</button>
      <label><input type="checkbox" name="localModelDisclosure" value="yes" required /> I consent to let my configured local AI inspect these folders and my saved profile to create my first resume draft.</label>
      <button className="affirmative-action" type="submit" disabled={pending || !localAiReady}>{pending ? "Saving resume..." : "Create resume from my work folders"}</button>
      <p role="status" className={selectionMessage || state.status === "error" ? "status status-error" : "status"}>{selectionMessage ?? state.summary}</p>
    </form>
  </section>;
}
