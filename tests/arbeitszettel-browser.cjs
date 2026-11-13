// Arbeitszettel im echten Browser einlesen (pdf.js, Dialog, Speichern, Verteiler): node tests/arbeitszettel-browser.cjs [chromium|webkit]
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..');
const A = '26.0142 Teststadt';
const errors = [];
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYP[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright[name].launch(); const ohneOverride = browser.newContext.bind(browser); require('./spektron-start-test.cjs')(browser);
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('#btnInfo');

  // pdf.js liest den erfundenen Zettel im Browser – unabhängig vom Ordnerzugriff prüfbar
  const items = await page.evaluate(async () => {
    const buf = await (await fetch('tests/fixtures/arbeitszettel-voll.pdf')).arrayBuffer();
    const A = window.MosaikArbeitszettel; return A.azFelder(A.azLeser(await A.azTextstuecke(buf))).f;
  });
  assert.equal(items.objekt, 'Beispiel Wohnbau GmbH, Hauptstraße 12, 99999 Teststadt');
  assert.equal(items.sachverstaendiger, 'Dr. S. Kasper');

  const kann = await page.evaluate(async () => {
    if (!('showDirectoryPicker' in window) || !navigator.storage || !navigator.storage.getDirectory) return false;
    try{ const r = await navigator.storage.getDirectory(); const h = await r.getFileHandle('probe', { create: true }); if (!h.createWritable) return false; await r.removeEntry('probe'); return true; }catch(e){ return false; }
  });
  if (!kann){
    assert.deepEqual(errors, []);
    await browser.close(); server.close();
    console.log(`OK (${name}, ohne Ordnerzugriff: nur pdf.js und Lesen geprüft)`);
    return;
  }
  await page.evaluate(async a => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
    const p = await archiv.getDirectoryHandle(a, { create: true });
    const w = await (await p.getFileHandle('_Projekt.json', { create: true })).createWritable();
    await w.write(JSON.stringify({ format: 'mosaik-projekt', version: 1, objekt: 'Schon eingetragen', fremdesFeld: 'bleibt' })); await w.close();
    // 1.48: weitere erfundene Projekte mit Ordner „Arbeitszettel/AZ…/Revision …“ (Dateinamen bewusst beliebig)
    const pdf = async n => new Uint8Array(await (await fetch('tests/fixtures/' + n)).arrayBuffer());
    const leg = async (proj, rel, n) => { let d = await archiv.getDirectoryHandle(proj, { create: true }); const t = rel.split('/');
      for (const x of t.slice(0, -1)) d = await d.getDirectoryHandle(x, { create: true });
      const w = await (await d.getFileHandle(t.at(-1), { create: true })).createWritable(); await w.write(await pdf(n)); await w.close(); };
    // AUTO: höchste Revision als Zahl (Revision 010 vor Revision 9 – als Text wäre 9 die höchste, darin ein fremder Zettel)
    { const w = await (await (await archiv.getDirectoryHandle('26.0142 Auto Teststadt', { create: true })).getFileHandle('_Projekt.json', { create: true })).createWritable();
      await w.write(JSON.stringify({ format: 'mosaik-projekt', version: 1, nutzung: 'Wohnen', fremdesFeld: 'bleibt' })); await w.close(); }
    await leg('26.0142 Auto Teststadt', 'arbeitszettel/AZ2600556/Revision 9/AZ_alt.pdf', 'arbeitszettel-knapp.pdf');
    await leg('26.0142 Auto Teststadt', 'arbeitszettel/AZ2600556/Revision 010/Zettel 2600556.pdf', 'arbeitszettel-voll.pdf');
    await leg('26.0142 Revision Teststadt', 'Arbeitszettel/AZ2600557/Revision 001/AZ2600557.pdf', 'arbeitszettel-voll.pdf');
    await leg('26.0143 Andere Nummer', 'Arbeitszettel/AZ2600558/Revision 001/AZ.pdf', 'arbeitszettel-voll.pdf');
    await leg('26.0144 Zwei PDFs', 'Arbeitszettel/AZ2600559/Revision 001/AZ.pdf', 'arbeitszettel-voll.pdf');
    await leg('26.0144 Zwei PDFs', 'Arbeitszettel/AZ2600559/Revision 001/Anhang.pdf', 'arbeitszettel-knapp.pdf');
    // Notizen schon gefüllt: einmal ohne, einmal mit dem Arbeitsauftrag darin (Plan Punkt 3: Arbeitsauftrag wie bisher an die Notizen)
    for (const [proj, notizen] of [['26.0142 Notizen Teststadt', 'Schlüssel beim Hausmeister.'],
                                   ['26.0142 Notiz schon Teststadt', 'Schlüssel beim Hausmeister.\n\nArbeitsauftrag: Bitte Rußproben im EG nehmen.']]){
      const w = await (await (await archiv.getDirectoryHandle(proj, { create: true })).getFileHandle('_Projekt.json', { create: true })).createWritable();
      await w.write(JSON.stringify({ format: 'mosaik-projekt', version: 1, notizen })); await w.close();
      await leg(proj, 'Arbeitszettel/AZ2600562/Revision 001/AZ.pdf', 'arbeitszettel-voll.pdf');
    }
    // zweiter AZ-Ordner ohne Revision: trotzdem „mehrere Arbeitszettel“ (Codex-Review #82)
    await leg('26.0142 Zwei AZ Teststadt', 'Arbeitszettel/AZ2600560/Revision 001/AZ.pdf', 'arbeitszettel-voll.pdf');
    await (await (await (await archiv.getDirectoryHandle('26.0142 Zwei AZ Teststadt')).getDirectoryHandle('Arbeitszettel')).getDirectoryHandle('AZ2600561', { create: true }));
    window.showDirectoryPicker = async () => archiv;
  }, A);
  await page.locator('#btnStart, #btnArchive').first().click();
  await page.locator(`.proj[data-name="${A}"]`).click();
  if(!await page.locator('#pjBox').evaluate(d=>d.open))await page.locator('#pjBox > summary').click();   // öffnet sich selbst, solange Pflichtangaben fehlen
  await page.locator('#azBtn').waitFor();
  await page.waitForFunction(() => /Kein Arbeitszettel im Ordner „Arbeitszettel“ gefunden/.test(document.querySelector('#azMeldung')?.textContent || ''));
  assert.equal(await page.locator('#azMeldung [data-az=datei]').textContent(), 'Datei wählen …');
  assert.equal(await page.locator('#azBtn').textContent(), '📄 Andere Datei wählen …');
  const ordnerVorher = await page.evaluate(async a => { const r = await navigator.storage.getDirectory(); const p = await (await r.getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(a); const n = []; for await (const [k] of p.entries()) n.push(k); return n.sort(); }, A);
  const lesePJ = () => page.evaluate(async a => { const r = await navigator.storage.getDirectory(); const p = await (await r.getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(a); return JSON.parse(await (await (await p.getFileHandle('_Projekt.json')).getFile()).text()); }, A);

  // 1) passender Zettel: neue Felder angehakt, vorhandenes „Objekt“ nicht
  await page.locator('#azFile').setInputFiles(path.join(__dirname, 'fixtures', 'arbeitszettel-voll.pdf'));
  await page.locator('#azOk').waitFor();
  assert.equal(await page.locator('#az_objekt').isChecked(), false, 'vorhandener Wert wird nicht ungefragt überschrieben');
  assert.match(await page.locator('tr[data-k=objekt] .st').textContent(), /überschreibt: Schon eingetragen/);
  for (const k of ['auftraggeber', 'versicherer', 'schadennummer', 'versicherungsnehmer', 'sachverstaendigerBeteiligt', 'sanierung', 'kontakte', 'schadendatum', 'ortstermin', 'auftragsdatum', 'sachverstaendiger', 'arbeitsauftrag'])
    assert.equal(await page.locator('#az_' + k).isChecked(), true, k);
  assert.equal(await page.locator('.azwarn').count(), 0);
  assert.equal(await page.locator('#azOk').isEnabled(), true);
  await page.locator('#azOk').click();
  await page.locator('#banner.ok').waitFor();
  let pj = await lesePJ();
  assert.equal(pj.objekt, 'Schon eingetragen');
  assert.equal(pj.fremdesFeld, 'bleibt');
  assert.equal(pj.auftraggeber, 'Muster Versicherung AG, Versicherungsplatz 1, 99997 Beispielstadt');
  assert.equal(pj.versicherer, 'Muster Versicherung AG, Versicherungsplatz 1, 99997 Beispielstadt');
  assert.equal(await page.locator('#pj_versicherer').inputValue(), pj.versicherer);
  assert.equal(pj.ortstermin, '2026-10-15');
  assert.equal(pj.sachverstaendiger, 'Dr. S. Kasper');
  assert.equal(pj.notizen, 'Arbeitsauftrag: Bitte Rußproben im EG nehmen.');
  assert.equal(pj.arbeitszettel.datei, 'arbeitszettel-voll.pdf');
  assert.equal(pj.arbeitszettel.sha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'fixtures', 'arbeitszettel-voll.pdf'))).digest('hex'));
  assert.equal(await page.locator('#pj_sanierung').inputValue(), 'Trockenbau Test GmbH, Industriestraße 8, 99995 Werkstadt, 0999-55555-10');

  // 2) derselbe Zettel noch einmal: nichts Neues, Notizen nicht doppelt
  await page.locator('#azFile').setInputFiles(path.join(__dirname, 'fixtures', 'arbeitszettel-voll.pdf'));
  await page.locator('#azOk').waitFor();
  assert.equal(await page.locator('#az_auftraggeber').count(), 0, 'gleicher Wert: nichts anzuhaken');
  assert.equal(await page.locator('#az_versicherer').count(), 0, 'gleicher Wert: nichts anzuhaken');
  assert.equal(await page.locator('#az_arbeitsauftrag').count(), 0, 'Arbeitsauftrag schon in den Notizen');
  await page.locator('#azAbbr').click();

  // 3) Zettel eines anderen Projekts: Warnung, nichts angehakt, Übernehmen erst nach Bestätigung
  await page.locator('#azFile').setInputFiles(path.join(__dirname, 'fixtures', 'arbeitszettel-knapp.pdf'));
  await page.locator('.azwarn').waitFor();
  assert.match(await page.locator('.azwarn').textContent(), /26\.0999/);
  assert.equal(await page.locator('#azOk').isEnabled(), false);
  assert.equal(await page.locator('#az_ortstermin').isChecked(), false);
  assert.match(await page.locator('#dialog').textContent(), /Termin \(02\.09\.2026\) liegt vor dem Auftragsdatum/);
  await page.locator('#azTrotz').check();
  assert.equal(await page.locator('#azOk').isEnabled(), true);
  await page.locator('#azAbbr').click();
  assert.equal((await lesePJ()).ortstermin, '2026-10-15', 'abgebrochen: nichts geändert');

  // 4) kein Arbeitszettel → Meldung, nichts gespeichert
  const fremd = path.join(require('node:os').tmpdir(), 'kein-zettel.pdf');
  fs.writeFileSync(fremd, Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'));
  await page.locator('#azFile').setInputFiles(fremd);
  await page.locator('#banner.err').waitFor();
  assert.match(await page.locator('#banner').textContent(), /kein Arbeitszettel/);

  // 5) Verteiler: Empfänger anhaken, „heute“ als Versanddatum
  if (!await page.locator('#projektMehr').evaluate(d => d.open)) await page.locator('#projektMehr > summary').click();   // 1.42: unter „Mehr zum Projekt …“
  await page.locator('#vtBox > summary').click();
  assert.match(await page.locator('#vtBox tr[data-k=versicherung]').textContent(), /Muster Versicherung AG/);
  await page.locator('#vtBox tr[data-k=versicherung] .vtAn').check();
  await page.locator('#vtBox tr[data-k=versicherung] .vtHeute').waitFor();
  await page.locator('#vtBox tr[data-k=sanierung] .vtAn').check();
  await page.locator('#vtBox tr[data-k=sanierung] .vtAm').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#vtBox tr[data-k=sanierung] .vtAm') && !document.querySelector('#vtBox tr[data-k=sanierung] .vtAm').disabled);
  await page.locator('#vtBox tr[data-k=versicherung] .vtHeute').click();
  await page.waitForFunction(() => /2 Empfänger · 1 versandt/.test(document.querySelector('#vtBox > summary').textContent));
  pj = await lesePJ();
  const heute = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  assert.deepEqual(pj.verteiler.versicherung, { an: true, versandt: heute });
  assert.deepEqual(pj.verteiler.sanierung, { an: true });
  assert.equal(pj.fremdesFeld, 'bleibt');

  // Ausschließlich gemeinsame Projektdaten und ihr verifizierter F3-Sicherungsordner.
  const ordnerNachher = await page.evaluate(async a => { const r = await navigator.storage.getDirectory(); const p = await (await r.getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(a); const n = []; for await (const [k] of p.entries()) n.push(k); return n.sort(); }, A);
  assert.deepEqual(ordnerNachher, [...new Set([...ordnerVorher,'_Projekt_Sicherungen'])].sort());
  const sicherungen=await page.evaluate(async a=>{
    const p=await(await(await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(a);
    const d=await p.getDirectoryHandle('_Projekt_Sicherungen'),out=[];
    for await(const[n,h]of d.entries())out.push({name:n,data:JSON.parse(await(await h.getFile()).text())});return out;
  },A);
  assert.ok(sicherungen.some(x=>x.name.startsWith('vorher_')&&x.data.objekt==='Schon eingetragen'));
  assert.ok(sicherungen.some(x=>x.name.startsWith('kandidat_')&&x.data.arbeitszettel?.datei==='arbeitszettel-voll.pdf'));
  // ---------- 1.48: Arbeitszettel aus dem Projektordner, automatisch beim ersten Öffnen ----------
  const meldung = () => page.locator('#azMeldung').textContent();
  const warteMeldung = re => page.waitForFunction(r => new RegExp(r).test(document.querySelector('#azMeldung')?.textContent || ''), re.source);
  const oeffne = async n => {   // wie ein Klick in der Liste; wartet, bis die Prüfung des Ordners „Arbeitszettel“ fertig ist
    const vorher = await page.evaluate(n => MosaikArbeitszettel.pruefungen(n), n);
    await page.locator(`.proj[data-name="${n}"]`).click();
    await page.waitForFunction(([n, v]) => MosaikArbeitszettel.pruefungen(n) > v, [n, vorher]);
  };
  const leseIn = n => page.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    try{ return JSON.parse(await (await (await p.getFileHandle('_Projekt.json')).getFile()).text()); }catch(e){ return null; } }, n);
  const inhalt = n => page.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    const r = []; for await (const [k] of p.entries()) r.push(k); return r.sort(); }, n);
  const hash = n => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'fixtures', n))).digest('hex');
  const FELDER13 = /übernommen: 13 Felder/;

  // 6) automatisch: höchste Revision als Zahl (010, nicht „9“ mit fremdem Zettel), nur leere Felder, Meldung über „Jetzt dran“
  const AUTO = '26.0142 Auto Teststadt';
  await oeffne(AUTO);
  await warteMeldung(FELDER13);
  assert.match(await meldung(), /Arbeitszettel Revision 010 übernommen: 13 Felder · Arbeitsauftrag in die Notizen eingetragen/);
  assert.ok(await page.evaluate(() => !!(document.querySelector('#azMeldung').compareDocumentPosition(document.querySelector('#jetzt')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Meldung steht über „Jetzt dran“');
  pj = await leseIn(AUTO);
  assert.equal(pj.objekt, 'Beispiel Wohnbau GmbH, Hauptstraße 12, 99999 Teststadt');
  assert.equal(pj.ortstermin, '2026-10-15');
  assert.equal(pj.notizen, 'Arbeitsauftrag: Bitte Rußproben im EG nehmen.');
  assert.equal(pj.nutzung, 'Wohnen'); assert.equal(pj.fremdesFeld, 'bleibt');
  assert.deepEqual({ ...pj.arbeitszettel, eingelesen: '' }, { datei: 'Zettel 2600556.pdf', sha256: hash('arbeitszettel-voll.pdf'), titel: pj.arbeitszettel.titel, eingelesen: '', automatisch: true,
    pfad: 'arbeitszettel/AZ2600556/Revision 010/Zettel 2600556.pdf', revision: 10 });
  assert.equal(await page.locator('#pj_ortstermin').inputValue(), '2026-10-15', 'Formular zeigt den neuen Stand');
  // Ansehen: die übernommenen Werte; Rückgängig aus dem Dialog → Stand vorher aus „_Projekt_Sicherungen“, Vermerk abgelehnt
  await page.locator('#azMeldung [data-az=ansehen]').click();
  await page.locator('#azAnsOk').waitFor();
  assert.equal(await page.locator('#dialog tr[data-k]').count(), 13);
  assert.match(await page.locator('#dialog').textContent(), /Dr\. S\. Kasper/);
  await page.locator('#azAnsZurueck').click();
  await warteMeldung(/zurückgenommen/);
  assert.match(await meldung(), /Revision 010 zurückgenommen: Stand vorher aus „_Projekt_Sicherungen“ wiederhergestellt\. Er wird nicht wieder automatisch übernommen\./);
  pj = await leseIn(AUTO);
  for (const k of ['objekt', 'auftraggeber', 'versicherer', 'schadennummer', 'ortstermin', 'sachverstaendiger', 'kontakte', 'notizen']) assert.equal(pj[k], undefined, k);
  assert.equal(pj.nutzung, 'Wohnen'); assert.equal(pj.fremdesFeld, 'bleibt');
  assert.equal(pj.arbeitszettel.abgelehnt, true); assert.equal(pj.arbeitszettel.revision, 10);
  assert.equal(await page.locator('#pj_objekt').inputValue(), '');
  // erneut öffnen: nicht wieder übernommen; die Meldung „zurückgenommen“ bleibt bis × (wie jede Meldung), danach keine neue
  await oeffne(A); await oeffne(AUTO);
  assert.match(await meldung(), /zurückgenommen/);
  await page.locator('#azMeldung [data-az=zu]').click();
  await oeffne(A); await oeffne(AUTO);
  assert.equal(await meldung(), '');
  assert.equal((await leseIn(AUTO)).objekt, undefined, 'nach Rückgängig nicht wieder übernommen');
  assert.match(await page.locator('.azrow .m').textContent(), /Zurückgenommen: Zettel 2600556\.pdf \(Revision 010\)/);

  // 7) neue Revision: nie automatisch – „Neuer Arbeitszettel (Revision 002)“, Dialog nur mit geänderten Feldern
  const REV = '26.0142 Revision Teststadt';
  await oeffne(REV);
  await warteMeldung(FELDER13);
  assert.match(await meldung(), /Revision 001 übernommen/);
  await page.locator('#azMeldung [data-az=zu]').click();
  assert.equal(await meldung(), '', '× schließt die Meldung');
  await page.evaluate(async n => {
    const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    const r = await (await (await p.getDirectoryHandle('Arbeitszettel')).getDirectoryHandle('AZ2600557')).getDirectoryHandle('Revision 002', { create: true });
    const w = await (await r.getFileHandle('AZ2600557_neu.pdf', { create: true })).createWritable();
    await w.write(new Uint8Array(await (await fetch('tests/fixtures/arbeitszettel-voll-rev2.pdf')).arrayBuffer())); await w.close();
  }, REV);
  await oeffne(A); await oeffne(REV);
  await warteMeldung(/Neuer Arbeitszettel \(Revision 002\)/);
  pj = await leseIn(REV);
  assert.equal(pj.ortstermin, '2026-10-15', 'nicht automatisch überschrieben'); assert.equal(pj.arbeitszettel.revision, 1);
  await page.locator('#azMeldung [data-az=aenderungen]').click();
  await page.locator('#azOk').waitFor();
  assert.match(await page.locator('#dialog h3').textContent(), /Neuer Arbeitszettel \(Revision 002\) – Änderungen/);
  assert.deepEqual(await page.locator('#dialog tr[data-k]').evaluateAll(t => t.map(x => x.dataset.k).sort()), ['ortstermin', 'schadennummer']);
  assert.equal(await page.locator('#az_ortstermin').isChecked(), false, 'vorhandener Wert nur angehakt überschrieben');
  assert.match(await page.locator('tr[data-k=ortstermin] .st').textContent(), /überschreibt: 15\.10\.2026/);
  await page.locator('#az_ortstermin').check(); await page.locator('#az_schadennummer').check();
  await page.locator('#azOk').click();
  await page.locator('#banner.ok').waitFor();
  pj = await leseIn(REV);
  assert.equal(pj.ortstermin, '2026-10-16'); assert.equal(pj.schadennummer, 'XY2026-0001236');
  assert.equal(pj.arbeitszettel.revision, 2); assert.equal(pj.arbeitszettel.automatisch, false);
  assert.equal(pj.arbeitszettel.pfad, 'Arbeitszettel/AZ2600557/Revision 002/AZ2600557_neu.pdf'); assert.equal(pj.arbeitszettel.sha256, hash('arbeitszettel-voll-rev2.pdf'));
  assert.equal(await meldung(), '');
  await oeffne(A); await oeffne(REV);
  assert.equal(await meldung(), '', 'gelesene Revision: keine Meldung');
  // noch eine Revision, aber nicht eindeutig (zwei PDFs): nicht still – Grund und „Datei wählen …“ (Codex-Review #82)
  await page.evaluate(async n => {
    const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    const r = await (await (await p.getDirectoryHandle('Arbeitszettel')).getDirectoryHandle('AZ2600557')).getDirectoryHandle('Revision 003', { create: true });
    for (const [name, quelle] of [['AZ.pdf', 'arbeitszettel-voll.pdf'], ['Anhang.pdf', 'arbeitszettel-knapp.pdf']]){
      const w = await (await r.getFileHandle(name, { create: true })).createWritable();
      await w.write(new Uint8Array(await (await fetch('tests/fixtures/' + quelle)).arrayBuffer())); await w.close();
    }
  }, REV);
  await oeffne(A); await oeffne(REV);
  assert.match(await meldung(), /Neuer Arbeitszettel \(Revision 003\) – In „Revision 003“ liegen 2 PDFs/);
  assert.equal(await page.locator('#azMeldung [data-az=datei]').textContent(), 'Datei wählen …');
  assert.equal((await leseIn(REV)).arbeitszettel.revision, 2, 'nichts übernommen');

  // 8) andere Projektnummer auf dem Zettel: nicht automatisch, nichts geschrieben; „prüfen und übernehmen“ = bisheriger Dialog
  const NR = '26.0143 Andere Nummer';
  await oeffne(NR);
  await warteMeldung(/nicht automatisch übernommen/);
  assert.match(await meldung(), /Arbeitszettel Revision 001 nicht automatisch übernommen: Der Zettel gehört zu Projekt 26\.0142, dieser Ordner ist 26\.0143\./);
  assert.deepEqual(await inhalt(NR), ['Arbeitszettel'], 'nichts geschrieben');
  await page.locator('#azMeldung [data-az=pruefen]').click();
  await page.locator('.azwarn').waitFor();
  assert.match(await page.locator('#dialog').textContent(), /Arbeitszettel\/AZ2600558\/Revision 001\/AZ\.pdf/);
  await page.locator('#azAbbr').click();
  assert.deepEqual(await inhalt(NR), ['Arbeitszettel']);

  // 9) mehrere PDFs in der Revision: nicht automatisch, „Datei wählen …“
  const ZWEI = '26.0144 Zwei PDFs';
  await oeffne(ZWEI);
  await warteMeldung(/nicht automatisch übernommen/);
  assert.match(await meldung(), /In „Revision 001“ liegen 2 PDFs/);
  assert.equal(await page.locator('#azMeldung [data-az=datei]').textContent(), 'Datei wählen …');
  assert.deepEqual(await inhalt(ZWEI), ['Arbeitszettel']);

  // 9a) Notizen und Arbeitsauftrag (Plan Punkt 3) – (1) steht er schon in den Notizen, wird nichts angehängt
  const SCHON = '26.0142 Notiz schon Teststadt';
  await oeffne(SCHON);
  await warteMeldung(/übernommen: 12 Felder/);
  assert.doesNotMatch(await meldung(), /Arbeitsauftrag/, 'kein Hinweis aufs Anhängen, wenn nichts angehängt wurde');
  assert.equal((await leseIn(SCHON)).notizen, 'Schlüssel beim Hausmeister.\n\nArbeitsauftrag: Bitte Rußproben im EG nehmen.', 'nicht doppelt angehängt');
  await page.locator('#azMeldung [data-az=zurueck]').click();
  await warteMeldung(/zurückgenommen/);
  pj = await leseIn(SCHON);
  assert.equal(pj.notizen, 'Schlüssel beim Hausmeister.\n\nArbeitsauftrag: Bitte Rußproben im EG nehmen.', 'Rückgängig lässt nicht übernommene Notizen stehen');
  assert.equal(pj.objekt, undefined);
  // (2) Notizen mit anderem Text: angehängt, und die Meldung sagt es · (3) danach von Hand geändert → Rückgängig lässt die Notizen stehen und nennt sie
  const NOTIZ = '26.0142 Notizen Teststadt';
  await oeffne(NOTIZ);
  await warteMeldung(FELDER13);
  assert.match(await meldung(), /Arbeitszettel Revision 001 übernommen: 13 Felder · Arbeitsauftrag an die Notizen angehängt/);
  assert.equal((await leseIn(NOTIZ)).notizen, 'Schlüssel beim Hausmeister.\n\nArbeitsauftrag: Bitte Rußproben im EG nehmen.');
  if (!await page.locator('#pjBox').evaluate(d => d.open)) await page.locator('#pjBox > summary').click();
  await page.locator('#pj_notizen').fill('Schlüssel beim Hausmeister.\n\nArbeitsauftrag: Bitte Rußproben im EG nehmen.\nTermin bestätigt.');
  await page.locator('#pjSave.ok').waitFor();
  await page.locator('#azMeldung [data-az=zurueck]').click();
  await warteMeldung(/zurückgenommen/);
  assert.match(await meldung(), /inzwischen geändert und deshalb behalten: Notizen\./);
  pj = await leseIn(NOTIZ);
  assert.equal(pj.notizen, 'Schlüssel beim Hausmeister.\n\nArbeitsauftrag: Bitte Rußproben im EG nehmen.\nTermin bestätigt.', 'von Hand geänderte Notizen bleiben');
  for (const k of ['objekt', 'ortstermin', 'sachverstaendiger']) assert.equal(pj[k], undefined, k + ' zurückgenommen');
  assert.equal(pj.arbeitszettel.abgelehnt, true);
  assert.equal(await page.locator('#pj_notizen').inputValue(), pj.notizen);

  // 9b) zweiter AZ-Ordner ohne Revision zählt mit: nicht automatisch
  const ZWEIAZ = '26.0142 Zwei AZ Teststadt';
  await oeffne(ZWEIAZ);
  assert.match(await meldung(), /nicht automatisch übernommen: Im Ordner „Arbeitszettel“ liegen mehrere Arbeitszettel \(AZ2600560, AZ2600561\)/);
  assert.deepEqual(await inhalt(ZWEIAZ), ['Arbeitszettel'], 'nichts geschrieben');

  // 10) ein zweites Fenster hält das Projekt: nie still – „Lese Arbeitszettel …“ sofort, nach höchstens 20 s klare Meldung, Eingaben bleiben
  await oeffne(A);
  if (!await page.locator('#pjBox').evaluate(d => d.open)) await page.locator('#pjBox > summary').click();
  const zweite = await page.context().newPage();
  // Das zweite Fenster braucht nur die Sperre (Web Locks gelten je Herkunft) – eine leere Seite derselben Adresse genügt.
  // (Eine zweite volle Projektzentrale auf demselben OPFS-Archiv brachte im Test den ganzen Headless-Browser-Prozess zum Absturz.)
  await zweite.goto(url.replace('index.html', 'leer'));
  await zweite.evaluate(n => { navigator.locks.request('mosaik:projekt:' + n, () => new Promise(r => { window.freigeben = r; })); }, A);
  await zweite.waitForFunction(() => typeof window.freigeben === 'function');
  await page.locator('#pj_objekt').fill('Neu getippt');
  const t0 = Date.now();
  await page.locator('#azFile').setInputFiles(path.join(__dirname, 'fixtures', 'arbeitszettel-voll.pdf'));
  await page.waitForFunction(() => /Lese Arbeitszettel/.test(document.querySelector('#banner').textContent), null, { timeout: 3000 });
  await page.waitForFunction(() => /in einem anderen Projektzentrale-Fenster belegt/.test(document.querySelector('#banner.err')?.textContent || ''), null, { timeout: 25000 });
  const dauer = Date.now() - t0;
  assert.ok(dauer < 24000, 'Meldung nach höchstens ~20 s, war ' + dauer + ' ms');
  assert.match(await page.locator('#banner').textContent(), /Arbeitszettel nicht eingelesen – Projektdaten nicht gespeichert: Das Projekt ist gerade in einem anderen Projektzentrale-Fenster belegt – bitte das andere Fenster schließen und erneut versuchen\./);
  assert.equal(await page.locator('#pj_objekt').inputValue(), 'Neu getippt', 'Eingabe bleibt stehen');
  assert.match(await page.locator('#pjSave').textContent(), /belegt/);
  assert.equal(await page.locator('#azOk').count(), 0, 'kein Dialog ohne gespeicherte Eingaben');
  assert.equal((await leseIn(A)).objekt, 'Schon eingetragen', 'nichts geschrieben');
  await zweite.evaluate(() => window.freigeben()); await zweite.close();
  await page.locator('#pj_objekt').fill('Neu getippt!');   // nächster Versuch speichert, auch die vorher liegen gebliebene Eingabe
  await page.locator('#pjSave.ok').waitFor();
  assert.equal((await leseIn(A)).objekt, 'Neu getippt!');

  // 11) Projekt vor dem Spektron-Start (26.0367) ohne SPEKTRON_START-Override: nichts automatisch, nichts in den alten Ordner, Dialog geht
  const alt = await (await ohneOverride({ viewport: { width: 1400, height: 1000 } })).newPage();
  alt.on('pageerror', e => errors.push(e.message));
  await alt.goto(url); await alt.waitForSelector('#btnInfo');
  await alt.evaluate(async () => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
    let d = await (await archiv.getDirectoryHandle('26.0367 Altbau Teststadt', { create: true })).getDirectoryHandle('Arbeitszettel', { create: true });
    d = await (await d.getDirectoryHandle('AZ2600367', { create: true })).getDirectoryHandle('Revision 001', { create: true });
    const w = await (await d.getFileHandle('AZ2600367.pdf', { create: true })).createWritable();
    await w.write(new Uint8Array(await (await fetch('tests/fixtures/arbeitszettel-voll.pdf')).arrayBuffer())); await w.close();
    await archiv.getDirectoryHandle('26.0600 Neubau Teststadt', { create: true });
    window.showDirectoryPicker = async () => archiv;
  });
  await alt.locator('#btnStart, #btnArchive').first().click();
  await alt.locator('#vorToggle').click();
  await alt.locator('.proj[data-name="26.0367 Altbau Teststadt"]').click();
  await alt.waitForFunction(() => MosaikArbeitszettel.pruefungen('26.0367 Altbau Teststadt') > 0 && /nicht automatisch übernommen/.test(document.querySelector('#azMeldung')?.textContent || ''));
  assert.match(await alt.locator('#azMeldung').textContent(), /Revision 001 nicht automatisch übernommen: Projekt aus der Zeit vor Spektron/);
  const altInhalt = () => alt.evaluate(async () => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle('26.0367 Altbau Teststadt'); const r = []; for await (const [k] of p.entries()) r.push(k); return r.sort(); });
  assert.deepEqual(await altInhalt(), ['Arbeitszettel'], 'nichts in den alten Ordner geschrieben');
  await alt.locator('#azMeldung [data-az=pruefen]').click();
  await alt.locator('#azAbbr').waitFor();   // Dialog öffnet (früher: still nichts)
  assert.match(await alt.locator('.azwarn').textContent(), /26\.0142.*26\.0367/s);
  await alt.locator('#azAbbr').click();
  assert.deepEqual(await altInhalt(), ['Arbeitszettel']);
  assert.deepEqual(errors.filter(e => !/kein Arbeitszettel|Invalid PDF|InvalidPDFException/i.test(e)), []);
  await browser.close(); server.close();
  console.log(`OK (${name}): Arbeitszettel einlesen, Rückfrage bei vorhandenen Werten, fremdes Projekt, kein Zettel, Verteiler · 1.48: automatisch beim ersten Öffnen (höchste Revision), Ansehen, Rückgängig, nicht wieder nach Rückgängig, Revision 002 nur geänderte Felder, andere Nummer, mehrere PDFs, zweites Fenster hält die Sperre (Meldung nach 20 s), Vor Spektron ohne Override`);
})().catch(e => {
  console.error(e, errors);
  const text = (String(e && e.stack || e) + '\nSeitenfehler: ' + errors.join(' | ')).slice(0, 1800).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
  console.log(`::error title=Browsertest Arbeitszettel ${name}::${text}`);
  process.exit(1);
});
