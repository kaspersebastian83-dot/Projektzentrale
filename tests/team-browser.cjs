// TeamKit-Anbindung (1.51): node tests/team-browser.cjs [chromium|webkit]
// Braucht TeamKit daneben (../teamkit, wie auf GitHub Pages). Der Server liefert den gemeinsamen Elternordner aus, damit
// ../teamkit/ aus der Projektzentrale heraus aufgeht; TeamKit läuft über ?teamprobe=1 im Probe-Modus (Daten im Browser-Speicher).
// Ohne ../teamkit wird der Test übersprungen, außer TEAMKIT_PFLICHT=1. TEAM_BILDER=<Ordner> legt Bildschirmfotos ab.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const repo = path.join(__dirname, '..'), root = path.dirname(repo), team = path.join(root, 'teamkit');
const bilder = process.env.TEAM_BILDER || '';
if (!fs.existsSync(path.join(team, 'index.html'))){
  if (process.env.TEAMKIT_PFLICHT === '1'){ console.error('FEHLER: ../teamkit fehlt'); process.exit(1); }
  console.log('übersprungen: ../teamkit fehlt (TeamKit-Repo daneben auschecken)'); process.exit(0);
}
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const A = '26.0142 Teststadt';

(async () => {
  const server = http.createServer((req, res) => {
    let f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (f.endsWith(path.sep)) f = path.join(f, 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYP[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${path.basename(repo)}/index.html?teamprobe=1`;
  const browser = await playwright[name].launch(); require('./spektron-start-test.cjs')(browser);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.unroute(/\/teamkit\//);   // hier das echte TeamKit, nicht die leere Testseite
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const foto = async n => { if (bilder) await page.screenshot({ path: path.join(bilder, n) }); };
  await page.goto(url); await page.waitForSelector('#btnInfo');
  if (!(await page.evaluate(() => 'showDirectoryPicker' in window && !!navigator.storage?.getDirectory))){ console.log(`OK (${name}, ohne Ordnerzugriff: nur Laden geprüft)`); await browser.close(); server.close(); return; }

  // Archiv mit einem Projekt, TeamKit-Beiträge im Probe-Speicher (_TeamKit im Wurzelordner des Browser-Speichers)
  const heute = await page.evaluate(() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; });
  const iso = `${heute.slice(0, 4)}-${heute.slice(4, 6)}-${heute.slice(6)}`;
  const bauen = async ({ kurz = [], gilt = [], ls = {} }) => page.evaluate(async ([A, kurz, gilt, ls]) => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true }); await archiv.getDirectoryHandle(A, { create: true });
    const tk = await r.getDirectoryHandle('_TeamKit', { create: true });
    const schreib = async o => { const w = await (await tk.getFileHandle(o.id + '.json', { create: true })).createWritable(); await w.write(JSON.stringify(o)); await w.close(); };
    const mara = { kuerzel: 'Mar', name: 'Mara Keller' }, abend = new Date(); abend.setHours(23, 59, 59, 0);
    for (const k of kurz) await schreib({ format: 'teamkit-kurz', version: 1, id: k.id, text: k.text, umfrage: false, bis: abend.toISOString(), von: mara, am: new Date().toISOString() });
    for (const g of gilt) await schreib({ format: 'teamkit-gilt', version: 1, id: g.id, titel: g.titel, text: 'Bitte beachten.', link: '', wichtig: !!g.wichtig, von: mara, am: g.am || new Date().toISOString() });
    await new Promise((res, rej) => { const q = indexedDB.open('mosaik-suite', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv');
      q.onsuccess = () => { const t = q.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(archiv, 'archiv'); t.objectStore('kv').put([A], 'zuletzt'); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }; q.onerror = () => rej(q.error); });
    localStorage.clear(); localStorage.setItem('teamkit-name', 'Nadine Berger');
    for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
  }, [A, kurz, gilt, ls]);
  const laden = async erwartet => {
    await page.reload(); await page.waitForSelector('#btnInfo');
    const start = await Promise.race([page.locator('#teamRahmen').waitFor({ state: 'attached', timeout: 15000 }).then(() => false), page.locator('#btnStart, #btnGrant').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true)]);
    if (start){   // Archiv nicht von selbst verbunden: wählen (nie doppelt – ein zweites useArchive lädt TeamKit neu)
      await page.evaluate(async () => { const a = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner'); window.showDirectoryPicker = async () => a; });
      await page.locator('#btnStart, #btnGrant, #btnArchive').first().click();
      await page.locator('#teamRahmen').waitFor({ state: 'attached', timeout: 8000 });
    }
    await page.waitForFunction(e => (document.getElementById('btnTeam').getAttribute('aria-label') || '') === e, erwartet, { timeout: 8000 });
    await page.locator('.proj.active').waitFor({ timeout: 8000 });   // „zuletzt“ hat das Projekt vorgewählt – dessen Nummer geht mit „oeffnen“ mit
  };
  const knopf = () => page.evaluate(() => { const b = document.getElementById('btnTeam'); return { text: b.querySelector('#teamText').textContent, zahl: b.querySelector('#teamZahl').hidden ? '' : b.querySelector('#teamZahl').textContent, punkt: !b.querySelector('#teamPunkt').hidden, morgen: b.classList.contains('morgen'), zeile: document.getElementById('teamZeile').hidden ? '' : document.getElementById('teamZeile').textContent }; });
  const rahmen = () => page.frameLocator('#teamRahmen');
  const offen = () => page.evaluate(() => !document.getElementById('teamRahmen').hidden);
  const fokusTeam = () => page.evaluate(() => document.activeElement.id);

  // 1) vor dem Archivordner: kein Rahmen, „Team“ öffnet ein eigenes Fenster
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#teamRahmen').count(), 0, 'kein Rahmen ohne Archivordner');
  { const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#btnTeam')]); assert.match(popup.url(), /\/teamkit\/$/); await popup.close(); }
  await bauen({});
  // 2) leer: nur „Team“
  await laden('Team');
  assert.deepEqual(await knopf(), { text: 'Team', zahl: '', punkt: false, morgen: false, zeile: '' }, 'leer: nur „Team“');
  // 3) heute ist etwas los (Guten Morgen schon gesehen): Punkt
  await bauen({ kurz: [{ id: `k-${heute}-kuchen01`, text: 'Kuchen in der Küche' }], ls: { 'teamkit-morgen': iso } });
  await laden('Team – heute ist etwas los');
  assert.deepEqual(await knopf(), { text: 'Team', zahl: '', punkt: true, morgen: false, zeile: '' }, 'Punkt ohne Zahl');
  // 3b) eine neue Mitteilung ohne „Wichtig“: Zahl, aber keine Schlagzeile
  await bauen({ gilt: [{ id: `g-${heute}-nurnorm1`, titel: 'Nur normal' }], ls: { 'teamkit-morgen': iso, 'teamkit-gilt-gesehen': '2025-01-01T00:00:00.000Z' } });
  await laden('Team – 1 neue Mitteilung');
  assert.deepEqual(await knopf(), { text: 'Team', zahl: '1', punkt: false, morgen: false, zeile: '' }, 'ohne „Wichtig“ keine Schlagzeile');
  // 4) zwei neue Mitteilungen, eine „Wichtig“: Zahl, Schlagzeile
  const G = { id: `g-${heute}-wichtig1`, titel: 'Neue Ablage für Pläne', wichtig: true }, G2 = { id: `g-${heute}-normal01`, titel: 'Parkplatz gesperrt', am: '2026-01-01T08:00:00.000Z' };
  const mitGilt = { kurz: [{ id: `k-${heute}-kuchen01`, text: 'Kuchen in der Küche' }], gilt: [G, G2], ls: { 'teamkit-gilt-gesehen': '2025-01-01T00:00:00.000Z' } };
  await bauen({ ...mitGilt, ls: { ...mitGilt.ls, 'teamkit-morgen': iso } });
  await laden('Team – 2 neue Mitteilungen, heute ist etwas los');
  { const k = await knopf(); assert.equal(k.zahl, '2'); assert.equal(k.punkt, false, 'Zahl statt Punkt'); assert.match(k.zeile, /📌\s*Neue Ablage für Pläne – Mara Keller/); }
  const gesehenVorher = await page.evaluate(() => [localStorage.getItem('teamkit-morgen'), localStorage.getItem('teamkit-gilt-gesehen')]);
  await foto('team-1280-zahl-schlagzeile.png');
  // Ansehen: Rahmen auf, genau dieser Beitrag offen
  await page.click('#teamZeile [data-team="ansehen"]');
  await rahmen().locator('#tGilt .giltoffen', { hasText: 'Neue Ablage für Pläne' }).waitFor({ timeout: 5000 });
  assert.equal(await offen(), true);
  { const [top, unten] = await page.evaluate(() => [document.getElementById('teamRahmen').getBoundingClientRect().top, document.getElementById('teamZeile').getBoundingClientRect().bottom]);
    assert.equal(Math.round(top), Math.round(unten), 'Rahmen beginnt unter der Schlagzeile'); }
  // der Beitrag kann im unsichtbaren Rahmen schon offen sein – darum auf die Wirkung von „oeffnen“ warten: Text und Fokus
  await rahmen().locator('#zurueckText', { hasText: 'Zurück zum Projekt 26.0142' }).waitFor({ timeout: 5000 });
  await page.frame({ url: /\/teamkit\// }).waitForFunction(id => document.activeElement && document.activeElement.dataset.id === id, G.id, { timeout: 5000 });
  await foto('team-1280-offen.png');
  // TeamKits „Zurück“: zu, Fokus auf „Team“
  await rahmen().locator('#btnZurueck').click();
  await page.waitForFunction(() => document.getElementById('teamRahmen').hidden);
  assert.equal(await fokusTeam(), 'btnTeam', 'Fokus nach „Zurück“');
  await page.waitForFunction(() => document.getElementById('teamZeile').hidden, null, { timeout: 5000 });   // in TeamKit gesehen: Schlagzeile weg
  // „Gesehen“ ohne Öffnen: Schlagzeile weg, ID gemerkt
  await bauen({ ...mitGilt, ls: { ...mitGilt.ls, 'teamkit-morgen': iso } });
  await laden('Team – 2 neue Mitteilungen, heute ist etwas los');
  assert.match((await knopf()).zeile, /Neue Ablage für Pläne/);
  await page.click('#teamZeile [data-team="gesehen"]');
  assert.equal((await knopf()).zeile, '');
  assert.equal(await page.evaluate(() => localStorage.getItem('pz-team-gesehen')), G.id);

  // 5) Guten Morgen fällig; unsichtbar geladen merkt TeamKit nichts als gesehen
  await bauen({ ...mitGilt, ls: { ...mitGilt.ls, 'pz-team-gesehen': G.id } });
  await laden('Team – Guten Morgen, 2 neue Mitteilungen, heute ist etwas los');
  { const k = await knopf(); assert.equal(k.text, 'Guten Morgen'); assert.equal(k.morgen, true); assert.equal(k.zahl, '2'); assert.equal(k.zeile, '', 'Gesehen bleibt gesehen'); }
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('teamkit-morgen'), localStorage.getItem('teamkit-gilt-gesehen')]), [null, '2025-01-01T00:00:00.000Z'], 'unsichtbar: nichts als gesehen');
  await foto('team-1280-guten-morgen.png');
  // Klick auf „Team“: Guten Morgen im Rahmen; nochmal klicken: zu
  await page.click('#btnTeam');
  await rahmen().locator('#morgen:not([hidden]) .los').waitFor({ timeout: 5000 });
  { const top = await page.evaluate(() => document.getElementById('teamRahmen').getBoundingClientRect().top), kopf = await page.evaluate(() => document.querySelector('header').getBoundingClientRect().bottom);
    assert.equal(Math.round(top), Math.round(kopf), 'Rahmen beginnt unter dem Kopf (gemessen)');
    const [unten, hoch] = await page.evaluate(() => [document.getElementById('teamRahmen').getBoundingClientRect().bottom, innerHeight]);
    assert.equal(Math.round(unten), hoch, 'Rahmen reicht bis zum unteren Rand'); }
  await page.click('#btnTeam');
  assert.equal(await offen(), false, 'zweiter Klick schließt');
  // Esc in der Projektzentrale schließt
  await page.click('#btnTeam'); await rahmen().locator('#morgen .los').waitFor();
  await page.focus('#btnTeam'); await page.keyboard.press('Escape');
  assert.equal(await offen(), false, 'Esc in der PZ'); assert.equal(await fokusTeam(), 'btnTeam');
  // Esc im Rahmen (TeamKit): „Los geht’s“-Weg, schließt, Fokus zurück
  await page.click('#btnTeam'); await rahmen().locator('#morgen .los').waitFor();
  await rahmen().locator('#morgen .los').focus(); await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('teamRahmen').hidden);
  assert.equal(await fokusTeam(), 'btnTeam', 'Fokus nach Esc im Rahmen');
  await page.waitForFunction(() => !document.getElementById('btnTeam').classList.contains('morgen'), null, { timeout: 5000 });
  // Dialog der Projektzentrale (F1, Kurzanleitung) blendet den Rahmen aus und liegt oben
  await page.click('#btnTeam'); await rahmen().locator('#team:not([hidden])').waitFor();
  await page.focus('#btnTeam'); await page.keyboard.press('F1');
  await page.locator('#dlgBack.show').waitFor();
  assert.equal(await offen(), false, 'Dialog blendet den Rahmen aus');

  // 390 px: nur Zeichen und Zahl; Rahmen weiter unter dem Kopf
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await bauen({ ...mitGilt, ls: { ...mitGilt.ls, 'teamkit-morgen': iso } });
  await laden('Team – 2 neue Mitteilungen, heute ist etwas los');
  { const b = await page.locator('#btnTeam').boundingBox(); assert.ok(b.width < 70, `schmal nur Zeichen + Zahl (${Math.round(b.width)} px)`); }
  await foto('team-390-zahl.png');
  await page.click('#btnTeam'); await rahmen().locator('#team:not([hidden])').waitFor();
  { const [o, u, h] = await page.evaluate(() => { const r = document.getElementById('teamRahmen').getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; });
    assert.ok(o > 52 && Math.round(u) === h, `390 px: Rahmen unter Kopf und Schlagzeile bis unten (${Math.round(o)}–${Math.round(u)})`); }
  await foto('team-390-offen.png');
  await rahmen().locator('#btnZurueck').click();
  await page.waitForFunction(() => document.getElementById('teamRahmen').hidden);

  assert.deepEqual(gesehenVorher, [iso, '2025-01-01T00:00:00.000Z'], 'vor dem Öffnen nichts verändert');
  assert.deepEqual(errors, [], 'keine Fehler in der Konsole');
  await browser.close(); server.close();
  console.log(`OK TeamKit-Anbindung (${name}): Rahmen erst mit Archiv, Knopf leer/Punkt/Zahl/Guten Morgen, Schlagzeile nur „Wichtig“ (Ansehen, Gesehen), Öffnen/Schließen per Knopf, Esc und „Zurück“, Fokus zurück, Dialog oben, 1280 und 390 px`);
})().catch(e => { console.error(e); process.exit(1); });
