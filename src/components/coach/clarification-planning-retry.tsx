"use client";

import { useActionState } from "react";
import Link from "next/link";
import { retryClarificationPlanningAction, type WorkspaceActionState } from "@/app/actions";
import { Button } from "@/components/common/button";

const initial: WorkspaceActionState = { status: "idle", summary: "" };

export function ClarificationPlanningRetry({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(retryClarificationPlanningAction, initial);
  return <form action={action} aria-busy={pending}>
    <input type="hidden" name="workspaceId" value={workspaceId} />
    <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Reading evidence…" : "Read evidence again"}</Button>
    {pending ? <p role="status">Preparing questions from your saved evidence.</p> : null}
    {state.summary ? <p role={state.status === "error" ? "alert" : "status"}>{state.summary} {state.safeNextAction} {state.status === "success" ? <Link href="/resume/interview">Continue to questions</Link> : null}</p> : null}
  </form>;
}
