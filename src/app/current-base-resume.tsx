"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import {
  currentBaseResumeAction,
  type WorkspaceActionState,
} from "@/app/actions";
import type { EvidenceRevision } from "@/persistence/evidence-repository";
import type {
  CurrentBaseResumeDraft,
  CurrentBaseResumeProposal,
  CurrentBaseResumeVersion,
} from "@/persistence/current-base-resume-repository";

const initial: WorkspaceActionState = {
  status: "idle",
  summary: "Choose a text-readable PDF to create a Current Base Resume.",
};
type Props = {
  sourceCount: number;
  sourceId?: string;
  originalPdfAvailable: boolean;
  draft?: CurrentBaseResumeDraft;
  proposals: CurrentBaseResumeProposal[];
  versions: CurrentBaseResumeVersion[];
  evidence: EvidenceRevision[];
  error?: { summary: string; safeNextAction: string };
};
const fields: Array<keyof CurrentBaseResumeDraft["content"]> = [
  "contact",
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
  "other",
];

function labelFor(field: string) {
  return field[0].toUpperCase() + field.slice(1);
}
function evidenceLabel(evidence: EvidenceRevision) {
  return `${evidence.sourceDocument}, ${evidence.sourceSection}`;
}

export function CurrentBaseResume({
  sourceCount,
  sourceId,
  originalPdfAvailable,
  draft,
  proposals,
  versions,
  evidence,
  error,
}: Props) {
  const [state, action, pending] = useActionState(
    currentBaseResumeAction,
    initial,
  );
  const revisionKey = draft
    ? `${draft.id}-${draft.revisionNumber}`
    : "no-draft";
  const [previewState, setPreviewState] = useState({
    revisionKey,
    content: draft?.content,
    hasUnsavedEdits: false,
  });
  const message = error ? { status: "error" as const, ...error } : state;
  const previewMatchesDraft = previewState.revisionKey === revisionKey;
  const content = previewMatchesDraft
    ? (previewState.content ?? draft?.content)
    : draft?.content;
  const hasUnsavedEdits = previewMatchesDraft && previewState.hasUnsavedEdits;
  const evidenceByRevision = new Map(evidence.map((item) => [item.id, item]));
  const openProposals = proposals.filter(
    (proposal) => proposal.decision === "open",
  );
  const originalPdfUrl =
    sourceId && originalPdfAvailable
      ? `/api/current-base-resume/${encodeURIComponent(sourceId)}/pdf`
      : undefined;

  return (
    <section
      aria-labelledby="current-base-resume-heading"
      className="current-base-resume"
    >
      <p
        id={message.status === "error" ? "current-resume-error" : undefined}
        role="status"
        aria-live="polite"
        className={
          message.status === "error" ? "status status-error" : "status"
        }
      >
        {message.summary}
      </p>
      {"safeNextAction" in message && message.safeNextAction ? (
        <p className="safe-next-action">
          <strong>Safe next action:</strong> {message.safeNextAction}
        </p>
      ) : null}

      {draft && content ? (
        <>
          <nav
            className="resume-review-jumps"
            aria-label="Resume review sections"
          >
            <a href="#resume-editor">Editor</a>
            <a href="#resume-preview">Preview</a>
            <a href="#resume-warnings">Warnings</a>
            <a href="#resume-provenance">Provenance</a>
          </nav>
          <section
            className="resume-review-summary"
            aria-labelledby="resume-review-summary-heading"
          >
            <h2 id="resume-review-summary-heading">Review summary</h2>
            <p>
              <strong>
                {openProposals.length} open warning
                {openProposals.length === 1 ? "" : "s"}
              </strong>{" "}
              need review before an approved version can be created. Previewing
              does not approve or export anything.
            </p>
          </section>
          <div className="resume-editor-preview">
            <form
              action={action}
              className="draft-editor resume-review-pane"
              id="resume-editor"
            >
              <input type="hidden" name="currentResumeCommand" value="save" />
              <input type="hidden" name="draftId" value={draft.id} />
              <div className="resume-pane-head">
                <div>
                  <h2 id="current-base-resume-heading">Manual resume review</h2>
                  <p>
                    Review your local draft and choose each change yourself.
                  </p>
                </div>
                <span className="resume-pane-chip">Coach not available</span>
              </div>
              <p className="resume-context">
                Current Base Resume · local only · evidence-backed review
              </p>
              <p className="revision-status">
                Editing local draft revision {draft.revisionNumber}.{" "}
                {hasUnsavedEdits
                  ? "Your working draft has unsaved edits; save before approving a version."
                  : "Your working draft matches the saved local revision."}{" "}
                The original PDF preview remains unchanged.
              </p>
              {fields.map((field) => (
                <label key={field} htmlFor={`draft-${field}`}>
                  {labelFor(field)}
                  <textarea
                    id={`draft-${field}`}
                    name={field}
                    value={content[field].join("\n")}
                    onChange={(event) =>
                      setPreviewState({
                        revisionKey,
                        content: {
                          ...content,
                          [field]: event.currentTarget.value.split("\n"),
                        },
                        hasUnsavedEdits: true,
                      })
                    }
                  />
                </label>
              ))}
              <button type="submit" disabled={pending}>
                Save draft revision
              </button>
            </form>
            <aside
              id="resume-preview"
              className="resume-preview resume-preview-pane"
              aria-label="Original Resume PDF preview"
              aria-labelledby="resume-preview-heading"
            >
              <div className="resume-pane-head">
                <div>
                  <h2 id="resume-preview-heading">Original PDF</h2>
                </div>
              </div>
              {originalPdfUrl ? (
                <>
                  <div className="resume-original-pdf-frame">
                    <iframe
                      className="resume-original-pdf-viewer"
                      src={originalPdfUrl}
                      title="Original, read-only Resume PDF"
                    />
                    <a
                      className="resume-original-pdf-fallback"
                      href={originalPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open original PDF
                    </a>
                  </div>
                  <p className="preview-boundary">
                    Editing this draft does not change the original PDF.
                  </p>
                </>
              ) : (
                <article className="resume-paper resume-paper-empty">
                  <h3>Original PDF unavailable</h3>
                  <p>Your editable draft is still available.</p>
                </article>
              )}
            </aside>
          </div>
          <section
            id="resume-warnings"
            className="resume-follow-up"
            aria-labelledby="proposal-heading"
          >
            <h2 id="proposal-heading">Warnings and proposed changes</h2>
            {proposals.length ? (
              <ul className="resume-proposal-list">
                {proposals.map((proposal) => {
                  const support = evidenceByRevision.get(
                    proposal.evidenceRevisionId,
                  );
                  return (
                    <li key={proposal.id}>
                      <p>{proposal.proposedText}</p>
                      <p>
                        Evidence support:{" "}
                        {support ? (
                          <>
                            {evidenceLabel(support)}.{" "}
                            {support.origin === "extracted"
                              ? "Extracted"
                              : "User-entered"}
                            .{" "}
                            <Link href={`/evidence#evidence-${support.id}`}>
                              Review this evidence
                            </Link>
                          </>
                        ) : (
                          <>
                            The evidence reference is unavailable.{" "}
                            <Link href="/evidence#evidence-heading">
                              Open Evidence Review
                            </Link>
                          </>
                        )}
                      </p>
                      {proposal.decision === "open" ? (
                        <form action={action}>
                          <input
                            type="hidden"
                            name="currentResumeCommand"
                            value="resolve"
                          />
                          <input
                            type="hidden"
                            name="proposalId"
                            value={proposal.id}
                          />
                          <input
                            type="hidden"
                            name="expectedDecisionRevisionId"
                            value={proposal.decisionRevisionId}
                          />
                          <label htmlFor={`proposal-${proposal.id}`}>
                            Edited wording (optional)
                          </label>
                          <textarea
                            id={`proposal-${proposal.id}`}
                            name="proposalText"
                          />
                          <div className="proposal-actions">
                            <button
                              className="affirmative-action"
                              name="decision"
                              value="approved"
                              type="submit"
                            >
                              Approve
                            </button>
                            <button
                              className="neutral-action"
                              name="decision"
                              value="edited"
                              type="submit"
                            >
                              Save edited
                            </button>
                            <button
                              className="danger-action"
                              name="decision"
                              value="rejected"
                              type="submit"
                            >
                              Reject
                            </button>
                          </div>
                        </form>
                      ) : (
                        <p>Resolved: {proposal.decision}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>
                No proposed changes have been generated. Resume Coach is not
                available; you can still save and review your local draft
                manually.
              </p>
            )}
          </section>
          <section
            id="resume-provenance"
            className="resume-follow-up"
            aria-labelledby="resume-provenance-heading"
          >
            <h2 id="resume-provenance-heading">Evidence and skills</h2>
            <p>
              Each evidence support reference stays visible at its review
              decision. Only approved evidence can support a future material.
            </p>
            <div className="evidence-chip-list">
              {proposals.length ? (
                proposals.map((proposal) => {
                  const support = evidenceByRevision.get(
                    proposal.evidenceRevisionId,
                  );
                  return (
                    <Link
                      className="evidence-chip"
                      href={
                        support
                          ? `/evidence#evidence-${support.id}`
                          : "/evidence#evidence-heading"
                      }
                      key={proposal.id}
                    >
                      Evidence:{" "}
                      {support
                        ? `${support.sourceDocument} · ${support.reviewState === "approved" ? "Approved" : support.reviewState === "unreviewed" ? "Ready for review" : support.reviewState === "rejected" ? "Not using" : "Removed"}`
                        : "Open Evidence Review"}
                    </Link>
                  );
                })
              ) : (
                <span className="evidence-chip">No evidence proposals yet</span>
              )}
              {content.skills.map((skill) => (
                <span className="evidence-chip" key={skill}>
                  Skill · {skill}
                </span>
              ))}
            </div>
          </section>
          <div className="resume-version-actions">
            <form action={action}>
              <input
                type="hidden"
                name="currentResumeCommand"
                value="propose"
              />
              <input type="hidden" name="draftId" value={draft.id} />
              <button type="submit" disabled={pending}>
                Update Base Resume from approved evidence
              </button>
            </form>
            <form action={action} key={revisionKey}>
              <input
                type="hidden"
                name="currentResumeCommand"
                value="approve-version"
              />
              <input type="hidden" name="draftId" value={draft.id} />
              <label>
                <input
                  type="checkbox"
                  name="explicitApproval"
                  value="yes"
                  required
                  disabled={hasUnsavedEdits}
                />{" "}
                I approve this Current Base Resume version.
              </label>
              {hasUnsavedEdits ? (
                <p className="revision-status">
                  Save the displayed edits before approving this revision.
                </p>
              ) : null}
              <button type="submit" disabled={pending || hasUnsavedEdits}>
                Approve Current Base Resume version
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="resume-editor-preview resume-empty-workspace">
          <form
            action={action}
            className="resume-review-pane"
            id="resume-editor"
          >
            <input type="hidden" name="currentResumeCommand" value="import" />
            <div className="resume-pane-head">
              <div>
                <h2 id="current-base-resume-heading">
                  Start with your Base Resume
                </h2>
                <p>
                  Import a text-readable PDF to create a private structured
                  draft.
                </p>
              </div>
              <span className="resume-pane-chip">Local only</span>
            </div>
            <p className="resume-context">
              The original PDF stays unchanged. Resume Coach is not available
              yet.
            </p>
            <label htmlFor="current-resume-pdf">Current Base Resume PDF</label>
            <input
              id="current-resume-pdf"
              name="currentResumePdf"
              type="file"
              accept="application/pdf,.pdf"
              required
              aria-invalid={message.status === "error"}
              aria-describedby={
                message.status === "error" ? "current-resume-error" : undefined
              }
            />
            <button type="submit" disabled={pending}>
              Import PDF
            </button>
            {sourceCount ? (
              <p>
                {sourceCount} retained PDF source{" "}
                {sourceCount === 1 ? "is" : "are"} available.
              </p>
            ) : (
              <p>No Current Base Resume PDF has been imported yet.</p>
            )}
          </form>
          <aside
            id="resume-preview"
            className="resume-preview resume-preview-pane"
            aria-label="Resume preview"
            aria-labelledby="resume-preview-heading"
          >
            <div className="resume-pane-head">
              <div>
                <h2 id="resume-preview-heading">Preview</h2>
                <p>Your read-only local preview will appear here.</p>
              </div>
              <span className="resume-pane-chip">No draft yet</span>
            </div>
            <article className="resume-paper resume-paper-empty">
              <h3>Ready when you are</h3>
              <p>
                Import a text-readable PDF to begin a private, local review.
                Nothing is sent anywhere.
              </p>
            </article>
            <p className="preview-boundary">
              <strong>Local preview.</strong> It does not load remote assets or
              send your resume anywhere.
            </p>
          </aside>
        </div>
      )}
      <details className="resume-version-history">
        <summary>View retained Current Base Resume versions</summary>
        {versions.length ? (
          <ul>
            {versions.map((version) => (
              <li key={version.id}>
                {version.sourceFilename}, draft revision{" "}
                {version.draftRevisionNumber}, approved{" "}
                <span suppressHydrationWarning>
                  {new Date(version.approvedAt).toLocaleString()}
                </span>
                . Evidence support:{" "}
                {version.evidenceRevisionIds.length
                  ? version.evidenceRevisionIds.map((id, index) => {
                      const support = evidenceByRevision.get(id);
                      return support ? (
                        <span key={id}>
                          {index ? "; " : ""}
                          <Link href={`/evidence#evidence-${support.id}`}>
                            {evidenceLabel(support)}
                          </Link>
                        </span>
                      ) : (
                        <span key={id}>
                          {index ? "; " : ""}a retained evidence reference that
                          is no longer available
                        </span>
                      );
                    })
                  : "none"}
                .
              </li>
            ))}
          </ul>
        ) : (
          <p>No Current Base Resume version has been approved yet.</p>
        )}
      </details>
    </section>
  );
}
