// F5: physical project folders, copied orders, retries and restart recovery; synthetic files only.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const D=require('../buero/data.js'),{Dir}=require('./buero.cjs');
async function tree(dir){const out={};for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);out[e.name]=e.isDirectory()?await tree(p):(await fs.readFile(p)).toString();}return out;}
async function run(){
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'buero-f5-'));
 try{
  const archive=new Dir(tmp),a=await archive.getDirectoryHandle('26.0101 Muster A',{create:true}),b=await archive.getDirectoryHandle('26.0999 Muster B',{create:true});
  const content={project:{name:b.name,nr:'26.0999',ort:'Muster B'},word:'Mitteilungen/Gutachten.docx',who:'QA',note:'synthetisch',instruction:'Prüfen',recipients:[{id:'r1',group:'versicherung',label:'Auftraggeber',details:'Musterempfänger'}]};
  const order=D.order(content);await D.create(b,order);const record=await D.load(b,order.id),question=D.event(record,'question',{text:'Bitte prüfen'},'QA');
  await fs.cp(path.join(b.path,'_Buero'),path.join(a.path,'_Buero'),{recursive:true});const before=await tree(tmp);
  await assert.rejects(D.load(a,order.id),/Projektzuordnung blockiert.*26\.0999.*26\.0101/);
  const scan=await D.scanProject(a);assert.equal(scan.records.length,0);assert.match(scan.errors.join(' '),/Projektzuordnung blockiert/);
  await assert.rejects(D.append(a,question),/Projektzuordnung blockiert/);
  await assert.rejects(D.create(a,D.order(content)),/Projektzuordnung blockiert/);
  assert.deepEqual(await tree(tmp),before,'copied order must cause no writes in A or B, including no empty files');
  // Match both fields independently, even when the number itself is correct.
  for(const project of [{...content.project,nr:'26.0101'},{...content.project,name:a.name}]){
   await assert.rejects(D.create(b,D.order({...content,project})),/Projektzuordnung blockiert/);
  }
  const changed=D.event(record,'revise',{content:{...content,project:{name:a.name,nr:'26.0101',ort:'Muster A'}}},'QA');
  await assert.rejects(D.append(b,changed),/Projektzuordnung blockiert/);assert.deepEqual(await tree(tmp),before);
  // A mismatched historical revision cannot be hidden by a later matching revision.
  const reviseName='rueckmeldung-'+changed.id+'.json',dir=path.join(b.path,'_Buero',order.id);
  await fs.writeFile(path.join(dir,reviseName),JSON.stringify(changed));
  const repaired=D.event({...record,heads:[changed.id]},'revise',{content},'QA');
  await fs.writeFile(path.join(dir,'rueckmeldung-'+repaired.id+'.json'),JSON.stringify(repaired));
  await assert.rejects(D.load(b,order.id),/Projektzuordnung blockiert/);
  await fs.unlink(path.join(dir,reviseName));await fs.unlink(path.join(dir,'rueckmeldung-'+repaired.id+'.json'));
  // Run the actual office retry function, including the restart case with no in-memory handle.
  const source=await fs.readFile(path.join(__dirname,'../buero/office.js'),'utf8'),start=source.indexOf('async function savePending()'),end=source.indexOf('\nasync function retry()',start);
  assert.ok(start>=0&&end>start);
  const P=require('../buero/pending.js'),{Handle,storage}=require('./buero-n1.cjs'),db=storage(),pendingStore=P.create(db),boundArchive=new Handle(tmp),boundB=new Handle(b.path);
  async function retry(pending,pendingProject){
   const state={archive:boundArchive,pending,pendingProject};
   if(pendingProject)state.archive=new Handle(tmp+'-different');
   const context=vm.createContext({D,state,pendingStore,BueroPending:P,sessionStorage:{removeItem(){}},message(){}});
   vm.runInContext(source.slice(start,end),context);await context.savePending();return state;
  }
  const pending={project:a.name,order,data:question};
  await assert.rejects(retry(pending),/Projektzuordnung blockiert/);assert.deepEqual(await tree(tmp),before);
  // Legacy pending payloads also cannot redirect to B while the conflicting copy exists in A.
  await assert.rejects(retry({project:b.name,data:question}),/Projektzuordnung blockiert/);assert.deepEqual(await tree(tmp),before);
  await fs.rm(path.join(a.path,'_Buero'),{recursive:true});
  await assert.rejects(retry({project:a.name,order,data:question}),/Projektzuordnung blockiert/);
  // Even an archive reconnection may not replace an already bound physical handle.
  const bound=await pendingStore.prepare(boundArchive,boundB,order,question);
  await assert.rejects(retry(bound,{isSameEntry:async()=>false}),/Archivordner.*gewechselt/);
  const orderFile=path.join(dir,'auftrag.json'),original=await fs.readFile(orderFile,'utf8');
  await fs.writeFile(orderFile,JSON.stringify({...order,created:'2000-01-01'}));await assert.rejects(retry(bound),/ausgetauscht/);await fs.writeFile(orderFile,original);
  // Empty files left by a failed write must remain retryable, but only for this exact attempt.
  await fs.writeFile(path.join(dir,'rueckmeldung-'+question.id+'.json'),'');
  await assert.rejects(D.load(b,order.id),/Unvollständige/);
  const finish=pendingStore.finish;pendingStore.finish=async()=>{throw Error('cleanup interrupted');};
  await assert.rejects(retry(bound),/cleanup interrupted/);pendingStore.finish=finish;
  const restored=await retry(bound);assert.equal(restored.pending,null);
  assert.equal((await D.load(b,order.id)).question,'Bitte prüfen');
  const after=await tree(tmp);await assert.rejects(retry({project:b.name,order,data:question}),/Projektzuordnung blockiert/);assert.deepEqual(await tree(tmp),after);
  // N1 deliberately closes the unsafe pre-F5/F5 name-based migration. Explicit new verified attempt required.
  const answer=D.event(await D.load(b,order.id),'answer',{text:'Geklärt'},'QA');await assert.rejects(retry({project:b.name,data:answer}),/Projektzuordnung blockiert/);
  await retry(await pendingStore.prepare(boundArchive,boundB,order,answer));assert.equal((await D.load(b,order.id)).question,'');
  console.log('OK F5/N1: kopierter Büroauftrag B in A blockiert; Nummer und Name, historische Änderungen, unveränderliche Ordnerbindung, alte Versuche sicher blockiert, gültiger Neustart-Retry und leere eigene Rückmeldedatei geprüft');
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
}
module.exports={run};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
