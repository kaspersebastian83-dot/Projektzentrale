// Stufen eines Projekts und „Jetzt dran“ (stufen.js) – reine Rechnung, synthetische Fakten.
const assert = require('node:assert/strict');
const S = require('../stufen.js');
const zust = r => Object.fromEntries(r.stufen.map(s => [s.key, s.zustand]));

// leerer Ordner: Projekt anlegen
let r = S.berechnen({});
assert.equal(r.jetzt.aktion, 'az'); assert.equal(r.gruppe, 'dich'); assert.equal(r.aktuell, 'ortstermin');
assert.deepEqual(zust(r), { projekt: 'dran', ortstermin: 'dran', labor: 'offen', gutachten: 'offen', buero: 'offen', abrechnung: 'offen' });

// Projektdaten da, Proben erfasst, beim Labor: läuft; inzwischen Probenplan
const basis = { pj: true, pflichtFehlt: 0, proben: true, laborauftrag: '2026-01-05', fotos: { bilder: 38, begonnen: true } };
r = S.berechnen(basis);
assert.equal(r.aktuell, 'labor'); assert.equal(r.gruppe, 'laeuft'); assert.equal(r.kurz, 'Beim Labor');
assert.equal(r.jetzt.aktion, 'plan'); assert.ok(r.jetzt.wartet);
assert.match(r.stufen[1].text, /Laborauftrag 05\.01\. · Fotos in Bearbeitung/);

// Prüfberichte eingegangen: dran
r = S.berechnen({ ...basis, berichte: 2 });
assert.equal(r.gruppe, 'dich'); assert.equal(r.jetzt.aktion, 'ergebnis'); assert.equal(r.kurz, 'Labor · Ergebnisse da');
assert.match(r.stufen[2].text, /2 Prüfberichte eingegangen/);
// übernommen, aber seither neue Dateien
assert.equal(S.berechnen({ ...basis, berichte: 3, ergebnisse: { vollstaendig: true, veraltet: true } }).jetzt.aktion, 'ergebnis');
// Zwischenstand, Labor hat noch offen: wartet
assert.equal(S.berechnen({ ...basis, berichte: 1, ergebnisse: { vollstaendig: false, offen: 2 } }).gruppe, 'laeuft');

// Ergebnisse vollständig: Gutachten dran; Pflichtangaben fehlen nur als Hinweis
const labFertig = { ...basis, berichte: 2, ergebnisse: { vollstaendig: true }, plan: true };
r = S.berechnen({ ...labFertig, pflichtFehlt: 2 });
assert.equal(r.aktuell, 'gutachten'); assert.equal(zust(r).projekt, 'hinweis'); assert.equal(r.jetzt.titel, 'Gutachten schreiben');

// beim Büro: läuft; Rückfrage: dran, geht vor
r = S.berechnen({ ...labFertig, uebergabe: '2026-02-01', buero: { offen: true, offenText: 'Gegenlesen · PDF' } });
assert.equal(r.aktuell, 'buero'); assert.equal(r.gruppe, 'laeuft'); assert.equal(zust(r).gutachten, 'fertig'); assert.match(r.stufen[4].text, /Gegenlesen · PDF/);
r = S.berechnen({ ...labFertig, uebergabe: '2026-02-01', buero: { offen: true, frage: true } });
assert.equal(r.jetzt.aktion, 'frage'); assert.equal(r.gruppe, 'dich'); assert.equal(r.kurz, 'Rückfrage vom Büro');

// versandt, Abrechnung vor dem Versand gespeichert: Abrechnung dran; danach gespeichert: fertig
r = S.berechnen({ ...labFertig, uebergabe: '2026-02-01', versand: '2026-02-10', buero: { erledigt: true }, abrechnung: '2026-01-20' });
assert.equal(r.aktuell, 'abrechnung'); assert.equal(r.jetzt.aktion, 'beleg'); assert.match(r.stufen[5].text, /nach dem Versand abschließen/);
r = S.berechnen({ ...labFertig, uebergabe: '2026-02-01', versand: '2026-02-10', buero: { erledigt: true }, abrechnung: '2026-02-12' });
assert.equal(r.aktuell, null); assert.equal(r.gruppe, 'fertig'); assert.equal(r.jetzt.aktion, null);

// frühere Versandangabe ohne BüroKit zählt als Versand
assert.equal(S.berechnen({ ...labFertig, versand: '2025-11-02', abrechnung: '2025-11-03' }).gruppe, 'fertig');
console.log('OK stufen: sechs Stufen, Jetzt dran, Gruppen (dich/läuft/fertig), Rückfrage zuerst, Abrechnung nach dem Versand');
// Spätere Stufe erreicht: frühere ohne Spur gelten als übersprungen (Gutachten beim Büro ohne Prüfberichte im Ordner)
r = S.berechnen({ pj: true, proben: true, buero: { offen: true } });
assert.equal(r.aktuell, 'buero'); assert.equal(zust(r).labor, 'uebersprungen'); assert.equal(r.gruppe, 'laeuft'); assert.equal(r.kurz, 'Beim Büro');
// versandt und abgerechnet, aber ohne Probendaten und Prüfberichte (Projekt vor den Apps): fertig
r = S.berechnen({ pj: true, versand: '2026-10-20', abrechnung: '2026-10-22' });
assert.equal(r.gruppe, 'fertig'); assert.deepEqual([zust(r).ortstermin, zust(r).labor], ['uebersprungen', 'uebersprungen']);
// eingegangene Prüfberichte bleiben dran, auch wenn das Gutachten schon beim Büro ist
r = S.berechnen({ pj: true, proben: true, berichte: 2, buero: { offen: true } });
assert.equal(zust(r).labor, 'dran');
console.log('OK stufen: übersprungene Stufen');
// offenes Gutachten beim Büro geht vor eine ältere Versandangabe
r = S.berechnen({ pj: true, versand: '2026-10-20', abrechnung: '2026-10-22', buero: { offen: true, offenText: 'PDF' } });
assert.equal(r.aktuell, 'buero'); assert.equal(r.gruppe, 'laeuft');
console.log('OK stufen: offenes Gutachten vor älterem Versand');
// Prüfberichte ohne Probendaten (Proben anders erfasst): Ortstermin übersprungen, Labor dran
r = S.berechnen({ pj: false, berichte: 2 });
assert.equal(zust(r).ortstermin, 'uebersprungen'); assert.equal(r.jetzt.aktion, 'ergebnis');
console.log('OK stufen: Prüfberichte ohne Probendaten');
// Büroaufgaben nicht vollständig lesbar: kein „abgeschlossen“ aus Teildaten
r = S.berechnen({ pj: true, proben: true, versand: '2026-10-01', abrechnung: '2026-10-05', buero: { unklar: true } });
assert.equal(r.gruppe, 'dich'); assert.equal(r.kurz, 'Büro-Stand unklar'); assert.equal(r.jetzt.aktion, 'buerokit');
// Laborübergabe ohne Probendaten: beim Labor
r = S.berechnen({ pj: true, laborauftrag: '2026-10-08' });
assert.equal(r.gruppe, 'laeuft'); assert.equal(r.kurz, 'Beim Labor');
console.log('OK stufen: Büro-Stand unklar, Laborübergabe ohne Probendaten');
// Gutachten ans Büro, obwohl das Labor nur einen Zwischenstand hat: Stufe Labor nicht „keine Prüfberichte“, sondern ihr Stand
r = S.berechnen({ pj: true, proben: true, berichte: 2, ergebnisse: { vollstaendig: false, offen: 1 }, plan: true, uebergabe: '2026-10-27', buero: { offen: true, offenText: 'PDF · Versand' } });
assert.deepEqual(r.stufen.find(s => s.key === 'labor'), { key: 'labor', name: 'Labor', app: 'ResultKit', zustand: 'uebersprungen', text: 'Zwischenstand übernommen · 1 offen beim Labor – nicht abgeschlossen' });
assert.equal(r.aktuell, 'buero'); assert.equal(r.kurz, 'Beim Büro');
// ohne Prüfberichte bleibt es „übersprungen“ wie bisher
r = S.berechnen({ pj: true, proben: true, plan: true, uebergabe: '2026-10-27', buero: { offen: true } });
assert.equal(r.stufen.find(s => s.key === 'labor').text, 'Keine Prüfberichte im Ordner – übersprungen');
console.log('OK stufen: Labor-Zwischenstand bleibt sichtbar, wenn das Gutachten schon beim Büro ist');
// Rechnung über BüroKit (ab 1.1): Stand vor dem Versand genügt – das Büro rechnet danach ab
r = S.berechnen({ ...labFertig, uebergabe: '2026-10-28', versand: '2026-10-29', buero: { erledigt: true, rechnungOffen: true }, abrechnung: '2026-10-27' });
assert.equal(r.aktuell, 'abrechnung'); assert.equal(r.stufen[5].zustand, 'wartet'); assert.equal(r.gruppe, 'laeuft');
assert.equal(r.jetzt.aktion, 'buerokit'); assert.equal(r.kurz, 'Versandt · Rechnung beim Büro');
// … ohne Stand ist der Sachverständige dran
r = S.berechnen({ ...labFertig, uebergabe: '2026-10-28', versand: '2026-10-29', buero: { erledigt: true, rechnungOffen: true } });
assert.equal(r.stufen[5].zustand, 'dran'); assert.equal(r.jetzt.aktion, 'beleg'); assert.equal(r.gruppe, 'dich');
// Büro hat „Rechnung“ abgehakt → fertig, auch wenn der Stand vor dem Versand lag
r = S.berechnen({ ...labFertig, uebergabe: '2026-10-28', versand: '2026-10-29', buero: { erledigt: true, rechnung: '2026-10-30', rechnungVon: 'Nad' }, abrechnung: '2026-10-27' });
assert.equal(r.aktuell, null); assert.equal(r.gruppe, 'fertig'); assert.equal(r.stufen[5].text, 'Abgerechnet 30.10. (Nad)');
console.log('OK stufen: Rechnung beim Büro (BüroKit) – wartet, fehlender Stand ist dran, Haken „Rechnung“ schließt ab');
// Mitteilung erstellt (BerichtKit), noch nicht beim Büro: Stufe 4 „Mitteilung vom … erstellt – ans Büro übergeben“
const mt = { datei: '1._Mitteilung_26.0600.docx', datum: '2026-10-30' };
r = S.berechnen({ ...labFertig, mitteilung: mt });
assert.deepEqual(r.stufen[3], { key: 'gutachten', name: 'Gutachten', app: 'PlanKit · Anlage', zustand: 'dran', text: 'Mitteilung vom 30.10. erstellt – ans Büro übergeben', aktion: 'uebergeben' });
assert.equal(r.aktuell, 'gutachten'); assert.equal(r.gruppe, 'dich'); assert.equal(r.kurz, 'Mitteilung ans Büro übergeben');
assert.deepEqual([r.jetzt.titel, r.jetzt.aktion, r.jetzt.knopf], ['Gutachten ans Büro übergeben', 'uebergeben', 'Ans Büro übergeben']);
// Labor noch beim Zwischenstand, vorläufige Mitteilung schon da: Übergeben ist dran, Labor bleibt sichtbar „nicht abgeschlossen“
r = S.berechnen({ ...basis, berichte: 1, ergebnisse: { vollstaendig: false, offen: 2 }, mitteilung: mt });
assert.equal(r.aktuell, 'gutachten'); assert.equal(r.jetzt.aktion, 'uebergeben'); assert.match(r.stufen[2].text, /– nicht abgeschlossen$/);
// … neue Prüfberichte seit der Übernahme gehen vor (sie könnten die Mitteilung ändern); Stufe 4 sagt trotzdem, was ansteht
r = S.berechnen({ ...labFertig, ergebnisse: { vollstaendig: true, veraltet: true }, mitteilung: mt });
assert.equal(r.aktuell, 'labor'); assert.equal(r.stufen[3].text, 'Mitteilung vom 30.10. erstellt – ans Büro übergeben'); assert.equal(r.stufen[3].zustand, 'offen');
// übergeben: Büroaufgabe nennt die Datei (auch wenn das Büro sie später bearbeitet hat) …
r = S.berechnen({ ...labFertig, mitteilung: { ...mt, datum: '2026-11-03' }, uebergabe: '2026-10-30', buero: { offen: true, woerter: ['Mitteilungen/1._Mitteilung_26.0600.docx'], zuletzt: '2026-10-30' } });
assert.equal(r.stufen[3].zustand, 'fertig'); assert.equal(r.aktuell, 'buero');
// … oder eine Übergabe/ein Versand am Tag der Datei oder später (frühere Übergaben, umbenannte Datei)
assert.equal(S.berechnen({ ...labFertig, mitteilung: mt, uebergabe: '2026-10-30', buero: { offen: true, woerter: ['Mitteilungen/Gutachten.docx'], zuletzt: '2026-10-30' } }).stufen[3].zustand, 'fertig');
assert.equal(S.berechnen({ ...labFertig, mitteilung: mt, versand: '2026-10-31' }).stufen[3].zustand, 'fertig');
// 2. Mitteilung nach Versand der ersten: wieder dran – auch wenn Versand und Rechnung erledigt sind
r = S.berechnen({ ...labFertig, mitteilung: { datei: '2._Mitteilung_26.0600.docx', datum: '2026-11-20' }, uebergabe: '2026-10-30', versand: '2026-11-02',
  buero: { erledigt: true, rechnung: '2026-11-05', woerter: ['Mitteilungen/1._Mitteilung_26.0600.docx'], zuletzt: '2026-10-30' }, abrechnung: '2026-10-29' });
assert.equal(r.aktuell, 'gutachten'); assert.equal(r.gruppe, 'dich'); assert.equal(r.jetzt.aktion, 'uebergeben'); assert.equal(r.stufen[4].zustand, 'fertig');
// … während die erste noch beim Büro ist: ebenfalls dran (das Formular fragt vor einer zweiten Übergabe nach)
r = S.berechnen({ ...labFertig, mitteilung: { datei: '2._Mitteilung_26.0600.docx', datum: '2026-11-20' }, uebergabe: '2026-10-30', buero: { offen: true, woerter: ['Mitteilungen/1._Mitteilung_26.0600.docx'], zuletzt: '2026-10-30' } });
assert.equal(r.aktuell, 'gutachten'); assert.equal(r.jetzt.aktion, 'uebergeben');
// Büro-Stand unklar: kein Urteil über die Mitteilung
r = S.berechnen({ ...labFertig, mitteilung: mt, buero: { unklar: true } });
assert.notEqual(r.stufen[3].aktion, 'uebergeben'); assert.equal(r.jetzt.aktion, 'buerokit');
// Rückfrage vom Büro geht weiter vor
assert.equal(S.berechnen({ ...labFertig, mitteilung: { ...mt, datum: '2026-11-20' }, uebergabe: '2026-10-30', buero: { offen: true, frage: true, woerter: [], zuletzt: '2026-10-30' } }).jetzt.aktion, 'frage');
// Erkennen der neuesten Mitteilung (wie die Spektron-Leiste): Word-Sperrdateien, andere Word-Dateien und .doc zählen nicht
const t = s => new Date(s).getTime();
assert.deepEqual(S.neuesteMitteilung([{ name: '1._Mitteilung_26.0600.docx', t: t('2026-10-30T09:00') }, { name: '2. Mitteilung 26.0600 PAK.docx', t: t('2026-11-02T23:30') },
  { name: '~$Mitteilung_26.0600.docx', t: t('2026-12-01T10:00') }, { name: 'Anlage PN 98 2026-11-05.docx', t: t('2026-11-05T10:00') }, { name: '3. Mitteilung.doc', t: t('2026-11-06T10:00') },
  { name: '1__Mitteilungsentwurf.docx', t: t('2026-11-07T10:00') }]), { datei: '2. Mitteilung 26.0600 PAK.docx', datum: '2026-11-02' });
assert.deepEqual(S.neuesteMitteilung([{ name: '1__Mitteilung.docx', t: t('2026-10-30T12:00') }]), { datei: '1__Mitteilung.docx', datum: '2026-10-30' });
assert.equal(S.neuesteMitteilung([{ name: 'Gutachten.docx', t: 1 }]), null); assert.equal(S.neuesteMitteilung(null), null);
console.log('OK stufen: Mitteilung erstellt, noch nicht übergeben – Stufe 4, Jetzt dran, 2. Mitteilung, übergeben nach Name oder Datum');
