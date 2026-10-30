// Umzug in „_Spektron“ gegen echte temporäre Ordner (synthetischer File-System-Access-Zugriff über node:fs).
// Prüft: vollständiger Umzug, Büro-Dateien unberührt, Wiederholbarkeit, Abbruch vor und nach dem Vermerk, Nachzügler,
// Projekte „Vor Spektron“, Vorschau ohne Wirkung.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const root = path.join(__dirname, '..');
const S = require(path.join(root, 'spektron-ordner.js')), U = require(path.join(root, 'spektron-umzug.js'));
const missing = n => Object.assign(Error('missing ' + n), { name: 'NotFoundError' });
const hooks = { beimLoeschen: null, beimSchreiben: null };
class Datei{ constructor(p){ this.p = p; this.name = path.basename(p); this.kind = 'file'; }
  async getFile(){ const b = await fs.readFile(this.p), st = await fs.stat(this.p); return { name: this.name, size: b.length, lastModified: st.mtimeMs, arrayBuffer: async () => Uint8Array.from(b).buffer, text: async () => b.toString('utf8') }; }
  async createWritable(o){ const p = this.p, keep = o && o.keepExistingData; let buf = keep ? await fs.readFile(p) : Buffer.alloc(0);
    return { write: async v => { if (hooks.beimSchreiben) await hooks.beimSchreiben(p); if (v && typeof v === 'object' && v.type === 'write'){ const d = Buffer.from(typeof v.data === 'string' ? v.data : v.data); const pos = v.position || 0; const n = Buffer.alloc(Math.max(buf.length, pos + d.length)); buf.copy(n); d.copy(n, pos); buf = n; } else buf = Buffer.from(typeof v === 'string' ? v : v); },
      close: async () => { await fs.writeFile(p, buf); }, abort: async () => {} }; } }
class Ordner{ constructor(p){ this.p = p; this.name = path.basename(p); this.kind = 'directory'; }
  async *values(){ for (const e of await fs.readdir(this.p, { withFileTypes: true })) yield e.isDirectory() ? new Ordner(path.join(this.p, e.name)) : new Datei(path.join(this.p, e.name)); }
  async getDirectoryHandle(n, o){ const p = path.join(this.p, n); try{ if (!(await fs.stat(p)).isDirectory()) throw Object.assign(Error('file'), { name: 'TypeMismatchError' }); return new Ordner(p); }catch(e){ if (e.code !== 'ENOENT') throw e; if (!(o && o.create)) throw missing(n); await fs.mkdir(p); return new Ordner(p); } }
  async getFileHandle(n, o){ const p = path.join(this.p, n); try{ if ((await fs.stat(p)).isDirectory()) throw Object.assign(Error('dir'), { name: 'TypeMismatchError' }); return new Datei(p); }catch(e){ if (e.code !== 'ENOENT') throw e; if (!(o && o.create)) throw missing(n); await fs.writeFile(p, ''); return new Datei(p); } }
  async removeEntry(n, o){ const p = path.join(this.p, n); if (hooks.beimLoeschen) await hooks.beimLoeschen(p); if ((await fs.stat(p)).isDirectory()){ if (o && o.recursive) await fs.rm(p, { recursive: true }); else await fs.rmdir(p); } else await fs.unlink(p); } }
const N = '26.0560 Stollenstr. Gladbeck Dr.Ka';
const FIX = {
  '_Projekt.json': '{"objekt":"Haus"}', '_Projekt_Sicherungen/vorher_a.json': '{}',
  'Fotos/_Bildumbenenner.json': '{"bilder":{}}', 'Fotos/_FotoKit_Fassungen/kandidat_1.json': '{}', 'Fotos/IMG_1.jpg': 'JPEGDATA', 'Fotos/_aussortiert/IMG_2.jpg': 'JPEG2', 'Fotos/Pruefsummen_Originale_2026-10-28_1200.sha256': 'h *IMG_1.jpg',
  'Laboraufträge/26.0560_2026-10-28_Daten.json': '{"proben":[]}', 'Laboraufträge/26.0560_PAK_Laborübergabe.xls': 'XLS',
  'Feldprotokolle/_Ablage-Protokoll.txt': 'log', 'Feldprotokolle/scan.pdf': 'PDF',
  'Laborergebnisse/_Ergebnisse.json': '{"format":"spektron-ergebnisse"}', 'Laborergebnisse/AR-26-1.xml': '<x/>', 'Laborergebnisse/AR-26-1.pdf': 'PDF',
  ['Pläne/Probenplan ' + N + '.probenplan']: '{"v":1}', 'Pläne/Plan EG.png': 'PNG', ['Pläne/Probenplan ' + N + ' (vorher 2026-10-28 10-00-00-000 abc).probenplan']: '{"v":0}',
  'Abrechnung/Aufwand_DRKA.json': '{"format":"aufwandkit-zeiten"}', 'Abrechnung/_Abrechnung.json': '{}', 'Abrechnung/26.0560_Aufwand_2026-10-28.json': '{"quellen":[]}', 'Abrechnung/26.0560_Aufwand_2026-10-28.csv': 'a;b', 'Abrechnung/_BelegKit_Sicherungen/x.json': '{}',
  '_Buero/aufgaben/a1.json': '{"typ":"aufgabe"}', '_Buero/vermerke/v1.json': '{"typ":"vermerk"}', '_Buero/0f0e0d0c-1111-4222-8333-944455556666/auftrag.json': '{"alt":1}',
  'Mitteilungen/_Anlagen-Protokoll.txt': 'p', 'Mitteilungen/_BerichtKit.json': '{"format":"spektron-bericht"}', 'Mitteilungen/Gutachten.docx': 'DOCX', 'Emails/mail.msg': 'MSG'
};
async function fixture(name = N, dateien = FIX){
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'spektron-umzug-')), dir = path.join(tmp, name);
  for (const [rel, t] of Object.entries(dateien)){ await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true }); await fs.writeFile(path.join(dir, rel), t); }
  return { tmp, archiv: new Ordner(tmp), projekt: new Ordner(dir), dir };
}
const ex = async p => { try{ await fs.access(p); return true; }catch{ return false; } };
async function alle(d, pre = ''){ const r = {}; for (const e of await fs.readdir(d, { withFileTypes: true })){ const p = path.join(d, e.name); if (e.isDirectory()) Object.assign(r, await alle(p, pre + e.name + '/')); else r[pre + e.name] = (await fs.readFile(p)).toString(); } return r; }
let fertig = false; process.on('exit', () => { if (!fertig){ console.error('FEHLER: Test nicht bis zum Ende gelaufen (hängendes Promise?)'); process.exitCode = 1; } });
const ok = async (t, fn) => { hooks.beimLoeschen = null; hooks.beimSchreiben = null; await fn(); console.log('OK ' + t); };

(async () => {
  await ok('Vollständiger Umzug: App-Dateien in _Spektron, Büro-Dateien unberührt, Vermerk, Hinweis, Protokoll', async () => {
    const f = await fixture(), log = await U.logSchreiber(f.archiv), vorher = await alle(f.dir);
    const r = await U.projektUmziehen(f.projekt, { von: 'Dr. Ka', log: log.zeile }); await log.speichern();
    assert.deepEqual(r.fehler, []); for (const b of r.bereiche){ assert.deepEqual(b.fehler, [], b.bereich); assert.deepEqual(b.konflikte, [], b.bereich); }
    const nachher = await alle(f.dir);
    const erwartet = {
      '_Spektron/_Projekt.json': FIX['_Projekt.json'], '_Spektron/_Projekt_Sicherungen/vorher_a.json': '{}',
      '_Spektron/FotoKit/_Bildumbenenner.json': FIX['Fotos/_Bildumbenenner.json'], '_Spektron/FotoKit/_FotoKit_Fassungen/kandidat_1.json': '{}', '_Spektron/FotoKit/Pruefsummen/Pruefsummen_Originale_2026-10-28_1200.sha256': 'h *IMG_1.jpg',
      '_Spektron/LabelKit/26.0560_2026-10-28_Daten.json': FIX['Laboraufträge/26.0560_2026-10-28_Daten.json'], '_Spektron/LabelKit/_Ablage-Protokoll.txt': 'log',
      '_Spektron/ResultKit/_Ergebnisse.json': FIX['Laborergebnisse/_Ergebnisse.json'],
      ['_Spektron/PlanKit/Probenplan ' + N + '.probenplan']: '{"v":1}', ['_Spektron/PlanKit/Probenplan ' + N + ' (vorher 2026-10-28 10-00-00-000 abc).probenplan']: '{"v":0}',
      '_Spektron/BelegKit/Aufwand_DRKA.json': FIX['Abrechnung/Aufwand_DRKA.json'], '_Spektron/BelegKit/_Abrechnung.json': '{}', '_Spektron/BelegKit/26.0560_Aufwand_2026-10-28.json': '{"quellen":[]}', '_Spektron/BelegKit/_BelegKit_Sicherungen/x.json': '{}',
      '_Spektron/Buero/aufgaben/a1.json': FIX['_Buero/aufgaben/a1.json'], '_Spektron/Buero/vermerke/v1.json': FIX['_Buero/vermerke/v1.json'], '_Spektron/Buero/0f0e0d0c-1111-4222-8333-944455556666/auftrag.json': '{"alt":1}',
      '_Spektron/Protokolle/_Anlagen-Protokoll.txt': 'p',
      '_Spektron/BerichtKit/_BerichtKit.json': '{"format":"spektron-bericht"}',
      // bleibt, wo es ist
      'Fotos/IMG_1.jpg': 'JPEGDATA', 'Fotos/_aussortiert/IMG_2.jpg': 'JPEG2', 'Laboraufträge/26.0560_PAK_Laborübergabe.xls': 'XLS', 'Feldprotokolle/scan.pdf': 'PDF',
      'Laborergebnisse/AR-26-1.xml': '<x/>', 'Laborergebnisse/AR-26-1.pdf': 'PDF', 'Pläne/Plan EG.png': 'PNG', 'Abrechnung/26.0560_Aufwand_2026-10-28.csv': 'a;b',
      'Mitteilungen/Gutachten.docx': 'DOCX', 'Emails/mail.msg': 'MSG' };
    for (const [k, v] of Object.entries(erwartet)) assert.equal(nachher[k], v, k);
    assert.ok(nachher['_Spektron/BITTE NICHT ANFASSEN.txt'], 'Hinweisdatei');
    const vermerk = JSON.parse(nachher['_Spektron/_Umzug.json']); assert.equal(vermerk.format, 'spektron-umzug'); assert.deepEqual(Object.keys(vermerk.bereiche).sort(), Object.keys(S.BEREICHE).sort()); assert.equal(vermerk.bereiche.projekt.von, 'Dr. Ka');
    const uebrig = Object.keys(nachher).filter(k => !(k in erwartet) && !k.startsWith('_Spektron/'));
    assert.deepEqual(uebrig, [], 'nichts Altes übrig: ' + uebrig.join(', '));
    assert.equal(await ex(path.join(f.dir, '_Buero')), false, '_Buero entfernt'); assert.equal(await ex(path.join(f.dir, '_Projekt_Sicherungen')), false);
    for (const d of ['Fotos', 'Pläne', 'Laboraufträge', 'Laborergebnisse', 'Mitteilungen', 'Feldprotokolle', 'Abrechnung', 'Fotos/_aussortiert']) assert.ok(await ex(path.join(f.dir, d)), d + ' bleibt');
    const logText = (await fs.readFile(path.join(f.tmp, '_Spektron-Umzug.log'))).toString();
    assert.ok(logText.startsWith('Spektron-Umzug'), 'Protokollkopf'); assert.equal((logText.match(/kopiert/g) || []).length, Object.keys(vorher).length - 10, 'je App-Datei eine Zeile'); assert.equal((logText.match(/gelöscht/g) || []).length, Object.keys(vorher).length - 10);
    for (const b of Object.keys(S.BEREICHE)) assert.equal((await S.ort(f.projekt, b)).wo, 'neu', b + ' jetzt neu');
    // wiederholen: nichts mehr zu tun
    const r2 = await U.projektUmziehen(f.projekt, {}); assert.deepEqual(r2.bereiche, []); assert.deepEqual(await alle(f.dir), nachher);
  });

  await ok('Vorschau (trocken) verändert nichts', async () => {
    const f = await fixture(), vorher = await alle(f.dir);
    const r = await U.projektUmziehen(f.projekt, { trocken: true });
    assert.equal(r.bereiche.length, Object.keys(S.BEREICHE).length); assert.deepEqual(await alle(f.dir), vorher); assert.equal(await ex(path.join(f.dir, '_Spektron')), false);
  });

  await ok('Projekt „Vor Spektron“: Fehler, nichts angefasst', async () => {
    const f = await fixture('26.0400 Köln Nad'), vorher = await alle(f.dir);
    const r = await U.projektUmziehen(f.projekt, {}); assert.equal(r.fehler.length, 1); assert.deepEqual(await alle(f.dir), vorher);
  });

  await ok('Abbruch beim Kopieren (vor dem Vermerk): Originale bleiben, kein Vermerk, alter Ort gilt; Wiederholung heilt', async () => {
    const f = await fixture(); let n = 0;
    hooks.beimSchreiben = async p => { if (p.includes('_Spektron') && !p.endsWith('BITTE NICHT ANFASSEN.txt') && ++n === 3) throw Error('Platte voll'); };
    const r = await U.projektUmziehen(f.projekt, {});
    assert.ok(r.bereiche.some(b => b.fehler.length), 'Fehler gemeldet');
    assert.ok(await ex(path.join(f.dir, '_Projekt.json')) || await ex(path.join(f.dir, 'Fotos/_Bildumbenenner.json')), 'Originale der fehlgeschlagenen Bereiche noch da');
    for (const b of r.bereiche) if (b.fehler.length){ const o = await S.ort(f.projekt, b.bereich); assert.equal(o.wo, 'alt', b.bereich + ': ohne Vermerk zählt der alte Ort'); }
    hooks.beimSchreiben = null;
    const r2 = await U.projektUmziehen(f.projekt, {}); assert.deepEqual(r2.fehler, []); for (const b of r2.bereiche) assert.deepEqual(b.fehler, []);
    const nachher = await alle(f.dir); assert.equal(nachher['_Spektron/_Projekt.json'], FIX['_Projekt.json']); assert.equal(await ex(path.join(f.dir, '_Projekt.json')), false);
  });

  await ok('Abbruch beim Löschen (nach dem Vermerk): Kopien gelten, Originale bleiben, Wiederholung löscht identische', async () => {
    const f = await fixture();
    hooks.beimLoeschen = async () => { throw Error('Zugriff verweigert'); };
    const r = await U.projektUmziehen(f.projekt, {});
    assert.ok(r.bereiche.every(b => b.geloescht === 0)); assert.ok(r.bereiche.some(b => b.fehler.length));
    assert.ok(await ex(path.join(f.dir, '_Projekt.json')) && await ex(path.join(f.dir, '_Spektron/_Projekt.json')), 'beide da');
    const o = await S.ort(f.projekt, 'projekt'); assert.equal(o.wo, 'neu'); assert.equal(o.konflikt, true); assert.equal(o.umgezogen, true);
    hooks.beimLoeschen = null;
    const r2 = await U.projektUmziehen(f.projekt, {}); assert.deepEqual(r2.fehler, []);
    assert.ok(r2.bereiche.every(b => b.kopiert === 0 && b.konflikte.length === 0), 'nur noch gelöscht'); assert.equal(await ex(path.join(f.dir, '_Projekt.json')), false);
    assert.equal((await S.ort(f.projekt, 'projekt')).konflikt, false);
  });

  await ok('Nachzügler: gleicher Name, anderer Inhalt → beide bleiben, gemeldet; gleicher Inhalt → gelöscht', async () => {
    const f = await fixture(); await U.projektUmziehen(f.projekt, {});
    await fs.writeFile(path.join(f.dir, '_Projekt.json'), '{"objekt":"NACHZUEGLER"}');           // alte App-Version schrieb nach dem Umzug
    await fs.mkdir(path.join(f.dir, 'Laborergebnisse'), { recursive: true }); await fs.writeFile(path.join(f.dir, 'Laborergebnisse/_Ergebnisse.json'), FIX['Laborergebnisse/_Ergebnisse.json']);   // identisch
    const r = await U.projektUmziehen(f.projekt, {});
    const pj = r.bereiche.find(b => b.bereich === 'projekt'), rk = r.bereiche.find(b => b.bereich === 'resultkit');
    assert.equal(pj.konflikte.length, 1); assert.equal(pj.konflikte[0].datei, '_Projekt.json'); assert.equal(pj.konflikte[0].altNeuer, true); assert.equal(pj.geloescht, 0);
    assert.equal((await fs.readFile(path.join(f.dir, '_Projekt.json'))).toString(), '{"objekt":"NACHZUEGLER"}'); assert.equal((await fs.readFile(path.join(f.dir, '_Spektron/_Projekt.json'))).toString(), FIX['_Projekt.json']);
    assert.equal(rk.uebersprungen, 1); assert.equal(rk.geloescht, 1); assert.equal(await ex(path.join(f.dir, 'Laborergebnisse/_Ergebnisse.json')), false);
    const o = await S.ort(f.projekt, 'projekt'); assert.equal(o.wo, 'neu'); assert.equal(o.konflikt, true);
  });

  await ok('Review 1: Bereich wird erst vermerkt, wenn alle Dateien kopiert sind – eine fehlgeschlagene Datei lässt den alten Ort gelten', async () => {
    const f = await fixture();
    hooks.beimSchreiben = async p => { if (p.endsWith(path.join('_Spektron', '_Projekt.json'))) throw Error('Netz weg'); };
    const r = await U.projektUmziehen(f.projekt, {}); const pj = r.bereiche.find(b => b.bereich === 'projekt');
    assert.equal(pj.fehler.length, 1); assert.equal(pj.geloescht, 0, 'nichts aus dem Bereich gelöscht – auch nicht _Projekt_Sicherungen');
    assert.ok(await ex(path.join(f.dir, '_Projekt_Sicherungen/vorher_a.json')), 'Sicherung noch am alten Ort');
    const v = JSON.parse((await fs.readFile(path.join(f.dir, '_Spektron/_Umzug.json'))).toString()); assert.equal(v.bereiche.projekt, undefined, 'kein Vermerk für projekt'); assert.ok(v.bereiche.fotokit, 'andere Bereiche vermerkt');
    assert.equal((await S.ort(f.projekt, 'projekt')).wo, 'alt');
    hooks.beimSchreiben = null;
    const r2 = await U.projektUmziehen(f.projekt, {}); assert.deepEqual(r2.bereiche.find(b => b.bereich === 'projekt').fehler, []); assert.equal((await S.ort(f.projekt, 'projekt')).wo, 'neu');
  });

  await ok('Review 2: unlesbarer oder fremder Umzugsvermerk stoppt das Projekt, nichts wird verändert; leerer Vermerk gilt als keiner', async () => {
    for (const inhalt of ['kaputt{', '{"format":"anders"}', '{"format":"spektron-umzug","version":2,"bereiche":{}}']){
      const f = await fixture(N, Object.assign({ '_Spektron/_Umzug.json': inhalt }, FIX)), vorher = await alle(f.dir);
      const r = await U.projektUmziehen(f.projekt, {}); assert.equal(r.fehler.length, 1, inhalt); assert.deepEqual(r.bereiche, []); assert.deepEqual(await alle(f.dir), vorher, 'nichts verändert: ' + inhalt);
    }
    const f = await fixture(N, Object.assign({ '_Spektron/_Umzug.json': '' }, FIX));
    const r = await U.projektUmziehen(f.projekt, {}); assert.deepEqual(r.fehler, []); assert.ok(JSON.parse((await fs.readFile(path.join(f.dir, '_Spektron/_Umzug.json'))).toString()).bereiche.projekt);
  });

  await ok('Review 3: leere Zieldatei (unterbrochenes Kopieren) wird ersetzt statt als Konflikt gemeldet', async () => {
    const f = await fixture(N, Object.assign({ '_Spektron/_Projekt.json': '' }, FIX));
    const r = await U.projektUmziehen(f.projekt, {}); const pj = r.bereiche.find(b => b.bereich === 'projekt');
    assert.deepEqual(pj.konflikte, []); assert.equal(pj.kopiert, 2); assert.equal((await alle(f.dir))['_Spektron/_Projekt.json'], FIX['_Projekt.json']);
  });

  await ok('Review 4: liegen gebliebene leere Ordner (auch verschachtelt) werden beim erneuten Lauf aufgeräumt', async () => {
    const f = await fixture(); await U.projektUmziehen(f.projekt, {});
    await fs.mkdir(path.join(f.dir, '_Buero/aufgaben/tief/er'), { recursive: true }); await fs.mkdir(path.join(f.dir, '_Projekt_Sicherungen/x/y'), { recursive: true });
    assert.equal((await S.ort(f.projekt, 'projekt')).konflikt, true, 'leerer Rest zählt als Konflikt');
    const r = await U.projektUmziehen(f.projekt, {}); assert.deepEqual(r.fehler, []);
    assert.equal(await ex(path.join(f.dir, '_Buero')), false); assert.equal(await ex(path.join(f.dir, '_Projekt_Sicherungen')), false);
    assert.equal((await S.ort(f.projekt, 'projekt')).konflikt, false);
  });

  await ok('Review 5: Original zwischen Kopieren und Löschen geändert → bleibt (Vergleich gegen den kopierten Stand)', async () => {
    const f = await fixture(); let einmal = true;   // während der Kopierphase des Bereichs (beim Kopieren der Sicherung) schreibt eine App das Original neu
    hooks.beimSchreiben = async p => { if (einmal && p.endsWith(path.join('_Spektron', '_Projekt_Sicherungen', 'vorher_a.json'))){ einmal = false; await fs.writeFile(path.join(f.dir, '_Projekt.json'), '{"objekt":"ZWISCHENDRIN"}'); } };
    const r = await U.projektUmziehen(f.projekt, {}); const pj = r.bereiche.find(b => b.bereich === 'projekt');
    assert.equal(pj.konflikte.length, 1); assert.match(pj.konflikte[0].hinweis, /inzwischen geändert/);
    assert.equal((await fs.readFile(path.join(f.dir, '_Projekt.json'))).toString(), '{"objekt":"ZWISCHENDRIN"}', 'neuer Stand am alten Ort bleibt');
    assert.equal((await fs.readFile(path.join(f.dir, '_Spektron/_Projekt.json'))).toString(), FIX['_Projekt.json']);
  });

  await ok('Ordner gleichen Namens am neuen Ort: Fehler statt Überschreiben', async () => {
    const f = await fixture(N, { '_Projekt.json': '{}' });
    await fs.mkdir(path.join(f.dir, '_Spektron/_Projekt.json'), { recursive: true });
    const r = await U.projektUmziehen(f.projekt, {}); const pj = r.bereiche.find(b => b.bereich === 'projekt');
    assert.equal(pj.fehler.length, 1); assert.equal(pj.geloescht, 0); assert.equal((await fs.readFile(path.join(f.dir, '_Projekt.json'))).toString(), '{}');
  });

  await ok('Von Hand übernommenes Projekt unter 26.0560 (mit _Spektron) wird umgezogen', async () => {
    const f = await fixture('25.0100 Aachen Ben', { '_Projekt.json': '{"a":1}', '_Spektron/BITTE NICHT ANFASSEN.txt': 'x', 'Fotos/IMG.jpg': 'J' });
    const r = await U.projektUmziehen(f.projekt, {}); assert.deepEqual(r.fehler, []); assert.equal((await alle(f.dir))['_Spektron/_Projekt.json'], '{"a":1}'); assert.equal(await ex(path.join(f.dir, '_Projekt.json')), false);
  });
  await ok('Review II-1: App schreibt gleichzeitig dieselbe Datei am neuen Ort → ihre Fassung bleibt, als Konflikt gemeldet', async () => {
    const f = await fixture(N, { '_Projekt.json': '{"a":1}', 'Laboraufträge/26.0560_x_Daten.json': '{"proben":[1]}', '_Spektron/_Umzug.json': JSON.stringify({ format: 'spektron-umzug', version: 1, bereiche: { labelkit: { am: 'x' } } }) });
    // Bereich labelkit schon vermerkt; eine App legt die Zieldatei leer an und schreibt kurz nach unserem Schreiben ihren Inhalt
    await fs.mkdir(path.join(f.dir, '_Spektron/LabelKit'), { recursive: true }); await fs.writeFile(path.join(f.dir, '_Spektron/LabelKit/26.0560_x_Daten.json'), '');
    const r = await U.projektUmziehen(f.projekt, {}); const lk = r.bereiche.find(b => b.bereich === 'labelkit');
    assert.equal(lk.konflikte.length, 1, 'leere Zieldatei im vermerkten Bereich ist ein Konflikt'); assert.equal(lk.geloescht, 0);
    assert.equal((await fs.readFile(path.join(f.dir, 'Laboraufträge/26.0560_x_Daten.json'))).toString(), '{"proben":[1]}');
    // und: unvermerkter Bereich, App schreibt zwischen unserem Schreiben und dem Zurücklesen
    const g = await fixture(N, { 'Laboraufträge/26.0560_x_Daten.json': '{"proben":[1]}' });
    let einmal = true; hooks.beimSchreiben = async p => { if (einmal && p.endsWith(path.join('LabelKit', '26.0560_x_Daten.json'))){ einmal = false; } };
    const Orig = Datei.prototype.createWritable;
    Datei.prototype.createWritable = async function(o){ const w = await Orig.call(this, o), p = this.p; if (!p.endsWith(path.join('LabelKit', '26.0560_x_Daten.json'))) return w; return { write: w.write, abort: w.abort, close: async () => { await w.close(); await fs.writeFile(p, '{"proben":[1,2]}'); } }; };
    try{ const r2 = await U.projektUmziehen(g.projekt, {}); const l2 = r2.bereiche.find(b => b.bereich === 'labelkit');
      assert.equal(l2.konflikte.length, 1); assert.match(l2.konflikte[0].hinweis, /gleichzeitig/); assert.equal(l2.geloescht, 0);
      assert.equal((await fs.readFile(path.join(g.dir, '_Spektron/LabelKit/26.0560_x_Daten.json'))).toString(), '{"proben":[1,2]}', 'Fassung der App bleibt');
      assert.equal((await fs.readFile(path.join(g.dir, 'Laboraufträge/26.0560_x_Daten.json'))).toString(), '{"proben":[1]}', 'Original bleibt');
    } finally { Datei.prototype.createWritable = Orig; }
  });

  await ok('Review II-2: Bereich nicht vermerkt → eigene Kopien zurückgenommen, nächster Lauf vergleicht nicht gegen veraltete Kopien', async () => {
    const f = await fixture(N, { 'Abrechnung/Aufwand_DRKA.json': '{"z":1}', 'Abrechnung/_Abrechnung.json': '{"b":1}' });
    let einmal = true; hooks.beimSchreiben = async p => { if (einmal && p.endsWith(path.join('BelegKit', '_Abrechnung.json'))){ einmal = false; throw Error('Platte voll'); } };
    const r = await U.projektUmziehen(f.projekt, {}); const bk = r.bereiche.find(b => b.bereich === 'belegkit');
    assert.equal(bk.fehler.length, 1); assert.equal(bk.kopiert, 0); assert.equal(bk.zurueckgenommen, 1);
    assert.equal(await ex(path.join(f.dir, '_Spektron/BelegKit')), false, 'leerer Zielordner wieder weg');
    assert.equal(await ex(path.join(f.dir, '_Spektron/_Umzug.json')), false, 'kein Vermerk geschrieben');
    // Original ändert sich (App schreibt am alten Ort, der ja noch gilt) – zweiter Lauf: kein Konflikt, sauber umgezogen
    await fs.writeFile(path.join(f.dir, 'Abrechnung/Aufwand_DRKA.json'), '{"z":2}'); hooks.beimSchreiben = null;
    const r2 = await U.projektUmziehen(f.projekt, {}); const b2 = r2.bereiche.find(b => b.bereich === 'belegkit');
    assert.deepEqual(b2.konflikte, []); assert.deepEqual(b2.fehler, []); assert.equal(b2.geloescht, 2);
    assert.equal((await fs.readFile(path.join(f.dir, '_Spektron/BelegKit/Aufwand_DRKA.json'))).toString(), '{"z":2}');
  });

  await ok('Review II-3: Bereich nur mit leeren Ordnern wird vermerkt und aufgeräumt statt jedes Mal wieder anzustehen', async () => {
    const f = await fixture(N, { 'Fotos/IMG.jpg': 'J' }); await fs.mkdir(path.join(f.dir, 'Fotos/_FotoKit_Fassungen'));
    const r = await U.projektUmziehen(f.projekt, {}); const fk = r.bereiche.find(b => b.bereich === 'fotokit');
    assert.ok(fk); assert.deepEqual(fk.fehler, []); assert.equal(await ex(path.join(f.dir, 'Fotos/_FotoKit_Fassungen')), false, 'leerer Ordner weg');
    assert.ok(JSON.parse((await fs.readFile(path.join(f.dir, '_Spektron/_Umzug.json'))).toString()).bereiche.fotokit, 'vermerkt');
    const r2 = await U.projektUmziehen(f.projekt, {}); assert.equal(r2.bereiche.find(b => b.bereich === 'fotokit'), undefined, 'steht nicht wieder an');
  });

  await ok('Review II-6: Thumbs.db & Co. in _Buero werden übergangen, Bereich trotzdem vermerkt', async () => {
    const f = await fixture(N, { '_Buero/aufgaben/a1.json': '{}', '_Buero/Thumbs.db': 'T', '_Buero/aufgaben/x.json.crswap': 'C' });
    const r = await U.projektUmziehen(f.projekt, {}); const bu = r.bereiche.find(b => b.bereich === 'buero');
    assert.deepEqual(bu.fehler, []); assert.equal(bu.kopiert, 1); assert.equal(bu.geloescht, 1);
    const a = await alle(f.dir); assert.equal(a['_Spektron/Buero/aufgaben/a1.json'], '{}'); assert.equal(a['_Buero/Thumbs.db'], 'T'); assert.equal(a['_Buero/aufgaben/x.json.crswap'], 'C'); assert.equal(a['_Spektron/Buero/Thumbs.db'], undefined);
  });

  await ok('Review II-4: Protokoll mit Uhrzeit je Zeile, Beginn/Ende, Konflikte und Fehler; Schreibfehler wird gemeldet', async () => {
    const f = await fixture(N, { '_Projekt.json': '{"a":1}', '_Spektron/_Projekt.json': '{"a":2}' }), log = await U.logSchreiber(f.archiv);
    let gesichert = 0; await U.projektUmziehen(f.projekt, { log: log.zeile, sichern: async () => { gesichert++; await log.speichern(); } });
    assert.ok(gesichert >= 2, 'nach jedem Bereich und am Ende gesichert');
    const t = (await fs.readFile(path.join(f.tmp, '_Spektron-Umzug.log'))).toString();
    assert.match(t, /Umzug begonnen/); assert.match(t, /Umzug beendet/); assert.match(t, /KONFLIKT/); assert.match(t, /NICHT vermerkt/);
    for (const z of t.split(/\r\n/).slice(1).filter(Boolean)) assert.match(z, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z \| /, z);
    const kaputt = await U.logSchreiber(new Ordner(path.join(f.tmp, 'gibt-es-nicht'))); kaputt.zeile('x'); assert.match(await kaputt.speichern(), /nicht geschrieben/); assert.ok(kaputt.fehler);
  });
  // ---- Audit 29.10.2026 (F01, F02, F03, F16) ----
  await ok('Audit F01: fremde JSON in „Abrechnung“ bleiben liegen; nur BelegKit-Dateien ziehen um', async () => {
    const f = await fixture(N, { 'Abrechnung/Aufwand_SK.json': '{"z":1}', 'Abrechnung/_Abrechnung.json': '{"b":1}', 'Abrechnung/26-0560_Aufwand_2026-10-28.json': '{"s":1}', 'Abrechnung/26-0560_Aufwand_2026-10-28.csv': 'a;b', 'Abrechnung/External-export.json': '{"format":"synthetic-external-export"}', 'Abrechnung/Rechnung.json': '{}', 'Abrechnung/Aufwand_Notizen.json': '{}', 'Abrechnung/aufwand_sk.json': '{}' });
    const r = await U.projektUmziehen(f.projekt, {}); const bk = r.bereiche.find(b => b.bereich === 'belegkit');
    assert.deepEqual(bk.fehler, []); assert.equal(bk.geloescht, 3);
    const a = await alle(f.dir);
    for (const n of ['Aufwand_SK.json', '_Abrechnung.json', '26-0560_Aufwand_2026-10-28.json']){ assert.ok(a['_Spektron/BelegKit/' + n], n + ' umgezogen'); assert.equal(a['Abrechnung/' + n], undefined); }
    for (const n of ['External-export.json', 'Rechnung.json', '26-0560_Aufwand_2026-10-28.csv', 'Aufwand_Notizen.json', 'aufwand_sk.json']){ assert.ok(a['Abrechnung/' + n], n + ' bleibt'); assert.equal(a['_Spektron/BelegKit/' + n], undefined); }
  });

  await ok('Audit F02: Kopie verschwindet nach dem Vermerk → Original wird nicht gelöscht, Konflikt gemeldet', async () => {
    const f = await fixture(N, { '_Projekt.json': '{"objekt":"Synthetisch"}' });
    let einmal = true; hooks.beimSchreiben = async p => { if (einmal && p.endsWith(path.join('_Spektron', '_Umzug.json'))){ einmal = false; await fs.unlink(path.join(f.dir, '_Spektron/_Projekt.json')); } };
    const r = await U.projektUmziehen(f.projekt, {}); const pj = r.bereiche.find(b => b.bereich === 'projekt');
    assert.equal(pj.geloescht, 0); assert.equal(pj.konflikte.length, 1); assert.match(pj.konflikte[0].hinweis, /fehlt/);
    assert.equal((await fs.readFile(path.join(f.dir, '_Projekt.json'))).toString(), '{"objekt":"Synthetisch"}', 'Original bleibt');
    // auch: Kopie inzwischen anders → Original bleibt
    const g = await fixture(N, { '_Projekt.json': '{"objekt":"A"}' });
    einmal = true; hooks.beimSchreiben = async p => { if (einmal && p.endsWith(path.join('_Spektron', '_Umzug.json'))){ einmal = false; await fs.writeFile(path.join(g.dir, '_Spektron/_Projekt.json'), '{"objekt":"anders"}'); } };
    const r2 = await U.projektUmziehen(g.projekt, {}); const p2 = r2.bereiche.find(b => b.bereich === 'projekt');
    assert.equal(p2.geloescht, 0); assert.match(p2.konflikte[0].hinweis, /geändert/); assert.ok(await ex(path.join(g.dir, '_Projekt.json')));
  });

  await ok('Audit F03: neueste LabelKit-Tagesdatei bleibt nach dem Umzug die neueste (Kopie in Datumsreihenfolge)', async () => {
    const neu = '26.0560_01.10.2026_Daten.json', alt = '26.0560_30.09.2026_Daten.json';   // Namensreihenfolge ≠ Datumsreihenfolge
    const f = await fixture(N, { ['Laboraufträge/' + neu]: '{"proben":["NEU"]}', ['Laboraufträge/' + alt]: '{"proben":["ALT"]}', 'Fotos/_Bildumbenenner.json': '{}', 'Fotos/_FotoKit_Fassungen/a.json': '{}', 'Fotos/_FotoKit_Fassungen/b.json': '{}' });
    await fs.utimes(path.join(f.dir, 'Laboraufträge', alt), new Date('2026-09-30T10:00:00Z'), new Date('2026-09-30T10:00:00Z'));
    await fs.utimes(path.join(f.dir, 'Laboraufträge', neu), new Date('2026-10-01T10:00:00Z'), new Date('2026-10-01T10:00:00Z'));
    const neueste = async d => { let best = null; for (const n of await fs.readdir(d)){ if (!/_Daten\.json$/.test(n)) continue; const t = (await fs.stat(path.join(d, n))).mtimeMs; if (!best || t > best.t) best = { n, t }; } return best && best.n; };
    assert.equal(await neueste(path.join(f.dir, 'Laboraufträge')), neu, 'vorher');
    const r = await U.projektUmziehen(f.projekt, {}); assert.deepEqual(r.bereiche.find(b => b.bereich === 'labelkit').fehler, []);
    assert.equal(await neueste(path.join(f.dir, '_Spektron/LabelKit')), neu, 'nachher dieselbe Datei');
    const tAlt = (await fs.stat(path.join(f.dir, '_Spektron/LabelKit', alt))).mtimeMs, tNeu = (await fs.stat(path.join(f.dir, '_Spektron/LabelKit', neu))).mtimeMs;
    assert.ok(tNeu > tAlt, 'Kopie der jüngeren Datei ist auch jünger');
  });

  await ok('Audit F03/Codex: Laufwerk ohne feinere Zeitauflösung → Bereich nicht vermerkt, Kopien zurückgenommen, nichts gelöscht', async () => {
    const neu = '26.0560_01.10.2026_Daten.json', alt = '26.0560_30.09.2026_Daten.json';
    const f = await fixture(N, { ['Laboraufträge/' + neu]: '{"proben":["NEU"]}', ['Laboraufträge/' + alt]: '{"proben":["ALT"]}' });
    await fs.utimes(path.join(f.dir, 'Laboraufträge', alt), new Date('2026-09-30T10:00:00Z'), new Date('2026-09-30T10:00:00Z'));
    await fs.utimes(path.join(f.dir, 'Laboraufträge', neu), new Date('2026-10-01T10:00:00Z'), new Date('2026-10-01T10:00:00Z'));
    const Orig = Datei.prototype.getFile;
    Datei.prototype.getFile = async function(){ const r = await Orig.call(this); return this.p.includes(path.sep + '_Spektron' + path.sep) ? { ...r, lastModified: 1000 } : r; };   // alle Kopien: derselbe Zeitstempel
    try{
      const r = await U.projektUmziehen(f.projekt, { zeitstempelWarten: 300 }); const lk = r.bereiche.find(b => b.bereich === 'labelkit');
      assert.equal(lk.fehler.length, 1); assert.match(lk.fehler[0], /Zeitstempel/); assert.equal(lk.geloescht, 0);
      assert.ok(await ex(path.join(f.dir, 'Laboraufträge', neu)) && await ex(path.join(f.dir, 'Laboraufträge', alt)), 'Originale bleiben');
      assert.equal(await ex(path.join(f.dir, '_Spektron/LabelKit')), false, 'Kopien zurückgenommen');
      assert.equal((await S.ort(f.projekt, 'labelkit')).wo, 'alt');
    } finally { Datei.prototype.getFile = Orig; }
  });

  await ok('Audit F16: belegte App-Sperre → Bereich nach Wartezeit übersprungen und gemeldet, Rest zieht um, nichts hängt', async () => {
    class Sperren{ constructor(){ this.belegt = new Map(); }
      async request(name, opt, fn){ if (typeof opt === 'function'){ fn = opt; opt = {}; }
        while (this.belegt.has(name)){ if (opt.signal && opt.signal.aborted) throw opt.signal.reason;
          await Promise.race([this.belegt.get(name), new Promise((_, rej) => opt.signal && opt.signal.addEventListener('abort', () => rej(opt.signal.reason), { once: true }))]); }
        let frei; this.belegt.set(name, new Promise(r => frei = r)); try{ return await fn(); } finally { this.belegt.delete(name); frei(); } } }
    const L = new Sperren(); L.belegt.set('mosaik:projekt:' + N, new Promise(() => {}));   // eine App hält die Projektdaten-Sperre für immer
    U._locks = L;
    try{
      const f = await fixture(N, { '_Projekt.json': '{"a":1}', 'Pläne/Probenplan x.probenplan': '{"v":1}' });
      const t0 = Date.now(), r = await U.projektUmziehen(f.projekt, { sperreWarten: 300 });
      assert.ok(Date.now() - t0 < 5000, 'kehrt zurück');
      const pj = r.bereiche.find(b => b.bereich === 'projekt'); assert.match(pj.fehler.join(' '), /belegt/); assert.equal(pj.geloescht, 0);
      assert.ok(await ex(path.join(f.dir, '_Projekt.json')), 'Projektdaten bleiben am alten Ort'); assert.equal(await ex(path.join(f.dir, '_Spektron/_Projekt.json')), false);
      assert.equal((await S.ort(f.projekt, 'projekt')).wo, 'alt', 'alter Ort gilt weiter');
      const pk = r.bereiche.find(b => b.bereich === 'plankit'); assert.deepEqual(pk.fehler, []); assert.equal(pk.geloescht, 1);
      // Projekt-Sperre selbst belegt (zweiter Tab zieht gerade um) → übersprungen statt hängen
      const g = await fixture(N, { '_Projekt.json': '{"a":1}' }); L.belegt.set('spektron:umzug:' + N, new Promise(() => {}));
      const r2 = await U.projektUmziehen(g.projekt, { sperreWarten: 200 }); assert.match(r2.fehler.join(' '), /übersprungen/); assert.ok(await ex(path.join(g.dir, '_Projekt.json')));
    } finally { U._locks = null; }
  });
  fertig = true;
})().catch(e => { console.error(e); process.exit(1); });
