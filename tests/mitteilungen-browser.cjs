// 1.54: Mitteilungen als Ebene – node tests/mitteilungen-browser.cjs [chromium]
// Testprojekt „26.0999 Teststadt Ka“ (Befund F7, erfundene Daten): zwei Mitteilungen (1. beim Büro übergeben am 14.08., versandt 15.08.;
// 2. nicht übergeben), zwei Ortstermine, zwei Bilddokus (FotoKit 2.7.0 bilddokus je Termin), zwei Pläne, drei Prüfberichte.
//  1. Bestand (kein Eintrag): Zeile aus den Dateinamen, Vorwahl neueste nicht versandte, Kacheltexte je Mitteilung (✓ bleibt), Büro-Karte
//     mit Anlagen-Liste (ohne das, was mit der 1. hinausging), versandte Mitteilung nur ansehen, Wahl im Browser gemerkt, Öffnen schreibt nichts
//  2. Zuordnen: eine Rückfrage, Vorwahl nach der Übergabe am 14.08., schreibt m1 und m2 und den Zähler in einem Patch
//  3. Anlagen von Hand (weg, dazu, „auch in der 1. Mitteilung“) gespeichert; Link &mitteilung=m2 in die Apps; Sprung #…&mitteilung=m1
//  4. Übergabe der 2. Mitteilung: Anlagen in Nummernfolge; danach nur ansehen; Termin der übergebenen Mitteilung nicht entfernbar
//  5. Ein Projekt mit einer Mitteilung: keine Zeile, _Projekt.json byte-gleich; Übergabe in Nummernfolge (Entscheidung 7); Angebot
//     „2. Mitteilung beginnen …“ nach einem neuen Termin; Anlegen schreibt m1 und m2
//  6. Zwei Fenster legen gleichzeitig an → Widerspruch, Datei unverändert
//  7. Schreiben künstlich angehalten → zwei Änderungen an den Anlagen hintereinander, keine geht verloren
//  8. FotoKit 2.7.0 (../Bildumbenenner) speichert das Deckblatt – weitereMitteilungen und mitteilungZaehler bleiben
//     (ohne FotoKit daneben übersprungen – in der CI nie, FOTOKIT_PFLICHT)
//  9. 1.55 Laboraufträge je Mitteilung („26.0994 Auftrag Ka“: LabelKit-Datei von LabelKit 5.5.0 mit zwei Aufträgen, „_Ergebnisse.json“ von
//     ResultKit 2.7.0, 1. Mitteilung am 19.08. übergeben mit AR-26-0001-01, Einträge von 1.54.0 mit auftraege: []): Öffnen schreibt nichts,
//     gelbe Zeile „Gehört zu keiner Mitteilung: Auftrag 2 …“, Rückfrage mit Auftrags-Tabelle und Vorwahl, ein Patch; Prüfberichte getrennt,
//     Kacheltexte; BerichtKit-Zeile gelb (P9); Übernahme veraltet → Satz; neuer Auftrag und „+ Weiterer Ortstermin“ → gelbe Zeile; zwei
//     Fenster → Widerspruch; ein Auftrag („26.0993 EinAuftrag Ka“) → keine Tabelle, Datei byte-gleich; FotoKit speichert ohne Verlust von auftraege
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..'), fkRoot = path.join(root, '..', 'Bildumbenenner');
const KA = '26.0999 Teststadt Ka', EINS = '26.0998 Einzel Ka', ZWEI = '26.0997 Zwei Ka', LANG = '26.0996 Langsam Ka', FEHL = '26.0995 Fehler Ka';
const AUF = '26.0994 Auftrag Ka', EIN1 = '26.0993 EinAuftrag Ka';   // 1.55
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.json': 'application/json', '.png': 'image/png' };
const errors = [];
let schritt = 'Start';

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let base, rel;
    if (p.startsWith('/pz/')){ base = root; rel = p.slice(4); }
    else if (p.startsWith('/fk/')){ base = fkRoot; rel = p.slice(4); }
    else if (p.startsWith('/teamkit/')){ res.writeHead(200, { 'content-type': TYP['.html'] }); return res.end('<!doctype html><title>TeamKit Testziel</title>'); }
    else { res.writeHead(404); return res.end(); }
    const f = path.join(base, rel || 'index.html');
    if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYP[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = p => `http://127.0.0.1:${server.address().port}${p}`;
  const browser = await playwright[name].launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.SPEKTRON_START_TEST = '00.0000';
    try { localStorage.setItem('willkommen-gelesen', '1'); if (!localStorage.getItem('spektron-ich')) localStorage.setItem('spektron-ich', 'Ka'); } catch (_) {}
    const archiv = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner');
    window.showDirectoryPicker = async () => location.pathname.startsWith('/fk/') ? (await archiv()).getDirectoryHandle(sessionStorage.getItem('testProjekt')) : archiv();
  });
  const neueSeite = async (pfad = '/pz/index.html', projekt) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(pfad + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    page.on('dialog', d => { errors.push('natives Dialogfenster: ' + d.message()); d.dismiss(); });
    if (projekt) await page.addInitScript(n => sessionStorage.setItem('testProjekt', n), projekt);
    await page.goto(url(pfad));
    return page;
  };
  const page = await neueSeite();
  await page.waitForSelector('#btnInfo');
  const kann = await page.evaluate(async () => {
    if (!navigator.storage || !navigator.storage.getDirectory) return false;
    try{ const r = await navigator.storage.getDirectory(); const h = await r.getFileHandle('probe', { create: true }); if (!h.createWritable) return false; await r.removeEntry('probe'); return true; }catch(e){ return false; }
  });
  if (!kann){ assert.deepEqual(errors, []); await browser.close(); server.close(); console.log(`OK (${name}, ohne Ordnerzugriff: nur Laden geprüft)`); return; }

  // ---------- Archiv mit erfundenen Projekten ----------
  const docx = fs.readFileSync(path.join(__dirname, 'fixtures', '1._Mitteilung_fertig.docx')).toString('base64');
  const PJ = { format: 'mosaik-projekt', version: 1, hinweis: 'Gemeinsame Projektdaten', objekt: 'EFH, Testweg 9', auftraggeber: 'Muster Versicherung AG', ortstermin: '2026-08-12' };
  const PJ_KA = { ...PJ, weitereOrtstermine: [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung', wer: 'Ka' }], ortsterminZaehler: 2 };
  const EINS_TEXT = JSON.stringify({ ...PJ, ortstermin: '2026-08-12' }, null, 2) + '\n';
  await page.evaluate(async ([KA, EINS, ZWEI, LANG, FEHL, PJ, PJ_KA, EINS_TEXT, docx]) => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
    const pause = () => new Promise(res => setTimeout(res, 15));
    const put = async (d, n, t) => { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); await pause(); };
    const bin = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const sub = async (d, ...ns) => { for (const n of ns) d = await d.getDirectoryHandle(n, { create: true }); return d; };
    const aufgabe = async (p, id, o) => {
      const a = await sub(p, '_Buero', 'aufgaben');
      await put(a, id + '.json', JSON.stringify({ format: 'spektron-buerokit', version: 1, typ: 'aufgabe', id, erstellt: o.erstellt, von: 'Ka', projekt: { name: p.name, nr: p.name.slice(0, 7) },
        art: 'gutachten', titel: 'Gutachten', word: o.word, empfaenger: [{ id: 'versicherung', gruppe: 'versicherung', label: 'Auftraggeber', details: 'Muster Versicherung AG' }], anlagen: o.anlagen }));
      if (o.erledigt){ const v = await sub(p, '_Buero', 'vermerke'); await put(v, id + '-v1.json', JSON.stringify({ format: 'spektron-buerokit', version: 1, typ: 'vermerk', id: id + '-v1', aufgabe: id, zeit: o.erledigt, von: 'Nad', schritt: 'erledigt', wert: true })); }
    };
    const projekt = async (name, pj, o = {}) => {
      const nr = name.slice(0, 7), p = await sub(archiv, name);
      await put(p, '_Projekt.json', typeof pj === 'string' ? pj : JSON.stringify(pj, null, 2) + '\n');
      const m = await sub(p, 'Mitteilungen'), f = await sub(p, 'Fotos'), pl = await sub(p, 'Pläne'), l = await sub(p, 'Laborergebnisse');
      await put(m, `1._Mitteilung_${nr}.docx`, bin(docx));
      for (const n of o.labor || ['AR-001.pdf']) await put(l, n, '%PDF');
      await put(f, `Bilddokumentation_${nr}_Teststadt_2026-08-12.pdf`, '%PDF');
      await put(pl, `Probenplan ${name}.pdf`, '%PDF');
      if (o.zwei){
        await put(f, `Bilddokumentation_${nr}_Teststadt_2026-08-20.pdf`, '%PDF');
        await put(pl, `Probenplan ${name} - 2. Termin.pdf`, '%PDF');
        if (o.zweiteDatei !== false) await put(m, `2._Mitteilung_${nr}.docx`, bin(docx));
      }
      for (const [o2, ns] of [['fotos ka', ['IMG_0001.jpg']], ...(o.zwei ? [['fotos ka 20.08', ['IMG_0101.jpg']]] : [])]){ const d = await sub(f, o2); for (const n of ns) await put(d, n, 'x'); }
      if (o.fk) await put(f, '_Bildumbenenner.json', JSON.stringify(o.fk));
      if (o.anlage) await put(m, `${nr}_Titel_PN98_2026-08-21.docx`, 'Synthetic placeholder');
      if (o.aufgabe) await aufgabe(p, 'aufgabe-' + nr.replace('.', '-') + '-1', { erstellt: '2026-08-14T09:00:00.000Z', word: `Mitteilungen/1._Mitteilung_${nr}.docx`,
        anlagen: ['Laborergebnisse/AR-001.pdf', `Fotos/Bilddokumentation_${nr}_Teststadt_2026-08-12.pdf`, `Pläne/Probenplan ${name}.pdf`], erledigt: o.versandt ? '2026-08-15T10:00:00.000Z' : '' });
      return p;
    };
    const fk = nr => ({ format: 1, version: '2.7.0', bilder: {}, ordnerTermine: { 'fotos ka': { termin: 't1', am: '2026-08-13T10:00:00.000Z', vorschlag: 'hand' }, 'fotos ka 20.08': { termin: 't2', am: '2026-08-21T10:00:00.000Z', vorschlag: 'datum-im-namen' } },
      bilddokus: { t1: { dateien: [`Bilddokumentation_${nr}_Teststadt_2026-08-12.pdf`], erstellt: '2026-08-13T10:00:00.000Z', termin: { datum: '2026-08-12', bezeichnung: '' } },
        t2: { dateien: [`Bilddokumentation_${nr}_Teststadt_2026-08-20.pdf`], erstellt: '2026-08-21T10:00:00.000Z', termin: { datum: '2026-08-20', bezeichnung: 'Nachbeprobung' } } } });
    await projekt(KA, PJ_KA, { zwei: true, labor: ['AR-001.pdf', 'AR-002.pdf', 'AR-003.pdf'], fk: fk('26.0999'), aufgabe: true, versandt: true });
    await projekt(EINS, EINS_TEXT, { anlage: true });
    await projekt(ZWEI, PJ_KA, { zwei: true, zweiteDatei: false, aufgabe: true, versandt: true, fk: fk('26.0997') });
    await projekt(FEHL, PJ_KA, { zwei: true, zweiteDatei: false, aufgabe: true, versandt: true, fk: fk('26.0995') });
    await projekt(LANG, { ...PJ_KA, weitereMitteilungen: [{ id: 'm1', nr: 1, termine: ['t1'], auftraege: [] }, { id: 'm2', nr: 2, termine: ['t2'], auftraege: [] }], mitteilungZaehler: 2 },
      { zwei: true, labor: ['AR-001.pdf', 'AR-002.pdf', 'AR-003.pdf'], aufgabe: true, versandt: true, fk: fk('26.0996') });
  }, [KA, EINS, ZWEI, LANG, FEHL, PJ, PJ_KA, EINS_TEXT, docx]);

  // ---------- Hilfen ----------
  const start = async pg => { await pg.locator('#btnStart, #btnArchive').first().click(); await pg.locator(`.proj[data-name="${KA}"]`).waitFor(); };
  const leseText = async (pg, n, ...weg) => { for (let i = 0; ; i++){ try{ return await pg.evaluate(async ([n, weg]) => { let d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    for (const w of weg.slice(0, -1)) d = await d.getDirectoryHandle(w); return await (await (await d.getFileHandle(weg.at(-1))).getFile()).text(); }, [n, weg.length ? weg : ['_Projekt.json']]); }
    catch(e){ if (i > 20 || !/NotReadable|NotFound/.test(e.message)) throw e; await pg.waitForTimeout(100); } } };
  const lese = async (pg, n) => JSON.parse(await leseText(pg, n));
  const aufgaben = (pg, n) => pg.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    const out = [];
    for (const weg of [['_Buero'], ['_Spektron', 'Buero']]){   // bisheriger Ort oder „_Spektron/Buero“ (spektron-ordner.js)
      let a = p; try{ for (const w of [...weg, 'aufgaben']) a = await a.getDirectoryHandle(w); }catch(e){ continue; }
      for await (const [, h] of a.entries()) out.push(JSON.parse(await (await h.getFile()).text()));
    }
    return out.sort((x, y) => x.erstellt.localeCompare(y.erstellt)); }, n);
  const oeffne = async (pg, n) => {
    await pg.locator(`.proj[data-name="${n}"]`).click();
    await pg.waitForFunction(n => document.querySelector('.proj.active')?.dataset.name === n && document.querySelector('#bueroPanel')?.dataset.projekt === n
      && !/Wird gelesen/.test(document.querySelector('#bueroPanel [data-ab-stand]')?.textContent || 'Wird gelesen'), n);
    await pg.waitForTimeout(250);
  };
  const warte = async (pg, fn, was) => { for (let i = 0; i < 80; i++){ const v = await fn(); if (v) return v; await pg.waitForTimeout(100); } assert.fail('zu lange gewartet: ' + was + ' (' + schritt + ')'); };
  const ktext = (pg, k) => pg.locator(`[data-kachel="${k}"] [data-ktext]`).textContent();
  const kacheln = pg => pg.locator('#kacheln .kachel').evaluateAll(k => k.map(e => [e.dataset.kachel, e.classList.contains('fertig'), e.classList.contains('luecke'), e.querySelector('[data-ktext]').textContent]));
  const reiter = pg => pg.locator('#mtZeile .mt-tab').evaluateAll(t => t.map(e => [e.innerText.replace(/\s+/g, ' ').trim(), e.classList.contains('an')]));
  const liste = pg => pg.locator('#bueroPanel [data-mt-karte] table.mt-anl tr').evaluateAll(r => r.map(e => [...e.querySelectorAll('td')].slice(0, 4).map(td => td.textContent.replace(/\s+/g, ' ').trim())));
  const dialogOk = async pg => { await pg.locator('#dialog #dYes').click(); await pg.waitForFunction(() => !document.getElementById('dlgBack').classList.contains('show')); };


  // ---------- 1.55: Projekte mit Laboraufträgen (Vorlagen: LabelKit 5.5.0 im Browser, ResultKit 2.7.0 echte Module; erfundene Prüfberichte) ----------
  const vorlage = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
  const lkFuer = (n, datei) => vorlage(datei).replace(/26\.0999/g, n.slice(0, 7));
  await page.evaluate(async ([AUF, EIN1, PJ_KA, docx, lk2, lk1, ergA, ergE]) => {
    const archiv = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner');
    const pause = () => new Promise(res => setTimeout(res, 15));
    const put = async (d, n, t) => { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); await pause(); };
    const bin = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const sub = async (d, ...ns) => { for (const n of ns) d = await d.getDirectoryHandle(n, { create: true }); return d; };
    const projekt = async (name, lk, erg, o) => {
      const nr = name.slice(0, 7), p = await sub(archiv, name);
      await put(p, '_Projekt.json', JSON.stringify({ ...PJ_KA, weitereMitteilungen: [{ id: 'm1', nr: 1, termine: ['t1'], auftraege: [], angelegt: '2026-08-21T10:00:00.000Z', von: 'Ka' },
        { id: 'm2', nr: 2, termine: ['t2'], auftraege: [], angelegt: '2026-08-21T10:00:00.000Z', von: 'Ka' }], mitteilungZaehler: 2 }, null, 2) + '\n');
      const m = await sub(p, 'Mitteilungen'), f = await sub(p, 'Fotos'), pl = await sub(p, 'Pläne'), l = await sub(p, 'Laborergebnisse'), la = await sub(p, 'Laboraufträge');
      await put(m, `1._Mitteilung_${nr}.docx`, bin(docx)); await put(m, `2._Mitteilung_${nr}.docx`, bin(docx));
      for (const t of ['2026-08-12', '2026-08-20']) await put(f, `Bilddokumentation_${nr}_Teststadt_${t}.pdf`, '%PDF');
      await put(await sub(f, 'fotos ka'), 'IMG_0001.jpg', 'x');
      await put(f, '_Bildumbenenner.json', JSON.stringify({ format: 1, version: '2.7.0', bilder: {}, bilddokus: { t1: { dateien: [`Bilddokumentation_${nr}_Teststadt_2026-08-12.pdf`], erstellt: '2026-08-13T10:00:00.000Z' }, t2: { dateien: [`Bilddokumentation_${nr}_Teststadt_2026-08-20.pdf`], erstellt: '2026-08-21T10:00:00.000Z' } } }));
      await put(pl, `Probenplan ${name}.pdf`, '%PDF');
      for (const b of o.berichte) for (const x of ['.xml', '.pdf']) await put(l, b + x, x === '.pdf' ? '%PDF-' + b : '<xml>' + b + '</xml>');
      await put(la, `${nr}_Daten.json`, lk);
      // Stand der Übernahme wie ResultKit/Projektzentrale (Name|Größe|Zeit der XML/PDF und der LabelKit-Datei) – dann „passt“
      const stand = [];
      for await (const [n, h] of l.entries()) if (h.kind === 'file' && /\.(xml|pdf)$/i.test(n)){ const d = await h.getFile(); stand.push({ name: n, size: d.size, t: d.lastModified }); }
      const ld = await (await la.getFileHandle(`${nr}_Daten.json`)).getFile(); stand.push({ name: `Laboraufträge/${nr}_Daten.json`, size: ld.size, t: ld.lastModified });
      const e = JSON.parse(erg); e.dateien = stand; e.stand = [...stand].sort((a, b) => a.name.localeCompare(b.name)).map(d => `${d.name}|${d.size}|${d.t}`).join('\n');
      await put(l, '_Ergebnisse.json', JSON.stringify(e, null, 2));
      if (o.uebergabe){
        const a = await sub(p, '_Buero', 'aufgaben'), id = 'aufgabe-' + nr.replace('.', '-') + '-1';
        await put(a, id + '.json', JSON.stringify({ format: 'spektron-buerokit', version: 1, typ: 'aufgabe', id, erstellt: '2026-08-19T09:00:00.000Z', von: 'Ka', projekt: { name, nr },
          art: 'gutachten', titel: 'Gutachten', word: `Mitteilungen/1._Mitteilung_${nr}.docx`, empfaenger: [{ id: 'versicherung', gruppe: 'versicherung', label: 'Auftraggeber', details: 'Muster Versicherung AG' }],
          anlagen: ['Laborergebnisse/AR-26-0001-01.pdf', `Fotos/Bilddokumentation_${nr}_Teststadt_2026-08-12.pdf`, `Pläne/Probenplan ${name}.pdf`] }));
        const v = await sub(p, '_Buero', 'vermerke'); await put(v, id + '-v1.json', JSON.stringify({ format: 'spektron-buerokit', version: 1, typ: 'vermerk', id: id + '-v1', aufgabe: id, zeit: '2026-08-20T10:00:00.000Z', von: 'Nad', schritt: 'erledigt', wert: true }));
      }
    };
    await projekt(AUF, lk2, ergA, { berichte: ['AR-26-0001-01', 'AR-26-0002-01'], uebergabe: true });
    await projekt(EIN1, lk1, ergE, { berichte: ['AR-26-0001-01'] });
  }, [AUF, EIN1, PJ_KA, docx, lkFuer(AUF, 'labelkit-5.5.0-zwei-auftraege.json'), lkFuer(EIN1, 'labelkit-5.5.0-ein-auftrag.json'), vorlage('ergebnisse-2.7.0-A.json'), vorlage('ergebnisse-2.7.0-E.json')]);
  await start(page);

  // ---------- 1. Bestand: zwei Mitteilungen im Ordner, kein Eintrag ----------
  schritt = '1 Bestand';
  const vorher = await leseText(page, KA);
  await oeffne(page, KA);
  await page.locator('#mtZeile:not([hidden]) .mt-tab').first().waitFor();
  assert.deepEqual(await reiter(page), [['1. Mitteilung ✓ versandt 15.08.', false], ['2. Mitteilung Entwurf', true]], 'Vorwahl: neueste nicht versandte');
  assert.match(await page.locator('#mtZeile .mt-bezug').innerText(), /^Bezug der 2\. Mitteilung: nicht zugeordnet · zuordnen …$/);
  const kStand = await kacheln(page);
  assert.deepEqual(kStand.filter(k => ['fotos', 'labor', 'plan', 'bericht'].includes(k[0])).map(k => [k[0], k[2], k[3]]),
    [['fotos', false, 'Bilddoku in der Liste'], ['labor', false, '2 Prüfberichte in der Liste'], ['plan', false, 'Probenplan in der Liste'], ['bericht', false, '2. Mitteilung · Entwurf']]);
  // „Jetzt dran“: Labor ist Projektfakt (drei Prüfberichte, nicht übernommen – wie im Befund F7); die Büro-Stufe spricht von der 2.
  assert.equal(await page.locator('#jetzt b').textContent(), 'Laborergebnisse prüfen');
  assert.equal(await page.locator('[data-stufe=buero] [data-stext]').textContent(), 'Noch nicht übergeben', 'Büro-Stufe der 2. Mitteilung (heute: „Versandt 15.08.“ von der 1.)');
  assert.equal(await page.locator('#bueroPanel [data-ab-titel]').textContent(), '2. Mitteilung · Anlagen und Übergabe');
  assert.deepEqual(await liste(page), [
    ['Anlage 1', 'Prüfbericht', 'AR-002.pdf', 'noch in keiner Mitteilung'], ['Anlage 2', 'Prüfbericht', 'AR-003.pdf', 'noch in keiner Mitteilung'],
    ['Anlage 3', 'Bilddokumentation', 'Bilddokumentation_26.0999_Teststadt_2026-08-20.pdf', 'noch in keiner Mitteilung'],
    ['Anlage 4', 'Probenplan', `Probenplan ${KA} - 2. Termin.pdf`, 'noch in keiner Mitteilung']], 'ohne das, was mit der 1. Mitteilung hinausging');
  assert.ok(await page.locator('#bueroPanel [data-ab-anl-block]').isHidden(), 'Anlagen-Liste statt Vorhak-Liste');
  assert.match(await page.locator('#bueroPanel [data-mt-karte]').innerText(), /erst oben den Bezug zuordnen/);
  assert.equal(await page.locator('#bueroPanel [data-ab-word]').inputValue(), 'Mitteilungen/2._Mitteilung_26.0999.docx');
  // versandte Mitteilung: nur ansehen, aus der Büroaufgabe
  await page.locator('#mtZeile [data-mt="nr1"]').click();
  await warte(page, async () => (await ktext(page, 'bericht')) === '1. Mitteilung · versandt 15.08.', 'Kachel der 1. Mitteilung');
  assert.equal(await page.locator('[data-stufe=buero] [data-stext]').textContent(), 'Versandt 15.08.');
  assert.match(await page.locator('#bueroPanel [data-mt-karte]').innerText(), /^So versandt am 15\.08\.2026\nWord-Datei: 1\._Mitteilung_26\.0999\.docx\nEmpfänger: Auftraggeber: Muster Versicherung AG/);
  assert.deepEqual(await liste(page), [['Anlage 1', 'Prüfbericht', 'AR-001.pdf', 'mit der Übergabe festgehalten'], ['Anlage 2', 'Bilddokumentation', 'Bilddokumentation_26.0999_Teststadt_2026-08-12.pdf', 'mit der Übergabe festgehalten'],
    ['Anlage 3', 'Probenplan', `Probenplan ${KA}.pdf`, 'mit der Übergabe festgehalten']]);
  assert.ok(await page.locator('#bueroPanel [data-ab-form]').isHidden(), 'keine Hauptaktion');
  assert.equal(await page.locator('#bueroPanel [data-mt-weg]').count(), 0);
  assert.deepEqual((await kacheln(page)).map(k => k[1]), kStand.map(k => k[1]), 'das ✓ der Kacheln hängt nicht an der Wahl');
  // Wahl im Browser gemerkt (Entscheidung 10): neu laden → wieder die 1.
  await page.reload(); await page.waitForSelector('#btnInfo'); await start(page); await oeffne(page, KA);
  await page.locator('#mtZeile:not([hidden]) .mt-tab').first().waitFor();
  assert.deepEqual((await reiter(page)).map(r => r[1]), [true, false]);
  await page.locator('#mtZeile [data-mt="nr2"]').click();
  await warte(page, async () => (await ktext(page, 'bericht')) === '2. Mitteilung · Entwurf', 'zurück zur 2.');
  assert.equal(await leseText(page, KA), vorher, 'Öffnen und Wählen schreiben nichts');
  console.log('OK 1 Bestand: Zeile aus den Dateinamen, Vorwahl, Kacheltexte je Mitteilung (✓ bleibt), Anlagen-Liste ohne die feste Liste der 1., versandte nur ansehen, Wahl gemerkt, nichts geschrieben');

  // ---------- 2. Zuordnen: eine Rückfrage, m1 und m2 in einem Patch ----------
  schritt = '2 Zuordnen';
  await page.locator('#mtBezug').click();
  await page.locator('#dialog table.mtb').waitFor();
  assert.match(await page.locator('#dialog').innerText(), /Vorgewählt nach der Grenze: Termine nach der Übergabe am 14\.08\. gehören zur neueren Mitteilung/);
  const haken = () => page.locator('#dialog [data-mtb-spalte]').evaluateAll(i => i.map(e => [e.dataset.mtbSpalte, e.dataset.mtbTermin, e.checked, e.disabled]));
  assert.deepEqual(await haken(), [['nr1', 't1', true, false], ['nr2', 't1', false, false], ['nr1', 't2', false, false], ['nr2', 't2', true, false]]);
  await dialogOk(page);
  let d = await warte(page, async () => { const x = await lese(page, KA); return x.weitereMitteilungen && x; }, 'Einträge geschrieben');
  assert.deepEqual(d.weitereMitteilungen.map(e => [e.id, e.nr, e.termine, e.auftraege, typeof e.angelegt, e.von]), [['m1', 1, ['t1'], [], 'string', 'Ka'], ['m2', 2, ['t2'], [], 'string', 'Ka']]);
  assert.equal(d.mitteilungZaehler, 2);
  const ohne = x => { const { weitereMitteilungen, mitteilungZaehler, geaendert, geaendertMit, hinweis, projektnummer, schadenort, ...rest } = x; return rest; };   // was jedes Speichern setzt (pjBauen)
  assert.deepEqual(ohne(d), ohne(JSON.parse(vorher)), 'sonst nichts geändert');
  await warte(page, async () => /Bezug der 2\. Mitteilung: Termin 20\.08\. \(Nachbeprobung\) · ändern/.test(await page.locator('#mtZeile .mt-bezug').innerText()), 'Bezug gezeigt');
  assert.deepEqual((await reiter(page)).map(r => r[1]), [false, true], 'die gewählte bleibt (aus nr2 wird m2)');
  assert.equal(await ktext(page, 'fotos'), 'Bilddoku für 20.08. da');
  assert.equal((await liste(page))[2][3], 'aus Termin 20.08. (Nachbeprobung)');
  console.log('OK 2 Zuordnen: Rückfrage mit Vorwahl nach der Übergabe, m1 und m2 und Zähler in einem Patch, Bilddoku je Termin');

  // ---------- 3. Anlagen von Hand, Link in die Apps, Sprung ----------
  schritt = '3 von Hand';
  await page.locator('#bueroPanel [data-mt-weg="Laborergebnisse/AR-003.pdf"]').click();
  await page.locator('#bueroPanel [data-mt-dazu]').selectOption('Laborergebnisse/AR-001.pdf');
  await warte(page, async () => { const x = await lese(page, KA); const m2 = (x.weitereMitteilungen || [])[1] || {}; return (m2.anlagenWeg || []).length && (m2.anlagenDazu || []).length; }, 'von Hand gespeichert');
  d = await lese(page, KA);
  assert.deepEqual([d.weitereMitteilungen[1].anlagenWeg, d.weitereMitteilungen[1].anlagenDazu, d.mitteilungZaehler], [['Laborergebnisse/AR-003.pdf'], ['Laborergebnisse/AR-001.pdf'], 2]);
  assert.equal(d.weitereMitteilungen[0].anlagenDazu, undefined, 'die 1. bleibt, wie sie war');
  assert.deepEqual(await liste(page), [
    ['Anlage 1', 'Prüfbericht', 'AR-002.pdf', 'noch in keiner Mitteilung'], ['Anlage 2', 'Prüfbericht', 'AR-001.pdf', 'von Hand · auch in der 1. Mitteilung'],
    ['Anlage 3', 'Bilddokumentation', 'Bilddokumentation_26.0999_Teststadt_2026-08-20.pdf', 'aus Termin 20.08. (Nachbeprobung)'],
    ['Anlage 4', 'Probenplan', `Probenplan ${KA} - 2. Termin.pdf`, 'noch in keiner Mitteilung']]);
  assert.match(await page.locator('#bueroPanel [data-mt-karte]').innerText(), /Von Hand aus der Liste genommen: AR-003\.pdf zurücknehmen/);
  // Link: &mitteilung=m2 in die Apps (nur bei gezeigter Zeile)
  const sprung = async (pg, sel) => { await pg.evaluate(() => { window.__sprung = null; window.open = (_, target) => ({ location: { href: 'about:blank', assign: u => { window.__sprung = { url: u, target }; } }, focus(){} }); });
    await pg.locator(sel).click(); await pg.waitForFunction(() => window.__sprung !== null); return new URLSearchParams(new URL(await pg.evaluate(() => window.__sprung.url)).hash.slice(1)); };
  for (const sel of ['#goFotos', '#goLabel', '#goPlan', '#kBericht']) assert.equal((await sprung(page, sel)).get('mitteilung'), 'm2', sel);
  // Sprung aus einer App: #projekt=…&mitteilung=m1 wählt die 1.
  await page.evaluate(n => { location.hash = 'projekt=' + encodeURIComponent(n) + '&mitteilung=m1'; }, KA);
  await warte(page, async () => (await ktext(page, 'bericht')) === '1. Mitteilung · versandt 15.08.', 'Sprung mit mitteilung=m1');
  assert.equal((await sprung(page, '#goFotos')).get('mitteilung'), 'm1');
  await page.locator('#mtZeile [data-mt="m2"]').click();
  await warte(page, async () => (await ktext(page, 'bericht')) === '2. Mitteilung · Entwurf', 'wieder die 2.');
  console.log('OK 3 von Hand dazu/weg gespeichert (auch in der 1.), Link &mitteilung=m2 in die Apps, Sprung mit mitteilung=m1');

  // ---------- 4. Übergabe der 2. Mitteilung ----------
  schritt = '4 Übergabe';
  if (!await page.locator('#bueroPanel [data-ab-form]').evaluate(e => e.open)) await page.locator('#bueroPanel [data-ab-summary]').click();
  assert.equal(await page.locator('#bueroPanel [data-ab-summary]').textContent(), '2. Mitteilung ans Büro übergeben');
  assert.deepEqual(await page.locator('#bueroPanel [data-ab-word] option').allTextContents().then(o => o.map(x => x.split(' · ')[0])), ['2._Mitteilung_26.0999.docx'], 'nur die Word-Datei der 2.');
  // 4a (Codex-Review #94, Runde 3): ein anderes Fenster ändert die Anlagen, dieses hat noch den alten Stand → nicht übergeben, neu gelesen
  const c = await neueSeite(); await c.waitForSelector('#btnInfo'); await start(c); await oeffne(c, KA);
  await c.locator('#mtZeile [data-mt="m2"]').click();
  await c.locator('#bueroPanel [data-mt-weg="Laborergebnisse/AR-002.pdf"]').click();
  await warte(c, async () => ((await lese(c, KA)).weitereMitteilungen[1].anlagenWeg || []).length === 2, 'anderes Fenster gespeichert');
  await c.close();
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel .ab-msg.err').filter({ hasText: 'in einem anderen Fenster geändert' }).waitFor();
  assert.equal((await aufgaben(page, KA)).length, 1, 'nichts übergeben');
  await warte(page, async () => !(await liste(page)).some(r => r[2] === 'AR-002.pdf'), 'neuer Stand gezeigt');
  await page.locator('#bueroPanel [data-mt-zurueck="Laborergebnisse/AR-002.pdf"]').click();
  await warte(page, async () => ((await lese(page, KA)).weitereMitteilungen[1].anlagenWeg || []).length === 1, 'zurückgenommen');
  // 4b: eine zugeordnete Datei ist inzwischen weg → nicht übergeben, Datei genannt; zurückgelegt → geht
  const datei = async (op) => page.evaluate(async ([n, op]) => { const l = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n)).getDirectoryHandle('Laborergebnisse');
    if (op === 'weg') await l.removeEntry('AR-001.pdf'); else { const w = await (await l.getFileHandle('AR-001.pdf', { create: true })).createWritable(); await w.write('%PDF'); await w.close(); } }, [KA, op]);
  await datei('weg');
  if (!await page.locator('#bueroPanel [data-ab-form]').evaluate(e => e.open)) await page.locator('#bueroPanel [data-ab-summary]').click();
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel .ab-msg.err').filter({ hasText: '„AR-001.pdf“ liegt nicht mehr im Projektordner' }).waitFor();
  assert.equal((await aufgaben(page, KA)).length, 1, 'ohne die Datei nichts übergeben');
  await datei('zurueck');
  // 4c (Runde 4): inzwischen erstellt FotoKit für Termin 2 eine neue Bilddoku (bilddokus.t2) → die Liste ändert sich: erst zeigen
  const bdNeu = 'Bilddokumentation_26.0999_Teststadt_2026-08-20 (2).pdf';
  await page.evaluate(async ([n, bdNeu]) => { const f = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n)).getDirectoryHandle('Fotos');
    const put = async (x, t) => { const w = await (await f.getFileHandle(x, { create: true })).createWritable(); await w.write(t); await w.close(); };
    await put(bdNeu, '%PDF'); const fk = JSON.parse(await (await (await f.getFileHandle('_Bildumbenenner.json')).getFile()).text());
    fk.bilddokus.t2 = { ...fk.bilddokus.t2, dateien: [bdNeu], erstellt: new Date().toISOString() }; await put('_Bildumbenenner.json', JSON.stringify(fk)); }, [KA, bdNeu]);
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel .ab-msg.err').filter({ hasText: 'Die Anlagen-Liste hat sich inzwischen geändert' }).waitFor();
  assert.equal((await aufgaben(page, KA)).length, 1, 'geänderte Liste erst zeigen, nicht übergeben');
  assert.ok((await liste(page)).some(r => r[2] === bdNeu), 'neue Bilddoku gezeigt');
  // 4d (Runde 5): FotoKits Datei gerade nicht lesbar → nicht übergeben (nie mit dem alten Stand weiter); wieder lesbar → geht
  const fkDatei = async inhalt => page.evaluate(async ([n, inhalt]) => { const f = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n)).getDirectoryHandle('Fotos');
    const h = await f.getFileHandle('_Bildumbenenner.json'); if (inhalt == null) return (await h.getFile()).text(); const w = await h.createWritable(); await w.write(inhalt); await w.close(); }, [KA, inhalt]);
  const fkInhalt = await fkDatei(null);
  await fkDatei('{ kaputt');
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel .ab-msg.err').filter({ hasText: 'gerade nicht lesbar' }).waitFor();
  assert.match(await page.locator('#bueroPanel [data-ab-msg]').innerText(), /^Nicht übergeben: FotoKits „_Bildumbenenner\.json“ \(.+\) gerade nicht lesbar/);
  assert.equal((await aufgaben(page, KA)).length, 1, 'ohne frischen Stand nichts übergeben');
  await fkDatei(fkInhalt);
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel [data-ab-msg]').filter({ hasText: '✓ Ans Büro übergeben' }).waitFor();
  const a = (await aufgaben(page, KA)).pop();
  assert.equal(a.word, 'Mitteilungen/2._Mitteilung_26.0999.docx');
  assert.deepEqual(a.anlagen, ['Laborergebnisse/AR-002.pdf', 'Laborergebnisse/AR-001.pdf', 'Fotos/' + bdNeu, `Pläne/Probenplan ${KA} - 2. Termin.pdf`], 'in Nummernfolge');
  await warte(page, async () => (await ktext(page, 'bericht')) === '2. Mitteilung · beim Büro', 'beim Büro');
  assert.ok(await page.locator('#bueroPanel [data-ab-form]').isHidden());
  assert.match(await page.locator('#bueroPanel [data-mt-karte]').innerText(), /^Beim Büro seit \d\d\.\d\d\.\d{4} \(übergeben von Ka\)/);
  // Termin 2 steht in der übergebenen 2. Mitteilung: nicht entfernbar
  if (!await page.locator('#pjBox').evaluate(e => e.open)) await page.locator('#pjBox > summary').click();
  const vorEntfernen = await leseText(page, KA);
  await page.locator('[data-ot-weg="t2"]').click();
  await page.locator('#dialog h3').filter({ hasText: 'Ortstermin 2 nicht entfernbar' }).waitFor();
  assert.match(await page.locator('#dialog').innerText(), /gehört zur 2\. Mitteilung, die beim Büro ist/);
  await dialogOk(page);
  await page.waitForTimeout(800);
  assert.equal(await leseText(page, KA), vorEntfernen, 'nichts entfernt');
  console.log('OK 4 Übergabe der 2. Mitteilung in Nummernfolge, danach nur ansehen, Termin der übergebenen Mitteilung nicht entfernbar');

  // ---------- 5. Ein Projekt mit einer Mitteilung ----------
  schritt = '5 eine Mitteilung';
  await oeffne(page, EINS);
  assert.ok(await page.locator('#mtZeile').isHidden(), 'keine Zeile');
  assert.equal(await page.locator('#bueroPanel [data-ab-titel]').textContent(), 'Ans Büro');
  assert.ok(await page.locator('#bueroPanel [data-mt-karte]').isHidden());
  assert.ok(await page.locator('#mtBeginnen').count() === 1);
  assert.equal(await leseText(page, EINS), EINS_TEXT, '_Projekt.json byte-gleich');
  // Übergabe in Nummernfolge (Entscheidung 7): angehakt in der Liste Mitteilungen → Fotos → Pläne → Laborergebnisse
  if (!await page.locator('#bueroPanel [data-ab-form]').evaluate(e => e.open)) await page.locator('#bueroPanel [data-ab-summary]').click();
  for (const rel of ['Mitteilungen/26.0998_Titel_PN98_2026-08-21.docx', 'Pläne/Probenplan 26.0998 Einzel Ka.pdf', 'Laborergebnisse/AR-001.pdf']) await page.locator(`#bueroPanel [data-ab-anl-rel="${rel}"]`).check();
  assert.deepEqual(await page.locator('#bueroPanel [data-ab-anl] input:checked').evaluateAll(i => i.map(e => e.dataset.abAnlRel)),
    ['Mitteilungen/26.0998_Titel_PN98_2026-08-21.docx', 'Fotos/Bilddokumentation_26.0998_Teststadt_2026-08-12.pdf', 'Pläne/Probenplan 26.0998 Einzel Ka.pdf', 'Laborergebnisse/AR-001.pdf'], 'Oberfläche unverändert: Liste nach Ordnern');
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel [data-ab-msg]').filter({ hasText: '✓ Ans Büro übergeben' }).waitFor();
  assert.deepEqual((await aufgaben(page, EINS)).pop().anlagen, ['Laborergebnisse/AR-001.pdf', 'Fotos/Bilddokumentation_26.0998_Teststadt_2026-08-12.pdf', 'Pläne/Probenplan 26.0998 Einzel Ka.pdf', 'Mitteilungen/26.0998_Titel_PN98_2026-08-21.docx'],
    'gesendet in der Reihenfolge des Berichts');
  assert.equal(await leseText(page, EINS), EINS_TEXT, 'Übergabe ändert _Projekt.json nicht');
  assert.equal((await sprung(page, '#goFotos')).get('mitteilung'), null, 'eine Mitteilung: kein &mitteilung= im Link');
  // Angebot in „Jetzt dran“: nach der Übergabe ein neuer Ortstermin
  await warte(page, async () => /^Beim Büro/.test(await page.locator('[data-stufe=buero] [data-stext]').textContent()), 'beim Büro');
  assert.equal(await page.locator('#jetzt .mt-angebot').count(), 0, 'nichts Neues nach der Übergabe: kein Angebot');
  if (!await page.locator('#pjBox').evaluate(e => e.open)) await page.locator('#pjBox > summary').click();
  await page.locator('#otNeu').click(); await page.locator('#pj_ot_t2_datum').fill('2099-01-10');
  await warte(page, async () => (await lese(page, EINS)).weitereOrtstermine, 'Termin gespeichert');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('#jetzt .mt-angebot').waitFor();
  assert.match(await page.locator('#jetzt .mt-angebot').innerText(), /^Neu nach der Übergabe am \d\d\.\d\d\.: Ortstermin 10\.01\.2099\. 2\. Mitteilung beginnen …$/);
  assert.ok(await page.locator('#mtZeile').isHidden(), 'noch eine Mitteilung: keine Zeile');
  await page.locator('#jetzt .mt-angebot button').click();
  await page.locator('#dialog table.mtb').waitFor();
  assert.equal(await page.locator('#dialog h3').textContent(), '2. Mitteilung beginnen');
  assert.deepEqual(await haken(), [['nr1', 't1', true, false], ['neu', 't1', false, false], ['nr1', 't2', false, false], ['neu', 't2', true, false]], 'Vorwahl: Termin nach der Übergabe → 2.');
  await page.locator('#mtbAnlass').fill('Nachbeprobung');
  const vorAnlegen = await lese(page, EINS);
  assert.equal(vorAnlegen.weitereMitteilungen, undefined);
  await dialogOk(page);
  d = await warte(page, async () => { const x = await lese(page, EINS); return x.weitereMitteilungen && x; }, 'angelegt');
  // die 1. bekommt ihren Eintrag beim Anlegen der 2. (Entscheidung 2) – im selben Patch wie die 2. und der Zähler
  assert.deepEqual(d.weitereMitteilungen.map(e => [e.id, e.nr, e.termine, e.anlass]), [['m1', 1, ['t1'], undefined], ['m2', 2, ['t2'], 'Nachbeprobung']]);
  assert.equal(d.mitteilungZaehler, 2);
  await warte(page, async () => (await reiter(page)).length === 2, 'Zeile erscheint');
  assert.deepEqual(await reiter(page), [['1. Mitteilung beim Büro', false], ['2. Mitteilung in Arbeit', true]]);
  assert.equal(await ktext(page, 'bericht'), '2. Mitteilung · in Arbeit');
  assert.match(await page.locator('#bueroPanel [data-mt-karte]').innerText(), /Für die 2\. Mitteilung liegt noch keine Word-Datei/);
  assert.ok(await page.locator('#bueroPanel [data-ab-los]').isDisabled(), 'ohne Word-Datei keine Übergabe (Entscheidung 3)');
  console.log('OK 5 eine Mitteilung: keine Zeile, Datei byte-gleich, Übergabe in Nummernfolge, Angebot nach neuem Termin, Anlegen');

  // ---------- 6. Zwei Fenster legen gleichzeitig an ----------
  schritt = '6 zwei Fenster';
  const b = await neueSeite(); await b.waitForSelector('#btnInfo'); await start(b);
  await oeffne(page, ZWEI); await oeffne(b, ZWEI);
  for (const pg of [page, b]) await pg.locator('#jetzt .mt-angebot button').waitFor();
  await page.locator('#jetzt .mt-angebot button').click(); await page.locator('#dialog table.mtb').waitFor(); await dialogOk(page);
  d = await warte(page, async () => { const x = await lese(page, ZWEI); return x.weitereMitteilungen && x; }, 'erstes Fenster angelegt');
  const nachA = await leseText(page, ZWEI);
  assert.deepEqual(d.weitereMitteilungen.map(e => [e.id, e.termine]), [['m1', ['t1']], ['m2', ['t2']]]);
  await b.locator('#jetzt .mt-angebot button').click(); await b.locator('#dialog table.mtb').waitFor(); await dialogOk(b);
  await b.locator('#banner.err').filter({ hasText: 'in einem anderen Fenster geändert' }).waitFor();
  assert.match(await b.locator('#banner').innerText(), /^2\. Mitteilung nicht gespeichert: Die Mitteilungen wurden inzwischen in einem anderen Fenster geändert\. Nichts wurde überschrieben/);
  await b.waitForTimeout(800);
  assert.equal(await leseText(page, ZWEI), nachA, 'Datei unverändert – nichts überschrieben');
  await warte(b, async () => (await reiter(b)).length === 2, 'zweites Fenster hat neu gelesen');
  console.log('OK 6 zwei Fenster legen gleichzeitig an → Widerspruch, Datei unverändert, neu gelesen');
  // 6c. Zwei Fenster ändern die Anlagen derselben Mitteilung (Codex-Review #94, Runde 2): das zweite bekommt den Widerspruch,
  //     verwirft seine veraltete Liste, liest neu – danach geht die Änderung auf dem neuen Stand durch
  schritt = '6c zwei Fenster, Anlagen';
  await b.locator('#mtZeile .mt-tab').first().waitFor();
  await oeffne(page, ZWEI);
  const planZwei = `Pläne/Probenplan ${ZWEI} - 2. Termin.pdf`, bdAlt = 'Fotos/Bilddokumentation_26.0997_Teststadt_2026-08-12.pdf';
  await page.locator(`#bueroPanel [data-mt-weg="${planZwei}"]`).click();
  await warte(page, async () => ((await lese(page, ZWEI)).weitereMitteilungen[1].anlagenWeg || []).length, 'erstes Fenster gespeichert');
  const nachA2 = await leseText(page, ZWEI);
  // das Neu-Lesen nach dem Widerspruch künstlich anhalten: in der Zeit sind Änderungen gesperrt (Codex-Review #94, Runde 4)
  await b.evaluate(() => {
    window.__haltLesen = true; window.__liestNeu = false;
    const g = FileSystemFileHandle.prototype.getFile;
    FileSystemFileHandle.prototype.getFile = async function(...a){
      // nach dem gescheiterten Schreiben (Hinweis „nicht gespeichert“ steht schon oben) ist das nächste Lesen das Neu-Lesen
      if (this.name === '_Projekt.json' && window.__haltLesen && /nicht gespeichert/.test(document.getElementById('pjAttention').textContent)){ window.__liestNeu = true; await new Promise(r => { window.__weiter = r; }); }
      return g.apply(this, a);
    };
  });
  await b.locator('#bueroPanel [data-mt-dazu]').selectOption(bdAlt);
  await b.waitForFunction(() => window.__liestNeu, null, { timeout: 8000 });
  await b.locator(`#bueroPanel [data-mt-weg^="Fotos/"]`).first().click();
  assert.match(await b.locator('#banner').innerText(), /werden gerade neu gelesen – die Änderung ist nicht übernommen/);
  await b.evaluate(() => { window.__haltLesen = false; window.__weiter(); });
  await b.locator('#banner.err').filter({ hasText: 'Anlagen der Mitteilung nicht gespeichert' }).waitFor({ timeout: 8000 });
  await b.waitForTimeout(800);
  assert.equal(await leseText(page, ZWEI), nachA2, 'nichts überschrieben');
  await warte(b, async () => !(await liste(b)).some(r => r[2] === planZwei.split('/').pop()), 'zweites Fenster zeigt den neuen Stand');
  assert.ok(!(await liste(b)).some(r => r[2] === bdAlt.split('/').pop()), 'veraltete Änderung verworfen');
  await b.locator('#bueroPanel [data-mt-dazu]').selectOption(bdAlt);
  d = await warte(b, async () => { const x = await lese(b, ZWEI); return (x.weitereMitteilungen[1].anlagenDazu || []).length && x; }, 'auf dem neuen Stand gespeichert');
  assert.deepEqual([d.weitereMitteilungen[1].anlagenWeg, d.weitereMitteilungen[1].anlagenDazu], [[planZwei], [bdAlt]]);
  await b.close();
  console.log('OK 6c zwei Fenster ändern die Anlagen → Widerspruch, neu gelesen, danach gespeichert');

  // ---------- 6b. Schreiben scheitert ohne Widerspruch (Datei gesperrt): die Wahl bleibt erhalten (Codex-Review #94, P1) ----------
  schritt = '6b Schreibfehler';
  await oeffne(page, FEHL);
  const vorFehl = await leseText(page, FEHL);
  await page.evaluate(() => {
    window.__fehler = 1;
    const cw = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function(...a){
      if (this.name === '_Projekt.json' && window.__fehler > 0){ window.__fehler--; throw new DOMException('Datei gesperrt (Test)', 'NoModificationAllowedError'); }
      return cw.apply(this, a);
    };
  });
  await page.locator('#jetzt .mt-angebot button').click(); await page.locator('#dialog table.mtb').waitFor(); await dialogOk(page);
  await page.locator('#banner.err').filter({ hasText: 'noch nicht gespeichert' }).waitFor();
  assert.match(await page.locator('#banner').innerText(), /^2\. Mitteilung: noch nicht gespeichert \(Datei gesperrt \(Test\)\)\. Die Eingabe bleibt erhalten/);
  assert.equal(await leseText(page, FEHL), vorFehl, 'nichts geschrieben');
  assert.equal((await reiter(page)).length, 2, 'die Wahl ist noch da (nicht verworfen)');
  // nächste Eingabe speichert sie mit
  await page.evaluate(() => { const el = document.getElementById('pj_notizen'); el.value = 'Notiz nach dem Fehler'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  d = await warte(page, async () => { const x = await lese(page, FEHL); return x.weitereMitteilungen && x; }, 'mit der nächsten Eingabe gespeichert');
  assert.deepEqual([d.weitereMitteilungen.map(e => [e.id, e.termine]), d.mitteilungZaehler, d.notizen], [[['m1', ['t1']], ['m2', ['t2']]], 2, 'Notiz nach dem Fehler']);
  console.log('OK 6b Schreiben scheitert ohne Widerspruch → Eingabe bleibt, nächste Eingabe speichert sie');

  // ---------- 6d. Inzwischen zieht das Büro die Übergabe der 1. Mitteilung zurück (Runde 5): die frisch gelesenen Büroaufgaben gelten ----------
  schritt = '6d zurückgezogen';
  await page.evaluate(async ([n, docx]) => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    const w = await (await (await p.getDirectoryHandle('Mitteilungen')).getFileHandle('2._Mitteilung_26.0995.docx', { create: true })).createWritable(); await w.write(Uint8Array.from(atob(docx), c => c.charCodeAt(0))); await w.close(); }, [FEHL, docx]);
  await oeffne(page, KA); await oeffne(page, FEHL);
  await warte(page, async () => (await ktext(page, 'bericht')) === '2. Mitteilung · Entwurf', 'FEHL: 2. Mitteilung mit Word-Datei');
  assert.ok(!(await liste(page)).some(r => r[2] === 'AR-001.pdf'), 'AR-001 steckt in der übergebenen 1. Mitteilung');
  await page.evaluate(async n => { const v = await (await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n)).getDirectoryHandle('_Buero')).getDirectoryHandle('vermerke');
    const id = 'aufgabe-26-0995-1-zurueck', w = await (await v.getFileHandle(id + '.json', { create: true })).createWritable();
    await w.write(JSON.stringify({ format: 'spektron-buerokit', version: 1, typ: 'vermerk', id, aufgabe: 'aufgabe-26-0995-1', zeit: new Date().toISOString(), von: 'Nad', schritt: 'geloescht', wert: true })); await w.close(); }, FEHL);
  if (!await page.locator('#bueroPanel [data-ab-form]').evaluate(e => e.open)) await page.locator('#bueroPanel [data-ab-summary]').click();
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel .ab-msg.err').filter({ hasText: 'Die Anlagen-Liste hat sich inzwischen geändert' }).waitFor();
  assert.ok((await liste(page)).some(r => r[2] === 'AR-001.pdf'), 'nach dem Zurückziehen ist AR-001 wieder frei');
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel [data-ab-msg]').filter({ hasText: '✓ Ans Büro übergeben' }).waitFor();
  assert.ok((await aufgaben(page, FEHL)).pop().anlagen.includes('Laborergebnisse/AR-001.pdf'), 'übergeben mit dem frischen Stand');
  console.log('OK 6d zurückgezogene Übergabe: frische Büroaufgaben gelten vor dem Festschreiben');

  // ---------- 7. Schreiben künstlich angehalten ----------
  schritt = '7 Schreiben angehalten';
  await oeffne(page, LANG);
  await warte(page, async () => (await ktext(page, 'bericht')) === '2. Mitteilung · Entwurf', 'LANG: 2. gewählt');
  await page.evaluate(() => {
    window.__halt = false; window.__wartend = 0; window.__frei = [];
    const cw = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function(...a){
      if (this.name === '_Projekt.json' && window.__halt){ window.__wartend++; await new Promise(r => window.__frei.push(r)); }
      return cw.apply(this, a);
    };
  });
  await page.evaluate(() => { window.__halt = true; window.__wartend = 0; });
  await page.locator('#bueroPanel [data-mt-weg="Laborergebnisse/AR-003.pdf"]').click();
  await page.waitForFunction(() => window.__wartend > 0, null, { timeout: 8000 });   // erstes Schreiben hängt
  await page.locator('#bueroPanel [data-mt-dazu]').selectOption('Laborergebnisse/AR-001.pdf');
  await page.waitForTimeout(900);   // zweiter Patch steht in der Schlange
  assert.deepEqual((await liste(page)).map(r => r[2]), ['AR-002.pdf', 'AR-001.pdf', 'Bilddokumentation_26.0996_Teststadt_2026-08-20.pdf', `Probenplan ${LANG} - 2. Termin.pdf`], 'beide Änderungen sichtbar');
  await page.evaluate(() => { window.__halt = false; window.__frei.splice(0).forEach(r => r()); });
  await warte(page, async () => { const x = await lese(page, LANG); const m2 = x.weitereMitteilungen[1]; return (m2.anlagenDazu || []).length && m2; }, 'zweites Schreiben');
  await page.waitForTimeout(500);
  d = await lese(page, LANG);
  assert.deepEqual([d.weitereMitteilungen[1].anlagenWeg, d.weitereMitteilungen[1].anlagenDazu, d.mitteilungZaehler], [['Laborergebnisse/AR-003.pdf'], ['Laborergebnisse/AR-001.pdf'], 2], 'keine Eingabe verloren');
  console.log('OK 7 Schreiben angehalten: zweite Änderung baut auf der ersten auf, keine geht verloren');

  // ---------- 8. FotoKit 2.7.0 speichert danach ----------
  schritt = '8 FotoKit';
  if (!fs.existsSync(path.join(fkRoot, 'index.html'))){
    if (process.env.FOTOKIT_PFLICHT) assert.fail('FotoKit liegt nicht daneben (../Bildumbenenner) – in CI muss der Teil laufen');
    console.log('SKIP 8: FotoKit liegt nicht daneben (../Bildumbenenner)');
  } else {
    const fkVersion = (/APP_VERSION = '([\d.]+)'/.exec(fs.readFileSync(path.join(fkRoot, 'index.html'), 'utf8')) || [])[1];
    const fk = await neueSeite('/fk/index.html', KA);
    await fk.waitForFunction(() => !document.body.inert); await fk.waitForTimeout(300);
    await fk.click('#btnOpen2');
    const ruhig = () => fk.waitForFunction(() => !document.body.inert && !document.querySelector('#overlay').classList.contains('show') && !/Lese Ordner/.test(document.getElementById('banner').textContent));
    await ruhig();
    const vorFk = await lese(page, KA);
    await fk.click('#btnPdf'); await fk.locator('#zOk').waitFor();
    await fk.locator('#m_objekt').fill('EFH, Testweg 9 (Anbau)'); await fk.locator('#zCancel').click(); await ruhig();
    const nachFk = await warte(page, async () => { const x = await lese(page, KA); return x.objekt === 'EFH, Testweg 9 (Anbau)' && x; }, 'FotoKit hat gespeichert');
    assert.match(nachFk.geaendertMit || '', /FotoKit/);
    assert.deepEqual([nachFk.weitereMitteilungen, nachFk.mitteilungZaehler], [vorFk.weitereMitteilungen, vorFk.mitteilungZaehler], 'FotoKit erhält weitereMitteilungen und mitteilungZaehler');
    await fk.close();
    console.log(`OK 8 FotoKit ${fkVersion} speichert das Deckblatt – weitereMitteilungen und mitteilungZaehler bleiben`);
  }


  // ---------- 9. 1.55 Laboraufträge je Mitteilung ----------
  schritt = '9 Laboraufträge';
  {
    const vorAuf = await leseText(page, AUF);
    await oeffne(page, AUF);
    await page.locator('#mtZeile:not([hidden]) .mt-tab').first().waitFor();
    // Bestand von 1.54.0 (auftraege: []): Auftrag 1 kommt aus der übergebenen 1. Mitteilung (gerechnet), Auftrag 2 gehört zu keiner
    await warte(page, async () => /Gehört zu keiner Mitteilung: Auftrag 2 \(22\.08\.\) – zuordnen …/.test(await page.locator('#mtZeile').innerText()), 'gelbe Zeile');
    assert.match(await page.locator('#mtZeile .mt-bezug').innerText(), /^Bezug der 2\. Mitteilung: Termin 20\.08\. \(Nachbeprobung\) · kein Laborauftrag zugeordnet · ändern$/);
    assert.deepEqual(await page.locator('#otFrei').evaluate(e => [e.hidden, e.textContent]), [true, ''], 'unter den Ortsterminen erst mit einem neuen Termin');
    assert.deepEqual((await liste(page)).filter(r => r[1] === 'Prüfbericht'), [['Anlage 1', 'Prüfbericht', 'AR-26-0002-01.pdf', 'noch in keiner Mitteilung · Auftrag 2 keiner Mitteilung zugeordnet']]);
    assert.deepEqual([await ktext(page, 'proben'), (await kacheln(page)).find(k => k[0] === 'proben')[2]], ['kein Laborauftrag zugeordnet', true]);
    assert.equal(await leseText(page, AUF), vorAuf, 'Öffnen schreibt nichts');
    // Rückfrage: Auftrags-Tabelle, 1. gesperrt „aus der Übergabe“, Vorwahl nach dem Auftragsdatum, ein Patch
    await page.locator('#mtFreiZu').click();
    await page.locator('#dialog [data-mtb-auftraege]').waitFor();
    const aHaken = pg => pg.locator('#dialog [data-mtb-auftrag]').evaluateAll(i => i.map(e => [e.dataset.mtbSpalte, e.dataset.mtbAuftrag, e.checked, e.disabled]));
    assert.deepEqual(await aHaken(page), [['m1', 'a1', true, true], ['m2', 'a1', false, false], ['m1', 'a2', false, true], ['m2', 'a2', true, false]]);
    assert.deepEqual(await page.locator('#dialog [data-mtb-auftraege] td.mtb-auftrag').allTextContents(), ['Auftrag 1 · 14.08. · 13 Proben (P1–P13) · Probenahme 12.08.', 'Auftrag 2 · 22.08. · 8 Proben (P14–P21) · Probenahme 20.08.']);
    assert.match(await page.locator('#dialog').innerText(), /Auftrag 2 vom 22\.08\. liegt nach der Übergabe am 19\.08\. → 2\. Mitteilung/);
    assert.equal(await page.locator('#dialog [data-mtb-auftrag="a1"][data-mtb-spalte="m1"]').getAttribute('title'), 'aus der Übergabe – gerechnet aus den festgehaltenen Prüfberichten');
    await page.evaluate(() => { window.__pjSchreiben = 0; const cw = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = async function(...a){ if (this.name === '_Projekt.json') window.__pjSchreiben++; return cw.apply(this, a); }; });
    // zweites Fenster (vorher geöffnet, alter Stand) – für den Widerspruch unten
    const b2 = await neueSeite(); await b2.waitForSelector('#btnInfo'); await start(b2); await oeffne(b2, AUF);
    await dialogOk(page);
    let dA = await warte(page, async () => { const x = await lese(page, AUF); return x.weitereMitteilungen[1].auftraege.length && x; }, 'Aufträge geschrieben');
    assert.deepEqual(dA.weitereMitteilungen.map(e => [e.id, e.termine, e.auftraege]), [['m1', ['t1'], []], ['m2', ['t2'], ['a2']]], 'm2 = [a2]; m1 bleibt (gesperrt, gerechnet)');
    assert.equal(dA.mitteilungZaehler, 2);
    assert.equal(await page.evaluate(() => window.__pjSchreiben), 1, 'ein Patch');
    const ohne = x => { const { weitereMitteilungen, mitteilungZaehler, geaendert, geaendertMit, hinweis, projektnummer, schadenort, ...rest } = x; return rest; };
    assert.deepEqual(ohne(dA), ohne(JSON.parse(vorAuf)), 'sonst nichts geändert');
    await warte(page, async () => /· Auftrag 2 \(22\.08\.\) · ändern$/.test(await page.locator('#mtZeile .mt-bezug').innerText()), 'Bezug mit Auftrag');
    assert.equal(await page.locator('#mtZeile [data-mt-frei]').count(), 0, 'gelbe Zeile weg');
    assert.deepEqual((await liste(page)).filter(r => r[1] === 'Prüfbericht'), [['Anlage 1', 'Prüfbericht', 'AR-26-0002-01.pdf', 'aus Auftrag 2']], 'nur der Prüfbericht von Auftrag 2');
    assert.equal(await ktext(page, 'proben'), '8 Proben · Auftrag 2 vom 22.08.');
    assert.equal(await ktext(page, 'labor'), 'Auftrag 2: 8 von 8 mit Ergebnis · 1 Prüfbericht in der Liste');
    await page.locator('#mtZeile [data-mt="m1"]').click();
    await warte(page, async () => (await ktext(page, 'proben')) === '13 Proben · Auftrag 1 vom 14.08.', 'Kachel der 1.');
    assert.match(await page.locator('#mtZeile .mt-bezug').innerText(), /Auftrag 1 \(14\.08\.\) aus der Übergabe/);
    await page.locator('#mtZeile [data-mt="m2"]').click();
    await warte(page, async () => (await ktext(page, 'proben')) === '8 Proben · Auftrag 2 vom 22.08.', 'zurück zur 2.');
    assert.equal((await sprung(page, '#goLabel')).get('mitteilung'), 'm2', 'Link zu LabelKit mit der Mitteilung (wählt dort Auftrag 2 vor)');
    // zwei Fenster: das andere hat noch den alten Stand → Widerspruch, nichts überschrieben
    const nachA = await leseText(page, AUF);
    await b2.locator('#mtFreiZu').click(); await b2.locator('#dialog [data-mtb-auftraege]').waitFor();
    await b2.locator('#dialog [data-mtb-auftrag="a1"][data-mtb-spalte="m2"]').check();
    await dialogOk(b2);
    await b2.locator('#banner.err').filter({ hasText: 'in einem anderen Fenster geändert' }).waitFor();
    await b2.waitForTimeout(800);
    assert.equal(await leseText(page, AUF), nachA, 'zwei Fenster: Datei unverändert');
    await b2.close();
    console.log('OK 9a Laboraufträge: Bestand gelb, Rückfrage mit Auftrags-Tabelle (gesperrt aus der Übergabe, Vorwahl nach Auftragsdatum), ein Patch, Prüfberichte getrennt, Kacheltexte, Link, zwei Fenster');

    // P9: BerichtKit nennt für die 2. Mitteilung auch AR-26-0001-01 (Auftrag 1, 1. Mitteilung) → gelb, bleibt stehen
    schritt = '9b P9';
    await page.evaluate(async n => { const m = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n)).getDirectoryHandle('Mitteilungen');
      const w = await (await m.getFileHandle('_BerichtKit.json', { create: true })).createWritable();
      await w.write(JSON.stringify({ format: 'spektron-bericht', version: 1, berichte: [{ datei: '2._Mitteilung_26.0994.docx', am: '2026-08-26T10:00:00.000Z', art: 'brand', anlagen: ['Laborergebnisse/AR-26-0001-01.pdf', 'Laborergebnisse/AR-26-0002-01.pdf'] }] })); await w.close(); }, AUF);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await warte(page, async () => (await liste(page)).some(r => /laut Laborauftrag 1 zur 1\. Mitteilung – in BerichtKit abwählen oder hier entfernen/.test(r[3])), 'BerichtKit-Zeile gelb');
    assert.deepEqual((await liste(page)).filter(r => r[1] === 'Prüfbericht').map(r => [r[2], r[3]]), [['AR-26-0001-01.pdf', 'aus BerichtKit · auch in der 1. Mitteilung · laut Laborauftrag 1 zur 1. Mitteilung – in BerichtKit abwählen oder hier entfernen'], ['AR-26-0002-01.pdf', 'aus BerichtKit']]);
    assert.equal(await page.locator('#bueroPanel tr.mt-warn').count(), 1);
    await page.locator('#bueroPanel [data-mt-weg="Laborergebnisse/AR-26-0001-01.pdf"]').click();
    await warte(page, async () => ((await lese(page, AUF)).weitereMitteilungen[1].anlagenWeg || []).length === 1, 'hier entfernt');
    assert.equal(await page.locator('#bueroPanel tr.mt-warn').count(), 0);
    await page.evaluate(async n => { const m = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n)).getDirectoryHandle('Mitteilungen'); await m.removeEntry('_BerichtKit.json'); }, AUF);
    console.log('OK 9b P9: Prüfbericht aus BerichtKit, der laut Auftrag zur 1. gehört, gelb – entfernt nur von Hand');

    // Übernahme veraltet (Prüfbericht geändert) → Grund statt Zuordnung, Kachel sagt es
    schritt = '9c veraltet';
    const datei = (ordner, n, t) => page.evaluate(async ([p, ordner, n, t]) => { const d = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(p)).getDirectoryHandle(ordner);
      if (t == null) return (await (await d.getFileHandle(n)).getFile()).text(); const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); }, [AUF, ordner, n, t]);
    await datei('Laborergebnisse', 'AR-26-0002-01.pdf', '%PDF-geaendert');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await warte(page, async () => (await ktext(page, 'labor')) === 'Auftrag 2: seit der Übernahme geändert – in ResultKit übernehmen', 'Kachel veraltet');
    assert.deepEqual((await liste(page)).filter(r => r[1] === 'Prüfbericht').map(r => r[3]), ['noch in keiner Mitteilung · Auftrag unbekannt: ResultKit-Übernahme veraltet – in ResultKit erneut übernehmen'], 'nie raten');
    console.log('OK 9c Übernahme veraltet → wie bisher mit Satz, Kachel „seit der Übernahme geändert“');

    // neuer Auftrag 3 in LabelKit und „+ Weiterer Ortstermin“ → gelbe Zeile (Mitteilungs-Zeile und unter den Ortsterminen), nichts springt auf
    schritt = '9d neu';
    const lk = JSON.parse(await datei('Laboraufträge', '26.0994_Daten.json'));
    lk.proben.push({ ...lk.proben[0], id: 99, _nr: 22, datum: '2026-09-05', nrFest: { am: '2026-09-07T10:00:00.000Z', anlass: 'Abschluss' }, auftrag: 'a3' });
    lk.weitereAuftraege.push({ id: 'a3', am: '2026-09-07', von: 'Ka', proben: [22] }); lk.auftragZaehler = 3;
    await datei('Laboraufträge', '26.0994_Daten.json', JSON.stringify(lk, null, 2));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await warte(page, async () => /Gehört zu keiner Mitteilung: Auftrag 3 \(07\.09\.\) – zuordnen …/.test(await page.locator('#mtZeile').innerText()), 'neuer Auftrag gelb');
    // Übernahme noch veraltet: Auftrag 1 (vor der Übergabe der 1.) ist nicht „frei“, sondern „gerade unbekannt“ – mit Grund
    assert.equal(await page.locator('#mtZeile [data-mt-unklar]').innerText(), 'Auftrag 1: Zuordnung zur übergebenen 1. Mitteilung gerade unbekannt – ResultKit-Übernahme veraltet – in ResultKit erneut übernehmen');
    if (!await page.locator('#pjBox').evaluate(e => e.open)) await page.locator('#pjBox > summary').click();
    const vorT3 = await lese(page, AUF);
    await page.locator('#otNeu').click(); await page.locator('#pj_ot_t3_datum').fill('2026-09-05');
    await warte(page, async () => ((await lese(page, AUF)).weitereOrtstermine || []).length === 2, 'Termin 3 gespeichert');
    await warte(page, async () => /Gehört zu keiner Mitteilung: Termin 3 \(05\.09\.\) · Auftrag 3 \(07\.09\.\) – zuordnen …/.test(await page.locator('#otFrei').innerText()), 'Zeile unter den Ortsterminen');
    await warte(page, async () => /^Gehört zu keiner Mitteilung: Termin 3 \(05\.09\.\) · Auftrag 3 \(07\.09\.\) – zuordnen …$/.test(await page.locator('#mtZeile [data-mt-frei]').innerText()), 'Zeile in der Mitteilungs-Zeile');
    assert.equal(await page.locator('#dlgBack.show').count(), 0, 'kein Fenster springt auf');
    assert.deepEqual((await lese(page, AUF)).weitereMitteilungen, vorT3.weitereMitteilungen, 'nichts still zugeordnet');
    await page.locator('#otFreiZu').click(); await page.locator('#dialog [data-mtb-auftraege]').waitFor();
    assert.deepEqual((await aHaken(page)).filter(h => h[1] === 'a3'), [['m1', 'a3', false, true], ['m2', 'a3', true, false]], 'Auftrag 3 nach dem Datum vorgewählt');
    await dialogOk(page);
    dA = await warte(page, async () => { const x = await lese(page, AUF); return x.weitereMitteilungen[1].auftraege.length === 2 && x; }, 'Auftrag 3 zugeordnet');
    assert.deepEqual(dA.weitereMitteilungen.map(e => [e.termine, e.auftraege]), [[['t1'], []], [['t2', 't3'], ['a2', 'a3']]]);
    await warte(page, async () => (await page.locator('#otFrei').evaluate(e => e.hidden)), 'Zeile weg');
    console.log('OK 9d neuer Auftrag und „+ Weiterer Ortstermin“ → gelbe Zeile hier und unter den Ortsterminen, zuordnen …, nichts still');

    // ein Auftrag (LabelKit Runde 1): keine Tabelle, Datei byte-gleich, auftraege bleibt []
    schritt = '9e ein Auftrag';
    const vorEin = await leseText(page, EIN1);
    await oeffne(page, EIN1);
    await page.locator('#mtZeile:not([hidden]) .mt-tab').first().waitFor();
    await page.waitForTimeout(400);
    assert.equal(await leseText(page, EIN1), vorEin, '_Projekt.json byte-gleich');
    assert.equal(await page.locator('#mtZeile [data-mt-frei]').count(), 0);
    assert.doesNotMatch(await page.locator('#mtZeile .mt-bezug').innerText(), /Auftrag/);
    assert.doesNotMatch(await ktext(page, 'proben'), /Auftrag \d|Laborauftrag zugeordnet/, 'Proben-Kachel wie bisher');
    assert.deepEqual((await liste(page)).filter(r => r[1] === 'Prüfbericht').map(r => r[3]), ['noch in keiner Mitteilung · auch in der 1. Mitteilung'], 'wie bisher (beide offen: in beiden), ohne Satz');
    await page.locator('#mtBezug').click(); await page.locator('#dialog table.mtb').waitFor();
    assert.equal(await page.locator('#dialog [data-mtb-auftraege]').count(), 0, 'keine Auftrags-Tabelle');
    await page.locator('#dialog [data-mtb-termin="t2"][data-mtb-spalte="m1"]').check();
    await dialogOk(page);
    const dE = await warte(page, async () => { const x = await lese(page, EIN1); return x.weitereMitteilungen[0].termine.length === 2 && x; }, 'Bezug geändert');
    assert.deepEqual(dE.weitereMitteilungen.map(e => e.auftraege), [[], []], 'auftraege bleibt []');
    console.log('OK 9e ein Laborauftrag: keine Tabelle, Datei nach dem Öffnen byte-gleich, auftraege bleibt []');

    // echtes FotoKit 2.7.0 speichert danach – auftraege bleibt
    schritt = '9f FotoKit';
    if (fs.existsSync(path.join(fkRoot, 'index.html'))){
      const fk = await neueSeite('/fk/index.html', AUF);
      await fk.waitForFunction(() => !document.body.inert); await fk.waitForTimeout(300);
      // FotoKit hat den Ordner aus Teil 8 wieder geöffnet: „Mehr …“ › „Anderen Ordner öffnen …“ (die Aktion hinter dem Menü)
      if (await fk.locator('#btnOpen2').isVisible()) await fk.click('#btnOpen2'); else await fk.evaluate(() => document.getElementById('btnOpen').click());
      await fk.waitForFunction(n => document.body.textContent.includes(n.slice(0, 7)), AUF);
      const ruhig = () => fk.waitForFunction(() => !document.body.inert && !document.querySelector('#overlay').classList.contains('show') && !/Lese Ordner/.test(document.getElementById('banner').textContent));
      await ruhig();
      const vorFk = await lese(page, AUF);
      await fk.click('#btnPdf'); await fk.locator('#zOk').waitFor();
      await fk.locator('#m_objekt').fill('EFH, Testweg 9 (Nachauftrag)'); await fk.locator('#zCancel').click(); await ruhig();
      const nachFk = await warte(page, async () => { const x = await lese(page, AUF); return x.objekt === 'EFH, Testweg 9 (Nachauftrag)' && x; }, 'FotoKit hat gespeichert');
      assert.deepEqual(nachFk.weitereMitteilungen, vorFk.weitereMitteilungen, 'FotoKit erhält auftraege');
      assert.deepEqual(nachFk.weitereMitteilungen[1].auftraege, ['a2', 'a3']);
      await fk.close();
      console.log('OK 9f FotoKit speichert – weitereMitteilungen[].auftraege bleibt');
    } else if (process.env.FOTOKIT_PFLICHT) assert.fail('FotoKit liegt nicht daneben (../Bildumbenenner)');
  }
  assert.deepEqual(errors, [], 'keine Fehler im Browser');
  await browser.close(); server.close();
  console.log(`OK (${name}): 1.54 Mitteilungen als Ebene – Bestand, Zuordnen, Anlagen von Hand, Link, Übergabe in Nummernfolge, eine Mitteilung unverändert, Angebot, zwei Fenster, Schreiben angehalten, FotoKit; 1.55 Laboraufträge je Mitteilung`);
})().catch(async e => { console.error('Schritt:', schritt); console.error(e); console.error('Fehler im Browser:', errors); process.exit(1); });
