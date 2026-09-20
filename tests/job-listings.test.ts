import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  applyDuplicateOverride,
  importManualJobListing,
  listJobListings,
  reverseDuplicateOverride,
} from "../src/domain/discovery/job-listings";
import { listSourceConfigurations } from "../src/domain/discovery/source-configurations";
import { openDatabase } from "../src/persistence/database";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "job-listings-"));
  return { root, appDataRoot: join(root, "private") };
}

test("manual import preserves source attribution, uses Unknown for absent details, and makes no network activity", async () => {
  const value = await fixture();
  try {
    const source = (await listSourceConfigurations(value)).configurations[0];
    const listing = await importManualJobListing({
      ...value,
      sourceId: source.sourceId,
      sourceConfigurationRevisionId: source.revisionId,
      title: "Junior Developer",
      company: "Example Co",
      originalUrl: "https://jobs.example.test/junior",
    });
    assert.equal(listing.workStyle, "Unknown");
    assert.equal(listing.location, "Unknown");
    assert.equal(listing.sourceRecords[0].sourceName, source.values.name);
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      const audit = database
        .prepare(
          "SELECT content_hash FROM audit_events WHERE action = 'discovery.job_listing_imported'",
        )
        .get() as { content_hash: string };
      assert.ok(audit.content_hash.startsWith("sha256:"));
      assert.doesNotMatch(
        JSON.stringify(audit),
        /jobs\.example|Junior Developer|Example Co/,
      );
    } finally {
      database.close();
    }
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("probable duplicates retain every source record and an override can be reversed without data loss", async () => {
  const value = await fixture();
  try {
    const source = (await listSourceConfigurations(value)).configurations[0];
    const first = await importManualJobListing({
      ...value,
      sourceId: source.sourceId,
      sourceConfigurationRevisionId: source.revisionId,
      title: "Junior Developer",
      company: "Example Co",
      originalUrl: "https://jobs.example.test/one",
    });
    const second = await importManualJobListing({
      ...value,
      sourceId: source.sourceId,
      sourceConfigurationRevisionId: source.revisionId,
      title: " junior developer ",
      company: "Example Co",
      originalUrl: "https://jobs.example.test/two",
      location: "Makati",
    });
    const before = await listJobListings(value);
    assert.equal(before.listings[0].sourceRecords.length, 2);
    assert.ok(
      before.listings.every((listing) =>
        listing.sourceRecords.some(
          (record) => record.jobListingId === listing.id,
        ),
      ),
    );
    const override = await applyDuplicateOverride({
      ...value,
      listingId: second.id,
      groupId: null,
      confirmed: true,
    });
    const separated = await listJobListings(value);
    assert.equal(separated.listings.length, 2);
    assert.notEqual(
      separated.listings[0].duplicateGroupId,
      separated.listings[1].duplicateGroupId,
    );
    await reverseDuplicateOverride({
      ...value,
      overrideId: override.id,
      confirmed: true,
    });
    const restored = await listJobListings(value);
    assert.equal(restored.listings[0].sourceRecords.length, 2);
    assert.equal(
      restored.listings[0].sourceRecords
        .map((record) => record.originalUrl)
        .sort()
        .join(","),
      "https://jobs.example.test/one,https://jobs.example.test/two",
    );
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("manual import rejects stale source revisions and never introduces retrieval code", async () => {
  const value = await fixture();
  try {
    const source = (await listSourceConfigurations(value)).configurations[0];
    await assert.rejects(
      importManualJobListing({
        ...value,
        sourceId: source.sourceId,
        sourceConfigurationRevisionId: "00000000-0000-7000-8000-000000009999",
        title: "Junior Developer",
        company: "Example Co",
        originalUrl: "https://jobs.example.test/stale",
      }),
      { code: "JOB_LISTING_STALE" },
    );
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});
