"use client";

import { useActionState } from "react";
import { deleteOpportunityAction } from "@/app/opportunities/actions";
import type { OpportunityDetails } from "@/domain/opportunities/captured-opportunities";
import { Dialog } from "@/components/common/dialog";
import { Button } from "@/components/common/button";

export function OpportunityDeleteDialog({ opportunity, open, onClose }: { opportunity: OpportunityDetails; open: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteOpportunityAction, { status: "idle" as const, summary: "" });
  return <Dialog open={open} onClose={onClose} busy={pending} title="Delete opportunity?"
    description={`Permanently delete ${opportunity.title} at ${opportunity.company} and its attached tailored resume. Your base resume stays available.`}>
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="opportunityId" value={opportunity.id} />
      <input type="hidden" name="expectedRevisionId" value={opportunity.revisionId} />
      <input type="hidden" name="confirmation" value="DELETE" />
      {state.summary ? <p role="status" className="status status-error">{state.summary}</p> : null}
      <div className="opportunity-action-row">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button type="submit" variant="danger" isLoading={pending}>{pending ? "Deleting…" : "Delete opportunity"}</Button>
      </div>
    </form>
  </Dialog>;
}
