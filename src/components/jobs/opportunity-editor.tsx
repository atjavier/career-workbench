"use client";

import { useActionState } from "react";
import { updateOpportunityAction } from "@/app/opportunities/actions";
import type { OpportunityDetails } from "@/domain/opportunities/captured-opportunities";
import { OpportunityFormFields } from "./opportunity-fields";
import { Button } from "@/components/common/button";
import { ContentCard } from "@/components/common/layout-containers";

export function OpportunityEditor({ opportunity, onClose }: { opportunity: OpportunityDetails; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateOpportunityAction, { status: "idle" as const, summary: "" });
  const values = { title: opportunity.title, company: opportunity.company, location: opportunity.location, workStyle: opportunity.workStyle, postedAt: opportunity.postedAt.slice(0, 10), postingUrl: opportunity.originalUrl, requirements: opportunity.requirements.join("\n"), copiedDescription: opportunity.copiedDescription, refinedDescription: opportunity.refinedDescription ?? opportunity.copiedDescription, ...state.values };
  return <ContentCard as="section" className="opportunity-editor" aria-labelledby="opportunity-edit-title">
    <h2 id="opportunity-edit-title">Edit opportunity</h2>
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="opportunityId" value={opportunity.id} />
      <input type="hidden" name="expectedRevisionId" value={opportunity.revisionId} />
      <input type="hidden" name="capturedAt" value={opportunity.capturedAt} />
      <fieldset key={JSON.stringify(state.values)} disabled={pending} className="opportunity-form-grid">
        <input type="hidden" name="requirements" value={values.requirements} />
        <OpportunityFormFields descriptionCentered group="details" values={values} errors={state.fieldErrors} disabled={pending} />
        <details className="opportunity-form-wide"><summary>Original posting</summary><OpportunityFormFields group="source" values={values} errors={state.fieldErrors} disabled={pending} /></details>
      </fieldset>
      {state.summary ? <p role="status" className={`status status-${state.status}`}>{state.summary}</p> : null}
      <div className="opportunity-action-row">
        <Button type="submit" isLoading={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>{state.status === "success" ? "Done" : "Cancel"}</Button>
      </div>
    </form>
  </ContentCard>;
}
