// Zuletzt geöffnetes Projekt wird beim Start vorgewählt: node tests/zuletzt-browser.cjs [chromium|webkit]
// Die Apps führen die Liste „zuletzt“ in IndexedDB „mosaik-suite“; Projektzentrale wählt das erste Projekt daraus vor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..');
const A = '26.0142 Teststadt', B = '26.0150 Köln';

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright[name].launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
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
  const seed = async zuletzt => {
    await page.evaluate(async ([a, b, z]) => {
      const r = await navigator.storage.getDirectory();
      for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
      const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
      await archiv.getDirectoryHandle(a, { create: true }); await archiv.getDirectoryHandle(b, { create: true });
      await new Promise((res, rej) => { const q = indexedDB.open('mosaik-suite', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv');
        q.onsuccess = () => { const t = q.result.transaction('kv', 'readwrite'); const s = t.objectStore('kv'); s.put(archiv, 'archiv'); if (z) s.put(z, 'zuletzt'); else s.delete('zuletzt'); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }; q.onerror = () => rej(q.error); });
      window.showDirectoryPicker = async () => archiv;
    }, [A, B, zuletzt]);
  };

  // mit „zuletzt“: das erste Projekt der Liste ist vorgewählt (und nicht das neueste der Nummer nach)
  await seed([A, B]);
  await page.reload(); await page.waitForSelector('#btnInfo');
  await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const a = await r.getDirectoryHandle('Mosaik Archivordner'); window.showDirectoryPicker = async () => a; });
  await page.locator('#btnStart, #btnArchive').first().click();
  await page.locator('.proj.active').waitFor({ timeout: 8000 });
  assert.equal(await page.locator('.proj.active').getAttribute('data-name'), A);
  // Reisekosten Pro: unten im rechten Fenster, ohne Projektbezug (?projekt= wäre falsch – die Monatsabrechnung gehört zu keinem Projekt)
  { const l = page.locator('#detail .pz > .more:last-child a#goReise');
    await l.waitFor();
    assert.equal(await l.getAttribute('href'), '../reisekosten-pro/'); assert.equal(await l.getAttribute('target'), 'reisekosten');
    assert.equal(await page.locator('.steps #goReise').count(), 0, 'kein nummerierter Arbeitsschritt');
    const [popup] = await Promise.all([page.waitForEvent('popup'), l.click()]);
    assert.match(popup.url(), /\/reisekosten-pro\/$/, 'öffnet ../reisekosten-pro/ ohne Parameter'); await popup.close().catch(() => {}); }

  // ohne „zuletzt“: nichts vorgewählt
  await seed(null);
  await page.reload(); await page.waitForSelector('#btnInfo');
  await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const a = await r.getDirectoryHandle('Mosaik Archivordner'); window.showDirectoryPicker = async () => a; });
  await page.locator('#btnStart, #btnArchive').first().click();
  await page.locator('.proj').first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.proj.active').count(), 0);
  assert.equal(await page.locator('#detail .empty a#goReise').count(), 1, 'Reisekosten Pro auch ohne gewähltes Projekt erreichbar');

  // „zuletzt“ nennt ein Projekt, das es nicht mehr gibt: nichts vorgewählt, kein Fehler
  await seed(['99.0001 Weg', A]);
  await page.reload(); await page.waitForSelector('#btnInfo');
  await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const a = await r.getDirectoryHandle('Mosaik Archivordner'); window.showDirectoryPicker = async () => a; });
  await page.locator('#btnStart, #btnArchive').first().click();
  await page.locator('.proj').first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.proj.active').count(), 0);

  assert.deepEqual(errors, []);
  await browser.close(); server.close();
  console.log(`OK (${name})`);
})().catch(e => { console.error(e); process.exit(1); });
