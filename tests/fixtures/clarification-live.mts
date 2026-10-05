import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const { createUuidV7 } = require("../../src/audit/audit-event.ts");
const { createResumeWorkspace } = require("../../src/domain/resume-generation/resume-workspace-commands.ts");
const { openDatabase } = require("../../src/persistence/database.ts");
const { clarificationPlanningFailurePrefix } = require("../../src/application/resume-generation/retry-clarification-planning.ts");

const root=process.env.DRAFT_TEST_ROOT;
if(!root?.startsWith('/private/tmp/opportunity-draft-live.'))throw Error('Isolated test root required');
const appDataRoot=join(root,'PersonalJobDiscovery');
const workspace=await createResumeWorkspace({appDataRoot,name:'Public clarification fixture'});
const directory=join(root,'resume-evidence','workspaces',workspace.workspace.id,'projects','FixtureTool');await mkdir(directory,{recursive:true});
const artifacts={
 'project-overview.md':'# FixtureTool\n\nBuilt a local SQLite importer for CSV records.\n',
 'resume-summary.md':'# Resume Summary\n\nA local importer validates CSV fields and writes valid rows atomically to SQLite.\n',
 'resume-evidence.md':'# Resume Evidence (Proposed / Unreviewed)\n\n### E-001\n- Fact: Built a local importer that validates CSV fields and writes records atomically to SQLite.\n- Provenance: README.md, Overview, line 2\n- Explicit unknowns: Individual contribution, use and recovery behavior are not established.\n- Status: Proposed / unreviewed\n',
 'resume-bullet-candidates.md':'# Resume Bullet Candidates (Proposed / Unreviewed)\n\n- No approved resume claims yet.\n',
};
const db=openDatabase(join(appDataRoot,'workspace.sqlite')),now=new Date().toISOString(),digest=`sha256:${'a'.repeat(64)}`;
try{
 const importId=createUuidV7();db.prepare("INSERT INTO evidence_library_imports(id,category,source_identity,source_digest,library_root,created_at) VALUES(?,'project','public-fixture',?,'resume-evidence',?)").run(importId,digest,now);
 db.prepare('INSERT INTO resume_workspace_imports(workspace_id,import_id) VALUES(?,?)').run(workspace.workspace.id,importId);
 for(const [name,text] of Object.entries(artifacts)){await writeFile(join(directory,name),text);db.prepare("INSERT INTO evidence_library_documents(id,import_id,category,library_path,content_digest,imported_at) VALUES(?,?,'project',?,?,?)").run(createUuidV7(),importId,`resume-evidence/workspaces/${workspace.workspace.id}/projects/FixtureTool/${name}`,digest,now);}
 db.prepare("INSERT INTO resume_evidence_intakes(id,workspace_id,status,message,created_at,updated_at) VALUES(?,?,'failed',?,?,?)").run(createUuidV7(),workspace.workspace.id,clarificationPlanningFailurePrefix+' Local AI is not configured.',now,now);
 console.log(JSON.stringify({workspaceId:workspace.workspace.id,root}));
}finally{db.close();}
