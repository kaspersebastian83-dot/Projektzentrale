// Durchlaufzeiten und „Neu einlesen“: node tests/durchlauf-neu-browser.cjs [chromium|webkit]
// Audit Lauf 5 (gleiches Muster wie tests/meilensteine-browser.cjs, 1.51.5): „Durchlaufzeiten“ liest alle Projekte im Hintergrund weiter,
// auch wenn der Dialog schon zu ist. Verwirft „Neu einlesen“ in der Zeit die Auswertung (S.dl = null) und scheitert danach das Lesen
// eines Projekts (Datei gesperrt), warf die Projektzentrale „Cannot read properties of null (reading 'werte')“. Ein Ergebnis oder
// Fehler zum verworfenen Stand wird jetzt nicht mehr eingetragen; beim nächsten Öffnen liest der Dialog neu. Die Reihenfolge wird mit zwei Sperren im Browser-Dateisystem erzwungen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..');
const A = '26.0142 Teststadt';
let schritt = 'Start', seite = null;

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright[name].launch(); require('./spektron-start-test.cjs')(browser);
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage(); seite = page;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('#btnInfo');
  const kann = await page.evaluate(async () => {
    if (!('showDirectoryPicker' in window) || !navigator.storage || !navigator.storage.getDirectory) return false;
    try{ const r = await navigator.storage.getDirectory(); const h = await r.getFileHandle('probe', { create: true }); if (!h.createWritable) return false; await r.removeEntry('probe'); return true; }catch(e){ return false; }
  });
  if (!kann){
    assert.deepEqual(errors, []);
    await browser.close(); server.close();
    console.log(`OK (${name}, ohne Ordnerzugriff: nur Laden geprüft)`);
    return;
  }
  const AUFWAND = '26-0142_Aufwand_2026-11-01.json';   // nur das Lesen von Projektstand und Durchlaufzeiten (dlLesen) öffnet diese Datei
  await page.evaluate(async ([a, aufwand]) => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
    const schreib = async (d, n, t) => { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); };
    const p = await archiv.getDirectoryHandle(a, { create: true });
    await schreib(await p.getDirectoryHandle('Abrechnung', { create: true }), aufwand, '{}');
    await schreib(archiv, '_Spektron-Mitarbeiter.json', JSON.stringify({ format: 'spektron-mitarbeiter', version: 1, personen: [{ ordnerKuerzel: 'Abc', appKuerzel: 'Abc', name: 'Anna Beispiel', aktiv: true }] }));
    await new Promise((res, rej) => { const q = indexedDB.open('mosaik-suite', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv');
      q.onsuccess = () => { const t = q.result.transaction('kv', 'readwrite'); const s = t.objectStore('kv'); s.put(archiv, 'archiv'); s.put([a], 'zuletzt'); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }; });
  }, [A, AUFWAND]);
  await page.reload(); await page.waitForSelector('#btnInfo');
  // Zwei Sperren im Browser-Dateisystem (die Projektzentrale selbst bleibt unberührt):
  //  1 – getFile() der BelegKit-Datei: das Lesen der Durchlaufzeiten wartet;  2 – getFile() der Mitarbeiterliste: „Neu einlesen“ wartet,
  //      nachdem es den gemerkten Stand verworfen hat und bevor es neu liest.
  await page.evaluate(async ([aufwand]) => {
    const r = await navigator.storage.getDirectory(); const a = await r.getDirectoryHandle('Mosaik Archivordner'); window.showDirectoryPicker = async () => a;
    const T = window.T = { gelesen: 0, wartet1: 0, wartet2: 0, sperre1: null, sperre2: null };
    const echt = FileSystemFileHandle.prototype.getFile;
    FileSystemFileHandle.prototype.getFile = async function(...x){
      if (this.name === aufwand){ T.gelesen++; if (T.sperre1){ T.wartet1++; await T.sperre1; } }
      if (this.name === '_Spektron-Mitarbeiter.json' && T.sperre2){ T.wartet2++; await T.sperre2; }
      return echt.apply(this, x);
    };
    T.sperren = n => { T['sperre' + n] = new Promise((res, rej) => { T['frei' + n] = () => { T['sperre' + n] = null; res(); };
      T['fehl' + n] = () => { T['sperre' + n] = null; rej(new DOMException('Die Datei ist von einem anderen Programm gesperrt.', 'NotReadableError')); }; }); };
  }, [AUFWAND]);
  await page.locator('.proj, #btnStart, #btnGrant').first().waitFor({ timeout: 8000 });
  if (await page.locator('#btnStart').count()) await page.locator('#btnStart').click();
  else if (await page.locator('#btnGrant').count()) await page.locator('#btnGrant').click();
  schritt = 'Projekt A offen';
  await page.locator('.proj.active').waitFor({ timeout: 8000 });
  assert.equal(await page.locator('.proj.active').getAttribute('data-name'), A);
  await page.waitForTimeout(800);   // Projektstand des offenen Projekts gelesen (liest dieselbe Datei)

  schritt = 'Durchlaufzeiten öffnen: Projekte werden gelesen (Sperre 1), Dialog wieder zu';
  await page.evaluate(() => window.T.sperren(1));
  await page.locator('#btnMehr').click(); await page.locator('#mehr #goDurch').click();
  await page.locator('#dialog.dl').waitFor({ timeout: 8000 });
  await page.waitForFunction(() => window.T.wartet1 >= 1, null, { timeout: 8000 });
  await page.locator('#dlZu').click();
  schritt = '„Neu einlesen“ verwirft die Auswertung und wartet (Sperre 2)';
  await page.evaluate(() => window.T.sperren(2));
  await page.locator('#btnRescan').click();
  await page.waitForFunction(() => window.T.wartet2 >= 1, null, { timeout: 8000 });
  // Die Datei ist in dem Moment nicht lesbar (z. B. von BelegKit oder Word gesperrt) → das Projekt käme unter „nicht sicher lesbar“.
  // Genau dieser Weg schrieb nach dem Warten in S.dl, das „Neu einlesen“ inzwischen verworfen hatte.
  schritt = 'das Lesen der Durchlaufzeiten scheitert, nachdem die Auswertung verworfen ist';
  await page.evaluate(() => window.T.fehl1());
  await page.waitForTimeout(500);
  assert.deepEqual(errors, [], 'kein Skriptfehler, wenn ein altes Lesen der Durchlaufzeiten nach „Neu einlesen“ zurückkommt');
  schritt = '„Neu einlesen“ läuft weiter; Durchlaufzeiten neu geöffnet zeigen das Projekt';
  await page.evaluate(() => window.T.frei2());
  await page.locator('.proj.active').waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);
  await page.locator('#btnMehr').click(); await page.locator('#mehr #goDurch').click();
  await page.locator('#dialog.dl', { hasText: 'Alle Projekte (1)' }).waitFor({ timeout: 8000 });
  assert.match(await page.locator('#dialog').textContent(), /26\.0142 Teststadt/);
  assert.doesNotMatch(await page.locator('#dialog').textContent(), /nicht sicher lesbar/, 'der alte Fehlschlag zählt nicht in der neuen Auswertung');
  await page.locator('#dlZu').click();
  assert.deepEqual(errors, []);
  await browser.close(); server.close();
  console.log(`OK (${name}): altes Lesen der Durchlaufzeiten nach „Neu einlesen“ ohne Fehler verworfen, neu geöffnet vollständig`);
})().catch(async e => {
  console.error(e);
  console.log(`::error title=Browsertest Durchlaufzeiten ${process.argv[2] || 'chromium'}::${schritt}: ${String(e && e.message || e).split('\n')[0]}`); process.exit(1);
});
