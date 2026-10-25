// Datenarchiv im echten Browser: node tests/archiv-browser.cjs [chromium]
// Synthetischer Archivordner im OPFS (nur erfundene Orte und Werte): Eurofins-XML in „Laborergebnisse“, vorläufiger + endgültiger
// Bericht, Projekt nur mit PDF, Projekt ohne Projektdaten. Prüft Übersicht, Vergleich mit hervorgehobenem Projekt, PAK-Muster,
// Zuordnen (schreibt nur _Spektron-Archiv.json, Projektdaten unverändert), CSV ohne Orte, Zwischenspeicher, Link in der Projektzentrale.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');
const root = path.join(__dirname, '..');

const PAK = ['Naphthalin', 'Acenaphthylen', 'Acenaphthen', 'Fluoren', 'Phenanthren', 'Anthracen', 'Fluoranthen', 'Pyren', 'Benzo[a]anthracen',
  'Chrysen', 'Benzo[b]fluoranthen', 'Benzo[k]fluoranthen', 'Benzo[a]pyren', 'Indeno[1,2,3-cd]pyren', 'Dibenz[a,h]anthracen', 'Benzo[ghi]perylen'];
const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Eurofins-ähnliche XML; proben: [{ nr, art, f }] mit f = Faktor für ein festes PAK-Muster (einige Stoffe unter BG). */
function xml(code, proben, { vorlaeufig = false, einheit = 'µg/m²', lab = code } = {}){
  const lines = f => PAK.map((p, i) => [p, i < 3 ? '< 0,50' : String((i + 1) * f).replace('.', ',')]).concat([['Summe 16 EPA-PAK exkl. BG', String(PAK.slice(3).reduce((s, _, i) => s + (i + 4) * f, 0)).replace('.', ',')]])
    .map(([p, r]) => `<e:AnalyticalReportLine><e:ParameterName>${xe(p)}</e:ParameterName><e:Result>${xe(r)}</e:Result><e:Unit>${einheit}</e:Unit><e:LOQ>0,5</e:LOQ></e:AnalyticalReportLine>`).join('');
  return `<?xml version="1.0" encoding="utf-8"?><e:AnalyticalReport xmlns:e="urn:synthetic" AnalyticalReportCode="${code}"${vorlaeufig ? ' IsPreliminaryReport="true"' : ''}><e:Batches><e:Batch><e:Samples>${proben.map((p, i) =>
    `<e:SamplePartner><e:Description>${xe(p.nr)}</e:Description><e:SamplePartnerCode>${lab}-${i + 1}</e:SamplePartnerCode><e:SamplingDate>2026-10-07T22:00:00Z</e:SamplingDate><e:AdditionalFields Name="SAMPLETYPE"><e:Value>${p.art || 'Wischprobe'}</e:Value></e:AdditionalFields><e:AdditionalFields Name="SPLPT_NAME"><e:Value>${xe(p.desc || '')}</e:Value></e:AdditionalFields><e:Lines>${lines(p.f)}</e:Lines></e:SamplePartner>`).join('')}</e:Samples></e:Batch></e:Batches></e:AnalyticalReport>`;
}
const P = (n, f) => Array.from({ length: n }, (_, i) => ({ nr: 'P' + (i + 1), f: f * (1 + i / 4) }));
const PROJEKTE = [
  // Ordner, _Projekt.json, Dateien in Laborergebnisse
  ['26.0101 Musterdorf Abc', { nutzung: 'Wohnen', brandgut: 'Küche/Lebensmittel', schadenereignis: 'Brand in der Küche', objekt: 'Erfundene Str. 1', schadendatum: '2026-10-01' },
    { 'AR-1.xml': xml('AR-1', P(4, 1).map((p, i) => ({ ...p, desc: ['Brandraum Küche Decke', 'Flur Wand', 'Wohnzimmer Wand', 'Referenz OG unbelastet'][i] }))) }],   // Probenahme 08.10. = 7 Tage nach Brand
  ['26.0102 Beispielstadt Abc', { nutzung: 'Wohnen', brandgut: 'Küche/Lebensmittel' }, { 'AR-2.xml': xml('AR-2', [...P(3, 2), { nr: 'F-P1', f: 0.1, desc: 'Wohnzimmer nach Reinigung' }]), 'AR-2.pdf': '%PDF' }],   // F-P1 = Freimessung zu P1
  ['25.0103 Testheim Dr. Te', { nutzung: 'Gewerbe/Industrie', brandgut: 'Kunststoffe/PVC' }, { 'alt/AR-3.xml': xml('AR-3', P(3, 10)) }],
  ['25.0104 Vorort Abc', { nutzung: 'Büro' }, { 'AR-4v.xml': xml('AR-4v', [{ nr: 'P1', f: 50 }], { vorlaeufig: true, lab: 'AR-4' }), 'AR-4.xml': xml('AR-4', [{ nr: 'P1', f: 3 }]) }],
  ['24.0105 Ohnedaten', null, { 'AR-5.xml': xml('AR-5', [{ nr: 'P1', f: 1, art: 'Material' }, { nr: 'P2', f: 2, art: 'Material' }], { einheit: 'mg/kg TS' }) }],
  ['24.0106 Nurpdf', { nutzung: 'Wohnen' }, { 'bericht.pdf': '%PDF' }],
];

(async () => {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, ''); if (!rel || rel.endsWith('/')) rel += 'index.html';
    const p = path.join(root, rel);
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
    res.end(fs.readFileSync(p));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[process.argv[2] || 'chromium'].launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {});
  try{
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    await ctx.route(u => !u.href.startsWith(base), r => r.abort());
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('crash', () => console.log('RENDERER CRASH')); if (process.env.DEBUG) page.on('console', m => console.log('console:', m.text()));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(base + 'archiv/index.html');
    await page.evaluate(async projekte => {
      const r = await navigator.storage.getDirectory();
      for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
      const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
      const schreib = async (dir, name, text) => { const teile = name.split('/'); for (const t of teile.slice(0, -1)) dir = await dir.getDirectoryHandle(t, { create: true });
        const w = await (await dir.getFileHandle(teile.at(-1), { create: true })).createWritable(); await w.write(text); await w.close(); };
      for (const [name, pj, dateien] of projekte){
        const p = await archiv.getDirectoryHandle(name, { create: true });
        if (pj) await schreib(p, '_Projekt.json', JSON.stringify({ format: 'mosaik-projekt', version: 1, ...pj }));
        const lab = await p.getDirectoryHandle('Laborergebnisse', { create: true });
        for (const [n, t] of Object.entries(dateien)) await schreib(lab, n, t);
      }
      await archiv.getDirectoryHandle('_Projekt_Sicherungen', { create: true });   // kein Projektordner
      window.showDirectoryPicker = async () => archiv;   // Ordnerauswahl; die App merkt sich den Ordner wie gewohnt
    }, PROJEKTE);
    await page.click('#waehlen');
    await page.waitForFunction(() => /^Eingelesen/.test(document.getElementById('stand').textContent), null, { timeout: 15000 });
    assert.match(await page.locator('#stand').innerText(), /6 Projektordner/);

    // Übersicht
    const kacheln = await page.locator('.kachel').allInnerTexts();
    assert.match(kacheln[0], /^5\s+Projekte mit Laborwerten/);
    assert.match(kacheln[1], /^6\s+Prüfberichte/);
    assert.match(kacheln[2], /^14\s+Proben/, '4+4+3+1+2; vorläufige Probe P1 in 25.0104 ersetzt');
    assert.match(await page.locator('#ansicht').innerText(), /1 Projekte haben nur PDF-Berichte/);
    assert.equal(await page.locator('#offenZahl').innerText(), '2', '25.0104 ohne Brandgut, 24.0105 ohne Projektdaten');

    // Vergleich: Klick auf Benzo[a]pyren in der Parameterliste
    await page.locator('tr[data-key="Benzo[a]pyren|µg/m²"]').click();
    assert.equal(await page.locator('#vP').inputValue(), 'Benzo[a]pyren|µg/m²');
    const kenn = await page.evaluate(() => [...document.querySelectorAll('#ansicht table tbody tr')].map(tr => [...tr.children].map(c => c.innerText.trim()).join(' | ')));
    assert.deepEqual(kenn, [
      'Alle Werte | 11 | 0 | 32,5 | 163 | 195 | 4',          // BaP = 13 · f; Rangverfahren: 6. bzw. 10. von 11
      'Küche/Lebensmittel | 7 | 0 | 22,8 | 39 | 39 | 2',
      'Kunststoffe/PVC | 3 | 0 | zu wenige | – | 195 | 1',
      'ohne Angabe | 1 | 0 | zu wenige | – | 39 | 1'], 'vorläufiger Wert (650) zählt nicht; mg/kg getrennt');
    assert.equal(await page.locator('svg circle.pkt').count(), 22, 'je 11 in „Alle Werte“ und in den Gruppen');
    await page.selectOption('#vH', '26.0102 Beispielstadt Abc');
    assert.equal(await page.locator('svg circle.hp').count(), 6, 'Projekt in „Alle Werte“ und in seiner Gruppe hervorgehoben');
    await page.selectOption('#vP', 'Acenaphthen|µg/m²');
    assert.match(await page.locator('#ansicht table tbody tr').first().innerText(), /^Alle Werte\s+11\s+11\s+< BG\s+< BG/, 'alles unter BG: Kennzahl „< BG“, keine Null; Freimessung nicht mitgezählt');
    await page.selectOption('#vP', 'Benzo[a]pyren|µg/m²'); await page.selectOption('#vG', 'rolle');
    const rollen = await page.evaluate(() => [...document.querySelectorAll('#ansicht table tbody tr')].map(tr => tr.children[0].innerText.trim() + ' ' + tr.children[1].innerText.trim()));
    assert.deepEqual(rollen, ['Alle Werte 11', 'ohne Rolle 9', 'Brandbereich 1', 'Referenz (unbelastet) 1'], 'Rolle aus der Probenbeschreibung');
    await page.selectOption('#vR', 'alle'); assert.match(await page.locator('#ansicht table tbody').innerText(), /Freimessung nach Sanierung\s+1/);
    await page.selectOption('#vR', 'ohneFrei'); await page.selectOption('#vG', 'tage');
    { const t = await page.locator('#ansicht table tbody').innerText(); assert.match(t, /0–7 Tage\s+4\b/, 'nur 26.0101 hat ein Schadendatum'); assert.match(t, /Datum unbekannt\s+7\b/); }
    await page.selectOption('#vG', 'brandgut');
    if (process.env.SHOT){ await page.selectOption('#vP', 'Benzo[a]pyren|µg/m²'); await page.screenshot({ path: process.env.SHOT + '-vergleich.png', fullPage: true }); }

    // PAK-Muster
    await page.click('[data-reiter="muster"]');
    await page.selectOption('#mP', '26.0101 Musterdorf Abc');
    const zeilen = await page.locator('table.waerme tbody tr').allInnerTexts();
    assert.equal(zeilen.length, 5, '4 Proben + Vergleich');
    assert.match(zeilen[0], /13\/16 über BG · 7 Tage nach Brand/); assert.match(zeilen[0], /<BG/);
    assert.match(await page.locator('select.rolle[data-rprobe="AR-1-1"] option[value=""]').innerText(), /automatisch: Brandbereich/);
    assert.match(await page.locator('select.rolle[data-rprobe="AR-1-4"] option[value=""]').innerText(), /automatisch: Referenz/);
    assert.equal(await page.locator('table.waerme thead th.gem').count(), 13, 'gemeinsame Stoffe: alle außer Nap, Acy, Ace (unter BG)');
    assert.equal(await page.locator('table.sim tbody tr').first().locator('td').nth(2).innerText(), '1,000', 'gleiches Muster → 1,000');
    assert.match(zeilen[4], /Median aus 7 Proben anderer Projekte/);
    assert.equal(await page.locator('table.waerme td[data-t]').first().evaluate(td => !!td.style.background), true);
    const q = await page.$$eval('details.lit-q tbody tr:first-child td', tds => tds.slice(1).map(t => t.textContent.trim()).join(' '));
    assert.equal(q, '0,47 0,47 0,47 0,55', 'Flt 7/(7+8), BaA 9/(9+10), IcdP 14/(14+16), Ant 6/(6+5) – eingeklappt');
    assert.match(await page.locator('details.lit-q summary').innerText(), /nicht für Brandrückstände validiert/);
    // Abwählen einer Probe ändert die Vergleichsmenge nicht kaputt, Auswahl bleibt
    await page.locator('input[data-probe="AR-1-2|µg/m²"]').uncheck(); assert.equal(await page.locator('table.waerme tr.aus').count(), 1);
    await page.locator('input[data-probe="AR-1-2|µg/m²"]').check();
    // Freimessung: vorher / nachher über die ID ohne „F-“
    await page.selectOption('#mP', '26.0102 Beispielstadt Abc');
    assert.match(await page.locator('#ansicht').innerText(), /Freimessungen: vorher \/ nachher[\s\S]*P1 → F-P1\s+BaP\s+26\s+1,3[\s\S]*P1 → F-P1\s+Summe 16 EPA-PAK exkl\. BG\s+260\s+13\b/);
    assert.match(await page.locator('details.lit-q').textContent(), /Yunker/);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-muster.png', fullPage: true });

    // Zuordnen: schreibt nur _Spektron-Archiv.json
    const vorher = await page.evaluate(async () => { const a = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner');
      return (await (await (await a.getDirectoryHandle('25.0104 Vorort Abc')).getFileHandle('_Projekt.json')).getFile()).text(); });
    await page.click('[data-reiter="zuordnen"]');
    assert.equal(await page.locator('select[data-projekt]').count(), 3, '25.0104 Brandgut; 24.0105 Nutzung + Brandgut');
    await page.selectOption('select[data-projekt="25.0104 Vorort Abc"][data-feld="brandgut"]', 'Elektro/Geräte');
    await page.locator('.meldung', { hasText: 'Gespeichert' }).waitFor();
    await page.selectOption('select[data-projekt="24.0105 Ohnedaten"][data-feld="nutzung"]', 'Wohnen');
    await page.locator('.meldung', { hasText: 'Gespeichert' }).last().waitFor();
    const nachher = await page.evaluate(async () => { const a = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner');
      return { pj: await (await (await (await a.getDirectoryHandle('25.0104 Vorort Abc')).getFileHandle('_Projekt.json')).getFile()).text(),
        tags: JSON.parse(await (await (await a.getFileHandle('_Spektron-Archiv.json')).getFile()).text()) }; });
    assert.equal(nachher.pj, vorher, 'Projektdaten unverändert');
    assert.equal(nachher.tags.format, 'spektron-archiv');
    assert.equal(nachher.tags.projekte['25.0104 Vorort Abc'].brandgut, 'Elektro/Geräte');
    assert.equal(nachher.tags.projekte['24.0105 Ohnedaten'].nutzung, 'Wohnen');
    assert.equal(await page.locator('#offenZahl').innerText(), '1');
    // Rolle einer Probe korrigieren: nur in der eigenen Datei, Konvention bleibt sonst
    await page.selectOption('#zP', '26.0101 Musterdorf Abc');
    await page.selectOption('select.rolle[data-rprobe="AR-1-2"]', 'betroffen');
    await page.locator('.meldung', { hasText: 'Rolle gespeichert' }).waitFor();
    const rollenDatei = await page.evaluate(async () => { const a = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner');
      return JSON.parse(await (await (await a.getFileHandle('_Spektron-Archiv.json')).getFile()).text()).projekte['26.0101 Musterdorf Abc']; });
    assert.deepEqual(rollenDatei.rollen, { 'AR-1-2': 'betroffen' });

    // Vergleich übernimmt die Zuordnung
    await page.click('[data-reiter="vergleich"]'); await page.selectOption('#vP', 'Benzo[a]pyren|µg/m²');
    assert.match(await page.locator('#ansicht table tbody').innerText(), /Elektro\/Geräte\s+1/);

    // CSV
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    assert.ok(csv.startsWith('﻿Projekt;Jahr;Nutzung;Brandgut;'));
    assert.ok(csv.includes('25.0104;2025;Büro;Elektro/Geräte;AR-4-1;;;Wischprobe;Benzo[a]pyren;µg/m²;39;39;;0,5;AR-4;'));
    assert.ok(csv.includes('26.0101;2026;Wohnen;Küche/Lebensmittel;AR-1-1;Brandbereich;7;Wischprobe;Benzo[a]pyren;'), 'Rolle und Tage nach Brand');
    assert.ok(csv.includes('26.0101;2026;Wohnen;Küche/Lebensmittel;AR-1-2;betroffener Bereich;7;'), 'korrigierte Rolle');
    assert.ok(!csv.includes('Wohnzimmer') && !csv.includes('Brandraum Küche'), 'keine Probenbeschreibung im Export');
    for (const ort of ['Musterdorf', 'Beispielstadt', 'Erfundene Str', 'Vorort']) assert.ok(!csv.includes(ort), 'kein Ort im Export: ' + ort);

    // Erneutes Öffnen: Archivordner aus dem Suite-Speicher, gleiche Zahlen (Zwischenspeicher), Zuordnung bleibt.
    // OHNE_GESPEICHERTEN_ORDNER=1: für Sandbox-Chromium, das beim Zurücklesen eines OPFS-Ordners aus IndexedDB abstürzt (CI prüft es).
    if (!process.env.OHNE_GESPEICHERTEN_ORDNER){
    await page.reload();
    await page.waitForFunction(() => /^Eingelesen/.test(document.getElementById('stand').textContent), null, { timeout: 15000 });
    assert.match((await page.locator('.kachel').allInnerTexts())[2], /^14\s+Proben/);
    assert.equal(await page.locator('#offenZahl').innerText(), '1');
    }

    // Projektzentrale: kleiner Link unter „Weitere Apps“
    const pz = await (await browser.newContext()).newPage();
    await pz.goto(base + 'index.html'); await pz.waitForSelector('#btnInfo');
    const link = pz.locator('.more a.more-link');
    if (process.env.SHOT) await pz.locator('.more').screenshot({ path: process.env.SHOT + '-link.png' });
    assert.equal(await link.getAttribute('href'), 'archiv/'); assert.equal(await link.innerText(), 'Datenarchiv ↗');

    assert.deepEqual(errors, []);
    console.log('OK Datenarchiv: Einlesen, Übersicht, Vergleich, PAK-Muster, Zuordnen nur in eigener Datei, CSV ohne Orte, Zwischenspeicher, Link');
  }finally{ await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
