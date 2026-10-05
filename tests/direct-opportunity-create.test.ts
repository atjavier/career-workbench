import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,readdir,rm,readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFormattedOpportunity } from "../src/application/opportunities/create-formatted-opportunity";
import { readOpportunityDetails } from "../src/domain/opportunities/captured-opportunities";
import { readJobOpportunity } from "../src/application/opportunities/read-job-opportunity";
import {requestJobOpportunityReader} from "../src/adapters/local-model/local-model-gateway";
import {refineOpportunityDescription} from "../src/domain/opportunities/refined-description";
import { openDatabase } from "../src/persistence/database";
const source={postingUrl:"https://example.test/job",copiedDescription:"Role: backend developer\nCompany: Example Studio\nResponsibilities\nBuild reliable services with automated tests and careful peer reviews."};
const generated={title:"Backend Developer",company:"Example Studio",location:"",workStyle:"",requirements:"",postedAt:"",refinedDescription:"Responsibilities\n• Build reliable services with automated tests and careful peer reviews."};
test("one Add operation reads and persists once, retaining original source",async()=>{
 const root=await mkdtemp(join(tmpdir(),"direct-opportunity-"));let calls=0;
 try{const result=await createFormattedOpportunity({...source,appDataRoot:root},{generate:async input=>{calls++;assert.equal(input.copiedDescription,source.copiedDescription);return generated;}});assert.equal(calls,1);
 const view=(await readOpportunityDetails(result.opportunity.id,{appDataRoot:root}))!;assert.equal(view.refinedDescription,generated.refinedDescription);assert.equal(view.copiedDescription,source.copiedDescription);assert.equal(view.location,"Unknown");
 const db=openDatabase(join(root,"workspace.sqlite"));try{assert.equal((db.prepare("SELECT count(*) n FROM captured_opportunities").get() as {n:number}).n,1);}finally{db.close();}
 }finally{await rm(root,{recursive:true,force:true});}
});
test("invalid source and AI failure produce no records",async()=>{
 const root=await mkdtemp(join(tmpdir(),"direct-opportunity-errors-"));try{
 await assert.rejects(createFormattedOpportunity({...source,appDataRoot:root},{generate:async()=>{throw Error("offline");}}));let called=false;await assert.rejects(createFormattedOpportunity({...source,copiedDescription:"short",appDataRoot:root},{generate:async()=>{called=true;return generated;}}));assert.equal(called,false);assert.deepEqual(await readdir(root),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("genuinely missing identity saves Unknown without asking for manual details",async()=>{
 const root=await mkdtemp(join(tmpdir(),"direct-opportunity-unknown-"));try{
 const result=await createFormattedOpportunity({...source,appDataRoot:root},{generate:async()=>({...generated,title:"",company:""})});const view=(await readOpportunityDetails(result.opportunity.id,{appDataRoot:root}))!;
 assert.equal(view.title,"Unknown");assert.equal(view.company,"Unknown");assert.equal(view.copiedDescription,source.copiedDescription);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("Arch original and formatted posting persist cited reader identity",async()=>{
 const original=await readFile("tests/fixtures/arch-job-description.txt","utf8");const connection={configurationRevisionId:"019a0000-0000-7000-8000-000000000001",configurationDigest:`sha256:${"a".repeat(64)}`,modelIdentifier:"test-model"};
 for(const description of [original,refineOpportunityDescription({},original)]) {const root=await mkdtemp(join(tmpdir(),"direct-opportunity-arch-"));try{
 const role=description.split("\n").find(line=>line.includes("We are seeking"))!;const company=description.split("\n").find(line=>line.startsWith("10400"))!;
 const saved=await createFormattedOpportunity({postingUrl:source.postingUrl,copiedDescription:description,appDataRoot:root},{generate:input=>readJobOpportunity(input,{connection,request:(config,text)=>requestJobOpportunityReader(config,text,async(_url,init)=>{assert.equal(JSON.parse(JSON.parse(String(init.body)).input).copiedDescription,description);return new Response(JSON.stringify({output:[{type:"message",content:JSON.stringify({title:{value:"backend developer",excerpt:role},company:{value:"Arch Global Services (Philippines) Inc.",excerpt:company}})}]}));})})});
 const view=(await readOpportunityDetails(saved.opportunity.id,{appDataRoot:root}))!;assert.equal(view.title,"Backend Developer");assert.equal(view.company,"Arch Global Services (Philippines) Inc.");assert.equal(view.copiedDescription,description);assert.match(view.refinedDescription!,/Responsibilities/);
 }finally{await rm(root,{recursive:true,force:true});}}
});
