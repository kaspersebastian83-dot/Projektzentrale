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
assert.equal(k1[0].text, k0[0].text, 'Proben bleiben je Projekt'); assert.equal(k1[5].text, k0[5].text, 'Abrechnung bleibt je Projekt');
console.log('OK mitteilungen: Kacheltext je Mitteilung ändert nur Text und gelbe Lücke');
void path;
