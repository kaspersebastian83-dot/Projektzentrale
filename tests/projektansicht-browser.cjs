const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http'),pw=require('playwright');
const root=process.env.PROJECT_UI_ROOT||path.resolve(__dirname,'..'),A='24.0012 Fiktivstadt',B='26.9999 Kontrollort';
(async()=>{
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'projekt-ui-')),out=process.env.UI_SCREENSHOTS_OUTPUT||path.resolve(__dirname,'projektansicht-results'),before=!!process.env.PROJECT_UI_ROOT;
await fs.mkdir(out,{recursive:true});
for(const name of [A,B]){await fs.mkdir(path.join(tmp,name,'Mitteilungen'),{recursive:true});for(const sub of ['Fotos','Pläne','Laboraufträge','Laborergebnisse','Emails','Rechnung Labore'])await fs.mkdir(path.join(tmp,name,sub));}
await fs.writeFile(path.join(tmp,A,'Mitteilungen','Gutachten B.docx'),'Synthetic placeholder');await fs.writeFile(path.join(tmp,B,'Mitteilungen','Gutachten B.docx'),'Synthetic placeholder');
await fs.writeFile(path.join(tmp,A,'Fotos','_Bildumbenenner.json'),'{}');await fs.writeFile(path.join(tmp,A,'Pläne','Plan.probenplan'),'{}');
const pj={format:'mosaik-projekt',version:1,objekt:'Wohnhaus, Musterweg 12',auftraggeber:'Beispiel AG, Abteilung West',sachverstaendigerBeteiligt:'Dr. Muster, Beispielinstitut',versicherungsnehmer:'Fiktive Person',verteiler:{versicherung:{an:true,versandt:'2026-10-20'},sachverstaendiger:{an:true},versicherungsnehmer:{an:false}}};
let expectedPj=JSON.stringify(pj);await fs.writeFile(path.join(tmp,A,'_Projekt.json'),expectedPj);
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');if(/^\/(labelkit|Bildumbenenner|Probenplan|aufwandkit)\/$/.test(u.pathname)){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Fiktives App-Testziel</title>');return;}let file=path.resolve(root,decodeURIComponent(u.pathname).slice(1)||'index.html');if(!file.startsWith(root+'/'))throw Error();if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await pw.chromium.launch(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox']}:{}),contexts=[];const errors=[];
try{
async function context(existing){
 const c=existing||await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Europe/Berlin',locale:'de-DE',serviceWorkers:'block'});if(!contexts.includes(c))contexts.push(c);
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
  class DirectoryHandle extends Handle{constructor(rel){super(rel,'directory');}child(n){return(this.rel?this.rel+'/':'')+n;}async getDirectoryHandle(n,opts={}){const rel=this.child(n);await io({op:'dir',rel,create:opts.create});return new DirectoryHandle(rel);}async getFileHandle(n,opts={}){const rel=this.child(n);await io({op:'file',rel,create:opts.create});return new FileHandle(rel);}async *values(){for(const h of await io({op:'list',rel:this.rel,fail:window.testIO.failList&&this.name==='_Buero'?'list':null}))yield h.kind==='directory'?new DirectoryHandle(this.child(h.name)):new FileHandle(this.child(h.name));}async resolve(h){const prefix=this.rel?this.rel+'/':'';return h.rel.startsWith(prefix)?h.rel.slice(prefix.length).split('/'):null;}}
  window.SharedDirectoryHandle=DirectoryHandle;
  window.showDirectoryPicker=async()=>new DirectoryHandle('');
  window.showOpenFilePicker=async()=>[new FileHandle(window.testPick||'24.0012 Fiktivstadt/Mitteilungen/Gutachten B.docx')];
 });
 return c;
}
const page=await(await context()).newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
await page.goto(base+'/index.html');await page.locator('#btnStart').click();await page.locator(`.proj[data-name="${A}"]`).click();
const id=await page.evaluate(async()=>{const p=await new SharedDirectoryHandle('').getDirectoryHandle('24.0012 Fiktivstadt');const o=BueroData.order(BueroData.snapshot({name:p.name,nr:'24.0012',ort:'Fiktivstadt'},'Mitteilungen/Gutachten B.docx','SK','Papiermappe am Büroplatz.',BueroData.recipients({auftraggeber:'Beispiel AG, Abteilung West',sachverstaendigerBeteiligt:'Dr. Muster, Beispielinstitut'})));await BueroData.create(p,o);let r=await BueroData.load(p,o.id);await BueroData.append(p,BueroData.event(r,'claim',{},'AB'));return o.id;});
await page.locator('[data-refresh]').click();await page.waitForFunction(()=>document.querySelector('#bueroPanel').textContent.includes('In Bearbeitung'));
async function top(){await page.locator('#detail').evaluate(e=>e.scrollTop=0);}
async function shot(state){if(state==='uebergabe')await page.locator('#bueroPanel').evaluate(e=>e.scrollIntoView({block:'start'}));else await top();await page.screenshot({path:path.join(out,(before?'vorher':'nachher')+'-'+state+'.png')});}
await shot('projekt');
if(!before){
 const list=await page.locator('#listWrap').boundingBox(),detail=await page.locator('#detail').boundingBox();assert.ok(detail.width>list.width*1.6);
 assert.deepEqual(await page.locator('.steps .name').allTextContents(),['Proben & Laborauftrag','Fotos & Dokumentation','Probenplan bearbeiten','Zeiten & Abrechnung']);
 assert.equal(await page.locator('.steps .done,.steps .next').count(),0);assert.match(await page.locator('.steps').innerText(),/Fotobearbeitung begonnen/);
 assert.ok((await page.locator('.steps').boundingBox()).y<(await page.locator('#bueroPanel').boundingBox()).y);
 await page.locator(`.proj[data-name="${B}"]`).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.proj.active')?.dataset.name==='26.9999 Kontrollort');
 assert.ok(await page.locator('#azQuick').isVisible());
 await page.locator(`.proj[data-name="${A}"]`).focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('.proj.active')?.dataset.name==='24.0012 Fiktivstadt');
 for(const [button,app] of [['goLabel','labelkit'],['goFotos','Bildumbenenner'],['goPlan','Probenplan'],['goAufwand','aufwandkit']]){
  const [pop]=await Promise.all([page.waitForEvent('popup'),page.locator('#'+button).click()]);await pop.waitForURL(base+'/'+app+'/**');const u=new URL(pop.url());assert.equal(u.search,'');assert.equal(new URLSearchParams(u.hash.slice(1)).get('projekt'),A);await pop.close();
 }
}
if(!before){
 assert.equal(await page.locator('[data-handover-label]').innerText(),'Übergabe ansehen');
 await page.locator('[data-handover] > summary').click();
 assert.ok(await page.locator(`[data-record="${id}"]`).evaluate(e=>e.open));
 assert.ok(!await page.locator('[data-form]').isVisible());
 assert.match(await page.locator(`[data-record="${id}"]`).innerText(),/Mitteilungen\/Gutachten B.docx/);
 await page.locator('#bueroPanel').evaluate(e=>e.scrollIntoView({block:'start'}));
 await page.screenshot({path:path.join(out,'offene-uebergabe-details.png')});
 await page.locator(`[data-revise="${id}"]`).click();
 await page.waitForFunction(()=>document.querySelector('[data-form-label]')?.textContent==='Offene Übergabe ändern');
}
if(!await page.locator('[data-form]').evaluate(e=>e.open))await page.locator('[data-form] > summary').click();
if(!before){
 await page.locator('[data-group="2"]').check();await page.locator('[data-add="2"]').click();await page.locator('[data-entry="2:0"]').fill('Entwurf Versicherungsnehmer, Beispielweg 8');await page.locator('[data-group="2"]').uncheck();assert.equal(await page.locator('[data-entry="2:0"]').inputValue(),'Entwurf Versicherungsnehmer, Beispielweg 8');assert.ok(!await page.locator('[data-entry="2:0"]').isVisible());
 await page.locator('[data-note]').fill('Unfertiger Hinweis bleibt erhalten.');await page.locator('[data-note]').evaluate(e=>{e.focus();e.setSelectionRange(4,9);});
 expectedPj=JSON.stringify({...pj,objekt:'Extern aktualisiertes fiktives Objekt'});await fs.writeFile(path.join(tmp,A,'_Projekt.json'),expectedPj);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.project-summary').filter({hasText:'Extern aktualisiertes'}).waitFor();await page.waitForFunction(()=>document.activeElement?.matches('[data-note]'));
 assert.deepEqual(await page.locator('[data-note]').evaluate(e=>[e.selectionStart,e.selectionEnd]),[4,9]);
 await page.locator('[data-handover] > summary').click();assert.ok(!await page.locator('[data-note]').isVisible());await page.locator('[data-handover] > summary').click();assert.equal(await page.locator('[data-note]').inputValue(),'Unfertiger Hinweis bleibt erhalten.');
 await page.locator('[data-group="2"]').check();assert.equal(await page.locator('[data-entry="2:0"]').inputValue(),'Entwurf Versicherungsnehmer, Beispielweg 8');await page.locator('[data-group="2"]').uncheck();
}
if(!before){expectedPj=JSON.stringify(pj);await fs.writeFile(path.join(tmp,A,'_Projekt.json'),expectedPj);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.project-summary').filter({hasText:'Wohnhaus'}).waitFor();}
await page.locator('[data-note]').fill('Unfertiger Hinweis bleibt erhalten.');await shot('uebergabe');
if(!before){
 await page.locator('[data-handover] > summary').click();await page.locator('#vtBox > summary').click();assert.ok(await page.locator('#vtBox .vtAn').first().isDisabled());
 assert.equal(await fs.readFile(path.join(tmp,A,'_Projekt.json'),'utf8'),expectedPj,'digital legacy display never rewrites PJ');
 await page.locator('#vtBox > summary').click();
}
await page.evaluate(async id=>{const p=await new SharedDirectoryHandle('').getDirectoryHandle('24.0012 Fiktivstadt');const r=await BueroData.load(p,id);await BueroData.append(p,BueroData.event(r,'question',{text:'Bitte Empfängeradresse ergänzen. Die Papiermappe liegt im Büro.'},'AB'));},id);
await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
await page.locator(before?'[data-records]':'#bueroAttention').filter({hasText:'Bitte Empfängeradresse ergänzen.'}).waitFor();
await shot('rueckfrage');
if(!before){
 assert.ok(await page.locator('#bueroAttention [data-answer]').isVisible());
 const alert=await page.locator('#bueroAttention').boundingBox();assert.ok(alert.y<350);
 // A narrower office window and 150% rendering enlargement; no new browser matrix.
 for(const [width,height,zoom,name] of [[1024,768,1,'klein']]){
  await page.setViewportSize({width,height});await page.evaluate(zoom=>document.documentElement.style.zoom=zoom,zoom);await top();
  assert.ok(await page.locator('#bueroAttention [data-answer]').isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal document overflow');
  await page.screenshot({path:path.join(out,'nachher-'+name+'.png')});
 }
 await page.evaluate(()=>document.documentElement.style.zoom=1);await page.setViewportSize({width:1440,height:1000});
 // A project-data save error remains outside its collapsed form and has a direct entry.
 await page.locator('#pjBox > summary').click();await page.evaluate(()=>testIO.failWrite=true);await page.locator('#pj_objekt').fill('Nicht gespeicherter Entwurf');await page.locator('#pjSave.err').waitFor();await page.locator('#pjBox > summary').click();assert.match(await page.locator('#pjAttention').innerText(),/nicht gespeichert/);assert.ok(await page.locator('#showPJ').isVisible());
 await page.evaluate(()=>testIO.failWrite=false);await page.locator('#showPJ').click();await page.locator('#pj_objekt').fill(pj.objekt);await page.locator('#pjSave.ok').waitFor();
 // Historical editing stays available without a digital order and creates no handover.
 await page.locator(`.proj[data-name="${B}"]`).click();await page.locator('[data-overview]').filter({hasText:'Noch nicht übergeben'}).waitFor();await page.locator('#vtBox > summary').click();
 assert.ok(await page.locator('#vtBox .vtAn').first().isEnabled());await page.locator('#vtBox .vtAn').first().check();await page.waitForFunction(()=>document.querySelector('#vtBox .vtAn')?.checked);
 assert.ok(!await fs.stat(path.join(tmp,B,'_Buero')).catch(()=>null));
 assert.equal(await page.locator('[data-handover-label]').innerText(),'Übergabe vorbereiten');
 await fs.mkdir(path.join(tmp,B,'_Buero'));await page.evaluate(()=>testIO.failList=true);await page.locator('[data-refresh]').click();await page.locator('#bueroAttention').filter({hasText:'unvollständig/veraltet'}).waitFor();
 await page.locator('[data-handover] > summary').click();assert.ok(!await page.locator('[data-form]').isVisible(),'failed read offers no empty creation form');
 await page.evaluate(()=>testIO.failList=false);await page.locator('[data-refresh]').click();await page.locator('[data-overview]').filter({hasText:'Noch nicht übergeben'}).waitFor();
 await page.locator('[data-handover] > summary').click();await page.locator('[data-handover] > summary').click();await page.waitForFunction(()=>document.querySelector('[data-form]')?.open);await page.locator('[data-path] > summary').click();
 await page.locator('[data-word]').fill('Mitteilungen/Gutachten B.docx');await page.locator('[data-entry="0:0"]').fill('Bestätigter Empfänger B');await page.locator('[data-who]').fill('SK');
 await page.evaluate(()=>testIO.failWrite=true);await page.locator('[data-submit]').click();await page.locator('[data-message]').filter({hasText:'Nicht bestätigt gespeichert'}).waitFor();
 const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('buero-draft:26.9999 Kontrollort')).pending);
 await page.locator('[data-handover] > summary').click();assert.ok(!await page.locator('[data-submit]').isVisible());assert.ok(await page.locator('#bueroAttention [data-head-retry]').isVisible());
 await page.locator('#bueroAttention [data-head-retry]').focus();await page.evaluate(()=>{testIO.failWrite=false;window.dispatchEvent(new Event('focus'));});await page.locator('#bueroAttention').filter({hasText:'unvollständig/veraltet'}).waitFor();
 assert.ok(await page.locator('#bueroAttention [data-head-retry]').evaluate(e=>document.activeElement===e),'refresh retains keyboard focus on the direct retry action');
 assert.ok(await page.locator('#bueroAttention [data-head-retry]').isEnabled());
 // The uncertain write is now readable, but only the explicit retry may confirm it.
 await fs.writeFile(path.join(tmp,B,'_Buero',pending.data.id,'auftrag.json'),JSON.stringify(pending.data));
 await page.locator('[data-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-overview]')?.textContent.includes('Mitteilungen/Gutachten B.docx'));
 assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('buero-draft:26.9999 Kontrollort')).pending),pending);
 assert.ok(!await page.locator('[data-submit]').isVisible());assert.ok(await page.locator('#bueroAttention [data-head-retry]').isVisible());
 await page.locator('#bueroAttention [data-head-retry]').click();await page.locator('[data-message]').filter({hasText:'Gespeichert und rückgelesen'}).waitFor();
 const orders=await fs.readdir(path.join(tmp,B,'_Buero'));assert.deepEqual(orders,[pending.data.id]);assert.deepEqual(JSON.parse(await fs.readFile(path.join(tmp,B,'_Buero',pending.data.id,'auftrag.json'),'utf8')),pending.data);
 // Closed orders stay in history; opening a new draft never reuses them.
 const completed=await page.evaluate(async content=>{const p=new SharedDirectoryHandle('26.9999 Kontrollort'),o=BueroData.order(content);await BueroData.create(p,o);for(const [type,payload] of [['proof',{}],['pdf',{path:'Mitteilungen/Fiktives Gutachten.pdf'}],['send',{ids:content.recipients.map(r=>r.id),date:'2026-10-21'}]]){const r=await BueroData.load(p,o.id);await BueroData.append(p,BueroData.event(r,type,payload,'AB'));}return o.id;},pending.data.content);
 await page.evaluate(async id=>{const p=new SharedDirectoryHandle('26.9999 Kontrollort'),r=await BueroData.load(p,id);await BueroData.append(p,BueroData.event(r,'withdraw',{text:'Fiktiver Rückzug'},'SK'));},pending.data.id);
 await page.locator('[data-refresh]').click();await page.locator('[data-handover-label]').filter({hasText:'Neue Übergabe vorbereiten'}).waitFor();
 await page.locator('[data-handover] > summary').click();await page.waitForFunction(()=>document.querySelector('[data-form]')?.open);
 assert.equal(await page.locator('[data-form-label]').innerText(),'Neue Übergabe vorbereiten');assert.equal(await page.locator('[data-history] [data-record]').count(),2);assert.match(await page.locator(`[data-record="${completed}"] > summary`).textContent(),/Erledigt/);
 assert.deepEqual((await fs.readdir(path.join(tmp,B,'_Buero'))).sort(),[pending.data.id,completed].sort());
 await page.locator('[data-note]').fill('Noch nicht übergebener lokaler Entwurf');
 // Two foreign open orders must both remain explicit, without replacing the local draft.
 const foreign=await page.evaluate(async content=>{const p=new SharedDirectoryHandle('26.9999 Kontrollort'),ids=[];for(let i=0;i<2;i++){const o=BueroData.order({...content,note:'Fremder offener Auftrag '+i});await BueroData.create(p,o);ids.push(o.id);}return ids;},pending.data.content);
 await page.locator('[data-refresh]').click();await page.locator('[data-handover-label]').filter({hasText:'Offene Übergaben ansehen'}).waitFor();
 assert.equal(await page.locator('[data-form-label]').innerText(),'Noch nicht übergebener Entwurf');assert.equal(await page.locator('[data-note]').inputValue(),'Noch nicht übergebener lokaler Entwurf');
 assert.equal(await page.locator('[data-who]').inputValue(),'SK');assert.equal(await page.locator('[data-entry="0:0"]').inputValue(),'Bestätigter Empfänger B');
 for(const fid of foreign)assert.equal(await page.locator(`[data-record="${fid}"]`).count(),1);
 await page.locator('[data-handover] > summary').click();await page.locator('[data-refresh]').click();await page.locator('[data-handover] > summary').click();
 assert.equal(await page.locator('[data-note]').inputValue(),'Noch nicht übergebener lokaler Entwurf');
 for(const fid of foreign)assert.ok(await page.locator(`[data-record="${fid}"]`).evaluate(e=>e.open));
 const independent=await(await context()).newPage();independent.on('pageerror',e=>errors.push(e.message));await independent.goto(base+'/index.html');await independent.locator('#btnStart').click();await independent.locator(`.proj[data-name="${B}"]`).click();await independent.locator('[data-handover-label]').filter({hasText:'Offene Übergaben ansehen'}).waitFor();await independent.locator('[data-handover] > summary').click();
 assert.ok(!await independent.locator('[data-form]').isVisible());for(const fid of foreign)assert.ok(await independent.locator(`[data-record="${fid}"]`).evaluate(e=>e.open));await independent.close();

 await page.locator('[data-submit]').click();await page.locator('[data-message]').filter({hasText:'bereits eine offene Übergabe'}).waitFor();assert.equal((await fs.readdir(path.join(tmp,B,'_Buero'))).length,4);

}
if(!before){
 const zc=await pw.chromium.launchPersistentContext(path.join(tmp,'.zoom-profile'),{executablePath:process.env.BROWSER_EXECUTABLE||pw.chromium.executablePath(),headless:true,viewport:null,args:['--no-sandbox','--window-size=1024,768']});
 contexts.push(zc);
 const settings=await zc.newPage();await settings.goto('chrome://settings/appearance');await settings.evaluate(()=>new Promise(resolve=>chrome.settingsPrivate.setDefaultZoom(1.5,resolve)));await settings.close();
 await context(zc);const z=zc.pages()[0];z.on('pageerror',e=>errors.push(e.message));await z.goto(base+'/index.html');await z.locator('#btnStart').click();await z.locator(`.proj[data-name="${A}"]`).click();await z.locator('#bueroAttention').filter({hasText:'Bitte Empfängeradresse ergänzen.'}).waitFor();
 await z.evaluate(()=>document.fonts.ready);assert.equal(await z.evaluate(()=>devicePixelRatio),1.5,'native browser zoom, not CSS scaling');assert.ok(await z.evaluate(()=>innerWidth<=700));
 assert.ok(await z.locator('#bueroAttention [data-answer]').isVisible());const alertBounds=await z.locator('#bueroAttention').boundingBox();assert.ok(alertBounds.y+alertBounds.height<=await z.evaluate(()=>innerHeight),'question is inside the visible zoomed viewport: '+JSON.stringify({alertBounds,height:await z.evaluate(()=>innerHeight)}));assert.ok(await z.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await z.locator('#detail').evaluate(e=>e.scrollTop=0);const cdp=await zc.newCDPSession(z);const screen=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});await fs.writeFile(path.join(out,'nachher-browserzoom-150.png'),Buffer.from(screen.data,'base64'));
}
assert.deepEqual(errors,[]);console.log('OK Projektansicht: '+(before?'Vorher-Screenshots':'Maus/Tastatur, vier Fragmentlinks, Klappen/Empfänger/Cursor, drei Übergabeeinstiege, mehrere offene Aufträge, erhaltener lokaler Entwurf, Retry bei bereits lesbarer Datei und zugeklappten Details, historische Angaben, sichtbare Rückfrage und Speicherfehler, Desktop/klein/echter 150%-Browserzoom'));
}finally{for(const c of contexts)await c.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
