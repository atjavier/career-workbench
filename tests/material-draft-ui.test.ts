import { readActionSources } from "./helpers/source-modules";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Resume Coach presents the generated PDF and does not regenerate on page visits", async () => {
  const [coach, actions] = await Promise.all([
    readFile(new URL("../src/components/resume/resume-preview.tsx", import.meta.url), "utf8"),
    readActionSources(),
  ]);
  for (const token of [
    "Resume Coach independently reviews",
    "Review base resume",
    "Keep current",
    "Resume template is unchanged",
    "aria-busy",
    'aria-live="polite"',
  ])
    assert.match(
      coach.replace(/\s+/g, " "),
      new RegExp(token.replace(/\s+/g, " ")),
    );
  assert.ok(
    coach.indexOf("Resume template is unchanged") <
      coach.indexOf("Review base resume"),
  );
  assert.doesNotMatch(
    coach,
    /Draft focus|Create a fresh resume draft|Optional local opportunity|opportunityRevisionId/,
  );
  assert.match(actions, /handOffMaterialDraft/);
  assert.match(actions, /revalidatePath\("\/resume"\)/);
  assert.doesNotMatch(
    coach,
    /fetch\s*\(|Material Version|render.*PDF|export.*file|tool.?MCP|automation/i,
  );
});

test("review route awaits async params and safely redirects to resume", async () => {
  const page = await readFile(
    new URL("../src/app/resume/drafts/[draftId]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /params: Promise/);
  assert.match(page, /await params/);
  assert.match(
    page,
    /readMaterialDraft\(\{\s*draftId,\s*requireHandoff:\s*true,?\s*\}\)/,
  );
  assert.match(page, /redirect\("\/resume"\)/);
  assert.doesNotMatch(
    page,
    /fetch\s*\(|requestResumeCoach|handOffMaterialDraft|contentDigest|provenanceDigest|originalUrl|\.pdf|export.*button/i,
  );
});
