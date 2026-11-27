// Anlagen-Baustein: anlagen.js ist in Projektzentrale und BerichtKit byte-gleich (Entscheidung 8 – eine Hausreihenfolge, eine Rechnung).
// Liegt BerichtKit daneben (../berichtkit), werden beide Dateien verglichen; sonst nur die eigene Datei geprüft.
// In CI holt der Workflow BerichtKit daneben und setzt BERICHTKIT_PFLICHT – dort wird der Vergleich nie übersprungen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const hier = fs.readFileSync(path.join(root, 'anlagen.js'));
assert.match(hier.toString('utf8'), /^\/\* BerichtKit – Anlagen zum Bericht/, 'Kopf des gemeinsamen Moduls');
const A = require(path.join(root, 'anlagen.js'));
for (const f of ['erkennen', 'zusammenstellen', 'bilddokuFinden', 'planFinden']) assert.equal(typeof A[f], 'function', f);
assert.deepEqual(A.PROFILE.asbest.fest, ['bilddoku', 'probenplan'], 'Hausreihenfolge: Prüfbericht(e), Bilddokumentation, Probenplan');
const neben = path.join(root, '..', 'berichtkit', 'anlagen.js');
if (fs.existsSync(neben)){
  assert.ok(hier.equals(fs.readFileSync(neben)), 'anlagen.js weicht von BerichtKit ab – bitte byte-gleich kopieren');
  console.log('OK anlagen.js: byte-gleich mit BerichtKit');
} else if (process.env.BERICHTKIT_PFLICHT) assert.fail('BerichtKit liegt nicht daneben (../berichtkit) – in CI muss der Vergleich laufen');
else console.log('OK anlagen.js: Modul vollständig (BerichtKit liegt nicht daneben – Vergleich übersprungen)');
