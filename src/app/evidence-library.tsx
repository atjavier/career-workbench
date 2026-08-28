"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import { chooseLocalEvidenceFolderAction, evidenceAction, evidenceLibraryAction, type FolderPickerActionState, type WorkspaceActionState } from "@/app/actions";
import type { ExperienceProjectCollection } from "@/domain/evidence/evidence-library";

const initial: WorkspaceActionState = { status: "idle", summary: "Choose a local folder and document it with your configured local AI." };
const pickerInitial: FolderPickerActionState = { status: "idle", summary: "Choose a local folder." };
const findingLabel = { unreviewed: "Ready to use", approved: "Ready to use", rejected: "Not using", removed: "Removed" } as const;
const categoryLabel = { project: "Project", experience: "Experience" } as const;

export function EvidenceLibrary({ collection, error }: { collection: ExperienceProjectCollection[]; error?: { summary: string; safeNextAction: string } }) {
  const [category, setCategory] = useState<"project" | "experience">("project");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const [state, action, pending] = useActionState(evidenceLibraryAction, initial);
  const [, findingAction, findingPending] = useActionState(evidenceAction, initial);
  const [pickerState, pickerAction, pickerPending] = useActionState(chooseLocalEvidenceFolderAction, pickerInitial);
  const [selectionMessage, setSelectionMessage] = useState("Choose a local folder to inspect.");
  const selectedFolder = pickerState.folderPath ? { path: pickerState.folderPath, name: pickerState.folderName ?? "Local folder" } : undefined;
  const selected = collection.filter((item) => item.category === category);
  const label = categoryLabel[category];

  const submitDocumentation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFolder) {
      setSelectionMessage("Choose a local folder before documenting it.");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("sourceDirectory", selectedFolder.path);
    startTransition(() => action(form));
  };

  return <section className="experience-projects-collection" aria-labelledby="experience-projects-heading">
    <div className="experience-projects-intro"><p className="eyebrow">Your work</p><h2 id="experience-projects-heading">Projects and experiences</h2><p>Give your local AI one real working folder. It reads a bounded, allowlisted local snapshot directly, returns proposed documents, and never changes the source.</p></div>
    <div className="experience-project-tabs" role="tablist" aria-label="Work type">
      <button id="projects-tab" type="button" role="tab" aria-selected={category === "project"} aria-controls="work-type-panel" onClick={() => { setCategory("project"); setOpen(false); }}>Projects</button>
      <button id="experiences-tab" type="button" role="tab" aria-selected={category === "experience"} aria-controls="work-type-panel" onClick={() => { setCategory("experience"); setOpen(false); }}>Experiences</button>
    </div>
    <section id="work-type-panel" role="tabpanel" aria-labelledby={category === "project" ? "projects-tab" : "experiences-tab"}>
      <div className="experience-project-actions"><button type="button" className="affirmative-action" onClick={() => setOpen((value) => !value)}>{category === "project" ? "Document project folder" : "Document experience folder"}</button><p>One consented local-AI documentation run makes source-grounded findings available to Resume Coach.</p></div>
      {open ? <section className="documentation-handoff panel" aria-labelledby="documentation-handoff-heading">
        <h3 id="documentation-handoff-heading">Document this {label.toLowerCase()}</h3>
        <p>The selected folder may contain source code, tests, docs, manifests, configuration, assets, and generated material. It is not uploaded. The agent performs a bounded local inspection, writes no source files, and keeps unsupported content as unknown.</p>
        <p>It creates <code>{category === "project" ? "project-overview.md" : "experience-overview.md"}</code>, <code>resume-evidence.md</code>, and <code>resume-bullet-candidates.md</code>. Every current documented finding is used automatically when Resume Coach creates a draft; there is no separate material-selection step.</p>
        <form onSubmit={submitDocumentation} className="generated-document-import">
          <input type="hidden" name="libraryCommand" value="document-source-folder" /><input type="hidden" name="category" value={category} />
          <label htmlFor="documented-item-name">{label} name</label><input id="documented-item-name" name="itemName" required aria-invalid={state.status === "error"} aria-describedby="documentation-status" />
          <span>Local folder</span><div className="local-folder-input" aria-label="Local folder selector"><span>{selectedFolder?.name ?? "No folder selected"}</span><button type="button" onClick={() => startTransition(() => pickerAction())} disabled={pickerPending}>{pickerPending ? "Opening..." : "Browse"}</button></div>
          <p id="folder-selection-status" role="status" aria-live="polite" aria-atomic="true" className={pickerState.status === "error" || (!selectedFolder && selectionMessage.startsWith("Choose a local folder before")) ? "status status-error" : "status"}>{pickerState.status === "error" ? pickerState.summary : selectedFolder ? `${selectedFolder.name} selected. Its path is used only for this local inspection and is not retained.` : selectionMessage}</p>
          <label><input type="checkbox" name="localModelDisclosure" value="yes" required /> I confirm this folder may be inspected by my configured local AI.</label>
          <button type="submit" disabled={pending}>Document folder</button>
        </form>
      </section> : null}
      <p id="documentation-status" role="status" aria-live="polite" aria-atomic="true" className={state.status === "error" ? "status status-error" : "status"}>{state.summary}{state.safeNextAction ? <> <strong>Safe next action:</strong> {state.safeNextAction}</> : null}</p>
      {error ? <p className="status status-error" role="status">{error.summary} <strong>Safe next action:</strong> {error.safeNextAction}</p> : null}
      {!selected.length ? <div className="collection-empty"><h3>No documented {label.toLowerCase()}s yet</h3><p>Start one local documentation run above.</p></div> : <ul className="experience-project-list">{selected.map((item) => {
        const key = `${item.category}-${item.name}`;
        const detailsOpen = expanded === key;
        return <li key={key} className="experience-project-row"><div><h3>{item.name}</h3><p>{item.summary}</p><p className="collection-meta">{item.artifactNames.length} documentation files · {item.evidence.length} documented finding{item.evidence.length === 1 ? "" : "s"} · Ready to use</p></div><button type="button" className="neutral-action" aria-expanded={detailsOpen} aria-controls={`${key}-details`} onClick={() => setExpanded(detailsOpen ? undefined : key)}>View details</button><button type="button" className="danger-action" onClick={() => setDeleting(deleting === key ? undefined : key)}>Delete {item.category}</button>{deleting === key ? <form action={action} className="documented-item-delete"><input type="hidden" name="libraryCommand" value="delete-documented-item" /><input type="hidden" name="category" value={item.category} /><input type="hidden" name="itemName" value={item.name} /><label htmlFor={`${key}-delete-confirmation`}>Type DELETE to permanently remove this {item.category}, its managed documentation, and its documented findings. Your original folder is not changed.</label><input id={`${key}-delete-confirmation`} name="confirmation" required /><button className="danger-action" type="submit" disabled={pending}>Confirm permanent deletion</button></form> : null}{detailsOpen ? <div id={`${key}-details`} className="experience-project-details"><p>Documentation set: {item.artifactNames.join(", ")}.</p>{item.evidence.length ? <ul>{item.evidence.map((evidence) => <li key={evidence.reviewHandle}><p>{evidence.factualText}</p><p>{findingLabel[evidence.reviewState]}</p><form action={findingAction}><input type="hidden" name="reviewHandle" value={evidence.reviewHandle} /><button className="danger-action" type="submit" name="evidenceCommand" value="remove" disabled={findingPending}>Remove finding</button></form></li>)}</ul> : <p>No supported findings were returned.</p>}</div> : null}</li>;
      })}</ul>}
    </section>
  </section>;
}
