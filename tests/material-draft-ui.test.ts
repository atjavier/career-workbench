import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Resume Coach presents the generated PDF and does not regenerate on page visits", async () => {
  const [coach, actions] = await Promise.all([readFile(new URL("../src/app/resume-coach.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8")]);
  for (const token of ["Resume Coach independently reviews", "Review base resume", "Keep current", "Resume template is unchanged", "aria-busy", "aria-live=\"polite\"", "generated automatically during onboarding"]) assert.ok(coach.includes(token));
  assert.ok(coach.indexOf("Resume template is unchanged") < coach.indexOf("Review base resume"));
  assert.doesNotMatch(coach, /Draft focus|Create a fresh resume draft|Optional local opportunity|opportunityRevisionId/);
  assert.match(actions, /handOffMaterialDraft/); assert.match(actions, /revalidatePath\("\/resume"\)/);
  assert.doesNotMatch(coach, /fetch\s*\(|Material Version|render.*PDF|export.*file|tool.?MCP|automation/i);
});

test("review route awaits async params and renders only a safe local read projection", async () => {
  const [page, review] = await Promise.all([readFile(new URL("../src/app/resume/drafts/[draftId]/page.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/material-draft-review.tsx", import.meta.url), "utf8")]);
  assert.match(page, /params: Promise/); assert.match(page, /await params/); assert.match(page, /readMaterialDraft\(\{ draftId, requireHandoff: true \}\)/); assert.match(page, /unavailable/);
  for (const token of ["Local draft review", "not approved", "Material Version", "rendered", "exported", "draft.profileLabel", "Resume template"]) assert.ok(review.includes(token));
  assert.doesNotMatch(`${page}\n${review}`, /fetch\s*\(|requestResumeCoach|handOffMaterialDraft|contentDigest|provenanceDigest|originalUrl|\.pdf|export.*button/i);
});
