// Anlage PN 98 / Brandgeruch im echten Browser: node tests/anlage-browser.cjs [chromium|webkit]
// Der Archivordner wird im Origin Private File System nachgebildet; der Ordnerdialog liefert ihn zurück.
// WebKit kann keine Ordner beschreiben – dort wird nur geprüft, dass die Seite fehlerfrei lädt und den Hinweis zeigt.
process.env.TZ = 'Europe/Berlin';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');
const VERSION = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8').match(/APP_VERSION = '([\d.]+)'/)[1];
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
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); res.end(fs.readFileSync(f));
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
  assert.equal(await page.locator('#btnInfo').textContent(), 'v' + VERSION);

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
    // PlanKit: ein Probenplan und zwei „(vorher …)“-Sicherungen vom Speichern
    const pl = await proj.getDirectoryHandle('Pläne', { create: true });
    for (const n of ['Probenplan 26.0142 Teststadt.probenplan', 'Probenplan 26.0142 Teststadt (vorher 2026-10-16T19-37-16-853Z-95805c53).probenplan', 'Probenplan 26.0142 Teststadt (vorher 2026-10-16T19-37-48-520Z-024f648d).probenplan']) await schreibe(pl, n, '{}');
    const extraName = '26.0142 Köln & Süd + 50% #Hof';
    const extra = await archiv.getDirectoryHandle(extraName, {create:true}), extraPlan = await extra.getDirectoryHandle('Pläne', {create:true});
    await schreibe(extraPlan, 'Probenplan ' + extraName + '.probenplan', '{}');
    window.showDirectoryPicker = async () => archiv;
  }, daten);
  await page.locator('#btnStart, #btnArchive').first().click();
  await page.locator('.proj[data-name="26.0142 Teststadt"]').click();
  await page.locator('#anlPn98').waitFor();
  // Sicherungskopien von PlanKit zählen nicht als eigene Pläne
  assert.match(await page.locator('#detail').textContent(), /3 Dateien · Probenplan · 2 Sicherungskopien von PlanKit/);
  assert.match(await page.locator('#goPlan .stat').textContent(), /Probenplan vorhanden/);
  // Projektdaten: Neuzeichnen der Ansicht, bevor die Eingabe gespeichert ist (hier: fehlende Unterordner anlegen), behält die Eingabe
  // Projektansicht 1.7: Arbeitsschritte als Karten in der Reihenfolge der Arbeit; Projektdaten zugeklappt (leer: einladend hervorgehoben)
  assert.deepEqual(await page.locator('.steps .step').evaluateAll(b => b.map(x => x.id)), ['goLabel', 'goFotos', 'goPlan', 'goAufwand']);
  // SpesenKit: eigene Zeile „Weitere Apps“ ganz unten im rechten Fenster – kein Schritt, kein Projektbezug
  { const l = page.locator('#detail .pz > .more:last-child a#goReise');
    assert.equal(await l.count(), 1, 'Knopf ganz unten im rechten Fenster');
    assert.equal(await l.getAttribute('href'), '../reisekosten-pro/', 'ohne ?projekt= – die App gehört zu keinem Projekt');
    assert.equal(await l.getAttribute('target'), 'reisekosten');
    assert.match(await l.textContent(), /SpesenKit[\s\S]*Spesenabrechnung für den Monat/);
    assert.equal(await page.locator('.steps #goReise').count(), 0, 'nicht Teil der nummerierten Arbeitsschritte'); }
  assert.equal(await page.locator('.steps .sw.next,.steps .sw.done').count(), 0, 'Dateibestand erzeugt keine Erledigt- oder Pflichtschrittanzeige');
  assert.equal(await page.locator('#pjBox').evaluate(d => d.open), true, 'Projektdaten offen, solange Pflichtangaben fehlen');
  assert.ok(await page.locator('#pjBox.leer').count(), 'leere Projektdaten hervorgehoben');
  assert.equal(await page.locator('#pflichtFehlt').innerText(), '7 Pflichtangaben fehlen');
  await page.locator('#pj_objekt').fill('EFH, Testweg 1');
  await page.locator('#mkSubs').click(); await page.locator('#dYes').click();
  await page.waitForFunction(() => !document.getElementById('mkSubs'));
  assert.equal(await page.locator('#pj_objekt').inputValue(), 'EFH, Testweg 1', 'Eingabe bleibt beim Neuzeichnen');
  await page.locator('#pjSave.ok').waitFor();
  const projektJson = await page.evaluate(async () => {
    const proj = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle('26.0142 Teststadt');
    return JSON.parse(await (await (await proj.getFileHandle('_Projekt.json')).getFile()).text());
  });
  assert.equal(projektJson.objekt, 'EFH, Testweg 1', 'Eingabe in _Projekt.json gespeichert');
  assert.equal(projektJson.hinweis, 'Gemeinsame Projektdaten (Projektzentrale, FotoKit, PlanKit, LabelKit). Bitte nicht löschen oder umbenennen.', 'einheitlicher Hinweistext');
  // Speichern unter Sperre je Projekt (FotoKit nimmt dieselbe): solange ein anderer Tab die Sperre hält, wird nichts geschrieben
  const leseAuftraggeber = () => page.evaluate(async () => {
    const proj = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle('26.0142 Teststadt');
    return JSON.parse(await (await (await proj.getFileHandle('_Projekt.json')).getFile()).text()).auftraggeber || '';
  });
  await page.evaluate(() => new Promise(frei => { window.__freigeben = null; navigator.locks.request('mosaik:projekt:26.0142 Teststadt', () => new Promise(r => { window.__freigeben = r; frei(); })); }));
  await page.locator('#pj_auftraggeber').fill('Muster Versicherung');
  await page.waitForTimeout(1500);
  assert.equal(await leseAuftraggeber(), '', 'unter fremder Sperre wird nicht geschrieben');
  assert.equal(await page.locator('#pjSave.ok').count(), 0);
  await page.evaluate(() => window.__freigeben());
  await page.locator('#pjSave.ok').waitFor();
  assert.equal(await leseAuftraggeber(), 'Muster Versicherung', 'nach Freigabe der Sperre gespeichert');
  // Anlage Probenahme: Absprung nach PlanKit mit geöffnetem Anlagen-Export
  await page.evaluate(() => { window.__geoeffnet = []; window.open = () => ({ location: { href: 'about:blank', assign: u => window.__geoeffnet.push(u) }, focus(){} }); });
  await page.locator('#anlPlan').click();
  await page.waitForFunction(() => window.__geoeffnet.length === 1);
  const anlageLink = new URL(await page.evaluate(() => window.__geoeffnet[0]));
  assert.equal(anlageLink.search, '');
  assert.equal(new URLSearchParams(anlageLink.hash.slice(1)).get('projekt'), '26.0142 Teststadt');
  assert.equal(new URLSearchParams(anlageLink.hash.slice(1)).get('aktion'), 'anlage');
  // Alle vier echten Absprungknöpfe: Ziele bleiben erhalten, Projekt nur im Fragment.
  for (const [id, app, target] of [['goLabel','labelkit','labelkit'],['goFotos','Bildumbenenner','bildumbenenner'],['goPlan','Probenplan','plankit'],['goAufwand','aufwandkit','aufwandkit']]){
    await page.evaluate(() => { window.__sprung = null; window.open = (_, target) => ({ location: { href: 'about:blank', assign: url => { window.__sprung = {url, target}; } }, focus(){} }); });
    await page.locator('#' + id).click();
    await page.waitForFunction(() => window.__sprung !== null);
    const sprung = await page.evaluate(() => window.__sprung), link = new URL(sprung.url);
    assert.equal(sprung.target, target); assert.ok(link.pathname.endsWith('/' + app + '/'));
    assert.equal(link.search, ''); assert.equal(new URLSearchParams(link.hash.slice(1)).get('projekt'), '26.0142 Teststadt');
  }
  const special = '26.0142 Köln & Süd + 50% #Hof';
  await page.locator('.proj').filter({hasText:special}).click();
  await page.locator('#anlPlan').waitFor();
  for (const id of ['goLabel','goFotos','goPlan','goAufwand','anlPlan']){
    await page.evaluate(() => {
      window.__sprung = null;
      window.open = (_, target) => ({location:{href:target === 'plankit' ? new URL('../Probenplan/#projekt=alt',location.href).href : 'about:blank',assign:url=>{window.__sprung={url,target};}},focus(){}});
    });
    await page.locator('#' + id).click(); await page.waitForFunction(() => window.__sprung !== null);
    const sprung = await page.evaluate(() => window.__sprung), link = new URL(sprung.url);
    assert.equal(link.search, '');
    assert.equal(new URLSearchParams(link.hash.slice(1)).get('projekt'), special);
    if (id === 'anlPlan') assert.equal(new URLSearchParams(link.hash.slice(1)).get('aktion'), 'anlage');
    if (sprung.target === 'plankit') assert.ok(link.pathname.endsWith('/Probenplan/index.html'), 'Bereits offenes PlanKit lädt neu');
  }
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
  assert.ok(protokoll.includes(`| ${docxName} | ${docxSha} | Laboraufträge/26.0142_16.10.2026_Daten.json | ${sha} | Projektzentrale ${VERSION}`), 'Protokollzeile mit beiden Prüfsummen');

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

  // PN 98-Feldbogen mit Scans (LabelKit 4.27): Prüfsumme nachgeprüft, stimmiger JPEG-Scan eingebettet, veränderter nicht
  await page.evaluate(async d => {
    const r = await navigator.storage.getDirectory();
    const proj = await (await r.getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle('26.0142 Teststadt');
    const fp = await proj.getDirectoryHandle('Feldprotokolle', { create: true });
    const c = document.createElement('canvas'); c.width = 620; c.height = 877;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 620, 877); g.fillStyle = '#000'; g.fillText('Feldprotokoll 26.0142-PN-01', 30, 40);
    const jpg = new Uint8Array(await (await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9))).arrayBuffer());
    const hex = async b => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), x => x.toString(16).padStart(2, '0')).join('');
    const schreibe = async (dir, n, data) => { const w = await (await dir.getFileHandle(n, { create: true })).createWritable(); await w.write(data); await w.close(); };
    await schreibe(fp, 'A_Scan.jpg', jpg); await schreibe(fp, 'B_Scan.jpg', jpg);
    const sha = await hex(jpg);
    await schreibe(fp, 'B_Scan.jpg', 'nachträglich verändert');
    const rec = { id: 'fp-1', typ: 'pn98', formularId: '26.0142-PN-01', erfasstVon: 'AB', erfasstAm: '2026-10-22T07:00:00.000Z',
      kopf: { projektNr: '26.0142', probenehmer: 'S. Kasper', unterschrift: true }, mp: [{ nr: 1, w: { probenNr: 'P7', stelle: 'Haufwerk H1' } }], unl: {},
      scans: [{ datei: 'A_Scan.jpg', sha256: sha, abgelegtAm: '2026-10-22T07:30:00.000Z', abgelegtVon: 'AB' }, { datei: 'B_Scan.jpg', sha256: sha, abgelegtAm: '2026-10-22T07:31:00.000Z', abgelegtVon: 'AB' }],
      abgeschlossen: { von: 'AB', am: '2026-10-22T08:00:00.000Z' }, pruefung: { von: 'SK', am: '2026-10-22T09:00:00.000Z', selbst: false }, aenderungen: [] };
    const lab = await proj.getDirectoryHandle('Laboraufträge');
    await schreibe(lab, '26.0142_16.10.2026_Daten.json', JSON.stringify(Object.assign({}, d, { feldprotokolle: [rec] })));
  }, daten);
  await page.locator('#btnRescan').click();
  await page.locator('.proj[data-name="26.0142 Teststadt"]').click();
  await page.waitForFunction(() => /1 Feldprotokoll PN 98 \(vor Ort\)/.test(document.getElementById('anl')?.textContent || ''));
  await page.locator('#anlPn98').click();
  await page.locator('#aTitel').waitFor();
  assert.match(await page.locator('#dialog').textContent(), /1 Feldprotokoll mit Scan \+ 1 am Bildschirm/);
  await page.locator('#aBrand').uncheck();
  await page.locator('#aYes').click();
  await page.waitForFunction(() => /ACHTUNG: 1 Scan fehlt oder weicht ab/.test(document.getElementById('banner').textContent));
  ({ out } = await lies());
  const neu = Object.keys(out).find(n => /_PN98_.*\.docx$/.test(n));
  const ff = lade.unzip(Uint8Array.from(out[neu]), DOCX.crc32);
  const fdoc = new TextDecoder().decode(ff['word/document.xml']);
  assert.match(fdoc, /Übertragung des Feldbogens 26\.0142-PN-01/);
  assert.match(fdoc, /A_Scan\.jpg · abgelegt [^<]* · Prüfsumme beim Erstellen der Anlage bestätigt/);
  assert.match(fdoc, /B_Scan\.jpg · abgelegt [^<]* · ACHTUNG: Datei weicht von der abgelegten Prüfsumme ab/);
  assert.match(fdoc, /Übertragung geprüft von SK/);
  const media = Object.keys(ff).filter(k => k.startsWith('word/media/'));
  assert.equal(media.length, 1, 'nur der stimmige Scan als Bild');
  assert.deepEqual([...ff[media[0]].slice(0, 2)], [0xff, 0xd8], 'JPEG');

  assert.deepEqual(errors, [], 'keine Fehler in der Konsole');
  await browser.close(); server.close();
  console.log(`OK (${name})`);
})().catch(e => {
  console.error(e);
  const text = String(e && e.stack || e).slice(0, 1500).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
  console.log(`::error title=Browsertest Anlage ${name}::${text}`);
  process.exit(1);
});
