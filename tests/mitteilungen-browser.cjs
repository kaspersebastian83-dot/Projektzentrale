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
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..'), fkRoot = path.join(root, '..', 'Bildumbenenner');
const KA = '26.0999 Teststadt Ka', EINS = '26.0998 Einzel Ka', ZWEI = '26.0997 Zwei Ka', LANG = '26.0996 Langsam Ka';
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
  await page.evaluate(async ([KA, EINS, ZWEI, LANG, PJ, PJ_KA, EINS_TEXT, docx]) => {
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
    await projekt(LANG, { ...PJ_KA, weitereMitteilungen: [{ id: 'm1', nr: 1, termine: ['t1'], auftraege: [] }, { id: 'm2', nr: 2, termine: ['t2'], auftraege: [] }], mitteilungZaehler: 2 },
      { zwei: true, labor: ['AR-001.pdf', 'AR-002.pdf', 'AR-003.pdf'], aufgabe: true, versandt: true, fk: fk('26.0996') });
  }, [KA, EINS, ZWEI, LANG, PJ, PJ_KA, EINS_TEXT, docx]);

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
  await page.locator('#bueroPanel [data-ab-los]').click();
  await page.locator('#bueroPanel [data-ab-msg]').filter({ hasText: '✓ Ans Büro übergeben' }).waitFor();
  const a = (await aufgaben(page, KA)).pop();
  assert.equal(a.word, 'Mitteilungen/2._Mitteilung_26.0999.docx');
  assert.deepEqual(a.anlagen, ['Laborergebnisse/AR-002.pdf', 'Laborergebnisse/AR-001.pdf', 'Fotos/Bilddokumentation_26.0999_Teststadt_2026-08-20.pdf', `Pläne/Probenplan ${KA} - 2. Termin.pdf`], 'in Nummernfolge');
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
  await b.close();
  console.log('OK 6 zwei Fenster legen gleichzeitig an → Widerspruch, Datei unverändert, neu gelesen');

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

  assert.deepEqual(errors, [], 'keine Fehler im Browser');
  await browser.close(); server.close();
  console.log(`OK (${name}): 1.54 Mitteilungen als Ebene – Bestand, Zuordnen, Anlagen von Hand, Link, Übergabe in Nummernfolge, eine Mitteilung unverändert, Angebot, zwei Fenster, Schreiben angehalten, FotoKit`);
})().catch(async e => { console.error('Schritt:', schritt); console.error(e); console.error('Fehler im Browser:', errors); process.exit(1); });
