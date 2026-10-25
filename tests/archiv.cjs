// Datenarchiv, reine Auswertung: Zahlen/BG, Einheiten, PAK-Namen, Dubletten und vorläufige Berichte,
// Rangstatistik mit Werten unter BG, PAK-Muster und Quotienten nur bei Werten über BG, CSV ohne Ortsangaben. Erfundene Daten.
const assert = require('node:assert/strict');
const A = require('../archiv/auswertung.js');
let n = 0; const check = (name, fn) => { fn(); n++; console.log('OK Archiv: ' + name); };

check('Ergebnisse: gemessen, < BG, unter BG mit BG-Spalte, n. n., n. b., mehrdeutig', () => {
  assert.deepEqual(A.ergebnis('12,5', '0,5'), { q: 'gemessen', v: 12.5 });
  assert.deepEqual(A.ergebnis('< 0,50', '0,5'), { q: 'unter', v: 0.5 });
  assert.deepEqual(A.ergebnis('unter BG', '0,05'), { q: 'unter', v: 0.05 });
  assert.deepEqual(A.ergebnis('n. n.', '1'), { q: 'nn', v: 1 });
  assert.deepEqual(A.ergebnis('n.b.', ''), { q: 'nb', v: null });
  assert.equal(A.ergebnis('1.234', '').q, 'unklar', 'Tausender oder Dezimal? Nicht raten');
  assert.deepEqual(A.ergebnis('1.234,5', ''), { q: 'gemessen', v: 1234.5 });
});
check('Einheiten vereinheitlicht, aber nie umgerechnet', () => {
  assert.equal(A.einheit('μg / m2'), 'µg/m²');
  assert.equal(A.einheit('µg/100 cm2'), 'µg/100 cm²');
  assert.notEqual(A.einheit('µg/100 cm²'), A.einheit('µg/m²'));
});
check('PAK-Namen deutsch/englisch, Summen und Ähnliche nicht', () => {
  const namen = ['Naphthalin', 'Acenaphthylen', 'Acenaphthen', 'Fluoren', 'Phenanthren', 'Anthracen', 'Fluoranthen', 'Pyren', 'Benz[a]anthracen',
    'Chrysen', 'Benzo[b]fluoranthen', 'Benzo(k)fluoranthen', 'Benzo[a]pyren', 'Indeno[1,2,3-cd]pyren', 'Dibenzo[a,h]anthracen', 'Benzo[g,h,i]perylen'];
  namen.forEach((x, i) => assert.equal(A.pakIndex(x), i, x));
  assert.equal(A.pakIndex('Benzo[a]pyrene'), 12); assert.equal(A.pakIndex('Naphthalene'), 0); assert.equal(A.pakIndex('Benzo[b+j]fluoranthen'), 10);
  for (const x of ['Summe 16 EPA-PAK exkl. BG', '1-Methylnaphthalin', 'Benzo[e]pyren', 'Fluorid']) assert.equal(A.pakIndex(x), -1, x);
});
check('Projektnummer und Jahr aus dem Ordnernamen', () => {
  assert.deepEqual(A.projektKopf('26.0142 Musterstadt Abc'), { nr: '26.0142', jahr: 2026 });
  assert.equal(A.projektKopf('99.0001 Alt').jahr, 1999);
  assert.equal(A.projektKopf('_Projekt_Sicherungen'), null);
});
check('Dubletten: gleicher Bericht doppelt, vorläufig ersetzt, Nachtrag ergänzt', () => {
  const pr = (labNr, werte) => ({ labNr, ref: '26.0001-' + labNr, art: 'Wischprobe', werte });
  const v = { datei: 'a_vorl.xml', geaendert: 1, bericht: 'AR-1', vorlaeufig: true, proben: [pr('1', [{ p: 'BaP', r: '9', u: 'µg/m²', loq: '0,5' }]), pr('2', [{ p: 'BaP', r: '7', u: 'µg/m²', loq: '0,5' }])] };
  const e = { datei: 'a.xml', geaendert: 2, bericht: 'AR-2', proben: [pr('1', [{ p: 'BaP', r: '4', u: 'µg/m²', loq: '0,5' }])] };
  const kopie = { ...e, datei: 'a (Kopie).xml', geaendert: 3 };
  const nachtrag = { datei: 'b.xml', geaendert: 4, bericht: 'AR-3', proben: [pr('1', [{ p: 'PCB', r: '< 0,1', u: 'mg/kg', loq: '0,1' }])] };
  const m = A.projektMessungen([nachtrag, kopie, v, e]);
  const p1 = m.filter(x => x.probe === '1');
  assert.deepEqual(p1.map(x => [x.p, x.v, x.vorlaeufig]).sort(), [['BaP', 4, false], ['PCB', 0.1, false]]);
  const p2 = m.filter(x => x.probe === '2');
  assert.equal(p2.length, 1); assert.equal(p2[0].vorlaeufig, true, 'nur vorläufig vorhanden: bleibt, gekennzeichnet');
  assert.equal(A.zaehlt(p2[0]), false, 'zählt nicht in der Statistik');
});
check('Statistik: unter BG zählt als kleinster Wert, nie als Zahl; zu wenige Werte → keine Kennzahl', () => {
  const w = (q, v) => ({ q, v, vorlaeufig: false });
  const s = A.statistik([w('unter', .5), w('unter', .5), w('gemessen', 3), w('gemessen', 10), w('gemessen', 1), w('nb', null)]);
  assert.equal(s.n, 5); assert.equal(s.unter, 2); assert.equal(s.gemessen, 3);
  assert.deepEqual(s.median, { wert: 1 }); assert.deepEqual(s.p90, { wert: 10 }); assert.equal(s.min, 1); assert.equal(s.max, 10);
  const viele = A.statistik([w('nn', 1), w('unter', .5), w('unter', .5), w('gemessen', 2), w('gemessen', 4)]);
  assert.deepEqual(viele.median, { unter: true }, 'Median fällt auf < BG');
  const wenig = A.statistik([w('gemessen', 1), w('gemessen', 2)]);
  assert.equal(wenig.genug, false); assert.equal(wenig.median, null); assert.equal(wenig.max, 2);
});
check('Parameterliste je Einheit getrennt, häufigste zuerst', () => {
  const x = (p, u) => ({ p, u, q: 'gemessen', v: 1, vorlaeufig: false });
  const l = A.parameterListe([x('BaP', 'µg/m²'), x('BaP', 'µg/m²'), x('BaP', 'mg/kg'), { ...x('BaP', 'mg/kg'), vorlaeufig: true }]);
  assert.deepEqual(l.map(y => [y.key, y.n]), [['BaP|µg/m²', 2], ['BaP|mg/kg', 1]]);
});
check('PAK-Muster: Anteile an der Summe, unter BG = 0 und markiert, Quotient nur bei beiden über BG', () => {
  const ms = []; const add = (probe, i, r, u = 'µg/m²') => ms.push({ probe, ref: probe, art: 'Wischprobe', p: A.PAK16[i][1], u, ...A.ergebnis(r, '0,5'), vorlaeufig: false });
  add('1', 6, '6'); add('1', 7, '2'); add('1', 8, '< 0,5'); add('1', 9, '2'); add('1', 12, 'n. b.');
  add('2', 6, '< 0,5');
  const ps = A.profile(ms);
  assert.equal(ps.length, 1, 'Probe ohne gemessene Einzel-PAK hat kein Muster');
  const p = ps[0];
  assert.equal(p.k, 3); assert.equal(p.summe, 10);
  assert.equal(p.anteile[6], .6); assert.equal(p.anteile[7], .2); assert.equal(p.anteile[8], 0); assert.equal(p.unter[8], true);
  assert.equal(p.anteile[12], undefined, 'n. b. ist nicht bestimmt'); assert.equal(p.anteile[0], undefined);
  assert.equal(p.quotienten[0], .75, 'Flt/(Flt+Pyr)'); assert.equal(p.quotienten[1], null, 'BaA unter BG → kein Quotient');
});
check('Vergleichsmuster nur ab genug Proben', () => {
  const p = a => ({ anteile: Array.from({ length: 16 }, (_, i) => i === 0 ? a : undefined) });
  assert.equal(A.medianProfil([p(.1), p(.2)]), null);
  const m = A.medianProfil([p(.1), p(.2), p(.3), p(.4), p(.5)]); assert.equal(m[0], .3); assert.equal(m[1], undefined);
});
check('CSV: Semikolon, Dezimalkomma, BOM, keine Orte', () => {
  const t = A.csv([{ nr: '26.0001', jahr: 2026, nutzung: 'Wohnen', brandgut: 'Küche/Lebensmittel', probe: '1', art: 'Wisch;probe', p: 'BaP', u: 'µg/m²', roh: '< 0,5', v: 0.5, q: 'unter', bericht: 'AR-1' }]);
  assert.ok(t.startsWith('﻿Projekt;Jahr;'));
  assert.ok(t.includes('26.0001;2026;Wohnen;Küche/Lebensmittel;1;"Wisch;probe";BaP;µg/m²;< 0,5;0,5;< BG;AR-1;'));
  assert.ok(!/Ort|Adresse|Objekt/.test(t.split('\r\n')[0]));
});
console.log(n + ' Prüfungen Datenarchiv bestanden');
