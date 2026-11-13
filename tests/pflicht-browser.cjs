// 1.49: Fehlende Pflichtangaben unter der zugeklappten Karte „Projektdaten“: node tests/pflicht-browser.cjs [chromium|webkit]
// Bis 3 fehlende Felder direkt ausfüllbar (gleicher Speicherweg wie das Formular), darüber nur genannt mit „Angaben öffnen“;
// Hinweis oben nennt die Felder und springt hinein; Meldung zum Arbeitszettel nennt, was noch von Hand fehlt; „Vor Spektron“ ohne Zeile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const name = process.argv[2] || 'chromium';
const root = path.join(__dirname, '..');
const ZWEI = '26.0201 Zwei Teststadt', VIELE = '26.0202 Viele Teststadt', HAND = '26.0142 Hand Teststadt', KOMPLETT = '26.0142 Komplett Teststadt',
  ALT = '26.0050 Alt Teststadt', FEHLER = '26.0203 Fehler Teststadt';
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const errors = [];
let schritt = 'Start', seite = null;

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYP[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await playwright[name].launch(); require('./spektron-start-test.cjs')(browser, '26.0100');   // ALT liegt davor
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage(); seite = page;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForSelector('#btnInfo');
  const kann = await page.evaluate(async () => {
    if (!('showDirectoryPicker' in window) || !navigator.storage || !navigator.storage.getDirectory) return false;
    try{ const r = await navigator.storage.getDirectory(); const h = await r.getFileHandle('probe', { create: true }); if (!h.createWritable) return false; await r.removeEntry('probe'); return true; }catch(e){ return false; }
  });
  if (!kann){ assert.deepEqual(errors, []); await browser.close(); server.close(); console.log(`OK (${name}, ohne Ordnerzugriff: nur Laden geprüft)`); return; }

  const voll = { objekt: 'EFH, Testweg 1, 99999 Teststadt', auftraggeber: 'Muster Versicherung AG', ortstermin: '2026-11-02', sachverstaendiger: 'Dr. S. Kasper' };
  await page.evaluate(async ([pjs, azProjekte]) => {
    const r = await navigator.storage.getDirectory();
    for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true });
    const archiv = await r.getDirectoryHandle('Mosaik Archivordner', { create: true });
    for (const [n, daten] of pjs){
      const d = await archiv.getDirectoryHandle(n, { create: true }); if (!daten) continue;
      const w = await (await d.getFileHandle('_Projekt.json', { create: true })).createWritable();
      await w.write(JSON.stringify({ format: 'mosaik-projekt', version: 1, ...daten })); await w.close();
    }
    const pdf = new Uint8Array(await (await fetch('tests/fixtures/arbeitszettel-voll.pdf')).arrayBuffer());
    for (const n of azProjekte){
      let d = await archiv.getDirectoryHandle(n, { create: true });
      for (const x of ['Arbeitszettel', 'AZ2600600', 'Revision 001']) d = await d.getDirectoryHandle(x, { create: true });
      const w = await (await d.getFileHandle('AZ.pdf', { create: true })).createWritable(); await w.write(pdf); await w.close();
    }
    window.showDirectoryPicker = async () => archiv;
  }, [[[ZWEI, voll], [VIELE, { objekt: 'Nur Objekt' }], [HAND, null], [KOMPLETT, { nutzung: 'Wohnen' }], [ALT, { objekt: 'Altbau' }], [FEHLER, voll]], [HAND, KOMPLETT]]);
  await page.locator('#btnStart, #btnArchive').first().click();

  const leseIn = n => page.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    try{ return JSON.parse(await (await (await p.getFileHandle('_Projekt.json')).getFile()).text()); }catch(e){ return null; } }, n);
  const oeffne = async n => {
    const vorher = await page.evaluate(n => MosaikArbeitszettel.pruefungen(n), n);
    await page.locator(`.proj[data-name="${n}"]`).click();
    await page.waitForFunction(([n, v]) => MosaikArbeitszettel.pruefungen(n) > v, [n, vorher]);
    await page.locator('#pjBox').waitFor({ state: 'attached' });
  };
  const sichtbar = () => page.evaluate(() => [...document.querySelectorAll('#pjPflicht .pfl-felder > label')].filter(l => !l.hidden && l.offsetParent).map(l => l.querySelector('[id^=pjq_]').id));
  const chip = () => page.locator('#pflichtFehlt').innerText();
  const zu = () => page.locator('#pjBox').evaluate(d => !d.open);
  const gespeichert = async (n, k, v) => { await page.waitForFunction(() => document.querySelector('#pjSave')?.classList.contains('ok')); assert.equal((await leseIn(n))[k], v, k); };

  // 1) zwei offene Felder: beide unter der zugeklappten Karte, Hinweis nennt sie
  schritt = 'zwei offene Felder';
  await oeffne(ZWEI);
  assert.ok(await zu(), 'Projektdaten bleiben zugeklappt');
  assert.deepEqual(await sichtbar(), ['pjq_nutzung', 'pjq_schadendatum']);
  assert.equal(await chip(), 'Fehlt: Nutzung · Schadendatum');
  assert.ok(await page.locator('#pjq_nutzung').evaluate(e => e.closest('label').classList.contains('pflicht-offen')), 'gelb wie im Formular');
  assert.match(await page.locator('#pjPflicht').innerText(), /Nutzung \(für die VdS-Einordnung\)[\s\S]*Pflicht[\s\S]*Schadendatum[\s\S]*nicht bekannt/);
  // Hinweis oben: Klick fokussiert das erste fehlende Feld, Karte bleibt zu; auch per Tastatur
  await page.locator('#pflichtFehlt').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pjq_nutzung'); assert.ok(await zu());
  await page.locator('#pjAendern').focus(); await page.locator('#pflichtFehlt').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pjq_nutzung', 'Tastatur');
  // Nutzung wählen → gespeichert, Feld weg, Fokus weiter zum Schadendatum, Hinweis aktualisiert, Karte bleibt zu
  schritt = 'Nutzung wählen';
  const wahl = await page.locator('#pjq_nutzung option').nth(1).getAttribute('value');
  await page.locator('#pjq_nutzung').selectOption(wahl);
  assert.deepEqual(await sichtbar(), ['pjq_schadendatum']);
  assert.equal(await chip(), 'Fehlt: Schadendatum');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pjq_schadendatum', 'Fokus springt zum nächsten offenen Feld');
  await gespeichert(ZWEI, 'nutzung', wahl);
  assert.ok(await zu(), 'Eingabe unter der Karte klappt sie nicht auf');
  assert.equal(await page.locator('#pj_nutzung').inputValue(), wahl, 'derselbe Wert im Formular');
  // Schadendatum „nicht bekannt“ → Zeile und Hinweis weg
  schritt = 'nicht bekannt';
  await page.locator('#pjq_schadendatum_nb').click();
  assert.ok(await page.locator('#pjPflicht').evaluate(e => e.hidden), 'Zeile weg');
  assert.ok(await page.locator('#pflichtFehlt').evaluate(e => e.hidden), 'Hinweis weg');
  await gespeichert(ZWEI, 'schadendatum', 'unbekannt');
  assert.equal(await page.locator('#pj_schadendatum_nb').getAttribute('aria-pressed'), 'true', 'Formular zeigt „nicht bekannt“');
  assert.match(await page.locator('[data-stufe=projekt] [data-stext]').textContent(), /Projektdaten vollständig/);
  // erneut öffnen (statt Neuladen): bleibt so
  await oeffne(VIELE); await oeffne(ZWEI);
  assert.ok(await page.locator('#pjPflicht').evaluate(e => e.hidden));
  assert.ok(await page.locator('#pflichtFehlt').evaluate(e => e.hidden));

  // 2) Datum tippen: Feld bleibt beim Schreiben stehen, verschwindet beim Verlassen; aufgeklappt nie doppelt
  schritt = 'Datum tippen';
  await page.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    const h = await p.getFileHandle('_Projekt.json'); const o = JSON.parse(await (await h.getFile()).text()); delete o.schadendatum;
    const w = await h.createWritable(); await w.write(JSON.stringify(o)); await w.close(); }, ZWEI);
  await oeffne(VIELE); await oeffne(ZWEI);
  assert.deepEqual(await sichtbar(), ['pjq_schadendatum']);
  await page.locator('#pjBox > summary').click();
  assert.deepEqual(await sichtbar(), [], 'aufgeklappt: Feld nur im Formular');
  assert.ok(await page.locator('#pj_schadendatum').isVisible());
  await page.locator('#pjBox > summary').click();
  assert.deepEqual(await sichtbar(), ['pjq_schadendatum']);
  await page.locator('#pjq_schadendatum').fill('2026-10-30');
  assert.deepEqual(await sichtbar(), ['pjq_schadendatum'], 'bleibt stehen, solange man darin ist');
  assert.equal(await chip(), '', 'Hinweis schon weg'); assert.ok(await page.locator('#pflichtFehlt').evaluate(e => e.hidden));
  await page.locator('#detail h2').click();   // Feld verlassen (Tab wandert im Datumsfeld nur zwischen Tag, Monat, Jahr)
  await page.waitForFunction(() => document.getElementById('pjPflicht').hidden);
  await gespeichert(ZWEI, 'schadendatum', '2026-10-30');
  assert.equal(await page.locator('#pj_schadendatum').inputValue(), '2026-10-30');

  // 3) mehr als 3 fehlen: keine Felder, nur genannt; „Angaben öffnen“ klappt auf am ersten fehlenden Feld
  schritt = 'viele fehlen';
  await oeffne(VIELE);
  assert.deepEqual(await sichtbar(), []);
  assert.equal(await chip(), '5 Pflichtangaben fehlen');
  assert.match(await page.locator('#pjPflicht .pfl-viele').innerText(), /Fehlt: Nutzung · Auftraggeber · Schadendatum · Ortstermin · Sachverständiger[\s\S]*Angaben öffnen/);
  await page.locator('#pjPflichtAuf').click();
  assert.ok(!await zu()); assert.equal(await page.evaluate(() => document.activeElement.id), 'pj_nutzung');
  assert.ok(!await page.locator('#pjPflicht').isVisible(), 'aufgeklappt keine Zeile');
  await page.locator('#pjBox > summary').click();
  await page.locator('#pflichtFehlt').click();   // bei mehr als 3: wie bisher Formular auf, erstes leeres Feld
  assert.ok(!await zu()); assert.equal(await page.evaluate(() => document.activeElement.id), 'pj_nutzung');

  // 4) Arbeitszettel automatisch übernommen: Meldung nennt, was noch von Hand fehlt (Klick springt dorthin); ohne Rest unverändert
  schritt = 'Arbeitszettel-Meldung';
  await oeffne(HAND);
  await page.waitForFunction(() => /übernommen/.test(document.querySelector('#azMeldung')?.textContent || ''));
  assert.match(await page.locator('#azMeldung').textContent(), /Arbeitszettel Revision 001 übernommen: \d+ Felder · Arbeitsauftrag in die Notizen eingetragen · noch von Hand: Nutzung/);
  assert.equal(await chip(), 'Fehlt: Nutzung'); assert.deepEqual(await sichtbar(), ['pjq_nutzung']);
  await page.locator('#azHand button').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pjq_nutzung');
  await page.locator('#pjq_nutzung').selectOption(wahl);
  assert.ok(!/noch von Hand/.test(await page.locator('#azMeldung').textContent()), 'ausgefüllt → Zusatz weg');
  await gespeichert(HAND, 'nutzung', wahl);
  await oeffne(KOMPLETT);
  await page.waitForFunction(() => /übernommen/.test(document.querySelector('#azMeldung')?.textContent || ''));
  assert.ok(!/noch von Hand/.test(await page.locator('#azMeldung').textContent()), 'nichts offen → Meldung wie in 1.48');
  assert.ok(await page.locator('#pjPflicht').evaluate(e => e.hidden));

  // 5) Vor Spektron: keine Zeile, Hinweis wie gewohnt
  schritt = 'Vor Spektron';
  await page.locator('#vorToggle').click();
  await page.locator(`.proj[data-name="${ALT}"]`).click();
  await page.waitForFunction(n => document.querySelector('.proj.active')?.dataset.name === n, ALT);
  await page.waitForFunction(() => /26\.0050/.test(document.querySelector('#detail h2')?.textContent || '') && document.querySelector('#jetzt.vor') && /Pflichtangaben fehlen/.test(document.getElementById('pflichtFehlt')?.textContent || ''));
  assert.equal(await page.locator('#pjPflicht').count(), 0, 'keine Eingabezeile');
  assert.equal(await chip(), '5 Pflichtangaben fehlen');

  // 6) Speichern scheitert: Meldung wie bisher, Eingabe bleibt stehen, Karte bleibt zu
  schritt = 'Speichern scheitert';
  await oeffne(FEHLER);
  await page.evaluate(() => { window.__cw = FileSystemFileHandle.prototype.createWritable; FileSystemFileHandle.prototype.createWritable = async function(){ throw new DOMException('Die Datei ist von einem anderen Programm gesperrt.', 'NoModificationAllowedError'); }; });
  await page.locator('#pjq_schadendatum').fill('2026-10-01'); await page.locator('#detail h2').click();
  await page.locator('#pjSave.err').waitFor({ timeout: 5000 });
  assert.match(await page.locator('#pjAttention').innerText(), /Projektdaten nicht gespeichert: .*gesperrt/);
  assert.equal(await page.locator('#pj_schadendatum').inputValue(), '2026-10-01', 'Eingabe bleibt im Formular');
  assert.ok(await zu());
  assert.equal((await leseIn(FEHLER)).schadendatum, undefined, 'nichts geschrieben');
  await page.evaluate(() => { FileSystemFileHandle.prototype.createWritable = window.__cw; });

  // 7) schmales Fenster: Felder untereinander, nichts läuft über
  schritt = 'schmal';
  await oeffne(ZWEI);
  await page.evaluate(async n => { const p = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(n);
    const h = await p.getFileHandle('_Projekt.json'); const o = JSON.parse(await (await h.getFile()).text()); delete o.schadendatum; delete o.nutzung;
    const w = await h.createWritable(); await w.write(JSON.stringify(o)); await w.close(); }, ZWEI);
  await oeffne(VIELE); await oeffne(ZWEI);
  await page.setViewportSize({ width: 420, height: 900 });
  const [a, b] = await page.evaluate(() => ['pjq_nutzung', 'pjq_schadendatum'].map(id => document.getElementById(id).closest('label').getBoundingClientRect().toJSON()));
  assert.ok(b.top >= a.bottom - 1, 'untereinander');
  assert.ok(await page.evaluate(() => { const z = document.getElementById('pjPflicht'); return z.scrollWidth <= z.clientWidth + 1; }), 'kein Überlauf');
  await page.setViewportSize({ width: 1400, height: 1000 });
  const shot = process.env.SHOT; if (shot) await page.locator('.pz-projektdaten').screenshot({ path: shot });

  assert.deepEqual(errors, []);
  await browser.close(); server.close();
  console.log(`OK (${name}): 1.49 Pflichtangaben unter der zugeklappten Karte – zwei Felder ausfüllen (Auswahl, „nicht bekannt“, Datum), Hinweis nennt Felder und springt (Maus, Tastatur), aufgeklappt nie doppelt, mehr als 3 nur genannt mit „Angaben öffnen“, Arbeitszettel-Meldung „noch von Hand“, Vor Spektron ohne Zeile, Speicherfehler behält Eingabe, schmales Fenster`);
})().catch(async e => {
  console.error(e);
  let zustand = '';
  try{ zustand = await seite.evaluate(() => ['aktiv=' + (document.querySelector('.proj.active')?.dataset.name || '–'), 'chip=' + (document.getElementById('pflichtFehlt')?.textContent || '–'),
    'zeile=' + (document.getElementById('pjPflicht')?.innerText || '–').replace(/\s+/g, ' ').slice(0, 120), 'fokus=' + (document.activeElement?.id || '–')].join(' | ')); }catch(_){ zustand = 'Seite nicht lesbar'; }
  console.log(`::error title=Browsertest Pflichtangaben ${name}::${schritt}: ${String(e && e.message || e).split('\n')[0]} · ${zustand} · Seitenfehler: ${errors.join(' | ').slice(0, 300)}`); process.exit(1);
});
