import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createManualCareersPageSource,
  defaultSourceConfigurations,
  listSourceConfigurations,
  saveSourceConfiguration,
  validateSourceConfiguration,
  type SourceConfigurationValues,
} from "../src/domain/discovery/source-configurations";
import { applyMigrations, openDatabase } from "../src/persistence/database";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "source-configurations-"));
  return { root, appDataRoot: join(root, "private") };
}

const approvedApi: SourceConfigurationValues = {
  name: "USAJOBS",
  sourceType: "public-employment-service",
  url: "https://api.usajobs.gov/",
  accessPath: "official-api",
  policyRevision: "API terms reviewed",
  policyReviewedOn: "2026-08-23",
  policyApproved: true,
  requestBudget: 10,
  rateLimitPerMinute: 10,
  retentionRule: "Retain normalized listings locally until deleted.",
  enabled: true,
  failureGuidance: "Stop requests and show the official browser page.",
};

test("first use seeds eight manual-browser sources without any retrieval audit", async () => {
  const value = await fixture();
  try {
    const view = await listSourceConfigurations(value);
    assert.equal(view.configurations.length, 8);
    assert.deepEqual(
      view.configurations.map((source) => source.values.name),
      defaultSourceConfigurations.map((source) => source.name).sort(),
    );
    for (const source of view.configurations) {
      assert.equal(source.values.accessPath, "manual-browser-handoff");
      assert.equal(source.values.requestBudget, 0);
      assert.equal(source.values.rateLimitPerMinute, 0);
      assert.equal(source.values.enabled, false);
    }
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'discovery.source_configuration%' ",
            )
            .get() as { count: number }
        ).count,
        0,
      );
    } finally {
      database.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("0013 adds Filipino manual sources exactly once to an existing 0012 workspace", async () => {
  const value = await fixture();
  try {
    await mkdir(value.appDataRoot, { recursive: true });
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      const baseline = await (
        await import("node:fs/promises")
      ).readFile(
        new URL(
          "../src/persistence/migrations/0012_source_configurations.sql",
          import.meta.url,
        ),
        "utf8",
      );
      database.exec(
        "CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);",
      );
      database.exec(baseline);
      database
        .prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
        .run("0012_source_configurations", "2026-08-23T00:00:00.000Z");
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM source_configuration_revisions",
            )
            .get() as { count: number }
        ).count,
        5,
      );
      applyMigrations(database);
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM source_configuration_revisions",
            )
            .get() as { count: number }
        ).count,
        13,
      );
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM source_configurations_current",
            )
            .get() as { count: number }
        ).count,
        8,
      );
      assert.deepEqual(
        (
          database
            .prepare(
              "SELECT name FROM source_configuration_revisions WHERE source_id IN (?, ?, ?) ORDER BY name COLLATE NOCASE",
            )
            .all(
              "00000000-0000-7000-8000-000000000106",
              "00000000-0000-7000-8000-000000000107",
              "00000000-0000-7000-8000-000000000108",
            ) as Array<{ name: string }>
        ).map(({ name }) => name),
        ["Kalibrr", "OnlineJobs.ph", "PhilJobNet"],
      );
      assert.deepEqual(
        (
          database
            .prepare(
              "SELECT content_digest FROM source_configuration_revisions WHERE source_id IN (?, ?, ?) ORDER BY source_id",
            )
            .all(
              "00000000-0000-7000-8000-000000000106",
              "00000000-0000-7000-8000-000000000107",
              "00000000-0000-7000-8000-000000000108",
            ) as Array<{ content_digest: string }>
        ).map(({ content_digest }) => content_digest),
        [
          "sha256:43bca5925d5044c1924fded63fa7e8265af1b42f7d878b1ce5394a411fc3c29b",
          "sha256:2937dc001df740968ed2301260fd24bf23646bae5a4bd2d3ccd76cf402ebb146",
          "sha256:028b2cc053ec1e11ac255e60d9f4147749483ceb01b4941bc266e149fc4f69e9",
        ],
      );
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'discovery.source_configuration%'",
            )
            .get() as { count: number }
        ).count,
        0,
      );
      applyMigrations(database);
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM source_configuration_revisions",
            )
            .get() as { count: number }
        ).count,
        13,
      );
    } finally {
      database.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("saving an approved retrieval source creates immutable, auditable revisions", async () => {
  const value = await fixture();
  try {
    const first = await saveSourceConfiguration({
      ...value,
      values: approvedApi,
    });
    assert.match(
      first.revisionId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    assert.equal(first.revisionNumber, 1);
    assert.ok(!Number.isNaN(Date.parse(first.createdAt)));
    const second = await saveSourceConfiguration({
      ...value,
      sourceId: first.sourceId,
      expectedRevisionId: first.revisionId,
      values: { ...approvedApi, requestBudget: 5 },
    });
    assert.equal(second.revisionNumber, 2);
    assert.notEqual(second.revisionId, first.revisionId);
    assert.equal(
      (await listSourceConfigurations(value)).configurations.find(
        (source) => source.sourceId === first.sourceId,
      )?.values.requestBudget,
      5,
    );
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM source_configuration_revisions WHERE source_id = ?",
            )
            .get(first.sourceId) as { count: number }
        ).count,
        2,
      );
      const event = database
        .prepare(
          "SELECT entity_id, content_hash FROM audit_events WHERE action = 'discovery.source_configuration_saved' ORDER BY occurred_at DESC LIMIT 1",
        )
        .get() as { entity_id: string; content_hash: string };
      assert.equal(event.entity_id, second.revisionId);
      assert.match(event.content_hash, /^sha256:[0-9a-f]{64}$/);
    } finally {
      database.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("a careers-page URL creates a disabled local manual-browser source", async () => {
  const value = await fixture();
  try {
    const saved = await saveSourceConfiguration({
      ...value,
      values: createManualCareersPageSource(
        " https://careers.example.test/open-roles ",
        "2026-08-23",
      ),
    });
    assert.deepEqual(saved.values, {
      name: "Company careers page",
      sourceType: "company-careers",
      url: "https://careers.example.test/open-roles",
      accessPath: "manual-browser-handoff",
      policyRevision: "Manual browser handoff recorded locally.",
      policyReviewedOn: "2026-08-23",
      policyApproved: false,
      requestBudget: 0,
      rateLimitPerMinute: 0,
      retentionRule:
        "No integration-fetched content; locally imported listings follow local lifecycle.",
      enabled: false,
      failureGuidance:
        "Stop and use the normal site page or manually import a selected listing.",
    });
    assert.match(
      saved.sourceId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM source_configuration_revisions WHERE source_id = ?",
            )
            .get(saved.sourceId) as { count: number }
        ).count,
        1,
      );
      const event = database
        .prepare(
          "SELECT entity_id, content_hash FROM audit_events WHERE action = 'discovery.source_configuration_saved' ORDER BY occurred_at DESC LIMIT 1",
        )
        .get() as { entity_id: string; content_hash: string };
      assert.equal(event.entity_id, saved.revisionId);
      assert.match(event.content_hash, /^sha256:[0-9a-f]{64}$/);
    } finally {
      database.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("unsafe careers-page URLs do not mutate local source state", async () => {
  const value = await fixture();
  try {
    for (const unsafe of [
      "",
      "http://careers.example.test",
      "https://",
      "https://user@careers.example.test",
      "https://:password@careers.example.test",
      "https://user:password@careers.example.test",
      "https://careers.example.test/".repeat(100),
    ])
      assert.throws(() => createManualCareersPageSource(unsafe), {
        code: "SOURCE_CONFIGURATION_INVALID",
      });
    assert.equal(
      (await listSourceConfigurations(value)).configurations.length,
      8,
    );
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          database
            .prepare(
              "SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'discovery.source_configuration%' ",
            )
            .get() as { count: number }
        ).count,
        0,
      );
    } finally {
      database.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("unsafe enables, invalid values, and stale saves preserve prior configurations", async () => {
  const value = await fixture();
  try {
    const first = await saveSourceConfiguration({
      ...value,
      values: approvedApi,
    });
    await assert.rejects(
      saveSourceConfiguration({
        ...value,
        values: { ...approvedApi, name: "Unknown", policyApproved: false },
      }),
      { code: "SOURCE_CONFIGURATION_POLICY_UNRESOLVED" },
    );
    await assert.rejects(
      saveSourceConfiguration({
        ...value,
        values: {
          ...approvedApi,
          name: "Invalid URL",
          url: "http://example.test",
        },
      }),
      { code: "SOURCE_CONFIGURATION_INVALID" },
    );
    assert.throws(
      () =>
        validateSourceConfiguration({
          ...approvedApi,
          policyReviewedOn: "2026-02-30",
        }),
      { code: "SOURCE_CONFIGURATION_INVALID" },
    );
    const second = await saveSourceConfiguration({
      ...value,
      sourceId: first.sourceId,
      expectedRevisionId: first.revisionId,
      values: { ...approvedApi, rateLimitPerMinute: 5 },
    });
    await assert.rejects(
      saveSourceConfiguration({
        ...value,
        sourceId: first.sourceId,
        expectedRevisionId: first.revisionId,
        values: approvedApi,
      }),
      { code: "SOURCE_CONFIGURATION_STALE" },
    );
    assert.equal(
      (await listSourceConfigurations(value)).configurations.find(
        (source) => source.sourceId === first.sourceId,
      )?.revisionId,
      second.revisionId,
    );
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("0014 hardens persisted source-policy records without changing current source ownership", async () => {
  const value = await fixture();
  try {
    await listSourceConfigurations(value);
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      const current = database
        .prepare(
          "SELECT source_id, revision_id FROM source_configurations_current ORDER BY source_id LIMIT 2",
        )
        .all() as Array<{ source_id: string; revision_id: string }>;
      assert.throws(
        () =>
          database
            .prepare(
              "UPDATE source_configurations_current SET revision_id = ? WHERE source_id = ?",
            )
            .run(current[1].revision_id, current[0].source_id),
        /must belong to source/,
      );
      assert.throws(
        () =>
          database
            .prepare(
              "INSERT INTO source_configuration_revisions (id, source_id, revision_number, name, source_type, url, access_path, policy_revision, policy_reviewed_on, policy_approved, request_budget, rate_limit_per_minute, retention_rule, enabled, failure_guidance, content_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              "00000000-0000-7000-8000-000000000301",
              "00000000-0000-7000-8000-000000000301",
              1,
              "Unsafe",
              "job-platform",
              "http://example.test",
              "official-api",
              "terms",
              "2026-08-23",
              1,
              1,
              1,
              "retain",
              1,
              "stop",
              "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "2026-08-23T00:00:00.000Z",
            ),
        /credential-free HTTPS/,
      );
      assert.throws(
        () =>
          database
            .prepare(
              "INSERT INTO source_configuration_revisions (id, source_id, revision_number, name, source_type, url, access_path, policy_revision, policy_reviewed_on, policy_approved, request_budget, rate_limit_per_minute, retention_rule, enabled, failure_guidance, content_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              "00000000-0000-7000-8000-000000000302",
              "00000000-0000-7000-8000-000000000302",
              1,
              "Unapproved",
              "job-platform",
              "https://example.test",
              "official-api",
              "terms",
              "2026-08-23",
              0,
              1,
              1,
              "retain",
              1,
              "stop",
              "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              "2026-08-23T00:00:00.000Z",
            ),
        /requires approved policy/,
      );
      assert.deepEqual(
        (
          database
            .prepare(
              "SELECT content_digest FROM source_configuration_revisions WHERE source_id IN (?, ?, ?, ?, ?) AND revision_number = 2 ORDER BY source_id",
            )
            .all(
              "00000000-0000-7000-8000-000000000101",
              "00000000-0000-7000-8000-000000000102",
              "00000000-0000-7000-8000-000000000103",
              "00000000-0000-7000-8000-000000000104",
              "00000000-0000-7000-8000-000000000105",
            ) as Array<{ content_digest: string }>
        ).map(({ content_digest }) => content_digest),
        [
          "sha256:c35d4ef2f2eacb1e233a5ab36bd39fd25114bcdd60f1d07777a8bb0c45d87ea8",
          "sha256:0015b48cc97f8f2f82ca5d55f185deefe9c1a22901de3192e2b857f8ef81dadb",
          "sha256:acfe13b5feb1623d997a890f553fe215081f3665e56ec3d0323c45c5dbef3592",
          "sha256:aba79243de57fb440a3f44c2d3248f0a9eee471093debd5cb0f59ac1ee63b45e",
          "sha256:161832e41cee3ca50e387d1ad47c4c9a32485a0f692fbbbed0b52853fdef8380",
        ],
      );
    } finally {
      database.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("persisted invalid state and persistence failures are recoverable without replacing prior state", async () => {
  const value = await fixture();
  try {
    const first = await saveSourceConfiguration({
      ...value,
      values: approvedApi,
    });
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      database.exec(
        "CREATE TRIGGER test_source_configuration_failure BEFORE INSERT ON source_configuration_revisions WHEN NEW.revision_number > 1 BEGIN SELECT RAISE(ABORT, 'simulated persistence failure'); END;",
      );
    } finally {
      database.close();
    }
    await assert.rejects(
      saveSourceConfiguration({
        ...value,
        sourceId: first.sourceId,
        expectedRevisionId: first.revisionId,
        values: { ...approvedApi, requestBudget: 4 },
      }),
      /simulated persistence failure/,
    );
    assert.equal(
      (await listSourceConfigurations(value)).configurations.find(
        (source) => source.sourceId === first.sourceId,
      )?.revisionId,
      first.revisionId,
    );
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("source configuration modules remain local and do not introduce retrieval APIs", async () => {
  const source = await (
    await import("node:fs/promises")
  ).readFile(
    new URL(
      "../src/domain/discovery/source-configurations.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /fetch\s*\(|setInterval|setTimeout|watch\s*\(|automatic retry|createAdapter|open\s*\(|window\.|credential (?:store|access)|proxy/i,
  );
});
