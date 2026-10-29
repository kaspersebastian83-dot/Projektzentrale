// Datenarchiv-Zuordnungen (_Spektron-Archiv.json): Schreiben zwei Sitzungen gleichzeitig, darf keine Änderung verloren gehen
// (Audit F11). Lädt archiv/lesen.js unverändert; Ordner im Speicher, synthetische Projekte.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '..', 'archiv', 'lesen.js'), 'utf8');
const TAGS = '_Spektron-Archiv.json';

/** Archivordner im Speicher. vorSchreiben(n): läuft, nachdem createWritable geöffnet wurde – dort „schreibt ein anderer Rechner“. */
function ordner(dateien, haken = {}){
  return {
    name: 'Archiv', kind: 'directory',
    async queryPermission(){ return 'granted'; }, async requestPermission(){ return 'granted'; },
    async getFileHandle(n, o){
      if (!(n in dateien)){ if (!(o && o.create)) throw Object.assign(Error('fehlt'), { name: 'NotFoundError' }); dateien[n] = ''; }
      return {
        name: n, kind: 'file',
        getFile: async () => ({ text: async () => dateien[n] }),
        createWritable: async () => {
          if (haken.vorSchreiben) await haken.vorSchreiben(n);
          let t = ''; return { write: async v => { t = v; }, close: async () => { dateien[n] = t; }, abort: async () => {} };
        }
      };
    }
  };
}
function laden(){ const ctx = { console, navigator: {} }; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx); return ctx.ArchivLesen; }
const datei = projekte => JSON.stringify({ format: 'spektron-archiv', version: 1, projekte }, null, 2) + '\n';
const lesen = d => JSON.parse(d[TAGS]).projekte;

(async () => {
  // 1. Ein anderer Rechner setzt Projekt B, während wir Projekt A schreiben → beide Zuordnungen bleiben
  {
    const d = { [TAGS]: datei({}) }; let einmal = true;
    const L = laden(), a = ordner(d, { vorSchreiben: async () => { if (einmal){ einmal = false; d[TAGS] = datei({ '99.9002 Synthetisch B': { nutzung: 'Synthetisch B' } }); } } });
    await L.tagSetzen(a, '99.9001 Synthetisch A', 'nutzung', 'Synthetisch A');
    const p = lesen(d);
    assert.equal(p['99.9001 Synthetisch A'].nutzung, 'Synthetisch A', 'eigene Änderung gespeichert');
    assert.equal(p['99.9002 Synthetisch B'].nutzung, 'Synthetisch B', 'Änderung des anderen Rechners bleibt');
  }
  // 2. Der andere schreibt bei jedem Versuch dazwischen → nach drei Versuchen Fehler, sein Stand bleibt unangetastet
  {
    const d = { [TAGS]: datei({}) }; let n = 0;
    const L = laden(), a = ordner(d, { vorSchreiben: async () => { n++; d[TAGS] = datei({ ['99.900' + n + ' Synthetisch']: { nutzung: 'x' } }); } });
    await assert.rejects(L.tagSetzen(a, '99.9100 Synthetisch A', 'nutzung', 'A'), /anderen Rechner/);
    assert.equal(n, 3, 'drei Versuche');
    assert.deepEqual(Object.keys(lesen(d)), ['99.9003 Synthetisch'], 'nichts überschrieben');
  }
  // 3. Noch keine Datei → wird angelegt; eine leere Datei (abgebrochenes Anlegen) gilt als „noch keine Zuordnungen“
  {
    const d = {}, L = laden(), a = ordner(d);
    await L.tagSetzen(a, '99.9001 Synthetisch A', 'brandgut', 'Kunststoff');
    assert.equal(lesen(d)['99.9001 Synthetisch A'].brandgut, 'Kunststoff');
    const leer = { [TAGS]: '' };
    assert.equal(JSON.stringify((await L.tagsLesen(ordner(leer))).projekte), '{}');
    await L.tagSetzen(ordner(leer), '99.9001 Synthetisch A', 'nutzung', 'Wohnen');
    assert.equal(lesen(leer)['99.9001 Synthetisch A'].nutzung, 'Wohnen');
  }
  // 4. Probenrolle setzen und wieder entfernen – Projekt verschwindet, wenn nichts mehr gesetzt ist
  {
    const d = { [TAGS]: datei({}) }, L = laden(), a = ordner(d);
    await L.tagSetzen(a, '99.9001 Synthetisch A', 'probe:P1', 'Referenz');
    assert.equal(lesen(d)['99.9001 Synthetisch A'].rollen.P1, 'Referenz');
    await L.tagSetzen(a, '99.9001 Synthetisch A', 'probe:P1', '');
    assert.deepEqual(lesen(d), {});
  }
  console.log('OK Archivzuordnungen: gleichzeitige Änderungen gehen nicht verloren (4 Fälle)');
})().catch(e => { console.error(e); process.exitCode = 1; });
