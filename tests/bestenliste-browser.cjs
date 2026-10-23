// Bestenliste im echten Browser: node tests/bestenliste-browser.cjs [chromium]
// Archiv im OPFS mit Büroübergaben, LabelKit-Datei, Bilddoku und Probenplan; Seite liest nur und zeigt Podest, Liste,
// Ticker, Abzeichen, Projekte je Jahr; Zeitraum-Umschalter; keine Datei wird geschrieben. Nur erfundene Namen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const root = path.join(__dirname, '..');
const yy = String(new Date().getFullYear() % 100).padStart(2, '0'), vy = String((+yy + 99) % 100).padStart(2, '0');
const LISTE = { format: 'spektron-mitarbeiter', version: 1, personen: [
  { ordnerKuerzel: 'Abc', appKuerzel: 'AB', name: 'Anna Beispiel', aktiv: true },
  { ordnerKuerzel: 'Dr. Te', appKuerzel: 'TE', name: 'Dr. Tea Test', aktiv: true },
  { ordnerKuerzel: 'Bue', appKuerzel: 'BU', name: 'Bea Buero', aktiv: true }] };
// Ordner, erledigt?, Proben, Bilddoku, Plan
const PROJEKTE = [
  [`${yy}.0301 Ortx Abc`, true, 4, true, true],      // Anna 10+4+2+2 = 18
  [`${yy}.0302 Orty Dr. Te`, true, 0, false, false], // Tea 10
  [`${yy}.0303 Ortz Abc`, false, 9, true, true],     // offen: keine Punkte für Anna
  [`${vy}.0304 Altort Dr. Te`, false, 0, false, false],
];

(async () => {
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, ''));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : p.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
    res.end(fs.readFileSync(p));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/bestenliste/index.html`;
  const browser = await playwright[process.argv[2] || 'chromium'].launch();
  try{
    const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'de-DE' })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url);
    await page.locator('#podest .leer').waitFor();

    const dateienVorher = await page.evaluate(async ([projekte, liste]) => {
      const r = await navigator.storage.getDirectory();
      for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
      const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
      const schreib = async (dir, name, text) => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close(); };
      await schreib(archiv, '_Spektron-Mitarbeiter.json', JSON.stringify(liste));
      const D = BueroData;
      for (const [name, fertig, proben, foto, plan] of projekte){
        const p = await archiv.getDirectoryHandle(name, { create: true });
        if (proben){ const l = await p.getDirectoryHandle('Laboraufträge', { create: true }); await schreib(l, `${name.slice(0, 7)}_2026-01-01_Daten.json`, JSON.stringify({ pn98Proben: Array.from({ length: proben }, () => ({})) })); }
        if (foto){ const f = await p.getDirectoryHandle('Fotos', { create: true }); await schreib(f, 'Bilddokumentation.pdf', '%PDF'); }
        if (plan){ const f = await p.getDirectoryHandle('Pläne', { create: true }); await schreib(f, 'Plan.probenplan', '{}'); await schreib(f, 'Plan (vorher 2026-01-01).probenplan', '{}'); }
        if (!fertig) continue;
        const o = D.order(D.snapshot({ name, nr: name.slice(0, 7), ort: 'x' }, 'Mitteilungen/G.docx', 'QA', '', D.recipients({ auftraggeber: 'Muster AG', sachverstaendigerBeteiligt: 'Dr. Muster' })));
        await D.create(p, o);
        const weiter = async (typ, payload) => D.append(p, D.event(await D.load(p, o.id), typ, payload, 'BU'));
        await weiter('proof', {}); await weiter('pdf', { path: 'Mitteilungen/G.pdf' });
        await weiter('send', { date: '2026-01-02', pdf: 'Mitteilungen/G.pdf', ids: (await D.load(p, o.id)).content.recipients.map(x => x.id) });
      }
      await new Promise((res, rej) => { const q = indexedDB.open('mosaik-suite', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv');
        q.onsuccess = () => { const t = q.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(archiv, 'archiv'); t.oncomplete = () => { q.result.close(); res(); }; t.onerror = () => rej(t.error); }; q.onerror = () => rej(q.error); });
      localStorage.clear();
      const alle = []; const walk = async (d, pre) => { for await (const [n, h] of d.entries()){ if (h.kind === 'directory') await walk(h, pre + n + '/'); else alle.push(pre + n + ':' + (await h.getFile()).size); } };
      await walk(archiv, ''); return alle.sort();
    }, [PROJEKTE, LISTE]);

    await page.goto(url);
    await page.locator('#podest .stufe').first().waitFor({ timeout: 10000 });
    await page.locator('[data-zeit="gesamt"]').click();
    const liste = async () => page.evaluate(() => [...document.querySelectorAll('#liste li')].map(li => [li.querySelector('.nm').firstChild.textContent.trim(), +li.querySelector('.pk').textContent]));
    // Gesamt: Anna 18, Bea 2×5 Büro = 10, Tea 10 → Bea vor Tea? gleich 10: mehr Abschlüsse zuerst (Tea 1, Bea 0)
    assert.deepEqual(await liste(), [['Anna Beispiel', 18], ['Dr. Tea Test', 10], ['Bea Buero', 10]]);
    assert.deepEqual(await page.locator('#liste .pl').allInnerTexts(), ['1.', '2.', '2.']);
    assert.equal(await page.locator('#podest .stufe').count(), 3);
    assert.match(await page.locator('#podest .p1').innerText(), /Anna Beispiel[\s\S]*18/);
    // Balkenbreite kommt über CSS-Variable (keine style-Attribute im HTML wegen der Sicherheitsrichtlinie)
    assert.equal(await page.locator('#liste li').first().locator('.balken span').evaluate(e => getComputedStyle(e).getPropertyValue('--w').trim()), '100%');
    // Ticker: Anna mit Boni als eine Zeile (+18)
    const ticker = await page.locator('#ticker li').allInnerTexts();
    assert.ok(ticker.some(t => /Anna Beispiel hat abgeschlossen: \d+\.0301 Ortx[\s\S]*inkl\. Proben, Bilddokumentation, Probenplan[\s\S]*\+18/.test(t)), ticker.join('\n'));
    assert.equal(ticker.filter(t => /Bea Buero hat gegengelesen, das PDF zugeordnet und den Versand dokumentiert[\s\S]*\+5/.test(t)).length, 2, ticker.join('\n'));
    assert.equal(ticker.length, 4);
    assert.match(await page.locator('#abzeichen').innerText(), /Bea Buero[\s\S]*noch 8 Gegenlesen bis 🔍 Adlerauge/);
    // Abzeichen und Projekte je Jahr
    assert.match(await page.locator('#abzeichen').innerText(), /Anna Beispiel[\s\S]*Erster Abschluss/);
    assert.match(await page.locator('#abzeichen').innerText(), /Probenkönig\/in/);
    const jahre = await page.evaluate(() => [...document.querySelectorAll('#jahre tr')].map(tr => [...tr.children].map(c => c.innerText.trim()).join(' | ')));
    assert.deepEqual(jahre, [`Person | 20${yy} | 20${vy}`, `Anna Beispiel | 2 | –`, `Dr. Tea Test | 1 | 1`]);
    // Zeitraum merken
    await page.reload(); await page.locator('#podest .stufe').first().waitFor({ timeout: 10000 });
    assert.equal(await page.locator('[data-zeit="gesamt"]').getAttribute('aria-selected'), 'true');
    // Regeln sichtbar
    await page.locator('.regeln summary').click();
    assert.match(await page.locator('#regeln').innerText(), /\+10[\s\S]*Projekt abgeschlossen/);
    if (process.env.SHOT){ await page.locator('.regeln summary').click(); await page.screenshot({ path: process.env.SHOT, fullPage: true }); }

    // Nur gelesen: Archiv unverändert
    const dateienNachher = await page.evaluate(async () => {
      const archiv = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner'), alle = [];
      const walk = async (d, pre) => { for await (const [n, h] of d.entries()){ if (h.kind === 'directory') await walk(h, pre + n + '/'); else alle.push(pre + n + ':' + (await h.getFile()).size); } };
      await walk(archiv, ''); return alle.sort();
    });
    assert.deepEqual(dateienNachher, dateienVorher);
    assert.deepEqual(errors, []);
    console.log('OK Bestenliste Browser: Podest, Rangliste mit Gleichstand, Ticker, Abzeichen, Projekte je Jahr, Zeitraum gemerkt, nichts geschrieben');
  }finally{ await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
