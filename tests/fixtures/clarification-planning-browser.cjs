const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),{join}=require('node:path'),{DatabaseSync}=require('node:sqlite'),{execFileSync}=require('node:child_process');
app.disableHardwareAcceleration();app.whenReady().then(async()=>{
 const target=new URL(process.env.DRAFT_PAGE_URL);assert.equal(target.hostname,'127.0.0.1');const root=process.env.DRAFT_TEST_ROOT;assert.ok(root?.startsWith('/private/tmp/opportunity-draft-live.'));
 const win=new BrowserWindow({show:false,width:1280,height:900,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 const run=c=>win.webContents.executeJavaScript(c),wait=async c=>{for(let n=0;n<3000;n++){if(await run(c))return;await new Promise(r=>setTimeout(r,50));}throw Error('Missing state '+c);};
 const url=path=>new URL(path,target).href;
 try{
  for(const width of [1280,320]){
   win.setSize(width,900);const db=new DatabaseSync(join(root,'PersonalJobDiscovery','workspace.sqlite'));db.prepare('UPDATE resume_generation_state SET current_model_configuration_revision_id=NULL,revision_number=revision_number+1,updated_at=? WHERE singleton=1').run(new Date().toISOString());db.prepare("UPDATE resume_evidence_intakes SET status='failed',message='Your evidence is saved, but questions could not be prepared. Local AI is not configured.'").run();db.close();
   await win.loadURL(url('/resume/interview'));await wait(`document.body.innerText.includes('Read evidence again')`);await run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Read evidence again').click()`);await wait(`!!document.querySelector('[role="alert"]')`);assert.match(await run(`document.querySelector('[role="alert"]').textContent`),/local AI|Local AI/);
   const setup=`const {configureLocalModel}=require('./src/domain/resume-generation/local-model-configuration-commands.ts');configureLocalModel({appDataRoot:${JSON.stringify(join(root,'PersonalJobDiscovery'))},modelIdentifier:'google/gemma-4-e4b'}).catch(e=>{console.error(e.code,e.message);process.exitCode=1;});`;
   execFileSync(process.execPath,['--import','tsx','-e',setup],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},cwd:process.cwd(),stdio:'pipe'});
   await run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Read evidence again').click()`);await wait(`document.body.innerText.includes('Reading evidence…')`);assert.equal(await run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Reading evidence…').disabled`),true);
   await wait(`document.body.innerText.includes('Prepare your resume evidence') || document.body.innerText.includes('Questions prepared from your saved evidence.')`);
   const verify=new DatabaseSync(join(root,'PersonalJobDiscovery','workspace.sqlite'));assert.equal(verify.prepare('SELECT status FROM resume_evidence_intakes').get().status,'ready');const tasks=verify.prepare('SELECT category,question FROM resume_clarification_tasks').all();assert.ok(tasks.length>0&&tasks.length<=8);for(const t of tasks){assert.ok(t.category.split(' ').length>=2&&t.category.split(' ').length<=3);assert.ok(t.question.length);}assert.equal(verify.prepare('SELECT count(*) AS n FROM evidence_library_imports').get().n,1);verify.close();
   if(await run(`Array.from(document.querySelectorAll('a')).some(a=>a.textContent==='Continue to questions')`))await run(`Array.from(document.querySelectorAll('a')).find(a=>a.textContent==='Continue to questions').click()`);await wait(`document.body.innerText.includes('Prepare your resume evidence')`);
   assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth+2`),true);
   console.log('PASS retry/AI questions at '+width);await win.loadURL(url('/evidence'));await wait(`document.body.innerText.includes('Read evidence again')`);assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth+2`),true);
  }
  console.log('PASS actual hydrated clarification retry at1280/320: failure message, disabled pending, selected Gemma AI, saved plan, no reimport, continue link and flexible categories');app.exit(0);
 }catch(error){console.error(error);console.error(await run('document.body.innerText').catch(()=>''));app.exit(1);}finally{win.destroy();}
});
