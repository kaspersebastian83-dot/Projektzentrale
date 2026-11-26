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
const ZAEHL = '26.0705 Zaehler Teststadt', BESTAND = '26.0706 Bestand Teststadt', KAPUTT = '26.0707 Kaputt Teststadt';
const LANGSAM = '26.0708 Langsam Teststadt', UEB3 = '26.0709 Drei Teststadt';
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
  await page.evaluate(async ([eins, einsText, bilder, ueb1, ueb2, pj1, zaehl, bestand, kaputt, langsam, ueb3]) => {
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
    // Zähler: ZAEHL ohne FotoKit-Datei; BESTAND mit t2 ohne Zähler, FotoKit nennt t5; KAPUTT mit t2 ohne Zähler, FotoKit-Datei nicht lesbar
    await put(await sub(archiv, zaehl), '_Projekt.json', JSON.stringify(pj1));
    const pBe = await sub(archiv, bestand); await put(pBe, '_Projekt.json', JSON.stringify({ ...pj1, weitereOrtstermine: [{ id: 't2', datum: '2026-08-20', bezeichnung: '', wer: '' }] }));
    await put(await sub(pBe, 'Fotos'), '_Bildumbenenner.json', JSON.stringify({ format: 1, version: '2.7.0', bilder: {}, bilddokus: { t5: { dateien: ['alt.pdf'] } } }));
    const pK = await sub(archiv, kaputt); await put(pK, '_Projekt.json', JSON.stringify({ ...pj1, weitereOrtstermine: [{ id: 't2', datum: '2026-08-20', bezeichnung: '', wer: '' }] }));
    await put(await sub(pK, 'Fotos'), '_Bildumbenenner.json', '{ kaputt');
    // 1.53.1 (Review #92): LANGSAM für verzögertes Schreiben; UEB3 Übergabe mit offenem Formular
    await put(await sub(archiv, langsam), '_Projekt.json', JSON.stringify(pj1));
    const p3 = await sub(archiv, ueb3), f3 = await sub(p3, 'Fotos');
    await put(p3, '_Projekt.json', JSON.stringify(pj1));
    for (const n of ['Bilddokumentation_26.0709_Teststadt_2026-08-12.pdf', 'Bilddokumentation_26.0709_Teststadt_2026-08-20.pdf', 'Skizze.pdf']) await put(f3, n, '%PDF');
    const m3 = await sub(p3, 'Mitteilungen'); await put(m3, '2._Mitteilung_26.0709.docx', 'Synthetic placeholder');
    await put(m3, '_BerichtKit.json', JSON.stringify({ format: 'spektron-bericht', version: 1, projekt: '26.0709', form: {},
      berichte: [{ datei: '2._Mitteilung_26.0709.docx', am: '2026-11-26T09:00:00.000Z', anlagen: ['Fotos/Bilddokumentation_26.0709_Teststadt_2026-08-20.pdf'] }] }));
  }, [EINS, EINS_TEXT, BILDER, UEB1, UEB2, PJ1, ZAEHL, BESTAND, KAPUTT, LANGSAM, UEB3]);

  const start = async pg => { await pg.locator('#btnStart, #btnArchive').first().click(); await pg.locator(`.proj[data-name="${EINS}"]`).waitFor(); };
  await start(page);
  // Lesen, während die App gerade schreibt, wirft im Browser NotReadableError – dann kurz warten und erneut lesen
  const leseText = async n => { for (let i = 0; ; i++){ try{ return await page.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    return await (await (await p.getFileHandle('_Projekt.json')).getFile()).text(); }, n); }catch(e){ if (i > 20 || !/NotReadable|NotFound/.test(e.message)) throw e; await page.waitForTimeout(100); } } };
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
  assert.equal((await lese(EINS)).ortsterminZaehler, 2, 'Zähler im selben Patch angelegt');
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
  assert.equal((await lese(EINS)).ortsterminZaehler, 3, 'Zähler sinkt nicht beim Entfernen');
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
  assert.equal(d.ortsterminZaehler, 3, 'Zähler bleibt, wenn der letzte weitere Termin entfernt wird');
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
  // B legt außerdem einen Termin an (Kennung aus seinem alten Stand) – auch das überschreibt nichts
  await zweite.locator('#otNeu').click(); await zweite.locator('#pj_ot_t5_datum').waitFor(); await zweite.locator('#pj_ot_t5_datum').fill('2026-10-02');
  await zweite.waitForTimeout(1200);
  assert.deepEqual((await lese(EINS)).weitereOrtstermine, d.weitereOrtstermine, 'immer noch nichts überschrieben');
  if (process.env.SHOT){ await page.locator('#detail h2').scrollIntoViewIfNeeded(); await page.screenshot({ path: process.env.SHOT + '-liste.png' }); await zweite.screenshot({ path: process.env.SHOT + '-widerspruch.png' }); }
  await zweite.close();

  // 4b) Zähler: entfernen → neu anlegen ergibt nie dieselbe Kennung, auch wenn nichts sie mehr nennt (keine FotoKit-Datei)
  schritt = 'Zähler – nie dieselbe Kennung';
  const anlegen = async (pg, id, datum) => { await pg.locator('#otNeu').click(); await pg.locator(`#pj_ot_${id}_datum`).waitFor(); await pg.locator(`#pj_ot_${id}_datum`).fill(datum); };
  const entfernen = async (pg, id) => { await pg.locator(`[data-ot-weg="${id}"]`).click(); await pg.locator('#dlgBack.show #dYes').click(); };
  await oeffne(page, ZAEHL); await auf(page);
  await anlegen(page, 't2', '2026-08-20'); await gespeichert(page); await warte(async () => (await lese(ZAEHL)).ortsterminZaehler === 2, 'Z t2');
  await anlegen(page, 't3', '2026-08-21'); await gespeichert(page); await warte(async () => (await lese(ZAEHL)).ortsterminZaehler === 3, 'Z t3');
  await entfernen(page, 't3'); await warte(async () => (await lese(ZAEHL)).weitereOrtstermine.length === 1, 'Z t3 weg');
  assert.equal((await lese(ZAEHL)).ortsterminZaehler, 3);
  await anlegen(page, 't4', '2026-08-22'); await gespeichert(page); await warte(async () => (await lese(ZAEHL)).ortsterminZaehler === 4, 'Z t4');
  assert.equal(await page.locator('#pj_ot_t3_datum').count(), 0, 't3 nicht wieder vergeben');
  await entfernen(page, 't4'); await warte(async () => (await lese(ZAEHL)).weitereOrtstermine.length === 1, 'Z t4 weg');
  await entfernen(page, 't2'); await warte(async () => !('weitereOrtstermine' in await lese(ZAEHL)), 'Z alle weg');
  assert.equal((await lese(ZAEHL)).ortsterminZaehler, 4, 'Zähler bleibt ohne weitere Termine');
  await anlegen(page, 't5', '2026-09-01'); await gespeichert(page); await warte(async () => (await lese(ZAEHL)).ortsterminZaehler === 5, 'Z t5');
  assert.deepEqual((await lese(ZAEHL)).weitereOrtstermine.map(t => t.id), ['t5'], 'nach allem Entfernen t5, nicht t2');

  // 4c) Zwei Fenster legen gleichzeitig an (beide Entwürfe mit derselben Kennung) → das zweite bekommt einen Widerspruch
  schritt = 'zwei Fenster legen an';
  const b2 = await neueSeite(); await start(b2); await oeffne(b2, ZAEHL); await auf(b2);
  await page.locator('#otNeu').click(); await page.locator('#pj_ot_t6_datum').waitFor();
  await b2.locator('#otNeu').click(); await b2.locator('#pj_ot_t6_datum').waitFor();
  await page.locator('#pj_ot_t6_datum').fill('2026-09-02'); await gespeichert(page); await warte(async () => (await lese(ZAEHL)).ortsterminZaehler === 6, 'A t6');
  const nachA = await leseText(ZAEHL);
  await b2.locator('#pj_ot_t6_bezeichnung').fill('Freimessung');
  await b2.locator('#pj_ot_t6_datum').fill('2026-09-03');
  await b2.waitForFunction(() => /Projektdaten nicht gespeichert: Die Projektdaten wurden während des Speicherns geändert/.test(document.getElementById('pjAttention').textContent), null, { timeout: 8000 });
  assert.equal(await leseText(ZAEHL), nachA, 'B überschreibt weder Liste noch Zähler');
  assert.deepEqual((await lese(ZAEHL)).weitereOrtstermine.map(t => [t.id, t.datum]), [['t5', '2026-09-01'], ['t6', '2026-09-02']]);
  await b2.close();

  // 4d) Bestand ohne Zähler: aus allem rechnen (FotoKit nennt t5 → t6) und Zähler anlegen
  schritt = 'Bestand ohne Zähler';
  await oeffne(page, BESTAND); await auf(page);
  await anlegen(page, 't6', '2026-09-10'); await gespeichert(page); await warte(async () => (await lese(BESTAND)).ortsterminZaehler === 6, 'Bestand Zähler');
  assert.deepEqual((await lese(BESTAND)).weitereOrtstermine.map(t => t.id), ['t2', 't6']);
  // Bestand ohne Zähler, FotoKit-Datei nicht lesbar → nichts angelegt; mit Zähler → angelegt (FotoKit nicht mehr nötig)
  schritt = 'FotoKit nicht lesbar';
  await oeffne(page, KAPUTT); await auf(page);
  await page.locator('#otNeu').click();
  await page.waitForFunction(() => /Weiterer Ortstermin nicht angelegt: FotoKits „_Bildumbenenner\.json“ ist nicht lesbar/.test(document.getElementById('banner').textContent));
  assert.equal(await page.locator('#otBlock .ot-entwurf').count(), 0, 'kein Entwurf ohne Zähler');
  await page.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    const h = await p.getFileHandle('_Projekt.json'); const o = JSON.parse(await (await h.getFile()).text()); o.ortsterminZaehler = 4;
    const w = await h.createWritable(); await w.write(JSON.stringify(o)); await w.close(); }, KAPUTT);
  await oeffne(page, BESTAND); await oeffne(page, KAPUTT); await auf(page);
  await anlegen(page, 't5', '2026-09-11'); await gespeichert(page); await warte(async () => (await lese(KAPUTT)).ortsterminZaehler === 5, 'Kaputt mit Zähler');
  assert.deepEqual((await lese(KAPUTT)).weitereOrtstermine.map(t => t.id), ['t2', 't5']);
  // Projekte, die nie einen zweiten Termin hatten, bekommen den Zähler nicht
  for (const n of [BILDER, UEB1]) assert.ok(!('ortsterminZaehler' in await lese(n)), n);

  // 4e) Review #92, P1: Schreiben dauert länger als die 600 ms – Änderungen in der Zeit bauen auf dem Patch auf, der gerade geschrieben wird
  schritt = 'P1 – Änderung während des Speicherns';
  await page.evaluate(() => {
    window.__halt = false; window.__wartend = 0; window.__frei = []; window.__fehler = 0;
    const cw = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function(...a){
      if (this.name === '_Projekt.json' && window.__halt){ window.__wartend++; await new Promise(r => window.__frei.push(r)); }
      if (this.name === '_Projekt.json' && window.__fehler > 0){ window.__fehler--; throw new DOMException('Datei gesperrt (Test)', 'NoModificationAllowedError'); }
      return cw.apply(this, a);
    };
  });
  const halten = () => page.evaluate(() => { window.__halt = true; window.__wartend = 0; });
  const loslassen = () => page.evaluate(() => { window.__halt = false; window.__frei.splice(0).forEach(r => r()); });
  const gehalten = () => page.waitForFunction(() => window.__wartend > 0, null, { timeout: 8000 });
  await oeffne(page, LANGSAM); await auf(page);
  // a) Termin anlegen (wird geschrieben, hängt), sofort Bezeichnung ändern und einen zweiten Termin anlegen
  await halten();
  await anlegen(page, 't2', '2026-08-20'); await gehalten();
  await page.locator('#pj_ot_t2_bezeichnung').fill('Nachbeprobung');
  await page.waitForTimeout(800);   // zweiter Patch steht in der Schlange
  await page.locator('#otNeu').click();
  await page.locator('#pj_ot_t3_datum').waitFor({ timeout: 5000 });   // Kennung aus dem Zähler, der gerade geschrieben wird (sonst t2 doppelt)
  await page.locator('#pj_ot_t3_datum').fill('2026-08-21');
  assert.deepEqual((await zeilen(page)).map(z => z[1]), ['t1', 't2', 't3'], 'Liste zeigt alles, auch während des Schreibens');
  await loslassen();
  await warte(async () => { const d = await lese(LANGSAM); return (d.weitereOrtstermine || []).length === 2 && d.weitereOrtstermine[0].bezeichnung === 'Nachbeprobung'; }, 'beide Änderungen in der Datei');
  d = await lese(LANGSAM);
  assert.deepEqual(d.weitereOrtstermine, [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung', wer: '' }, { id: 't3', datum: '2026-08-21', bezeichnung: '', wer: '' }]);
  assert.equal(d.ortsterminZaehler, 3);
  // b) Entfernen hängt beim Schreiben, in der Zeit „Wer war da“ an t2 → t3 kommt nicht zurück, Zähler bleibt
  schritt = 'P1 – Entfernen während des Speicherns';
  await halten();
  await page.locator('[data-ot-weg="t3"]').click(); await page.locator('#dlgBack.show #dYes').click(); await gehalten();
  await page.locator('#pj_ot_t2_wer').fill('Ka');
  await page.waitForTimeout(800);
  await loslassen();
  await warte(async () => { const d = await lese(LANGSAM); return d.weitereOrtstermine.length === 1 && d.weitereOrtstermine[0].wer === 'Ka'; }, 't3 bleibt weg, Wer gespeichert');
  await page.waitForTimeout(500);
  d = await lese(LANGSAM);
  assert.deepEqual(d.weitereOrtstermine, [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung', wer: 'Ka' }]); assert.equal(d.ortsterminZaehler, 3);
  // c) Das erste Schreiben schlägt fehl, das zweite (baut darauf auf) gelingt: neuere Eingaben gewinnen je Termin – nichts Altes kommt zurück
  schritt = 'P1 – erstes Schreiben scheitert';
  await halten(); await page.evaluate(() => { window.__fehler = 1; });
  await anlegen(page, 't4', '2026-09-01'); await gehalten();
  await page.locator('#pj_ot_t4_bezeichnung').fill('Freimessung');
  await page.waitForTimeout(800);
  await loslassen();
  await warte(async () => ((await lese(LANGSAM)).weitereOrtstermine || []).length === 2, 'zweites Schreiben');
  await page.waitForTimeout(500);
  await page.locator('#pj_ot_t2_bezeichnung').fill('Nachbeprobung 2');   // noch ein Speichern: darf den alten Patch nicht zurückbringen
  await gespeichert(page); await warte(async () => (await lese(LANGSAM)).weitereOrtstermine[0].bezeichnung === 'Nachbeprobung 2', 'drittes Schreiben');
  d = await lese(LANGSAM);
  assert.deepEqual(d.weitereOrtstermine.map(t => [t.id, t.bezeichnung]), [['t2', 'Nachbeprobung 2'], ['t4', 'Freimessung']]);
  assert.equal(d.ortsterminZaehler, 4);

  // 4f) Review #92, P2: Entwurf ohne Datum in einem Projekt sperrt „+ Weiterer Ortstermin“ in einem anderen nicht; er bleibt beim alten Projekt
  schritt = 'P2 – Entwurf je Projekt';
  await oeffne(page, ZAEHL); await auf(page);
  await page.locator('#otNeu').click(); await page.locator('#otBlock .ot-entwurf').waitFor();
  const entwurfId = await page.locator('#otBlock .ot-entwurf').getAttribute('data-ot-zeile');
  await page.locator(`#pj_ot_${entwurfId}_bezeichnung`).fill('Entwurf A');
  await oeffne(page, BESTAND); await auf(page);
  await page.locator('#otNeu').click();
  await page.locator('#otBlock .ot-entwurf').waitFor({ timeout: 5000 });
  await page.locator('#otBlock .ot-entwurf [data-ot-weg]').click();
  await oeffne(page, ZAEHL); await auf(page);
  assert.equal(await page.locator(`#pj_ot_${entwurfId}_bezeichnung`).inputValue(), 'Entwurf A', 'Entwurf bleibt beim Projekt');
  await page.locator('#otBlock .ot-entwurf [data-ot-weg]').click();

  // 4g) Review #92, P2: Übergabe offen, zweiter Termin wird gespeichert → Liste neu gezeichnet, Zeile sagt es, Haken von Hand bleiben;
  //     abgesendet wird genau, was angehakt ist
  schritt = 'P2 – Übergabe';
  await page.evaluate(() => localStorage.setItem('spektron-ich', 'Ste'));
  await oeffne(page, UEB3);
  await page.locator('#goUebergabe').click();
  const reihe = n => page.locator(`#bueroPanel [data-ab-anl] input[data-ab-anl-rel="Fotos/${n}"]`);
  const B12 = 'Bilddokumentation_26.0709_Teststadt_2026-08-12.pdf', B20 = 'Bilddokumentation_26.0709_Teststadt_2026-08-20.pdf', SK = 'Skizze.pdf';
  await reihe(SK).waitFor();
  await page.waitForFunction(() => /2\._Mitteilung_/.test(document.querySelector('#bueroPanel [data-ab-word]')?.value || ''));
  assert.deepEqual([await reihe(B12).isChecked(), await reihe(B20).isChecked(), await reihe(SK).isChecked()], [true, true, true], 'ein Termin: alle PDFs in Fotos');
  await reihe(B20).uncheck();   // von Hand
  await auf(page); await anlegen(page, 't2', '2026-08-20'); await gespeichert(page);
  await page.waitForFunction(() => /^Vorauswahl geändert: weiterer Ortstermin/.test(document.querySelector('#bueroPanel [data-ab-anl-hinweis]')?.textContent || ''), null, { timeout: 8000 });
  assert.deepEqual([await reihe(B12).isChecked(), await reihe(B20).isChecked(), await reihe(SK).isChecked()], [false, false, false], 'neu gerechnet; B20 bleibt von Hand abgehakt');
  await reihe(SK).check();   // von Hand
  const angehakt = await page.locator('#bueroPanel [data-ab-anl] input[data-ab-anl-rel]').evaluateAll(l => l.filter(e => e.checked).map(e => e.dataset.abAnlRel));
  assert.deepEqual(angehakt, ['Fotos/' + SK]);
  await page.locator('[data-ab-los]').click();
  for (let i = 0; i < 40; i++){
    if (await page.locator('#dlgBack.show #dYes').count()) await page.locator('#dlgBack.show #dYes').click();
    if (/✓ Ans Büro übergeben|Nicht übergeben/.test(await page.locator('#bueroPanel [data-ab-msg]').textContent())) break;
    await page.waitForTimeout(150);
  }
  assert.match(await page.locator('#bueroPanel [data-ab-msg]').textContent(), /✓ Ans Büro übergeben/);
  const auftrag = await page.evaluate(async n => {
    const suche = async d => { for await (const [k, h] of d.entries()){ if (h.kind === 'directory'){ if (k === 'aufgaben'){ for await (const [, f] of h.entries()) return JSON.parse(await (await f.getFile()).text()); } const r = await suche(h); if (r) return r; } } return null; };
    return suche(await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n));
  }, UEB3);
  const inAufgabe = JSON.stringify(auftrag);
  assert.ok(inAufgabe.includes(JSON.stringify('Fotos/' + SK)), 'angehakte Zeile in der Aufgabe');
  for (const n of [B12, B20]) assert.ok(!inAufgabe.includes(JSON.stringify('Fotos/' + n)), 'nicht angehakt, nicht in der Aufgabe: ' + n);

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
  console.log(`OK (${name}): 1.53 weitere Ortstermine – ein Termin unverändert (Datei byte-gleich), Entwurf erst mit Datum gespeichert, ändern (auch Termin 1), Kopf „Ortstermine …“, Entfernen mit Rückfrage (FotoKit-Ordner und Bilddoku genannt, Abbrechen ändert nichts, FotoKit-Datei unberührt), Kennung nicht neu vergeben (Zähler ortsterminZaehler: sinkt nie, bleibt ohne weitere Termine, Bestand ohne Zähler, FotoKit-Datei mit Zähler nicht nötig), letzter entfernt → Feld weg, zwei Fenster ändern bzw. legen gleichzeitig an → Widerspruch ohne Überschreiben, Schreiben verzögert: Anlegen/Ändern/Entfernen bauen auf dem laufenden Patch auf (auch wenn er scheitert), Entwurf je Projekt, offene Übergabe zeichnet die Vorauswahl neu und sendet genau die angehakten Zeilen, „n Bilder“ mit Unterordnern, Übergabe hakt Bilddokus nach BerichtKit vor`);
})().catch(async e => {
  console.error(e);
  let zustand = '';
  try{ zustand = await seite.evaluate(() => ['aktiv=' + (document.querySelector('.proj.active')?.dataset.name || '–'), 'ot=' + (document.getElementById('otBlock')?.innerText || '–').replace(/\s+/g, ' ').slice(0, 160),
    'att=' + (document.getElementById('pjAttention')?.textContent || '–'), 'fokus=' + (document.activeElement?.id || '–')].join(' | ')); }catch(_){ zustand = 'Seite nicht lesbar'; }
  console.log(`::error title=Browsertest Ortstermine ${name}::${schritt}: ${String(e && e.message || e).split('\n')[0]} · ${zustand} · Seitenfehler: ${errors.join(' | ').slice(0, 300)}`); process.exit(1);
});
