// Projektwechsel nach gescheitertem Speichern: node tests/wechsel-browser.cjs [chromium|webkit]
// Kann „_Projekt.json“ nicht geschrieben werden (Datei gesperrt, Recht entzogen …), dürfen die Eingaben beim Wechsel
// zu einem anderen Projekt nicht still verloren gehen: Projektzentrale fragt nach. Abbrechen bleibt im Projekt, die Eingabe bleibt stehen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..');
const A = '26.0142 Teststadt', B = '26.0150 Musterhausen';

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright[name].launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
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
  await page.evaluate(async ([a, b]) => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
    await archiv.getDirectoryHandle(a, { create: true }); await archiv.getDirectoryHandle(b, { create: true });
    await new Promise((res, rej) => { const q = indexedDB.open('mosaik-suite', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv');
      q.onsuccess = () => { const t = q.result.transaction('kv', 'readwrite'); const s = t.objectStore('kv'); s.put(archiv, 'archiv'); s.put([a], 'zuletzt'); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }; q.onerror = () => rej(q.error); });
  }, [A, B]);
  await page.reload(); await page.waitForSelector('#btnInfo');
  await page.evaluate(async () => { const r = await navigator.storage.getDirectory(); const a = await r.getDirectoryHandle('Mosaik Archivordner'); window.showDirectoryPicker = async () => a; });
  await page.locator('#btnStart, #btnArchive').first().click();
  await page.locator('.proj.active').waitFor({ timeout: 8000 });
  assert.equal(await page.locator('.proj.active').getAttribute('data-name'), A);

  // Speichern scheitert ab jetzt
  await page.evaluate(() => { FileSystemFileHandle.prototype.createWritable = async function(){ throw new DOMException('Die Datei ist von einem anderen Programm gesperrt.', 'NoModificationAllowedError'); }; });
  if (!(await page.locator('#pj_objekt').isVisible())) await page.locator('#pjBox > summary').click();
  await page.locator('#pj_objekt').fill('EFH, Musterweg 7');
  await page.locator('#pjSave.err').waitFor({ timeout: 5000 });

  // Wechsel: Rückfrage, Abbrechen bleibt im Projekt mit der Eingabe
  await page.locator(`.proj[data-name="${B}"]`).click();
  const dlg = page.locator('#dialog');
  await dlg.getByText('Änderungen nicht gespeichert').waitFor({ timeout: 5000 });
  assert.match(await dlg.textContent(), /Objekt \/ Adresse/);
  await page.locator('#dNo').click();
  assert.equal(await page.locator('.proj.active').getAttribute('data-name'), A);
  assert.equal(await page.locator('#pj_objekt').inputValue(), 'EFH, Musterweg 7');

  // „Trotzdem wechseln“ wechselt
  await page.locator(`.proj[data-name="${B}"]`).click();
  await dlg.getByText('Änderungen nicht gespeichert').waitFor({ timeout: 5000 });
  await page.locator('#dYes').click();
  await page.waitForFunction(b => { const e = document.querySelector('.proj.active'); return e && e.dataset.name === b; }, B, { timeout: 5000 });

  // Ohne offene Änderungen keine Rückfrage
  await page.locator(`.proj[data-name="${A}"]`).click();
  await page.waitForFunction(a => { const e = document.querySelector('.proj.active'); return e && e.dataset.name === a; }, A, { timeout: 5000 });
  assert.equal(await dlg.getByText('Änderungen nicht gespeichert').count(), 0);

  assert.deepEqual(errors, []);
  await browser.close(); server.close();
  console.log(`OK (${name}): Rückfrage beim Wechsel nach gescheitertem Speichern, Abbrechen behält die Eingabe`);
})().catch(e => { console.error(e); console.log(`::error title=Browsertest Projektwechsel ${process.argv[2] || 'chromium'}::${String(e && e.message || e).split('\n')[0]}`); process.exit(1); });
