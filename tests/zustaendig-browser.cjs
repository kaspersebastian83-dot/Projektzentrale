// Zuständige Person aus dem Projektordner: node tests/zustaendig-browser.cjs [chromium|webkit]
// Mitarbeiterliste anlegen, Ordnername deuten, Dropdown „Zuständig“ in _Projekt.json, „Meine Projekte“, unlesbare Liste, Konflikt.
// Archivordner im Origin Private File System nachgebildet; nur erfundene Kürzel und Namen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..');
const A = '26.0142 Teststadt Abc', B = '26.0150 Musterweg 3 Koeln Dr. Te'   // ohne Umlaut: OPFS in Chromium listet Namen mit „ö“ nicht auf (nur Testumgebung)
const B_ORT = 'Musterweg 3 Koeln', C = '26.0151 Aachen';
const MA = '_Spektron-Mitarbeiter.json';

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await playwright[name].launch();
  try{
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForSelector('#btnInfo');
    const kann = await page.evaluate(async () => {
      try{ const r = await navigator.storage.getDirectory(); const h = await r.getFileHandle('probe', { create: true }); if (!h.createWritable) return false; await r.removeEntry('probe'); return 'showDirectoryPicker' in window; }catch(e){ return false; }
    });
    if (!kann){ assert.deepEqual(errors, []); console.log(`OK (${name}, ohne Ordnerzugriff: nur Laden geprüft)`); return; }

    // Archiv mit drei Projekten; A hat schon Projektdaten mit einem Feld einer anderen App
    await page.evaluate(async ([a, b, c]) => {
      const r = await navigator.storage.getDirectory();
      for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
      const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
      for (const n of [a, b, c]) await archiv.getDirectoryHandle(n, { create: true });
      const pa = await archiv.getDirectoryHandle(a), fh = await pa.getFileHandle('_Projekt.json', { create: true }), w = await fh.createWritable();
      await w.write(JSON.stringify({ format: 'mosaik-projekt', version: 1, projektnummer: '26.0142', schadenort: 'Teststadt Abc', objekt: 'EFH Testweg 1', fremdeApp: { bleibt: true } }));
      await w.close();
      window.showDirectoryPicker = async () => archiv;
    }, [A, B, C]);
    const liesDatei = (ordner, datei) => page.evaluate(async ([o, d]) => {
      const r = await navigator.storage.getDirectory(); let h = await r.getDirectoryHandle('Mosaik Archivordner');
      if (o) h = await h.getDirectoryHandle(o);
      try{ return await (await (await h.getFileHandle(d)).getFile()).text(); }catch(e){ return null; }
    }, [ordner, datei]);
    const schreibeDatei = (datei, text) => page.evaluate(async ([d, t]) => {
      const a = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner');
      const w = await (await a.getFileHandle(d, { create: true })).createWritable(); await w.write(t); await w.close();
    }, [datei, text]);
    const zeile = n => page.locator(`.proj[data-name="${n}"]`);
    const projektPj = async () => JSON.parse(await liesDatei(A, '_Projekt.json'));

    await page.locator('#btnStart, #btnArchive').first().click();
    await zeile(A).waitFor();
    // 1) ohne Mitarbeiterliste: nichts wird abgetrennt, Hinweis im Projektkopf
    assert.equal((await zeile(A).locator('.ort').textContent()).trim(), 'Teststadt Abc');
    await zeile(A).click();
    await page.locator('.zust').waitFor();
    assert.match(await page.locator('.zust').textContent(), /noch keine Mitarbeiterliste/);
    assert.equal(await page.locator('#ich').isDisabled(), true);

    // 2) Mitarbeiterliste anlegen, mit Eingabeprüfung
    await page.click('#btnMa');
    await page.locator('.ma-tab').waitFor();
    const reihe = i => page.locator('.ma-tab tbody tr').nth(i);
    await reihe(0).locator('.maK').fill('Abc'); await reihe(0).locator('.maN').fill('Anna Beispiel'); await reihe(0).locator('.maA').fill('Abc');
    await page.click('#maAdd');
    await reihe(1).locator('.maK').fill('abc'); await reihe(1).locator('.maN').fill('Doppelt');
    await page.click('#maOk');
    assert.match(await page.locator('#maErr').textContent(), /doppelt/);
    await reihe(1).locator('.maK').fill('Dr. Te'); await reihe(1).locator('.maN').fill('Dr. Tea Test'); await reihe(1).locator('.maA').fill('T.E');
    await page.click('#maOk');
    assert.match(await page.locator('#maErr').textContent(), /App-Kürzel/);
    assert.equal(await liesDatei('', MA), null, 'bei Fehlern wird nichts geschrieben');
    await reihe(1).locator('.maA').fill('TE');
    await page.click('#maAdd'); await page.click('#maOk');   // leere neue Zeile wird ignoriert
    await page.locator('#dlgBack.show').waitFor({ state: 'hidden' });
    const ma = JSON.parse(await liesDatei('', MA));
    assert.equal(ma.format, 'spektron-mitarbeiter'); assert.equal(ma.version, 1);
    assert.deepEqual(ma.personen.map(p => [p.ordnerKuerzel, p.name, p.appKuerzel, p.aktiv]), [['Abc', 'Anna Beispiel', 'Abc', true], ['Dr. Te', 'Dr. Tea Test', 'TE', true]]);

    // 3) Ordnernamen jetzt von hinten gelesen
    const ortOhneKuerzel = z => z.locator('.ort').evaluate(e => e.firstChild.textContent.trim());
    assert.equal(await ortOhneKuerzel(zeile(A)), 'Teststadt');
    assert.equal(await zeile(A).locator('.ort .wer').textContent(), 'Abc');
    assert.equal(await ortOhneKuerzel(zeile(B)), B_ORT);
    assert.equal(await zeile(B).locator('.ort .wer').textContent(), 'Dr. Te');
    assert.equal(await zeile(C).locator('.ort .wer').count(), 0);
    assert.match(await page.locator('#detail h2').textContent(), /26\.0142\s+Teststadt$/);
    const zust = page.locator('#zust');
    assert.equal(await zust.inputValue(), '__ordner');
    assert.match(await zust.locator('option:checked').textContent(), /Anna Beispiel \(Abc\) – aus Ordnername/);
    assert.equal(await page.locator('#pj_sachverstaendiger').getAttribute('placeholder'), 'Vorschlag: Anna Beispiel');
    assert.equal(await page.locator('#pj_sachverstaendiger').inputValue(), '', 'Vorschlag wird nicht still eingetragen');

    // 4) andere Person wählen → _Projekt.json, fremde Felder bleiben, Schadenort ohne Kürzel
    await zust.selectOption('Dr. Te');
    await page.locator('#zustHinweis', { hasText: 'Ordnername: Abc' }).waitFor();
    let pj = await projektPj();
    assert.equal(pj.zustaendig.kuerzel, 'Dr. Te'); assert.equal(pj.zustaendig.gesetzt, 'manuell'); assert.ok(pj.zustaendig.am);
    assert.deepEqual(pj.fremdeApp, { bleibt: true }); assert.equal(pj.objekt, 'EFH Testweg 1');
    assert.equal(pj.schadenort, 'Teststadt');
    assert.equal(await zeile(A).locator('.ort .wer').textContent(), 'Dr. Te');
    // „keine Angabe“ und zurück auf den Ordnernamen
    await zust.selectOption('__keine');
    await page.locator('#zust').waitFor();
    for (let i = 0; i < 40 && (await projektPj()).zustaendig?.kuerzel !== ''; i++) await page.waitForTimeout(50);
    assert.equal((await projektPj()).zustaendig.kuerzel, '');
    assert.equal(await zeile(A).locator('.ort .wer').count(), 0);
    await page.locator('#zust').selectOption('__ordner');
    for (let i = 0; i < 40 && 'zustaendig' in (await projektPj()); i++) await page.waitForTimeout(50);
    pj = await projektPj();
    assert.equal('zustaendig' in pj, false, 'Wie Ordnername entfernt die manuelle Auswahl');
    assert.deepEqual(pj.fremdeApp, { bleibt: true });
    // die gleiche Person wie im Ordner wird nicht als Abweichung gespeichert
    await page.locator('#zust').selectOption('Abc');
    await page.waitForTimeout(400);
    assert.equal('zustaendig' in (await projektPj()), false);

    // 5) Ich bin … und Meine Projekte
    assert.equal(await page.locator('#btnMeine').isDisabled(), true);
    await page.selectOption('#ich', 'Abc');
    await page.click('#btnMeine');
    assert.equal(await page.locator('#btnMeine').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await page.locator('.proj').evaluateAll(es => es.map(e => e.dataset.name)), [A]);
    assert.match(await page.locator('.count').first().textContent(), /nur meine \(Anna Beispiel\)/);
    await zeile(A).click(); await page.locator('#zust').selectOption('Dr. Te');
    await zeile(A).waitFor({ state: 'detached' });
    await page.click('#btnMeine');
    assert.equal(await page.locator('.proj').count(), 3);
    await page.reload(); await page.waitForSelector('#btnInfo');
    assert.equal(await page.evaluate(() => localStorage.getItem('spektron-ich')), 'Abc', 'Ich bin wird gemerkt');

    // 6) unlesbare Mitarbeiterliste: Warnung, keine Abtrennung, Dialog nur Ansicht, Datei unverändert
    await schreibeDatei(MA, '{kaputt');
    await page.evaluate(async () => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner'); });
    await page.locator('#btnStart, #btnArchive, #btnGrant').first().click();
    await zeile(C).waitFor();
    await page.locator('#banner.show.err', { hasText: 'nicht lesbar' }).waitFor();
    assert.equal(await zeile(A).locator('.ort .wer').count(), 1, 'manuelle Zuständigkeit aus _Projekt.json bleibt sichtbar');
    assert.equal((await zeile(B).locator('.ort').textContent()).trim(), 'Musterweg 3 Koeln Dr. Te');
    await page.click('#btnMa'); await page.locator('#maNo').waitFor();
    assert.equal(await page.locator('#maOk').count(), 0);
    await page.click('#maNo');
    assert.equal(await liesDatei('', MA), '{kaputt');

    // 7) Konflikt: ein anderer Rechner ändert die Liste, während der Dialog offen ist
    await schreibeDatei(MA, JSON.stringify(ma));
    await page.click('#btnRescan'); await zeile(C).waitFor();
    await page.click('#btnMa'); await page.locator('.ma-tab').waitFor();
    const fremd = JSON.stringify({ ...ma, personen: [...ma.personen, { ordnerKuerzel: 'Neu', name: 'Neue Person', aktiv: true }] });
    await schreibeDatei(MA, fremd);
    await reihe(0).locator('.maN').fill('Anna Geändert');
    await page.click('#maOk');
    await page.locator('#maErr', { hasText: 'inzwischen an einem anderen Rechner geändert' }).waitFor({ timeout: 8000 });
    assert.equal(await liesDatei('', MA), fremd, 'fremde Änderung wird nicht überschrieben');
    await page.click('#maNo');

    assert.deepEqual(errors, []);
    console.log(`OK Zuständig (${name}): Liste, Prüfung, Ordnername, Dropdown/_Projekt.json, Meine Projekte, unlesbare Liste, Konflikt`);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
