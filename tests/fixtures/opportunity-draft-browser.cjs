// Real React form, deterministic local-AI action fixtures, no private workspace access.
const { app, BrowserWindow } = require('electron');
const { build } = require('esbuild');
const assert = require('node:assert/strict');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
 const win = new BrowserWindow({show:false,width:1280,height:900,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 try {
  if (process.env.DRAFT_PAGE_URL) {
   const target=new URL(process.env.DRAFT_PAGE_URL);assert.equal(target.hostname,'127.0.0.1');
   const root=process.env.DRAFT_TEST_ROOT;assert.ok(root?.startsWith('/private/tmp/opportunity-draft-live.'));
   const run=code=>win.webContents.executeJavaScript(code);
   const wait=async code=>{for(let n=0;n<2400;n++){if(await run(code))return;await new Promise(r=>setTimeout(r,50));}throw Error('Missing live state: '+code);};
   const change=async(name,value)=>run(`(()=>{const el=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
   const click=label=>run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
   const {DatabaseSync}=require('node:sqlite');const {join}=require('node:path');
   for(const width of [1280,320]) {
    const {existsSync}=require('node:fs');const databaseFile=join(root,'PersonalJobDiscovery','workspace.sqlite');
    if(existsSync(databaseFile)){const reset=new DatabaseSync(databaseFile);reset.prepare('UPDATE resume_generation_state SET current_model_configuration_revision_id=NULL, revision_number=revision_number+1, updated_at=? WHERE singleton=1').run(new Date().toISOString());reset.close();}
    win.setSize(width,900);await win.loadURL(target.href);await wait(`!!document.querySelector('[name="postingUrl"]')`);
    const source='  Role: Live Engineer\nCompany: Live Studio '+width+'\nBuild reliable software and accessible interfaces with careful reviews and automated tests.\n';
    await change('postingUrl','https://example.test/reference?width='+width);await change('copiedDescription',source);await click('Add opportunity');
    await wait(`!!document.querySelector('[role="alert"]')`);
    assert.match(await run(`document.querySelector('[role="alert"]').textContent`),/local AI|Local AI/i);
    const db=new DatabaseSync(join(root,'PersonalJobDiscovery','workspace.sqlite'));
    assert.equal(db.prepare('SELECT count(*) AS n FROM captured_opportunities').get().n,0);db.close();
    assert.equal(await run(`!!document.querySelector('[name="title"]') || document.body.innerText.includes('Enter details manually')`),false);
    const {execFileSync}=require('node:child_process');
    const setup=`const {configureLocalModel}=require('./src/domain/resume-generation/local-model-configuration-commands.ts');configureLocalModel({appDataRoot:${JSON.stringify(join(root,'PersonalJobDiscovery'))},modelIdentifier:'google/gemma-4-e4b'}).catch(e=>{console.error(e.code,e.message);process.exitCode=1;});`;
    execFileSync(process.execPath,['--import','tsx','-e',setup],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},cwd:process.cwd(),stdio:'pipe'});
    await click('Add opportunity');try { await wait(`location.pathname.startsWith('/opportunities/') && location.search==='?added=1'`); } catch (error) { console.error(await run(`document.body.innerText`)); throw error; }
    assert.match(await run('document.body.innerText'),/Opportunity added/);
    const saved=new DatabaseSync(join(root,'PersonalJobDiscovery','workspace.sqlite'));
    assert.equal(saved.prepare('SELECT count(*) AS n FROM captured_opportunities').get().n,1);
    const revision=saved.prepare('SELECT copied_description,original_url FROM captured_opportunity_revisions ORDER BY created_at DESC LIMIT 1').get();
    assert.equal(revision.copied_description,source);assert.equal(revision.original_url,'https://example.test/reference?width='+width);
    assert.match(saved.prepare('SELECT refined_description FROM opportunity_revision_descriptions').get().refined_description,/About the role/);saved.close();
    await click('Edit opportunity');await wait(`!!document.querySelector('[name="refinedDescription"]')`);
    await change('refinedDescription','Responsibilities\n• Reviewed by the user.');await click('Save changes');try { await wait(`Array.from(document.querySelectorAll('[role="status"]')).some(el=>el.textContent.includes('Opportunity updated'))`); } catch(error){ console.error(await run('document.body.innerText')); throw error; }await click('Done');
    await wait(`!!document.querySelector('h2#opportunity-description')`);await click('Delete');await wait(`!!document.querySelector('dialog[open]')`);
    assert.equal(await run(`!!document.querySelector('dialog input:not([type="hidden"])')`),false);await click('Cancel');await wait(`!document.querySelector('dialog[open]')`);
    await click('Delete');await wait(`!!document.querySelector('dialog[open]')`);await click('Delete opportunity');await wait(`location.search.startsWith('?deleted=')`);
    const deleted=new DatabaseSync(join(root,'PersonalJobDiscovery','workspace.sqlite'));assert.equal(deleted.prepare('SELECT count(*) AS n FROM captured_opportunities').get().n,0);assert.equal(deleted.prepare('SELECT count(*) AS n FROM opportunity_revision_descriptions').get().n,0);deleted.close();
   }
   console.log('PASS live Next/SQLite at 1280/320: no record during failed generation, no manual follow-up, Add persists once, source retained exactly, edit persisted, Cancel/delete without typed confirmation');app.exit(0);return;
  }
  const bundle = await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {OpportunityCreateForm} from './src/components/jobs/opportunity-create-form'; createRoot(document.getElementById('root')).render(React.createElement(OpportunityCreateForm));`,resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-actions',setup(builder){
   builder.onLoad({filter:/src\/app\/opportunities\/actions\.ts$/},()=>({loader:'js',contents:`export async function createOpportunityAction(_,form){const values=Object.fromEntries(form.entries());window.attempts=(window.attempts||0)+1;window.aiCalls=(window.aiCalls||0)+1;await new Promise(r=>setTimeout(r,150));if(values.copiedDescription.includes('OFFLINE'))return {status:'error',summary:'Local AI is unavailable. Try adding again.',values};values.title=values.copiedDescription.includes('MISSING')?'Unknown':'Software Engineer';values.company=values.copiedDescription.includes('MISSING')?'Unknown':'Example Studio';window.saves=(window.saves||0)+1;window.saved=values;return {status:'success',summary:''};}` }));
   builder.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',resolveDir:process.cwd(),contents:`import React from 'react';export default function Link(props){return React.createElement('a',props);}`}));
  }}]});
  await win.loadURL('data:text/html,'+encodeURIComponent('<html><body><div id="root"></div></body></html>'));
  const run=code=>win.webContents.executeJavaScript(code);
  const wait=async code=>{for(let n=0;n<150;n++){if(await run(code))return;await new Promise(r=>setTimeout(r,20));}throw Error('Missing browser state: '+code);};
  const change=async(name,value)=>run(`(()=>{const el=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const click=async label=>run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  const desc='Role: Software Engineer\nCompany: Example Studio\nResponsibilities\nBuild reliable software with a collaborative team and automated tests.';
  for(const width of [1280,320]){
   win.setSize(width,900);await run('document.getElementById("root").replaceChildren();window.saves=0;window.aiCalls=0');await run(bundle.outputFiles[0].text);await wait(`!!document.querySelector('[name="postingUrl"]')`);
   assert.equal(await run(`!!document.querySelector('[name="title"]')`),false);assert.equal(await run(`document.body.innerText.includes('Generate draft') || document.body.innerText.includes('Review opportunity')`),false);
   await change('postingUrl','https://example.test/job');await change('copiedDescription',desc);await click('Add opportunity');
   assert.equal(await run(`document.querySelector('fieldset').disabled`),true);await wait(`window.saves===1`);assert.equal(await run(`window.aiCalls`),1);assert.equal(await run(`window.saved.copiedDescription`),desc);assert.equal(await run(`window.saved.title`),'Software Engineer');
   await wait(`document.querySelector('form').getAttribute('aria-busy')==='false'`);
   await change('postingUrl','https://example.test/offline');await change('copiedDescription',desc+'\nOFFLINE');await click('Add opportunity');await wait(`!!document.querySelector('[role="alert"]')`);
   assert.equal(await run(`window.saves`),1);assert.equal(await run(`document.querySelector('[name="copiedDescription"]').value`),desc+'\nOFFLINE');
   assert.equal(await run(`!!document.querySelector('[name="title"]') || !!document.querySelector('[name="company"]') || document.body.innerText.includes('Enter details manually')`),false);
   await change('copiedDescription',desc);await click('Add opportunity');await wait(`window.saves===2`);assert.equal(await run(`window.aiCalls`),3);
   await wait(`document.querySelector('form').getAttribute('aria-busy')==='false'`);
   await change('copiedDescription',desc+'\nMISSING');await click('Add opportunity');await wait(`window.saves===3`);assert.equal(await run(`window.saved.title`),'Unknown');assert.equal(await run(`document.querySelectorAll('[name="title"],[name="company"]').length`),0);
  }
  console.log('PASS hydrated direct Add at1280/320: one AI submit/save, pending locks source, no approval UI, failure retention, direct retry, unknown metadata without follow-up form');app.exit(0);
 }catch(error){console.error(error);app.exit(1);}finally{win.destroy();}
});
