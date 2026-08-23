"use client";

import { useActionState, useState } from "react";

import { importBaseResumeAction, type WorkspaceActionState } from "@/app/actions";

const initialState: WorkspaceActionState = { status: "idle", summary: "Select a .tex resume and supported companion files to import." };

export function BaseResumeImporter() {
  const [state, action, pending] = useActionState(importBaseResumeAction, initialState);
  const [filenames, setFilenames] = useState<string[]>([]);
  return (
    <section aria-labelledby="base-resume-import-heading" className="panel">
      <h3 id="base-resume-import-heading">Import Base Resume</h3>
      <p>Choose one .tex resume and optional .pdf, .aux, .log, .out, or .synctex.gz companion files. Imported files become read-only.</p>
      <form action={action}>
        <label htmlFor="base-resume-files">Base Resume files</label>
        <input id="base-resume-files" name="baseResumeFiles" type="file" multiple accept=".tex,.pdf,.aux,.log,.out,.synctex.gz" aria-invalid={state.status === "error"} aria-describedby={state.status === "error" ? "base-resume-import-error" : undefined} onChange={(event) => setFilenames(Array.from(event.currentTarget.files ?? []).map((file) => file.name))} />
        {filenames.length > 0 ? <p>Selected: {filenames.join(", ")}</p> : null}
        <button type="submit" disabled={pending}>{pending ? "Importing…" : "Import Base Resume"}</button>
      </form>
      <p id={state.status === "error" ? "base-resume-import-error" : undefined} className={state.status === "error" ? "status status-error" : "status"} role="status" aria-live="polite">{state.summary}</p>
      {state.safeNextAction ? <p><strong>Safe next action:</strong> {state.safeNextAction}</p> : null}
    </section>
  );
}
