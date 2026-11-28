// Fälle für den Vergleich „Projekt ohne Termin-PDFs: Anlagen-Listen genau wie 1.55.0“ (tests/mitteilungen.cjs, ab 1.56.0): anlagenListen
// mit und ohne Lage, kachelTexte, angebot – mit Plan-PDFs ohne Termin-Zusatz (keiner, einer, „- 2. Termin“, EG/1. OG, ungültiges Datum,
// Kopie „(2)“) und einem kopierten Termin-Plan eines anderen Projekts. Ergebnis von Projektzentrale 1.55.0 (fa8dfe8, anlagen.js von
// BerichtKit 1.26.1) gespeichert in mitteilungen-1.55.0.json. Erfundene Daten.
process.env.TZ = process.env.TZ || 'Europe/Berlin';
const fs = require('node:fs'), path = require('node:path');
module.exports = (M, A, LA) => {
  const ms = iso => new Date(iso).getTime(), NR = '26.0999', ORDNER = '26.0999 Teststadt Ka';
  const fix = n => JSON.parse(fs.readFileSync(path.join(__dirname, n), 'utf8'));
  const pj = { ortstermin: '2026-08-12', weitereOrtstermine: [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung' }], ortsterminZaehler: 2 };
  const zwei = { ...pj, weitereMitteilungen: [{ id: 'm1', nr: 1, termine: ['t1'], auftraege: ['a1'] }, { id: 'm2', nr: 2, termine: ['t2'], auftraege: ['a2'] }], mitteilungZaehler: 2 };
  const beide = { ...zwei, weitereMitteilungen: [zwei.weitereMitteilungen[0], { ...zwei.weitereMitteilungen[1], termine: ['t1', 't2', 't9'] }] };
  const word = [{ name: `1._Mitteilung_${NR}.docx`, rel: `Mitteilungen/1._Mitteilung_${NR}.docx`, t: ms('2026-08-19T08:00:00') }, { name: `2._Mitteilung_${NR}.docx`, rel: `Mitteilungen/2._Mitteilung_${NR}.docx`, t: ms('2026-11-27T10:00:00') }];
  const a1 = { id: 'a1', art: 'gutachten', word: word[0].rel, erstellt: '2026-08-19T09:00:00.000Z', erledigt: true, erledigtAm: '2026-08-20T10:00:00.000Z', geloescht: false,
    anlagen: ['Laborergebnisse/AR-26-0001-01.pdf', `Fotos/Bilddokumentation_${NR}_Teststadt_2026-08-12.pdf`, `Pläne/Probenplan ${ORDNER}.pdf`], empfaenger: [] };
  const fotos = [{ name: `Bilddokumentation_${NR}_Teststadt_2026-08-12.pdf`, t: ms('2026-08-13T10:00:00') }, { name: `Bilddokumentation_${NR}_Teststadt_2026-08-20.pdf`, t: ms('2026-08-21T10:00:00') }];
  const P = (...l) => l.map(([z, iso]) => ({ name: `Probenplan ${ORDNER}${z}.pdf`, t: ms(iso) }));
  const plaeneJe = {
    keiner: [], einer: P(['', '2026-08-13T11:00:00']), zweiterTermin: P(['', '2026-08-13T11:00:00'], [' - 2. Termin', '2026-08-22T11:00:00']),
    geschosse: P([' - EG', '2026-08-13T11:00:00'], [' - 1. OG', '2026-08-13T11:00:00'], [' - EG', '2026-08-22T11:00:00']), ungueltig: P(['', '2026-08-13T11:00:00'], [' - Termin 31.02.2026', '2026-08-22T11:00:00']),
    kopie: P(['', '2026-08-13T11:00:00'], [' (2)', '2026-08-22T11:00:00'], [' - Ergebniskarte', '2026-08-22T11:00:00']),
    fremd: [...P(['', '2026-08-13T11:00:00']), { name: 'Probenplan 99.8888 Andere Straße Köln Ben - Termin 20.08.2026.pdf', t: ms('2026-08-22T11:00:00') }],
  };
  const labor = ['AR-26-0001-01.pdf', 'AR-26-0002-01.pdf'].map((name, i) => ({ name, t: ms(`2026-08-2${i + 3}T10:00:00`) }));
  const lage = M.auftragsLage(LA.lesen(fix('labelkit-5.5.0-zwei-auftraege.json')), { ...M.ergebnisAuszug(fix('ergebnisse-2.7.0-A.json')), veraltet: false });
  const out = [];
  for (const [pn, plaene] of Object.entries(plaeneJe)) {
    const vorhanden = new Set([...fotos.map(f => 'fotos/' + f.name), ...plaene.map(f => 'pläne/' + f.name), ...labor.map(f => 'laborergebnisse/' + f.name)].map(s => s.normalize('NFC').toLowerCase()));
    const e = (d, x = {}) => ({ pj: d, fotos, plaene, labor, vorhanden, fk: null, bk: [], ordnerName: ORDNER, projektNr: NR, ...x });
    const faelle = [['zwei offen', zwei, word, [], e(zwei)], ['zwei offen, Lage', zwei, word, [], e(zwei, { lage })], ['1. übergeben', zwei, word, [a1], e(zwei)],
      ['2. über alle Termine + entfernter', beide, word, [a1], e(beide)], ['Bestand', pj, word, [a1], e(pj)], ['eine Mitteilung übergeben', pj, [word[0]], [a1], e(pj)]];
    for (const [name, d, w, auf, ee] of faelle) {
      const l = M.liste(d, w, auf), L = M.anlagenListen(l, ee, A);
      out.push({ name: pn + ' · ' + name, listen: [...L], kacheln: l.mitteilungen.map(m => M.kachelTexte(m, L.get(m.schluessel), d, ee.lage)), angebot: M.angebot(l, ee) });
    }
  }
  return out;
};
