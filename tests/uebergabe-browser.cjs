// Vom Bericht zum Büro (1.38): Sprung aus BerichtKit (#projekt=…&uebergabe=…), Prüfberichte laut BerichtKit als Anlagen,
// Lücken-Prüfung der Word-Datei vor dem Übergeben, Stufe 4 „Mitteilung vom … erstellt – ans Büro übergeben“.
// Echte Chromium-Seite auf einem synthetischen Archiv (Dateizugriff über eine Brücke zum Testordner, auch binär).
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), http = require('node:http'), pw = require('playwright');
const root = path.resolve(__dirname, '..'), P = '26.0600 Teststadt Ste', Q = '26.0601 Nebenort Ste';
const MT = '1._Mitteilung_26.0600.docx', fixture = n => fs.readFile(path.join(__dirname, 'fixtures', n));
(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'uebergabe-'));
  const in_ = (...t) => path.join(tmp, P, ...t);
  for (const sub of ['Mitteilungen', 'Laborergebnisse', 'Fotos', 'Laboraufträge', path.join('_Spektron', 'BerichtKit')]) await fs.mkdir(in_(sub), { recursive: true });
  await fs.mkdir(path.join(tmp, Q, 'Mitteilungen'), { recursive: true });
  await fs.writeFile(in_('_Projekt.json'), JSON.stringify({ format: 'mosaik-projekt', version: 1, objekt: 'Musterweg 1, Teststadt', auftraggeber: 'Beispiel Versicherung AG' }));
  const zeit = async (rel, iso) => { const d = new Date(iso); await fs.utimes(in_(...rel.split('/')), d, d); };
  await fs.writeFile(in_('Mitteilungen', MT), await fixture('1._Mitteilung_Luecken.docx')); await zeit('Mitteilungen/' + MT, '2026-10-30T10:00:00');
  await fs.writeFile(in_('Mitteilungen', 'Gutachten alt.docx'), 'Synthetic placeholder – keine echte Word-Datei'); await zeit('Mitteilungen/Gutachten alt.docx', '2026-10-01T10:00:00');
  await fs.writeFile(in_('Mitteilungen', 'Notizen neu.docx'), 'Synthetic placeholder'); await zeit('Mitteilungen/Notizen neu.docx', '2026-10-30T11:00:00');   // neueste Datei – der Link wählt trotzdem die Mitteilung
  for (const n of ['AR-777-2026-1-01', 'AR-777-2026-2-01']){ await fs.writeFile(in_('Laborergebnisse', n + '.pdf'), '%PDF'); await fs.writeFile(in_('Laborergebnisse', n + '.xml'), '<x/>'); }
  // in ResultKit vollständig übernommen (Dateistand wie in ResultKit: Name|Größe|Änderungszeit der Prüfberichte)
  const stand = [];
  for (const n of (await fs.readdir(in_('Laborergebnisse'))).sort((a, b) => a.localeCompare(b))){ await zeit('Laborergebnisse/' + n, '2026-10-28T08:00:00'); const st = await fs.stat(in_('Laborergebnisse', n)); stand.push(`${n}|${st.size}|${Math.floor(st.mtimeMs)}`); }
  await fs.writeFile(in_('Laborergebnisse', '_Ergebnisse.json'), JSON.stringify({ format: 'spektron-ergebnisse', version: 1, vollstaendig: true, offen: [], berichte: [], stand: stand.join('\n') }));
  await fs.writeFile(in_('_Spektron', 'BerichtKit', '_BerichtKit.json'), JSON.stringify({ format: 'spektron-bericht', version: 1, projekt: '26.0600', form: {},
    berichte: [{ datei: MT, am: '2026-10-29T09:00:00.000Z', anlagen: ['Laborergebnisse/AR-777-2026-2-01.pdf'] },   // ältere Fassung gleichen Namens
      { datei: MT, am: '2026-10-30T09:00:00.000Z', von: 'Ste', anlagen: ['Laborergebnisse/AR-777-2026-1-01.pdf'], luecken: 2 }] }));

  const server = http.createServer(async (req, res) => { try{ const u = new URL(req.url, 'http://local'); let file = path.resolve(root, decodeURIComponent(u.pathname).slice(1) || 'index.html'); if (!file.startsWith(root + path.sep)) throw Error(); if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream'); res.end(await fs.readFile(file)); }catch{ res.statusCode = 404; res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await pw.chromium.launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE, args: ['--no-sandbox'] } : {}); const errors = [];
  try{
    const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin', locale: 'de-DE', serviceWorkers: 'block' });
    await c.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await c.exposeBinding('__io', async (_, a) => {
      const abs = path.resolve(tmp, a.rel || '.'); if (abs !== tmp && !abs.startsWith(tmp + path.sep)) throw Error('outside test archive');
      try{ switch (a.op){
        case 'dir': if (a.create) await fs.mkdir(abs, { recursive: true }); if (!(await fs.stat(abs)).isDirectory()) throw Error('not directory'); return true;
        case 'file': if (a.create) await fs.appendFile(abs, ''); if (!(await fs.stat(abs)).isFile()) throw Error('not file'); return true;
        case 'list': return (await fs.readdir(abs, { withFileTypes: true })).map(x => ({ name: x.name, kind: x.isDirectory() ? 'directory' : 'file' }));
        case 'read': { const b = await fs.readFile(abs); return { b64: b.toString('base64'), mtime: Math.floor((await fs.stat(abs)).mtimeMs) }; }
        case 'write': await fs.writeFile(abs, a.text); return true;
        case 'remove': await fs.rm(abs, { recursive: true }); return true;
      } }catch(e){ if (e.code === 'ENOENT') return { notfound: true }; throw e; }
    });
    await c.addInitScript(() => {
      localStorage.setItem('spektron-ich', 'Ste');
      const io = async a => { const r = await window.__io(a); if (r && r.notfound) throw new DOMException('Missing', 'NotFoundError'); return r; };
      const bytes = b64 => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
      class H { constructor(rel, kind){ this.rel = rel; this.kind = kind; this.name = rel.split('/').at(-1) || 'Testarchiv'; } async queryPermission(){ return 'granted'; } async requestPermission(){ return 'granted'; } async isSameEntry(h){ return h.rel === this.rel; } }
      class F extends H { constructor(rel){ super(rel, 'file'); }
        async getFile(){ const r = await io({ op: 'read', rel: this.rel }), b = bytes(r.b64); return { name: this.name, size: b.length, lastModified: r.mtime, text: async () => new TextDecoder().decode(b), arrayBuffer: async () => b.slice().buffer }; }
        async createWritable(){ let text = ''; const rel = this.rel; return { write: async v => { text = typeof v === 'string' ? v : new TextDecoder().decode(v); }, abort: async () => {}, close: async () => { await io({ op: 'write', rel, text }); } }; } }
      class D extends H { constructor(rel){ super(rel, 'directory'); } child(n){ return (this.rel ? this.rel + '/' : '') + n; }
        async getDirectoryHandle(n, o = {}){ const rel = this.child(n); await io({ op: 'dir', rel, create: o.create }); return new D(rel); }
        async getFileHandle(n, o = {}){ const rel = this.child(n); await io({ op: 'file', rel, create: o.create }); return new F(rel); }
        async removeEntry(n){ await io({ op: 'remove', rel: this.child(n) }); }
        async *values(){ for (const h of await io({ op: 'list', rel: this.rel })) yield h.kind === 'directory' ? new D(this.child(h.name)) : new F(this.child(h.name)); }
        async resolve(h){ const pre = this.rel ? this.rel + '/' : ''; return h.rel.startsWith(pre) ? h.rel.slice(pre.length).split('/') : null; } }
      window.showDirectoryPicker = async () => new D('');
    });
    const page = await c.newPage(); page.on('pageerror', e => errors.push(e.message));
    const stext = k => page.locator(`[data-stufe="${k}"] [data-stext]`).textContent();
    const aufgaben = async () => { try{ return await fs.readdir(in_('_Spektron', 'Buero', 'aufgaben')); }catch{ return []; } };
    const anl = async () => page.locator('#bueroPanel [data-ab-anl] label').evaluateAll(l => l.map(x => [x.textContent.trim().replace(/\s+/g, ' '), x.querySelector('input').checked]));

    // 1. Link aus BerichtKit (wie dort gebaut: Ordnername und Pfad mit encodeURIComponent)
    await page.goto(`${base}/index.html#projekt=${encodeURIComponent(P)}&uebergabe=${encodeURIComponent('Mitteilungen/' + MT)}`);
    await page.locator('#btnStart').click();
    await page.waitForFunction(m => document.querySelector('#bueroPanel [data-ab-word]')?.value === 'Mitteilungen/' + m, MT);
    assert.equal(await page.locator('.proj.active').getAttribute('data-name'), P, 'Projekt aus dem Link gewählt');
    assert.ok(await page.locator('#bueroPanel [data-ab-form]').evaluate(e => e.open), 'Übergabe aufgeklappt');
    assert.equal(await page.evaluate(() => location.hash), '', 'Fragment wirkt einmal');
    assert.deepEqual(await anl(), [['Gutachten alt.docx Mitteilungen', false], ['Notizen neu.docx Mitteilungen', false],
      ['AR-777-2026-1-01.pdf Laborergebnisse · Prüfbericht laut BerichtKit', true], ['AR-777-2026-2-01.pdf Laborergebnisse', false]],
      'Prüfbericht aus dem neuesten BerichtKit-Eintrag zur Datei angehakt; in „Mitteilungen“ alles außer der gewählten Datei');
    // Stufe 4 und „Jetzt dran“: Mitteilung erstellt, noch nicht übergeben
    await page.waitForFunction(() => /^Mitteilung vom 30\.10\. erstellt – ans Büro übergeben$/.test(document.querySelector('[data-stufe=gutachten] [data-stext]').textContent));
    assert.equal(await page.locator('#jetztGo').innerText(), 'Ans Büro übergeben →');
    assert.match(await page.locator('#jetzt').innerText(), /Gutachten ans Büro übergeben/);

    // 2. Andere Word-Datei gewählt: keine BerichtKit-Vorschläge, die Mitteilung selbst wird Anlage-Kandidat
    await page.locator('[data-ab-word]').selectOption('Mitteilungen/Gutachten alt.docx');
    assert.deepEqual(await anl(), [[MT + ' Mitteilungen', false], ['Notizen neu.docx Mitteilungen', false], ['AR-777-2026-1-01.pdf Laborergebnisse', false], ['AR-777-2026-2-01.pdf Laborergebnisse', false]]);
    // … keine echte .docx: nicht prüfbar → Rückfrage, Abbrechen schreibt nichts
    await page.locator('[data-ab-los]').click();
    await page.locator('#dialog h3').filter({ hasText: 'Word-Datei nicht geprüft' }).waitFor();
    assert.match(await page.locator('#dialog').innerText(), /„Gutachten alt\.docx“ ließ sich nicht auf offene Lücken prüfen \(keine Word-Datei/);
    await page.locator('#dNo').click(); await page.waitForTimeout(300);
    assert.deepEqual(await aufgaben(), [], 'abgebrochen: keine Aufgabe');
    assert.equal(await page.locator('[data-ab-los]').isDisabled(), false);

    // 3. Zurück zur Mitteilung: Haken laut BerichtKit wieder da. Lücken in der Word-Datei → Rückfrage mit Liste
    await page.locator('[data-ab-word]').selectOption('Mitteilungen/' + MT);
    assert.equal((await anl())[2][1], true);
    await page.locator('#bueroPanel [data-ab-anl] input[data-ab-anl-rel="Laborergebnisse/AR-777-2026-2-01.pdf"]').check();   // selbst angehakt bleibt
    await page.locator('[data-ab-los]').click();
    await page.locator('#dialog h3').filter({ hasText: 'Noch Lücken im Gutachten' }).waitFor();
    assert.deepEqual(await page.locator('#dialog .ab-luecken li').allInnerTexts(), ['[Eingangsdatum] (4×)', '[Sachverständige(r)]']);
    assert.match(await page.locator('#dialog').innerText(), /enthält noch 2 gelb markierte Lücken/);
    await page.locator('#dNo').click(); await page.waitForTimeout(300);
    assert.deepEqual(await aufgaben(), [], 'abgebrochen: keine Aufgabe');

    // 4. In Word ausgefüllt (gleicher Name): keine Rückfrage, Aufgabe mit Word-Datei und beiden Prüfberichten
    await fs.writeFile(in_('Mitteilungen', MT), await fixture('1._Mitteilung_fertig.docx')); await zeit('Mitteilungen/' + MT, '2026-10-30T10:30:00');
    await page.locator('[data-ab-los]').click();
    await page.locator('#bueroPanel [data-ab-msg]').filter({ hasText: '✓ Ans Büro übergeben' }).waitFor();
    assert.equal(await page.locator('#dialog h3').count(), 0, 'keine Rückfrage');
    const liste = await aufgaben(); assert.equal(liste.length, 1);
    const auf = JSON.parse(await fs.readFile(in_('_Spektron', 'Buero', 'aufgaben', liste[0]), 'utf8'));
    const inhalt = JSON.stringify(auf);
    assert.ok(inhalt.includes('"Mitteilungen/' + MT + '"'), 'Word-Datei in der Aufgabe');
    for (const a of ['Laborergebnisse/AR-777-2026-1-01.pdf', 'Laborergebnisse/AR-777-2026-2-01.pdf']) assert.ok(inhalt.includes(JSON.stringify(a)), 'Anlage: ' + a);
    // Stufe 4 jetzt erledigt, Büro wartet
    await page.waitForFunction(() => /^Gutachten übergeben/.test(document.querySelector('[data-stufe=gutachten] [data-stext]').textContent), null, { timeout: 10000 });
    assert.match(await stext('buero'), /^Beim Büro/);

    // 5. Später eine 2. Mitteilung: Stufe 4 wieder „ans Büro übergeben“ (nach dem Zurückkehren ins Fenster)
    await fs.writeFile(in_('Mitteilungen', '2._Mitteilung_26.0600.docx'), await fixture('1._Mitteilung_fertig.docx')); await zeit('Mitteilungen/2._Mitteilung_26.0600.docx', '2099-01-05T10:00:00');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => /^Mitteilung vom 05\.01\. erstellt – ans Büro übergeben$/.test(document.querySelector('[data-stufe=gutachten] [data-stext]').textContent), null, { timeout: 10000 });

    // 6. Fragment, während die Projektzentrale schon offen ist; unbekanntes Projekt → Hinweis, Auswahl bleibt
    await page.evaluate(n => { location.hash = 'projekt=' + encodeURIComponent(n); }, Q);
    await page.waitForFunction(n => document.querySelector('.proj.active')?.dataset.name === n, Q);
    await page.evaluate(() => { location.hash = 'projekt=' + encodeURIComponent('26.9999 Gibtsnicht'); });
    await page.locator('#banner.err').filter({ hasText: '„26.9999 Gibtsnicht“ aus dem Link liegt nicht im Archivordner' }).waitFor();
    assert.equal(await page.locator('.proj.active').getAttribute('data-name'), Q);
    assert.deepEqual(errors, []);
    console.log('OK Übergabe aus BerichtKit: Sprung mit Word-Datei, Prüfberichte laut BerichtKit, Lücken-Rückfrage (Liste, nicht prüfbar, abbrechen), Aufgabe mit Anlagen, Stufe 4 vorher/nachher/2. Mitteilung, Fragment bei offener Seite');
  } finally { await browser.close(); server.close(); await fs.rm(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
