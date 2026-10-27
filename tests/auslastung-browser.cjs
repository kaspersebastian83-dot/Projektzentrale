// Auslastung: node tests/auslastung-browser.cjs [chromium]
// Offene Projekte je Person und Schritt (in Bearbeitung / beim Büro / Rückfrage), laufendes und voriges Jahr,
// erledigtes Gutachten beim Büro = nicht offen, zurückgezogenes zählt nicht, manuelle Zuständigkeit, inaktive Person,
// ohne erkannte Person, Projektliste per Klick, ohne Mitarbeiterliste. Archiv im OPFS; nur erfundene Namen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const root = path.join(__dirname, '..');
const yy = new Date().getFullYear() % 100, f = n => String(n).padStart(2, '0');
const J = f(yy), V = f((yy + 99) % 100), A = f((yy + 98) % 100);
const LISTE = { format: 'spektron-mitarbeiter', version: 1, personen: [
  { ordnerKuerzel: 'Abc', appKuerzel: 'AB', name: 'Anna Beispiel', aktiv: true },
  { ordnerKuerzel: 'Dr. Te', appKuerzel: 'TE', name: 'Dr. Tea Test', aktiv: true },
  { ordnerKuerzel: 'Alt', appKuerzel: 'ALT', name: 'Ehemalig', aktiv: false },
  { ordnerKuerzel: 'Neu', appKuerzel: 'NE', name: 'Nora Neu', aktiv: true }] };
// Ordner, Büro: '' | 'offen' | 'rueckfrage' | 'erledigt' | 'zurueck', manuelle Zuständigkeit
const PROJEKTE = [
  [`${J}.0101 OrtA Abc`, '', null],
  [`${J}.0102 Ortb Abc`, 'offen', null],
  [`${J}.0103 Ortc Dr. Te`, 'rueckfrage', null],
  [`${V}.0104 Ortd Dr. Te`, 'erledigt', null],
  [`${V}.0105 Orte Abc`, '', { kuerzel: 'Dr. Te', gesetzt: 'manuell' }],
  [`${A}.0106 Uralt Abc`, '', null],
  [`${J}.0107 Ohnekuerzel`, '', null],
  [`${J}.0108 Ortg Alt`, '', null],
  [`${J}.0109 Orth Abc`, 'zurueck', null],
];

(async () => {
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' });
    res.end(fs.readFileSync(p));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright[process.argv[2] || 'chromium'].launch();
  try{
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    const seed = liste => page.evaluate(async ([projekte, liste]) => {
      const r = await navigator.storage.getDirectory();
      for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
      const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
      const schreib = async (dir, name, o) => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(JSON.stringify(o)); await w.close(); };
      if (liste) await schreib(archiv, '_Spektron-Mitarbeiter.json', liste);
      for (const [name, buero, zust] of projekte){
        const p = await archiv.getDirectoryHandle(name, { create: true });
        if (zust) await schreib(p, '_Projekt.json', { format: 'mosaik-projekt', version: 1, zustaendig: zust });
        if (!buero) continue;
        // Gutachten ans Büro wie in der Projektzentrale („Ans Büro“), Haken wie in BüroKit
        const D = BueroAufgaben, empfaenger = D.empfaengerVorschlag({ auftraggeber: 'Muster AG', sachverstaendigerBeteiligt: 'Dr. Muster' }).filter(r => r.an);
        const o = await D.aufgabeAnlegen(p, { art: 'gutachten', titel: 'Gutachten', von: 'QA', word: 'Mitteilungen/G.docx', empfaenger });
        const weiter = (schritt, mehr = {}) => D.vermerken(p, { aufgabe: o.id, schritt, von: 'QA', ...mehr });
        if (buero === 'rueckfrage') await weiter('frage', { text: 'Frage' });
        if (buero === 'zurueck') await weiter('geloescht', { text: 'Test' });
        if (buero === 'erledigt'){
          await weiter('gegenlesen'); await weiter('pdf', { pdf: 'Mitteilungen/G.pdf' });
          for (const r of o.empfaenger) await weiter('versand', { empfaenger: r.id, datum: '2026-01-02' });
        }
      }
      window.showDirectoryPicker = async () => archiv;
    }, [PROJEKTE, liste]);
    const start = async liste => {
      await page.goto(url); await page.waitForSelector('#btnInfo');
      await seed(liste);
      await page.locator('#btnStart, #btnArchive').first().click();
      await page.locator(`.proj[data-name="${PROJEKTE[0][0]}"]`).waitFor();
      await page.click('#btnAusl');
      await page.locator('.au-tab').waitFor();
      await page.waitForFunction(() => !/werden gelesen/.test(document.getElementById('dialog').textContent), null, { timeout: 15000 });
    };
    const tabelle = () => page.evaluate(() => [...document.querySelectorAll('.au-tab tr')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()).join(' | ')));

    // Kontrolle der Testdaten: Büro-Stände wie beabsichtigt
    await page.goto(url); await page.waitForSelector('#btnInfo'); await seed(LISTE);
    const stand = await page.evaluate(async projekte => {
      const a = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner'), out = {};
      for (const [name, b] of projekte) if (b){ const r = BueroAufgaben.alsDurchlauf((await BueroAufgaben.projektLesen(await a.getDirectoryHandle(name))).aufgaben); out[b] = r[0].withdrawn ? 'zurück' : r[0].status; }
      return out;
    }, PROJEKTE);
    assert.deepEqual(stand, { offen: 'Neu', rueckfrage: 'Rückfrage', erledigt: 'Erledigt', zurueck: 'zurück' });

    // 1) mit Mitarbeiterliste
    await start(LISTE);
    assert.deepEqual(await tabelle(), [
      'Person | In Bearbeitung | Beim Büro | Rückfrage | Offen',
      'Anna Beispiel | 2 | 1 | – | 3',          // 0101, 0109 (Übergabe zurückgenommen) · 0102
      'Dr. Tea Test | 1 | – | 1 | 2',           // 0105 (manuell) · 0103; 0104 erledigt
      'Ehemalig (inaktiv) | 1 | – | – | 1',     // 0108
      'Nora Neu | – | – | – | 0',               // aktiv, nichts offen: steht trotzdem da
      'Ohne erkannte Person | 1 | – | – | 1',   // 0107; 0106 liegt außerhalb des Zeitraums
      'Gesamt | 5 | 1 | 1 | 7']);
    assert.match(await page.locator('#dialog').innerText(), new RegExp(`Offene Projekte ${V}\\.xxxx und ${J}\\.xxxx`));
    if (process.env.SHOT){ await page.locator('.au-n[title^="Anna Beispiel · In Bearbeitung"]').click(); await page.screenshot({ path: process.env.SHOT }); await page.locator('.au-n[title^="Anna Beispiel · In Bearbeitung"]').click(); }
    // Klick auf eine Zahl zeigt die Projekte, erneuter Klick blendet sie aus
    await page.locator('.au-n[title^="Anna Beispiel · In Bearbeitung"]').click();
    assert.deepEqual(await page.locator('.au-liste button').allInnerTexts(), [`${J}.0101 · OrtA`, `${J}.0109 · Orth`]);
    await page.locator('.au-n[title^="Anna Beispiel · In Bearbeitung"]').click();
    assert.equal(await page.locator('.au-liste').count(), 0);
    // Projekt aus der Liste öffnen
    await page.locator('.au-n[title^="Dr. Tea Test · Rückfrage"]').click();
    await page.locator('.au-liste button', { hasText: `${J}.0103` }).click();
    await page.locator('#dlgBack.show').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    assert.equal(await page.locator('#dlgBack').evaluate(e => e.classList.contains('show')), false);
    await page.locator('.proj.sel, .proj[aria-selected="true"], .proj.active').filter({ hasText: '0103' }).first().waitFor({ timeout: 5000 });

    // 2) ohne Mitarbeiterliste: alles unter „Ohne erkannte Person“, mit Hinweis
    await start(null);
    assert.deepEqual(await tabelle(), [
      'Person | In Bearbeitung | Beim Büro | Rückfrage | Offen',
      'Ohne erkannte Person | 5 | 1 | 1 | 7',
      'Gesamt | 5 | 1 | 1 | 7']);
    assert.match(await page.locator('#dialog .warn').innerText(), /Ohne Mitarbeiterliste/);
    await page.click('#auZu');
    assert.equal(await page.locator('#dlgBack').evaluate(e => e.classList.contains('show')), false);

    assert.deepEqual(errors, []);
    console.log('OK Auslastung: Schritte je Person, Zeitraum, erledigt/zurückgenommen, manuell, inaktiv, ohne Person, Projektliste, ohne Mitarbeiterliste');
  }finally{ await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
