"use client";

import { useActionState } from "react";
import { localModelSettingsAction, type WorkspaceActionState } from "@/app/actions";

const initial: WorkspaceActionState = { status: "idle", summary: "" };

export function LocalModelSettings({ ready }: { ready: boolean }) {
  const [state, action, pending] = useActionState(localModelSettingsAction, initial);
  return <section className="panel local-model-settings" aria-labelledby="local-model-settings-heading">
    <p className="eyebrow">Local AI</p><h1 id="local-model-settings-heading">Set up local AI</h1>
    <p>Connect a loaded Qwen3.5-9B model in LM Studio on this computer. This loopback-only connection does not use an API token.</p>
    {ready ? <p className="status" role="status">Local AI is ready.</p> : <p className="status" role="status">Local AI is not ready yet. Your profile and Resume template remain local and available.</p>}
    <form action={action} aria-busy={pending}>
      <label htmlFor="local-model-identifier">Loaded model identifier</label>
      <input id="local-model-identifier" name="modelIdentifier" autoComplete="off" required maxLength={240} aria-describedby="local-model-help" />
      <p id="local-model-help" className="field-help">Choose the exact identifier for a loaded Qwen3.5-9B model from LM Studio.</p>
      <button className="affirmative-action" type="submit" disabled={pending}>{pending ? "Verifying local AI..." : "Verify and save local AI"}</button>
      {pending ? <p role="status" aria-live="polite">Checking the loaded local model.</p> : null}
    </form>
    {state.status !== "idle" ? <div className={state.status === "error" ? "status status-error" : "status"} role="status" aria-live="polite" aria-atomic="true"><p>{state.summary}</p>{state.safeNextAction ? <p>{state.safeNextAction}</p> : null}</div> : null}
  </section>;
}
