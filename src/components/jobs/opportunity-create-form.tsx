"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { createOpportunityAction } from "@/app/opportunities/actions";
import { Button } from "@/components/common/button";
import { ContentCard } from "@/components/common/layout-containers";
import { OpportunityFormFields } from "./opportunity-fields";

export function OpportunityCreateForm() {
  const [state, action, pending] = useActionState(createOpportunityAction, { status:"idle" as const, summary:"" });
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.status === "error") errorRef.current?.focus(); }, [state]);
  const captureSource = () => {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("sourceSnapshot") as HTMLInputElement).value = JSON.stringify({
      postingUrl: (form.elements.namedItem("postingUrl") as HTMLInputElement).value,
      copiedDescription: (form.elements.namedItem("copiedDescription") as HTMLTextAreaElement).value,
    });
  };
  return <ContentCard>
    <form ref={formRef} key={JSON.stringify(state.values)} action={action} aria-busy={pending} noValidate onInput={captureSource} onSubmit={captureSource}>
      <input type="hidden" name="sourceSnapshot" />
      <fieldset disabled={pending} className="opportunity-form-grid">
        <legend className="sr-only">Posting source</legend>
        <OpportunityFormFields values={state.values ?? {}} errors={state.fieldErrors} disabled={pending} mode="create" group="source" />
      </fieldset>
      {state.summary && <p ref={errorRef} role="alert" tabIndex={-1} className="status status-error">{state.summary}</p>}
      {pending && <p role="status">Reading and adding opportunity with local AI…</p>}
      <div className="opportunity-action-row">
        <Button type="submit" isLoading={pending}>{pending ? "Adding opportunity…" : "Add opportunity"}</Button>
        {!pending && <Link href="/">Cancel</Link>}
      </div>
    </form>
  </ContentCard>;
}
