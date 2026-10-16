// Anlage PN 98 / Brandgeruch im echten Browser: node tests/anlage-browser.cjs [chromium|webkit]
// Der Archivordner wird im Origin Private File System nachgebildet; der Ordnerdialog liefert ihn zurück.
// WebKit kann keine Ordner beschreiben – dort wird nur geprüft, dass die Seite fehlerfrei lädt und den Hinweis zeigt.
process.env.TZ = 'Europe/Berlin';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');
const lade = require('./lade.cjs');
const { DOCX } = lade();

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..');
const daten = {
  version: '4.26.0', projekt: { nr: '26.0142' }, bgBlind: false, brandgeruchDatum: '2026-10-21',
  pn98Projekt: { schaden: '26.0142', schadendatum: '15.09.2026', pndatum: '21.10.2026', ort: 'Teststadt', grund: 'Brandschutt', probenehmer: 'Dr. S. Kasper', labor: 'Labor X' },
  pn98Proben: [{ probennr: 'P1', probenahmestelle: 'EG Küche', menge: '2,0' }],
  brandgeruchProben: [{ id: 1, z1: 'Wischprobe', z2: 'Küche', p1: '++', p2: '+', p3: '(+)', p4: '-', p5: '+' }],
};

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright[name].launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('#btnInfo');
  assert.equal(await page.locator('#btnInfo').textContent(), 'v1.4.1');

  const kann = await page.evaluate(async () => {
    if (!('showDirectoryPicker' in window) || !navigator.storage || !navigator.storage.getDirectory) return false;
    try{ const r = await navigator.storage.getDirectory(); const h = await r.getFileHandle('probe', { create: true }); if (!h.createWritable) return false; await r.removeEntry('probe'); return true; }catch(e){ return false; }
  });
  if (!kann){
    assert.ok(await page.locator('#support').isVisible() || name !== 'webkit', 'Hinweis „Chrome oder Edge verwenden“');
    assert.deepEqual(errors, []);
    await browser.close(); server.close();
    console.log(`OK (${name}, ohne Ordnerzugriff: nur Laden geprüft)`);
    return;
  }

  // Archiv mit einem Projekt und einer LabelKit-Projektdatei anlegen; Ordnerdialog gibt das Archiv zurück
  await page.evaluate(async d => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
    const proj = await archiv.getDirectoryHandle('26.0142 Teststadt', { create: true });
    const lab = await proj.getDirectoryHandle('Laboraufträge', { create: true });
    const schreibe = async (dir, n, txt) => { const w = await (await dir.getFileHandle(n, { create: true })).createWritable(); await w.write(txt); await w.close(); };
    await schreibe(lab, '26.0142_15.10.2026_Daten.json', JSON.stringify({ projekt: { nr: '26.0142' }, pn98Proben: [] }));
    await new Promise(res => setTimeout(res, 30));
    await schreibe(lab, '26.0142_16.10.2026_Daten.json', JSON.stringify(d, null, 2));
    window.showDirectoryPicker = async () => archiv;
  }, daten);
  await page.locator('#btnStart, #btnArchive').first().click();
  await page.locator('.proj[data-name="26.0142 Teststadt"]').click();
  await page.locator('#anlPn98').waitFor();
  const status = await page.locator('#anl').textContent();
  assert.match(status, /1 PN 98-Protokoll · 1 Brandgeruch-Probe/);
  assert.match(status, /26\.0142_16\.10\.2026_Daten\.json/, 'neueste Projektdatei');

  // Dialog: Bezeichnung, Dateiname, Erstellen
  await page.locator('#anlPn98').click();
  await page.locator('#aTitel').fill('Anlage 4');
  const heute = await page.evaluate(() => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; });
  assert.equal(await page.locator('#aName').textContent(), `26-0142_Anlage-4_PN98-Brandgeruch_${heute}.docx`);
  await page.locator('#aBrand').uncheck();
  assert.equal(await page.locator('#aName').textContent(), `26-0142_Anlage-4_PN98_${heute}.docx`);
  await page.locator('#aPn98').uncheck();
  assert.equal(await page.locator('#aYes').isDisabled(), true, 'nichts gewählt → nicht erstellbar');
  await page.locator('#aPn98').check(); await page.locator('#aBrand').check();
  await page.locator('#aYes').click();
  await page.locator('#banner.ok').waitFor();
  assert.match(await page.locator('#banner').textContent(), /Anlage-4_PN98-Brandgeruch.*Text aus Datei/);

  const lies = () => page.evaluate(async () => {
    const r = await navigator.storage.getDirectory();
    const proj = await (await r.getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle('26.0142 Teststadt');
    const m = await proj.getDirectoryHandle('Mitteilungen'), out = {};
    for await (const [n, h] of m.entries()) out[n] = Array.from(new Uint8Array(await (await h.getFile()).arrayBuffer()));
    const q = await (await (await proj.getDirectoryHandle('Laboraufträge')).getFileHandle('26.0142_16.10.2026_Daten.json')).getFile();
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await q.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
    return { out, sha };
  });
  let { out, sha } = await lies();
  const docxName = `26-0142_Anlage-4_PN98-Brandgeruch_${heute}.docx`;
  assert.deepEqual(Object.keys(out).sort(), [docxName, '_Anlagen-Protokoll.txt'].sort());
  const files = lade.unzip(Uint8Array.from(out[docxName]), DOCX.crc32);
  const doc = new TextDecoder().decode(files['word/document.xml']);
  assert.match(doc, /Anlage 4: Probenahmeprotokolle nach LAGA PN 98 und Sensorische Prüfung auf Brandgeruch/);
  assert.ok(doc.includes('SHA-256 der Projektdatei: ' + sha), 'Quellenvermerk mit Prüfsumme der neuesten Projektdatei');
  assert.match(doc, /Laboraufträge\/26\.0142_16\.10\.2026_Daten\.json/);
  const protokoll = new TextDecoder().decode(Uint8Array.from(out['_Anlagen-Protokoll.txt']));
  assert.match(protokoll, /^Anlagen-Protokoll/);
  const docxSha = await page.evaluate(async b => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(b))), x => x.toString(16).padStart(2, '0')).join(''), out[docxName]);
  assert.ok(protokoll.includes(`| ${docxName} | ${docxSha} | Laboraufträge/26.0142_16.10.2026_Daten.json | ${sha} | Projektzentrale 1.4.1`), 'Protokollzeile mit beiden Prüfsummen');

  // Zweites Mal: nichts überschrieben, neuer Name; Bezeichnung gemerkt
  await page.locator('#anlPn98').waitFor();
  assert.match(await page.locator('#anl').textContent(), /Bereits erstellt: .*Anlage-4_PN98-Brandgeruch/);
  await page.locator('#anlPn98').click();
  assert.equal(await page.locator('#aTitel').inputValue(), 'Anlage 4', 'Bezeichnung je Projekt gemerkt');
  assert.equal(await page.locator('#aName').textContent(), `26-0142_Anlage-4_PN98-Brandgeruch_${heute}_2.docx`);
  await page.locator('#aYes').click();
  await page.waitForFunction(() => /_2\.docx/.test(document.getElementById('banner').textContent));
  ({ out } = await lies());
  assert.equal(Object.keys(out).length, 3);
  assert.equal(new TextDecoder().decode(Uint8Array.from(out['_Anlagen-Protokoll.txt'])).trim().split(/\r?\n/).length, 3, 'Kopf + zwei Einträge');

  // Blind-Modus in LabelKit → Brandgeruch nicht wählbar, Hinweis
  await page.evaluate(async d => {
    const r = await navigator.storage.getDirectory();
    const lab = await (await (await r.getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle('26.0142 Teststadt')).getDirectoryHandle('Laboraufträge');
    const w = await (await lab.getFileHandle('26.0142_16.10.2026_Daten.json')).createWritable(); await w.write(JSON.stringify(Object.assign({}, d, { bgBlind: true }))); await w.close();
  }, daten);
  await page.locator('#btnRescan').click();
  await page.locator('.proj[data-name="26.0142 Teststadt"]').click();
  await page.waitForFunction(() => /Blind-Modus/.test(document.getElementById('anl')?.textContent || ''));
  await page.locator('#anlPn98').click();
  assert.equal(await page.locator('#aBrand').isDisabled(), true);
  assert.equal(await page.locator('#aBrand').isChecked(), false);
  await page.locator('#aNo').click();

  assert.deepEqual(errors, [], 'keine Fehler in der Konsole');
  await browser.close(); server.close();
  console.log(`OK (${name})`);
})().catch(e => {
  console.error(e);
  const text = String(e && e.stack || e).slice(0, 1500).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
  console.log(`::error title=Browsertest Anlage ${name}::${text}`);
  process.exit(1);
});
