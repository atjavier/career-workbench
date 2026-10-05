import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import test from "node:test";
const run=promisify(execFile),launcher=resolve('scripts/run-local.mjs');

test("production launcher uses standalone with loopback binding and a stable writable workspace",async()=>{
 const root=await mkdtemp(join(tmpdir(),'standalone-launch-'));try{
  await mkdir(join(root,'.next','standalone'),{recursive:true});await writeFile(join(root,'.next','standalone','server.js'),"console.log(JSON.stringify({hostname:process.env.HOSTNAME,workspace:process.env.CAREER_WORKBENCH_WORKSPACE_ROOT}));");
  const result=await run(process.execPath,[launcher,'start'],{cwd:root,env:{...process.env,HOSTNAME:'0.0.0.0',CAREER_WORKBENCH_WORKSPACE_ROOT:''}});const output=JSON.parse(result.stdout);assert.equal(output.hostname,'127.0.0.1');assert.equal(await realpath(output.workspace),await realpath(root));
  const second=await run(process.execPath,[launcher,'start'],{cwd:root,env:{...process.env,CAREER_WORKBENCH_WORKSPACE_ROOT:root}});assert.equal(JSON.parse(second.stdout).workspace,root);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("production launcher reports a missing build before spawning",async()=>{
 const root=await mkdtemp(join(tmpdir(),'standalone-missing-'));try{await assert.rejects(run(process.execPath,[launcher,'start'],{cwd:root}),/Production build is missing/);}finally{await rm(root,{recursive:true,force:true});}
});
