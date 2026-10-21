// Real UI, two independent browser contexts, shared synthetic temporary filesystem.
// Only File System Access selection/handles are bridged; application reducers and writes run unchanged.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http'),pw=require('playwright');
const root=path.resolve(__dirname,'..'),A='24.0012 Fiktivstadt',B='26.9999 Kontrollort';
(async()=>{
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'buero-browser-'));
const project=path.join(tmp,A);await fs.mkdir(path.join(project,'Mitteilungen'),{recursive:true});await fs.mkdir(path.join(tmp,B));
for(const name of ['Gutachten A.docx','Gutachten B.docx','Versand A.pdf','Versand B.pdf'])await fs.writeFile(path.join(project,'Mitteilungen',name),'Synthetic document placeholder');
const pj={format:'mosaik-projekt',version:1,auftraggeber:'Muster AG, Abteilung West, Beispielweg 5, 99999 Fiktivstadt',sachverstaendigerBeteiligt:'Dr. Beispiel, Institut West, Fiktivweg 8',sachverstaendiger:'Interner Bearbeiter',versicherungsnehmer:'Fiktivnehmer',unknown:{preserve:true}};
const pjText=JSON.stringify(pj);await fs.writeFile(path.join(project,'_Projekt.json'),pjText);await fs.writeFile(path.join(tmp,B,'Kontrolle.txt'),'untouched');
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),name=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';let f=path.resolve(root,name);if(!f.startsWith(root+path.sep))throw Error();if((await fs.stat(f)).isDirectory())f=path.join(f,'index.html');const ext=path.extname(f);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[ext]||'application/octet-stream');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await pw.chromium.launch(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox']}:{}),contexts=[];const errors=[];
try{
async function context(){
 const c=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Europe/Berlin',locale:'de-DE',serviceWorkers:'block'});contexts.push(c);
 await c.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await c.exposeBinding('__sharedIO',async({page},arg)=>{
  const absolute=path.resolve(tmp,arg.rel||'.');if(absolute!==tmp&&!absolute.startsWith(tmp+path.sep))throw Error('outside test archive');
  if(arg.fail)throw Error('SYNTHETIC '+arg.fail);
  try{switch(arg.op){
   case'dir':if(arg.create)await fs.mkdir(absolute,{recursive:true});if(!(await fs.stat(absolute)).isDirectory())throw Error('not directory');return true;
   case'file':if(arg.create)await fs.appendFile(absolute,'');if(!(await fs.stat(absolute)).isFile())throw Error('not file');return true;
   case'list':return (await fs.readdir(absolute,{withFileTypes:true})).map(x=>({name:x.name,kind:x.isDirectory()?'directory':'file'}));
   case'read':{const buf=await fs.readFile(absolute);return {text:buf.toString(),size:buf.length};}
   case'write':await fs.writeFile(absolute,arg.text);return true;
  }}catch(e){if(e.code==='ENOENT')return {notfound:true};throw e;}
 });
 await c.addInitScript(()=>{
  window.testIO={failWrite:false,failList:false,failRead:false,failAfterClose:false,hideGrant:false};
  const io=async arg=>{const r=await window.__sharedIO(arg);if(r?.notfound)throw new DOMException('Missing','NotFoundError');return r;};
  class Handle{constructor(rel,kind){this.rel=rel;this.kind=kind;this.name=rel.split('/').at(-1)||'Testarchiv';}async queryPermission(){return window.testIO.hideGrant?'denied':'granted';}async requestPermission(){return this.queryPermission();}async isSameEntry(h){return h.rel===this.rel;}}
  class FileHandle extends Handle{constructor(rel){super(rel,'file');}async getFile(){const r=await io({op:'read',rel:this.rel,fail:window.testIO.failRead&&this.name.startsWith('rueckmeldung-')?'read':null});return {name:this.name,size:r.size,lastModified:1,text:async()=>r.text,arrayBuffer:async()=>new TextEncoder().encode(r.text).buffer};}async createWritable(){if(window.testIO.failWrite)throw Error('SYNTHETIC write');let text;const rel=this.rel;return{write:async value=>{text=value;},abort:async()=>{},close:async()=>{await io({op:'write',rel,text});if(window.testIO.failAfterClose){window.testIO.failRead=true;window.testIO.failAfterClose=false;}}};}}
  class DirectoryHandle extends Handle{constructor(rel){super(rel,'directory');}child(n){return(this.rel?this.rel+'/':'')+n;}async getDirectoryHandle(n,opts={}){const rel=this.child(n);await io({op:'dir',rel,create:opts.create});return new DirectoryHandle(rel);}async getFileHandle(n,opts={}){const rel=this.child(n);await io({op:'file',rel,create:opts.create});return new FileHandle(rel);}async *values(){for(const h of await io({op:'list',rel:this.rel,fail:window.testIO.failList?'list':null}))yield h.kind==='directory'?new DirectoryHandle(this.child(h.name)):new FileHandle(this.child(h.name));}async resolve(h){const prefix=this.rel?this.rel+'/':'';return h.rel.startsWith(prefix)?h.rel.slice(prefix.length).split('/'):null;}}
  window.SharedDirectoryHandle=DirectoryHandle;
  window.showDirectoryPicker=async()=>new DirectoryHandle('');
  window.showOpenFilePicker=async()=>[new FileHandle(window.testPick||'24.0012 Fiktivstadt/Mitteilungen/Gutachten B.docx')];
 });
 return c;
}
const central=await(await context()).newPage(),office=await(await context()).newPage();
async function openSection(name){const el=office.locator('#detail details').filter({has:office.locator('summary',{hasText:name})});if(!await el.evaluate(e=>e.open))await el.locator('summary').click();}
for(const p of [central,office])p.on('pageerror',e=>errors.push(e.message));
await central.goto(base+'/index.html');await central.locator('#btnStart').click();await central.locator(`.proj[data-name="${A}"]`).click();await central.locator('#bueroPanel [data-submit]').waitFor({state:'attached'});
await central.locator('#bueroPanel [data-form] summary').click();
await central.locator('#bueroPanel [data-word]').fill('Mitteilungen/Gutachten A.docx');await central.locator('#bueroPanel [data-pick]').click();
try{await central.waitForFunction(()=>document.querySelector('#bueroPanel [data-word]')?.value==='Mitteilungen/Gutachten B.docx',null,{timeout:8000});}catch(e){console.log(await central.locator('#bueroPanel').innerText());throw e;}
assert.equal(await central.locator('#bueroPanel [data-word]').inputValue(),'Mitteilungen/Gutachten B.docx','conscious file selection, no latest heuristic');
assert.equal(await central.locator('[data-entry="0:0"]').inputValue(),pj.auftraggeber);
assert.equal(await central.locator('[data-entry="1:0"]').inputValue(),pj.sachverstaendigerBeteiligt);
assert.ok(!await central.locator('[data-group="2"]').isChecked());
await central.locator('[data-add="1"]').click();await central.locator('[data-entry="1:1"]').fill('Zweite Empfängerin, Institut Süd, Beispielplatz 3');
await central.locator('[data-who]').fill('SK');await central.locator('[data-note]').fill('Papiermappe am Büroplatz. Bitte Anlagen prüfen.');
const screenshots=path.join(root,'tests/buero-results');await fs.mkdir(screenshots,{recursive:true});
await central.setViewportSize({width:1440,height:2400});await central.locator('#bueroPanel').screenshot({path:path.join(screenshots,'uebergabe.png')});await central.setViewportSize({width:1440,height:1100});
// Write failure keeps inputs and stable attempt. Retry creates exactly one order.
await central.evaluate(()=>testIO.failWrite=true);await central.locator('[data-submit]').click();await central.locator('[data-message]').filter({hasText:'Nicht bestätigt gespeichert'}).waitFor();
assert.equal(await central.locator('[data-note]').inputValue(),'Papiermappe am Büroplatz. Bitte Anlagen prüfen.');
await central.evaluate(()=>testIO.failWrite=false);await central.locator('[data-submit]').click();await central.locator('[data-message]').filter({hasText:'Gespeichert und rückgelesen'}).waitFor();
const dirs=await fs.readdir(path.join(project,'_Buero'));assert.equal(dirs.length,1);const id=dirs[0];
assert.equal(await fs.readFile(path.join(project,'_Projekt.json'),'utf8'),pjText,'handover never rewrites PJ');
assert.ok(await central.locator('#vtBox .vtAn').first().isDisabled(),'single shipping source');
await office.goto(base+'/buero/');await office.locator('#archive').click();await office.locator('tr[data-order]').click();
assert.match(await office.locator('#detail').innerText(),/Muster AG, Abteilung West, Beispielweg 5, 99999 Fiktivstadt/);
assert.match(await office.locator('#list').innerText(),/24.0012/,'old years remain visible');
await office.locator('[data-field=actor]').fill('AB');await office.locator('[data-action=claim]').click();await office.locator('#message').filter({hasText:'Gespeichert'}).waitFor();
await office.locator('[data-action=proof]').click();await office.waitForFunction(()=>document.querySelector('#detail').textContent.includes('Gegenlesen offen')===false);
await office.evaluate(()=>window.testPick='24.0012 Fiktivstadt/Mitteilungen/Versand A.pdf');await office.locator('[data-pdf-pick]').click();await office.locator('[data-action=pdf]').click();await office.waitForFunction(()=>Array.from(document.querySelectorAll('.b-history li')).some(e=>e.textContent.includes('PDF erstellt / zugeordnet')));
await office.waitForFunction(()=>document.querySelector('#detail .b-path')&&document.querySelector('[data-field=pdf]').value.includes('Versand A.pdf'));
// Select one of three recipients for actual partial shipment.
await openSection('Versand dokumentieren');
await office.locator('[data-send]').nth(1).uncheck();await office.locator('[data-send]').nth(2).uncheck();await office.locator('[data-action=send]').click();
await office.waitForFunction(()=>document.querySelectorAll('[data-send]').length===2);assert.match(await office.locator('#detail').innerText(),/In Bearbeitung/);await office.evaluate(()=>window.scrollTo(0,0));await office.screenshot({path:path.join(screenshots,'buero.png')});
await openSection('Rückfrage an Sachverständigen');
await office.locator('[data-field=text]').fill('Bitte Ablage der Anlage klären.');await office.locator('[data-action=question]').click();await office.waitForFunction(()=>document.querySelector('#detail').textContent.includes('Rückfrage:'));
await central.locator('[data-refresh]').click();await central.locator('[data-records]').filter({hasText:'Bitte Ablage der Anlage klären.'}).waitFor();
// Close optional question without any approval phase.
await openSection('Rückfrage an Sachverständigen');
await office.locator('[data-field=text]').fill('Anlage liegt bei der Papiermappe.');await office.locator('[data-action=answer]').click();
await office.waitForFunction(()=>!document.querySelector('#detail').textContent.includes('Rückfrage:'));
// Complete remaining recipients in one confirmation.
await openSection('Versand dokumentieren');
await office.locator('[data-send]').nth(0).check();await office.locator('[data-send]').nth(1).check();
await office.locator('[data-action=send]').click();await office.waitForFunction(()=>document.querySelector('#detail .b-tag').textContent==='Erledigt');
await central.locator('[data-refresh]').click();await central.locator('[data-records]').filter({hasText:'Erledigt'}).waitFor();
assert.equal(await office.locator('#list tr[data-order]').count(),0);await office.locator('#filter').selectOption('all');
// Independent contexts concurrently append to the same observed head. No Web Lock shared across contexts.
await Promise.all([central.evaluate(async id=>{const p=await new SharedDirectoryHandle('').getDirectoryHandle('24.0012 Fiktivstadt');window.parallelEvent=BueroData.event(await BueroData.load(p,id),'claim',{},'AA');},id),office.evaluate(async id=>{const p=await new SharedDirectoryHandle('').getDirectoryHandle('24.0012 Fiktivstadt');window.parallelEvent=BueroData.event(await BueroData.load(p,id),'claim',{},'BB');},id)]);
await Promise.all([central.evaluate(async()=>BueroData.append(await new SharedDirectoryHandle('').getDirectoryHandle('24.0012 Fiktivstadt'),parallelEvent)),office.evaluate(async()=>BueroData.append(await new SharedDirectoryHandle('').getDirectoryHandle('24.0012 Fiktivstadt'),parallelEvent))]);
await office.locator('#refresh').click();await office.locator('#detail').filter({hasText:'Parallele Rückmeldungen erkannt'}).waitFor();assert.ok(await office.locator('[data-action=send]').isDisabled());
assert.match(await office.locator('.b-history').innerText(),/AA/);assert.match(await office.locator('.b-history').innerText(),/BB/);
await office.screenshot({path:path.join(screenshots,'konflikt.png'),fullPage:true});
await office.locator('[data-action=resolve]').click();await office.waitForFunction(()=>!document.querySelector('#detail').textContent.includes('Parallele Rückmeldungen erkannt'));
// Read error must preserve prior records and warn, not present an empty worklist.
await office.evaluate(()=>testIO.failList=true);await office.locator('#refresh').click();await office.locator('#warning').filter({hasText:'unvollständig/veraltet'}).waitFor();assert.equal(await office.locator('#list tr[data-order]').count(),1);
await office.evaluate(()=>testIO.failList=false);await office.locator('#refresh').click();await office.locator('#warning').waitFor({state:'hidden'});
// Uncertain event close/readback: same ID is retried, no extra event appears.
await office.evaluate(()=>testIO.failAfterClose=true);await office.locator('[data-action=claim]').click();await office.locator('#retry').waitFor();const eventCount=(await fs.readdir(path.join(project,'_Buero',id))).length;
await office.evaluate(()=>testIO.failRead=false);await office.locator('#retry').click();await office.locator('#retry').waitFor({state:'hidden'});assert.equal((await fs.readdir(path.join(project,'_Buero',id))).length,eventCount);
assert.equal(await fs.readFile(path.join(tmp,B,'Kontrolle.txt'),'utf8'),'untouched');assert.equal(await fs.readFile(path.join(project,'_Projekt.json'),'utf8'),pjText);assert.deepEqual(errors,[]);
console.log('OK Büro Chromium: Übergabe, vollständige Empfänger, Retry nach Fehler, PDF, Teil-/Vollversand, Rückfrage, zwei unabhängige Kontexte und Konflikterkennung. Synthetische Screenshots: tests/buero-results/');
}finally{for(const c of contexts)await c.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
