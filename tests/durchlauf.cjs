// Durchlaufzeiten: Daten aus synthetischen Projektspuren, fehlende/unplausible Angaben, Statistik. Ohne Browser.
const assert = require('node:assert/strict');
const D = require('../durchlauf.js');
const mittag = iso => Date.parse(iso + 'T12:00:00Z');   // Dateidatum mittags: gleicher Kalendertag in jeder Zeitzone Europas
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('OK Durchlauf: ' + name); };

const voll = {
  pj: { ortstermin: '2026-10-01' },
  auftraege: [{ name: '26.0123_PAK_02-10-2026_Laborübergabe.xls', lastModified: mittag('2026-10-05') }, { name: '26.0123_24-10-2026_Daten.json', lastModified: mittag('2026-10-24') }],
  ergebnisse: [{ name: 'AR-26-0001.xml', lastModified: mittag('2026-10-09'), labor: 'Eurofins' }, { name: 'AR-26-0001.pdf', lastModified: mittag('2026-10-09') }, { name: '26.0123_Probenliste.json', lastModified: mittag('2026-10-01') }],
  buero: [{ order: { created: '2026-10-15T09:30:00Z' }, status: 'Erledigt', withdrawn: false, sent: { a: { date: '2026-10-16' }, b: { date: '2026-10-17' } } }],
};

ok('vollständiger Ablauf: Daten und Abschnitte', () => {
  const r = D.projekt(voll);
  assert.deepEqual(r.daten, { ortstermin: '2026-10-01', laborauftrag: '2026-10-02', pruefbericht: '2026-10-09', uebergabe: '2026-10-15', versand: '2026-10-17' });
  assert.deepEqual(r.abschnitte, { aufnahme: 1, labor: 7, gutachten: 6, buero: 2, gesamt: 16 });
  assert.equal(r.labor, 'Eurofins'); assert.deepEqual(r.hinweise, []);
});
ok('Datum der Laborübergabe kommt aus dem Dateinamen, sonst aus dem Dateidatum', () => {
  assert.equal(D.datumAusName('26.0123_Chlorid_07-10-2026_Laborübergabe.xls'), '2026-10-07');
  assert.equal(D.datumAusName('26.0123_PAK_31-02-2026_Laborübergabe.xls'), '');
  const r = D.projekt({ auftraege: [{ name: 'Alt_Laborübergabe.xls', lastModified: mittag('2026-10-03') }] });
  assert.equal(r.daten.laborauftrag, '2026-10-03');
});
ok('mehrere Aufträge und Berichte: jeweils der erste', () => {
  const r = D.projekt({ ...voll, auftraege: [...voll.auftraege, { name: 'x_Asbest_06-10-2026_Laborübergabe.xls', lastModified: mittag('2026-10-06') }],
    ergebnisse: [...voll.ergebnisse, { name: 'AR-26-0002.xml', lastModified: mittag('2026-10-20'), labor: 'Eurofins' }] });
  assert.equal(r.daten.laborauftrag, '2026-10-02'); assert.equal(r.daten.pruefbericht, '2026-10-09');
});
ok('ein älterer, mitkopierter Bericht zählt nicht als Antwort auf den Auftrag', () => {
  const r = D.projekt({ ...voll, ergebnisse: [{ name: 'Altbericht.pdf', lastModified: mittag('2025-03-01') }, ...voll.ergebnisse] });
  assert.equal(r.daten.pruefbericht, '2026-10-09');
});
ok('fehlende Angaben: nur die betroffenen Abschnitte fallen heraus', () => {
  const r = D.projekt({ ...voll, pj: {} });
  assert.equal(r.daten.ortstermin, ''); assert.ok(!('aufnahme' in r.abschnitte) && !('gesamt' in r.abschnitte)); assert.equal(r.abschnitte.labor, 7);
  assert.deepEqual(D.projekt({}).abschnitte, {});
});
ok('unplausible Reihenfolge wird gemeldet und nicht gezählt', () => {
  const r = D.projekt({ ...voll, pj: { ortstermin: '2026-10-05' } });
  assert.ok(!('aufnahme' in r.abschnitte)); assert.match(r.hinweise[0], /Ortstermin → Laborauftrag/); assert.equal(r.abschnitte.gesamt, 12);
});
ok('zurückgenommene Übergabe zählt nicht; Versand erst bei „Erledigt“', () => {
  const r = D.projekt({ ...voll, buero: [{ order: { created: '2026-10-12T08:00:00Z' }, status: 'Neu', withdrawn: true, sent: {} },
    { order: { created: '2026-10-14T08:00:00Z' }, status: 'In Bearbeitung', withdrawn: false, sent: { a: { date: '2026-10-15' } } }] });
  assert.equal(r.daten.uebergabe, '2026-10-14'); assert.equal(r.daten.versand, ''); assert.ok(!('buero' in r.abschnitte));
});
ok('ohne digitale Übergabe: Versanddatum aus dem älteren „Verteiler“', () => {
  const r = D.projekt({ ...voll, buero: [], pj: { ortstermin: '2026-10-01', verteiler: { versicherung: { an: true, versandt: '2026-10-20' }, sanierung: { an: false, versandt: '2026-10-30' } } } });
  assert.equal(r.daten.versand, '2026-10-20'); assert.equal(r.abschnitte.gesamt, 19); assert.ok(!('buero' in r.abschnitte));
});
ok('Median, langsamstes Projekt und Laborzeiten je Labor', () => {
  assert.equal(D.median([5, 1, 3]), 3); assert.equal(D.median([4, 1, 3, 2]), 2.5); assert.equal(D.median([]), null);
  const liste = [['26.0001 A', 5, 'Eurofins'], ['26.0002 B', 9, 'Eurofins'], ['26.0003 C', 3, '']].map(([name, labor, l]) => ({ name, ergebnis: { abschnitte: { labor }, labor: l } }));
  liste.push({ name: '26.0004 offen', ergebnis: null });
  const a = D.auswerten(liste), labor = a.abschnitte.find(x => x.key === 'labor');
  assert.equal(labor.n, 3); assert.equal(labor.median, 5); assert.deepEqual(labor.max, { name: '26.0002 B', tage: 9 });
  assert.deepEqual(a.labore, [{ labor: 'Eurofins', n: 2, median: 7, max: 9 }, { labor: 'Labor nicht erkannt', n: 1, median: 3, max: 3 }]);
  assert.equal(a.abschnitte.find(x => x.key === 'gesamt').n, 0);
});
console.log(`OK Durchlauf: ${n} Fälle`);
