// Fälle für den Vergleich „ohne die neuen Eingaben wie 1.54.0“ (tests/mitteilungen.cjs): anlagenListen ohne e.lage, kachelTexte ohne viertes
// Argument, angebot ohne e.lage. Ergebnis von Projektzentrale 1.54.0 (a3e766d) gespeichert in mitteilungen-1.54.0.json. Erfundene Daten.
process.env.TZ = process.env.TZ || 'Europe/Berlin';
module.exports = (M, A) => {
  const ms = iso => new Date(iso).getTime(), NR = '26.0999', ORDNER = '26.0999 Teststadt Ka';
  const pj = { ortstermin: '2026-08-12', weitereOrtstermine: [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung' }], ortsterminZaehler: 2 };
  const zwei = { ...pj, weitereMitteilungen: [{ id: 'm1', nr: 1, termine: ['t1'], auftraege: ['a1'] }, { id: 'm2', nr: 2, termine: ['t2'], auftraege: ['a2'] }], mitteilungZaehler: 2 };
  const leer = { ...zwei, weitereMitteilungen: zwei.weitereMitteilungen.map(e => ({ ...e, auftraege: [] })) };
  const word = [{ name: `1._Mitteilung_${NR}.docx`, rel: `Mitteilungen/1._Mitteilung_${NR}.docx`, t: ms('2026-08-19T08:00:00') }, { name: `2._Mitteilung_${NR}.docx`, rel: `Mitteilungen/2._Mitteilung_${NR}.docx`, t: ms('2026-11-27T10:00:00') }];
  const a1 = { id: 'a1', art: 'gutachten', word: word[0].rel, erstellt: '2026-08-19T09:00:00.000Z', erledigt: true, erledigtAm: '2026-08-20T10:00:00.000Z', geloescht: false,
    anlagen: ['Laborergebnisse/AR-26-0001-01.pdf', `Fotos/Bilddokumentation_${NR}_Teststadt_2026-08-12.pdf`], empfaenger: [] };
  const fotos = [{ name: `Bilddokumentation_${NR}_Teststadt_2026-08-12.pdf`, t: ms('2026-08-13T10:00:00') }, { name: `Bilddokumentation_${NR}_Teststadt_2026-08-20.pdf`, t: ms('2026-08-21T10:00:00') }];
  const plaene = [{ name: `Probenplan ${ORDNER}.pdf`, t: ms('2026-08-13T11:00:00') }];
  const labor = ['AR-26-0001-01.pdf', 'AR-26-0002-01.pdf', 'AR-26-0002-01 (2).pdf'].map((name, i) => ({ name, t: ms(`2026-08-2${i + 3}T10:00:00`) }));
  const vorhanden = new Set([...fotos.map(f => 'fotos/' + f.name), ...plaene.map(f => 'pläne/' + f.name), ...labor.map(f => 'laborergebnisse/' + f.name)].map(s => s.normalize('NFC').toLowerCase()));
  const bk = [{ datei: word[0].name, am: '2026-08-18T10:00:00.000Z', anlagen: ['Laborergebnisse/AR-26-0001-01.pdf', 'Laborergebnisse/AR-26-0002-01.pdf'] }];
  const e = (d, x = {}) => ({ pj: d, fotos, plaene, labor, vorhanden, fk: null, bk: [], ordnerName: ORDNER, projektNr: NR, ...x });
  const faelle = [
    ['zwei offen', zwei, word, [], e(zwei)], ['zwei offen, leer', leer, word, [], e(leer)], ['1. übergeben', zwei, word, [a1], e(zwei)],
    ['Bestand', pj, word, [a1], e(pj)], ['BerichtKit', zwei, word, [], e(zwei, { bk })], ['eine Mitteilung übergeben', pj, [word[0]], [a1], e(pj)],
  ];
  return faelle.map(([name, d, w, auf, ee]) => {
    const l = M.liste(d, w, auf), L = M.anlagenListen(l, ee, A);
    return { name, listen: [...L].map(([k, v]) => [k, v]), kacheln: l.mitteilungen.map(m => M.kachelTexte(m, L.get(m.schluessel), d)), angebot: M.angebot(l, ee) };
  });
};
