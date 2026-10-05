import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { refineOpportunityDescription, formatRoleTitle } from "../src/domain/opportunities/refined-description";
import { confirmCapturedOpportunity, readOpportunityDetails, updateCapturedOpportunity, deleteCapturedOpportunity } from "../src/domain/opportunities/captured-opportunities";
import { openDatabase } from "../src/persistence/database";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { OpportunityDeleteDialog } from "../src/components/jobs/opportunity-delete-dialog";
import { OpportunityDetails } from "../src/components/jobs/opportunity-details";

test("formatting preserves complete source while organizing headings and removing exact repeats", async () => {
  const source = await readFile("tests/fixtures/arch-job-description.txt", "utf8");
  const formatted = refineOpportunityDescription({}, source);
  assert.match(formatted, /Responsibilities\n• Design, develop/);
  assert.match(formatted, /Requirements\n• Learning/);
  for (const line of source.split("\n").map(line=>line.trim()).filter(Boolean).filter(line=>!["About the job", "Tasks/Responsibilities", "Requirements Skills/Experience"].includes(line))) assert.ok(formatted.includes(line), line);
  const duplicate = refineOpportunityDescription({}, "Requirements\nTypeScript\nTypeScript");
  assert.equal(duplicate.match(/TypeScript/g)?.length, 1);
  assert.equal(formatRoleTitle("backend developer"), "Backend Developer"); assert.equal(formatRoleTitle("senior API developer"), "Senior API Developer");
});
test("AI organization accepts only exact source excerpts with complete coverage", () => {
  const source = "Build services.\nRequirements\nTypeScript";
  assert.equal(refineOpportunityDescription({descriptionSections:[{heading:"About the role",excerpts:["Build services."]},{heading:"Requirements",excerpts:["TypeScript"]}]},source), "About the role\nBuild services.\n\nRequirements\n• TypeScript");
  for (const output of [{descriptionSections:[{heading:"Requirements",excerpts:["Invented requirement"]}]},{descriptionSections:[{heading:"Requirements",excerpts:["TypeScript"]}]},{descriptionSections:[{heading:"Guaranteed success",excerpts:["Build services.","TypeScript"]}]}]) assert.equal(refineOpportunityDescription(output,source), refineOpportunityDescription({},source));
});
test("refined description persists separately, survives compatible edits, and cascades on deletion", async () => {
  const root = await mkdtemp(join(tmpdir(),"refined-opportunity-"));
  try {
    const source = await readFile("tests/fixtures/arch-job-description.txt","utf8");
    const input = { appDataRoot:root, postingUrl:"https://example.test/job", copiedDescription:source, refinedDescription:refineOpportunityDescription({},source), capturedAt:new Date().toISOString(), title:"Backend Developer", company:"Arch Global Services (Philippines) Inc.", location:"Unknown", workStyle:"Unknown", requirements:"Unknown", postedAt:"Unknown" };
    const created = await confirmCapturedOpportunity(input); const id=created.opportunity.id;
    const view = (await readOpportunityDetails(id,{appDataRoot:root}))!;
    assert.equal(view.copiedDescription,source); assert.equal(view.refinedDescription,input.refinedDescription);
    const html=renderToStaticMarkup(createElement(OpportunityDetails,{opportunity:view})); assert.match(html,/Original pasted description/); assert.doesNotMatch(html,/id="opportunity-requirements"/);
    const deletion=renderToStaticMarkup(createElement(OpportunityDeleteDialog,{opportunity:view,open:true,onClose:()=>{}})); assert.match(deletion,/type="hidden" name="confirmation" value="DELETE"/);assert.doesNotMatch(deletion,/Type DELETE|pattern="DELETE"/);
    const edited="About the role\nReviewed by the user.";
    await updateCapturedOpportunity({...input, opportunityId:id,expectedRevisionId:view.revisionId,refinedDescription:edited});
    const updated=(await readOpportunityDetails(id,{appDataRoot:root}))!;assert.equal(updated.refinedDescription,edited);assert.equal(updated.copiedDescription,source);assert.notEqual(updated.contentDigest,view.contentDigest);
    await deleteCapturedOpportunity({appDataRoot:root,opportunityId:id,expectedRevisionId:updated.revisionId,confirmation:"DELETE"});
    const db=openDatabase(join(root,"workspace.sqlite"));try {assert.equal((db.prepare("SELECT count(*) AS n FROM opportunity_revision_descriptions").get() as {n:number}).n,0);}finally{db.close();}
  } finally { await rm(root,{recursive:true,force:true}); }
});

test("formatting cannot turn source benefits into requirements and all-caps ordinary titles become Title Case", () => {
  const source = "Benefits\nPaid vacation";
  assert.equal(refineOpportunityDescription({descriptionSections:[{heading:"Requirements",excerpts:["Paid vacation"]}]},source), "Benefits\n• Paid vacation");
  assert.equal(formatRoleTitle("BACKEND DEVELOPER"), "Backend Developer"); assert.equal(formatRoleTitle("SENIOR SQL DEVELOPER"),"Senior SQL Developer"); assert.equal(formatRoleTitle("iOS DEVELOPER"),"iOS Developer"); assert.equal(formatRoleTitle(".NET developer"),".NET Developer");
});
test("editing source refreshes unchanged formatting, while an explicitly edited replacement is retained", async () => {
  const root=await mkdtemp(join(tmpdir(),"refined-source-edit-"));
  try {
    const source="Responsibilities\nBuild software and accessible interfaces with TypeScript, automated tests and peer reviews.";
    const refined=refineOpportunityDescription({},source);
    const input={appDataRoot:root,postingUrl:"https://example.test",copiedDescription:source,refinedDescription:refined,capturedAt:new Date().toISOString(),title:"Engineer",company:"Studio",location:"Unknown",workStyle:"Unknown",requirements:"Unknown",postedAt:"Unknown"};
    const created=await confirmCapturedOpportunity(input);const id=created.opportunity.id;const view=(await readOpportunityDetails(id,{appDataRoot:root}))!;
    const nextSource=source.replace("TypeScript","Python");
    await updateCapturedOpportunity({...input,copiedDescription:nextSource.replace(/\n/g,"\r\n"),refinedDescription:refined.replace(/\n/g,"\r\n"),opportunityId:id,expectedRevisionId:view.revisionId});
    const changed=(await readOpportunityDetails(id,{appDataRoot:root}))!;assert.equal(changed.refinedDescription,refineOpportunityDescription({},nextSource));assert.equal(changed.copiedDescription.replace(/\r\n/g,"\n"),nextSource);
    await updateCapturedOpportunity({...input,copiedDescription:source,refinedDescription:"My explicitly reviewed replacement",opportunityId:id,expectedRevisionId:changed.revisionId});
    assert.equal((await readOpportunityDetails(id,{appDataRoot:root}))!.refinedDescription,"My explicitly reviewed replacement");
    const legacy=await confirmCapturedOpportunity({...input,refinedDescription:undefined,title:"Legacy Engineer"});
    const legacyView=(await readOpportunityDetails(legacy.opportunity.id,{appDataRoot:root}))!;
    await updateCapturedOpportunity({...input,refinedDescription:source,opportunityId:legacyView.id,expectedRevisionId:legacyView.revisionId});
    assert.equal((await readOpportunityDetails(legacyView.id,{appDataRoot:root}))!.refinedDescription,undefined);
  } finally {await rm(root,{recursive:true,force:true});}
});

test("all supported source headings remain boundaries", () => {
  const source="Responsibilities\nBuild services.\nAbout the company\nOur team is collaborative.\nHow to apply\nSubmit your application.";
  assert.equal(refineOpportunityDescription({descriptionSections:[{heading:"Responsibilities",excerpts:["Build services."]},{heading:"About the company",excerpts:["Our team is collaborative."]},{heading:"How to apply",excerpts:["Submit your application."]}]},source),"Responsibilities\n• Build services.\n\nAbout the company\nOur team is collaborative.\n\nHow to apply\nSubmit your application.");
});
