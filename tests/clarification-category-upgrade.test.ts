import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createUuidV7 } from "../src/audit/audit-event";
import { createResumeWorkspace } from "../src/domain/resume-generation/resume-workspace-commands";
import { applyMigrations, openDatabase } from "../src/persistence/database";

const migration = "0049_flexible_clarification_categories";
function installLegacyChecks(db: ReturnType<typeof openDatabase>) {
  db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE");
  for (const table of ["resume_clarification_tasks", "resume_clarified_evidence"]) {
    const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(table) as { sql: string }).sql;
    const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name=? AND type='index' AND sql IS NOT NULL").all(table) as {sql:string}[];
    db.exec(`DROP TABLE ${table}`);
    db.exec(sql.replace(/\bcategory TEXT NOT NULL\b/, "category TEXT NOT NULL CHECK (category IN ('purpose','ownership','metrics'))"));
    for (const index of indexes) db.exec(index.sql);
  }
  db.prepare("DELETE FROM schema_migrations WHERE id=?").run(migration);
  db.exec("COMMIT; PRAGMA foreign_keys=ON");
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "category-upgrade-"));
  const workspace = await createResumeWorkspace({appDataRoot:root,name:"Upgrade evidence"});
  const db = openDatabase(join(root,"workspace.sqlite"));
  installLegacyChecks(db);
  const ids = Array.from({length:9},createUuidV7); const now = new Date().toISOString(); const ws = workspace.workspace.id;
  db.prepare("INSERT INTO resume_clarification_tasks(id,workspace_id,item_key,item_name,item_category,category,question,status,created_at) VALUES(?,?,'project:Tool','Tool','project','ownership','What did you contribute?','answered',?)").run(ids[0],ws,now);
  db.prepare("INSERT INTO resume_clarification_task_responses(id,workspace_id,task_id,disposition,answer_text,created_at) VALUES(?,?,?,'answered','I built the importer.',?)").run(ids[1],ws,ids[0],now);
  db.prepare("INSERT INTO resume_clarified_evidence(id,workspace_id,task_id,response_id,item_key,item_name,item_category,category,candidate_text,provenance,created_at) VALUES(?,?,?,?,'project:Tool','Tool','project','ownership','I built the importer.','candidate_interview_answer',?)").run(ids[2],ws,ids[0],ids[1],now);
  db.prepare("INSERT INTO resume_evidence_interpretations(id,workspace_id,item_key,item_name,item_category,kind,content,evidence_document_path,created_at) VALUES(?,?,'project:Tool','Tool','project','direct_fact','Built an importer.','tool/resume-evidence.md',?)").run(ids[3],ws,now);
  db.prepare("INSERT INTO resume_clarified_evidence_conflicts(id,workspace_id,clarified_evidence_id,documented_interpretation_id,created_at) VALUES(?,?,?,?,?)").run(ids[4],ws,ids[2],ids[3],now);
  db.prepare("INSERT INTO resume_interview_turns(id,workspace_id,task_id,role,content,created_at) VALUES(?,?,?,'coach','What did you contribute?',?)").run(ids[5],ws,ids[0],now);
  db.prepare("INSERT INTO resume_interview_candidate_turns(id,workspace_id,task_id,content,created_at) VALUES(?,?,?,'I built the importer.',?)").run(ids[6],ws,ids[0],now);
  db.prepare("INSERT INTO resume_interview_stream_reservations(stream_request_id,workspace_id,task_id,status,created_at) VALUES(?,?,?,'completed',?)").run(ids[7],ws,ids[0],now);
  db.exec("CREATE TABLE migration_probe(value TEXT); CREATE INDEX retained_task_index ON resume_clarification_tasks(item_name); CREATE TRIGGER retained_task_trigger AFTER UPDATE ON resume_clarification_tasks BEGIN INSERT INTO migration_probe(value) VALUES(new.category); END;");
  return {root,db,ws,ids};
}
const retained = ["resume_clarification_tasks","resume_clarification_task_responses","resume_clarified_evidence","resume_clarified_evidence_conflicts","resume_interview_turns","resume_interview_candidate_turns","resume_interview_stream_reservations"];

test("installed category upgrade preserves dependent rows, indexes, triggers and flexible writes",async()=>{
  const f=await fixture();try{
    const before=retained.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all());
    applyMigrations(f.db);
    assert.deepEqual(retained.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all()),before);
    assert.equal(f.db.prepare("PRAGMA foreign_keys").get()?.foreign_keys,1);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(),[]);
    f.db.prepare("UPDATE resume_clarification_tasks SET category='Failure Recovery' WHERE id=?").run(f.ids[0]);
    f.db.prepare("UPDATE resume_clarified_evidence SET category='Failure Recovery' WHERE id=?").run(f.ids[2]);
    assert.equal(f.db.prepare("SELECT value FROM migration_probe").get()?.value,"Failure Recovery");
    assert.ok(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='retained_task_index'").get());
    applyMigrations(f.db);assert.equal(f.db.prepare("SELECT count(*) AS n FROM schema_migrations WHERE id=?").get(migration)?.n,1);
  }finally{f.db.close();await rm(f.root,{recursive:true,force:true});}
});

test("upgrade failure rolls back schema and rows and restores foreign-key enforcement",async()=>{
  const f=await fixture();try{
    f.db.exec("PRAGMA foreign_keys=OFF");f.db.prepare("UPDATE resume_interview_turns SET task_id=?").run(createUuidV7());f.db.exec("PRAGMA foreign_keys=ON");
    const before=retained.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all());
    assert.throws(()=>applyMigrations(f.db),/foreign-key validation/);
    assert.deepEqual(retained.map(t=>f.db.prepare(`SELECT * FROM ${t}`).all()),before);
    assert.equal(f.db.prepare("PRAGMA foreign_keys").get()?.foreign_keys,1);
    assert.equal(f.db.prepare("SELECT 1 FROM schema_migrations WHERE id=?").get(migration),undefined);
    assert.throws(()=>f.db.prepare("UPDATE resume_clarification_tasks SET category='Failure Recovery'").run(),/CHECK/);
    assert.ok(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='retained_task_trigger'").get());
  }finally{f.db.close();await rm(f.root,{recursive:true,force:true});}
});

test("fresh databases accept flexible categories with foreign keys enabled",async()=>{
  const root=await mkdtemp(join(tmpdir(),"category-fresh-"));try{
    const workspace=await createResumeWorkspace({appDataRoot:root,name:"Fresh"});const db=openDatabase(join(root,"workspace.sqlite"));try{
      applyMigrations(db);db.prepare("INSERT INTO resume_clarification_tasks(id,workspace_id,item_key,item_name,item_category,category,question,created_at) VALUES(?,?,'project:X','X','project','API Ergonomics','How was the API designed?',?)").run(createUuidV7(),workspace.workspace.id,new Date().toISOString());
      assert.equal(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys,1);assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
    }finally{db.close();}
  }finally{await rm(root,{recursive:true,force:true});}
});
