// Mitarbeiterliste (_Spektron-Mitarbeiter.json): ein Lesefehler darf nie als „Datei fehlt“ gelten und zum Überschreiben
// der echten Liste führen (Audit F13). Lädt maLesen/maSpeichern unverändert aus index.html, synthetische Daten.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const stueck = (von, bis) => { const a = html.indexOf(von), b = html.indexOf(bis, a); assert.ok(a >= 0 && b > a, 'Abschnitt ' + von); return html.slice(a, b); };
const code = stueck('const maNorm =', '\n') + '\n' + stueck('const MA_FILE =', 'const maPerson =') + '\nthis.maLesen = maLesen; this.maSpeichern = maSpeichern;';

function archiv(dateien, { fehlerBeimErstenLesen } = {}){
  let erstes = true;
  return {
    async getFileHandle(n, o){
      if (!(o && o.create) && erstes && fehlerBeimErstenLesen){ erstes = false; throw Object.assign(Error('Zugriff verweigert (synthetisch)'), { name: fehlerBeimErstenLesen }); }
      if (!(n in dateien) && !(o && o.create)) throw Object.assign(Error('fehlt'), { name: 'NotFoundError' });
      if (!(n in dateien)) dateien[n] = '';
      return { getFile: async () => ({ text: async () => dateien[n] }), createWritable: async () => { let t = ''; return { write: async v => { t = v; }, close: async () => { dateien[n] = t; } }; } };
    }
  };
}
function laden(S){ const ctx = { S, APP_VERSION: 'test' }; vm.createContext(ctx); vm.runInContext(code, ctx); return ctx; }
const liste = personen => JSON.stringify({ format: 'spektron-mitarbeiter', version: 1, personen }, null, 2) + '\n';

(async () => {
  // 1. Zugriffsfehler beim Lesen → Fehler, keine „fehlt“-Antwort
  {
    const dateien = { '_Spektron-Mitarbeiter.json': liste([{ ordnerKuerzel: 'AA', name: 'Synthetische Person A' }]) };
    const c = laden({ archive: archiv(dateien, { fehlerBeimErstenLesen: 'NotAllowedError' }), ma: null });
    const r = await c.maLesen(c.S.archive);
    assert.ok(r.error && !r.fehlt, 'Zugriffsfehler ist kein „fehlt“');
  }
  // 2. Speichern mit unbekanntem Stand (S.ma.text = null) und Lesefehler → abgelehnt, Liste unverändert
  {
    const vorher = liste([{ ordnerKuerzel: 'AA', name: 'Synthetische Person A' }]), dateien = { '_Spektron-Mitarbeiter.json': vorher };
    const c = laden({ archive: archiv(dateien, { fehlerBeimErstenLesen: 'NotAllowedError' }), ma: { text: null } });
    await assert.rejects(c.maSpeichern([{ ordnerKuerzel: 'BB', name: 'Synthetische Person B' }]), /nicht lesbar/);
    assert.equal(dateien['_Spektron-Mitarbeiter.json'], vorher, 'echte Liste bleibt');
  }
  // 3. Datei gibt es wirklich nicht → neue Liste wird angelegt (wie bisher)
  {
    const dateien = {}, c = laden({ archive: archiv(dateien), ma: { text: null } });
    await c.maSpeichern([{ ordnerKuerzel: 'BB', name: 'Synthetische Person B' }]);
    assert.equal(JSON.parse(dateien['_Spektron-Mitarbeiter.json']).personen[0].ordnerKuerzel, 'BB');
  }
  // 4. Unbekannter Stand, Datei inzwischen vorhanden → abgelehnt (anderer Rechner)
  {
    const vorher = liste([{ ordnerKuerzel: 'AA', name: 'Synthetische Person A' }]), dateien = { '_Spektron-Mitarbeiter.json': vorher };
    const c = laden({ archive: archiv(dateien), ma: { text: null } });
    await assert.rejects(c.maSpeichern([{ ordnerKuerzel: 'BB', name: 'B' }]), /anderen Rechner/);
    assert.equal(dateien['_Spektron-Mitarbeiter.json'], vorher);
  }
  console.log('OK Mitarbeiterliste: Lesefehler ≠ fehlt, kein Überschreiben bei unbekanntem Stand, Neuanlage nur wenn wirklich nicht vorhanden');
})().catch(e => { console.error(e); process.exit(1); });
