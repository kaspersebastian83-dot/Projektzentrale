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
