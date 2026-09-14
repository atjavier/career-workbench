"use client";

import Link from "next/link";
import { useActionState } from "react";

import { generateEditableTexDraftAction, type EditableTexDraftActionState } from "@/app/actions";

const initial: EditableTexDraftActionState = { status: "idle", summary: "" };

/** Explicit local-AI consent, name entry, and private revision review links. */
export function EditableTexDraft({
  workspaceId,
  latestRevisionId,
}: {
  workspaceId: string;
  latestRevisionId?: string;
}) {
  const [state, action, pending] = useActionState(
    generateEditableTexDraftAction,
    initial,
  );
  const revisionId = state.revisionId ?? latestRevisionId;

  return (
    <section
      className="material-draft-actions editable-tex-card"
      aria-labelledby="editable-tex-heading"
    >
      <div className="editable-tex-head">
        <h3 id="editable-tex-heading">Editable TeX draft</h3>
        <p className="editable-tex-caption">
          Create a separately named, private TeX revision from the immutable template and every approved documented artifact.
        </p>
      </div>
      <form action={action} aria-busy={pending} className="editable-tex-form">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <div className="editable-tex-field">
          <label htmlFor="editable-tex-name" className="editable-tex-label">
            Draft name
          </label>
          <input
            id="editable-tex-name"
            name="displayName"
            required
            maxLength={120}
            placeholder="e.g. Platform role variant"
            className="editable-tex-input"
          />
        </div>
        <div className="editable-tex-consent">
          <label className="editable-tex-checkbox-label">
            <input
              type="checkbox"
              name="consent"
              value="yes"
              required
              className="editable-tex-checkbox"
            />
            <span>
              I consent to send the complete template and approved artifacts to my loopback-only local AI.
            </span>
          </label>
        </div>
        <div className="editable-tex-button-row">
          <button type="submit" disabled={pending} className="affirmative-action">
            {pending ? "Creating editable draft…" : "Create editable TeX draft"}
          </button>
          {revisionId ? (
            <div className="editable-tex-links">
              <Link
                href={`/api/tex-drafts/${revisionId}/pdf`}
                target="_blank"
                className="editable-tex-link"
              >
                Review PDF
              </Link>
              <span aria-hidden="true" className="editable-tex-link-sep">
                {" · "}
              </span>
              <a
                href={`/api/tex-drafts/${revisionId}/tex`}
                className="editable-tex-link"
              >
                Download TeX
              </a>
            </div>
          ) : null}
        </div>
      </form>
      {state.status !== "idle" ? (
        <p
          className={
            state.status === "error" ? "status status-error" : "status"
          }
          role="status"
          aria-live="polite"
        >
          {state.summary}
        </p>
      ) : null}
      {state.safeNextAction ? (
        <p className="editable-tex-next-action">
          <strong>Safe next action:</strong> {state.safeNextAction}
        </p>
      ) : null}
    </section>
  );
}
