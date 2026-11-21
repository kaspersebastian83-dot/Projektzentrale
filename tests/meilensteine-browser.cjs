// Projektstand (Meilensteine) und „Neu einlesen“: node tests/meilensteine-browser.cjs [chromium|webkit]
// Audit Lauf 5 (gefunden von der Spektron-Kette in ResultKit): Läuft das Lesen der Meilensteine eines Projekts noch, während
// „Neu einlesen“ den gemerkten Stand verwirft (S.ms = null), warf die Projektzentrale beim Zurückkommen des alten Lesens
// „Cannot read properties of null (reading 'set')“. Das alte Ergebnis gehört zum verworfenen Stand und wird nicht mehr eingetragen;
// das Neu-Einlesen liest die Meilensteine selbst wieder. Die Reihenfolge wird hier mit zwei Sperren erzwungen (sonst Zufall).
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
  const AUFWAND = '26-0142_Aufwand_2026-11-01.json';   // nur das Lesen der Meilensteine öffnet diese Datei (Abrechnungsstand aus BelegKit)
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
  //  1 – getFile() der BelegKit-Datei: das Lesen der Meilensteine wartet;  2 – getFile() der Mitarbeiterliste: „Neu einlesen“ wartet,
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
    T.sperren = n => { T['sperre' + n] = new Promise(res => { T['frei' + n] = () => { T['sperre' + n] = null; res(); }; }); };
  }, [AUFWAND]);
  await page.locator('.proj, #btnStart, #btnGrant').first().waitFor({ timeout: 8000 });
  if (await page.locator('#btnStart').count()) await page.locator('#btnStart').click();
  else if (await page.locator('#btnGrant').count()) await page.locator('#btnGrant').click();
  schritt = 'Projekt A offen, Meilensteine gelesen';
  await page.locator('.proj.active').waitFor({ timeout: 8000 });
  assert.equal(await page.locator('.proj.active').getAttribute('data-name'), A);
  // Das Öffnen hat die Meilensteine schon gelesen (evtl. vor den Sperren). Einmal „Neu einlesen“ ohne Sperre: Datei wird gelesen.
  await page.locator('#btnRescan').click();
  await page.waitForFunction(() => window.T.gelesen >= 1, null, { timeout: 8000 });
  // Der Projektstand zeigt das Datum aus dem BelegKit-Dateinamen – nur aus den gelesenen Meilensteinen
  const abrechnung = page.locator('[data-stufe=abrechnung]');
  await abrechnung.filter({ hasText: 'Abrechnungsstand vom 01.11.' }).waitFor({ timeout: 8000 });

  schritt = '1. „Neu einlesen“: Meilensteine werden gelesen (Sperre 1)';
  await page.evaluate(() => window.T.sperren(1));
  await page.locator('#btnRescan').click();
  await page.waitForFunction(() => window.T.wartet1 >= 1, null, { timeout: 8000 });
  schritt = '2. „Neu einlesen“ verwirft den gemerkten Stand und wartet (Sperre 2)';
  await page.evaluate(() => window.T.sperren(2));
  await page.locator('#btnRescan').click();
  await page.waitForFunction(() => window.T.wartet2 >= 1, null, { timeout: 8000 });
  schritt = 'das erste Lesen kommt zurück, nachdem der Stand verworfen ist';
  const vorher = await page.evaluate(() => window.T.gelesen);
  await page.evaluate(() => window.T.frei1());
  await page.waitForTimeout(500);
  assert.deepEqual(errors, [], 'kein Skriptfehler, wenn ein altes Lesen der Meilensteine nach „Neu einlesen“ zurückkommt');
  schritt = 'das zweite „Neu einlesen“ läuft weiter und liest die Meilensteine neu';
  await page.evaluate(() => window.T.frei2());
  await page.waitForFunction(v => window.T.gelesen > v, vorher, { timeout: 8000 });
  await abrechnung.filter({ hasText: 'Abrechnungsstand vom 01.11.' }).waitFor({ timeout: 8000 });   // neu gelesen und wieder gezeichnet
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.proj.active').getAttribute('data-name'), A, 'Projekt bleibt offen');
  assert.deepEqual(errors, []);
  await browser.close(); server.close();
  console.log(`OK (${name}): altes Lesen der Meilensteine nach „Neu einlesen“ ohne Fehler verworfen, Stand neu gelesen`);
})().catch(async e => {
  console.error(e);
  console.log(`::error title=Browsertest Meilensteine ${process.argv[2] || 'chromium'}::${schritt}: ${String(e && e.message || e).split('\n')[0]}`); process.exit(1);
});
