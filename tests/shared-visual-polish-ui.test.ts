import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (file: string) =>
  readFile(new URL(`../src/app/${file}`, import.meta.url), "utf8");

test("compact navigation preserves Jobs-first routes and keyboard-close focus behavior", async () => {
  const [shell, compact, styles] = await Promise.all([
    source("application-shell.tsx"),
    source("compact-navigation.tsx"),
    source("globals.css"),
  ]);
  assert.match(shell, /CompactNavigation/);
  assert.match(shell, /applicationDestinations/);
  assert.match(compact, /Current destination: \$\{active\}/);
  assert.match(compact, /open \? "Close" : "Open"/);
  assert.match(compact, /aria-expanded/);
  assert.match(compact, /aria-current/);
  assert.match(compact, /event\.key === "Escape"/);
  assert.match(compact, /triggerRef\.current\?\.focus\(\)/);
  assert.match(compact, /matchMedia\("\(max-width: 40rem\)"\)/);
  assert.match(shell, /Review saved opportunities/);
  assert.match(styles, /\.compact-navigation/);
  assert.match(styles, /\.primary-navigation/);
  assert.match(styles, /min-height: 2\.75rem/);
  assert.match(styles, /min-width: 40\.0625rem\) and \(max-width: 64rem\)/);
  assert.match(styles, /padding-inline: 1\.25rem/);
});

test("shared visual polish uses semantic actions, resilient cards, and disclosure", async () => {
  const [styles, jobs, applications, current, evidence, assistant, storage] =
    await Promise.all([
      source("globals.css"),
      source("job-listings.tsx"),
      source("applications.tsx"),
      source("current-base-resume.tsx"),
      source("evidence-review.tsx"),
      source("career-assistant.tsx"),
      source("data-storage.tsx"),
    ]);
  assert.match(styles, /\.danger-action/);
  assert.match(styles, /\.affirmative-action/);
  assert.match(styles, /\.neutral-action/);
  assert.match(
    styles,
    /\.job-listing-facts\s*\{\s*grid-template-columns:\s*1fr;/,
  );
  assert.match(
    styles,
    /\.applications-future-fields\s*\{\s*grid-template-columns:\s*1fr;/,
  );
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(jobs, /className="affirmative-action add-opportunity-action"/);
  assert.match(applications, /applications-future-fields/);
  assert.match(current, /className="danger-action"/);
  assert.doesNotMatch(
    current,
    /Technical support details|Retained evidence revision identifiers/,
  );
  assert.match(evidence, /className="danger-action"/);
  assert.match(assistant, /className="danger-action"/);
  assert.match(storage, /danger-action/);
});

test("polished presentation stays local, truthful, and accessible", async () => {
  const combined = (
    await Promise.all(
      [
        "application-shell.tsx",
        "compact-navigation.tsx",
        "job-listings.tsx",
        "applications.tsx",
        "current-base-resume.tsx",
        "evidence-review.tsx",
        "evidence-library.tsx",
        "career-assistant.tsx",
        "google-sheets-workspace.tsx",
        "data-storage.tsx",
      ].map(source),
    )
  ).join("\n");
  assert.match(combined, /No applications to track yet/);
  assert.match(combined, /Google Sheets is not connected yet/);
  assert.match(combined, /Editing this draft does not change the original PDF/);
  assert.match(combined, /No captured opportunities match your search/);
  assert.doesNotMatch(
    combined,
    /fetch\s*\(|setInterval|setTimeout|oauth|automatic retry|automatic scan/i,
  );
});
