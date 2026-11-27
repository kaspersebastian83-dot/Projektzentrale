// Faktensätze für den Vergleich Stufen.kacheln ohne drittes Argument (1.53.1 ↔ 1.54.0)
const basis = { pj: true, pflichtFehlt: 0, proben: true, laborauftrag: '2026-01-05', fotos: { bilder: 38, begonnen: true } };
const lab = { ...basis, berichte: 2, ergebnisse: { vollstaendig: true }, plan: true };
module.exports = [
  {}, basis, { ...basis, berichte: 2 }, { ...basis, berichte: 3, ergebnisse: { vollstaendig: true, veraltet: true } },
  { ...lab, pflichtFehlt: 2 }, { ...lab, berichtsart: 'brand' }, { ...lab, berichtsart: 'asbest', mitteilung: { datei: '1._Mitteilung_26.0999.docx', datum: '2026-08-14' } },
  { ...lab, mitteilung: { datei: '2._Mitteilung_26.0999.docx', datum: '2026-11-27' }, buero: { erledigt: true, woerter: ['Mitteilungen/1._Mitteilung_26.0999.docx'], zuletzt: '2026-08-14', versand: '2026-08-15' }, uebergabe: '2026-08-14', versand: '2026-08-15' },
  { ...lab, uebergabe: '2026-02-01', buero: { offen: true, offenText: 'Gegenlesen · PDF' } },
  { ...lab, uebergabe: '2026-02-01', versand: '2026-02-10', buero: { erledigt: true, rechnungOffen: true }, abrechnung: '2026-02-12' },
  { ...lab, uebergabe: '2026-02-01', versand: '2026-02-10', buero: { erledigt: true }, abrechnung: '2026-02-12', berichtDa: true, probendaten: false, fotos: { bilder: 3, begonnen: false, doku: true } },
  { pj: true, versand: '2026-10-20', abrechnung: '2026-10-22', berichtDa: false },
];
