// Vorwahl der Word-Datei für „Ans Büro übergeben“ (word-wahl.js) – reine Rechnung, synthetische Dateilisten.
const assert = require('node:assert/strict');
const W = require('../word-wahl.js');
const S = require('../stufen.js');

assert.equal(W.MITTEILUNG.source, S.MITTEILUNG.source, 'gleiches Muster wie stufen.js');
assert.equal(W.MITTEILUNG.flags, S.MITTEILUNG.flags);

const t = iso => new Date(iso).getTime();
const datei = (name, iso) => ({ name, rel: 'Mitteilungen/' + name, t: t(iso) });
const neuesteZuerst = l => l.slice().sort((a, b) => b.t - a.t);

// Anlagen nach Namen: PlanKit und Projektzentrale (PN 98 / Brandgeruch) – Mitteilungen und freie Namen nicht
for (const n of ['26.0600_Anlage_Probenahme_2026-10-30.docx', '26.0600_Anlage_Probenahme_2026-10-30_2.docx', '26.0600_Raumbuch_2026-10-30.docx',
  '26.0600_Wandansichten_2026-10-30.docx', '26.0600_Anlage_PN98_2026-10-30.docx', '26.0600_Anlage_PN98-Brandgeruch_2026-10-30.docx',
  '26.0600_Anlage_Brandgeruch_2026-10-30_3.docx']) assert.ok(W.istAnlage(n), 'Anlage: ' + n);
for (const n of ['1._Mitteilung_26.0600.docx', '2. Mitteilung Stegerwaldstr.docx', 'Gutachten B.docx', 'Probenahme Notizen.docx', 'Raumbuch.docx'])
  assert.ok(!W.istAnlage(n), 'keine Anlage: ' + n);

// Anlagen-Protokoll: Datei in Spalte 2, Kopfzeile stört nicht, Groß-/Kleinschreibung egal, Ordner im Pfad egal
const prot = W.protokollDateien('Anlagen-Protokoll (Projektzentrale) – je Zeile: Zeit (UTC) | Anlage | SHA-256 der Anlage | Quelle | SHA-256 der Quelle | Programm\r\n'
  + '2026-10-30T10:00:00.000Z | Anhang Messung.docx | abc | Laboraufträge/x_Daten.json | def | Projektzentrale 1.38.0\r\n'
  + '2026-10-30T11:00:00.000Z | Mitteilungen/Sonderanlage.DOCX | abc | Pläne/x.probenplan | def | PlanKit 1.49.0\n\nkaputte Zeile\n');
assert.ok(W.istAnlage('Anhang Messung.docx', prot));
assert.ok(W.istAnlage('sonderanlage.docx', prot));
assert.ok(!W.istAnlage('Anhang Messung.docx', new Set()), 'ohne Protokoll nur Namensmuster');
assert.ok(!W.istAnlage('1._Mitteilung_26.0600.docx', prot));

// 1. Mitteilung plus neuere Probenahme-Anlage (und PN 98, Protokoll-Anlage): die Mitteilung
let liste = neuesteZuerst([datei('1._Mitteilung_26.0600.docx', '2026-10-30T10:00'), datei('26.0600_Anlage_Probenahme_2026-10-30.docx', '2026-10-30T12:00'),
  datei('26.0600_Anlage_PN98_2026-10-30.docx', '2026-10-30T12:30'), datei('Anhang Messung.docx', '2026-10-30T13:00')]);
assert.deepEqual(W.vorwahl(liste, { protokoll: prot }), { rel: 'Mitteilungen/1._Mitteilung_26.0600.docx', quelle: 'mitteilung' });

// 2. Nur Anlagen: keine Vorwahl
assert.deepEqual(W.vorwahl(neuesteZuerst([datei('26.0600_Raumbuch_2026-10-30.docx', '2026-10-30T09:00'), datei('26.0600_Wandansichten_2026-10-30.docx', '2026-10-30T10:00')])),
  { rel: '', quelle: '' });
// … auch keine, wenn nur freie Namen da sind (z. B. „Gutachten B.docx“) – dann wählt jemand selbst
assert.deepEqual(W.vorwahl([datei('Gutachten B.docx', '2026-10-30T09:00')]), { rel: '', quelle: '' });
assert.deepEqual(W.vorwahl([]), { rel: '', quelle: '' });

// 3. BerichtKit geht vor: neuester Eintrag, dessen Datei noch da ist – auch wenn eine Mitteilung neuer ist
liste = neuesteZuerst([datei('1._Mitteilung_26.0604.docx', '2026-10-30T10:00'), datei('2._Mitteilung_26.0604.docx', '2026-10-30T11:00'), datei('26.0604_Raumbuch_2026-10-30.docx', '2026-10-30T12:00')]);
const berichte = [{ datei: '1._Mitteilung_26.0604.docx', am: '2026-10-30T08:00:00.000Z' }, { datei: '3._Mitteilung_26.0604.docx', am: '2026-10-30T09:30:00.000Z' }, { datei: 42 }, null];
assert.deepEqual(W.vorwahl(liste, { berichte }), { rel: 'Mitteilungen/1._Mitteilung_26.0604.docx', quelle: 'berichtkit' }, '3. Mitteilung gibt es nicht mehr → 1.');
assert.deepEqual(W.vorwahl(liste, { berichte: [...berichte, { datei: '2._mitteilung_26.0604.DOCX', am: '2026-10-30T10:00:00.000Z' }] }),
  { rel: 'Mitteilungen/2._Mitteilung_26.0604.docx', quelle: 'berichtkit' }, 'neuester Eintrag, Name ohne Groß-/Kleinschreibung');
// BerichtKit-Eintrag, der (warum auch immer) eine Anlage nennt: nie vorgewählt
assert.equal(W.vorwahl(liste, { berichte: [{ datei: '26.0604_Raumbuch_2026-10-30.docx', am: '2026-10-31' }] }).rel, 'Mitteilungen/2._Mitteilung_26.0604.docx');

// 4. Schon beim Büro: eine noch nicht übergebene Datei geht vor (2. Mitteilung nach Versand der 1.); sonst bleibt es bei der Reihenfolge
const uebergeben = new Set(['1._mitteilung_26.0604.docx']);
assert.deepEqual(W.vorwahl(liste, { berichte, uebergeben }), { rel: 'Mitteilungen/2._Mitteilung_26.0604.docx', quelle: 'mitteilung' });
assert.equal(W.vorwahl([liste.find(w => w.name.startsWith('1.'))], { berichte, uebergeben }).rel, 'Mitteilungen/1._Mitteilung_26.0604.docx', 'nur die übergebene da → trotzdem sie');

console.log('Word-Vorwahl: Mitteilung vor neuerer Anlage, nur Anlagen → keine, BerichtKit vor Mitteilung, Anlagen-Protokoll und Namensmuster, Übergebenes nachrangig');
