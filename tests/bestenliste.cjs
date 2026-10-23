// Bestenliste – Punkte, Ranglisten, Abzeichen, Ticker: node tests/bestenliste.cjs
// Nur erfundene Namen und Kürzel.
const assert = require('node:assert/strict');
const B = require('../bestenliste/punkte.js');

const personen = [
  { ordnerKuerzel: 'Abc', appKuerzel: 'AB', name: 'Anna Beispiel', aktiv: true },
  { ordnerKuerzel: 'Dr. Te', appKuerzel: 'TE', name: 'Dr. Tea Test', aktiv: true },
  { ordnerKuerzel: 'Bue', appKuerzel: 'BU', name: 'Bea Büro', aktiv: true },
  { ordnerKuerzel: 'Alt', appKuerzel: 'ALT', name: 'Ehemalig', aktiv: false },
];
let n = 0;
const rec = (o) => ({ order: { id: 'o' + (++n), created: o.created || '2026-03-02T08:00:00.000Z' }, status: o.status || 'Neu', withdrawn: !!o.withdrawn,
  proof: o.proof || null, pdf: o.pdf || null, sent: o.sent || {}, events: o.events || [] });
const fertig = (tag, wer = 'BU', extra = {}) => rec({ status: 'Erledigt', created: extra.created, proof: { at: `${tag}T09:00:00.000Z`, actor: wer }, pdf: { at: `${tag}T10:00:00.000Z`, actor: wer },
  sent: { a: { at: `${tag}T11:00:00.000Z`, actor: wer }, b: { at: `${tag}T12:00:00.000Z`, actor: 'bu' } }, ...extra });

// Hilfsfunktionen
assert.equal(B.probenZaehlen({ pn98Proben: [{}, {}], brandgeruchProben: [{}], chloridProben: [{}], asbestProben: [], sonstigeProben: [{}, null], fremd: [{}] }), 5);
assert.equal(B.probenZaehlen(null), 0);
assert.equal(B.personZu(personen, 'dr.te').name, 'Dr. Tea Test');
assert.equal(B.personZu(personen, 'bu').name, 'Bea Büro');           // App-Kürzel
assert.equal(B.personZu(personen, 'Bea Büro').name, 'Bea Büro');     // voller Name
assert.equal(B.personZu(personen, 'Beaa'), null);                     // nichts raten
// Werktage: Fr → Di = 2 (Mo, Di), Fr → Mi = 3, gleicher Tag = 0
assert.equal(B.werktage('2026-03-06T15:00:00', '2026-03-10T09:00:00'), 2);
assert.equal(B.werktage('2026-03-06T15:00:00', '2026-03-11T09:00:00'), 3);
assert.equal(B.werktage('2026-03-06T08:00:00', '2026-03-06T18:00:00'), 0);

const projekte = [
  // Anna: abgeschlossen mit 25 Proben (gekappt auf 20), Foto, Plan → 10+20+2+2 = 34; schnelle Rückfrage +2
  { name: '26.0001 Ort1 Abc', nr: '26.0001', yy: '26', ort: 'Ort1', kuerzel: 'Abc', proben: 25, fotoPdf: true, plan: true,
    records: [fertig('2026-03-10', 'BU', { created: '2026-03-09T08:00:00.000Z',
      events: [{ id: 'q1', type: 'question', at: '2026-03-06T15:00:00.000Z' }, { id: 'a1', type: 'answer', at: '2026-03-10T08:00:00.000Z' }] })] },
  // Tea: abgeschlossen, 3 Proben → 13; langsame Rückfrage (3 Werktage) → 0
  { name: '26.0002 Ort2 Dr. Te', nr: '26.0002', yy: '26', ort: 'Ort2', kuerzel: 'Dr. Te', proben: 3, fotoPdf: false, plan: false,
    records: [fertig('2026-03-20', 'TE', { events: [{ id: 'q2', type: 'question', at: '2026-03-06T15:00:00.000Z' }, { id: 'a2', type: 'answer', at: '2026-03-11T08:00:00.000Z' }] })] },
  // Offenes Projekt: keine Abschlusspunkte, aber Gegenlesen zählt; Kürzel mit Tippfehler → nicht zugeordnet
  { name: '26.0003 Ort3 Abc', nr: '26.0003', yy: '26', ort: 'Ort3', kuerzel: 'Abc', proben: 50, fotoPdf: true, plan: true,
    records: [rec({ status: 'In Bearbeitung', proof: { at: '2026-03-21T09:00:00.000Z', actor: 'Bxx' } })] },
  // Zurückgenommene, eigentlich erledigte Übergabe zählt gar nicht
  { name: '25.0004 Ort4 Abc', nr: '25.0004', yy: '25', ort: 'Ort4', kuerzel: 'Abc', proben: 0, records: [fertig('2025-12-01', 'BU', { withdrawn: true })] },
  // Zwei erledigte Übergaben im selben Projekt: ein Abschluss (der frühere), Büropunkte für beide
  { name: '25.0005 Ort5 Alt', nr: '25.0005', yy: '25', ort: 'Ort5', kuerzel: 'Alt', proben: 0, records: [fertig('2025-11-03'), fertig('2025-11-20')] },
  // Ohne Kürzel: Abschluss ohne Person
  { name: '24.0006 Ort6', nr: '24.0006', yy: '24', ort: 'Ort6', kuerzel: '', proben: 0, records: [fertig('2024-05-02')] },
];
const e = B.eintraege(projekte, personen);
const summe = (key, f = () => true) => e.filter(x => x.key === key && f(x)).reduce((a, x) => a + x.punkte, 0);
assert.equal(summe('abc'), 34 + 2);
assert.equal(e.find(x => x.art === 'proben' && x.key === 'abc').anzahl, 20);
assert.equal(summe('drte', x => x.art !== 'gegenlesen' && x.art !== 'pdf' && x.art !== 'versand'), 13);
assert.equal(summe('drte', x => ['gegenlesen', 'pdf', 'versand'].includes(x.art)), 5);      // TE hat ihre eigene Übergabe im Büro erledigt
assert.equal(e.filter(x => x.art === 'abschluss' && x.key === 'alt').length, 1);
assert.equal(e.find(x => x.art === 'abschluss' && x.key === 'alt').at, '2025-11-03T12:00:00.000Z');
assert.equal(e.filter(x => x.projekt === '25.0004 Ort4 Abc').length, 0);
// Büro: Bea bekommt 5 je erledigter Übergabe (0001, 0005 ×2, 0006) = 20; Versand nur einmal je Übergabe
assert.equal(summe('bue'), 20);
assert.equal(e.filter(x => x.art === 'versand' && x.projekt === '26.0001 Ort1 Abc').length, 1);
assert.equal(e.find(x => x.art === 'abschluss' && x.projekt === '24.0006 Ort6').key, null);
assert.equal(e.find(x => x.art === 'abschluss' && x.projekt === '26.0001 Ort1 Abc').dauerMs, 28 * 36e5);   // 09.03. 08:00 → 10.03. 12:00

// Ranglisten
const jahr = B.rangliste(e, personen, '2026-01-01T00:00:00.000Z');
assert.deepEqual(jahr.map(r => [r.name, r.punkte, r.platz]), [['Anna Beispiel', 36, 1], ['Dr. Tea Test', 18, 2], ['Bea Büro', 5, 3]]);
const gesamt = B.rangliste(e, personen, '');
assert.deepEqual(gesamt.map(r => r.name), ['Anna Beispiel', 'Bea Büro', 'Dr. Tea Test', 'Ehemalig']);   // inaktiv nur mit Punkten
assert.deepEqual(B.ohneZuordnung(e, '').map(o => [o.roh, o.punkte]), [['ohne Kürzel im Ordnernamen', 10], ['Bxx', 3]]);
// gleiche Punkte = gleicher Platz
const gleich = B.rangliste([{ key: 'abc', name: 'Anna Beispiel', punkte: 5, at: '2026-01-02', art: 'pdf' }, { key: 'drte', name: 'Dr. Tea Test', punkte: 5, at: '2026-01-02', art: 'pdf' }], personen, '');
assert.deepEqual(gleich.map(r => r.platz), [1, 1, 3]);

// Ticker: Abschluss mit Boni als eine Zeile
const t = B.ticker(e, 50), anna = t.find(x => x.art === 'abschluss' && x.key === 'abc');
assert.equal(anna.punkte, 34); assert.deepEqual(anna.teile.sort(), ['abschluss', 'foto', 'plan', 'proben']);
assert.equal(t[0].at >= t[t.length - 1].at, true);
const bueroZeile = t.find(x => x.key === 'bue' && x.projekt === '26.0001 Ort1 Abc');
assert.equal(bueroZeile.punkte, 5); assert.equal(B.tickerText(bueroZeile), 'hat gegengelesen, das PDF zugeordnet und den Versand dokumentiert');
assert.equal(B.tickerText(anna), 'hat abgeschlossen');
assert.equal(B.rangliste(e, personen, '').find(r => r.key === 'bue').gegenlesen, 4);

// Abzeichen
const jetzt = new Date('2026-03-25T12:00:00');
const abz = B.abzeichen(e, personen, jetzt);
assert.ok(abz.get('abc').some(a => a.id === 'meilenstein' && a.titel === 'Erster Abschluss'));
assert.ok(abz.get('abc').some(a => a.id === 'probenkoenig' && /führt diesen Monat/.test(a.text)));
assert.ok(abz.get('abc').some(a => a.id === 'schnellster'));
assert.ok(!abz.get('drte').some(a => a.id === 'probenkoenig'));
// Serie: Abschlüsse in drei aufeinanderfolgenden Wochen, Rückfrage-Retter ab 5
const serie = [0, 7, 14, 30].map((d, i) => ({ key: 'abc', name: 'Anna', art: 'abschluss', punkte: 10, at: new Date(Date.UTC(2026, 0, 5 + d, 10)).toISOString(), gruppe: 'g' + i }));
const retter = Array.from({ length: 5 }, (_, i) => ({ key: 'abc', name: 'Anna', art: 'rueckfrage', punkte: 2, at: '2026-01-0' + (i + 1), gruppe: 'r' + i }));
const a2 = B.abzeichen(serie.concat(retter), personen, new Date('2026-03-01'));
assert.equal(a2.get('abc').find(a => a.id === 'serie').titel, 'Serie: 3 Wochen');
assert.ok(a2.get('abc').some(a => a.id === 'retter'));
assert.equal(B.abzeichen(serie.slice(0, 2), personen).get('abc').some(a => a.id === 'serie'), false);

// Projekte je Jahr
const j = B.jeJahr(projekte, personen);
assert.deepEqual(j.jahre, ['26', '25', '24']);
assert.deepEqual(j.zeilen.map(z => [z.name, z.jahre]), [['Anna Beispiel', { 26: 2, 25: 1 }], ['Dr. Tea Test', { 26: 1 }], ['Ehemalig', { 25: 1 }], ['Ohne erkannte Person', { 24: 1 }]]);
console.log('OK Bestenliste: Punkte, Kappung, Büro, Rückfrage, Rangliste, Gleichstand, nicht zugeordnet, Ticker, Abzeichen, Projekte je Jahr');
