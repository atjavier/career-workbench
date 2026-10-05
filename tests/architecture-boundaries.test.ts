import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import test from "node:test";
import ts from "typescript";

async function files(root: string): Promise<string[]> {
 const entries=await readdir(root,{withFileTypes:true});return (await Promise.all(entries.map(entry=>entry.isDirectory()?files(join(root,entry.name)):Promise.resolve(entry.name.endsWith('.ts')||entry.name.endsWith('.tsx')?[join(root,entry.name)]:[])))).flat();
}
test("domain modules do not depend on application services or concrete adapters",async()=>{
 for(const file of await files("src/domain")){
  const source=ts.createSourceFile(file,await readFile(file,"utf8"),ts.ScriptTarget.Latest,true);
  function walk(node: ts.Node){if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){
   const spec=node.moduleSpecifier;if(spec&&ts.isStringLiteral(spec)){const target=spec.text.startsWith('@/')?resolve('src',spec.text.slice(2)):resolve(dirname(file),spec.text);assert.ok(!target.startsWith(resolve('src/application'))&&!target.startsWith(resolve('src/adapters')),`${file} imports ${spec.text}`);}
  }ts.forEachChild(node,walk);}walk(source);
 }
});
test("feature gateway modules have no circular static dependencies",async()=>{
 const root=resolve('src/adapters/local-model');const graph=new Map<string,string[]>();
 for(const file of await files(root)){
  const source=ts.createSourceFile(file,await readFile(file,'utf8'),ts.ScriptTarget.Latest,true);const deps:string[]=[];
  for(const statement of source.statements){if(!ts.isImportDeclaration(statement)&&!ts.isExportDeclaration(statement))continue;if(ts.isImportDeclaration(statement)&&statement.importClause?.isTypeOnly)continue;const spec=statement.moduleSpecifier;if(!spec||!ts.isStringLiteral(spec))continue;const target=spec.text.startsWith('@/')?resolve('src',spec.text.slice(2)+'.ts'):resolve(dirname(file),spec.text+'.ts');if(target.startsWith(root))deps.push(target);}
  graph.set(resolve(file),deps);
 }
 const done=new Set<string>();function visit(file:string,path:string[]){assert.ok(!path.includes(file),`Circular adapter dependency: ${[...path,file].join(' -> ')}`);if(done.has(file))return;for(const next of graph.get(file)??[])visit(next,[...path,file]);done.add(file);}for(const file of graph.keys())visit(file,[]);
});
