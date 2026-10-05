import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createUuidV7 } from "../src/audit/audit-event";
import { requestClarificationPlan } from "../src/adapters/local-model/local-model-gateway";
import { buildClarificationPlanningPrompt } from "../src/adapters/local-model/resume-clarification-planner-agent";
import { validateClarificationPlan } from "../src/domain/resume-generation/clarification-plan";
import { interpretWorkspaceEvidence, planClarifications } from "../src/application/resume-generation/resume-evidence-interpretation";
import { createResumeWorkspace } from "../src/domain/resume-generation/resume-workspace-commands";
import { openDatabase } from "../src/persistence/database";

const connection={configurationRevisionId:createUuidV7(),configurationDigest:`sha256:${'a'.repeat(64)}`,modelIdentifier:"fixture-model"};
const task={category:"Failure Recovery",question:"How did the importer recover after a failed write?"};

test("dynamic planner sends complete evidence, correct persona and stateless bounded request",async()=>{
 for(const category of ["project","experience"] as const){
  let packet:Record<string,unknown>|undefined;
  const facts="Built an importer with atomic writes. Candidate-provided role: Automation Developer; Candidate-provided start date: 2024-01; Candidate-provided end date: 2025-04. "+"x".repeat(40000);
  const fetcher=async(url:string,init:RequestInit)=>{assert.equal(url,"http://127.0.0.1:1234/api/v1/chat");packet=JSON.parse(String(init.body));return Response.json({output:[{type:"message",content:JSON.stringify({tasks:[task]})}]});};
  const result=await planClarifications("Tool",facts,category,{connection,request:(c,input)=>requestClarificationPlan(c,input,fetcher)});
  assert.deepEqual(result,[task]);assert.ok(packet);assert.equal(packet.store,false);assert.equal(packet.stream,false);assert.equal(packet.max_output_tokens,1800);assert.equal(packet.reasoning,"off");assert.equal(packet.tools,undefined);assert.equal(packet.previous_response_id,undefined);
  assert.match(String(packet.system_prompt),category==='experience'?/Engineering Manager/:/Principal\/Staff Engineer/);assert.equal(JSON.parse(String(packet.input)).facts,facts);assert.match(String(packet.system_prompt),/Candidate-provided context.*established user-provided information/);assert.match(String(packet.system_prompt),/do not ask for those values again unless the evidence explicitly conflicts/);
 }
});

test("planner validates flexible categories without a fixed list and rejects malformed or duplicate plans",()=>{
 for(const category of ["API Ergonomics","Team Decision Process","Cross-Functional Delivery","Domain Knowledge"]){assert.deepEqual(validateClarificationPlan({tasks:[{...task,category}]}),[{...task,category}]);}
 assert.deepEqual(validateClarificationPlan({tasks:[]}),[]);
 for(const output of [{},[],{tasks:[{...task,category:"ownership"}]},{tasks:[task,{...task,category:"failure recovery"}]},{tasks:[{...task,question:"x".repeat(601)}]},{tasks:[task],extra:true},{tasks:Array.from({length:9},()=>task)}])assert.throws(()=>validateClarificationPlan(output),/clarification questions/);
 assert.doesNotMatch(buildClarificationPlanningPrompt({name:"Tool",category:"project",facts:""}),/users_workflow|purpose.*ownership/);
});

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),"ai-clarification-")),appDataRoot=join(root,"private");const workspace=await createResumeWorkspace({appDataRoot,name:"Questions"});
 const file=join(root,"resume-evidence","projects","Tool","resume-evidence.md");await mkdir(join(file,".."),{recursive:true});await writeFile(file,"# Resume Evidence (Proposed / Unreviewed)\n\n### E-001\n- Fact: Built an importer with atomic writes.\n- Provenance: README.md, Overview, line 2\n- Explicit unknowns: Recovery behavior is not documented.\n- Status: Proposed / unreviewed\n");
 const db=openDatabase(join(appDataRoot,"workspace.sqlite"));const now=new Date().toISOString(),digest=`sha256:${'a'.repeat(64)}`;
 db.prepare("INSERT INTO evidence_library_imports(id,category,source_identity,source_digest,library_root,created_at) VALUES('import','project','tool',?,'resume-evidence',?)").run(digest,now);
 db.prepare("INSERT INTO resume_workspace_imports(workspace_id,import_id) VALUES(?,'import')").run(workspace.workspace.id);
 db.prepare("INSERT INTO evidence_library_documents(id,import_id,category,library_path,content_digest,imported_at) VALUES('doc','import','project','resume-evidence/projects/Tool/resume-evidence.md',?,?)").run(digest,now);
 return {root,appDataRoot,workspaceId:workspace.workspace.id,file,db};
}

test("AI failure leaves existing plan intact; re-planning retains answered tasks and interview history",async()=>{
 const f=await fixture();try{
  const options={appDataRoot:f.appDataRoot,workspaceRoot:f.root};
  assert.equal(await interpretWorkspaceEvidence(f.workspaceId,{...options,planner:async()=>[task]}),true);
  const tasks=()=>f.db.prepare("SELECT * FROM resume_clarification_tasks").all();const before=tasks();
  await assert.rejects(interpretWorkspaceEvidence(f.workspaceId,{...options,planner:async()=>{throw Error("offline");}}),/offline/);assert.deepEqual(tasks(),before);
  const id=String(before[0].id),now=new Date().toISOString();
  f.db.prepare("INSERT INTO resume_interview_turns(id,workspace_id,task_id,role,content,created_at) VALUES(?,?,?,'coach',?,?)").run(createUuidV7(),f.workspaceId,id,task.question,now);
  f.db.prepare("INSERT INTO resume_interview_stream_reservations(stream_request_id,workspace_id,task_id,status,created_at) VALUES(?,?,?,'started',?)").run(createUuidV7(),f.workspaceId,id,now);
  assert.equal(await interpretWorkspaceEvidence(f.workspaceId,{...options,planner:async()=>[{...task,question:"Changed question while streaming?"}]}),true);
  assert.deepEqual(tasks(),before);assert.equal(f.db.prepare("SELECT content FROM resume_interview_turns").get()?.content,task.question);
  assert.equal(await interpretWorkspaceEvidence(f.workspaceId,{...options,planner:async()=>[]}),true);assert.deepEqual(tasks(),before);assert.equal(f.db.prepare("SELECT count(*) AS n FROM resume_interview_turns").get()?.n,1);
  f.db.prepare("UPDATE resume_clarification_tasks SET status='answered' WHERE id=?").run(id);f.db.prepare("INSERT INTO resume_clarification_task_responses(id,workspace_id,task_id,disposition,answer_text,created_at) VALUES(?,?,?,'answered','Writes rolled back on errors.',?)").run(createUuidV7(),f.workspaceId,id,now);
  assert.equal(await interpretWorkspaceEvidence(f.workspaceId,{...options,planner:async(_name,facts)=>{assert.match(facts,/Writes rolled back on errors/);return [];}}),true);assert.equal(tasks()[0].status,"answered");
 }finally{f.db.close();await rm(f.root,{recursive:true,force:true});}
});

test("source changes during planning reject the stale result without persisting it",async()=>{
 const f=await fixture();try{
  assert.equal(await interpretWorkspaceEvidence(f.workspaceId,{appDataRoot:f.appDataRoot,workspaceRoot:f.root,planner:async()=>{await writeFile(f.file,"Changed source");return [task];}}),false);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM resume_clarification_tasks").get()?.n,0);
 }finally{f.db.close();await rm(f.root,{recursive:true,force:true});}
});

test("interview changes during planning reject the stale result",async()=>{
 const f=await fixture();try{
  const options={appDataRoot:f.appDataRoot,workspaceRoot:f.root};await interpretWorkspaceEvidence(f.workspaceId,{...options,planner:async()=>[task]});
  assert.equal(await interpretWorkspaceEvidence(f.workspaceId,{...options,planner:async()=>{f.db.prepare("UPDATE resume_clarification_tasks SET status='skipped'").run();return [{category:"Another Context",question:"Another question?"}];}}),false);
  assert.equal(f.db.prepare("SELECT category FROM resume_clarification_tasks").get()?.category,"Failure Recovery");assert.equal(f.db.prepare("SELECT status FROM resume_clarification_tasks").get()?.status,"skipped");
 }finally{f.db.close();await rm(f.root,{recursive:true,force:true});}
});

test("plan-only retry recovers a saved planning failure without reimporting or hiding a folder failure",async()=>{
 const {retryClarificationPlanning,clarificationPlanningFailurePrefix}=await import('../src/application/resume-generation/retry-clarification-planning');
 const {candidateContextSection}=await import('../src/domain/evidence/evidence-item-context');
 const f=await fixture();try{
  const id=createUuidV7(),now=new Date().toISOString();
  f.db.prepare("INSERT INTO resume_evidence_intakes(id,workspace_id,status,message,created_at,updated_at) VALUES(?,?,'failed',?,?,?)").run(id,f.workspaceId,clarificationPlanningFailurePrefix+' Local AI unavailable.',now,now);
  const options={appDataRoot:f.appDataRoot,workspaceRoot:f.root,planner:async()=>[task]};
  await assert.rejects(retryClarificationPlanning(f.workspaceId,{...options,planner:async()=>{throw Error('offline');}}),/offline/);assert.equal(f.db.prepare("SELECT status FROM resume_evidence_intakes WHERE id=?").get(id)?.status,'failed');
  await retryClarificationPlanning(f.workspaceId,options);assert.equal(f.db.prepare("SELECT status FROM resume_evidence_intakes WHERE id=?").get(id)?.status,'ready');assert.equal(f.db.prepare("SELECT count(*) AS n FROM evidence_library_imports").get()?.n,1);
  f.db.prepare("UPDATE resume_evidence_intakes SET status='failed',message='Folder could not be read.' WHERE id=?").run(id);await retryClarificationPlanning(f.workspaceId,options);assert.equal(f.db.prepare("SELECT status FROM resume_evidence_intakes WHERE id=?").get(id)?.status,'failed');
  assert.match(candidateContextSection({role:'Automation Developer',startDate:'2024-01',endDate:'2025-04'}),/Candidate-provided role: Automation Developer/);assert.throws(()=>candidateContextSection({role:'Developer\nFake heading'}),/invalid/);
 }finally{f.db.close();await rm(f.root,{recursive:true,force:true});}
});
