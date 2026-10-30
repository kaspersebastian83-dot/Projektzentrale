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
// Ganzer Ordnername als Projektnummer in LabelKit: gleiche Nummer → kein Hinweis; andere Nummer → Hinweis
const mitName = daten(); mitName.projekt.nr = '26.0142 Stegerwaldstraße Leverkusen';
assert.doesNotMatch(ANLAGE.pruefen(mitName, '26.0142').hinweise.join(' '), /Projektnummer/, 'gleiche Nummer mit Ortsname ist kein Widerspruch');
assert.match(ANLAGE.pruefen(mitName, '26.0999').hinweise.join(' '), /Projektnummer „26\.0142 Stegerwaldstraße Leverkusen“, der Ordner 26\.0999/);
const altNr = daten(); altNr.projekt.nr = '22.00169 DB Services';
assert.doesNotMatch(ANLAGE.pruefen(altNr, '22.00169').hinweise.join(' '), /Projektnummer/, 'fünfstellige Nummern älterer Jahre');
const ohneNummer = daten(); ohneNummer.projekt.nr = 'Stegerwaldstraße';
assert.match(ANLAGE.pruefen(ohneNummer, '26.0142').hinweise.join(' '), /Projektnummer „Stegerwaldstraße“/, 'ohne erkennbare Nummer weiter melden');
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

// PN 98-Feldbögen (LabelKit 4.27): Übertragung mit Vermerken, Scans mit Prüfstatus, Bild angehängt
const feldRec = (o) => Object.assign({
  id: 'fp-1', typ: 'pn98', formularId: '26.0142-PN-01', erfasstVon: 'AB', erfasstAm: '2026-10-22T07:00:00.000Z',
  kopf: { projektNr: '26.0142', datum: '21.10.2026', objekt: 'EFH Musterweg 7', auftraggeber: 'AG', probenehmer: 'S. Kasper', anwesende: 'Hr. Muster',
    grund: ['Entsorgung / Deklaration'], grundSonstiges: '', schadstoffe: ['PAK', 'Asbest'], schadstoffeSonstige: 'Chlorid', labor: 'Labor X', uebergabeAm: '22.10.2026',
    material: ['Haufwerk außen'], gelagertTage: '14', witterung: ['trocken'], geraet: ['Schaufel'], geraetSonstiges: '', gefaess: ['PE-Eimer'], gefaessSonstiges: '',
    kuehl: true, lage: ['im Probenplan', 'Fotos'], ortDatum: 'Würselen, 21.10.26', unterschrift: true, zeugen: false },
  mp: [
    { nr: 1, w: { probenNr: 'P1', uhrzeit: '10:15', foto: '12', stelle: 'Haufwerk H1', material: 'Brandschutt', art: 'Mischprobe', einzelproben: '4', volumen: '25', menge: '2,5', farbe: 'grau', geruch: 'brandtypisch', geruchAnders: '', konsistenz: ['stückig', 'körnig'], feuchte: 'trocken', anmerkung: '' } },
    { nr: 2, w: { probenNr: '', uhrzeit: '', foto: '', stelle: 'EG Küche', material: 'Estrich', art: 'Einzelprobe / Hot-Spot', einzelproben: '', volumen: '', menge: '1,O', farbe: '', geruch: '', geruchAnders: '', konsistenz: [], feuchte: '', anmerkung: 'Probe unter Fliesen' } }],
  unl: { 'mp.1.menge': true, 'kopf.anwesende': true },
  scans: [{ datei: '26-0142-PN-01_Scan_2026-10-22.jpg', sha256: 'cd'.repeat(32), abgelegtAm: '2026-10-22T07:30:00.000Z', abgelegtVon: 'AB', bytes: 9, original: 'a.jpg' },
    { datei: '26-0142-PN-01_Scan_2026-10-22_2.pdf', sha256: 'ef'.repeat(32), abgelegtAm: '2026-10-22T07:31:00.000Z', abgelegtVon: 'AB', ungueltig: { grund: 'falscher Bogen' } }],
  abgeschlossen: { von: 'AB', am: '2026-10-22T08:00:00.000Z' }, pruefung: null,
  aenderungen: [{ am: '2026-10-22T09:00:00.000Z', von: 'SK', feld: 'Probe 1 · Laborprobe ca.', alt: '2,0', neu: '2,5' }] }, o || {});
const mitFeld = () => Object.assign(daten(), { feldprotokolle: [feldRec(), { typ: 'asbest', id: 'x', kopf: {}, mp: [] }] });
c = ANLAGE.pruefen(mitFeld(), '26.0142');
assert.equal(c.feld, 1, 'nur PN 98-Feldbögen zählen');
assert.match(c.hinweise.join(' '), /26\.0142-PN-01: Übertragung noch nicht durch eine zweite Person geprüft/);
assert.doesNotMatch(c.hinweise.join(' '), /kein Scan/);
const offen = Object.assign(daten(), { pn98Proben: [], feldprotokolle: [feldRec({ abgeschlossen: null, scans: [] })] });
c = ANLAGE.pruefen(offen, '26.0142');
assert.equal(c.pn98Moeglich, true, 'Feldbogen allein reicht');
assert.match(c.hinweise.join(' '), /noch nicht abgeschlossen/);
assert.match(c.hinweise.join(' '), /kein Scan des Papierbogens/);

const bild = { data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), ext: 'jpg', widthPx: 1240, heightPx: 1754 };
const scans = { 'fp-1': [Object.assign({}, feldRec().scans[0], { status: 'ok', bild }), Object.assign({}, feldRec().scans[1], { status: 'fehlt' })] };
const rf = ANLAGE.pn98Brand(mitFeld(), { ...opt, brand: false, scans });
const ff = lade.unzip(DOCX.build({ created: opt.erstellt, blocks: rf.blocks }), DOCX.crc32);
const fdoc = dec.decode(ff['word/document.xml']);
const ft = fdoc.slice(fdoc.indexOf('<w:body>')).replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
assert.match(ft, /Übertragung des Feldbogens 26\.0142-PN-01 · Feldprotokoll 1 von 1/);
assert.match(ft, /in Anlehnung an LAGA PN 98 · Protokoll 1 von 2/, 'Bildschirm-Protokolle folgen unverändert');
assert.ok(ft.indexOf('Feldprotokoll 1 von 1') < ft.indexOf('Protokoll 1 von 2'), 'Feldbögen zuerst');
assert.match(ft, /Probe 1 · Proben-Nr\. P1/);
assert.match(ft, /Probe 2 · ohne Proben-Nr\./);
assert.match(ft, /Mischprobe aus 4 Einzelproben/);
assert.match(ft, /ca\. 25 m³ \/ ca\. 2,5 kg/);
assert.match(ft, /ca\. 1,O \[unleserlich\] kg/, 'Gelesenes bleibt, Vermerk dazu');
assert.match(ft, /Anwesende:\nHr\. Muster \[unleserlich\]/);
assert.match(ft, /PAK, Asbest · Chlorid/);
assert.match(ft, /stückig, körnig/);
assert.match(ft, /Transport kühl und dunkel:\nja/);
assert.match(ft, /Probenehmer:\nvorhanden\nAnwesende \/ Zeugen:\n—/);
assert.match(ft, /erfasst von AB ab 22\.10\.2026 09:00 Uhr; abgeschlossen von AB am 22\.10\.2026 10:00 Uhr; Übertragung nicht durch eine zweite Person geprüft/);
assert.match(ft, /Änderungen nach Abschluss der Erfassung \(1\)/);
assert.match(ft, /Probe 1 · Laborprobe ca\.\n2,0\n2,5/);
assert.match(ft, /26-0142-PN-01_Scan_2026-10-22\.jpg · abgelegt 22\.10\.2026 09:30 Uhr von AB · Prüfsumme beim Erstellen der Anlage bestätigt/);
assert.match(ft, /_2\.pdf · abgelegt .* · als ungültig vermerkt: falscher Bogen/);
assert.match(ft, new RegExp('SHA-256 ' + 'cd'.repeat(32)));
assert.match(ft, /verkleinerte Wiedergabe; maßgeblich ist die Datei/);
assert.equal(Object.keys(ff).filter(k => k.startsWith('word/media/')).length, 1, 'ein Scan eingebettet (der ungültige nicht)');
const abw = ANLAGE.pn98Brand(mitFeld(), { ...opt, brand: false, scans: { 'fp-1': [Object.assign({}, feldRec().scans[0], { status: 'abweichend' })] } });
const at = JSON.stringify(abw.blocks);
assert.match(at, /ACHTUNG: Datei weicht von der abgelegten Prüfsumme ab/);
assert.doesNotMatch(at, /"t":"image"/, 'abweichender Scan wird nicht als Bild gezeigt');
const ohneScans = JSON.stringify(ANLAGE.pn98Brand(mitFeld(), { ...opt, brand: false }).blocks);
assert.match(ohneScans, /Prüfsumme nicht nachgeprüft/, 'ohne Nachprüfung ehrlich vermerkt');

console.log('Anlage: alle Prüfungen bestanden');
