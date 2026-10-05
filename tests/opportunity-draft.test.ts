import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewedOpportunitySource, validateOpportunitySource } from "../src/domain/opportunities/opportunity-source";
import { validateJobOpportunityReaderOutput as validate } from "../src/domain/opportunities/job-opportunity-reader-contract";
import { requestJobOpportunityReader } from "../src/adapters/local-model/local-model-gateway";
const connection={configurationRevisionId:"019a0000-0000-7000-8000-000000000001",configurationDigest:`sha256:${"a".repeat(64)}`,modelIdentifier:"test-model"};
const source="We need an Account Executive at Example Studio.\nLocation: Makati\nWork style: Remote\nPosted: October 5, 2026\nRequirements\n- Automated testing experience";
test("reader contract accepts cited facts without role grammar or employer suffix rules",()=>{
 const output={title:{value:"Account Executive",excerpt:"We need an Account Executive at Example Studio."},company:{value:"Example Studio",excerpt:"We need an Account Executive at Example Studio."},location:{value:"Makati",excerpt:"Location: Makati"},workStyle:{value:"Remote",excerpt:"Work style: Remote"},postedAt:{value:"2026-10-05",excerpt:"Posted: October 5, 2026"}};
 assert.deepEqual(validate(output,source),{title:"Account Executive",company:"Example Studio",location:"Makati",workStyle:"Remote",postedAt:"2026-10-05",requirements:""});
});
test("uncited or unsupported values stay blank; model nulls are not filled by heuristics",()=>{
 const fields=validate({title:{value:"Invented title",excerpt:source.split("\n")[0]},company:{value:"Example Studio",excerpt:"Not in the posting"},location:null,workStyle:null},source);
 assert.deepEqual(fields,{title:"",company:"",location:"",workStyle:"",postedAt:"",requirements:""});assert.equal(validate({title:null,company:null},source).title,"");
});
test("malformed output, extra keys and oversized values are rejected",()=>{
 for(const output of [null,[],{},{title:42},{company:{value:"Studio",unexpected:true}},{tools:"browse"},{requirements:"anything"},{title:"x".repeat(301)}])assert.throws(()=>validate(output,source));
});
test("unsupported dates and partial-year evidence stay blank",()=>{
 for(const [date,quote] of [["2026-02-30","February 30, 2026"],["2026-10-05","October 5"],["2026-10-05","October 5, 2025"]]) assert.equal(validate({postedAt:{value:date,excerpt:quote}},quote).postedAt,"");
});
test("source validation preserves input and rejects invalid URLs and short descriptions",()=>{
 const input={postingUrl:"https://example.test/job?ref=source",copiedDescription:`  ${source}\n`};assert.deepEqual(validateOpportunitySource(input),input);
 for(const url of ["http://example.test","https://user:secret@example.test","bad"])assert.throws(()=>validateOpportunitySource({...input,postingUrl:url}));assert.throws(()=>validateOpportunitySource({...input,copiedDescription:"short"}));
});
test("source identity preserves textarea bytes across multipart line endings",()=>{
 const input={postingUrl:"https://example.test",copiedDescription:`  ${source}\n`};assert.deepEqual(reviewedOpportunitySource(JSON.stringify(input),{...input,copiedDescription:input.copiedDescription.replace(/\n/g,"\r\n")}),input);
 assert.equal(reviewedOpportunitySource(JSON.stringify(input),{...input,copiedDescription:source+"changed"}),undefined);assert.equal(reviewedOpportunitySource("broken",input),undefined);
});
test("Gemma fenced JSON and legacy scalar/named facts remain source-cited",async()=>{
 const output={title:"Account Executive",company:"Example Studio",requirements:[{name:"Testing",value:"Automated testing experience",excerpt:"- Automated testing experience"},{name:"Unknown",value:null}]};
 const parsed=await requestJobOpportunityReader(connection,source,async()=>new Response(JSON.stringify({output:[{type:"message",content:'```json\n'+JSON.stringify(output)+'\n```'}]})));
 assert.equal(validate(parsed,source).title,"Account Executive");assert.equal(validate(parsed,source).requirements,"Automated testing experience");
});
test("local transport rejects malformed JSON and unavailable model",async()=>{
 await assert.rejects(requestJobOpportunityReader(connection,source,async()=>new Response(JSON.stringify({output:[{type:"message",content:'```json\n{"title":\n```'}]}))));
 await assert.rejects(requestJobOpportunityReader(connection,source,async()=>{throw Error("offline");}));
});
