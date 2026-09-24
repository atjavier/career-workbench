"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import {
  resumeWorkspaceAction,
  type WorkspaceActionState,
} from "@/app/actions";

type Workspace = {
  id: string;
  name: string;
  journey?: { phase: string; message: string };
};

const journeyLabel = (workspace: Workspace) =>
  ({
    onboarding: "Needs profile",
    documenting: "Preparing evidence",
    interview: "Coach questions",
    ready_to_generate: "Ready to generate",
    ready_for_preview: "Resume ready",
    recovery: "Needs attention",
  })[workspace.journey?.phase ?? "onboarding"] ?? "Needs attention";

const initial: WorkspaceActionState = {
  status: "idle",
  summary: "",
};

export function ResumeWorkspacePicker({
  workspaces,
  activeWorkspaceId,
  revisionNumber,
}: {
  workspaces: Workspace[];
  activeWorkspaceId?: string;
  revisionNumber: number;
}) {
  const [state, action, pending] = useActionState(
    resumeWorkspaceAction,
    initial,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find(
    (item) => item.id === activeWorkspaceId,
  );
  const hasWorkspaces = workspaces.length > 0;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreate(false);
        setShowDelete(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="resume-compact-picker" ref={menuRef}>
      <button
        type="button"
        className="resume-picker-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Switch or create resume workspace"
      >
        <span className="trigger-icon" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
        </span>
        <div className="trigger-text-group">
          <span className="trigger-active-name">
            {activeWorkspace?.name ??
              (hasWorkspaces ? "Select Resume" : "New Resume")}
          </span>
          {activeWorkspace ? (
            <span className="trigger-badge">
              {journeyLabel(activeWorkspace)}
            </span>
          ) : null}
        </div>
        <span className="trigger-chevron" aria-hidden="true">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen ? (
        <div
          className="resume-picker-popover"
          role="dialog"
          aria-label="Resume Workspaces"
        >
          <div className="popover-section-head">
            <span className="popover-title">Saved Resumes</span>
            <button
              type="button"
              className="popover-btn-new"
              onClick={() => {
                setShowCreate((v) => !v);
                setShowDelete(false);
              }}
            >
              {showCreate ? "Cancel" : "+ New"}
            </button>
          </div>

          {showCreate || !hasWorkspaces ? (
            <form action={action} className="popover-create-form">
              <input type="hidden" name="workspaceCommand" value="create" />
              <input
                type="hidden"
                name="expectedRevisionNumber"
                value={revisionNumber}
              />
              <div className="popover-create-row">
                <input
                  name="name"
                  required
                  maxLength={120}
                  placeholder="New resume name..."
                  className="popover-input"
                  disabled={pending}
                  autoFocus
                />
                <button
                  type="submit"
                  className="popover-btn-submit"
                  disabled={pending}
                >
                  {pending ? "..." : "Create"}
                </button>
              </div>
            </form>
          ) : null}

          {hasWorkspaces ? (
            <ul className="popover-workspace-list" role="listbox">
              {workspaces.map((workspace) => {
                const isActive = workspace.id === activeWorkspaceId;
                return (
                  <li
                    key={workspace.id}
                    className={`popover-list-item ${isActive ? "active" : ""}`}
                  >
                    <form action={action} className="popover-select-form">
                      <input
                        type="hidden"
                        name="workspaceCommand"
                        value="select"
                      />
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspace.id}
                      />
                      <input
                        type="hidden"
                        name="expectedRevisionNumber"
                        value={revisionNumber}
                      />
                      <button
                        type={isActive ? "button" : "submit"}
                        className="popover-item-btn"
                        disabled={pending}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => {
                          if (isActive) setIsOpen(false);
                        }}
                      >
                        <div className="item-info">
                          <span className="item-name">{workspace.name}</span>
                          <span className="item-phase">
                            {journeyLabel(workspace)}
                          </span>
                        </div>
                        {isActive ? (
                          <span className="item-check" aria-hidden="true">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {activeWorkspaceId && !showCreate ? (
            <div className="popover-footer">
              {!showDelete ? (
                <button
                  type="button"
                  className="popover-delete-toggle"
                  onClick={() => setShowDelete(true)}
                >
                  Delete this resume
                </button>
              ) : (
                <form action={action} className="popover-delete-form">
                  <input type="hidden" name="workspaceCommand" value="delete" />
                  <input
                    type="hidden"
                    name="workspaceId"
                    value={activeWorkspaceId}
                  />
                  <input
                    type="hidden"
                    name="expectedRevisionNumber"
                    value={revisionNumber}
                  />
                  <p className="popover-delete-warning">
                    Type DELETE to confirm removal:
                  </p>
                  <div className="popover-delete-row">
                    <input
                      name="confirmation"
                      required
                      placeholder="DELETE"
                      className="popover-input popover-input-delete"
                      disabled={pending}
                    />
                    <button
                      type="submit"
                      className="popover-btn-delete-confirm"
                      disabled={pending}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="popover-btn-cancel-del"
                      onClick={() => setShowDelete(false)}
                    >
                      ✕
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}

          {state.status === "error" ? (
            <p className="popover-error-msg" role="status">
              {state.summary}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
