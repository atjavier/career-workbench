import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { configureLocalModel, readLocalModelReadiness } from "../src/domain/resume-generation/local-model-configuration-commands";
import type { OsVault } from "../src/adapters/os-vault/os-vault";
import { applyMigrations, openDatabase } from "../src/persistence/database";
import { selectLocalModelConfiguration } from "../src/persistence/local-model-configuration-repository";

class FakeVault implements OsVault {
  readonly values = new Map<string, string>();
  deleted: string[] = [];
  async put(reference: string, secret: string) { this.values.set(reference, secret); }
  async get(reference: string) { return this.values.get(reference); }
  async remove(reference: string) { this.deleted.push(reference); this.values.delete(reference); }
}

function models(loaded = true) {
  return new Response(JSON.stringify({ models: [{ type: "llm", key: "qwen/qwen3.5-9b", display_name: "Qwen 3.5 9B", params_string: "9B", loaded_instances: loaded ? [{ id: "instance-1" }] : [] }] }), { status: 200, headers: { "content-type": "application/json" } });
}

test("verified local-model settings create an immutable selected configuration without storing its token", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-model-config-"));
  const vault = new FakeVault();
  try {
    let target = ""; let authorization = "";
    const saved = await configureLocalModel({ appDataRoot: join(root, "private"), modelIdentifier: "qwen/qwen3.5-9b", token: "secret-value", vault, fetcher: async (url, init) => { target = String(url); authorization = new Headers(init?.headers).get("authorization") ?? ""; return models(); } });
    assert.equal(target, "http://127.0.0.1:1234/api/v1/models");
    assert.equal(authorization, "Bearer secret-value");
    assert.equal(saved.displayLabel, "Qwen3.5-9B");
    assert.equal(saved.ready, true);
    assert.equal(JSON.stringify(saved), JSON.stringify({ ready: true, displayLabel: "Qwen3.5-9B" }));
    assert.equal(vault.values.size, 1);

    const db = openDatabase(join(root, "private", "workspace.sqlite"));
    try {
      applyMigrations(db);
      const row = db.prepare("SELECT endpoint, model_identifier, display_label, secret_reference, configuration_digest FROM local_model_configuration_revisions").get() as Record<string, string>;
      assert.equal(row.endpoint, "http://127.0.0.1:1234/v1");
      assert.equal(row.model_identifier, "qwen/qwen3.5-9b");
      assert.equal(row.display_label, "Qwen3.5-9B");
      assert.ok(row.secret_reference && !row.secret_reference.includes("secret-value"));
      assert.match(row.configuration_digest, /^sha256:[0-9a-f]{64}$/);
      assert.equal(JSON.stringify(row).includes("secret-value"), false);
      assert.throws(() => db.exec("UPDATE local_model_configuration_revisions SET model_identifier = 'changed'"), /immutable/i);
    } finally { db.close(); }
    assert.deepEqual(await readLocalModelReadiness({ appDataRoot: join(root, "private"), vault }), { ready: true, displayLabel: "Qwen3.5-9B" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("unsafe/unloaded configuration fails closed before persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-model-config-failure-"));
  const vault = new FakeVault();
  try {
    await assert.rejects(configureLocalModel({ appDataRoot: join(root, "private"), modelIdentifier: "qwen/qwen3.5-9b", token: "secret-value", vault, fetcher: async () => models(false) }), { code: "LOCAL_MODEL_CONFIGURATION_INVALID" });
    await mkdir(join(root, "private"), { recursive: true });
    const db = openDatabase(join(root, "private", "workspace.sqlite"));
    try { applyMigrations(db); assert.equal((db.prepare("SELECT COUNT(*) AS count FROM local_model_configuration_revisions").get() as { count: number }).count, 0); } finally { db.close(); }
    assert.equal(vault.values.size, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a stale selection and a failed database save leave no selected configuration or staged vault secret", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-model-config-cas-"));
  const appDataRoot = join(root, "private"); const vault = new FakeVault();
  try {
    await mkdir(appDataRoot, { recursive: true });
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      applyMigrations(db);
      const state = db.prepare("SELECT revision_number FROM resume_generation_state WHERE singleton = 1").get() as { revision_number: number };
      assert.equal(selectLocalModelConfiguration(db, state.revision_number + 1, "00000000-0000-7000-8000-000000000001", "2026-08-26T00:00:00.000Z"), undefined);
      db.exec("CREATE TRIGGER test_configuration_insert_failure BEFORE INSERT ON local_model_configuration_revisions BEGIN SELECT RAISE(ABORT, 'injected save failure'); END;");
    } finally { db.close(); }

    await assert.rejects(configureLocalModel({ appDataRoot, modelIdentifier: "qwen/qwen3.5-9b", token: "secret-value", vault, fetcher: async () => models() }), /injected save failure/);
    assert.equal(vault.values.size, 0);
    assert.equal(vault.deleted.length, 1);
    const verify = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      assert.equal((verify.prepare("SELECT COUNT(*) AS count FROM local_model_configuration_revisions").get() as { count: number }).count, 0);
      assert.equal((verify.prepare("SELECT current_model_configuration_revision_id FROM resume_generation_state WHERE singleton = 1").get() as { current_model_configuration_revision_id: string | null }).current_model_configuration_revision_id, null);
    } finally { verify.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
