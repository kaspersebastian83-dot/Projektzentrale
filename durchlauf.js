/* Spektron – Durchlaufzeiten je Projekt, nur aus vorhandenen Spuren (nichts wird eingegeben oder geschrieben).
   Ortstermin (_Projekt.json) → Laborauftrag (…_Laborübergabe.xls in „Laboraufträge“, Datum aus dem Dateinamen)
   → Prüfbericht (erste XML/PDF in „Laborergebnisse“, Datum der Ablage im Ordner)
   → Übergabe ans Büro (erste Büroübergabe) → Versand (Versanddaten der ersten erledigten Übergabe, sonst „Verteiler“).
   Gezählt werden Kalendertage. Ein Abschnitt mit fehlendem oder unplausiblem Datum fällt nur für dieses Projekt heraus. */
(function(root){
  'use strict';
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const pad = n => String(n).padStart(2, '0');
  const gueltig = s => typeof s === 'string' && ISO.test(s) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  /** Kalendertag in Ortszeit für einen Zeitstempel (Dateidatum, ISO-Zeit der Büroübergabe). */
  function tag(wert){
    const d = new Date(wert);
    return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
  }
  /** Datum aus einem LabelKit-Dateinamen („26.0123_PAK_24-10-2026_Laborübergabe.xls“), sonst ''. */
  function datumAusName(name){
    const m = /(\d{2})[-.](\d{2})[-.](\d{4})/.exec(String(name || ''));
    if (!m) return '';
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    return gueltig(iso) ? iso : '';
  }
  const tage = (von, bis) => Math.round((Date.parse(bis + 'T12:00:00Z') - Date.parse(von + 'T12:00:00Z')) / 864e5);
  const fruehestes = liste => liste.filter(Boolean).sort()[0] || '';
  const spaetestes = liste => liste.filter(Boolean).sort().pop() || '';

  const ABSCHNITTE = [
    ['aufnahme', 'Ortstermin → Laborauftrag', 'ortstermin', 'laborauftrag'],
    ['labor', 'Laborauftrag → Prüfbericht', 'laborauftrag', 'pruefbericht'],
    ['gutachten', 'Prüfbericht → Übergabe ans Büro', 'pruefbericht', 'uebergabe'],
    ['buero', 'Übergabe → Versand', 'uebergabe', 'versand'],
    ['gesamt', 'Ortstermin → Versand', 'ortstermin', 'versand'],
  ];

  /**
   * auftraege:  [{name, lastModified}] – Dateien in „Laboraufträge“
   * ergebnisse: [{name, lastModified, labor}] – Dateien in „Laborergebnisse“ (labor: z. B. 'Eurofins' bei Eurofins-XML)
   * buero:      Büroübergaben (records aus BueroData.scanProject)
   * pj:         Inhalt von _Projekt.json
   */
  function projekt({ pj = {}, auftraege = [], ergebnisse = [], buero = [] } = {}){
    const d = {}, hinweise = [];
    d.ortstermin = gueltig(pj.ortstermin) ? pj.ortstermin : '';
    d.laborauftrag = fruehestes(auftraege.filter(f => /_Laborübergabe\.xls$/i.test(f.name)).map(f => datumAusName(f.name) || tag(f.lastModified)));
    const berichte = ergebnisse.filter(f => /\.(xml|pdf)$/i.test(f.name)).map(f => ({ ...f, tag: tag(f.lastModified) })).filter(f => f.tag);
    // Ein älteres Dokument im Ordner (z. B. ein mitkopierter Altbericht) zählt nicht als Antwort auf diesen Auftrag.
    const passend = d.laborauftrag ? berichte.filter(f => f.tag >= d.laborauftrag) : berichte;
    const erster = passend.sort((a, b) => a.tag.localeCompare(b.tag))[0];
    d.pruefbericht = erster ? erster.tag : '';
    const labor = (erster && erster.labor) || (berichte.find(f => f.labor) || {}).labor || '';
    const aktiv = buero.filter(r => r && r.order && !r.withdrawn).sort((a, b) => String(a.order.created).localeCompare(String(b.order.created)));
    d.uebergabe = aktiv.length ? tag(aktiv[0].order.created) : '';
    const erledigt = aktiv.find(r => r.status === 'Erledigt');
    const versandt = erledigt ? Object.values(erledigt.sent || {}).map(s => s && gueltig(s.date) ? s.date : '') : [];
    d.versand = spaetestes(versandt);
    if (!d.versand && pj.verteiler && typeof pj.verteiler === 'object')
      d.versand = spaetestes(Object.values(pj.verteiler).map(v => v && v.an && gueltig(v.versandt) ? v.versandt : ''));
    const abschnitte = {};
    for (const [k, name, von, bis] of ABSCHNITTE){
      if (!d[von] || !d[bis]) continue;
      const n = tage(d[von], d[bis]);
      if (n < 0){ hinweise.push(`${name}: ${d[bis]} liegt vor ${d[von]} – nicht mitgezählt`); continue; }
      abschnitte[k] = n;
    }
    return { daten: d, abschnitte, labor, hinweise };
  }

  function median(werte){
    const s = werte.slice().sort((a, b) => a - b), m = s.length >> 1;
    return !s.length ? null : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  /** [{name, ergebnis}] → je Abschnitt Anzahl, Median und langsamstes Projekt; Laborzeiten je Labor. */
  function auswerten(liste){
    const abschnitte = ABSCHNITTE.map(([k, name]) => {
      const mit = liste.filter(x => x.ergebnis && k in x.ergebnis.abschnitte);
      const werte = mit.map(x => x.ergebnis.abschnitte[k]);
      const max = mit.slice().sort((a, b) => b.ergebnis.abschnitte[k] - a.ergebnis.abschnitte[k])[0];
      return { key: k, name, n: werte.length, median: median(werte), max: max ? { name: max.name, tage: max.ergebnis.abschnitte[k] } : null };
    });
    const labore = new Map();
    for (const x of liste){
      if (!x.ergebnis || !('labor' in x.ergebnis.abschnitte)) continue;
      const l = x.ergebnis.labor || 'Labor nicht erkannt';
      if (!labore.has(l)) labore.set(l, []);
      labore.get(l).push(x.ergebnis.abschnitte.labor);
    }
    return { abschnitte, labore: [...labore].map(([labor, w]) => ({ labor, n: w.length, median: median(w), max: Math.max(...w) })).sort((a, b) => b.n - a.n) };
  }

  const api = Object.freeze({ projekt, auswerten, median, datumAusName, tag, ABSCHNITTE });
  root.Durchlauf = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
