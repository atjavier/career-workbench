"use client";

import { WorkspaceContainer } from "@/components/common/layout-containers";

import { useActionState, useState } from "react";
import { resumeWorkspaceAction, type WorkspaceActionState } from "@/app/actions";
import { PageHeader } from "@/components/common/page-header";
import { ResumeProfileForm } from "@/components/resume/resume-profile-form";
import type { CandidateProfileValues } from "@/persistence/candidate-profile-repository";

type Props = {
  profileId?: string;
  expectedStateRevisionNumber: number;
  values?: CandidateProfileValues;
  workspaceId: string;
  workspaceRevisionNumber: number;
};

const initialWorkspaceAction: WorkspaceActionState = {
  status: "idle",
  summary: "",
};

export function ResumeProfileWorkspace({
  profileId,
  expectedStateRevisionNumber,
  values,
  workspaceId,
  workspaceRevisionNumber,
}: Props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    resumeWorkspaceAction,
    initialWorkspaceAction,
  );

  return (
    <WorkspaceContainer className="resume-profile-workspace">
      <PageHeader
        title="Your Details"
        subtitle="Keep your personal, contact, and education details up to date."
      />

      <ResumeProfileForm
        profileId={profileId}
        expectedStateRevisionNumber={expectedStateRevisionNumber}
        values={values}
        onDelete={
          workspaceId && typeof workspaceRevisionNumber === "number"
            ? () => setShowDeleteModal(true)
            : undefined
        }
        deletePending={deletePending}
      />

      {/* Frictionless Deletion Confirmation Modal Dialog (Matching Evidence Library) */}
      {showDeleteModal ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="modal-card delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-resume-modal-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="delete-resume-modal-heading">
                Delete Resume Workspace?
              </h3>
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete this resume workspace?
                Your generated drafts and workspace configuration will be
                permanently removed.
              </p>
              <div className="modal-safety-callout">
                <span className="callout-icon" aria-hidden="true">
                  ✓
                </span>
                <div className="callout-text">
                  <strong>Your original files are safe:</strong>
                  <span>
                    {" "}Your local source folders and evidence documents on
                    disk will NOT be modified or deleted.
                  </span>
                </div>
              </div>
            </div>
            <form
              action={deleteAction}
              className="modal-actions"
              style={{ margin: 0 }}
            >
              <input type="hidden" name="workspaceCommand" value="delete" />
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input
                type="hidden"
                name="expectedRevisionNumber"
                value={workspaceRevisionNumber}
              />
              <input type="hidden" name="confirmation" value="DELETE" />
              <button
                type="button"
                className="neutral-action"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletePending}
                style={{ margin: 0 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="danger-action"
                disabled={deletePending}
                style={{ margin: 0 }}
              >
                {deletePending ? "Deleting..." : "Confirm permanent deletion"}
              </button>
            </form>
            {deleteState.status === "error" ? (
              <p className="popover-error-msg" role="status">
                {deleteState.summary}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </WorkspaceContainer>
  );
}
