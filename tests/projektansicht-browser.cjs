const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http'),pw=require('playwright');
const root=process.env.PROJECT_UI_ROOT||path.resolve(__dirname,'..'),A='24.0012 Fiktivstadt',B='26.9999 Kontrollort';
(async()=>{
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'projekt-ui-')),out=process.env.UI_SCREENSHOTS_OUTPUT||path.resolve(__dirname,'projektansicht-results'),before=!!process.env.PROJECT_UI_ROOT;
await fs.mkdir(out,{recursive:true});
for(const name of [A,B]){await fs.mkdir(path.join(tmp,name,'Mitteilungen'),{recursive:true});for(const sub of ['Fotos','Pläne','Laboraufträge','Laborergebnisse','Emails','Rechnung Labore'])await fs.mkdir(path.join(tmp,name,sub));}
await fs.writeFile(path.join(tmp,A,'Mitteilungen','Gutachten B.docx'),'Synthetic placeholder');await fs.writeFile(path.join(tmp,B,'Laborergebnisse','AR-1-01.xml'),'<x/>');await fs.writeFile(path.join(tmp,B,'Laborergebnisse','AR-1-01.pdf'),'%PDF');await fs.writeFile(path.join(tmp,B,'Laborergebnisse','AR-1-02.pdf'),'%PDF');await fs.writeFile(path.join(tmp,B,'Mitteilungen','Gutachten B.docx'),'Synthetic placeholder');
await fs.writeFile(path.join(tmp,A,'Fotos','_Bildumbenenner.json'),'{}');await fs.mkdir(path.join(tmp,A,'Abrechnung'));await fs.writeFile(path.join(tmp,A,'Abrechnung','24-0012_Aufwand_2026-10-22.json'),'{}');await fs.writeFile(path.join(tmp,A,'Abrechnung','Aufwand_SK.json'),'{}');await fs.writeFile(path.join(tmp,A,'Laboraufträge','24.0012_PAK_5.1.2026_Laborübergabe.xls'),'x');await fs.writeFile(path.join(tmp,A,'Pläne','Plan.probenplan'),'{}');
const C='26.9998 Haus &lt;Nord&gt;';await fs.mkdir(path.join(tmp,C,'Fotos'),{recursive:true});   // Ordnername mit HTML-ähnlichem Text (unter Windows erlaubt)
const pj={format:'mosaik-projekt',version:1,objekt:'Wohnhaus, Musterweg 12',auftraggeber:'Beispiel AG, Abteilung West',sachverstaendigerBeteiligt:'Dr. Muster, Beispielinstitut',versicherungsnehmer:'Fiktive Person',verteiler:{versicherung:{an:true,versandt:'2026-10-20'},sachverstaendiger:{an:true},versicherungsnehmer:{an:false}}};
let expectedPj=JSON.stringify(pj);await fs.writeFile(path.join(tmp,A,'_Projekt.json'),expectedPj);
// Frühere Büroübergabe (Projektzentrale bis 1.27, „_Buero/<UUID>/“), vom Büro übernommen: erscheint weiter als offene Aufgabe
const id='0f0e0d0c-1111-4222-8333-944455556666';await fs.mkdir(path.join(tmp,A,'_Buero',id),{recursive:true});
await fs.writeFile(path.join(tmp,A,'_Buero',id,'auftrag.json'),JSON.stringify({format:'spektron-buero',version:1,id,created:'2026-10-26T09:00:00.000Z',content:{project:{name:A,nr:'24.0012',ort:'Fiktivstadt'},word:'Mitteilungen/Gutachten B.docx',who:'SK',note:'Papiermappe am Büroplatz.',recipients:[{id:'r-1',group:'versicherung',label:'Auftraggeber',details:'Beispiel AG, Abteilung West'},{id:'r-2',group:'sachverstaendiger',label:'Empfangende Sachverständige',details:'Dr. Muster, Beispielinstitut'}]}}));
await fs.writeFile(path.join(tmp,A,'_Buero',id,'rueckmeldung-1a2b3c4d-0000-4000-8000-000000000001.json'),JSON.stringify({format:'spektron-buero',version:1,id:'1a2b3c4d-0000-4000-8000-000000000001',orderId:id,at:'2026-10-26T10:00:00.000Z',actor:'AB',parents:[],type:'claim',payload:{}}));
// Word-Dateien in „Mitteilungen“: neueste vorgewählt; Word-Sperrdatei und andere Dateien nicht in der Auswahl
await fs.writeFile(path.join(tmp,A,'Mitteilungen','Gutachten Z alt.docx'),'Synthetic placeholder');await fs.utimes(path.join(tmp,A,'Mitteilungen','Gutachten Z alt.docx'),new Date('2026-01-02'),new Date('2026-01-02'));
await fs.writeFile(path.join(tmp,A,'Mitteilungen','~$tachten B.docx'),'lock');await fs.writeFile(path.join(tmp,A,'Mitteilungen','Notiz.txt'),'x');
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');if(/^\/(labelkit|Bildumbenenner|resultkit|Probenplan|aufwandkit)\/$/.test(u.pathname)){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Fiktives App-Testziel</title>');return;}let file=path.resolve(root,decodeURIComponent(u.pathname).slice(1)||'index.html');if(!file.startsWith(root+path.sep))throw Error();if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await pw.chromium.launch(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox']}:{}),contexts=[];const errors=[];require('./spektron-start-test.cjs')(browser);
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
const page=await(await context()).newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
await page.goto(base+'/index.html');await page.locator('#btnStart').click();await page.locator(`.proj[data-name="${A}"]`).click();
await page.locator('#bueroPanel [data-ab-aufgabe]').waitFor();
const stext=k=>page.locator(`[data-stufe="${k}"] [data-stext]`).textContent();
async function top(){await page.locator('#detail').evaluate(e=>e.scrollTop=0);}
async function shot(state){if(state==='uebergabe')await page.locator('#bueroPanel').evaluate(e=>e.scrollIntoView({block:'start'}));else await top();await page.screenshot({path:path.join(out,(before?'vorher':'nachher')+'-'+state+'.png')});}
await shot('projekt');
if(!before){
 const list=await page.locator('#listWrap').boundingBox(),detail=await page.locator('#detail').boundingBox();assert.ok(detail.width>list.width*1.6);
 // 1.29: sechs Stufen in Arbeitsreihenfolge, je Zustand und ein Satz; darüber „Jetzt dran“ mit einem blauen Knopf
 assert.deepEqual(await page.locator('#stufen > li').evaluateAll(l=>l.map(x=>x.dataset.stufe)),['projekt','ortstermin','labor','gutachten','buero','abrechnung']);
 assert.deepEqual(await page.locator('#stufen .sname').evaluateAll(l=>l.map(x=>x.firstChild.textContent.trim())),['Projekt anlegen','Ortstermin: Proben & Fotos','Labor','Gutachten','Ans Büro → Versand','Abrechnung']);
 assert.match(await stext('ortstermin'),/Fotos in Bearbeitung/);
 assert.ok((await page.locator('#jetzt').boundingBox()).y<(await page.locator('#stufen').boundingBox()).y);
 assert.ok(await page.locator('#detail button.primary:visible').count()<=1,'höchstens ein blauer Knopf: „Jetzt dran“');assert.match(await page.locator('#jetzt').innerText(),/Gerade beim Büro\s*Beim Büro\s*Noch offen: Gegenlesen · PDF · Versand/i);
 // Projektstand: Laborauftrag (Datum aus dem Dateinamen) in Stufe 2, Abrechnungsstand aus BelegKit in Stufe 6, frühere Übergabe in Stufe 4
 await page.waitForFunction(()=>/Laborauftrag 05\.01\./.test(document.querySelector('[data-stufe=ortstermin] [data-stext]').textContent));
 assert.match(await stext('abrechnung'),/Abrechnungsstand vom 22\.10\./);
 await page.waitForFunction(()=>/Gutachten übergeben \d\d\.\d\d\./.test(document.querySelector('[data-stufe=gutachten] [data-stext]').textContent),null,{timeout:10000});
 assert.match(await stext('buero'),/^Beim Büro · noch offen: Gegenlesen · PDF · Versand$/);
 await page.locator(`.proj[data-name="${B}"]`).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.proj.active')?.dataset.name==='26.9999 Kontrollort');
  assert.ok(await page.locator('#azQuick').isVisible());
 // ResultKit-Karte: XML+PDF gleichen Namens = ein Bericht, PDF allein zählt mit; nach der Übernahme in ResultKit beim Zurückkehren aktualisiert
 assert.match(await stext('labor'),/^2 Prüfberichte eingegangen, noch nicht geprüft$/);
 assert.equal(await page.locator('#jetztGo').innerText(),'Ergebnisse prüfen →');assert.match(await page.locator('#goErgebnis').getAttribute('class'),/passt/);
 // Dateistand wie in ResultKit (Name|Größe|Änderungszeit, sortiert; der Test-Dateizugriff meldet Änderungszeit 1): XML/PDF und neueste LabelKit-Datei
 const kennung=async extra=>{const d=[];for(const n of await fs.readdir(path.join(tmp,B,'Laborergebnisse')))if(/\.(xml|pdf)$/i.test(n))d.push({name:n,size:(await fs.stat(path.join(tmp,B,'Laborergebnisse',n))).size,t:1});for(const n of extra||[])d.push({name:'Laboraufträge/'+n,size:(await fs.stat(path.join(tmp,B,'Laboraufträge',n))).size,t:1});return d.sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`${x.name}|${x.size}|${x.t}`).join('\n');};
 const ergebnis=async (o,extra)=>fs.writeFile(path.join(tmp,B,'Laborergebnisse','_Ergebnisse.json'),JSON.stringify({format:'spektron-ergebnisse',version:1,uebernommen:'2026-10-26T10:00:00.000Z',vollstaendig:false,offen:['P4'],berichte:[],stand:await kennung(extra),...o}));
 const zurueck=async re=>{await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(r=>new RegExp(r).test(document.querySelector('[data-stufe=labor] [data-stext]').textContent),re);};
 await ergebnis();
 await zurueck('^Zwischenstand übernommen · 1 offen beim Labor$');
 // LabelKit speichert danach (Auftrag geändert): Karte nicht mehr „übernommen“, Proben-Karte ohne neues Projekt-Lesen aktualisiert
 await fs.writeFile(path.join(tmp,B,'Laboraufträge','26.9999_2026-10-26_Daten.json'),JSON.stringify({proben:[]}));
 await zurueck('^Neue Prüfberichte seit der Übernahme – prüfen und übernehmen$');
 assert.match(await stext('ortstermin'),/^Proben erfasst/);
 await ergebnis({vollstaendig:true,offen:[]},['26.9999_2026-10-26_Daten.json']);await zurueck('^Ergebnisse vollständig übernommen');
 // neuer Prüfbericht nach der Übernahme
 await fs.writeFile(path.join(tmp,B,'Laborergebnisse','AR-2-01.pdf'),'%PDF');
 await zurueck('^Neue Prüfberichte seit der Übernahme – prüfen und übernehmen$');
 // fremde oder neuere Ergebnisdatei: nicht als übernommen werten
 await ergebnis({format:'irgendwas'},['26.9999_2026-10-26_Daten.json']);await zurueck('^Ergebnisdatei nicht lesbar');
 await ergebnis({version:2},['26.9999_2026-10-26_Daten.json']);await zurueck('^Ergebnisdatei nicht lesbar');
 await ergebnis({},['26.9999_2026-10-26_Daten.json']);await zurueck('^Zwischenstand übernommen · 1 offen beim Labor$');
 // unveränderter Ordner: Zurückkehren zeichnet die Ansicht nicht neu
 await page.evaluate(()=>{document.querySelector('#goErgebnis').dataset.unveraendert='1';window.dispatchEvent(new Event('focus'));});await page.waitForTimeout(1000);
 assert.equal(await page.locator('#goErgebnis').getAttribute('data-unveraendert'),'1');
 // Fehlende Unterordner anlegen: der Projektname steht als Text im Dialog
 await page.locator('.proj').filter({hasText:'Haus &lt;Nord&gt;'}).click();await page.locator('#mkSubs').click();
 assert.match(await page.locator('#dialog .m').textContent(),/^In „26\.9998 Haus &lt;Nord&gt;“ werden angelegt: /);await page.locator('#dNo').click();
 await page.locator(`.proj[data-name="${A}"]`).focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('.proj.active')?.dataset.name==='24.0012 Fiktivstadt');
 for(const [button,app] of [['goLabel','labelkit'],['goFotos','Bildumbenenner'],['goErgebnis','resultkit'],['goPlan','Probenplan'],['goAufwand','aufwandkit']]){
  const [pop]=await Promise.all([page.waitForEvent('popup'),page.locator('#'+button).click()]);await pop.waitForURL(base+'/'+app+'/**');const u=new URL(pop.url());assert.equal(u.search,'');assert.equal(new URLSearchParams(u.hash.slice(1)).get('projekt'),A);await pop.close();
 }
}
if(!before){
 // Karte „Ans Büro“: frühere Übergabe als offene Aufgabe in einer Zeile; Formular zu, weil schon ein Gutachten beim Büro ist
 assert.equal(await page.locator('#bueroPanel h3').innerText(),'Ans Büro');
 assert.match(await page.locator('#bueroPanel [data-ab-stand]').innerText(),/^Gutachten beim Büro · übergeben 26\.10\. von SK · noch offen: Gegenlesen · PDF · Versand · in Arbeit bei AB$/);
 assert.equal(await page.locator(`[data-ab-aufgabe="${id}"]`).getAttribute('title'),'Word-Datei: Mitteilungen/Gutachten B.docx');
 assert.ok(!await page.locator('[data-ab-form]').evaluate(e=>e.open),'Formular zu: Gutachten schon beim Büro');
 assert.equal(await page.locator('[data-ab-kit]').getAttribute('href'),'../buerokit/');assert.equal(await page.locator('[data-ab-kit]').getAttribute('target'),'buerokit');
 assert.equal(await page.locator('#goBuero').getAttribute('href'),'../buerokit/');assert.equal(await page.locator('#goBuero').getAttribute('target'),'buerokit');
 assert.match(await page.locator('#goBuero').innerText(),/BüroKit\s*Aufgaben des Büros: Gutachten gegenlesen, PDF, Versand/);
 // Übergabeformular vorbelegt: neueste Word-Datei aus „Mitteilungen“, Auftraggeber und beteiligter Sachverständiger angehakt
 await page.locator('[data-ab-summary]').click();
 assert.deepEqual(await page.locator('[data-ab-word] option').allTextContents(),['– keine Word-Datei –','Gutachten B.docx','Gutachten Z alt.docx']);
 assert.equal(await page.locator('[data-ab-word]').inputValue(),'Mitteilungen/Gutachten B.docx');
 assert.deepEqual(await page.locator('[data-ab-an]').evaluateAll(es=>es.map(e=>e.checked)),[true,true,false,false]);
 assert.deepEqual(await page.locator('[data-ab-details]').evaluateAll(es=>es.map(e=>e.value)),['Beispiel AG, Abteilung West','Dr. Muster, Beispielinstitut','Fiktive Person','']);
 // Halb ausgefüllt: bleibt beim Neuzeichnen (Projektdaten von außen geändert) und beim Projektwechsel; Cursor bleibt
 await page.locator('[data-ab-details="2"]').fill('Entwurf Versicherungsnehmer, Beispielweg 8');await page.locator('[data-ab-an="2"]').check();await page.locator('[data-ab-word]').selectOption('Mitteilungen/Gutachten Z alt.docx');
 await page.locator('[data-ab-hinweis]').fill('Unfertiger Hinweis bleibt erhalten.');await page.locator('[data-ab-hinweis]').evaluate(e=>{e.focus();e.setSelectionRange(4,9);});
 expectedPj=JSON.stringify({...pj,objekt:'Extern aktualisiertes fiktives Objekt',auftraggeber:'Neue Beispiel AG'});await fs.writeFile(path.join(tmp,A,'_Projekt.json'),expectedPj);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.project-summary').filter({hasText:'Extern aktualisiertes'}).waitFor();await page.waitForFunction(()=>document.activeElement?.matches('[data-ab-hinweis]'));
 assert.deepEqual(await page.locator('[data-ab-hinweis]').evaluate(e=>[e.selectionStart,e.selectionEnd]),[4,9]);
 await page.waitForFunction(()=>document.querySelector('[data-ab-details="0"]')?.value==='Neue Beispiel AG');   // nicht selbst geänderter Empfänger folgt den Projektdaten
 assert.equal(await page.locator('[data-ab-details="2"]').inputValue(),'Entwurf Versicherungsnehmer, Beispielweg 8');
 await page.locator(`.proj[data-name="${B}"]`).click();await page.locator('#bueroPanel[data-projekt="26.9999 Kontrollort"] [data-ab-stand]').filter({hasText:'Noch nichts beim Büro'}).waitFor();
 await page.locator(`.proj[data-name="${A}"]`).click();await page.locator(`#bueroPanel [data-ab-aufgabe="${id}"]`).waitFor();
 assert.ok(await page.locator('[data-ab-form]').evaluate(e=>e.open),'selbst aufgeklappt bleibt offen');
 assert.equal(await page.locator('[data-ab-hinweis]').inputValue(),'Unfertiger Hinweis bleibt erhalten.');assert.equal(await page.locator('[data-ab-word]').inputValue(),'Mitteilungen/Gutachten Z alt.docx');
 assert.ok(await page.locator('[data-ab-an="2"]').isChecked());assert.equal(await page.locator('[data-ab-details="2"]').inputValue(),'Entwurf Versicherungsnehmer, Beispielweg 8');
 expectedPj=JSON.stringify(pj);await fs.writeFile(path.join(tmp,A,'_Projekt.json'),expectedPj);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.project-summary').filter({hasText:'Wohnhaus'}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-ab-details="0"]')?.value==='Beispiel AG, Abteilung West');
 // Frühere Versandangaben: mit Gutachten beim Büro nur Ansicht; die Anzeige schreibt die Projektdaten nicht
 await page.locator('#vtBox > summary').click();assert.ok(await page.locator('#vtBox .vtAn').first().isDisabled());
 assert.equal(await fs.readFile(path.join(tmp,A,'_Projekt.json'),'utf8'),expectedPj,'display never rewrites PJ');
 await page.locator('#vtBox > summary').click();
}
await shot('uebergabe');
// Rückfrage des Büros (so wie BüroKit sie schreibt) erscheint oben am Projektkopf
await fs.mkdir(path.join(tmp,A,'_Buero','vermerke'),{recursive:true});
await fs.writeFile(path.join(tmp,A,'_Buero','vermerke','2b3c4d5e-0000-4000-8000-000000000002.json'),JSON.stringify({format:'spektron-buerokit',version:1,typ:'vermerk',id:'2b3c4d5e-0000-4000-8000-000000000002',aufgabe:id,zeit:'2026-10-27T08:15:00.000Z',von:'AB',schritt:'frage',wert:true,text:'Bitte Empfängeradresse ergänzen. Die Papiermappe liegt im Büro.'}));
await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
await page.locator('#bueroAttention').filter({hasText:'Bitte Empfängeradresse ergänzen.'}).waitFor();
await shot('rueckfrage');
if(!before){
 assert.ok(await page.locator('#bueroAttention [data-ab-antworten]').isVisible());
 const alert=await page.locator('#bueroAttention').boundingBox();assert.ok(alert.y<350);
 // A narrower office window and 150% rendering enlargement; no new browser matrix.
 for(const [width,height,zoom,name] of [[1024,768,1,'klein']]){
  await page.setViewportSize({width,height});await page.evaluate(zoom=>document.documentElement.style.zoom=zoom,zoom);await top();
  assert.ok(await page.locator('#bueroAttention [data-ab-antworten]').isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal document overflow');
  await page.screenshot({path:path.join(out,'nachher-'+name+'.png')});
 }
 await page.evaluate(()=>document.documentElement.style.zoom=1);await page.setViewportSize({width:1440,height:1000});
 // A project-data save error remains outside its collapsed form and has a direct entry.
 // Pflichtangaben: Karte öffnet sich, solange welche fehlen; leere Pflichtfelder hervorgehoben, Zähler im Kopf springt zum ersten
 // 1.29: Projektdaten bleiben zugeklappt; fehlende Pflichtangaben stehen oben (Hinweis) und in Stufe 1
 assert.ok(!await page.locator('#pjBox').evaluate(d=>d.open),'Projektdaten zugeklappt');assert.match(await stext('projekt'),/Pflichtangaben fehlen$/);
 await page.locator('#pjBox > summary').click();
 assert.match(await page.locator('#pflichtFehlt').innerText(),/^\d+ Pflichtangaben fehlen$/);
 assert.equal(await page.locator('#pj_objekt').evaluate(e=>e.closest('label').classList.contains('pflicht-offen')),false,'Objekt ist ausgefüllt');
 assert.equal(await page.locator('#pj_nutzung').evaluate(e=>e.closest('label').classList.contains('pflicht-offen')),true,'Nutzung leer → hervorgehoben');
 assert.equal(await page.locator('#pj_notizen').evaluate(e=>e.closest('label').classList.contains('pflicht')),false,'Notizen sind keine Pflicht');
 await page.locator('#pflichtFehlt').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'pj_nutzung','Klick springt zum ersten leeren Pflichtfeld');
 assert.equal(await page.locator('#pj_schadenereignis').evaluate(e=>e.closest('label').classList.contains('pflicht')),false,'Schadenereignis ist keine Pflicht');
 {const vorher=Number((await page.locator('#pflichtFehlt').innerText()).split(' ')[0]);await page.locator('#pj_sachverstaendiger').fill('Dr. Beispiel');
  assert.equal(await page.locator('#pj_sachverstaendiger').evaluate(e=>e.closest('label').classList.contains('pflicht-offen')),false,'ausgefüllt → normal');
  assert.equal(Number((await page.locator('#pflichtFehlt').innerText()).split(' ')[0]),vorher-1,'Zähler sofort aktualisiert');}
 // Schadendatum „nicht bekannt“: gilt als ausgefüllt, gespeichert als „unbekannt“; zurück auf Datum möglich
 {const vorher=Number((await page.locator('#pflichtFehlt').innerText()).split(' ')[0]);await page.locator('#pj_schadendatum_nb').click();
  assert.equal(await page.locator('#pj_schadendatum_nb').getAttribute('aria-pressed'),'true');assert.ok(await page.locator('#pj_schadendatum').isDisabled(),'Datumsfeld gesperrt');
  assert.equal(await page.locator('#pj_schadendatum').evaluate(e=>e.closest('label').classList.contains('pflicht-offen')),false,'nicht bekannt → erledigt');
  assert.equal(Number((await page.locator('#pflichtFehlt').innerText()).split(' ')[0]),vorher-1,'Zähler sofort aktualisiert');
  await page.locator('#pjSave.ok').waitFor();assert.equal(JSON.parse(await fs.readFile(path.join(tmp,A,'_Projekt.json'),'utf8')).schadendatum,'unbekannt');
  await page.locator('#pjBox > summary').click();await page.locator('#pjBox > summary').click();
  assert.equal(await page.locator('#pj_schadendatum_nb').getAttribute('aria-pressed'),'true','bleibt nach dem Neuzeichnen');
  await page.locator('#pj_schadendatum_nb').click();assert.ok(await page.locator('#pj_schadendatum').isEnabled());await page.locator('#pj_schadendatum').fill('2026-10-01');
  await page.waitForFunction(()=>document.querySelector('#pjSave')?.classList.contains('ok'));await page.waitForTimeout(900);
  assert.equal(JSON.parse(await fs.readFile(path.join(tmp,A,'_Projekt.json'),'utf8')).schadendatum,'2026-10-01');}
 await page.evaluate(()=>testIO.failWrite=true);await page.locator('#pj_objekt').fill('Nicht gespeicherter Entwurf');await page.locator('#pjSave.err').waitFor();await page.locator('#pjBox > summary').click();assert.match(await page.locator('#pjAttention').innerText(),/nicht gespeichert/);assert.ok(await page.locator('#showPJ').isVisible());
 await page.evaluate(()=>testIO.failWrite=false);await page.locator('#showPJ').click();await page.locator('#pj_objekt').fill(pj.objekt);await page.locator('#pjSave.ok').waitFor();
 // Ohne Gutachten beim Büro: frühere Versandangaben bearbeitbar; nichts wird ins Büro geschrieben
 await page.locator(`.proj[data-name="${B}"]`).click();await page.locator('#bueroPanel[data-projekt="26.9999 Kontrollort"] [data-ab-stand]').filter({hasText:'Noch nichts beim Büro'}).waitFor();
 await page.locator('#vtBox > summary').click();
 assert.ok(await page.locator('#vtBox .vtAn').first().isEnabled());await page.locator('#vtBox .vtAn').first().check();await page.waitForFunction(()=>document.querySelector('#vtBox .vtAn')?.checked);
 assert.ok(!await fs.stat(path.join(tmp,B,'_Buero')).catch(()=>null));
 assert.ok(!await page.locator('[data-ab-form]').evaluate(e=>e.open),'Formular zu: gerade sind die Prüfberichte dran');
 await page.locator('#goUebergabe').click();assert.ok(await page.locator('[data-ab-form]').evaluate(e=>e.open),'„Ans Büro übergeben“ in Stufe 5 öffnet das Formular');
 assert.equal(await page.locator('[data-ab-word]').inputValue(),'Mitteilungen/Gutachten B.docx');
 assert.deepEqual(await page.locator('[data-ab-an]').evaluateAll(es=>es.map(e=>e.checked)),[false,false,false,false],'nichts eingetragen → nichts angehakt');
 // Ohne „Ich bin …“ wird nichts geschrieben
 await page.evaluate(()=>localStorage.removeItem('spektron-ich'));
 await page.locator('[data-ab-hinweis]').fill('Bitte zuerst an die Versicherung.');await page.locator('[data-ab-faellig]').fill('2026-11-03');
 await page.locator('[data-ab-los]').click();await page.locator('#bueroPanel .ab-msg.err').filter({hasText:'„Ich bin …“'}).waitFor();
 assert.ok(!await fs.stat(path.join(tmp,B,'_Buero')).catch(()=>null));
 // Fehler des Datenmoduls stehen in der Karte, Eingaben bleiben
 await page.evaluate(()=>localStorage.setItem('spektron-ich','SK'));
 await page.locator('[data-ab-los]').click();await page.locator('#bueroPanel .ab-msg.err').filter({hasText:'Mindestens einen Empfänger'}).waitFor();
 assert.equal(await page.locator('[data-ab-hinweis]').inputValue(),'Bitte zuerst an die Versicherung.');assert.equal(await page.locator('[data-ab-faellig]').inputValue(),'2026-11-03');
 // Übergabe in einem Schritt: genau eine Datei in „_Buero/aufgaben“
 await page.locator('[data-ab-an="0"]').check();await page.locator('[data-ab-details="0"]').fill('Bestätigter Empfänger B');
 await page.locator('[data-ab-los]').click();await page.locator('#bueroPanel [data-ab-msg]').filter({hasText:'✓ Ans Büro übergeben – erscheint jetzt in BüroKit'}).waitFor();
 const aufgaben=await fs.readdir(path.join(tmp,B,'_Buero','aufgaben'));assert.equal(aufgaben.length,1);assert.deepEqual(await fs.readdir(path.join(tmp,B,'_Buero')),['aufgaben']);
 const auf=JSON.parse(await fs.readFile(path.join(tmp,B,'_Buero','aufgaben',aufgaben[0]),'utf8')),bId=auf.id;
 assert.equal(auf.format,'spektron-buerokit');assert.equal(auf.art,'gutachten');assert.equal(auf.von,'SK');assert.equal(auf.word,'Mitteilungen/Gutachten B.docx');assert.equal(auf.faellig,'2026-11-03');assert.equal(auf.hinweis,'Bitte zuerst an die Versicherung.');assert.equal(auf.projekt.name,B);
 assert.deepEqual(auf.empfaenger.map(({gruppe,label,details})=>({gruppe,label,details})),[{gruppe:'versicherung',label:'Auftraggeber',details:'Bestätigter Empfänger B'}]);
 await page.locator(`[data-ab-aufgabe="${bId}"]`).filter({hasText:/^Gutachten beim Büro · übergeben \d\d\.\d\d\. von SK · noch offen: Gegenlesen · PDF · Versand · Rechnung · fällig 03\.11\.$/}).waitFor();
 assert.ok(!await page.locator('[data-ab-form]').evaluate(e=>e.open),'nach der Übergabe zu');assert.equal(await page.locator('[data-ab-hinweis]').inputValue(),'','Formular frisch');
 assert.ok(await page.locator('#vtBox .vtAn').first().isDisabled(),'jetzt gilt der Versand in BüroKit');
 await page.waitForFunction(()=>/Gutachten übergeben \d\d\.\d\d\./.test(document.querySelector('[data-stufe=gutachten] [data-stext]').textContent),null,{timeout:10000});
 assert.ok(await page.locator('#goUebergabe').isHidden(),'Gutachten beim Büro: kein zweiter Übergabe-Knopf in der Stufe');
 // Das Büro arbeitet in BüroKit; nach Rückkehr ins Fenster steht der neue Stand da
 const buero=(f,...a)=>page.evaluate(async([f,a])=>{const p=await new SharedDirectoryHandle('').getDirectoryHandle('26.9999 Kontrollort');return BueroAufgaben[f](p,...a);},[f,a]);
 await buero('vermerken',{aufgabe:bId,schritt:'uebernommen',von:'Nad'});await buero('vermerken',{aufgabe:bId,schritt:'gegenlesen',von:'Nad'});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.locator(`[data-ab-aufgabe="${bId}"]`).filter({hasText:'noch offen: PDF · Versand · Rechnung · fällig 03.11. · in Arbeit bei Nad'}).waitFor();
 // Rückfrage beantworten: ein Vermerk „antwort“ mit Kürzel, danach ist sie weg
 await buero('vermerken',{aufgabe:bId,schritt:'frage',von:'Nad',text:'Welche Fassung soll raus?'});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#bueroAttention').filter({hasText:'Welche Fassung soll raus?'}).waitFor();
 assert.match(await page.locator(`[data-ab-aufgabe="${bId}"]`).innerText(),/Rückfrage offen/);
 await page.locator(`[data-ab-antwort="${bId}"]`).fill('Die neueste.');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(400);assert.equal(await page.locator(`[data-ab-antwort="${bId}"]`).inputValue(),'Die neueste.','Antwort-Entwurf bleibt beim Neulesen');
 await page.locator(`[data-ab-antworten="${bId}"]`).click();await page.waitForFunction(()=>!document.querySelector('#bueroAttention').textContent.includes('Welche Fassung'));
 const vermerke=[];for(const n of await fs.readdir(path.join(tmp,B,'_Buero','vermerke')))vermerke.push(JSON.parse(await fs.readFile(path.join(tmp,B,'_Buero','vermerke',n),'utf8')));
 const antwort=vermerke.filter(v=>v.schritt==='antwort');assert.equal(antwort.length,1);assert.equal(antwort[0].text,'Die neueste.');assert.equal(antwort[0].von,'SK');assert.equal(antwort[0].aufgabe,bId);
 // Ein zweites Gutachten nur nach Rückfrage
 await page.locator('[data-ab-summary]').click();await page.locator('[data-ab-an="0"]').check();await page.locator('[data-ab-details="0"]').fill('Ergänzungsempfänger B');
 page.once('dialog',d=>d.dismiss());await page.locator('[data-ab-los]').click();await page.waitForTimeout(500);
 assert.equal((await fs.readdir(path.join(tmp,B,'_Buero','aufgaben'))).length,1,'abgebrochen: nichts geschrieben');
 let frage='';page.once('dialog',d=>{frage=d.message();d.accept();});await page.locator('[data-ab-los]').click();await page.waitForFunction(()=>document.querySelectorAll('#bueroPanel [data-ab-aufgabe]').length===2);
 assert.equal(frage,'Es ist schon ein Gutachten beim Büro offen. Trotzdem ein weiteres übergeben?');
 const zweite=(await fs.readdir(path.join(tmp,B,'_Buero','aufgaben'))).map(n=>n.slice(0,-5)).find(n=>n!==bId);
 // Zurückgezogen: ausgeblendet · erledigt: klein „Gutachten erledigt am …“ · eigene Büroaufgabe als kurze Liste
 await buero('vermerken',{aufgabe:zweite,schritt:'geloescht',von:'Nad'});
 await buero('vermerken',{aufgabe:bId,schritt:'pdf',von:'Nad',pdf:'Mitteilungen/Gutachten B.pdf'});
 for(const r of auf.empfaenger)await buero('vermerken',{aufgabe:bId,schritt:'versand',von:'Nad',empfaenger:r.id,datum:'2026-10-27'});
 await buero('aufgabeAnlegen',{art:'eigene',titel:'Laborrechnung prüfen',von:'Nad',faellig:'2026-10-30'});
 // versandt: noch nicht fertig – Rechnung beim Büro (BüroKit 1.1); nach dem Haken „Rechnung“ erledigt und abgerechnet
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('[data-ab-rechnung]').waitFor();
 assert.equal(await page.locator('#bueroPanel [data-ab-aufgabe]').count(),0);
 assert.match(await page.locator('[data-ab-rechnung]').innerText(),/^Gutachten versandt \d\d\.\d\d\.\d{4} · Rechnung beim Büro noch offen/);
 await buero('vermerken',{aufgabe:bId,schritt:'rechnung',von:'Nad'});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('[data-ab-erledigt]').waitFor();
 assert.match(await page.locator('[data-ab-erledigt]').innerText(),/^Gutachten erledigt am \d\d\.\d\d\.\d{4} · abgerechnet \d\d\.\d\d\.\d{4} \(Nad\)$/);
 assert.equal(await page.locator('[data-ab-eigene]').innerText(),'Büro-Aufgaben: Laborrechnung prüfen (fällig 30.10.)');
 assert.ok(!await page.locator('[data-ab-form]').evaluate(e=>e.open),'versandt: Formular zu');assert.ok(await page.locator('#goUebergabe').isVisible(),'kein Gutachten mehr offen: Übergabe (Nachtrag) wieder möglich');
 assert.match(await stext('buero'),/^Versandt \d\d\.\d\d\.$/);
 // Durchlaufzeiten und Auslastung lesen denselben Stand
 assert.deepEqual(await page.evaluate(async()=>{const p=await new SharedDirectoryHandle('').getDirectoryHandle('26.9999 Kontrollort');return BueroAufgaben.alsDurchlauf((await BueroAufgaben.projektLesen(p)).aufgaben).map(r=>[r.status,r.withdrawn]);}),[['Erledigt',false],['Zurückgezogen',true]]);
 await page.locator('#bueroPanel').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'buero-erledigt.png')});
}
if(!before){
 const zc=await pw.chromium.launchPersistentContext(path.join(tmp,'.zoom-profile'),{executablePath:process.env.BROWSER_EXECUTABLE||pw.chromium.executablePath(),headless:true,viewport:null,args:['--no-sandbox','--window-size=1024,768']});
 contexts.push(zc);
 const settings=await zc.newPage();await settings.goto('chrome://settings/appearance');await settings.evaluate(()=>new Promise(resolve=>chrome.settingsPrivate.setDefaultZoom(1.5,resolve)));await settings.close();
 await context(zc);const z=zc.pages()[0];z.on('pageerror',e=>errors.push(e.message));await z.goto(base+'/index.html');await z.locator('#btnStart').click();await z.locator(`.proj[data-name="${A}"]`).click();await z.locator('#bueroAttention').filter({hasText:'Bitte Empfängeradresse ergänzen.'}).waitFor();
 await z.evaluate(()=>document.fonts.ready);assert.equal(await z.evaluate(()=>devicePixelRatio),1.5,'native browser zoom, not CSS scaling');assert.ok(await z.evaluate(()=>innerWidth<=700));
 assert.ok(await z.locator('#bueroAttention [data-ab-antworten]').isVisible());const alertBounds=await z.locator('#bueroAttention').boundingBox();assert.ok(alertBounds.y+alertBounds.height<=await z.evaluate(()=>innerHeight),'question is inside the visible zoomed viewport: '+JSON.stringify({alertBounds,height:await z.evaluate(()=>innerHeight)}));assert.ok(await z.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await z.locator('#detail').evaluate(e=>e.scrollTop=0);const cdp=await zc.newCDPSession(z);const screen=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});await fs.writeFile(path.join(out,'nachher-browserzoom-150.png'),Buffer.from(screen.data,'base64'));
}
assert.deepEqual(errors,[]);console.log('OK Projektansicht: '+(before?'Vorher-Screenshots':'Maus/Tastatur, fünf Fragmentlinks, Ans Büro: frühere Übergabe, vorbelegtes Formular (neueste Word-Datei, Empfänger), Entwurf bleibt beim Neuzeichnen und Projektwechsel, Übergabe = eine Aufgabendatei, Kürzel nötig, Fehler in der Karte, offene Schritte, Rückfrage oben beantworten, zweite Übergabe nur nach Rückfrage, zurückgezogen/erledigt/eigene Aufgaben, frühere Versandangaben, Speicherfehler, Desktop/klein/echter 150%-Browserzoom'));
}finally{for(const c of contexts)await c.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);if(process.env.GITHUB_ACTIONS)console.log('::error title=projektansicht-browser::'+String(e&&e.stack||e).slice(0,1500).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A'));process.exitCode=1;});
