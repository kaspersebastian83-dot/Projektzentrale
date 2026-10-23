/* Durable, immutable office attempts. Names/UUIDs are never a source of directory handles. */
(function(root){
'use strict';
const PREFIX='buero-office-attempt:',KEY='buero-office-pending';
const blocked=()=>Error('Projektzuordnung blockiert: Die ursprüngliche Ordnerbindung dieses Schreibversuchs ist nicht nachweisbar. Nicht automatisch erneut speichern. Eingaben unten sichern, Ablage mit dem Büro klären und den Auftrag im richtigen Projekt neu öffnen.');
function database(){
  async function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function run(mode,action){const db=await open();return new Promise((resolve,reject)=>{let result;const t=db.transaction('kv',mode);try{const r=action(t.objectStore('kv'));r.onsuccess=()=>{result=r.result;};}catch(e){db.close();reject(e);return;}t.oncomplete=()=>{db.close();resolve(result);};t.onabort=t.onerror=()=>{db.close();reject(t.error||Error('Lokaler Schreibversuch nicht gespeichert.'));};});}
  return {get:key=>run('readonly',s=>s.get(key)),put:(key,value)=>run('readwrite',s=>s.put(value,key)),remove:key=>run('readwrite',s=>s.delete(key)),keys:()=>run('readonly',s=>s.getAllKeys())};
}
function create(db=database()){
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function key(p){if(p?.version!==1||typeof p.attempt!=='string'||!/^[a-f0-9-]{36}$/i.test(p.attempt)||!p.order||!p.data)throw blocked();return PREFIX+p.attempt;}
  async function binding(p){const r=await db.get(key(p));if(!r||!same(r.pending,p)||typeof r.project?.isSameEntry!=='function'||typeof r.archive?.isSameEntry!=='function')throw blocked();return r;}
  async function locate(p,archive){
    try{
    const r=await binding(p);
    if(!archive||!await r.archive.isSameEntry(archive))throw Error('Projektzuordnung blockiert: Archivordner gewechselt. Bitte das ursprüngliche Archiv verbinden; der Schreibversuch wird nicht einem anderen Ordner zugeordnet.');
    const parts=await archive.resolve(r.project);
    if(!parts||parts.length!==1||parts[0]!==p.project||r.project.name!==p.project)throw blocked();
    return r.project;
    }catch(e){if(e.message?.startsWith('Projektzuordnung blockiert:'))throw e;throw Error(blocked().message+' Ordnerzugriff/Herkunft konnte nicht geprüft werden: '+e.message);}
  }
  const receiptName=p=>'herkunft-'+p.attempt+'.json';
  async function receipt(p){return {format:'spektron-buero-origin',version:1,attempt:p.attempt,orderId:p.order.id,eventId:p.data.id,project:p.project,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(p)))),b=>b.toString(16).padStart(2,'0')).join('')};}
  async function source(p,archive){
    const project=await locate(p,archive);
    try{
      const dir=await project.getDirectoryHandle('_Buero'),f=await(await dir.getFileHandle(receiptName(p))).getFile();
      if(f.size>4096||await f.text()!==JSON.stringify(await receipt(p)))throw blocked();
      return project;
    }catch(e){throw Error(blocked().message+' Der ursprüngliche Herkunftsnachweis fehlt oder ist nicht unverändert lesbar. '+e.message);}
  }
  return {
    async prepare(archive,project,order,data){
      const p=JSON.parse(JSON.stringify({version:1,attempt:crypto.randomUUID(),project:project.name,order,data}));
      // Commit native structured-clone handles and the exact immutable payload before shared IO.
      await db.put(key(p),{pending:p,archive,project});
      const restored=await locate(p,archive);
      if(!await project.isSameEntry(restored))throw blocked();
      // A retained handle can be path-based on some browser file systems. A unique receipt
      // must already exist at the original location; retries NEVER create/repair one.
      const dir=await project.getDirectoryHandle('_Buero'),name=receiptName(p),text=JSON.stringify(await receipt(p));
      try{await dir.getFileHandle(name);throw Error('Herkunftsnachweis existiert bereits. Versuch blockiert.');}catch(e){if(e.name!=='NotFoundError')throw e;}
      const file=await dir.getFileHandle(name,{create:true});let w;
      try{w=await file.createWritable();await w.write(text);await w.close();}catch(e){try{await w?.abort();}catch{}throw e;}
      await source(p,archive);
      return p;
    },source,
    async finish(p){await binding(p);await db.remove(key(p));},
    async list(){const out=[];for(const k of await db.keys())if(typeof k==='string'&&k.startsWith(PREFIX)){const r=await db.get(k);if(r?.pending)out.push(r.pending);}return out;},
    async discard(p){let k;try{k=key(p);}catch{return;}const r=await db.get(k);if(r&&same(r.pending,p))await db.remove(k);}
  };
}
const api={create,KEY};
if(typeof module==='object'&&module.exports)module.exports=api;else root.BueroPending=api;
})(typeof window==='object'?window:globalThis);
