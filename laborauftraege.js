/* Spektron – Laboraufträge aus der LabelKit-Projektdatei („…_Daten.json“), nur rechnen (kein Lesen, kein Schreiben). Ab Projektzentrale 1.55.0.
   Eigene Datei, damit BerichtKit sie in Stufe 4 byte-gleich übernehmen kann (Plan projektzentrale-auftraege-plan.md 4.2, P4).

   gleich halten mit LabelKit index.html, Block „NACHAUFTRAG (5.5.0)“: auftraegeAnwenden, auftraegePruefen, auftragMerkmalGilt,
   auftragVon, nrIstFest, neueProbenListen – Test tests/laborauftraege-labelkit.cjs vergleicht beide mit den echten LabelKit-Funktionen
   (in der CI Pflicht). Vorlage: ResultKit src/labelkit.ts auftraegeAusLabelKit (ResultKit 2.7.0).

   LabelKit schreibt erst ab dem zweiten Laborauftrag etwas: je Probe `auftrag: "a2"` (die Wahrheit), oben `weitereAuftraege
   [{id, am, von, proben:[Nummern]}]`, `auftragZaehler`, `auftrag1 {am, quelle, proben}`. Ein Merkmal gilt nur mit fester Nummer
   (`nrFest` oder `storniert`) UND wenn die Nummer in der Liste dieses Auftrags steht. Fehlt die Liste einer Kennung ganz (ein
   älteres LabelKit-Fenster hat gespeichert), baut LabelKit sie aus den Merkmalen mit fester Nummer neu auf – dann gelten sie.
   Neue Probe = aktive (nicht stornierte) Probe ohne gültiges Merkmal.
   Die Projektzentrale vergibt und ändert nie eine Kennung und schreibt die LabelKit-Datei nie; sie rechnet nur nach. */
(function(root){
  'use strict';
  const NUMMERIERT = ['proben', 'chloridProben', 'asbestProben', 'sonstigeProben'];
  const auftragNr = id => { const m = /^a(\d+)$/.exec(String(id || '')); return m ? Number(m[1]) : 0; };
  const nrIstFest = p => !!(p && (p.nrFest || p.storniert));
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  /** Tag wie LabelKit tagIso (Ortszeit des Rechners). */
  const tagIso = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  /** Nummer einer Probe wie ResultKit („P<n>“ aus _nr, sonst chloridNr, sonst id); 0 = keine. */
  /** wie ResultKit isRueckstellprobe (src/labelkit.ts): Bohrkern-Segment „R“ – kein Laborwert, nicht in „_Ergebnisse.json“. */
  const RUECKSTELLPROBE = 'Rückstellprobe – nicht analysieren';
  const str = v => v === undefined || v === null ? '' : String(v).replace(/\s+/g, ' ').trim();
  const istRueckstellprobe = p => p.matrix === 'Bohrkern' && (str(p.bkStatus).toUpperCase() === 'R' || str(p.notiz) === RUECKSTELLPROBE);
  const nummer = p => { for (const v of [p._nr, p.chloridNr, p.id]){ const n = Number(v); if (Number.isSafeInteger(n) && n > 0 && n < 1e9) return n; } return 0; };
  /** Probenahmedatum als JJJJ-MM-TT (LabelKit speichert ISO, ältere Dateien TT.MM.JJJJ); '' wenn nicht lesbar. */
  const datum = v => { const s = String(v == null ? '' : v).trim(); if (ISO.test(s)) return s; const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };

  /** Laboraufträge einer LabelKit-Projektdatei (reine Funktion, ändert `data` nicht).
      → { auftraege: [{ id, nr, am, von, proben: [Nummern wie in ResultKit: aktiv, ohne Rückstellproben, nach Nummer], probenahme: [früheste, späteste] }],
          von(probe) → Kennung | null, kennungJe: { 'P14': 'a2', … } (nur gültige), neu: [Nummern der neuen Proben],
          aufgebaut: Liste/Zähler fehlten und wurden neu aufgebaut, mehrere: mindestens eine aktive Probe mit gültiger Kennung (sonst: ein Auftrag, alles wie bis 1.54.0) } */
  function lesen(data){
    data = data && typeof data === 'object' ? data : {};
    const alle = NUMMERIERT.flatMap(k => Array.isArray(data[k]) ? data[k] : []).filter(p => !!p && typeof p === 'object');
    // auftraegeAnwenden
    let weitere = Array.isArray(data.weitereAuftraege) ? data.weitereAuftraege.filter(a => a && auftragNr(a.id)).map(a => ({ ...a, proben: Array.isArray(a.proben) ? a.proben.map(Number) : [] })) : null;
    const roh = data.auftrag1;
    let auftrag1 = roh && typeof roh === 'object' ? { ...roh, proben: Array.isArray(roh.proben) ? roh.proben.map(Number) : [] } : null;
    const z = data.auftragZaehler, zaehler = Number.isFinite(Number(z)) && z !== null && z !== '' ? Number(z) : null;
    // auftraegePruefen: fehlen Liste oder Zähler, aus den Merkmalen mit fester Nummer neu aufbauen
    let aufgebaut = false;
    const mit = alle.filter(p => auftragNr(p.auftrag) && nrIstFest(p));
    if (mit.length){
      const je = new Map(); for (const p of mit){ if (!je.has(p.auftrag)) je.set(p.auftrag, []); je.get(p.auftrag).push(Number(p._nr)); }
      const tagVon = id => mit.filter(p => p.auftrag === id && p.nrFest && p.nrFest.am).map(p => tagIso(p.nrFest.am)).sort().pop() || '';
      if (je.has('a1') && !auftrag1){ auftrag1 = { am: tagVon('a1'), proben: je.get('a1').sort((a, b) => a - b) }; aufgebaut = true; }
      for (const [id, nrs] of je){ if (id === 'a1' || (weitere || []).some(a => a && a.id === id)) continue; (weitere = weitere || []).push({ id, am: tagVon(id), von: '', proben: nrs.sort((a, b) => a - b) }); aufgebaut = true; }
      if (zaehler === null) aufgebaut = true;
    }
    // auftragListe / auftragMerkmalGilt
    const liste = id => { if (id === 'a1') return auftrag1 ? auftrag1.proben : null; const e = (weitere || []).find(a => a && a.id === id); return e ? e.proben : null; };
    const gilt = p => { if (!p || !auftragNr(p.auftrag) || !nrIstFest(p)) return false; const l = liste(p.auftrag); return !!l && l.includes(Number(p._nr)); };
    const von = p => gilt(p) ? String(p.auftrag) : null;
    // auftraegeBekannt (ohne die Rückfrage der laufenden LabelKit-Sitzung – die steht nicht in der Datei)
    const bekannt = new Map(), dazu = (id, o) => { if (auftragNr(id) && !bekannt.has(id)) bekannt.set(id, o || {}); };
    if (auftrag1) dazu('a1', auftrag1); for (const a of weitere || []) if (a) dazu(a.id, a);
    // Zählen und Vergleich mit „_Ergebnisse.json“ über dieselben Proben wie ResultKit labelkitReport (Review 1.55.0): ohne stornierte,
    // ohne Bohrkern-Rückstellproben (nur gesägt und aufbewahrt, keine Analyse), ohne Nummer, bei doppelt vergebener Nummer die erste.
    // Die Kennung je Probe (von) bleibt genau LabelKits Regel; nur Zählen/Vergleich laufen über diese Zeilen.
    const gesehen = new Set(), aktiv = [];
    for (const p of alle){
      const n = nummer(p);
      if (p.storniert || !n || istRueckstellprobe(p) || gesehen.has(n)) continue;
      gesehen.add(n); aktiv.push(p);
    }
    const kennungJe = {}, neu = [];
    let mehrere = false;
    for (const p of aktiv){ const k = von(p); if (k){ mehrere = true; kennungJe['P' + nummer(p)] = k; } else neu.push(nummer(p)); }
    const auftraege = [...bekannt].sort((a, b) => auftragNr(a[0]) - auftragNr(b[0])).map(([id, o]) => {
      const eigene = aktiv.filter(p => von(p) === id), tage = eigene.map(p => datum(p.datum)).filter(Boolean).sort();
      const am = String(o.am == null ? '' : o.am).slice(0, 10);
      return { id, nr: auftragNr(id), am: ISO.test(am) ? am : '', von: typeof o.von === 'string' ? o.von : '', proben: eigene.map(nummer).filter(Boolean).sort((a, b) => a - b),
        probenahme: tage.length ? [tage[0], tage[tage.length - 1]] : [] };
    });
    return { auftraege, von, kennungJe, neu: neu.sort((a, b) => a - b), aufgebaut, mehrere };
  }
  /** „P1–P8, P14–P17“ (wie LabelKit nrListeText) */
  function nrListeText(nrs){
    const s = [...new Set((nrs || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b), teile = [];
    for (let i = 0; i < s.length;){ let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; teile.push(j > i ? 'P' + s[i] + '–P' + s[j] : 'P' + s[i]); i = j + 1; }
    return teile.join(', ');
  }

  const api = Object.freeze({ lesen, nrListeText, auftragNr });
  root.Laborauftraege = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
