"use client";

import { useActionState, type ComponentProps, type ReactNode } from "react";

import { dataStorageAction, type WorkspaceActionState } from "@/app/actions";
import type { DataStorageView } from "@/domain/data-storage/data-storage";

const initial: WorkspaceActionState = {
  status: "idle",
  summary: "Review local data before making a change.",
};
type FormAction = ComponentProps<"form">["action"];

function Confirm({
  children,
  artifactId,
  revision,
  command,
  label,
  hasError,
  formAction,
}: {
  children: ReactNode;
  artifactId?: string;
  revision?: number;
  command: string;
  label: string;
  hasError: boolean;
  formAction: FormAction;
}) {
  const close = (element: HTMLElement) => {
    const dialog = element.closest("details");
    dialog?.removeAttribute("open");
    (dialog?.querySelector("summary") as HTMLElement | null)?.focus();
  };
  const destructive = command === "cleanup" || command === "permanent-delete";
  return (
    <details
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(event.currentTarget);
        }
      }}
    >
      <summary>{label}</summary>
      <p>{children}</p>
      <form action={formAction}>
        <label>
          <input
            type="checkbox"
            name="confirmed"
            value="yes"
            required
            aria-invalid={hasError}
            aria-describedby={hasError ? "data-storage-error" : undefined}
          />{" "}
          I understand this local action.
        </label>
        <input type="hidden" name="dataCommand" value={command} />
        <input type="hidden" name="artifactId" value={artifactId ?? ""} />
        <input type="hidden" name="expectedRevision" value={revision ?? 0} />
        <button
          className={destructive ? "danger-action" : "affirmative-action"}
          type="submit"
        >
          Confirm {label}
        </button>
        <button
          className="neutral-action"
          type="reset"
          onClick={(event) => close(event.currentTarget)}
        >
          Cancel
        </button>
      </form>
    </details>
  );
}

export function DataStorage({
  view,
  protectionSummary,
  protectionDetail,
}: {
  view: DataStorageView;
  protectionSummary: string;
  protectionDetail: string;
}) {
  const [state, action, pending] = useActionState(dataStorageAction, initial);
  const error = state.status === "error";
  return (
    <section aria-labelledby="data-storage-heading" className="panel">
      <h2 id="data-storage-heading">Data &amp; Storage</h2>
      <p className="status-label">Current protection boundary</p>
      <p>{protectionSummary}</p>
      <p>{protectionDetail}</p>
      <p>
        Backups remain in private local app data on this device. Each backup
        contains a workspace database snapshot; it is not portable,
        cloud-synced, or application-encrypted.
      </p>
      <h3>Storage inventory</h3>
      <p>
        Active storage and Local trash are shown by data class;
        connected-service consequences are listed for every class.
      </p>
      <ul>
        {view.inventory.map((item) => (
          <li key={item.label}>
            <strong>{item.label}</strong>: {item.location}; {item.usage};{" "}
            {item.connectedService}.
          </li>
        ))}
      </ul>
      <h3>Local controls</h3>
      <form action={action}>
        <button
          name="dataCommand"
          value="backup"
          type="submit"
          disabled={pending}
        >
          Create local workspace database backup
        </button>
      </form>
      <form action={action}>
        <button
          name="dataCommand"
          value="history-export"
          type="submit"
          disabled={pending}
        >
          Create activity-history export
        </button>
      </form>
      <Confirm
        command="cleanup"
        label="clean expired trash"
        hasError={error}
        formAction={action}
      >
        Expired trash is removed only after this explicit confirmation. No
        background cleanup runs.
      </Confirm>
      <h3>Managed artifacts</h3>
      {view.artifacts.length === 0 ? (
        <p>No local backups, exports, or trash items exist yet.</p>
      ) : (
        <ul>
          {view.artifacts.map((item) => (
            <li key={item.id}>
              <strong>
                {item.artifactKind === "backup"
                  ? "Local backup"
                  : "Activity-history export"}
              </strong>{" "}
              — {item.lifecycleState}; {item.byteSize} bytes; revision{" "}
              {item.localRevision}.{" "}
              {item.lifecycleState === "trashed" &&
              item.expiresAt &&
              view.restorableArtifactIds.includes(item.id) ? (
                <>
                  Recoverable until{" "}
                  <span suppressHydrationWarning>
                    {new Date(item.expiresAt).toLocaleString()}
                  </span>
                  .{" "}
                  <Confirm
                    artifactId={item.id}
                    revision={item.localRevision}
                    command="restore"
                    label="restore"
                    hasError={error}
                    formAction={action}
                  >
                    Restore this metadata-only export to private local app data.
                    It does not affect connected services.
                  </Confirm>
                </>
              ) : null}
              {item.lifecycleState === "trashed" &&
              item.expiresAt &&
              !view.restorableArtifactIds.includes(item.id) ? (
                <p>This trash item has expired and cannot be restored.</p>
              ) : null}
              {item.artifactKind === "activity_history_export" &&
              item.lifecycleState === "active" ? (
                <Confirm
                  artifactId={item.id}
                  revision={item.localRevision}
                  command="trash"
                  label="move to local trash"
                  hasError={error}
                  formAction={action}
                >
                  This metadata-only export moves to local trash until its
                  displayed recovery deadline. Base Resumes and evidence are not
                  changed.
                </Confirm>
              ) : null}
              {item.artifactKind === "backup" &&
              item.lifecycleState === "active" ? (
                <Confirm
                  artifactId={item.id}
                  revision={item.localRevision}
                  command="permanent-delete"
                  label="permanently delete"
                  hasError={error}
                  formAction={action}
                >
                  This permanently deletes local backup {item.id}. It cannot be
                  restored and does not delete any remote copy.
                </Confirm>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p
        id={error ? "data-storage-error" : undefined}
        className={error ? "status status-error" : "status"}
        role={error ? "alert" : "status"}
        aria-live={error ? "assertive" : "polite"}
      >
        {state.summary}
      </p>
      {state.safeNextAction ? (
        <p>
          <strong>Safe next action:</strong> {state.safeNextAction}
        </p>
      ) : null}
      <h3>Activity history</h3>
      {view.auditEvents.length === 0 ? (
        <p>No local activity has been recorded yet.</p>
      ) : (
        <ul>
          {view.auditEvents.slice(0, 20).map((event) => (
            <li key={event.id} suppressHydrationWarning>
              {new Date(event.occurredAt).toLocaleString()}: {event.action} (
              {event.outcome})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
