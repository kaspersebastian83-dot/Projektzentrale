// Mitteilungen als Ebene (mitteilungen.js) – reine Rechnung, erfundene Daten (Testprojekt „26.0999 Teststadt Ka“ aus Befund F7).
process.env.TZ = process.env.TZ || 'Europe/Berlin';
const assert = require('node:assert/strict');
const path = require('node:path');
const M = require('../mitteilungen.js');
const S = require('../stufen.js');
const A = require('../anlagen.js');

const ms = iso => new Date(iso).getTime();
assert.equal(String(M.MITTEILUNG), String(S.MITTEILUNG), 'gleiches Muster wie stufen.js');
assert.equal(M.nrAusName('Mitteilungen/2._Mitteilung_26.0999.docx'), 2);
assert.equal(M.nrAusName('1. Mitteilung Gebäude.docx'), 1);
assert.equal(M.nrAusName('Gutachten 26.0999.docx'), 0);
assert.equal(M.nrAusName('26.0999_Probenahme_2026-08-21.docx'), 0);

// ---------- Testprojekt F7 ----------
const NR = '26.0999', ORDNER = '26.0999 Teststadt Ka';
const pj = { ortstermin: '2026-08-12', weitereOrtstermine: [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung', wer: 'Ka' }], ortsterminZaehler: 2 };
const word = [
  { name: `1._Mitteilung_${NR}.docx`, rel: `Mitteilungen/1._Mitteilung_${NR}.docx`, t: ms('2026-08-14T08:00:00') },
  { name: `2._Mitteilung_${NR}.docx`, rel: `Mitteilungen/2._Mitteilung_${NR}.docx`, t: ms('2026-11-27T10:00:00') },
];
const a1 = { id: 'a1', art: 'gutachten', word: `Mitteilungen/1._Mitteilung_${NR}.docx`, erstellt: '2026-08-14T09:00:00.000Z', erledigt: true, erledigtAm: '2026-08-15T10:00:00.000Z', geloescht: false,
  anlagen: [`Laborergebnisse/AR-001.pdf`, `Fotos/Bilddokumentation_${NR}_Teststadt_2026-08-12.pdf`, `Pläne/Probenplan ${ORDNER}.pdf`], empfaenger: [] };
const fotos = [{ name: `Bilddokumentation_${NR}_Teststadt_2026-08-12.pdf`, t: ms('2026-08-13T10:00:00') }, { name: `Bilddokumentation_${NR}_Teststadt_2026-08-20.pdf`, t: ms('2026-08-21T10:00:00') }];
const plaene = [{ name: `Probenplan ${ORDNER}.pdf`, t: ms('2026-08-13T11:00:00') }, { name: `Probenplan ${ORDNER} - 2. Termin.pdf`, t: ms('2026-08-22T11:00:00') }];
const labor = ['AR-001.pdf', 'AR-002.pdf', 'AR-003.pdf'].map((name, i) => ({ name, t: ms(`2026-0${i ? 9 : 8}-0${i + 1}T10:00:00`) }));
const vorhanden = new Set([...fotos.map(f => 'fotos/' + f.name), ...plaene.map(f => 'pläne/' + f.name), ...labor.map(f => 'laborergebnisse/' + f.name), ...word.map(w => w.rel)].map(s => s.normalize('NFC').toLowerCase()));
const fk = { bilddokus: { t1: { dateien: [fotos[0].name], erstellt: '2026-08-13T10:00:00.000Z' }, t2: { dateien: [fotos[1].name], erstellt: '2026-08-21T10:00:00.000Z' } } };
const e = pjX => ({ pj: pjX, fotos, plaene, labor, vorhanden, fk, bk: [], ordnerName: ORDNER, projektNr: NR });

// ---------- Zustand je Mitteilung ----------
let l = M.liste({}, word, [a1]);
assert.equal(l.mehrere, true); assert.equal(l.bestand, true, 'zwei Dateinamen, kein Eintrag');
assert.deepEqual(l.mitteilungen.map(m => [m.nr, m.zustand, m.versandtAm, m.schluessel, m.id]), [[1, 'versandt', '2026-08-15', 'nr1', ''], [2, 'entwurf', '', 'nr2', '']]);
assert.equal(M.zustandText(l.mitteilungen[0]), 'versandt 15.08.'); assert.equal(M.zustandText(l.mitteilungen[1]), 'Entwurf');
// beim Büro; zurückgezogen zählt nicht (aber „je übergeben“); ohne Word-Datei und umbenannt: keiner Mitteilung zuzuordnen
l = M.liste({}, word, [{ ...a1, erledigt: false, erledigtAm: '' }]);
assert.equal(l.mitteilungen[0].zustand, 'buero');
l = M.liste({}, word, [{ ...a1, geloescht: true }]);
assert.equal(l.mitteilungen[0].zustand, 'entwurf'); assert.equal(l.mitteilungen[0].jeUebergeben, true); assert.equal(M.entfernbar(l.mitteilungen[0]), false);
l = M.liste({}, word, [{ ...a1, word: '' }, { ...a1, id: 'a2', word: 'Mitteilungen/Gutachten 26.0999.docx' }]);
assert.equal(l.ohneWord.length, 1); assert.equal(l.fremd.length, 1); assert.deepEqual(l.mitteilungen.map(m => m.zustand), ['entwurf', 'entwurf']);
// alte Übergabe: der neueste nicht zurückgezogene Auftrag zählt
l = M.liste({}, word, [{ ...a1, id: 'a0', erstellt: '2026-08-10T09:00:00.000Z', erledigt: true, erledigtAm: '2026-08-11T09:00:00.000Z' }, { ...a1, erledigt: false }]);
assert.equal(l.mitteilungen[0].zustand, 'buero');
// frühere Versandangaben (#vtBox): nur ungefähr, für Mitteilungen ohne Büroaufgabe, deren Datei am Versandtag oder früher liegt
l = M.liste({}, word, [], { versandt: '2026-08-20' });
assert.deepEqual(l.mitteilungen.map(m => [m.zustand, m.quelle]), [['versandt', 'verteiler'], ['entwurf', '']]);
// in Arbeit: Eintrag ohne Word-Datei; eine Mitteilung → keine Zeile
const zwei = { ...pj, weitereMitteilungen: [{ id: 'm1', nr: 1, termine: ['t1'], auftraege: [] }, { id: 'm2', nr: 2, termine: ['t2'], auftraege: [] }], mitteilungZaehler: 2 };
l = M.liste(zwei, [word[0]], [a1]);
assert.deepEqual(l.mitteilungen.map(m => [m.id, m.zustand]), [['m1', 'versandt'], ['m2', 'arbeit']]); assert.equal(l.bestand, false);
assert.equal(M.entfernbar(l.mitteilungen[1]), true); assert.equal(M.entfernbar(l.mitteilungen[0]), false);
assert.equal(M.liste({}, [word[0]], [a1]).mehrere, false);
assert.equal(M.liste({}, [], []).mehrere, false);
// Vorwahl in der Zeile: gemerkt, sonst neueste nicht versandte
l = M.liste(zwei, word, [a1]);
assert.equal(M.vorwahl(l, '').id, 'm2'); assert.equal(M.vorwahl(l, 'm1').id, 'm1'); assert.equal(M.vorwahl(l, 'm9').id, 'm2');
console.log('OK mitteilungen: Zustand je Mitteilung (versandt, beim Büro, zurückgezogen, ohne Word, umbenannt, alte Übergabe, frühere Versandangaben, in Arbeit)');

// ---------- Kennung und Zähler (O13 sinngemäß) ----------
assert.equal(M.naechsteKennung({}), 'm2');
assert.equal(M.naechsteKennung(zwei), 'm3');
assert.equal(M.naechsteKennung({ ...zwei, weitereMitteilungen: zwei.weitereMitteilungen.slice(0, 1), mitteilungZaehler: 3 }), 'm4', 'entfernt → nicht neu vergeben');
assert.equal(M.naechsteKennung({ mitteilungZaehler: 3 }), 'm4', 'Liste weg, Zähler bleibt');
assert.equal(M.naechsteKennung({ weitereMitteilungen: [{ id: 'm5', nr: 3 }] }), 'm6', 'ohne Zähler: höchste in der Liste');
assert.equal(M.naechsteKennung({ weitereMitteilungen: [{ id: 'm5', nr: 3 }], mitteilungZaehler: 2 }), 'm6', 'Zähler darunter: nie eine vergebene');
assert.equal(M.naechsteKennung(zwei, ['m3']), 'm4');
assert.equal(M.zaehlerNach({ mitteilungZaehler: 5 }, 'm3'), 5); assert.equal(M.zaehlerNach({}, 'm1', 'm2'), 2);
// Nummer (Entscheidung 6): höchste aus Dateinamen und Einträgen + 1
assert.equal(M.naechsteNr(word, {}), 3); assert.equal(M.naechsteNr([], {}), 2);
assert.equal(M.naechsteNr([word[0]], { weitereMitteilungen: [{ id: 'm1', nr: 1 }, { id: 'm2', nr: 2 }] }), 3);
// bereinigt: leer → null (Feld weg), Texte getrimmt, doppelte Pfade weg, unbekannte Felder bleiben
assert.equal(M.bereinigt([]), null);
assert.deepEqual(M.bereinigt([{ id: ' m2 ', nr: 2, termine: ['t2', 't2', ''], anlagenDazu: [' Fotos/a.pdf', 'fotos/A.pdf'], anlagenWeg: [], x: 1 }]), [{ id: 'm2', nr: 2, termine: ['t2'], anlagenDazu: ['Fotos/a.pdf'], x: 1 }]);
console.log('OK mitteilungen: Kennung nie neu vergeben (Zähler sinkt nie, bleibt ohne Liste), Nummer nach Dateinamen und Einträgen, bereinigt');

// ---------- Grenze und Vorwahl beim Anlegen (Abschnitt 3) ----------
l = M.liste(pj, word, [a1]);
assert.deepEqual(M.grenze(l), { datum: '2026-08-14', quelle: 'uebergabe', text: 'nach der Übergabe am 14.08.' });
assert.equal(M.grenze(M.liste(pj, word, [], { versandt: '2026-08-16' }), { versandt: '2026-08-16' }).quelle, 'versand');
assert.equal(M.grenze(M.liste(pj, word, [])).quelle, 'datei');
assert.equal(M.grenze(M.liste(pj, [], [])), null);
const sp = (l, neu) => [...l.mitteilungen.map(m => ({ schluessel: m.schluessel, eintrag: m.eintrag, m })), ...(neu ? [{ schluessel: 'neu' }] : [])];
// eine Mitteilung, übergeben am 14.08.: Termin 20.08. → neue (2.), Termin 12.08. → 1.
l = M.liste(pj, [word[0]], [a1]);
assert.deepEqual(M.vorwahlTermine(pj, sp(l, true)), { nr1: ['t1'], neu: ['t2'] });
// Bestand (zwei Dateien, kein Eintrag): nach den Enden der Mitteilungen
l = M.liste(pj, word, [a1]);
assert.deepEqual(M.vorwahlTermine(pj, sp(l)), { nr1: ['t1'], nr2: ['t2'] });
// ohne Word-Datei und Übergabe: nur der neueste Termin → neue
assert.deepEqual(M.vorwahlTermine(pj, [{ schluessel: 'nr1', m: null }, { schluessel: 'neu' }]), { nr1: ['t1'], neu: ['t2'] });
// ein Termin, nichts bekannt: zur 1.
assert.deepEqual(M.vorwahlTermine({ ortstermin: '2026-08-12' }, [{ schluessel: 'nr1', m: null }, { schluessel: 'neu' }]), { nr1: ['t1'], neu: [] });
// Einträge vorhanden: bestehende behalten ihre Termine, die neue bekommt, was in keinem Eintrag steht (Regel 3.3)
const drei = { ...zwei, weitereOrtstermine: [...pj.weitereOrtstermine, { id: 't3', datum: '2026-09-03', bezeichnung: 'Freimessung' }], ortsterminZaehler: 3 };
l = M.liste(drei, word, [a1]);
assert.deepEqual(M.vorwahlTermine(drei, sp(l, true)), { m1: ['t1'], m2: ['t2'], neu: ['t3'] });
// 1.55 (P3): alle haben Einträge („zuordnen …“ aus der gelben Zeile): der neue Termin nach dem Datum, nie in eine übergebene
assert.deepEqual(M.vorwahlTermine(drei, sp(l)), { m1: ['t1'], m2: ['t2', 't3'] }, 'nach der Übergabe am 14.08. → 2.');
assert.deepEqual(M.vorwahlTermine({ ...drei, weitereOrtstermine: [...drei.weitereOrtstermine.slice(0, 1), { id: 't3', datum: '2026-08-13' }] }, sp(l)), { m1: ['t1'], m2: ['t2'] }, 'vor der Übergabe: die 1. ist übergeben – nicht vorgewählt');
console.log('OK mitteilungen: Grenze (Übergabe → Versand → Dateizeit) und Vorwahl der Termine beim Anlegen');

// ---------- Anlagen ----------
assert.deepEqual(['Laborergebnisse/AR-1.pdf', 'Fotos/Bilddokumentation_26.0999_Teststadt_2026-08-20.pdf', 'Fotos/Skizze.pdf', 'Pläne/Probenplan X.pdf', 'Pläne/Probenplan X - Ergebniskarte.pdf',
  'Mitteilungen/26.0999_Titel_Probenahme_2026-08-21.docx', 'Mitteilungen/26.0999_Titel_PN98_2026-08-21.docx'].map(M.artVon),
  ['pruefbericht', 'bilddoku', 'sonstiges', 'probenplan', 'ergebniskarte', 'probenahme', 'sonstiges']);
// Übergabe in Nummernfolge (Entscheidung 7) – Prüfbericht(e) → Bilddoku → Plan → optional → Weiteres; jeder Pfad genau einmal
const gemischt = [`Mitteilungen/${NR}_Titel_PN98_2026-08-21.docx`, `Fotos/${fotos[1].name}`, `Pläne/${plaene[1].name}`, 'Laborergebnisse/AR-003.pdf', 'Laborergebnisse/AR-002.pdf', 'Fotos/Skizze.pdf', `Mitteilungen/${NR}_Titel_Probenahme_2026-08-21.docx`, 'Laborergebnisse/AR-002.pdf'];
assert.deepEqual(M.sortiert(gemischt, A), ['Laborergebnisse/AR-003.pdf', 'Laborergebnisse/AR-002.pdf', `Fotos/${fotos[1].name}`, `Pläne/${plaene[1].name}`, `Mitteilungen/${NR}_Titel_Probenahme_2026-08-21.docx`,
  `Mitteilungen/${NR}_Titel_PN98_2026-08-21.docx`, 'Fotos/Skizze.pdf']);
assert.deepEqual(M.sortiert(gemischt.slice(3, 5), A, ['Laborergebnisse/AR-002.pdf', 'Laborergebnisse/AR-003.pdf']), ['Laborergebnisse/AR-002.pdf', 'Laborergebnisse/AR-003.pdf'], 'Folge der Prüfberichte wie im Bericht');
assert.deepEqual(M.sortiert([], A), []);
assert.deepEqual(M.sortiert(gemischt.slice(0, 3), null), gemischt.slice(0, 3), 'ohne anlagen.js: nichts geht verloren');
assert.deepEqual(M.pfade(M.nummerieren([{ art: 'bilddoku', dateien: ['Fotos/a.pdf'] }, { art: 'pruefbericht', dateien: ['Laborergebnisse/b.pdf'] }], null)), ['Fotos/a.pdf', 'Laborergebnisse/b.pdf']);
// Vorschlag aus dem Bezug: Prüfberichte und Plan nur, wenn in keiner festen Liste; Bilddoku je Termin (FotoKit bilddokus[t])
l = M.liste(zwei, word, [a1]);
let L = M.anlagenListen(l, e(zwei), A);
const z2 = L.get('m2').zeilen.map(z => [z.nr, z.art, z.dateien.join('|'), z.herkunft, z.fehlt]);
assert.deepEqual(z2, [[1, 'pruefbericht', 'Laborergebnisse/AR-002.pdf', 'frei', false], [2, 'pruefbericht', 'Laborergebnisse/AR-003.pdf', 'frei', false],
  [3, 'bilddoku', `Fotos/${fotos[1].name}`, 'termin', false], [4, 'probenplan', `Pläne/${plaene[1].name}`, 'frei', false]]);
assert.equal(L.get('m2').zeilen[2].herkunftText, 'aus Termin 20.08. (Nachbeprobung)');
assert.equal(L.get('m1').fest, true); assert.deepEqual(M.pfade(L.get('m1').zeilen), a1.anlagen);
assert.deepEqual(L.get('m2').zeilen[0].auch, []);
// Codex-Review #94 (P2): feste Liste mit einer Bilddoku in Teilen und Plan je Geschoss – Nummern wie vor der Übergabe (eine je Anlage)
{
  const teile = [`Laborergebnisse/AR-002.pdf`, `Fotos/Bilddokumentation_${NR}_Teststadt_2026-08-20_Teil_1_von_2.pdf`, `Fotos/Bilddokumentation_${NR}_Teststadt_2026-08-20_Teil_2_von_2.pdf`,
    `Pläne/Probenplan ${ORDNER} - EG.pdf`, `Pläne/Probenplan ${ORDNER} - OG.pdf`, 'Mitteilungen/Raumluft.pdf', 'Laborberichte Eurofins'];
  const lf = M.liste(zwei, word, [a1, { ...a1, id: 'a2', word: word[1].rel, erstellt: '2026-11-27T12:00:00.000Z', erledigt: false, erledigtAm: '', anlagen: teile }]);
  const zf = M.anlagenListen(lf, e(zwei), A).get('m2').zeilen;
  assert.deepEqual(zf.map(z => z.nr), [1, 2, 2, 3, 3, 4, 5], 'Bilddoku in Teilen und Plan je Geschoss: je eine Nummer');
  assert.deepEqual(M.pfade(zf), teile.slice(0, 6), 'Texte gehören nicht zu den Pfaden');
}
// Kacheltexte je Mitteilung
assert.deepEqual(M.kachelTexte(l.mitteilungen[1], L.get('m2'), zwei), { fotos: { text: 'Bilddoku für 20.08. da', luecke: false }, labor: { text: '2 Prüfberichte in der Liste', luecke: false },
  plan: { text: 'Probenplan in der Liste', luecke: false }, bericht: { text: '2. Mitteilung · Entwurf', luecke: false } });
assert.equal(M.kachelTexte(l.mitteilungen[0], L.get('m1'), zwei).bericht.text, '1. Mitteilung · versandt 15.08.');
// Bilddoku fehlt für den Termin → gelb in Liste und Kachel; ohne FotoKit-Vermerk: Datum im Namen
let L2 = M.anlagenListen(l, { ...e(zwei), fk: { bilddokus: { t1: fk.bilddokus.t1 } }, fotos: [fotos[0]] }, A);
let bd = L2.get('m2').zeilen.find(z => z.art === 'bilddoku');
assert.deepEqual([bd.nr, bd.fehlt, bd.grund], [null, true, 'fehlt für den 20.08.']);
assert.deepEqual(M.kachelTexte(l.mitteilungen[1], L2.get('m2'), zwei).fotos, { text: 'Bilddoku für 20.08. fehlt', luecke: true });
L2 = M.anlagenListen(l, { ...e(zwei), fk: null }, A);
assert.equal(L2.get('m2').zeilen.find(z => z.art === 'bilddoku').herkunftText, 'aus Termin 20.08. (Nachbeprobung) (Datum im Namen)');
// von Hand: dazu / weg werden gespeichert und angewandt; eine Datei in zwei Mitteilungen („auch in der 1. Mitteilung“)
const hand = { ...zwei, weitereMitteilungen: [zwei.weitereMitteilungen[0], { ...zwei.weitereMitteilungen[1], anlagenDazu: ['Laborergebnisse/AR-001.pdf', 'Mitteilungen/Raumluftmessung 20.08.pdf'], anlagenWeg: ['Laborergebnisse/AR-003.pdf'] }] };
L = M.anlagenListen(M.liste(hand, word, [a1]), e(hand), A);
const zh = L.get('m2').zeilen;
assert.deepEqual(zh.map(z => [z.nr, z.dateien[0], z.herkunft]), [[1, 'Laborergebnisse/AR-002.pdf', 'frei'], [2, 'Laborergebnisse/AR-001.pdf', 'hand'], [3, `Fotos/${fotos[1].name}`, 'termin'],
  [4, `Pläne/${plaene[1].name}`, 'frei'], [5, 'Mitteilungen/Raumluftmessung 20.08.pdf', 'hand']]);
assert.deepEqual(zh[1].auch, ['1. Mitteilung']);
assert.equal(zh[4].fehlt, true, 'zugeordnete Datei fehlt im Ordner → gelb, nie still weg'); assert.equal(zh[4].grund, 'Datei liegt nicht mehr im Projektordner');
assert.deepEqual(L.get('m2').weg, ['Laborergebnisse/AR-003.pdf']);
// Vorschlag aus BerichtKit: berichte[].anlagenListe zur Word-Datei der Mitteilung (die Rechnung von BerichtKit), Vergleich (R9)
const bkE = { datei: word[1].name, am: '2026-11-27T10:00:00.000Z', anlagen: ['Laborergebnisse/AR-001.pdf', 'Laborergebnisse/AR-002.pdf', `Fotos/${fotos[1].name}`],
  anlagenListe: [{ nr: 1, art: 'pruefbericht', titel: 'Prüfbericht', dateien: ['Laborergebnisse/AR-001.pdf'] }, { nr: 2, art: 'pruefbericht', titel: 'Prüfbericht', dateien: ['Laborergebnisse/AR-002.pdf'] },
    { nr: 3, art: 'bilddoku', titel: 'Bilddokumentation', dateien: [`Fotos/${fotos[1].name}`] }] };
L = M.anlagenListen(M.liste(zwei, word, [a1]), { ...e(zwei), bk: [{ ...bkE, am: '2026-11-01T00:00:00.000Z', anlagen: [] }, bkE] }, A);
assert.equal(L.get('m2').quelle, 'berichtkit');
assert.deepEqual(M.pfade(L.get('m2').zeilen), bkE.anlagen, 'gleiche Nummern wie BerichtKit');
assert.deepEqual(L.get('m2').zeilen[0].auch, ['1. Mitteilung']);
assert.deepEqual(M.vergleich(['Laborergebnisse/AR-002.pdf', 'Laborergebnisse/AR-003.pdf'], bkE), { fehlen: ['Laborergebnisse/AR-001.pdf', `Fotos/${fotos[1].name}`], mehr: ['Laborergebnisse/AR-003.pdf'] });
assert.equal(M.vergleich(['x'], null), null);
// Bestand (kein Eintrag): Vorschlag nur „noch in keiner Mitteilung“, keine Bilddoku je Termin
L = M.anlagenListen(M.liste(pj, word, [a1]), e(pj), A);
assert.deepEqual(M.pfade(L.get('nr2').zeilen), ['Laborergebnisse/AR-002.pdf', 'Laborergebnisse/AR-003.pdf', `Fotos/${fotos[1].name}`, `Pläne/${plaene[1].name}`]);
// kein Prüfbericht: Platzhalter wie im Bericht (Anlage 1, gelb), Übergabe sendet ihn nicht
L = M.anlagenListen(M.liste(zwei, word, [{ ...a1, anlagen: [...a1.anlagen, 'Laborergebnisse/AR-002.pdf', 'Laborergebnisse/AR-003.pdf'] }]), e(zwei), A);
assert.deepEqual(L.get('m2').zeilen.map(z => [z.nr, z.art, z.fehlt]), [[1, 'pruefbericht', true], [2, 'bilddoku', false], [3, 'probenplan', false]]);
assert.deepEqual(M.kachelTexte(M.liste(zwei, word, [a1]).mitteilungen[1], L.get('m2'), zwei).labor, { text: 'kein Prüfbericht zugeordnet', luecke: true });
console.log('OK mitteilungen: Anlagen-Liste je Mitteilung (Hausreihenfolge aus anlagen.js, feste Liste aus der Büroaufgabe, Bilddoku je Termin, von Hand dazu/weg, auch in der 1., BerichtKit-Vorschlag und Vergleich, Bestand)');

// ---------- Angebot in „Jetzt dran“ ----------
assert.equal(M.angebot(M.liste(pj, [word[0]], []), e(pj)), null, 'nicht übergeben: kein Angebot');
assert.match(M.angebot(M.liste(pj, [word[0]], [a1]), e(pj)).text, /^Neu nach der Übergabe am 14\.08\.: Ortstermin 20\.08\.2026, „Bilddokumentation_26\.0999_Teststadt_2026-08-20\.pdf“, „Probenplan 26\.0999 Teststadt Ka - 2\. Termin\.pdf“ und 2 weitere\.$/);
assert.equal(M.angebot(M.liste({ ortstermin: '2026-08-12' }, [word[0]], [a1]), { ...e({ ortstermin: '2026-08-12' }), fotos: [fotos[0]], plaene: [plaene[0]], labor: [labor[0]] }), null, 'nichts Neues');
assert.equal(M.angebot(M.liste(pj, word, [a1]), e(pj)), null, 'schon zwei Mitteilungen');
console.log('OK mitteilungen: Angebot nur bei einer übergebenen Mitteilung und Neuem danach');

// ---------- Stufen.kacheln mit drittem Argument ----------
const f0 = { pj: true, proben: true, fotos: { bilder: 3, begonnen: true }, plan: true, mitteilung: { datei: word[1].name, datum: '2026-11-27' } };
const k0 = S.kacheln(f0), k1 = S.kacheln(f0, null, { fotos: { text: 'Bilddoku für 20.08. fehlt', luecke: true }, proben: { text: 'X' }, abrechnung: { text: 'Y' } });
assert.deepEqual(k1.map(k => [k.key, k.fertig, k.zustand]), k0.map(k => [k.key, k.fertig, k.zustand]), '✓ und Zustand bleiben');
assert.equal(k1[1].text, 'Bilddoku für 20.08. fehlt'); assert.equal(k1[1].luecke, true);
assert.equal(k1[0].text, 'X', 'ab 1.55.0 (P7): Proben je Mitteilung, wenn kachelTexte es liefert (nur mit Laboraufträgen)'); assert.equal(k1[5].text, k0[5].text, 'Abrechnung bleibt je Projekt');
assert.equal(S.kacheln(f0, null, { fotos: { text: 'Bilddoku für 20.08. fehlt', luecke: true } })[0].text, k0[0].text, 'ohne je.proben bleibt Proben je Projekt');
console.log('OK mitteilungen: Kacheltext je Mitteilung ändert nur Text und gelbe Lücke');

// ---------- 1.55.0: Laboraufträge je Mitteilung (claude/projektzentrale-auftraege-plan.md F3, 4.1–4.5, P1–P9) ----------
// Vorlagen: LabelKit-Datei von LabelKit 5.5.0 im Browser geschrieben (Runde 1 P1–P13 → Auftrag 1 am 14.08., Runde 2 P14–P21 → Auftrag 2
// am 22.08.), „_Ergebnisse.json“ mit den echten ResultKit-2.7.0-Modulen erzeugt (Prüfberichte erfunden: AR-26-0001-01 P1–P13,
// AR-26-0002-01 P14–P21; B: AR-26-0002-01 mit P1–P21; E: ein Auftrag). Der Stand der Übernahme (veraltet) kommt aus der Projektzentrale.
{
  const fs = require('node:fs');
  const LA = require('../laborauftraege.js');
  const fix = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8'));
  const LK2 = LA.lesen(fix('labelkit-5.5.0-zwei-auftraege.json')), LK1 = LA.lesen(fix('labelkit-5.5.0-ein-auftrag.json'));
  const erg = (n, x = {}) => ({ ...M.ergebnisAuszug(fix(`ergebnisse-2.7.0-${n}.json`)), veraltet: false, ...x });
  const A1 = 'AR-26-0001-01.pdf', A2 = 'AR-26-0002-01.pdf';
  const lab = (...n) => n.map((name, i) => ({ name, t: ms(`2026-08-2${i + 3}T10:00:00`) }));
  const w19 = [{ name: `1._Mitteilung_${NR}.docx`, rel: `Mitteilungen/1._Mitteilung_${NR}.docx`, t: ms('2026-08-19T08:00:00') }, word[1]];
  const ueb19 = (anlagen = [`Laborergebnisse/${A1}`]) => ({ ...a1, word: w19[0].rel, erstellt: '2026-08-19T09:00:00.000Z', erledigt: false, erledigtAm: '', anlagen });
  const mit = (a, b) => ({ ...pj, weitereMitteilungen: [{ id: 'm1', nr: 1, termine: ['t1'], auftraege: a }, { id: 'm2', nr: 2, termine: ['t2'], auftraege: b }], mitteilungZaehler: 2 });
  const E2 = (d, labor, lage, x = {}) => ({ pj: d, fotos, plaene, labor, vorhanden: new Set([...vorhanden, ...labor.map(f => ('laborergebnisse/' + f.name).toLowerCase())]), fk, bk: [], ordnerName: ORDNER, projektNr: NR, lage, ...x });
  const pb = (L, k) => L.get(k).zeilen.filter(z => z.art === 'pruefbericht').map(z => [z.dateien[0] ? z.dateien[0].split('/').pop() : '–', z.herkunftText, z.hinweis || '', z.auch.join(','), z.warnung || '']);

  // Lesart: ein Auftrag (keine Kennung irgendwo) → keine Lage, alles wie heute; ergebnisAuszug liest die Kennung je Label
  assert.equal(LK1.mehrere, false); assert.equal(M.auftragsLage(LK1, erg('E')), null, 'ein Auftrag: keine Lage');
  assert.deepEqual(erg('E').kennung, {}, 'ein Auftrag: keine Kennung in _Ergebnisse.json');
  assert.equal(erg('A').kennung.P13, 'a1'); assert.equal(erg('A').kennung.P21, 'a2');
  assert.deepEqual(erg('A').berichte.map(b => [b.pdf, b.labels.length]), [[A1, 13], [A2, 8]]);
  let lage = M.auftragsLage(LK2, erg('A'));
  assert.deepEqual([lage.ok, lage.auftraege.map(a => [a.id, a.am, a.proben.length]), lage.neu], [true, [['a1', '2026-08-14', 13], ['a2', '2026-08-22', 8]], []]);
  assert.deepEqual(lage.pdf(A2), { auftraege: ['a2'] }); assert.deepEqual(lage.pdf('ar-26-0001-01.PDF'), { auftraege: ['a1'] }, 'Name genau, klein');
  assert.equal(M.auftragText(lage.auftraege[1]), 'Auftrag 2 · 22.08. · 8 Proben (P14–P21) · Probenahme 20.08.');

  // A · zwei offene Mitteilungen, m1 = [a1], m2 = [a2] → jede nur ihren Prüfbericht (heute: beide je beide)
  let d = mit(['a1'], ['a2']), l = M.liste(d, w19, []);
  let L = M.anlagenListen(l, E2(d, lab(A1, A2), lage), A);
  assert.deepEqual(pb(L, 'm1'), [[A1, 'aus Auftrag 1', '', '', '']]);
  assert.deepEqual(pb(L, 'm2'), [[A2, 'aus Auftrag 2', '', '', '']]);
  assert.deepEqual(pb(M.anlagenListen(l, E2(d, lab(A1, A2), null), A), 'm1').map(z => z[0]), [A1, A2], 'ohne Lage wie 1.54.0: beide');
  // B · ein Bericht mit Proben beider Aufträge → in beiden („auch in der …“); 1. übergeben → nur in der 2. mit Satz
  lage = M.auftragsLage(LK2, erg('B'));
  L = M.anlagenListen(l, E2(d, lab(A2), lage), A);
  assert.deepEqual(pb(L, 'm1'), [[A2, 'aus Auftrag 1', '', '2. Mitteilung', '']]); assert.deepEqual(pb(L, 'm2'), [[A2, 'aus Auftrag 2', '', '1. Mitteilung', '']]);
  l = M.liste(d, w19, [ueb19([])]);
  L = M.anlagenListen(l, E2(d, lab(A2), lage), A);
  assert.deepEqual(pb(L, 'm2'), [[A2, 'aus Auftrag 2', 'enthält auch Proben aus Auftrag 1 (1. Mitteilung schon übergeben)', '', '']]);
  // B, 1. schon MIT dem gemeinsamen Bericht übergeben (Codex-Review #95): die 2. bekommt ihn trotzdem (enthält Proben von Auftrag 2)
  l = M.liste(d, w19, [ueb19([`Laborergebnisse/${A2}`])]);
  L = M.anlagenListen(l, E2(d, lab(A2), lage), A);
  assert.deepEqual(pb(L, 'm2'), [[A2, 'aus Auftrag 2', 'enthält auch Proben aus Auftrag 1 (1. Mitteilung schon übergeben)', '1. Mitteilung', '']]);
  assert.deepEqual(M.pfade(L.get('m1').zeilen), [`Laborergebnisse/${A2}`], 'feste Liste der 1. unverändert');
  // … aber ein Bericht nur mit Proben von Auftrag 1 in der festen Liste der 1. bleibt dort
  const lA = M.auftragsLage(LK2, erg('A'));
  L = M.anlagenListen(M.liste(d, w19, [ueb19([`Laborergebnisse/${A1}`])]), E2(d, lab(A1, A2), lA), A);
  assert.deepEqual(pb(L, 'm2').map(z => z[0]), [A2]);
  // anderer Auftrag keiner Mitteilung zugeordnet
  L = M.anlagenListen(M.liste(mit([], ['a2']), w19, []), E2(mit([], ['a2']), lab(A2), lage), A);
  assert.deepEqual(pb(L, 'm2'), [[A2, 'aus Auftrag 2', 'enthält auch Proben aus Auftrag 1 (keiner Mitteilung zugeordnet)', '', '']]);
  // C/D · Übernahme veraltet (auch: Konflikt, ResultKit schrieb keine neue Datei) → wie heute, mit Grund – nie raten
  for (const [x, grund] of [[{ veraltet: true }, M.GRUND.veraltet], [{ veraltet: undefined }, M.GRUND.unklar], [{ fehler: true }, M.GRUND.fehler]]){
    const lg = M.auftragsLage(LK2, erg('A', x)), Lx = M.anlagenListen(M.liste(d, w19, []), E2(d, lab(A1, A2), lg), A);
    assert.equal(lg.ok, false);
    assert.deepEqual(pb(Lx, 'm1'), [[A1, 'noch in keiner Mitteilung', 'Auftrag unbekannt: ' + grund, '2. Mitteilung', ''], [A2, 'noch in keiner Mitteilung', 'Auftrag unbekannt: ' + grund, '2. Mitteilung', '']]);
  }
  assert.equal(M.auftragsLage(LK2, null).pdf(A1).grund, M.GRUND.keine, 'noch nicht übernommen');
  // Kennungen passen nicht zu LabelKit (Übernahme von ResultKit 2.6.1 ohne Kennung, oder geänderte Regel) → unbekannt
  const ohneKennung = fix('ergebnisse-2.7.0-A.json'); for (const x of ohneKennung.auftrag.proben) delete x.auftrag;
  assert.equal(M.auftragsLage(LK2, { ...M.ergebnisAuszug(ohneKennung), veraltet: false }).grundArt, 'kennung');
  const andere = fix('ergebnisse-2.7.0-A.json'); andere.auftrag.proben[13].auftrag = 'a1';
  assert.equal(M.auftragsLage(LK2, { ...M.ergebnisAuszug(andere), veraltet: false }).grundArt, 'kennung');
  // F · ersetzt (in dateien[], nicht in berichte[]) · G · Kopie „ (2)“ · H · PDF ohne XML · mehrdeutig · Probe ohne Kennung · nicht übernommen
  const e2 = { ...erg('A'), dateien: [A1, 'AR-26-0001-02.pdf', 'AR-26-0001-02.xml', A2, 'AR-26-0002-01 (2).pdf'] };
  e2.berichte = [{ ...e2.berichte[0], pdf: 'AR-26-0001-02.pdf' }, e2.berichte[1]];
  lage = M.auftragsLage(LK2, e2);
  assert.equal(lage.pdf(A1).grund, M.GRUND.ersetzt);
  assert.equal(lage.pdf('AR-26-0002-01 (2).pdf').grund, `nicht in der Übernahme – vielleicht eine Kopie von „${A2}“`);
  assert.deepEqual(lage.pdf('AR-26-0001-02.pdf'), { auftraege: ['a1'] }, 'PDF des geltenden Berichts (auch ohne XML) ist zuordenbar');
  assert.equal(lage.pdf('AR-99.pdf').grund, M.GRUND.nicht);
  assert.equal(M.auftragsLage(LK2, { ...e2, berichte: [...e2.berichte, { bericht: 'AR-X', pdf: A2, labels: ['P14'] }] }).pdf(A2).grund, M.GRUND.mehrdeutig);
  assert.match(M.auftragsLage(LK2, { ...e2, berichte: [{ bericht: 'AR-Y', pdf: A2, labels: ['P14', 'P22'] }] }).pdf(A2).grund, /^enthält Proben ohne Laborauftrag in LabelKit \(P22\)$/);
  // Labor-Probe ohne Probennummer im Bericht → unbekannt, nie nur nach den übrigen Proben zuordnen (Review 1.55.0)
  const mitLeer = fix('ergebnisse-2.7.0-A.json'); mitLeer.berichte[1].proben.push({ ref: 'Probe X', desc: '', werte: [{ p: 'x', r: '1', u: 'µg/m²' }] });
  assert.equal(M.auftragsLage(LK2, { ...M.ergebnisAuszug(mitLeer), veraltet: false }).pdf(A2).grund, 'enthält eine Probe ohne Probennummer');
  // Bohrkern-Rückstellprobe in LabelKit mit Kennung (fehlt in ResultKit) → Übernahme passt trotzdem (Review 1.55.0)
  const mitR = fix('labelkit-5.5.0-zwei-auftraege.json'); mitR.sonstigeProben = [{ id: 22, _nr: 22, matrix: 'Bohrkern', bkStatus: 'R', nrFest: { am: '2026-08-22T10:00:00.000Z' }, auftrag: 'a2' }]; mitR.weitereAuftraege[0].proben.push(22);
  const lgR = M.auftragsLage(LA.lesen(mitR), erg('A'));
  assert.equal(lgR.ok, true); assert.equal(lgR.auftraege[1].proben.length, 8);
  // LabelKit-Datei gerade nicht lesbar (vorher zwei Aufträge bekannt) → unbekannt mit Grund
  assert.equal(M.auftragsLage(LK2, { lkFehler: true }).pdf(A1).grund, M.GRUND.labelkit);
  L = M.anlagenListen(M.liste(d, w19, []), E2(d, lab(A1, 'AR-26-0002-01 (2).pdf', 'AR-26-0001-02.pdf'), lage), A);
  assert.deepEqual(pb(L, 'm1'), [[A1, 'noch in keiner Mitteilung', 'Auftrag unbekannt: ' + M.GRUND.ersetzt, '2. Mitteilung', ''], ['AR-26-0001-02.pdf', 'aus Auftrag 1', '', '', ''],
    ['AR-26-0002-01 (2).pdf', 'noch in keiner Mitteilung', `Auftrag unbekannt: nicht in der Übernahme – vielleicht eine Kopie von „${A2}“`, '2. Mitteilung', '']], 'Kopie nie dem Zwilling zugeordnet');
  // Auftrag des Berichts in keiner Mitteilung → „noch in keiner Mitteilung · Auftrag 2 keiner Mitteilung zugeordnet“ (in beiden); Lesart „leer“
  lage = M.auftragsLage(LK2, erg('A'));
  d = mit(['a1'], []); L = M.anlagenListen(M.liste(d, w19, []), E2(d, lab(A1, A2), lage), A);
  assert.deepEqual(pb(L, 'm2'), [[A2, 'noch in keiner Mitteilung · Auftrag 2 keiner Mitteilung zugeordnet', '', '1. Mitteilung', '']]);
  assert.deepEqual(pb(L, 'm1'), [[A1, 'aus Auftrag 1', '', '', ''], [A2, 'noch in keiner Mitteilung · Auftrag 2 keiner Mitteilung zugeordnet', '', '2. Mitteilung', '']]);
  console.log('OK mitteilungen 1.55: Prüfberichte je Mitteilung nach Auftrag (A, B, übergeben, veraltet, Kennungen, ersetzt, Kopie, ohne XML, mehrdeutig, ohne Kennung, keiner Mitteilung)');

  // Übergebene Mitteilung → Aufträge aus ihren festen Prüfberichten gerechnet (nicht gespeichert); feste Liste bleibt
  d = mit([], []); l = M.liste(d, w19, [ueb19()]);
  let v = M.auftraegeVon(l.mitteilungen[0], lage);
  assert.deepEqual([[...v.ids], v.gespeichert, v.gerechnet], [['a1'], [], ['a1']]);
  L = M.anlagenListen(l, E2(d, lab(A1, A2), lage), A);
  assert.deepEqual(M.pfade(L.get('m1').zeilen), [`Laborergebnisse/${A1}`], 'feste Liste unverändert');
  assert.deepEqual(pb(L, 'm2'), [[A2, 'noch in keiner Mitteilung · Auftrag 2 keiner Mitteilung zugeordnet', '', '', '']]);
  assert.deepEqual(M.auftraegeVon(l.mitteilungen[0], M.auftragsLage(LK2, erg('A', { veraltet: true }))).festUnbekannt.map(x => x.grund), [M.GRUND.veraltet]);
  { const lv = M.auftragsLage(LK2, erg('A', { veraltet: true }));
    assert.deepEqual(M.kachelTexte(l.mitteilungen[0], M.anlagenListen(l, E2(d, lab(A1, A2), lv), A).get('m1'), d, lv).proben, { text: 'Auftrag unbekannt (aus der Übergabe): ' + M.GRUND.veraltet, luecke: true }, 'übergeben + veraltet: nicht „kein Laborauftrag zugeordnet“'); }
  assert.equal(M.auftraegeVon(l.mitteilungen[0], null), null);
  // unbekannte Kennung bleibt im Eintrag und wird genannt
  v = M.auftraegeVon(M.liste(mit(['a1', 'a7'], []), w19, []).mitteilungen[0], lage);
  assert.deepEqual(v.unbekannt, ['a7']); assert.ok(v.ids.has('a7'));

  // frei (P3): neuer Termin und Auftrag in keiner Mitteilung; Bestand (Einträge mit []) – nur bei Kennungen in LabelKit
  const mitT3 = (a, b) => ({ ...mit(a, b), weitereOrtstermine: [...pj.weitereOrtstermine, { id: 't3', datum: '2026-09-05', bezeichnung: '' }], ortsterminZaehler: 3 });
  let f = M.frei(M.liste(mitT3([], []), w19, []), lage, mitT3([], []));
  assert.equal(M.freiText(f), 'Termin 3 (05.09.) · Auftrag 1 (14.08.) · Auftrag 2 (22.08.)');
  f = M.frei(M.liste(mitT3(['a1'], ['a2']), w19, []), lage, mitT3(['a1'], ['a2']));
  assert.equal(M.freiText(f), 'Termin 3 (05.09.)');
  assert.equal(M.freiText(M.frei(M.liste(mit([], []), w19, []), null, mit([], []))), '', 'ein Auftrag: „leer“ heißt nichts');
  assert.equal(M.frei(M.liste({ ...pj }, [w19[0]], []), lage, pj), null, 'eine Mitteilung: keine Zeile');
  assert.equal(M.freiText(M.frei(M.liste(mit([], []), w19, [ueb19()]), lage, mit([], []))), 'Auftrag 2 (22.08.)', 'Auftrag der übergebenen 1. ist gerechnet');
  console.log('OK mitteilungen 1.55: übergebene Mitteilung → gerechnete Aufträge; unbekannte Kennung bleibt; frei (neuer Termin, neuer Auftrag, Bestand)');

  // Vorwahl nach dem Datum des AUFTRAGS (P2) in drei Lagen – nie nach dem Probenahmedatum
  // wie die Rückfrage: ohne erkennbare Mitteilung eine Spalte „nr1“ (in Arbeit), dazu die neue
  const spalten = (lx, neu = true) => [...(lx.mitteilungen.length ? lx.mitteilungen.map(m => ({ schluessel: m.schluessel, eintrag: m.eintrag, m, nr: m.nr, gesperrt: m.fest && !!m.eintrag })) : [{ schluessel: 'nr1', eintrag: null, m: null, nr: 1 }]),
    ...(neu ? [{ schluessel: 'neu', nr: Math.max(1, lx.mitteilungen.length) + 1 }] : [])];
  const vw = (dx, wx, auf, neu = true) => { const lx = M.liste(dx, wx, auf), sp2 = spalten(lx, neu); return M.vorwahlAuftraege(lage, sp2, { pj: dx, termine: M.vorwahlTermine(dx, sp2) }); };
  // 1. übergeben am 19.08. (feste Liste mit AR-0001): Auftrag 1 gerechnet und gesperrt, Auftrag 2 nach der Übergabe → 2.
  let r = vw(pj, [w19[0]], [ueb19()]);
  assert.deepEqual(r.vor, { nr1: ['a1'], neu: ['a2'] }); assert.deepEqual(r.saetze, ['Auftrag 2 vom 22.08. liegt nach der Übergabe am 19.08. → 2. Mitteilung']);
  // 1. Entwurf (Word-Datei 19.08.)
  r = vw(pj, [w19[0]], []);
  assert.deepEqual(r.vor, { nr1: ['a1'], neu: ['a2'] });
  assert.deepEqual(r.saetze, ['Auftrag 1 vom 14.08. liegt nicht nach dem letzten Speichern der Word-Datei am 19.08. → 1. Mitteilung', 'Auftrag 2 vom 22.08. liegt nach dem letzten Speichern der Word-Datei am 19.08. → 2. Mitteilung']);
  // 1. ohne Word-Datei: spätester Termin am oder vor dem Auftragsdatum
  r = vw(pj, [], []);
  assert.deepEqual(r.vor, { nr1: ['a1'], neu: ['a2'] }); assert.deepEqual(r.saetze, ['Auftrag 1 vom 14.08. letzter Termin davor 12.08. → 1. Mitteilung', 'Auftrag 2 vom 22.08. letzter Termin davor 20.08. → 2. Mitteilung']);
  // nie nach dem Probenahmedatum: Rückstellprobe mit Datum von Termin 1 im Auftrag 2 → trotzdem 2.
  const rueck = fix('labelkit-5.5.0-zwei-auftraege.json'); for (const p of rueck.asbestProben) p.datum = '2026-08-12';
  const lageR = M.auftragsLage(LA.lesen(rueck), erg('A'));
  assert.deepEqual(lageR.auftraege[1].probenahme, ['2026-08-12', '2026-08-20']);
  assert.deepEqual(M.vorwahlAuftraege(lageR, spalten(M.liste(pj, [w19[0]], [])), { pj, termine: {} }).vor.neu, ['a2']);
  // bestehende Einträge behalten ihre Aufträge; freie nach dem Datum (Bestand von 1.54.0 mit [])
  r = vw(mit(['a2'], []), w19, [], false);
  assert.deepEqual(r.vor, { m1: ['a2', 'a1'], m2: [] }, 'm1 behält a2, a1 frei → 1. (vor dem Speichern am 19.08.)');
  r = vw(mit([], []), w19, [], false);
  assert.deepEqual(r.vor, { m1: ['a1'], m2: ['a2'] });
  // übergeben ohne gerechneten Auftrag (feste Liste ohne Prüfbericht): Auftrag 1 nach dem Datum zur 1. – gesperrt, nicht vorgewählt, Satz
  r = vw(pj, [w19[0]], [ueb19([])]);
  assert.deepEqual(r.vor, { nr1: [], neu: ['a2'] }); assert.match(r.saetze[0], /^Auftrag 1 vom 14\.08\. liegt nicht nach der Übergabe am 19\.08\. – nach dem Datum die 1\. Mitteilung, die schon übergeben ist: nicht vorgewählt, bitte prüfen\.$/);
  // Auftrag ohne Datum: nicht vorgewählt
  const ohneAm = { ...lage, auftraege: [{ ...lage.auftraege[1], am: '' }] };
  assert.deepEqual(M.vorwahlAuftraege(ohneAm, spalten(M.liste(pj, [w19[0]], [])), { pj }).saetze, ['Auftrag 2 hat kein Datum – bitte selbst zuordnen.']);
  assert.deepEqual(M.vorwahlAuftraege(null, [], {}), { vor: {}, saetze: [] });
  console.log('OK mitteilungen 1.55: Vorwahl nach Auftragsdatum (übergeben, Entwurf, ohne Word-Datei), nie nach Probenahmedatum, bestehende behalten, gesperrt, ohne Datum');

  // P9: „aus BerichtKit“ – Prüfbericht gehört laut Auftrag zur anderen Mitteilung → gelb, bleibt stehen
  d = mit(['a1'], ['a2']);
  const bk1 = { datei: w19[0].name, am: '2026-08-25T10:00:00.000Z', anlagen: [`Laborergebnisse/${A1}`, `Laborergebnisse/${A2}`] };
  for (const bkx of [bk1, { ...bk1, anlagenListe: [{ nr: 1, art: 'pruefbericht', dateien: [`Laborergebnisse/${A1}`] }, { nr: 2, art: 'pruefbericht', dateien: [`Laborergebnisse/${A2}`] }] }]){
    L = M.anlagenListen(M.liste(d, w19, []), E2(d, lab(A1, A2), lage, { bk: [bkx] }), A);
    assert.equal(L.get('m1').quelle, 'berichtkit');
    assert.deepEqual(pb(L, 'm1'), [[A1, 'aus BerichtKit', '', '', ''], [A2, 'aus BerichtKit', '', '2. Mitteilung', 'laut Laborauftrag 2 zur 2. Mitteilung – in BerichtKit abwählen oder hier entfernen']]);
    assert.deepEqual(M.pfade(L.get('m1').zeilen), bk1.anlagen, 'nie still entfernt');
  }
  // keine Markierung: Auftrag keiner Mitteilung zugeordnet, ohne Lage
  for (const [lx, dx] of [[lage, mit(['a1'], [])], [null, d]]){
    L = M.anlagenListen(M.liste(dx, w19, []), E2(dx, lab(A1, A2), lx, { bk: [bk1] }), A);
    assert.ok(L.get('m1').zeilen.every(z => !z.warnung && !z.hinweis));
  }
  // Auftrag unbekannt (Übernahme veraltet): Satz an der BerichtKit-Zeile; steht sie in der festen Liste einer anderen Mitteilung → gelb (Review 1.55.0)
  const lgV = M.auftragsLage(LK2, erg('A', { veraltet: true }));
  L = M.anlagenListen(M.liste(d, w19, []), E2(d, lab(A1, A2), lgV, { bk: [bk1] }), A);
  assert.deepEqual(pb(L, 'm1').map(z => [z[2], z[4]]), [['Auftrag unbekannt: ' + M.GRUND.veraltet, ''], ['Auftrag unbekannt: ' + M.GRUND.veraltet, '']]);
  const bk2 = { datei: word[1].name, am: '2026-08-25T10:00:00.000Z', anlagen: [`Laborergebnisse/${A1}`, `Laborergebnisse/${A2}`] };
  L = M.anlagenListen(M.liste(d, w19, [ueb19()]), E2(d, lab(A1, A2), lgV, { bk: [bk2] }), A);
  assert.match(pb(L, 'm2')[0][4], /^schon mit der 1\. Mitteilung übergeben – prüfen, ob er hierher gehört; sonst in BerichtKit abwählen oder hier entfernen$/);
  assert.equal(pb(L, 'm2')[1][4], '');
  L = M.anlagenListen(M.liste(mit(['a1'], ['a2']), w19, []), E2(mit(['a1'], ['a2']), lab(A2), M.auftragsLage(LK2, erg('B')), { bk: [{ ...bk1, anlagen: [`Laborergebnisse/${A2}`] }] }), A);
  assert.ok(!L.get('m1').zeilen[0].warnung, 'Bericht mit Proben auch aus Auftrag 1: gehört auch zur 1.');
  // von Hand entfernt → Zeile weg (anlagenWeg wie bisher)
  const dW = mit(['a1'], ['a2']); dW.weitereMitteilungen[0].anlagenWeg = [`Laborergebnisse/${A2}`];
  assert.deepEqual(pb(M.anlagenListen(M.liste(dW, w19, []), E2(dW, lab(A1, A2), lage, { bk: [bk1] }), A), 'm1').map(z => z[0]), [A1]);
  console.log('OK mitteilungen 1.55: P9 – BerichtKit-Zeile gelb, wenn der Prüfbericht laut Auftrag zur anderen Mitteilung gehört (nie still entfernt)');

  // Kacheltexte je Mitteilung (P7)
  lage = M.auftragsLage(LK2, erg('nur1'));
  d = mit(['a1'], ['a2']); l = M.liste(d, w19, []); L = M.anlagenListen(l, E2(d, lab(A1), lage), A);
  let k = M.kachelTexte(l.mitteilungen[1], L.get('m2'), d, lage);
  assert.deepEqual(k.proben, { text: '8 Proben · Auftrag 2 vom 22.08.', luecke: false });
  assert.deepEqual(k.labor, { text: 'Auftrag 2: 0 von 8 mit Ergebnis · 8 offen · kein Prüfbericht zugeordnet', luecke: true });
  k = M.kachelTexte(l.mitteilungen[0], L.get('m1'), d, lage);
  assert.deepEqual([k.proben.text, k.labor.text], ['13 Proben · Auftrag 1 vom 14.08.', 'Auftrag 1: 13 von 13 mit Ergebnis · 1 Prüfbericht in der Liste']);
  const dz = mit(['a1', 'a2'], []); l = M.liste(dz, w19, []);
  assert.equal(M.kachelTexte(l.mitteilungen[0], M.anlagenListen(l, E2(dz, lab(A1), lage), A).get('m1'), dz, lage).proben.text, '21 Proben · Aufträge 1, 2');
  assert.deepEqual(M.kachelTexte(l.mitteilungen[1], M.anlagenListen(l, E2(dz, lab(A1), lage), A).get('m2'), dz, lage).proben, { text: 'kein Laborauftrag zugeordnet', luecke: true });
  // neue Proben noch nicht beim Labor (nur nicht übergeben); veraltet → Satz
  const neuP = fix('labelkit-5.5.0-zwei-auftraege.json'); neuP.proben.push({ ...neuP.proben[0], id: 99, _nr: 22, nrFest: undefined, auftrag: undefined }, { ...neuP.proben[0], id: 98, _nr: 23, nrFest: undefined, auftrag: undefined });
  const lageN = M.auftragsLage(LA.lesen(neuP), erg('A', { veraltet: true }));
  l = M.liste(d, w19, []);
  k = M.kachelTexte(l.mitteilungen[1], M.anlagenListen(l, E2(d, lab(A1, A2), lageN), A).get('m2'), d, lageN);
  assert.deepEqual(k.proben, { text: '8 Proben · Auftrag 2 vom 22.08. · 2 neue Proben noch nicht beim Labor', luecke: false });
  assert.deepEqual(k.labor, { text: 'Auftrag 2: seit der Übernahme geändert – in ResultKit übernehmen', luecke: true });
  l = M.liste(d, w19, [ueb19()]);
  assert.equal(M.kachelTexte(l.mitteilungen[0], M.anlagenListen(l, E2(d, lab(A1, A2), lageN), A).get('m1'), d, lageN).proben.text, '13 Proben · Auftrag 1 vom 14.08.', 'übergeben: ohne „neue Proben“');
  assert.equal(M.kachelTexte(l.mitteilungen[1], M.anlagenListen(l, E2(d, lab(A1, A2), M.auftragsLage(LK2, null)), A).get('m2'), d, M.auftragsLage(LK2, null)).labor.text, '1 Prüfbericht in der Liste', 'nicht übernommen: Labor-Text wie bisher');
  assert.deepEqual(M.kachelTexte(M.liste(mit(['a7'], []), w19, []).mitteilungen[0], { zeilen: [] }, d, lage).proben, { text: 'Auftrag 7 gibt es in LabelKit nicht mehr', luecke: true });
  assert.equal('proben' in M.kachelTexte(l.mitteilungen[1], M.anlagenListen(l, E2(d, lab(A1, A2), null), A).get('m2'), d), false, 'ohne Lage kein Proben-Text');
  // Angebot „2. Mitteilung beginnen …“: Auftrag nach der Grenze zählt als neu
  const eins = { ortstermin: '2026-08-12' }, le = M.liste(eins, [w19[0]], [ueb19()]);
  assert.match(M.angebot(le, { pj: eins, fotos: [], plaene: [], labor: [], lage: M.auftragsLage(LK2, erg('A')) }).text, /^Neu nach der Übergabe am 19\.08\.: Laborauftrag 2 vom 22\.08\.2026\.$/);
  assert.equal(M.angebot(le, { pj: eins, fotos: [], plaene: [], labor: [] }), null, 'ohne Lage wie bisher');
  console.log('OK mitteilungen 1.55: Kacheltexte Proben und Labor je Auftrag der Mitteilung, neue Proben, veraltet, Angebot mit neuem Auftrag');

  // Ohne die neuen Eingaben byte-gleich wie 1.54.0 (gespeichertes Ergebnis von a3e766d)
  const vorher = fs.readFileSync(path.join(__dirname, 'fixtures', 'mitteilungen-1.54.0.json'), 'utf8');
  assert.equal(JSON.stringify(require('./fixtures/mitteilungen-faelle.cjs')(M, A)) + '\n', vorher, 'ohne lage und viertes Argument wie 1.54.0');
  // ein Auftrag (E): Lage null → genau dasselbe wie ohne Lage
  d = mit([], []); l = M.liste(d, w19, []);
  assert.equal(JSON.stringify([...M.anlagenListen(l, E2(d, lab(A1), M.auftragsLage(LK1, erg('E'))), A)]), JSON.stringify([...M.anlagenListen(l, E2(d, lab(A1), undefined), A)]));
  console.log('OK mitteilungen 1.55: ohne Lage und ohne viertes Argument byte-gleich mit 1.54.0; ein Auftrag wie ohne Lage');
}
void path;
