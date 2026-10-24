// Arbeitszettel lesen (ohne Browser): node tests/arbeitszettel.cjs
// Die Textstücke in tests/fixtures/*.items.json hat pdf.js aus den erfundenen Test-Zetteln (arbeitszettel-*.pdf) gelesen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.slice(html.indexOf('/* AZ-PARSER-START */'), html.indexOf('/* AZ-PARSER-END */'));
const { azLeser, azFelder, azDatum } = new Function(code + ';return { azLeser, azFelder, azDatum };')();
const lies = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `arbeitszettel-${n}.items.json`), 'utf8'));

// voll ausgefüllt: umbrochener Name, Sachverständiger, Sanierung, Anrufer, ASP mit E-Mail, freier Arbeitsauftrag
let z = azLeser(lies('voll')), r = azFelder(z);
assert.equal(z.projektnummer, '26.0142');
assert.deepEqual(r.f, {
  objekt: 'Beispiel Wohnbau GmbH, Hauptstraße 12, 99999 Teststadt',
  auftraggeber: 'Muster Versicherung AG, Versicherungsplatz 1, 99997 Beispielstadt',
  schadennummer: 'XY2026-0001234',
  versicherungsnehmer: 'Eigentümergemeinschaft Hauptstraße 12 und 14, Verwalterweg 3, 99998 Musterhausen',
  sachverstaendigerBeteiligt: 'Gutachterbüro Probe GmbH, Prüfweg 5, 99996 Probstadt, 0999-12345 od. 12346',
  sanierung: 'Trockenbau Test GmbH, Industriestraße 8, 99995 Werkstadt, 0999-55555-10',
  schadendatum: '2026-10-07', ortstermin: '2026-10-15', auftragsdatum: '2026-10-12',
  sachverstaendiger: 'Dr. S. Kasper',
  kontakte: 'Regulierer: Herr Regel 09991234567\nAnrufer: Frau Ruf 09997654321\nASP: Hr. Ansprech 0999111222, ansprech@example.org',
  arbeitsauftrag: 'Bitte Rußproben im EG nehmen.'
});
assert.deepEqual(r.hinweise, ['Mitarbeiter „Sebastian Kasper“ wird als „Dr. S. Kasper“ eingetragen.']);

// knapp: leere Kästen bleiben leer, kein Schadendatum, Termin vor Auftragsdatum, anderer Mitarbeiter unverändert
z = azLeser(lies('knapp')); r = azFelder(z);
assert.equal(z.projektnummer, '26.0999');
assert.equal(r.f.objekt, 'Feldweg 1, 99990 Irgendwo');
assert.equal(r.f.auftraggeber, 'Andere Versicherung AG, 99989 Berlin');
for (const k of ['versicherungsnehmer', 'sachverstaendigerBeteiligt', 'sanierung', 'schadendatum', 'arbeitsauftrag']) assert.equal(r.f[k], '', k);
assert.equal(r.f.sachverstaendiger, 'Erika Muster');
assert.equal(r.f.kontakte, 'Regulierer: Hr. Kurz 0999000111');
assert.deepEqual(r.hinweise, ['Der Termin (02.09.2026) liegt vor dem Auftragsdatum (03.09.2026) – bitte prüfen.']);

// Reihenfolge der Textstücke spielt keine Rolle
const gemischt = lies('voll').reverse();
assert.deepEqual(azFelder(azLeser(gemischt)).f, azFelder(azLeser(lies('voll'))).f);

// kein Arbeitszettel → klare Meldung statt Raten
assert.throws(() => azLeser([{ s: 'Rechnung', x: 60, y: 80 }, { s: 'RISKO', x: 60, y: 140 }]), /kein Arbeitszettel/);

// Datum: nur echte Daten, sonst leer (mit Hinweis)
assert.equal(azDatum('7.9.2026'), '2026-09-07');
assert.equal(azDatum('ab 15.10.'), '');
assert.equal(azDatum('15.13.2026'), '', 'unmöglicher Monat wird nicht gespeichert');
assert.equal(azDatum('31.02.2026'), '', 'unmöglicher Tag wird nicht gespeichert');
const ohneDatum = lies('voll').map(i => i.s === '15.10.2026' || i.s === 'Termin: 15.10.2026' ? Object.assign({}, i, { s: 'Termin: nach Absprache' }) : i);
r = azFelder(azLeser(ohneDatum));
assert.equal(r.f.ortstermin, '');
assert.ok(r.hinweise.some(h => /„Termin“ ist kein Datum \(nach Absprache\)/.test(h)), r.hinweise.join(' | '));
console.log('OK Arbeitszettel: voll, knapp, Reihenfolge, kein Zettel, Datum');
