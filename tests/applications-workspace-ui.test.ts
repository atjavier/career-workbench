import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicationsWorkspace } from "../src/components/applications/applications-workspace";

test("Applied uses the shared page header with an honest empty state and useful navigation", () => {
  const html = renderToStaticMarkup(createElement(ApplicationsWorkspace));
  assert.match(html, /<h1>Applied<\/h1>/);
  assert.match(html, /page-header/);
  assert.match(html, /No applied jobs to show/);
  assert.match(html, /Application tracking isn’t available yet/);
  assert.match(html, /href="\/">Browse opportunities/);
  assert.doesNotMatch(html, /eyebrow|Google Sheets|tracking workspace|What you will see/);
});
test("Applied remains a Jobs subsection", async () => {
  const page = await readFile(new URL("../src/app/applications/page.tsx", import.meta.url), "utf8");
  assert.match(page, /ApplicationShell active="Jobs" activeSubItem="Applied"/);
});
