// 1.53: weitere Ortstermine (ortstermine.js) – Liste, Kennungen nie neu vergeben, Zusammenfassung im Kopf, FotoKit-Bezüge. Ohne Browser.
const assert = require('node:assert/strict');
const O = require('../ortstermine.js');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('OK Ortstermine: ' + name); };

const zwei = { ortstermin: '2026-08-12', weitereOrtstermine: [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung', wer: 'Ka, Ste' }] };

ok('ein Termin: keine Liste, nächste Kennung t2, Kopf wie bisher', () => {
  assert.deepEqual(O.liste({ ortstermin: '2026-08-12' }), []);
  assert.equal(O.mehrere({ ortstermin: '2026-08-12' }), false);
  assert.equal(O.naechsteKennung({ ortstermin: '2026-08-12' }), 't2');
  assert.equal(O.zusammenfassung({ ortstermin: '2026-08-12' }), 'Ortstermin 12.08.2026');
  assert.equal(O.zusammenfassung({}), '');
  assert.equal(O.zusammenfassung({ ortstermin: '2026-13-01' }), '', 'unmögliches Datum');
});
ok('zwei Termine: Liste, Kopf „Ortstermine 12.08. · 20.08.2026“', () => {
  assert.equal(O.mehrere(zwei), true);
  assert.equal(O.liste(zwei).length, 1);
  assert.equal(O.zusammenfassung(zwei), 'Ortstermine 12.08. · 20.08.2026');
  // nach Datum sortiert, leere Daten weg, Jahr wechselt → volles Datum
  assert.equal(O.zusammenfassung({ ortstermin: '2026-12-30', weitereOrtstermine: [{ id: 't2', datum: '2027-01-05' }, { id: 't3', datum: '' }, { id: 't4', datum: '2026-12-31' }] }),
    'Ortstermine 30.12.2026 · 31.12.2026 · 05.01.2027');
  assert.equal(O.zusammenfassung({ ortstermin: '', weitereOrtstermine: [{ id: 't2', datum: '2026-08-20' }] }), 'Ortstermine 20.08.2026', 'Termin 1 ohne Datum');
});
ok('Kennungen: höchste + 1, nie neu vergeben – auch nicht nach dem Entfernen, solange FotoKit oder eine Mitteilung sie nennt', () => {
  assert.equal(O.naechsteKennung(zwei), 't3');
  assert.equal(O.naechsteKennung({ weitereOrtstermine: [{ id: 't2' }, { id: 't5' }] }), 't6', 'Lücke wird nicht gefüllt');
  // t3 entfernt, FotoKit hat noch eine Bilddoku / einen Ordner unter t3 → nicht t3
  assert.equal(O.naechsteKennung(zwei, { bilddokus: { t1: {}, t3: { dateien: ['x.pdf'] } } }), 't4');
  assert.equal(O.naechsteKennung(zwei, { ordnerTermine: { 'fotos ka 20.08': { termin: 't7' } } }), 't8');
  assert.equal(O.naechsteKennung(zwei, { dokuGeaendertJe: { t4: 'x' } }), 't5');
  assert.equal(O.naechsteKennung(zwei, { bilder: { 'IMG_0001.jpg': { termin: 't6' } } }), 't7', 'schon übernommene Fotos (O8)');
  assert.equal(O.naechsteKennung({ ...zwei, weitereMitteilungen: [{ id: 'm2', termine: ['t1', 't9'] }] }), 't10', 'Mitteilungen-Ebene (M3)');
  assert.equal(O.naechsteKennung(zwei, null, ['t3']), 't4', 'zusätzlich ausgeschlossene Kennung');
  assert.equal(O.naechsteKennung({ weitereOrtstermine: [{ id: 'x' }, null, 'kaputt'] }, { bilddokus: { alle: {} } }), 't2', 'fremde Werte zählen nicht');
});
ok('Zähler ortsterminZaehler: nächste = Zähler + 1, auch wenn nichts die Kennung mehr nennt; FotoKit dann egal; sinkt nie', () => {
  // t3 entfernt, nichts nennt t3 mehr – mit Zähler 3 trotzdem t4
  assert.equal(O.naechsteKennung({ ...zwei, ortsterminZaehler: 3 }), 't4');
  // alle weiteren Termine entfernt, Zähler bleibt 5 → t6 (nicht t2)
  assert.equal(O.naechsteKennung({ ortstermin: '2026-08-12', ortsterminZaehler: 5 }), 't6');
  // mit Zähler wird FotoKit nicht gebraucht (und nicht gezählt)
  assert.equal(O.naechsteKennung({ ...zwei, ortsterminZaehler: 2 }, { bilddokus: { t9: {} } }), 't3');
  // Sicherheit: eine Kennung in der Liste über dem Zähler (fremder Schreiber ohne Zähler) wird nicht noch einmal vergeben
  assert.equal(O.naechsteKennung({ ortsterminZaehler: 2, weitereOrtstermine: [{ id: 't2' }, { id: 't4' }] }), 't5');
  assert.equal(O.naechsteKennung({ ortsterminZaehler: 4 }, null, ['t4']), 't5', 'schon belegt beim Speichern');
  // ungültiger Zähler zählt nicht (Bestand-Regel greift)
  for (const z of [0, -1, 2.5, '7', null]) assert.equal(O.zaehler({ ortsterminZaehler: z }), null, String(z));
  assert.equal(O.naechsteKennung({ ...zwei, ortsterminZaehler: '9' }), 't3');
  // zaehlerNach: nie kleiner
  assert.equal(O.zaehlerNach({ ortsterminZaehler: 7 }, 't3'), 7);
  assert.equal(O.zaehlerNach({}, 't4'), 4);
  assert.equal(O.zaehlerNach({ ortsterminZaehler: 4 }, 't5'), 5);
});
ok('Bestand ohne Zähler: aus allem, was irgendwo steht', () => {
  assert.equal(O.zaehler(zwei), null);
  assert.equal(O.naechsteKennung(zwei, { bilddokus: { t5: {} } }), 't6');
  assert.equal(O.zaehlerNach(zwei, O.naechsteKennung(zwei, { bilddokus: { t5: {} } })), 6, 'Zähler wird dabei angelegt');
});
ok('bereinigt: trimmt die vier Felder, behält unbekannte Felder und fremde Einträge; leere Liste → null', () => {
  const roh = [{ id: ' t2 ', datum: '2026-08-20', bezeichnung: ' Nachbeprobung ', wer: ' Ka ', vonFotoKit: { am: 'x' } }, 'kaputt', { id: 't3', datum: 5 }];
  assert.deepEqual(O.bereinigt(roh), [{ id: 't2', datum: '2026-08-20', bezeichnung: 'Nachbeprobung', wer: 'Ka', vonFotoKit: { am: 'x' } }, 'kaputt', { id: 't3', datum: 5 }]);
  assert.equal(O.bereinigt([]), null);
  assert.equal(O.bereinigt(null), null);
  // Einträge, die die Liste nicht zeigt, bleiben in der Datei
  assert.deepEqual(O.liste({ weitereOrtstermine: roh }).map(t => t.id), ['t3'], 'nur Einträge mit gültiger Kennung werden gezeigt');
  assert.deepEqual(O.liste({ weitereOrtstermine: [{ id: 't1' }, { id: 't2' }, { id: 'tx' }] }).map(t => t.id), ['t2'], 't1 und ungültige Kennungen nicht als weiterer Termin');
});
ok('inFotoKit: Ordner, Fotos und gemerkte Bilddoku eines Termins (für die Rückfrage beim Entfernen)', () => {
  const fk = { ordnerTermine: { 'fotos ka 20.08': { termin: 't2' }, 'Bilder Stefan': { termin: 't1' }, '': { termin: 't2' } },
    bilder: { 'IMG_0001.jpg': { termin: 't2' }, 'Bilder A/IMG_0002.jpg': { beschreibung: 'x' } },
    bilddokus: { t2: { dateien: ['Fotos/Bilddokumentation_26.0999_Teststadt Ka_2026-08-20.pdf'] } } };
  assert.deepEqual(O.inFotoKit(fk, 't2'), { ordner: ['direkt in „Fotos“', 'fotos ka 20.08'], fotos: 1, bilddoku: ['Bilddokumentation_26.0999_Teststadt Ka_2026-08-20.pdf'] });
  assert.deepEqual(O.inFotoKit(fk, 't3'), { ordner: [], fotos: 0, bilddoku: [] });
  assert.deepEqual(O.inFotoKit(null, 't2'), { ordner: [], fotos: 0, bilddoku: [] });
  assert.deepEqual(O.inFotoKit({ bilddokus: { t2: { dateien: 'eine.pdf' } } }, 't2').bilddoku, ['eine.pdf'], 'dateien als Text');
});
console.log(`Ortstermine: ${n} Prüfungen grün`);
