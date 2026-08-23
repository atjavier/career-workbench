"use client";

import { useActionState, useState } from "react";

import { sourceRefreshAction, type WorkspaceActionState } from "@/app/actions";
import type { RefreshRunsView } from "@/domain/discovery/refresh-runs";

const initial: WorkspaceActionState = { status: "idle", summary: "Select enabled permitted sources, review the scope, then explicitly start one bounded refresh." };

export function SourceRefresh({ view, error }: { view: RefreshRunsView; error?: { summary: string; safeNextAction: string } }) {
  const [state, action, pending] = useActionState(sourceRefreshAction, initial);
  const [selected, setSelected] = useState<string[]>([]);
  const unavailable = view.eligibleSources.length === 0;
  const isError = state.status === "error" || Boolean(error);
  const describedBy = isError ? "source-refresh-status" : undefined;
  const toggle = (sourceId: string, checked: boolean) => setSelected((values) => checked ? [...values, sourceId] : values.filter((value) => value !== sourceId));
  return <section id="source-refresh" aria-labelledby="source-refresh-heading" className="panel">
    <h2 id="source-refresh-heading">Source Refresh</h2>
    <p>Refresh runs only after you explicitly select and confirm enabled permitted sources. It never schedules, polls, retries automatically, opens a browser, or changes source policy.</p>
    {unavailable ? <p className="status" role="status">No source is enabled for app retrieval. The current sources are manual-browser-only. <strong>Safe next action:</strong> Review <a href="#permitted-sources">Permitted Sources</a>, then use the normal browser page or manually import a selected listing.</p> : <form action={action}>
      <fieldset><legend>Select sources for one bounded refresh</legend>{view.eligibleSources.map((source) => <label key={source.sourceId}><input type="checkbox" name="sourceId" value={source.sourceId} checked={selected.includes(source.sourceId)} onChange={(event) => toggle(source.sourceId, event.target.checked)} aria-invalid={isError} aria-describedby={describedBy} /> {source.values.name} — {source.values.accessPath}</label>)}</fieldset>
      <label><input type="checkbox" name="confirmed" value="yes" aria-invalid={isError} aria-describedby={describedBy} /> I confirm this selected source scope.</label>
      <button type="submit" disabled={pending || selected.length === 0}>Refresh now</button>
    </form>}
    <p id="source-refresh-status" role="status" aria-live="polite" className={isError ? "status status-error" : "status"}>{pending ? "Refresh running for the selected sources. This is one bounded user-started action." : error ? error.summary : state.summary}{error?.safeNextAction || state.safeNextAction ? <> <strong>Safe next action:</strong> {error?.safeNextAction ?? state.safeNextAction}</> : null}</p>
    {view.runs.length > 0 ? <section aria-labelledby="refresh-history-heading"><h3 id="refresh-history-heading">Refresh outcomes</h3><ul>{view.runs.map((run) => <li key={run.id}><strong>{run.status}</strong> — {run.selectedSourceCount} selected source{run.selectedSourceCount === 1 ? "" : "s"}; started {new Date(run.startedAt).toLocaleString()}<ul>{run.outcomes.map((outcome) => <li key={outcome.id}><strong>{outcome.status}</strong> — {outcome.requestCount} request{outcome.requestCount === 1 ? "" : "s"}; {new Date(outcome.completedAt ?? outcome.startedAt).toLocaleString()}. {outcome.recoveryGuidance}</li>)}</ul></li>)}</ul></section> : null}
  </section>;
}
