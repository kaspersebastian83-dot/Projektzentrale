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
  const browser = await playwright[name].launch();
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
    window.showDirectoryPicker = async () => archiv;
  }, A);
  await page.locator('#btnStart, #btnArchive').first().click();
  await page.locator(`.proj[data-name="${A}"]`).click();
  if(!await page.locator('#pjBox').evaluate(d=>d.open))await page.locator('#pjBox > summary').click();   // öffnet sich selbst, solange Pflichtangaben fehlen
  await page.locator('#azBtn').waitFor();
  const ordnerVorher = await page.evaluate(async a => { const r = await navigator.storage.getDirectory(); const p = await (await r.getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(a); const n = []; for await (const [k] of p.entries()) n.push(k); return n.sort(); }, A);
  const lesePJ = () => page.evaluate(async a => { const r = await navigator.storage.getDirectory(); const p = await (await r.getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(a); return JSON.parse(await (await (await p.getFileHandle('_Projekt.json')).getFile()).text()); }, A);

  // 1) passender Zettel: neue Felder angehakt, vorhandenes „Objekt“ nicht
  await page.locator('#azFile').setInputFiles(path.join(__dirname, 'fixtures', 'arbeitszettel-voll.pdf'));
  await page.locator('#azOk').waitFor();
  assert.equal(await page.locator('#az_objekt').isChecked(), false, 'vorhandener Wert wird nicht ungefragt überschrieben');
  assert.match(await page.locator('tr[data-k=objekt] .st').textContent(), /überschreibt: Schon eingetragen/);
  for (const k of ['auftraggeber', 'schadennummer', 'versicherungsnehmer', 'sachverstaendigerBeteiligt', 'sanierung', 'kontakte', 'schadendatum', 'ortstermin', 'auftragsdatum', 'sachverstaendiger', 'arbeitsauftrag'])
    assert.equal(await page.locator('#az_' + k).isChecked(), true, k);
  assert.equal(await page.locator('.azwarn').count(), 0);
  assert.equal(await page.locator('#azOk').isEnabled(), true);
  await page.locator('#azOk').click();
  await page.locator('#banner.ok').waitFor();
  let pj = await lesePJ();
  assert.equal(pj.objekt, 'Schon eingetragen');
  assert.equal(pj.fremdesFeld, 'bleibt');
  assert.equal(pj.auftraggeber, 'Muster Versicherung AG, Versicherungsplatz 1, 99997 Beispielstadt');
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
  assert.deepEqual(errors.filter(e => !/kein Arbeitszettel|Invalid PDF|InvalidPDFException/i.test(e)), []);
  await browser.close(); server.close();
  console.log(`OK (${name}): Arbeitszettel einlesen, Rückfrage bei vorhandenen Werten, fremdes Projekt, kein Zettel, Verteiler`);
})().catch(e => {
  console.error(e, errors);
  const text = (String(e && e.stack || e) + '\nSeitenfehler: ' + errors.join(' | ')).slice(0, 1800).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
  console.log(`::error title=Browsertest Arbeitszettel ${name}::${text}`);
  process.exit(1);
});
