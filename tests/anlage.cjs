// Anlage PN 98 / Brandgeruch: Bestandsprüfung, unveränderte Werte, Blind-Modus, Quellenvermerk, Dateinamen.
process.env.TZ = 'Europe/Berlin';
const assert = require('node:assert/strict');
const lade = require('./lade.cjs');
const { DOCX, ANLAGE } = lade();
const dec = new TextDecoder();

const daten = () => ({
  version: '4.26.0', projekt: { nr: '26.0142' }, bgBlind: false, brandgeruchDatum: '2026-10-21',
  pn98Projekt: { schaden: '26.0142', schadendatum: '15.09.2026', pndatum: '2026-10-21', ort: 'Heinsberg', grund: 'Brandschutt', probenehmer: 'Dr. S. Kasper', labor: 'Labor X' },
  pn98Proben: [
    { probennr: 'P1', uhrzeit: '10:15', probenahmestelle: 'EG Küche', probenart: 'Brandschutt', menge: '2,0', haufwerk: 'ca. 5 m³', beschaffenheit: 'heterogen\nmit Holzkohle', sonstige: '' },
    { probennr: '', uhrzeit: '', probenahmestelle: 'OG Flur <Teppich & Co>' },
  ],
  brandgeruchProben: [
    { id: 1, z1: 'Wischprobe', z2: 'Küche Wand', p1: '++', p2: '+', p3: '(+)', p4: '-', p5: '+' },
    { id: 2, z1: 'Textil', z2: '', p1: '+', p2: '', p3: '+', p4: '+', p5: '++' },
  ],
});

// Bestandsprüfung
let c = ANLAGE.pruefen(daten(), '26.0142');
assert.equal(c.pn98, 2); assert.equal(c.brand, 2); assert.equal(c.blind, false); assert.equal(c.fehlend, 1);
assert.equal(c.brandMoeglich, true); assert.equal(c.pn98Moeglich, true);
assert.match(c.hinweise.join(' '), /1 Bewertung fehlt – das Feld bleibt/);
assert.match(c.hinweise.join(' '), /1 Protokoll ohne Proben-Nr\./);
assert.match(ANLAGE.pruefen(daten(), '26.0999').hinweise.join(' '), /Projektnummer „26\.0142“, der Ordner 26\.0999/);
const blind = daten(); blind.bgBlind = true;
c = ANLAGE.pruefen(blind, '26.0142');
assert.equal(c.brandMoeglich, false, 'verdeckte Bewertungen nicht in die Anlage');
assert.match(c.hinweise.join(' '), /Blind-Modus/);
const ohne = daten(); delete ohne.bgBlind;
assert.equal(ANLAGE.pruefen(ohne).blind, true, 'ohne Angabe gilt LabelKits Voreinstellung: verdeckt');
assert.equal(ANLAGE.pruefen({}).pn98Moeglich, false);
assert.equal(ANLAGE.pruefen(null).brand, 0);

// Anlage
const opt = { projektNr: '26.0142', ort: 'Heinsberg', titel: 'Anlage 4', erstellt: '2026-10-16T16:00:00.000Z', anwendung: 'Projektzentrale 1.4.0',
  quelle: { pfad: 'Laboraufträge/26.0142_16.10.2026_Daten.json', geaendert: '2026-10-16T15:36:00.000Z', version: '4.26.0', sha256: 'ab'.repeat(32) } };
const r = ANLAGE.pn98Brand(daten(), opt);
assert.deepEqual([...r.teile], ['Probenahmeprotokolle nach LAGA PN 98', 'Sensorische Prüfung auf Brandgeruch']);
const files = lade.unzip(DOCX.build({ created: opt.erstellt, blocks: r.blocks }), DOCX.crc32);
const doc = dec.decode(files['word/document.xml']);
const text = doc.slice(doc.indexOf('<w:body>')).replace(/<w:br\/>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
assert.match(text, /^Anlage 4: Probenahmeprotokolle nach LAGA PN 98 und Sensorische Prüfung auf Brandgeruch\nProjekt 26\.0142 · Heinsberg/);
assert.match(text, /in Anlehnung an LAGA PN 98 · Protokoll 1 von 2/);
assert.match(text, /in Anlehnung an LAGA PN 98 · Protokoll 2 von 2/);
assert.match(text, /Probenmenge \(kg\):\n2,0/, 'Zahl unverändert (Komma bleibt)');
assert.match(text, /ca\. 5 m³/);
assert.match(text, /heterogen\nmit Holzkohle/, 'Zeilenumbruch bleibt');
assert.match(text, /OG Flur <Teppich & Co>/, 'Sonderzeichen korrekt');
assert.match(text, /Probenahmedatum:\n21\.10\.2026/, 'ISO-Datum lesbar');
assert.match(text, /Schadendatum:\n15\.09\.2026/);
assert.equal((doc.match(/<w:pageBreakBefore\/>/g) || []).length, 2, 'Protokoll 2 und Brandgeruch beginnen auf neuer Seite');
// Brandgeruch: Rohwerte, leere Bewertung bleibt leer
assert.match(text, /Nr\.\nProbe\nPerson 1\nPerson 2\nPerson 3\nPerson 4\nPerson 5\n1\nWischprobe\nKüche Wand\n\+\+\n\+\n\(\+\)\n-\n\+\n2\nTextil\n\+\n\n\+\n\+\n\+\+\n/);
assert.match(text, /Prüfung am 21\.10\.2026/);
// Quellenvermerk
assert.match(text, /Quellenvermerk: Erstellt am 16\.10\.2026 18:00 Uhr mit Projektzentrale 1\.4\.0 aus der Projektdatei „Laboraufträge\/26\.0142_16\.10\.2026_Daten\.json“ \(Stand 16\.10\.2026 17:36 Uhr, LabelKit 4\.26\.0\)\./);
assert.match(text, new RegExp('SHA-256 der Projektdatei: ' + 'ab'.repeat(32)));
assert.match(text, /unverändert aus der Projektdatei übernommen/);
// keine Bewertung, keine Zusammenfassung erfunden
assert.doesNotMatch(text, /Mittelwert|Summe|auffällig|unauffällig|Ergebnis:/);

// Teile wählbar; Blind-Modus schließt Brandgeruch aus
const nurPn = ANLAGE.pn98Brand(daten(), { ...opt, brand: false });
assert.deepEqual([...nurPn.teile], ['Probenahmeprotokolle nach LAGA PN 98']);
const b = ANLAGE.pn98Brand(blind, opt);
assert.equal(b.mitBrand, false);
assert.throws(() => ANLAGE.pn98Brand(blind, { ...opt, pn98: false }), /Keine Inhalte/);
const nurBrand = ANLAGE.pn98Brand(daten(), { ...opt, pn98: false });
assert.equal(nurBrand.blocks.find(x => x.pageBreakBefore), undefined, 'ohne PN 98 kein Seitenumbruch vor Brandgeruch');

// Dateinamen
assert.equal(ANLAGE.dateiname('26.0142', 'Anlage 4', 'PN98-Brandgeruch', '2026-10-16', []), '26-0142_Anlage-4_PN98-Brandgeruch_2026-10-16.docx');
assert.equal(ANLAGE.dateiname('26.0142', 'Anlage 4', 'PN98', '2026-10-16', ['26-0142_Anlage-4_PN98_2026-10-16.DOCX']), '26-0142_Anlage-4_PN98_2026-10-16_2.docx');
const n = ANLAGE.dateiname('26.0142', 'Anlage für Größe/Ä ' + 'x'.repeat(200), 'PN98', '2026-10-16', []);
assert.match(n, /^[A-Za-z0-9_-]+\.docx$/, 'nur Buchstaben, Ziffern, _ und -, ein Punkt');
assert.ok(n.length <= 90, 'höchstens 90 Zeichen');
assert.match(n, /Anlage-fur-Grosse-A-x/);
assert.equal(ANLAGE.datum('2026-10-21'), '21.10.2026');
assert.equal(ANLAGE.datum('21.10.26'), '21.10.26', 'anderes Format bleibt wie erfasst');

console.log('Anlage: alle Prüfungen bestanden');
