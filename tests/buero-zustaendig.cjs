// Büroübersicht · zuständige Person je Übergabe: node tests/buero-zustaendig.cjs [chromium]
//  • Der Ordnernamen-Block in buero/mitarbeiter.js ist zeichengleich mit dem der Projektzentrale.
//  • Mit Mitarbeiterliste: Ort ohne Kürzel (auch bei alten Aufträgen, deren „ort“ das Kürzel noch enthält),
//    zuständige Person in Liste und Detail, manuelle Auswahl aus _Projekt.json vor dem Ordnernamen.
//  • Filter „Zuständig“: Meine Übergaben (spektron-ich), einzelne Person, ohne erkannte Person; Auswahl bleibt gemerkt.
//  • Ohne Mitarbeiterliste: Anzeige wie bisher, kein Filter. Nur erfundene Kürzel und Namen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const block = s => { const a = s.indexOf('const PROJ_RE'), b = s.indexOf('/* SPEKTRON-ORDNERNAME-ENDE */'); assert.ok(a >= 0 && b > a); return s.slice(a, b); };
assert.equal(block(fs.readFileSync(path.join(root, 'buero', 'mitarbeiter.js'), 'utf8')), block(fs.readFileSync(path.join(root, 'index.html'), 'utf8')),
  'buero/mitarbeiter.js: Block SPEKTRON-ORDNERNAME muss mit index.html übereinstimmen');

const LISTE = { format: 'spektron-mitarbeiter', version: 1, personen: [
  { ordnerKuerzel: 'Abc', appKuerzel: 'AB', name: 'Anna Beispiel', aktiv: true },
  { ordnerKuerzel: 'Dr. Te', appKuerzel: 'TE', name: 'Dr. Tea Test', aktiv: true },
  { ordnerKuerzel: 'Alt', appKuerzel: 'ALT', name: 'Ehemalig', aktiv: false }] };
// Ordner, gespeicherter Ort im Auftrag (alt: mit Kürzel), manuelle Zuständigkeit in _Projekt.json
const PROJEKTE = [
  ['26.0201 Musterweg 3 Teststadt Abc', 'Musterweg 3 Teststadt Abc', null],
  ['26.0202 Probedorf Dr. Te', 'Probedorf', null],
  ['26.0203 Beispielhausen Abc', 'Beispielhausen Abc', { kuerzel: 'Dr. Te', gesetzt: 'manuell' }],
  ['26.0204 Ohnekuerzel', 'Ohnekuerzel', null],
];

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
(async () => {
  let pw; try { pw = require('playwright'); } catch (e) { console.log('OK Ordnername-Block identisch (ohne Browser)'); return; }
  const server = http.createServer((req, res) => {
    const f = path.resolve(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).slice(1));
    if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/buero/index.html`;
  const browser = await pw[process.argv[2] || 'chromium'].launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'de-DE' })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url);

    const seed = (liste, ich) => page.evaluate(async ([projekte, liste, ich]) => {
      const r = await navigator.storage.getDirectory();
      for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
      const archiv = await r.getDirectoryHandle('Testarchiv', { create: true });
      const schreib = async (dir, name, o) => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(JSON.stringify(o)); await w.close(); };
      if (liste) await schreib(archiv, '_Spektron-Mitarbeiter.json', liste);
      for (const [name, ort, zust] of projekte){
        const p = await archiv.getDirectoryHandle(name, { create: true });
        await schreib(p, '_Projekt.json', zust ? { format: 'mosaik-projekt', version: 1, zustaendig: zust } : { format: 'mosaik-projekt', version: 1 });
        const content = BueroData.snapshot({ name, nr: name.slice(0, 7), ort }, 'Mitteilungen/Gutachten.docx', 'QA', '', BueroData.recipients({ auftraggeber: 'Muster AG', sachverstaendigerBeteiligt: 'Dr. Muster' }));
        await BueroData.create(p, BueroData.order(content));
      }
      await new Promise((res, rej) => { const q = indexedDB.open('mosaik-suite', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv');
        q.onsuccess = () => { const t = q.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(archiv, 'archiv'); t.oncomplete = () => { q.result.close(); res(); }; t.onerror = () => rej(t.error); }; q.onerror = () => rej(q.error); });
      for (const k of ['spektron-ich', 'buero-wer']) localStorage.removeItem(k);
      if (ich) localStorage.setItem('spektron-ich', ich);
    }, [PROJEKTE, liste, ich]);
    const zeilen = async () => { await page.goto(url); await page.locator('#list tr[data-order]').nth(PROJEKTE.length - 1).waitFor({ timeout: 8000 });
      return page.evaluate(() => [...document.querySelectorAll('#list tr[data-order] td:first-child')].map(td => td.innerText.replace(/\s+/g, ' ').trim())); };
    const sichtbar = () => page.evaluate(() => [...document.querySelectorAll('#list tr[data-order] td:first-child b')].map(b => b.textContent));

    // 1) Mitarbeiterliste vorhanden, „Ich bin“ Abc
    await seed(LISTE, 'Abc');
    assert.deepEqual(await zeilen(), [
      '26.0201 Musterweg 3 Teststadt Anna Beispiel',
      '26.0202 Probedorf Dr. Tea Test',
      '26.0203 Beispielhausen Dr. Tea Test (in der Projektzentrale gewählt)',
      '26.0204 Ohnekuerzel Nicht erkannt']);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#wer option')].map(o => o.textContent)),
      ['Alle', 'Meine Übergaben', 'Anna Beispiel', 'Dr. Tea Test', 'Ohne erkannte Person'], 'inaktive Person nicht im Filter');
    await page.locator('#wer').selectOption('ich');
    assert.deepEqual(await sichtbar(), ['26.0201'], 'manuelle Auswahl schlägt den Ordnernamen');
    await page.locator('#wer').selectOption({ label: 'Dr. Tea Test' });
    assert.deepEqual(await sichtbar(), ['26.0202', '26.0203']);
    await page.locator('#wer').selectOption('ohne');
    assert.deepEqual(await sichtbar(), ['26.0204']);
    await page.locator('#wer').selectOption({ label: 'Dr. Tea Test' });
    await page.locator('#search').fill('probedorf');
    assert.deepEqual(await sichtbar(), ['26.0202']);
    await page.locator('#search').fill('');
    // Suche nach Personennamen
    await page.locator('#wer').selectOption('');
    await page.locator('#search').fill('anna');
    assert.deepEqual(await sichtbar(), ['26.0201']);
    await page.locator('#search').fill('');
    // Detail
    await page.locator('#list tr[data-order]').nth(2).click();
    await page.locator('#detail h2', { hasText: '26.0203 · Beispielhausen' }).waitFor();
    assert.match(await page.locator('[data-zust-detail]').innerText(), /^Zuständig: Dr\. Tea Test \(in der Projektzentrale gewählt\)$/);
    // Auswahl bleibt gemerkt
    await page.locator('#wer').selectOption('ich');
    await page.goto(url); await page.locator('#list tr[data-order]').first().waitFor({ timeout: 8000 });
    assert.equal(await page.inputValue('#wer'), 'ich');
    assert.deepEqual(await sichtbar(), ['26.0201']);

    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    // 2) Ohne „Ich bin“: kein „Meine Übergaben“; ein gemerktes „ich“ fällt auf „Alle“ zurück
    await page.evaluate(() => localStorage.removeItem('spektron-ich'));
    await page.goto(url); await page.locator('#list tr[data-order]').nth(PROJEKTE.length - 1).waitFor({ timeout: 8000 });
    assert.equal(await page.inputValue('#wer'), '');
    assert.equal(await page.locator('#wer option[value="ich"]').count(), 0);

    // 3) Ohne Mitarbeiterliste: wie bisher (gespeicherter Ort), kein Filter
    await seed(null, 'Abc');
    const ohne = await zeilen();
    assert.equal(ohne[0], '26.0201 Musterweg 3 Teststadt Abc');
    assert.equal(ohne[2], '26.0203 Beispielhausen Abc Dr. Te (in der Projektzentrale gewählt)');
    assert.equal(await page.locator('#wer-feld').isHidden(), true);

    assert.deepEqual(errors, []);
    console.log('OK Büro zuständig: Block identisch, Ort ohne Kürzel, Person in Liste und Detail, manuelle Auswahl, Filter, ohne Liste unverändert');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
