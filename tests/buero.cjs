// Shared records against real temporary files, including uncertain close/readback and concurrent writers.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const D=require('../buero/data.js');
const notfound=()=>Object.assign(Error('Nicht gefunden'),{name:'NotFoundError'});
class Dir{
  constructor(p,fault={}){this.path=p;this.name=path.basename(p);this.kind='directory';this.fault=fault;}
  async getDirectoryHandle(n,{create=false}={}){const p=path.join(this.path,n);if(create)await fs.mkdir(p,{recursive:true});try{await fs.access(p);}catch{throw notfound();}return new Dir(p,this.fault);}
  async getFileHandle(n,{create=false}={}){const p=path.join(this.path,n);if(create)await fs.appendFile(p,'');else try{await fs.access(p);}catch{throw notfound();}const f=this.fault;
    return {name:n,kind:'file',getFile:async()=>{if(f.read&&n==='auftrag.json')throw Error('Lesefehler');const bytes=await fs.readFile(p);return{size:bytes.length,text:async()=>bytes.toString()};},createWritable:async()=>{if(f.write)throw Error('Schreibfehler');let bytes;return{write:async b=>bytes=b,abort:async()=>{},close:async()=>{await fs.writeFile(p,bytes);if(f.afterClose){f.read=true;f.afterClose=false;}}};}};}
  async *values(){if(this.fault.list)throw Error('Ordner nicht erreichbar');for(const e of await fs.readdir(this.path,{withFileTypes:true}))yield e.isDirectory()?new Dir(path.join(this.path,e.name),this.fault):{kind:'file',name:e.name};}
}
module.exports={Dir};
async function run(){
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'buero-'));const archive=new Dir(tmp);
 try{
 const p=await archive.getDirectoryHandle('24.0012 Fiktivort',{create:true}),mit=await p.getDirectoryHandle('Mitteilungen',{create:true});
 await fs.writeFile(path.join(mit.path,'Entwurf.docx'),'synthetic');await fs.writeFile(path.join(mit.path,'Versand.pdf'),'synthetic');
 const data={auftraggeber:'Muster AG, Abteilung West, Musterweg 5, 99999 Fiktivstadt',sachverstaendigerBeteiligt:'Dr. Beispiel, Institut, Beispielweg 7',sachverstaendiger:'Interner Bearbeiter',versicherungsnehmer:'Fiktivnehmer'};
 const rows=D.recipients(data);assert.deepEqual(rows.map(r=>r.selected),[true,true,false,false]);
 const saved=D.recipients({...data,verteiler:{versicherung:{an:false,versandt:'2026-01-01'},sanierung:{an:true}}});assert.deepEqual(saved.map(r=>r.selected),[false,false,false,true]);
 rows[1].entries.push('Zweite Empfängerin, Andere Straße 3');
 assert.throws(()=>D.snapshot({name:p.name,nr:'24.0012',ort:'Fiktivort'},'Mitteilungen/Entwurf.docx','SK','',D.recipients({auftraggeber:'Nur Auftraggeber'})),/ergänzen oder bewusst abwählen/);
 const content=D.snapshot({name:p.name,nr:'24.0012',ort:'Fiktivort'},'Mitteilungen/Entwurf.docx','SK','Papiermappe liegt vor.',rows),o=D.order(content);
 assert.equal(o.content.recipients.length,3);assert.equal(o.content.recipients[0].details,data.auftraggeber);assert.ok(!JSON.stringify(o).includes(data.sachverstaendiger+'"'));
 data.auftraggeber='Geänderte Stammdaten';assert.notEqual(o.content.recipients[0].details,data.auftraggeber);
 await D.checkFile(p,content.word,/\.docx?$/i);await assert.rejects(D.checkFile(p,'../Gutachten.docx',/\.docx?$/i));
 await D.create(p,o);await D.create(p,o);assert.equal((await D.scan(archive)).records.length,1);
 let r=await D.load(p,o.id);assert.equal(r.status,'Neu');
 async function add(type,payload={},actor='AB'){const e=D.event(r,type,payload,actor);await D.append(p,e);r=await D.load(p,o.id);return e;}
 await add('claim');await add('proof');assert.equal(r.status,'In Bearbeitung');await add('pdf',{path:'Mitteilungen/Versand.pdf'});
 await add('send',{date:'2026-10-21',ids:[content.recipients[0].id]});assert.equal(r.status,'In Bearbeitung');
 await add('send',{date:'2026-10-21',ids:content.recipients.slice(1).map(x=>x.id)});assert.equal(r.status,'Erledigt');
 await add('correct',{step:'proof',reason:'Versehentlich angeklickt'});assert.equal(r.status,'In Bearbeitung');assert.equal(Object.keys(r.sent).length,3);
 await add('proof');assert.equal(r.status,'Erledigt');await add('question',{text:'Bitte Ablage klären'});assert.equal(r.status,'Rückfrage');await add('answer',{text:'Geklärt'});assert.equal(r.status,'Erledigt');
 // Two independent handles act on the same observed revision. Both events survive.
 const independent=new Dir(p.path),a=D.event(r,'claim',{},'AA'),b=D.event(r,'claim',{},'BB');
 await Promise.all([D.append(p,a),D.append(independent,b)]);r=await D.load(p,o.id);assert.ok(r.conflict);assert.notEqual(r.status,'Erledigt');assert.ok(r.events.some(e=>e.actor==='AA'));assert.ok(r.events.some(e=>e.actor==='BB'));
 await add('resolve',{text:'Beide Rückmeldungen geprüft'});assert.equal(r.conflict,false);assert.equal(r.status,'Erledigt');
 const newer=D.order(content),fault={afterClose:true},flaky=new Dir(p.path,fault);
 await assert.rejects(D.create(flaky,newer),/Lesefehler/);fault.read=false;await D.create(flaky,newer);assert.equal((await D.scan(archive)).records.length,2,'retry after uncertain result must not duplicate');
 const draft=D.order(content);await assert.rejects(D.create(new Dir(p.path,{write:true}),draft),/Schreibfehler/);assert.equal(draft.content.note,'Papiermappe liegt vor.');
 const partial=await D.scan(archive);assert.ok(partial.errors.length,'half written record must not look like complete empty list');await D.create(p,draft);assert.equal((await D.scan(archive)).errors.length,0,'retry repairs an empty file left by a failed first write');
 const unreadable=await D.scan(new Dir(tmp,{list:true}));assert.ok(unreadable.errors.length);
 await fs.writeFile(path.join(p.path,'_Projekt.json'),'{"unknown":{"preserve":true}}');
 await add('revise',{content:{...content,note:'Bewusst geänderter Hinweis'}});assert.equal(r.proof,null);assert.equal(r.pdf,null);assert.equal(Object.keys(r.sent).length,3);assert.equal(r.order.content.note,'Papiermappe liegt vor.');
 await add('withdraw',{text:'Falsche Übergabe'});assert.equal(r.withdrawn,true);assert.equal(Object.keys(r.sent).length,3);assert.equal(await fs.readFile(path.join(p.path,'_Projekt.json'),'utf8'),'{"unknown":{"preserve":true}}');
 await require('./buero-f5.cjs').run();
 console.log('OK Büro-Daten: Ablauf, Empfängerstand, Retry, Fehler, konkurrierende Rückmeldungen und Korrekturen');
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
