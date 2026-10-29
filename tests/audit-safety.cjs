// Regression checks: real temporary folders, synthetic data only. Requires Node 24.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {stripTypeScriptTypes}=require('node:module');
const source=async(r,f)=>fs.readFile(path.join(__dirname,'..',f),'utf8');
const missing=()=>Object.assign(Error('synthetic missing file'),{name:'NotFoundError'});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
class Dir{
 constructor(p,io={}){this.p=p;this.name=path.basename(p);this.kind='directory';this.io=io;}
 async queryPermission(){return 'granted';}
 async getDirectoryHandle(n,o={}){const p=path.join(this.p,n);try{if(!(await fs.stat(p)).isDirectory())throw Object.assign(Error('not directory'),{name:'TypeMismatchError'});}catch(e){if(e.code!=='ENOENT')throw e;if(!o.create)throw missing();await fs.mkdir(p,{recursive:true});}return new Dir(p,this.io);}
 async getFileHandle(n,o={}){
  const p=path.join(this.p,n),io=this.io;if(io.beforeGet)await io.beforeGet(p,o);
  try{if(!(await fs.stat(p)).isFile())throw Object.assign(Error('not file'),{name:'TypeMismatchError'});}catch(e){if(e.code!=='ENOENT')throw e;if(!o.create)throw missing();await fs.writeFile(p,'',{flag:'a'});}
  return{name:n,kind:'file',getFile:async()=>{if(io.beforeRead)await io.beforeRead(p);const b=await fs.readFile(p),s=await fs.stat(p);return new File([b],n,{lastModified:s.mtimeMs});},createWritable:async(o={})=>{
   if(io.beforeOpen)await io.beforeOpen(p);let buf=o.keepExistingData?await fs.readFile(p):Buffer.alloc(0);
   return{write:async v=>{if(io.beforeWrite)await io.beforeWrite(p,v);let val=v&&v.type==='write'?v.data:v;let b=val instanceof Blob?Buffer.from(await val.arrayBuffer()):Buffer.from(val);if(io.transform)b=await io.transform(p,b);if(v&&v.type==='write'){const out=Buffer.alloc(Math.max(buf.length,v.position+b.length));buf.copy(out);b.copy(out,v.position);buf=out;}else buf=b;},close:async()=>{if(io.beforeClose)await io.beforeClose(p);await fs.writeFile(p,buf);if(io.afterClose)await io.afterClose(p);},abort:async()=>{}};
  }};
 }
 async *values(){for(const e of await fs.readdir(this.p,{withFileTypes:true}))yield e.isDirectory()?new Dir(path.join(this.p,e.name),this.io):await this.getFileHandle(e.name);}
 async *entries(){for await(const h of this.values())yield[h.name,h];}
 async removeEntry(n){const p=path.join(this.p,n);if(this.io.beforeRemove)await this.io.beforeRemove(p);const s=await fs.stat(p);if(s.isDirectory())await fs.rmdir(p);else await fs.unlink(p);}
}
function context(extra={}){return vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,File,Blob,console,setTimeout,clearTimeout,Date,navigator:{},...extra});}
function part(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`source anchors ${a} / ${b}`);return s.slice(i,j);}
async function fixture(fn){const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'spektron-audit-'));try{return await fn(tmp);}finally{await fs.rm(tmp,{recursive:true,force:true});}}
async function put(root,n,v){const p=path.join(root,n);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,typeof v==='string'?v:JSON.stringify(v));}
async function exists(p){return fs.access(p).then(()=>true,()=>false);}

(async()=>{
 await fixture(async tmp=>{

 const load=async()=>{const c=context();vm.runInContext(await source('','spektron-ordner.js'),c);vm.runInContext(await source('','spektron-umzug.js'),c);return c;};
 const p=path.join(tmp,'99.9001 Synthetic A');await put(p,'Abrechnung/External-export.json','SYNTHETIC EXTERNAL');
 let c=await load();await c.SpektronUmzug.projektUmziehen(new Dir(p),{});assert.equal(await fs.readFile(path.join(p,'Abrechnung/External-export.json'),'utf8'),'SYNTHETIC EXTERNAL');
 await put(p,'_Projekt.json','{"synthetic":true}');
 await c.SpektronUmzug.projektUmziehen(new Dir(p,{afterClose:async f=>{if(f.endsWith('/_Umzug.json'))await fs.unlink(path.join(p,'_Spektron/_Projekt.json'));}}),{});
 assert.ok(await exists(path.join(p,'_Projekt.json')),'original remains if verified copy disappears');
 const q=path.join(tmp,'99.9002 Synthetic B'),newest='99.9002_01-10-2026_Daten.json',older='99.9002_30-09-2026_Daten.json';
 await put(q,'Laboraufträge/'+newest,'{"synthetic":"NEW"}');await put(q,'Laboraufträge/'+older,'{"synthetic":"OLD"}');
 await fs.utimes(path.join(q,'Laboraufträge',newest),new Date('2026-10-01'),new Date('2026-10-01'));await fs.utimes(path.join(q,'Laboraufträge',older),new Date('2026-09-30'),new Date('2026-09-30'));
 const dir=new Dir(q);await c.SpektronUmzug.projektUmziehen(dir,{});const dest=(await c.SpektronOrdner.ort(dir,'labelkit')).dir,files=[];
 for await(const h of dest.values())files.push(await c.SpektronOrdner.dateiLesen(dest,h));files.sort((a,b)=>b.lastModified-a.lastModified);assert.equal(files[0].name,newest);assert.equal(files[0].lastModified,+new Date('2026-10-01'));
 await fs.writeFile(path.join(dest.p,older),'{"synthetic":"EDITED"}');const changed=await c.SpektronOrdner.dateiLesen(dest,await dest.getFileHandle(older));assert.notEqual(changed.lastModified,+new Date('2026-09-30'));
 c=await load();c.navigator={locks:{request:async(name,opts,fn)=>{assert.equal(opts.ifAvailable,true);return fn(name.startsWith('mosaik:projekt:')?null:{});}}};
 const r=await c.SpektronUmzug.projektUmziehen(new Dir(p),{});assert.ok(r.bereiche.some(b=>b.fehler.some(x=>/beschäftigt/.test(x))));

 });console.log('OK safety: migration ownership, copy recheck, chronology and nonblocking locks');
 await fixture(async tmp=>{

 const html=await source('','index.html'),c=context({S:{archive:new Dir(tmp,{beforeGet:async()=>{throw Object.assign(Error('synthetic denied'),{name:'NotAllowedError'});}}),ma:{text:null}},APP_VERSION:'test',maNorm:s=>s.toLowerCase()});
 vm.runInContext(part(html,'const MA_FILE =','const maPerson ='),c);await assert.rejects(()=>c.maSpeichern([{ordnerKuerzel:'AA',name:'Synthetic Staff'}]),/nicht lesbar/);assert.deepEqual(await fs.readdir(tmp),[]);

 });console.log('OK safety: staff access errors block writes');
 await fixture(async tmp=>{

 await put(tmp,'_Spektron-Archiv.json',{format:'spektron-archiv',version:1,projekte:{}});const c=context({ArchivAuswertung:{}});vm.runInContext(await source('','archiv/lesen.js'),c);
 let once=true;const d=new Dir(tmp,{beforeOpen:async()=>{if(once){once=false;await put(tmp,'_Spektron-Archiv.json',{format:'spektron-archiv',version:1,projekte:{'99.9002 Synthetic B':{nutzung:'Synthetic B'}}});}}});
 await assert.rejects(()=>c.ArchivLesen.tagSetzen(d,'99.9001 Synthetic A','nutzung','Synthetic A'),/inzwischen geändert/);assert.equal(Object.keys(JSON.parse(await fs.readFile(path.join(tmp,'_Spektron-Archiv.json'))).projekte).length,1);

 });console.log('OK safety: archive writer detects another writer before committing');
})().catch(e=>{console.error(e);process.exitCode=1;});
