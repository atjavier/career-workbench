import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createAuditEvent } from "../src/audit/audit-event";
import { resolveAppDataPaths } from "../src/files/app-data";
import { initializeWorkspace } from "../src/domain/workspace/initialize-workspace";
import { storageProtectionMessage } from "../src/domain/workspace/status-message";

test("creates a private data root and initializes the same SQLite workspace twice", async () => {
  const root = await mkdtemp(join(tmpdir(), "job-workspace-test-"));

  try {
    const first = await initializeWorkspace({ appDataRoot: root });
    const second = await initializeWorkspace({ appDataRoot: root });

    assert.equal(first.workspaceId, second.workspaceId);
    assert.equal(first.initialization, "created");
    assert.equal(second.initialization, "validated");
    assert.match(first.databasePath, /workspace\.sqlite$/);
    assert.equal(first.auditEvent.action, "workspace.initialized");
    assert.equal(second.auditEvent.action, "workspace.validated");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an app-data root that is a file", async () => {
  const root = await mkdtemp(join(tmpdir(), "job-workspace-test-"));
  const filePath = join(root, "not-a-directory");
  await writeFile(filePath, "not a directory");

  try {
    await assert.rejects(resolveAppDataPaths(filePath), {
      code: "APP_DATA_PATH_INVALID",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("audit events retain metadata but reject sensitive payload fields", () => {
  const event = createAuditEvent({
    actor: "local-os-user",
    action: "workspace.initialized",
    outcome: "success",
    entityId: "018f6a60-7c00-7000-8000-000000000001",
    contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });

  const serialized = JSON.stringify(event);
  assert.match(serialized, /workspace\.initialized/);
  assert.match(serialized, /sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/);
  assert.match(event.id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.doesNotMatch(serialized, /resume|prompt|token|credential/i);
  assert.throws(
    () =>
      createAuditEvent({
        actor: "local-os-user",
        action: "workspace.initialized",
        outcome: "success",
        unsafePayload: "resume text must never be logged",
      } as never),
    { code: "AUDIT_PAYLOAD_FORBIDDEN" },
  );
});

test("rejects an empty explicit app-data root", async () => {
  await assert.rejects(resolveAppDataPaths(""), { code: "APP_DATA_PATH_INVALID" });
});

test("storage protection copy is truthful and includes a safe next action", () => {
  const message = storageProtectionMessage();

  assert.match(message.summary, /Windows OS account/i);
  assert.match(message.detail, /full-disk encryption/i);
  assert.match(message.detail, /shared or unencrypted device/i);
  assert.equal(message.safeNextAction, "Review the device's full-disk encryption before importing career data.");
});
