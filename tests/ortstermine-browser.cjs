// 1.53: Weitere Ortstermine in den Projektdaten: node tests/ortstermine-browser.cjs [chromium|webkit]
// Ein Termin: nur der Link, Datei unverändert. „+ Weiterer Ortstermin“ → Entwurf, gespeichert erst mit Datum; ändern; Termin 1
// bekommt Bezeichnung und „Wer war da“; Kopf „Ortstermine 12.08. · 20.08.2026“; Entfernen mit Rückfrage (nennt FotoKit-Ordner und
// gemerkte Bilddoku, Abbrechen ändert nichts), Kennung wird nicht neu vergeben; zwei Fenster ändern die Liste gleichzeitig →
// Widerspruch, nichts überschrieben. Dazu: „n Bilder“ zählt Unterordner von „Fotos“ mit; Übergabe hakt PDFs in „Fotos“ bei
// mehreren Terminen nur nach BerichtKit vor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..');
const EINS = '26.0701 Termine Teststadt', BILDER = '26.0702 Bilder Teststadt', UEB1 = '26.0703 Eins Teststadt', UEB2 = '26.0704 Zwei Teststadt';
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const errors = [];
let schritt = 'Start', seite = null;

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYP[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright[name].launch(); require('./spektron-start-test.cjs')(browser, '26.0100');
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  await ctx.addInitScript(() => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner'); });
  const neueSeite = async () => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('dialog', d => { errors.push('natives Dialogfenster: ' + d.message()); d.dismiss(); });
    await page.goto(url); await page.waitForSelector('#btnInfo');
    return page;
  };
  const page = await neueSeite(); seite = page;
  const kann = await page.evaluate(async () => {
    if (!navigator.storage || !navigator.storage.getDirectory) return false;
    try{ const r = await navigator.storage.getDirectory(); const h = await r.getFileHandle('probe', { create: true }); if (!h.createWritable) return false; await r.removeEntry('probe'); return true; }catch(e){ return false; }
  });
  if (!kann){ assert.deepEqual(errors, []); await browser.close(); server.close(); console.log(`OK (${name}, ohne Ordnerzugriff: nur Laden geprüft)`); return; }

  const PJ1 = { format: 'mosaik-projekt', version: 1, hinweis: 'Gemeinsame Projektdaten', objekt: 'EFH, Testweg 1', auftraggeber: 'Muster Versicherung AG', ortstermin: '2026-08-12' };
  const EINS_TEXT = JSON.stringify(PJ1, null, 2) + '\n';
  // Archiv: EINS (ein Termin) · BILDER (Fotos in Unterordnern) · UEB1/UEB2 (Übergabe mit zwei Bilddokus, ein bzw. zwei Termine)
  await page.evaluate(async ([eins, einsText, bilder, ueb1, ueb2, pj1]) => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
    const put = async (d, n, t) => { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); };
    const sub = async (d, ...ns) => { for (const n of ns) d = await d.getDirectoryHandle(n, { create: true }); return d; };
    const pE = await sub(archiv, eins); await put(pE, '_Projekt.json', einsText);
    const fE = await sub(pE, 'Fotos'); await put(fE, 'IMG_0001.jpg', 'x');
    const pB = await sub(archiv, bilder); await put(pB, '_Projekt.json', JSON.stringify(pj1));
    const fB = await sub(pB, 'Fotos'); await put(fB, 'IMG_0001.jpg', 'x'); await put(fB, 'Liste.pdf', '%PDF');
    for (const [o, ns] of [['Bilder A', ['IMG_0001.jpg', 'IMG_0002.HEIC', 'notiz.txt']], ['fotos ka 20.08', ['IMG_0001.jpg']], ['_aussortiert', ['IMG_0009.jpg']], ['.versteckt', ['IMG_0008.jpg']]]){
      const d = await sub(fB, o); for (const n of ns) await put(d, n, 'x'); }
    await put(await sub(fB, 'Bilder A', 'tiefer'), 'IMG_0007.jpg', 'x');   // zweite Ebene zählt nicht
    for (const [n, weitere] of [[ueb1, null], [ueb2, [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung', wer: 'Ka' }]]]){
      const p = await sub(archiv, n); const nr = n.slice(0, 7);
      await put(p, '_Projekt.json', JSON.stringify({ ...pj1, ...(weitere ? { weitereOrtstermine: weitere } : {}) }));
      const f = await sub(p, 'Fotos');
      await put(f, `Bilddokumentation_${nr}_Teststadt_2026-08-12.pdf`, '%PDF'); await put(f, `Bilddokumentation_${nr}_Teststadt_2026-08-20.pdf`, '%PDF');
      const m = await sub(p, 'Mitteilungen'); await put(m, `2._Mitteilung_${nr}.docx`, 'Synthetic placeholder');
      await put(m, '_BerichtKit.json', JSON.stringify({ format: 'spektron-bericht', version: 1, projekt: nr, form: {},
        berichte: [{ datei: `2._Mitteilung_${nr}.docx`, am: '2026-11-26T09:00:00.000Z', anlagen: [`Fotos/Bilddokumentation_${nr}_Teststadt_2026-08-20.pdf`] }] }));
    }
  }, [EINS, EINS_TEXT, BILDER, UEB1, UEB2, PJ1]);

  const start = async pg => { await pg.locator('#btnStart, #btnArchive').first().click(); await pg.locator(`.proj[data-name="${EINS}"]`).waitFor(); };
  await start(page);
  const leseText = n => page.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    return await (await (await p.getFileHandle('_Projekt.json')).getFile()).text(); }, n);
  const lese = async n => JSON.parse(await leseText(n));
  const oeffne = async (pg, n) => {
    await pg.locator(`.proj[data-name="${n}"]`).click();
    await pg.waitForFunction(n => document.querySelector('.proj.active')?.dataset.name === n && document.getElementById('otBlock') && document.querySelector('#detail h2')?.textContent.includes(n.slice(0, 7)), n);
    await pg.waitForTimeout(150);
  };
  const auf = async pg => { if (!await pg.locator('#pjBox').evaluate(d => d.open)) await pg.locator('#pjBox > summary').click(); };
  const gespeichert = pg => pg.waitForFunction(() => document.querySelector('#pjSave')?.classList.contains('ok') && !/werden gespeichert/.test(document.getElementById('pjAttention').textContent), null, { timeout: 8000 });
  const warte = async (fn, was) => { for (let i = 0; i < 50; i++){ if (await fn()) return; await page.waitForTimeout(100); } assert.fail('zu lange gewartet: ' + was); };
  const zeilen = pg => pg.locator('#otBlock .ot-zeile').evaluateAll(z => z.map(x => [x.querySelector('.ot-nr').textContent, x.dataset.otZeile,
    (x.querySelector('input[type=date]') || x.querySelector('.ot-t1')).value ?? x.querySelector('.ot-t1').textContent, x.querySelector('[data-ot-feld=bezeichnung]').value, x.querySelector('[data-ot-feld=wer]').value]));

  // 1) Ein Termin: Oberfläche wie bisher bis auf den Link; Öffnen schreibt nichts
  schritt = 'ein Termin';
  await oeffne(page, EINS); await auf(page);
  assert.equal(await page.locator('#pjSumme').textContent(), 'EFH, Testweg 1 · Muster Versicherung AG · Ortstermin 12.08.2026');
  assert.equal(await page.locator('#otBlock').innerText(), '+ Weiterer Ortstermin');
  assert.equal(await page.locator('#otBlock .ot-zeile').count(), 0);
  assert.equal(await page.locator('#pj_ortstermin').inputValue(), '2026-08-12');
  assert.equal(await leseText(EINS), EINS_TEXT, 'Datei unverändert');

  // 2) „+ Weiterer Ortstermin“: Entwurf (Termin 2), Fokus im Datum; ohne Datum wird nichts gespeichert
  schritt = 'Entwurf';
  await page.locator('#otNeu').click();
  await page.locator('#pj_ot_t2_datum').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pj_ot_t2_datum');
  assert.match(await page.locator('#otBlock').innerText(), /Neuer Termin – wird gespeichert, sobald das Datum eingetragen ist/);
  assert.equal(await page.locator('#otNeu').count(), 0, 'nur ein Entwurf auf einmal');
  await page.locator('#pj_ot_t2_bezeichnung').fill('Nachbeprobung');
  await page.waitForTimeout(900);
  assert.equal(await leseText(EINS), EINS_TEXT, 'Entwurf ohne Datum: nichts gespeichert');
  // Entwurf verwerfen → wieder nur der Link
  await page.locator('[data-ot-weg="t2"]').click();
  assert.equal(await page.locator('#otBlock').innerText(), '+ Weiterer Ortstermin', 'Entwurf verworfen, ohne Rückfrage');
  assert.equal(await page.locator('#dlgBack.show').count(), 0);
  // erneut, mit Datum → gespeichert
  schritt = 'Termin 2 anlegen';
  await page.locator('#otNeu').click(); await page.locator('#pj_ot_t2_datum').waitFor();
  await page.locator('#pj_ot_t2_bezeichnung').fill('Nachbeprobung');
  await page.locator('#pj_ot_t2_datum').fill('2026-08-20');
  await gespeichert(page);
  await warte(async () => Array.isArray((await lese(EINS)).weitereOrtstermine), 'Liste gespeichert');
  assert.deepEqual((await lese(EINS)).weitereOrtstermine, [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung', wer: '' }]);
  assert.equal((await lese(EINS)).ortstermin, '2026-08-12', 'Termin 1 unverändert');
  assert.equal(await page.locator('#pjSumme').textContent(), 'EFH, Testweg 1 · Muster Versicherung AG · Ortstermine 12.08. · 20.08.2026');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pj_ot_t2_datum', 'Fokus bleibt im Feld');
  // ändern: Wer war da, Datum; Termin 1 Bezeichnung und Wer
  schritt = 'ändern';
  await page.locator('#pj_ot_t2_wer').fill('Ka, Ste');
  await page.locator('#pj_ot_t1_bezeichnung').fill('Erstbegehung');
  await page.locator('#pj_ot_t1_wer').fill('Ste ');
  await page.locator('#pj_ot_t2_datum').fill('2026-08-21');
  await gespeichert(page);
  await warte(async () => (await lese(EINS)).ortsterminWer === 'Ste' && (await lese(EINS)).weitereOrtstermine[0].datum === '2026-08-21', 'Änderungen gespeichert');
  let d = await lese(EINS);
  assert.deepEqual(d.weitereOrtstermine, [{ id: 't2', datum: '2026-08-21', bezeichnung: 'Nachbeprobung', wer: 'Ka, Ste' }]);
  assert.equal(d.ortsterminBezeichnung, 'Erstbegehung'); assert.equal(d.ortsterminWer, 'Ste', 'getrimmt');
  // Projekt neu öffnen: Liste wie gespeichert, Termin 1 zeigt das Datum aus „Ortstermin“
  await oeffne(page, BILDER); await oeffne(page, EINS); await auf(page);
  assert.deepEqual(await zeilen(page), [['1', 't1', '12.08.2026', 'Erstbegehung', 'Ste'], ['2', 't2', '2026-08-21', 'Nachbeprobung', 'Ka, Ste']]);
  assert.equal(await page.locator('#pjSumme').textContent(), 'EFH, Testweg 1 · Muster Versicherung AG · Ortstermine 12.08. · 21.08.2026');
  assert.equal(await page.locator('#pj_ot_t2_bezeichnung').getAttribute('list'), 'otVorschlag');
  assert.deepEqual(await page.locator('#otVorschlag option').evaluateAll(o => o.map(x => x.value)), ['Erstbegehung', 'Nachbeprobung', 'Freimessung']);
  // Termin 1 bleibt das bekannte Feld: Datum dort ändern → in der Liste sichtbar, gespeichert als „ortstermin“
  await page.locator('#pj_ortstermin').fill('2026-08-13');
  assert.equal(await page.locator('#otT1Datum').textContent(), '13.08.2026');
  await gespeichert(page); await warte(async () => (await lese(EINS)).ortstermin === '2026-08-13', 'Termin 1');
  assert.deepEqual((await lese(EINS)).weitereOrtstermine.map(t => t.id), ['t2']);

  // 3) Termin 3 anlegen; FotoKit hat (erfunden, Format aus Plan 4.2) eine Bilddoku und einen Ordner für t3 gemerkt
  schritt = 'Termin 3 und FotoKit';
  await page.locator('#otNeu').click(); await page.locator('#pj_ot_t3_datum').waitFor();
  await page.locator('#pj_ot_t3_bezeichnung').fill('Freimessung');
  await page.locator('#pj_ot_t3_datum').fill('2026-09-03');
  await gespeichert(page); await warte(async () => (await lese(EINS)).weitereOrtstermine.length === 2, 'Termin 3');
  const FK = JSON.stringify({ format: 1, version: '2.7.0', bilder: { 'fotos ka 03.09/IMG_0001.jpg': { beschreibung: 'Freimessung Küche' } },
    ordnerTermine: { 'fotos ka 03.09': { termin: 't3', am: '2026-11-26T10:00:00Z', vorschlag: 'datum-im-namen' }, 'Bilder Stefan': { termin: 't1' } },
    bilddokus: { t3: { dateien: ['Bilddokumentation_26.0701_Termine Teststadt_2026-09-03.pdf'], erstellt: '2026-11-26T10:05:00Z' } } }, null, 2);
  await page.evaluate(async t => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle('26.0701 Termine Teststadt');
    const w = await (await (await p.getDirectoryHandle('Fotos')).getFileHandle('_Bildumbenenner.json', { create: true })).createWritable(); await w.write(t); await w.close(); }, FK);
  // Entfernen: Rückfrage nennt Ordner und Bilddoku; Abbrechen ändert nichts
  schritt = 'Entfernen – Rückfrage';
  const vorEntfernen = await leseText(EINS);
  await page.locator('[data-ot-weg="t3"]').click();
  await page.locator('#dlgBack.show #dialog h3').filter({ hasText: 'Ortstermin 3 entfernen?' }).waitFor();
  const frage = await page.locator('#dialog').innerText();
  assert.match(frage, /Termin 3 \(03\.09\.2026 · Freimessung\) wird aus den Projektdaten entfernt/);
  assert.match(frage, /Foto-Ordner „fotos ka 03\.09“\. Sie werden in FotoKit wieder gelb/);
  assert.match(frage, /Bilddokumentation gemerkt: „Bilddokumentation_26\.0701_Termine Teststadt_2026-09-03\.pdf“\. Die Datei bleibt liegen und bleibt in FotoKit unter der Kennung t3 gemerkt/);
  assert.match(frage, /Die Kennung t3 wird nicht neu vergeben/);
  await page.locator('#dNo').click(); await page.waitForTimeout(800);
  assert.equal(await leseText(EINS), vorEntfernen, 'Abbrechen: nichts geändert');
  assert.equal(await page.locator('#otBlock .ot-zeile').count(), 3);
  // Bestätigen → t3 weg, FotoKits Datei unberührt
  schritt = 'Entfernen – bestätigt';
  await page.locator('[data-ot-weg="t3"]').click();
  await page.locator('#dlgBack.show #dYes').click();
  await warte(async () => (await lese(EINS)).weitereOrtstermine.length === 1, 't3 entfernt');
  assert.deepEqual((await lese(EINS)).weitereOrtstermine.map(t => t.id), ['t2']);
  assert.equal(await page.evaluate(async () => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle('26.0701 Termine Teststadt');
    return await (await (await (await p.getDirectoryHandle('Fotos')).getFileHandle('_Bildumbenenner.json')).getFile()).text(); }), FK, 'FotoKits Datei unverändert');
  await page.locator('#otBlock .ot-zeile').nth(1).waitFor();
  assert.equal(await page.locator('#otBlock .ot-zeile').count(), 2);
  // Neuer Termin bekommt t4, nicht t3 (t3 steht noch in FotoKit)
  schritt = 'Kennung nicht neu vergeben';
  await page.locator('#otNeu').click();
  await page.locator('#pj_ot_t4_datum').waitFor();
  assert.equal(await page.locator('#pj_ot_t3_datum').count(), 0);
  await page.locator('[data-ot-weg="t4"]').click();   // Entwurf verwerfen
  // Letzten weiteren Termin entfernen → Feld weg; Bezeichnung/Wer von Termin 1 bleiben (Rückfrage sagt es)
  schritt = 'letzten entfernen';
  await page.locator('[data-ot-weg="t2"]').click();
  await page.locator('#dlgBack.show #dialog h3').filter({ hasText: 'Ortstermin 2 entfernen?' }).waitFor();
  assert.match(await page.locator('#dialog').innerText(), /Foto-Ordner, die diesem Termin in FotoKit zugeordnet sind, werden dort wieder gelb[\s\S]*Danach hat das Projekt wieder einen Ortstermin; Bezeichnung und „Wer war da“ von Termin 1 bleiben stehen/);
  await page.locator('#dYes').click();
  await warte(async () => !('weitereOrtstermine' in await lese(EINS)), 'Feld entfernt');
  d = await lese(EINS);
  assert.equal(d.ortsterminBezeichnung, 'Erstbegehung'); assert.equal(d.ortstermin, '2026-08-13');
  await page.waitForFunction(() => document.getElementById('pjSumme').textContent.endsWith('Ortstermin 13.08.2026'));
  assert.deepEqual((await zeilen(page)).map(z => z[1]), ['t1'], 'Termin 1 mit seinen Angaben bleibt sichtbar');
  // Termin 1 Angaben leeren → wieder wie ein Projekt mit einem Termin (Felder entfernt, nur der Link)
  await page.locator('#pj_ot_t1_bezeichnung').fill(''); await page.locator('#pj_ot_t1_wer').fill('');
  await gespeichert(page); await warte(async () => !('ortsterminBezeichnung' in await lese(EINS)) && !('ortsterminWer' in await lese(EINS)), 'Termin-1-Angaben entfernt');
  await oeffne(page, BILDER); await oeffne(page, EINS); await auf(page);
  assert.equal(await page.locator('#otBlock').innerText(), '+ Weiterer Ortstermin');

  if (process.env.SHOT){ await page.locator('#otNeu').click(); await page.locator('#pj_ot_t4_datum').waitFor(); await page.locator('#pjBox').screenshot({ path: process.env.SHOT + '-entwurf.png' }); await page.locator('[data-ot-weg="t4"]').click(); }
  // 4) Zwei Fenster ändern die Liste gleichzeitig: das spätere bekommt einen Widerspruch, nichts wird überschrieben
  schritt = 'zwei Fenster';
  await page.locator('#otNeu').click(); await page.locator('#pj_ot_t4_datum').waitFor();
  await page.locator('#pj_ot_t4_datum').fill('2026-10-01');   // t4 (t3 steht noch in FotoKit)
  await gespeichert(page); await warte(async () => ((await lese(EINS)).weitereOrtstermine || []).length === 1, 'A: t4');
  const zweite = await neueSeite(); await start(zweite); await oeffne(zweite, EINS); await auf(zweite);
  assert.deepEqual((await zeilen(zweite)).map(z => z[1]), ['t1', 't4'], 'Fenster B liest den Stand');
  // A ändert t4 und speichert; B (hat den Stand vorher gelesen, kein Fensterwechsel) ändert danach t4
  await page.locator('#pj_ot_t4_wer').fill('Ka');
  await gespeichert(page); await warte(async () => (await lese(EINS)).weitereOrtstermine[0].wer === 'Ka', 'A gespeichert');
  await zweite.locator('#pj_ot_t4_bezeichnung').fill('Nachbeprobung');
  await zweite.waitForFunction(() => /Projektdaten nicht gespeichert: Die Projektdaten wurden während des Speicherns geändert/.test(document.getElementById('pjAttention').textContent), null, { timeout: 8000 });
  d = await lese(EINS);
  assert.deepEqual(d.weitereOrtstermine, [{ id: 't4', datum: '2026-10-01', bezeichnung: '', wer: 'Ka' }], 'A bleibt, B überschreibt nichts');
  assert.equal(await zweite.locator('#pj_ot_t4_bezeichnung').inputValue(), 'Nachbeprobung', 'Eingabe in B bleibt stehen');
  // B legt außerdem einen Termin an (neue Kennung aus seinem alten Stand) – auch das überschreibt nichts
  await zweite.locator('#otNeu').click(); await zweite.locator('#pj_ot_t5_datum').waitFor(); await zweite.locator('#pj_ot_t5_datum').fill('2026-10-02');
  await zweite.waitForTimeout(1200);
  assert.deepEqual((await lese(EINS)).weitereOrtstermine, d.weitereOrtstermine, 'immer noch nichts überschrieben');
  if (process.env.SHOT){ await page.locator('#detail h2').scrollIntoViewIfNeeded(); await page.screenshot({ path: process.env.SHOT + '-liste.png' }); await zweite.screenshot({ path: process.env.SHOT + '-widerspruch.png' }); }
  await zweite.close();

  // 5) Bestand „n Bilder“: direkt in Fotos und eine Ebene darunter, ohne „_…“/„.…“, ohne zweite Ebene
  schritt = 'Bilder zählen';
  await oeffne(page, BILDER);
  if (!await page.locator('#ordBox').evaluate(e => e.open)){ if (!await page.locator('#projektMehr').evaluate(e => e.open)) await page.locator('#projektMehr > summary').click(); await page.locator('#ordBox > summary').click(); }
  await page.waitForFunction(() => /4 Bilder/.test(document.querySelector('#ordBox table.folders')?.textContent || ''));
  assert.match(await page.locator('#ordBox table.folders').innerText(), /Fotos\s+4 Bilder/);
  assert.equal(await page.locator('[data-kachel=fotos] [data-ktext]').textContent(), '4 Fotos', 'Kachel Fotos zählt mit');

  // 6) Übergabe: ein Termin → beide Bilddokus vorgehakt (wie bisher); zwei Termine → nur die, die BerichtKit nennt
  const anl = async () => page.locator('#bueroPanel [data-ab-anl] label').evaluateAll(l => l.map(x => [x.textContent.trim().replace(/\s+/g, ' '), x.querySelector('input').checked]));
  const uebergabe = async n => {
    await oeffne(page, n);
    await page.locator('#goUebergabe').click();
    await page.waitForFunction(() => document.querySelectorAll('#bueroPanel [data-ab-anl] label input').length >= 2);
    await page.waitForFunction(() => /2\._Mitteilung_/.test(document.querySelector('#bueroPanel [data-ab-word]')?.value || ''));
    await page.waitForTimeout(200);
    return anl();
  };
  schritt = 'Übergabe ein Termin';
  assert.deepEqual(await uebergabe(UEB1), [['Bilddokumentation_26.0703_Teststadt_2026-08-12.pdf Fotos', true], ['Bilddokumentation_26.0703_Teststadt_2026-08-20.pdf Fotos', true]]);
  schritt = 'Übergabe zwei Termine';
  assert.deepEqual(await uebergabe(UEB2), [['Bilddokumentation_26.0704_Teststadt_2026-08-12.pdf Fotos', false], ['Bilddokumentation_26.0704_Teststadt_2026-08-20.pdf Fotos · Anlage laut BerichtKit', true]]);

  assert.deepEqual(errors, []);
  await browser.close(); server.close();
  console.log(`OK (${name}): 1.53 weitere Ortstermine – ein Termin unverändert (Datei byte-gleich), Entwurf erst mit Datum gespeichert, ändern (auch Termin 1), Kopf „Ortstermine …“, Entfernen mit Rückfrage (FotoKit-Ordner und Bilddoku genannt, Abbrechen ändert nichts, FotoKit-Datei unberührt), Kennung nicht neu vergeben, letzter entfernt → Feld weg, zwei Fenster → Widerspruch ohne Überschreiben, „n Bilder“ mit Unterordnern, Übergabe hakt Bilddokus nach BerichtKit vor`);
})().catch(async e => {
  console.error(e);
  let zustand = '';
  try{ zustand = await seite.evaluate(() => ['aktiv=' + (document.querySelector('.proj.active')?.dataset.name || '–'), 'ot=' + (document.getElementById('otBlock')?.innerText || '–').replace(/\s+/g, ' ').slice(0, 160),
    'att=' + (document.getElementById('pjAttention')?.textContent || '–'), 'fokus=' + (document.activeElement?.id || '–')].join(' | ')); }catch(_){ zustand = 'Seite nicht lesbar'; }
  console.log(`::error title=Browsertest Ortstermine ${name}::${schritt}: ${String(e && e.message || e).split('\n')[0]} · ${zustand} · Seitenfehler: ${errors.join(' | ').slice(0, 300)}`); process.exit(1);
});
