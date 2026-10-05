import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile,mkdtemp,readdir,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {jobOpportunityReaderInstruction} from "../src/adapters/local-model/job-opportunity-reader-agent";
import {jobOpportunityReaderDefinition,validateJobOpportunityReaderOutput} from "../src/domain/opportunities/job-opportunity-reader-contract";
import {requestJobOpportunityReader} from "../src/adapters/local-model/local-model-gateway";
import {readJobOpportunity} from "../src/application/opportunities/read-job-opportunity";
import {createFormattedOpportunity} from "../src/application/opportunities/create-formatted-opportunity";
import {readOpportunityDetails} from "../src/domain/opportunities/captured-opportunities";
import {refineOpportunityDescription} from "../src/domain/opportunities/refined-description";
const connection={configurationRevisionId:"019a0000-0000-7000-8000-000000000001",configurationDigest:`sha256:${"a".repeat(64)}`,modelIdentifier:"test-model"};
const response=(output:unknown)=>new Response(JSON.stringify({output:[{type:"message",content:JSON.stringify(output)}]}));
const regal=()=>readFile("tests/fixtures/regal-job-description.txt","utf8");
function regalOutput(source:string){return {title:{value:"Junior Automation Developer",excerpt:source.split("\n").find(line=>line.startsWith("The Junior Automation Developer supports"))!},company:{value:"Regal Rexnord",excerpt:"About Regal Rexnord"},workStyle:{value:"hybrid",excerpt:source.split("\n")[1]}};}
test("reader uses complete application agent card and stateless host contract",()=>{
 for(const section of ["IDENTITY","MISSION","CONTEXT","INPUTS","RESPONSIBILITIES","REASONING FRAMEWORK","WORKFLOW","COORDINATION","TOOLS","MEMORY","CONSTRAINTS","COMMUNICATION STYLE","OUTPUT FORMAT","VALIDATION","FAILURE HANDLING","COMPLETION"])assert.ok(jobOpportunityReaderInstruction.includes(`[${section}]`),section);
 assert.equal(jobOpportunityReaderDefinition.agentId,"jobs.opportunity-reader");assert.equal(jobOpportunityReaderDefinition.stateless,true);assert.deepEqual(jobOpportunityReaderDefinition.tools,[]);assert.equal(jobOpportunityReaderDefinition.maxCalls,2);
});
test("Regal original and formatted posting accept cited identity without interpretation heuristics",async()=>{
 const source=await regal();
 for(const text of [source,refineOpportunityDescription({},source)]) {
  const output=regalOutput(source);output.company.excerpt=text===source?"About Regal Rexnord":source.split("\n").find(line=>line.startsWith("Regal Rexnord is a publicly held"))!;
  const fields=validateJobOpportunityReaderOutput(output,text);assert.equal(fields.title,"Junior Automation Developer");assert.equal(fields.company,"Regal Rexnord");assert.equal(fields.workStyle,"hybrid");assert.equal(fields.location,"");assert.equal(fields.postedAt,"");
 }
});
test("contract supports arbitrary job titles and employer wording through source evidence",()=>{
 for(const title of ["Account Executive","Registered Nurse","Executive Assistant","Customer Success Lead","Community Outreach Lead"]) {
  const text=`Our vacancy is ${title}, employed by Tidal & Co, serving local communities.`;
  const fields=validateJobOpportunityReaderOutput({title:{value:title,excerpt:text},company:{value:"Tidal & Co",excerpt:text}},text);assert.equal(fields.title,title);assert.equal(fields.company,"Tidal & Co");
 }
});
test("model-declared missing/conflicting identities stay blank and uncited claims are discarded",async()=>{
 const source=await regal();const fields=validateJobOpportunityReaderOutput({title:null,company:null,location:{value:"Invented city",excerpt:source.split("\n")[1]}},source);assert.equal(fields.title,"");assert.equal(fields.company,"");assert.equal(fields.location,"");
});
test("reader transport sends complete source and only unresolved identity on focused retry",async()=>{
 const source=await regal();
 for(const retry of [undefined,{unresolvedFields:["company"] as const}])await requestJobOpportunityReader(connection,source,async(url,init)=>{
  assert.equal(url,"http://127.0.0.1:1234/api/v1/chat");const body=JSON.parse(String(init.body));assert.equal(body.system_prompt,jobOpportunityReaderInstruction);assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.previous_response_id,undefined);
  assert.deepEqual(JSON.parse(body.input),retry?{copiedDescription:source,unresolvedFields:["company"]}:{copiedDescription:source});assert.equal(body.max_output_tokens,retry?1000:5000);return response(regalOutput(source));
 },retry);
});
test("one focused retry fills missing identity but cannot overwrite accepted fields",async()=>{
 const source=await regal();let calls=0;
 const result=await readJobOpportunity({postingUrl:"https://example.test/job",copiedDescription:source},{connection,request:async(_config,text,_fetch,retry)=>{calls++;assert.equal(text,source);if(calls===1)return {...regalOutput(source),company:null};assert.deepEqual(retry,{unresolvedFields:["company"]});return {title:"Wrong title",company:{value:"Regal Rexnord",excerpt:"About Regal Rexnord"},location:"Invented city"};}});
 assert.equal(calls,2);assert.equal(result.title,"Junior Automation Developer");assert.equal(result.company,"Regal Rexnord");assert.equal(result.location,"");
});
test("unavailable and malformed reader creates no database; genuine missing identity saves Unknown",async()=>{
 const source=await regal();const root=await mkdtemp(join(tmpdir(),"opportunity-reader-errors-"));try{
 await assert.rejects(createFormattedOpportunity({postingUrl:"https://example.test/job",copiedDescription:source,appDataRoot:root},{generate:input=>readJobOpportunity(input,{connection,request:async()=>({unexpected:true})})}));assert.deepEqual(await readdir(root),[]);
 let emptyCalls=0;
 await assert.rejects(createFormattedOpportunity({postingUrl:"https://example.test/job",copiedDescription:source,appDataRoot:root},{generate:input=>readJobOpportunity(input,{connection,request:async()=>{emptyCalls++;return {};}})}));assert.equal(emptyCalls,1);assert.deepEqual(await readdir(root),[]);
 let calls=0;const saved=await createFormattedOpportunity({postingUrl:"https://example.test/job",copiedDescription:source,appDataRoot:root},{generate:input=>readJobOpportunity(input,{connection,request:async()=>{calls++;return {title:null,company:null};}})});
 assert.equal(calls,2);const view=(await readOpportunityDetails(saved.opportunity.id,{appDataRoot:root}))!;assert.equal(view.title,"Unknown");assert.equal(view.company,"Unknown");assert.equal(view.copiedDescription,source);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("Regal Add saves the cited reader identity and original source in one operation",async()=>{
 const source=await regal();const root=await mkdtemp(join(tmpdir(),"opportunity-reader-regal-"));let calls=0;try{
 const saved=await createFormattedOpportunity({postingUrl:"https://example.test/job",copiedDescription:source,appDataRoot:root},{generate:input=>readJobOpportunity(input,{connection,request:(config,text)=>requestJobOpportunityReader(config,text,async()=>{calls++;return response(regalOutput(source));})})});
 const view=(await readOpportunityDetails(saved.opportunity.id,{appDataRoot:root}))!;assert.equal(calls,1);assert.equal(view.title,"Junior Automation Developer");assert.equal(view.company,"Regal Rexnord");assert.equal(view.copiedDescription,source);assert.match(view.refinedDescription!,/Responsibilities/);assert.match(view.refinedDescription!,/About the company/);assert.match(view.refinedDescription!,/Notification to Agencies/);
 }finally{await rm(root,{recursive:true,force:true});}
});
