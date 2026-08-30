import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("application shell presents Jobs first with human-facing destinations", async () => {
  const shell = await readFile(
    new URL("../src/app/application-shell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(shell, /Jobs/);
  for (const label of ["Resume", "Settings", "Review saved opportunities"])
    assert.match(shell, new RegExp(label));
  for (const label of [
    "Applications",
    "Evidence Library",
    "Google Sheets",
    "Career Assistant",
  ])
    assert.doesNotMatch(shell, new RegExp(`label: "${label}"`));
  assert.match(shell, /aria-current/);
  assert.match(shell, /Skip to main content/);
  assert.match(shell, /app-sidebar-footer/);
  assert.match(shell, /navigation-icon/);
  assert.match(shell, /Private, local mode/);
});

test("home composition uses the application shell and human product identity", async () => {
  const shell = await readFile(
    new URL("../src/app/application-shell.tsx", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../src/app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /ApplicationShell/);
  assert.match(shell, /id="main-content"/);
  assert.match(page, /Jobs/);
  assert.doesNotMatch(page, /<h1>Personal Job Discovery<\/h1>/);
});

test("placeholder destinations retain the shell, route identity, and honest status", async () => {
  const placeholder = await readFile(
    new URL("../src/app/[section]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(placeholder, /<ApplicationShell active=\{content\.title\}>/);
  assert.match(placeholder, /This workspace is being prepared/);
  assert.match(placeholder, /generateStaticParams/);
});

test("shell styling uses the approved premium header and visible focus token", async () => {
  const styles = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(styles, /--header: rgb\(255 255 255 \/ 0\.7\)/);
  assert.match(styles, /--primary: #0058be/i);
  assert.match(styles, /--focus-ring: #005ac2/i);
  assert.match(styles, /outline: 3px solid var\(--focus-ring\)/);
  assert.match(styles, /input\[type="checkbox"\]/);
});
