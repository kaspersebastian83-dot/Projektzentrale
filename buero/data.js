/* Shared, append-only office records. No project/document content is rewritten. */
(function(root){
'use strict';
const FORMAT = 'spektron-buero', VERSION = 1, DIR = '_Buero';
const groups = [['versicherung','Auftraggeber','auftraggeber'],['sachverstaendiger','Empfangende Sachverständige','sachverstaendigerBeteiligt'],['versicherungsnehmer','Versicherungsnehmer','versicherungsnehmer'],['sanierung','Sanierung','sanierung']];
const uid = () => crypto.randomUUID();
const missing = e => e.name === 'NotFoundError';
function pathParts(path){
  const p = String(path).split('/');
  if (!p.length || p.some(x => !x || x === '.' || x === '..' || /[\\\x00-\x1f:]/.test(x))) throw Error('Bitte einen relativen Dateipfad im Projektordner angeben.');
  return p;
}
async function fileAt(dir,path){const p=pathParts(path);for(const n of p.slice(0,-1))dir=await dir.getDirectoryHandle(n);return dir.getFileHandle(p.at(-1));}
async function checkFile(dir,path,ext){if(!ext.test(path))throw Error('Falscher Dateityp.');await (await fileAt(dir,path)).getFile();return path;}
async function json(dir,name){const f=await(await dir.getFileHandle(name)).getFile();if(f.size>256*1024)throw Error('Übergabedatei zu groß: '+name);const text=await f.text();if(!text.trim())throw Object.assign(Error('Unvollständige Übergabedatei: '+name),{code:'BUERO_EMPTY'});return JSON.parse(text);}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function immutable(dir,name,data){
  // A retry reuses both filename and payload, including after close succeeded but readback failed.
  try {const old=await json(dir,name);if(!same(old,data))throw Error('Dateikollision: '+name);return old;}catch(e){if(!missing(e)&&e.code!=='BUERO_EMPTY')throw e;}
  const h=await dir.getFileHandle(name,{create:true});let w;
  try{w=await h.createWritable();await w.write(JSON.stringify(data,null,2)+'\n');await w.close();}catch(e){try{await w?.abort();}catch{}throw e;}
  const saved=await json(dir,name);if(!same(saved,data))throw Error('Speicherung nicht bestätigt: '+name);return saved;
}
function recipients(d){
  const fixed=d.verteiler && typeof d.verteiler==='object';
  return groups.map(([group,label,field],i)=>({group,label,selected:fixed?!!d.verteiler[group]?.an:i<2,entries:[String(d[field]||'')]}));
}
function confirmRecipients(rows){
  const out=[];
  for(const row of rows.filter(r=>r.selected)){
    const entries=row.entries.map(x=>x.trim()).filter(Boolean);
    if(!entries.length)throw Error('Konkrete Angaben ergänzen oder bewusst abwählen: '+row.label);
    for(const details of entries)out.push({id:uid(),group:row.group,label:row.label,details});
  }
  if(!out.length)throw Error('Mindestens einen konkreten Empfänger bestätigen.');
  return out;
}
function snapshot(project,word,who,note,rows){
  if(!who.trim())throw Error('Übergebende Person / Kürzel ergänzen.');pathParts(word);
  return {project,word,who:who.trim(),note:note.trim(),instruction:'Gutachten gegenlesen, PDF erstellen und versenden.',recipients:confirmRecipients(rows)};
}
function order(content){return {format:FORMAT,version:VERSION,id:uid(),created:new Date().toISOString(),content};}
function event(record,type,payload,actor){
  if(!actor.trim())throw Error('Bearbeitendes Kürzel ergänzen.');
  return {format:FORMAT,version:VERSION,id:uid(),orderId:record.order.id,at:new Date().toISOString(),actor:actor.trim(),parents:[...record.heads],type,payload};
}
function validateContent(c){
  if(!c||!c.project||!['name','nr','ort'].every(k=>typeof c.project[k]==='string')||typeof c.who!=='string'||!c.who.trim()||typeof c.note!=='string'||typeof c.instruction!=='string'||!Array.isArray(c.recipients)||!c.recipients.length)throw Error('Unvollständiger Übergabeinhalt.');
  pathParts(c.word);if(!/\.docx?$/i.test(c.word))throw Error('Ungültige Word-Zuordnung.');
  const ids=new Set();for(const r of c.recipients){if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(r.id)||ids.has(r.id)||!groups.some(g=>g[0]===r.group)||typeof r.label!=='string'||typeof r.details!=='string'||!r.details.trim())throw Error('Ungültiger Empfängerstand.');ids.add(r.id);}
}
function validate(o,id){
  if(!o||o.format!==FORMAT||o.version!==VERSION||o.id!==id)throw Error('Unbekanntes oder beschädigtes Büroformat.');
}
function reduce(order,events){
  validate(order,order.id);
  validateContent(order.content);if(typeof order.created!=='string'||!Number.isFinite(Date.parse(order.created)))throw Error('Ungültiger Übergabezeitpunkt.');
  const byId=new Map();for(const e of events){validate(e,e.id);if(typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at))||typeof e.actor!=='string'||!e.actor.trim()||!e.payload||typeof e.payload!=='object')throw Error('Unvollständige Rückmeldung.');if(e.orderId!==order.id||byId.has(e.id)||!Array.isArray(e.parents))throw Error('Ungültige Rückmeldung.');byId.set(e.id,e);}
  const seen=new Set(),active=new Set(),sorted=[];
  function visit(e){if(seen.has(e.id))return;if(active.has(e.id))throw Error('Zyklische Rückmeldung.');active.add(e.id);for(const id of e.parents){if(!byId.has(id))throw Error('Rückmeldung fehlt: '+id);visit(byId.get(id));}active.delete(e.id);seen.add(e.id);sorted.push(e);}
  [...events].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).forEach(visit);
  const parentIds=new Set(events.flatMap(e=>e.parents)),heads=events.filter(e=>!parentIds.has(e.id)).map(e=>e.id).sort();
  const s={content:order.content,actor:'',proof:null,pdf:null,sent:{},question:'',withdrawn:false,started:false};
  for(const e of sorted){const p=e.payload;
    switch(e.type){
      case 'claim':s.started=true;s.actor=e.actor;break;
      case 'proof':s.proof={at:e.at,actor:e.actor};break;
      case 'pdf':pathParts(p.path);s.pdf={path:p.path,at:e.at,actor:e.actor};break;
      case 'send':for(const id of p.ids){if(!s.content.recipients.some(r=>r.id===id))throw Error('Unbekannter Empfänger.');s.sent[id]={date:p.date,actor:e.actor,at:e.at,pdf:p.pdf||''};}break;
      case 'question':s.question=p.text;break;
      case 'answer':s.question='';break;
      case 'withdraw':s.withdrawn=true;break;
      case 'revise':validateContent(p.content);s.content=p.content;s.proof=null;s.pdf=null;break;
      case 'correct':
        if(p.step==='proof')s.proof=null;
        else if(p.step==='pdf')s.pdf=null;
        else if(p.step==='send')delete s.sent[p.recipient];
        else throw Error('Unbekannter Korrekturschritt.');break;
      case 'resolve':break;
      default:throw Error('Unbekannte Rückmeldung: '+e.type);
    }
  }
  // A merge event acknowledges all observed heads. It never erases any event.
  const conflict=heads.length>1;
  const done=!!s.proof&&!!s.pdf&&s.content.recipients.every(r=>s.sent[r.id]);
  const status=s.question?'Rückfrage':done&&!conflict&&!s.withdrawn?'Erledigt':s.started||s.proof||s.pdf||Object.keys(s.sent).length?'In Bearbeitung':'Neu';
  return {order,events:sorted,heads,...s,conflict,status};
}
async function orderDir(project,id,create=false){if(!/^[a-zA-Z0-9-]+$/.test(id))throw Error('Ungültige Auftragskennung.');return(await project.getDirectoryHandle(DIR,{create})).getDirectoryHandle(id,{create});}
function checkProject(project,content){
  validateContent(content);
  const name=String(project.name).normalize('NFC'),nr=/^(\d{2}\.\d{2,6})(?:[\s_-]|$)/.exec(name)?.[1],source=content.project;
  if(!nr||source.nr!==nr||source.name.normalize('NFC')!==name)throw Error(`Projektzuordnung blockiert: Der Büroauftrag nennt „${source.name}“ (Nr. ${source.nr}), geöffnet ist „${project.name}“ (Nr. ${nr||'nicht erkennbar'}). Bitte Auftrag und Projektordner prüfen. Es wurde keine Rückmeldung gespeichert.`);
}
async function create(project,o){validate(o,o.id);checkProject(project,o.content);return immutable(await orderDir(project,o.id,true),'auftrag.json',o);}
async function append(project,e){
  // Re-read the actual target before every write, including retries and corrections.
  const record=await readRecord(project,e.orderId,'rueckmeldung-'+e.id+'.json');
  if(e.type==='revise')checkProject(project,e.payload.content);
  reduce(record.order,[...record.events.filter(old=>old.id!==e.id),e]);
  return immutable(await orderDir(project,e.orderId),'rueckmeldung-'+e.id+'.json',e);
}
async function readRecord(project,id,retryName){
  const dir=await orderDir(project,id),o=await json(dir,'auftrag.json');validate(o,id);checkProject(project,o.content);const events=[];
  for await(const h of dir.values())if(h.kind==='file'&&/^rueckmeldung-.*\.json$/.test(h.name)){
    let e;try{e=await json(dir,h.name);}catch(err){if(h.name===retryName&&err.code==='BUERO_EMPTY')continue;throw err;}
    validate(e,h.name.slice(13,-5));if(e.type==='revise')checkProject(project,e.payload?.content);events.push(e);
  }
  return reduce(o,events);
}
async function load(project,id){return readRecord(project,id);}
async function scanProject(project,retry){
  const records=[],errors=[];let dir;
  try{dir=await project.getDirectoryHandle(DIR);}catch(e){if(missing(e))return {records,errors};return {records,errors:[project.name+': '+e.message]};}
  try{for await(const h of dir.values())if(h.kind==='directory'){try{records.push(await readRecord(project,h.name,retry?.orderId===h.name?'rueckmeldung-'+retry.id+'.json':undefined));}catch(e){errors.push(project.name+'/'+h.name+': '+e.message);}}}catch(e){errors.push(project.name+': '+e.message);}
  return {records,errors};
}
async function scan(archive,pending){
  const records=[],errors=[];
  try{for await(const h of archive.values())if(h.kind==='directory'&&/^\d{2}\.\d{2,6}(?:[\s_-]|$)/.test(h.name)){
    const r=await scanProject(h,pending?.project===h.name?pending.data:undefined);records.push(...r.records.map(x=>({...x,projectHandle:h})));errors.push(...r.errors);
  }}catch(e){errors.push(e.message);}
  records.sort((a,b)=>a.order.created.localeCompare(b.order.created)||a.order.id.localeCompare(b.order.id));return {records,errors};
}
async function selectFile(project,ext){
  const [h]=await window.showOpenFilePicker({startIn:project,multiple:false});const p=await project.resolve(h);
  if(!p)throw Error('Bitte die Originaldatei innerhalb des Projektordners auswählen.');return checkFile(project,p.join('/'),ext);
}
const api={DIR,groups,uid,pathParts,fileAt,checkFile,recipients,snapshot,order,event,reduce,create,append,load,scanProject,scan,selectFile};
if(typeof module==='object'&&module.exports)module.exports=api;else root.BueroData=api;
})(typeof window==='object'?window:globalThis);
