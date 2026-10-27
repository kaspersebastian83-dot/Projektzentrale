
// Projektzentrale 1.29: Liste in Gruppen mit Stand, „Heute für dich“, „Jetzt dran“ führt zur Aktion, Menü „⋯ Mehr“.
// Synthetische Projekte im Testarchiv (gemeinsamer Dateizugriff wie projektansicht-browser.cjs, ohne OPFS).
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http'),pw=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
const out=process.env.UI_SCREENSHOTS_OUTPUT||path.resolve(__dirname,'projektansicht-results');await fs.mkdir(out,{recursive:true});
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pz-shot-'));
const subs=['Fotos','Pläne','Laboraufträge','Laborergebnisse','Mitteilungen','Emails','Rechnung Labore'];
const mk=async(n)=>{for(const s of subs)await fs.mkdir(path.join(tmp,n,s),{recursive:true});return n;};
const w=(n,rel,t)=>fs.writeFile(path.join(tmp,n,rel),t);
await fs.writeFile(path.join(tmp,'_Spektron-Mitarbeiter.json'),JSON.stringify({format:'spektron-mitarbeiter',version:1,personen:[{ordnerKuerzel:'SK',appKuerzel:'SK',name:'Sebastian Beispiel',aktiv:true},{ordnerKuerzel:'Ben',appKuerzel:'Ben',name:'Ben Test',aktiv:true},{ordnerKuerzel:'Nad',appKuerzel:'Nad',name:'Nadine Test',aktiv:true}]}));
const voll={format:'mosaik-projekt',version:1,objekt:'Wohnhaus, Musterweg 12',nutzung:'wohnen',auftraggeber:'Beispiel AG',schadendatum:'2026-09-01',ortstermin:'2026-09-15',sachverstaendiger:'Dr. Beispiel'};
// A: Ergebnisse da, Pflichtangaben fehlen
const A=await mk('26.0105 Fiktivstadt SK');await w(A,'_Projekt.json',JSON.stringify({format:'mosaik-projekt',version:1,objekt:'Wohnhaus, Musterweg 12',auftraggeber:'Beispiel AG, Abteilung West',ortstermin:'2026-10-05'}));
await w(A,'Laboraufträge/26.0105_PAK_Daten.json','{}');await w(A,'Laboraufträge/26.0105_PAK_5.10.2026_Laborübergabe.xls','x');
await w(A,'Laborergebnisse/AR-1-01.xml','<x/>');await w(A,'Laborergebnisse/AR-1-01.pdf','%PDF');await w(A,'Laborergebnisse/AR-1-02.pdf','%PDF');
for(let i=1;i<=6;i++)await w(A,`Fotos/IMG_${i}.jpg`,'x');await w(A,'Fotos/_Bildumbenenner.json','{}');await w(A,'Pläne/Plan.probenplan','{}');
// B: Rückfrage vom Büro
const B=await mk('26.0104 Kontrollort SK');await w(B,'_Projekt.json',JSON.stringify({...voll,objekt:'Halle 3, Industriestr. 5'}));await w(B,'Laboraufträge/x_Daten.json','{}');await w(B,'Laborergebnisse/A.xml','<x/>');
await w(B,'Laborergebnisse/_Ergebnisse.json',JSON.stringify({format:'spektron-ergebnisse',version:1,vollstaendig:true,offen:[],stand:''}));
// C: beim Büro
const C=await mk('26.0103 Haus Nord SK');await w(C,'_Projekt.json',JSON.stringify({...voll,objekt:'Haus Nord'}));await w(C,'Laboraufträge/x_Daten.json','{}');
// D: beim Labor
const D=await mk('26.0102 Beispielweg SK');await w(D,'_Projekt.json',JSON.stringify({...voll,objekt:'Beispielweg 7'}));await w(D,'Laboraufträge/x_Daten.json','{}');await w(D,'Laboraufträge/26.0102_PAK_8.10.2026_Laborübergabe.xls','x');
// E: fertig
const E=await mk('26.0101 Musterstadt SK');await w(E,'_Projekt.json',JSON.stringify({...voll,verteiler:{versicherung:{an:true,versandt:'2026-10-20'}}}));await w(E,'Laboraufträge/x_Daten.json','{}');
await fs.mkdir(path.join(tmp,E,'Abrechnung'));await w(E,'Abrechnung/26-0101_Aufwand_2026-10-22.json','{}');
// F: anderer Kollege, G: alt
const F=await mk('26.0099 Andersstadt Ben');await w(F,'Laboraufträge/x_Daten.json','{}');
await mk('21.0007 Früher SK');
// H: nur Laborübergabe aus LabelKit (ohne _Daten.json) → beim Labor; I: Büroaufgabe nicht lesbar → kein „abgeschlossen“ aus Teildaten
const H=await mk('26.0106 Nurlabor SK');await w(H,'_Projekt.json',JSON.stringify(voll));await w(H,'Laboraufträge/26.0106_PAK_9.10.2026_Laborübergabe.xls','x');
const I=await mk('26.0107 Teilweise SK');await w(I,'_Projekt.json',JSON.stringify({...voll,verteiler:{versicherung:{an:true,versandt:'2026-10-01'}}}));await w(I,'Laboraufträge/x_Daten.json','{}');
await fs.mkdir(path.join(tmp,I,'Abrechnung'));await w(I,'Abrechnung/26-0107_Aufwand_2026-10-05.json','{}');
await fs.mkdir(path.join(tmp,I,'_Buero','aufgaben'),{recursive:true});await w(I,'_Buero/aufgaben/kaputt.json','{nicht lesbar');
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');if(/^\/(labelkit|Bildumbenenner|resultkit|Probenplan|aufwandkit)\/$/.test(u.pathname)){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Fiktives App-Testziel</title>');return;}let file=path.resolve(root,decodeURIComponent(u.pathname).slice(1)||'index.html');if(!file.startsWith(root+path.sep))throw Error();if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end();}});
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
   case'read':{const buf=await fs.readFile(absolute);return {text:buf.toString(),size:buf.length,mtime:(await fs.stat(absolute)).mtimeMs};}
   case'write':await fs.writeFile(absolute,arg.text);return true;
  }}catch(e){if(e.code==='ENOENT')return {notfound:true};throw e;}
 });
 await c.addInitScript(()=>{
  window.testIO={failWrite:false,failList:false,failRead:false,failAfterClose:false,hideGrant:false};
  const io=async arg=>{const r=await window.__sharedIO(arg);if(r?.notfound)throw new DOMException('Missing','NotFoundError');return r;};
  class Handle{constructor(rel,kind){this.rel=rel;this.kind=kind;this.name=rel.split('/').at(-1)||'Testarchiv';}async queryPermission(){return window.testIO.hideGrant?'denied':'granted';}async requestPermission(){return this.queryPermission();}async isSameEntry(h){return h.rel===this.rel;}}
  class FileHandle extends Handle{constructor(rel){super(rel,'file');}async getFile(){const r=await io({op:'read',rel:this.rel,fail:window.testIO.failRead&&this.name.startsWith('rueckmeldung-')?'read':null});return {name:this.name,size:r.size,lastModified:/\.docx?$/i.test(this.name)?r.mtime:1,text:async()=>r.text,arrayBuffer:async()=>new TextEncoder().encode(r.text).buffer};}async createWritable(){if(window.testIO.failWrite)throw Error('SYNTHETIC write');let text;const rel=this.rel;return{write:async value=>{text=value;},abort:async()=>{},close:async()=>{await io({op:'write',rel,text});if(window.testIO.failAfterClose){window.testIO.failRead=true;window.testIO.failAfterClose=false;}}};}}
  class DirectoryHandle extends Handle{constructor(rel){super(rel,'directory');}child(n){return(this.rel?this.rel+'/':'')+n;}async getDirectoryHandle(n,opts={}){const rel=this.child(n);await io({op:'dir',rel,create:opts.create});return new DirectoryHandle(rel);}async getFileHandle(n,opts={}){const rel=this.child(n);await io({op:'file',rel,create:opts.create});return new FileHandle(rel);}async *values(){if(window.testIO.pauseList&&this.name==='_Buero')await new Promise(resolve=>(window.testIO.resumeLists??=[]).push(resolve));for(const h of await io({op:'list',rel:this.rel,fail:window.testIO.failList&&this.name==='_Buero'?'list':null}))yield h.kind==='directory'?new DirectoryHandle(this.child(h.name)):new FileHandle(this.child(h.name));}async resolve(h){const prefix=this.rel?this.rel+'/':'';return h.rel.startsWith(prefix)?h.rel.slice(prefix.length).split('/'):null;}}
  window.SharedDirectoryHandle=DirectoryHandle;
  window.showDirectoryPicker=async()=>new DirectoryHandle('');
  window.showOpenFilePicker=async()=>[new FileHandle(window.testPick||'24.0012 Fiktivstadt/Mitteilungen/Gutachten B.docx')];
 });
 return c;
}

const page=await(await context()).newPage();await page.setViewportSize({width:1440,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/index.html');await page.evaluate(()=>{localStorage.setItem('spektron-ich','SK');});
await page.locator('#btnStart').click();await page.locator('.proj').first().waitFor();
// Büro: Kontrollort mit Rückfrage, Haus Nord beim Büro
await page.evaluate(async()=>{const r=new SharedDirectoryHandle('');
  const b=await r.getDirectoryHandle('26.0104 Kontrollort SK');const a=await BueroAufgaben.aufgabeAnlegen(b,{art:'gutachten',von:'SK',empfaenger:[{gruppe:'versicherung',label:'Auftraggeber',details:'Beispiel AG'}]});await BueroAufgaben.vermerken(b,{aufgabe:a.id,schritt:'frage',text:'Fehlt die Anlage 3?',von:'Nad'});
  const c=await r.getDirectoryHandle('26.0103 Haus Nord SK');const a2=await BueroAufgaben.aufgabeAnlegen(c,{art:'gutachten',von:'SK',empfaenger:[{gruppe:'versicherung',label:'Auftraggeber',details:'Beispiel AG'}]});await BueroAufgaben.vermerken(c,{aufgabe:a2.id,schritt:'gegenlesen',von:'Nad'});});
await page.locator('#btnRescan').click();
const gruppe=n=>page.locator(`.proj[data-name="${n}"]`).getAttribute('data-gruppe');
await page.waitForFunction(()=>document.querySelectorAll('.proj[data-gruppe=lesen]').length===0&&document.querySelector('.proj[data-name="26.0103 Haus Nord SK"]')?.dataset.gruppe==='laeuft',null,{timeout:15000});
// Liste: Gruppen in fester Reihenfolge, je mit kurzem Stand
assert.deepEqual(await page.locator('#list .group').evaluateAll(g=>g.map(x=>x.dataset.gruppe)),['dich','laeuft','fertig','aelter']);
assert.deepEqual(await Promise.all(['26.0105 Fiktivstadt SK','26.0104 Kontrollort SK','26.0103 Haus Nord SK','26.0102 Beispielweg SK','26.0101 Musterstadt SK','21.0007 Früher SK'].map(gruppe)),['dich','dich','laeuft','laeuft','fertig','aelter']);
const stand=n=>page.locator(`.proj[data-name="${n}"] .stand`).textContent();
assert.equal(await stand('26.0105 Fiktivstadt SK'),'Labor · Ergebnisse da');assert.equal(await stand('26.0104 Kontrollort SK'),'Rückfrage vom Büro');
assert.equal(await stand('26.0103 Haus Nord SK'),'Beim Büro');assert.equal(await stand('26.0102 Beispielweg SK'),'Beim Labor');assert.equal(await stand('26.0101 Musterstadt SK'),'Versandt und abgerechnet');
assert.equal(await stand('21.0007 Früher SK'),'','ältere Projekte ohne Stand');
assert.equal(await gruppe('26.0106 Nurlabor SK'),'laeuft');assert.equal(await stand('26.0106 Nurlabor SK'),'Beim Labor');
assert.equal(await gruppe('26.0107 Teilweise SK'),'dich');assert.equal(await stand('26.0107 Teilweise SK'),'Büro-Stand unklar');
// Heute für dich: nur meine Projekte, die mich brauchen; dann was läuft; Projekt eines Kollegen nicht
await page.locator('#heuteLink').click();await page.locator('.heute h2').waitFor();
assert.equal(await page.locator('.heute h2').innerText(),'Heute für dich, Sebastian');assert.equal(await page.locator('#heuteLink b').innerText(),'3');
assert.deepEqual(await page.locator('.heute-karte:not(.wartet) .ht b').allTextContents(),['Büro-Stand unklar','Laborergebnisse prüfen','Rückfrage vom Büro']);
assert.deepEqual(await page.locator('.heute-karte.wartet').evaluateAll(k=>k.map(x=>x.dataset.name)),['26.0106 Nurlabor SK','26.0103 Haus Nord SK','26.0102 Beispielweg SK']);
assert.equal(await page.locator('.heute-karte[data-name="26.0099 Andersstadt Ben"]').count(),0,'Projekt eines Kollegen nicht');
await page.screenshot({path:path.join(out,'heute.png')});
// Karte öffnet das Projekt; „Jetzt dran“ mit einem blauen Knopf, Stufe 3 aktuell, öffnet ResultKit im Projekt
await page.locator('.heute-karte[data-name="26.0105 Fiktivstadt SK"]').click();await page.locator('#jetztGo').waitFor();
assert.equal(await page.locator('#jetztGo').innerText(),'Ergebnisse prüfen →');assert.equal(await page.locator('#detail button.primary:visible').count(),1);
assert.match(await page.locator('[data-stufe=labor]').getAttribute('class'),/aktuell/);assert.match(await page.locator('[data-stufe=projekt]').getAttribute('class'),/z-hinweis/);
assert.equal(await page.locator('#pflichtFehlt').innerText(),'3 Pflichtangaben fehlen');assert.ok(!await page.locator('#pjBox').evaluate(d=>d.open));
{const [pop]=await Promise.all([page.waitForEvent('popup'),page.locator('#jetztGo').click()]);await pop.waitForURL(base+'/resultkit/**');assert.equal(new URLSearchParams(new URL(pop.url()).hash.slice(1)).get('projekt'),'26.0105 Fiktivstadt SK');await pop.close();}
// „Angaben“ / Pflicht-Hinweis öffnet die Projektdaten am ersten leeren Pflichtfeld
await page.locator('#pflichtFehlt').click();assert.ok(await page.locator('#pjBox').evaluate(d=>d.open));assert.equal(await page.evaluate(()=>document.activeElement.id),'pj_nutzung');
await page.screenshot({path:path.join(out,'projekt.png')});
// Rückfrage: steht oben mit Antwortfeld; „Jetzt dran“ verschwindet dafür
await page.locator('.proj[data-name="26.0104 Kontrollort SK"]').click();await page.locator('#bueroAttention [data-ab-antwort]').waitFor();
await page.waitForFunction(()=>document.querySelector('#jetzt')&&!document.querySelector('#jetzt').innerHTML);
assert.match(await page.locator('[data-stufe=buero] [data-stext]').textContent(),/Rückfrage vom Büro/);
// Beim Büro: wartet, Knopf „BüroKit öffnen“ (nicht blau), kein zweiter Übergabe-Knopf in Stufe 5; Labor ohne Spur übersprungen
await page.locator('.proj[data-name="26.0103 Haus Nord SK"]').click();await page.locator('#jetzt.wartet').waitFor();
assert.match(await page.locator('#jetzt').innerText(),/Gerade beim Büro\s*Beim Büro\s*Noch offen: PDF · Versand/i);
assert.equal(await page.locator('#jetztGo').innerText(),'BüroKit öffnen →');assert.equal(await page.locator('#detail button.primary:visible').count(),0);
assert.ok(await page.locator('#goUebergabe').isHidden());assert.match(await page.locator('[data-stufe=labor]').getAttribute('class'),/z-uebersprungen/);
assert.ok(!await page.locator('#bueroPanel [data-ab-form]').evaluate(e=>e.open),'Übergabe-Formular zu');
// Menü „⋯ Mehr“: Büro-Werkzeuge und weitere Apps; Escape schließt
assert.ok(await page.locator('#mehr').isHidden());await page.locator('#btnMehr').click();
assert.ok(await page.locator('#btnMa').isVisible());assert.ok(await page.locator('#btnAusl').isVisible());assert.ok(await page.locator('#mehr #goDurch').isVisible());
assert.match(await page.locator('#mehr #goRueck').getAttribute('href'),/projekt=26\.0103/);
await page.screenshot({path:path.join(out,'mehr.png'),clip:{x:840,y:0,width:600,height:520}});
await page.keyboard.press('Escape');assert.ok(await page.locator('#mehr').isHidden());
// Archivordner als Status oben rechts
assert.equal(await page.locator('#archiveName').innerText(),'Testarchiv');assert.match(await page.locator('#btnArchive').getAttribute('class'),/ok/);
// ohne Kürzel: Hinweis statt „Heute für dich“
await page.evaluate(()=>localStorage.removeItem('spektron-ich'));await page.selectOption('#ich','');await page.locator('#heuteLink').waitFor({state:'detached'});
assert.deepEqual(errors,[]);
console.log('OK Projektzentrale 1.29: Liste in Gruppen mit Stand, Heute für dich (nur meine), Jetzt dran mit einem Knopf, Rückfrage oben, Beim Büro wartet, übersprungene Stufe, Menü „⋯ Mehr“, Archiv-Status');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);console.log(`::error title=Browsertest Heute::${String(e&&e.message||e).replace(/\n/g,'%0A')}`);process.exit(1);});
