// Datenmodul der Büroaufgaben: buero-aufgaben.js ist in Projektzentrale und BüroKit byte-gleich.
// Liegt BüroKit daneben (../buerokit), werden beide Dateien verglichen; sonst nur die eigene Datei geprüft.
// In CI holt der Workflow BüroKit daneben und setzt BUEROKIT_PFLICHT – dort wird der Vergleich nie übersprungen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const hier = fs.readFileSync(path.join(root, 'buero-aufgaben.js'));
assert.match(hier.toString('utf8'), /^\/\* BUEROKIT-AUFGABEN v1 /, 'Kopf des gemeinsamen Moduls');
assert.match(hier.toString('utf8'), /\/\* BUEROKIT-AUFGABEN-ENDE \*\/\n?$/, 'Ende des gemeinsamen Moduls');
const B = require(path.join(root, 'buero-aufgaben.js'));
for (const f of ['projektLesen', 'aufgabeAnlegen', 'vermerken', 'empfaengerVorschlag', 'alsDurchlauf', 'offenText']) assert.equal(typeof B[f], 'function', f);
assert.equal(B.DIR, '_Buero');
const neben = path.join(root, '..', 'buerokit', 'buero-aufgaben.js');
if (fs.existsSync(neben)){
  assert.ok(hier.equals(fs.readFileSync(neben)), 'buero-aufgaben.js weicht von BüroKit ab – bitte byte-gleich kopieren');
  console.log('OK buero-aufgaben.js: byte-gleich mit BüroKit');
} else if (process.env.BUEROKIT_PFLICHT) assert.fail('BüroKit liegt nicht daneben (../buerokit) – in CI muss der Vergleich laufen');
else console.log('OK buero-aufgaben.js: Modul vollständig (BüroKit liegt nicht daneben – Vergleich übersprungen)');
