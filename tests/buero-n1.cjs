// N1: execute the actual office writer, with durable handle storage modelled across sessions.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const D=require('../buero/data.js'),Pending=require('../buero/pending.js'),{Dir}=require('./buero.cjs');
const root=path.resolve(process.env.N1_SOURCE_ROOT||path.join(__dirname,'..'));
class Handle extends Dir{
 constructor(p,fault){super(p,fault);try{const s=require('node:fs').statSync(p);this.identity=s.dev+':'+s.ino;}catch{this.identity=null;}}
 async getDirectoryHandle(n,o){const h=await super.getDirectoryHandle(n,o);return new Handle(h.path,this.fault);}
 async isSameEntry(h){return !!this.identity&&h?.identity===this.identity;}
 async resolve(h){try{const s=await fs.stat(h.path);if(s.dev+':'+s.ino!==h.identity)return null;}catch{return null;}const rel=path.relative(this.path,h.path);return rel&&!rel.startsWith('..')&&!path.isAbsolute(rel)?rel.split(path.sep):null;}
}
const clone=v=>v instanceof Handle?Object.assign(new Handle(v.path,v.fault),{identity:v.identity}):Array.isArray(v)?v.map(clone):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clone(x)])):v;
function storage(){const values=new Map();return {values,fail:false,async get(k){if(this.fail)throw Error('IDB read failed');return clone(values.get(k));},async put(k,v){if(this.fail)throw Error('IDB write failed');values.set(k,clone(v));},async remove(k){if(this.fail)throw Error('IDB delete failed');values.delete(k);},async keys(){return [...values.keys()];}};}
async function writer(archive,db){
 const source=await fs.readFile(path.join(root,'buero/office.js'),'utf8'),start=source.indexOf('async function savePending()'),end=source.indexOf('\nasync function retry()',start);
 assert.ok(start>=0&&end>start);const pendingStore=Pending.create(db),state={archive,pending:null};
 const ctx=vm.createContext({D,state,pendingStore,BueroPending:Pending,sessionStorage:{removeItem(){}},message(){}});vm.runInContext(source.slice(start,end),ctx);
 return {state,pendingStore,async retry(p){state.pending=clone(p);await ctx.savePending();}};
}
async function tree(dir){const out={};for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);out[e.name]=e.isDirectory()?await tree(p):(await fs.readFile(p)).toString();}return out;}
async function run(){
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'buero-n1-'));let checks=0;
 try{
  const archive=new Handle(tmp),a=await archive.getDirectoryHandle('26.0101 Muster A',{create:true}),b=await archive.getDirectoryHandle('26.0999 Muster B',{create:true}),db=storage();
  const content={project:{name:b.name,nr:'26.0999',ort:'Muster B'},word:'Mitteilungen/Gutachten.docx',who:'QA',note:'synthetisch',instruction:'Prüfen',recipients:[{id:'r1',group:'versicherung',label:'Auftraggeber',details:'Musterempfänger'}]};
  const order=D.order(content);await D.create(b,order);const r=await D.load(b,order.id),question=D.event(r,'question',{text:'N1 Rückfrage'},'QA');
  await fs.cp(path.join(b.path,'_Buero'),path.join(a.path,'_Buero'),{recursive:true});
  const initial=await tree(tmp);await assert.rejects(D.load(a,order.id),/Projektzuordnung blockiert/);assert.deepEqual(await tree(tmp),initial);checks++;
  // Persist the old format exactly as the affected F5 client did. There is no source handle.
  const oldAttempt=JSON.parse(JSON.stringify({project:b.name,order,data:question}));
  await fs.rm(path.join(a.path,'_Buero'),{recursive:true});let before=await tree(tmp);
  const reopened=await writer(archive,db);let error;try{await reopened.retry(oldAttempt);}catch(e){error=e;}
  assert.deepEqual(await tree(tmp),before,'N1: after deleting the A copy, no feedback may appear in A or B');
  assert.match(error?.message||'',/Projektzuordnung blockiert/);assert.deepEqual(reopened.state.pending,oldAttempt);checks++;
  for(const p of [{project:b.name,data:question},{project:a.name,order,data:question},{...oldAttempt,version:1,attempt:crypto.randomUUID()}]){await assert.rejects(reopened.retry(p),/Projektzuordnung blockiert/);assert.deepEqual(await tree(tmp),before);checks++;}
  const p=await reopened.pendingStore.prepare(archive,b,order,question);assert.equal((await reopened.pendingStore.list()).length,1);before=await tree(tmp);checks++;
  const fresh=await writer(new Handle(tmp),db); // no live in-memory source handle survives this boundary
  const receiptFile=path.join(b.path,'_Buero','herkunft-'+p.attempt+'.json'),receiptText=await fs.readFile(receiptFile,'utf8');
  await fs.unlink(receiptFile);await assert.rejects(fresh.retry(p),/Herkunftsnachweis fehlt/);assert.equal(await fs.access(receiptFile).then(()=>true,()=>false),false);checks++;
  await fs.writeFile(receiptFile,'damaged');const damaged=await tree(tmp);await assert.rejects(fresh.retry(p),/Herkunftsnachweis fehlt/);assert.deepEqual(await tree(tmp),damaged);await fs.writeFile(receiptFile,receiptText);checks++;
  await assert.rejects(fresh.retry({...p,data:{...p.data,actor:'OTHER'}}),/Projektzuordnung blockiert/);assert.deepEqual(await tree(tmp),before);checks++;
  const otherArchive=await archive.getDirectoryHandle('other-archive',{create:true});
  const moved=await writer(otherArchive,db);await assert.rejects(moved.retry(p),/Archivordner gewechselt/);checks++;
  await fs.rmdir(otherArchive.path);
  const dir=path.join(b.path,'_Buero',order.id),filename=path.join(dir,'rueckmeldung-'+question.id+'.json'),orderFile=path.join(dir,'auftrag.json'),text=await fs.readFile(orderFile,'utf8');
  await fs.writeFile(orderFile,'broken');await assert.rejects(fresh.retry(p),/nicht vollständig geprüft/);assert.equal(await fs.readFile(orderFile,'utf8'),'broken');checks++;
  await fs.writeFile(orderFile,JSON.stringify({...order,created:'2000-01-01T00:00:00.000Z'}));await assert.rejects(fresh.retry(p),/ausgetauscht/);checks++;
  await fs.writeFile(orderFile,text);await fs.rename(b.path,b.path+'-missing');
  await assert.rejects(fresh.retry(p),/Projektzuordnung blockiert/);assert.deepEqual(await fs.readdir(a.path),[]);checks++;
  await fs.mkdir(b.path);await fs.cp(path.join(b.path+'-missing','_Buero'),path.join(b.path,'_Buero'),{recursive:true});
  const replacement=await tree(b.path);await assert.rejects(fresh.retry(p),/Projektzuordnung blockiert/);assert.deepEqual(await tree(b.path),replacement);checks++;
  await fs.rm(b.path,{recursive:true});
  await fs.rename(b.path+'-missing',b.path);
  // A retained native handle must not be replaced by a different directory with the same name.
  const stored=[...db.values.values()][0],savedHandle=stored.project;stored.project={name:b.name};
  await assert.rejects(fresh.retry(p),/Projektzuordnung blockiert/);stored.project=savedHandle;checks++;
  await fs.writeFile(filename,'');await assert.rejects(D.load(b,order.id),/Unvollständige/);
  // Commit acknowledgement lost: the shared event succeeds, local cleanup fails. Retry stays idempotent.
  const finish=fresh.pendingStore.finish;fresh.pendingStore.finish=async()=>{throw Error('IDB delete failed');};
  await assert.rejects(fresh.retry(p),/IDB delete failed/);assert.equal((await D.load(b,order.id)).question,'N1 Rückfrage');checks++;
  const after=await tree(tmp);fresh.pendingStore.finish=finish;const again=await writer(new Handle(tmp),db);await again.retry(p);assert.equal(again.state.pending,null);assert.deepEqual(await tree(tmp),after);assert.equal((await again.pendingStore.list()).length,0);checks++;
  await assert.rejects(again.retry(p),/Projektzuordnung blockiert/);assert.deepEqual(await tree(tmp),after);checks++;
  const answer=D.event(await D.load(b,order.id),'answer',{text:'Geklärt'},'QA'),q=await again.pendingStore.prepare(archive,b,order,answer),afterPrepared=await tree(tmp);
  db.fail=true;await assert.rejects(again.retry(q),/IDB read failed/);assert.deepEqual(await tree(tmp),afterPrepared);await assert.rejects(again.pendingStore.prepare(archive,b,order,answer),/IDB write failed/);db.fail=false;checks+=2;
  // Explicit discard affects only local storage, never shared project files.
  await again.pendingStore.discard(q);await again.pendingStore.discard(oldAttempt);assert.deepEqual(await tree(tmp),afterPrepared);checks++;
  // Receipt write interruption never creates an event; its durable attempt can only be inspected/discarded.
  const faultyB=new Handle(b.path,{write:true}),faultDB=storage(),faultStore=Pending.create(faultDB);
  await assert.rejects(faultStore.prepare(archive,faultyB,order,answer),/Schreibfehler/);
  const incomplete=(await faultStore.list())[0];assert.ok(incomplete);await assert.rejects((await writer(archive,faultDB)).retry(incomplete),/Herkunftsnachweis fehlt/);
  assert.equal((await D.load(b,order.id)).events.length,1);checks++;
  console.log('OK N1: '+checks+' cases; copied-order deletion, unproven legacy attempts, durable exact payload/handle binding, archive change, corrupt/exchanged/missing source, IDB failure, restart, own empty file and idempotent retry; synthetic files only');
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
}
module.exports={run,writer,storage,Handle};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
