"use client";

import { useActionState } from "react";

import {
  initializeWorkspaceAction,
  type WorkspaceActionState,
} from "@/app/actions";

const initialState: WorkspaceActionState = {
  status: "idle",
  summary: "Initialize the private local workspace to begin.",
};

export function WorkspaceStatus() {
  const [state, action, pending] = useActionState(
    initializeWorkspaceAction,
    initialState,
  );

  return (
    <section aria-labelledby="workspace-status-heading" className="panel">
      <h2 id="workspace-status-heading">Workspace setup</h2>
      <p
        className={state.status === "error" ? "status status-error" : "status"}
        role="status"
        aria-live="polite"
      >
        {state.summary}
      </p>
      {state.safeNextAction ? (
        <p>
          <strong>Safe next action:</strong> {state.safeNextAction}
        </p>
      ) : null}
      <form action={action}>
        <button type="submit" disabled={pending}>
          {pending ? "Initializing…" : "Initialize local workspace"}
        </button>
      </form>
    </section>
  );
}
