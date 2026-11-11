/* Spektron Datenarchiv – reine Auswertung (kein Dateizugriff, keine Oberfläche; in Node geprüft: tests/archiv.cjs).
   Grundsätze:
   • Nichts wird erfunden: keine Grenz- oder Orientierungswerte, keine Schwellen für Quotienten.
   • Werte unter BG / n. n. sind nie null, sondern „unter BG“ und zählen bei Rangstatistiken als kleinste Werte.
   • Welcher Prüfbericht gilt, entscheidet die Regel von ResultKit 2.2 (Fassung -01/-02, nie das Dateidatum; zwei Berichte für
     dieselbe Probe und Berichte eines anderen Projekts zählen nicht). Vorläufige Werte ohne endgültigen sind gekennzeichnet
     und aus der Statistik ausgeschlossen.
   • Einheiten werden nicht umgerechnet: µg/m², µg/100 cm² und mg/kg bleiben getrennte Gruppen. */
(function(root){
  'use strict';
  const tidy = s => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const norm = s => tidy(s).toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu, '');
  const MIN_N = 5;

  /** Zahl wie in PlanKit (results.ts labNumber): streng, ohne Ländereinstellung; mehrdeutig (1.234) → NaN. */
  function zahl(raw){
    const t = String(raw ?? '').trim().replace(/−/g, '-');
    const m = t.match(/^([+-]?)([\d.,   ]+)([eE][+-]?\d+)?$/); if (!m) return NaN;
    let body = m[2].trim(); const exp = m[3] || '';
    if (/[   ]/.test(body)){
      if (!/^\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?$/.test(body)) return NaN;
      body = body.replace(/[   ]/g, '').replace(',', '.');
    } else if (body.includes('.') && body.includes(',')){
      const dec = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',', grp = dec === '.' ? ',' : '.';
      const parts = body.split(dec); if (parts.length !== 2 || !/^\d+$/.test(parts[1]) || !new RegExp('^\\d{1,3}(?:\\' + grp + '\\d{3})+$').test(parts[0])) return NaN;
      body = parts[0].split(grp).join('') + '.' + parts[1];
    } else if (/[.,]/.test(body)){
      const parts = body.split(/[.,]/);
      if (parts.length === 2){ if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || (parts[1].length === 3 && /^[1-9]\d{0,2}$/.test(parts[0]))) return NaN; body = parts.join('.'); }
      else { if (!/^\d{1,3}([.,])\d{3}(?:\1\d{3})+$/.test(body)) return NaN; body = parts.join(''); }
    }
    const v = Number(m[1] + body + exp); return Number.isFinite(v) ? v : NaN;
  }
  /** Ergebnis lesen: { q: 'gemessen' | 'unter' | 'nn' | 'nb' | 'unklar', v: Messwert bzw. Bestimmungsgrenze oder null }. */
  function ergebnis(raw, loq){
    let t = tidy(raw); if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim();
    const bg = () => { const v = zahl(loq); return Number.isFinite(v) && v >= 0 ? v : null; };
    if (/^unter\s+BG$/i.test(t)) return { q: 'unter', v: bg() };
    if (/^n\.\s*n\.$/i.test(t)) return { q: 'nn', v: bg() };
    if (/^n\.\s*b\.$/i.test(t)) return { q: 'nb', v: null };
    if (t.startsWith('<')){ const v = zahl(t.slice(1)); return Number.isFinite(v) && v >= 0 ? { q: 'unter', v } : { q: 'unklar', v: null }; }
    const v = zahl(t); return Number.isFinite(v) ? { q: 'gemessen', v } : { q: 'unklar', v: null };
  }
  /** Einheit vereinheitlichen, ohne umzurechnen (Leerzeichen, griechisches My, hochgestellte Zwei). */
  const einheit = u => tidy(u).replace(/μ/g, 'µ').replace(/\s*\/\s*/g, '/').replace(/m2\b/g, 'm²').replace(/cm2\b/g, 'cm²');

  /* 16 EPA-PAK in der üblichen Reihenfolge. Namen aus Eurofins-Berichten (deutsch) und englische Schreibweisen. */
  const PAK16 = [
    ['Nap', 'Naphthalin', ['naphthalin', 'naphthalen']], ['Acy', 'Acenaphthylen', ['acenaphthylen']], ['Ace', 'Acenaphthen', ['acenaphthen']],
    ['Flu', 'Fluoren', ['fluoren']], ['Phe', 'Phenanthren', ['phenanthren']], ['Ant', 'Anthracen', ['anthracen']],
    ['Flt', 'Fluoranthen', ['fluoranthen']], ['Pyr', 'Pyren', ['pyren']], ['BaA', 'Benzo[a]anthracen', ['benzaanthracen']],
    ['Chr', 'Chrysen', ['chrysen']], ['BbF', 'Benzo[b]fluoranthen', ['benzbfluoranthen', 'benzbjfluoranthen']], ['BkF', 'Benzo[k]fluoranthen', ['benzkfluoranthen']],
    ['BaP', 'Benzo[a]pyren', ['benzapyren']], ['IcdP', 'Indeno[1,2,3-cd]pyren', ['indeno123cdpyren']], ['DahA', 'Dibenz[a,h]anthracen', ['dibenzahanthracen']],
    ['BghiP', 'Benzo[ghi]perylen', ['benzghiperylen']]];
  const PAK_SCHLUESSEL = new Map(); PAK16.forEach(([, , ks], i) => ks.forEach(k => PAK_SCHLUESSEL.set(k, i)));
  /** Index 0–15 eines Einzel-PAK, sonst -1 (Summen, Methylnaphthaline usw.). */
  function pakIndex(name){
    const k = norm(name).replace(/e$/, '').replace(/^dibenzo/, 'dibenz').replace(/^benzo/, 'benz');
    return PAK_SCHLUESSEL.has(k) ? PAK_SCHLUESSEL.get(k) : -1;
  }
  /* Diagnostische Quotienten nach Yunker et al. (2002), Org. Geochem. 33, 489–515. Ohne Schwellen: Diese wurden überwiegend
     für Sedimente und Luft hergeleitet; die Übertragbarkeit auf Brandrückstände in Innenräumen ist offen. */
  const QUOTIENTEN = [['Flt/(Flt+Pyr)', 6, 7], ['BaA/(BaA+Chr)', 8, 9], ['IcdP/(IcdP+BghiP)', 13, 15], ['Ant/(Ant+Phe)', 5, 4]];
  const QUELLE = 'Yunker, M. B. et al. (2002): PAHs in the Fraser River basin: a critical appraisal of PAH ratios as indicators of PAH source and composition. Organic Geochemistry 33, 489–515.';

  /** Jahr aus dem Projektordner „26.0142 Ort“ → 2026; null ohne Nummer. */
  function projektKopf(name){
    const m = /^(\d{2})\.(\d{2,6})(?:[\s_-]+(.*))?$/.exec(tidy(name)); if (!m) return null;
    const yy = Number(m[1]), jetzt = new Date().getFullYear() % 100;
    return { nr: m[1] + '.' + m[2], jahr: (yy <= jetzt + 1 ? 2000 : 1900) + yy };
  }

  /* ---------- Welcher Prüfbericht gilt (ab 1.3, Audit o1) – Regel wie ResultKit 2.2 (src/ergebnisse.ts, dort gleich halten) ----------
     • Gleiche Berichtsnummer mehrfach abgelegt → Datei mit Messwerten, dann endgültig vor vorläufig, sonst die neuere Datei
       (nur hier zählt das Dateidatum).
     • Eurofins-Fassung = genau zwei Ziffern nach dem letzten Strich („AR-…-01“, „-02“). Je Probe/Parameter/Einheit innerhalb
       derselben Grundnummer: endgültig vor vorläufig, dann die höhere Fassung – nie das Dateidatum.
     • Verschiedene Grundnummern ersetzen einander nie: gleiche Probe/Parameter/Einheit in zwei Berichten = Konflikt, keiner zählt.
     • Auftragsreferenz nennt eine andere Projektnummer → der Bericht zählt nicht.
     Probe = Probennummer aus „Probe n“, sonst Probenreferenz, sonst Labornummer (wie ResultKit). */
  const kurz = s => tidy(s).toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu, '');
  /** „Probe 3“ / „P3“ / „26.0142-3“ → „P3“, sonst '' (ResultKit referenceLabel). */
  function probeLabel(ref){
    const s = tidy(ref), m = s.match(/^(?:Probe|P)\s*(\d+)$/i) || s.match(/^\d{2}\.\d{3,5}\s*-\s*(\d+)$/); if (!m) return '';
    const n = Number(m[1]); return Number.isSafeInteger(n) && n > 0 && n < 1e9 ? 'P' + n : '';
  }
  const probeKey = s => probeLabel(s.ref) || kurz(s.ref) || kurz(s.labNr);
  /* Einheit vereinheitlicht im Schlüssel (Codex P2 auf #80): „μg / m2“ und „µg/m²“ sind dieselbe Messung – sonst bliebe eine ältere
     Fassung neben der neueren stehen. ResultKit vergleicht hier tidy(u); bei Eurofins kommt beides nicht vor. */
  const wertKey = (s, w) => probeKey(s) + '\u0000' + tidy(w.p) + '\u0000' + einheit(w.u);
  /** Grundnummer und Fassung (ResultKit berichtsFassung; die Eurofins-XML ist immer Eurofins). */
  function berichtsFassung(bericht){
    const t = tidy(bericht).replace(/[‐-―−]/g, '-').replace(/\s+/g, '').toUpperCase(), m = /^(.*[^-])-(\d{2})$/.exec(t);
    return m ? { grund: m[1], fassung: Number(m[2]) } : { grund: t, fassung: null };
  }
  /** Projektnummer „26.0142“ aus einer Auftragsreferenz (wie ResultKit). */
  const projektnummer = s => (String(s || '').match(/\b\d{2}\.\d{3,6}\b/) || [''])[0];

  /** Ein Messwert wie in der Auswertung (probe = Labornummer, sonst Referenz – Schlüssel der Rollen-Korrekturen). */
  function messung(b, pr, w, key){
    const e = ergebnis(w.r, w.loq), bg = zahl(w.loq);
    return { key, probe: tidy(pr.labNr) || tidy(pr.ref), label: probeLabel(pr.ref), ref: tidy(pr.ref), desc: tidy(pr.desc), art: tidy(pr.art), datum: pr.datum || '', p: tidy(w.p), u: einheit(w.u),
      q: e.q, v: e.v, bg: Number.isFinite(bg) && bg >= 0 ? bg : null, roh: tidy(w.r), bericht: tidy(b.bericht), vorlaeufig: !!b.vorlaeufig };
  }
  const listeMessungen = werte => { const m = new Map(); for (const x of werte) m.set(x.probe + '\u0000' + x.p + '\u0000' + x.u, x); return [...m.values()]; };

  /** Prüfberichte eines Projekts zusammenführen.
      berichte: [{ datei, geaendert (ms), bericht, vorlaeufig, auftragsreferenz, proben: [{ labNr, ref, desc, art, datum, werte: [{ p, r, u, loq }] }] }]
      projektNr: „26.0142“ (aus dem Ordnernamen) – ohne Nummer keine Prüfung der Auftragsreferenz.
      → { werte: geltende Messwerte (Map key → Messung), konflikte: [{ berichte, proben, n }], fremd: [{ bericht, nr, ref, n }], ersetzt: [Berichtsnummern] } */
  function projektAuswerten(berichte, projektNr){
    const mitWerten = b => (b.proben || []).some(pr => (pr.werte || []).length), nachCode = new Map();
    for (const b of berichte || []){
      const k = tidy(b.bericht) ? 'b:' + kurz(b.bericht) : 'd:' + b.datei, alt = nachCode.get(k);
      if (!alt){ nachCode.set(k, b); continue; }
      const neuGilt = mitWerten(b) !== mitWerten(alt) ? mitWerten(b) : !b.vorlaeufig !== !alt.vorlaeufig ? !b.vorlaeufig : (b.geaendert || 0) >= (alt.geaendert || 0);
      if (neuGilt) nachCode.set(k, b);
    }
    const liste = [...nachCode.values()].map(b => ({ b, ...(tidy(b.bericht) ? berichtsFassung(b.bericht) : { grund: '?' + b.datei, fassung: null }) }));
    const fremd = [];
    for (const x of liste){ const nr = projektnummer(x.b.auftragsreferenz); if (projektNr && nr && nr !== projektNr){ x.fremd = nr;
      fremd.push({ bericht: tidy(x.b.bericht) || x.b.datei, nr, ref: tidy(x.b.auftragsreferenz), n: (x.b.proben || []).reduce((s, pr) => s + (pr.werte || []).length, 0) }); } }
    const besser = (a, b) => (a.b.vorlaeufig ? 0 : 1) - (b.b.vorlaeufig ? 0 : 1) || (a.fassung ?? -1) - (b.fassung ?? -1) || (a.b.geaendert || 0) - (b.b.geaendert || 0);
    const kandidaten = new Map();
    for (const x of liste) if (!x.fremd) for (const pr of x.b.proben || []) for (const w of pr.werte || []){
      const k = wertKey(pr, w), l = kandidaten.get(k) || []; l.push({ x, pr, w }); kandidaten.set(k, l); }
    const werte = new Map(), konfliktMap = new Map(), gilt = new Set();
    for (const [k, l] of kandidaten){
      const jeGrund = new Map();
      for (const c of l){ const g = (c.x.fassung === null ? 'ohne:' : 'mit:') + c.x.grund, alt = jeGrund.get(g); if (!alt || besser(c.x, alt.x) > 0) jeGrund.set(g, c); }
      const g = [...jeGrund.values()];
      if (g.length === 1){ const c = g[0]; werte.set(k, messung(c.x.b, c.pr, c.w, k)); gilt.add(c.x); continue; }
      const codes = g.map(c => tidy(c.x.b.bericht) || c.x.b.datei).sort((a, b) => a.localeCompare(b, 'de', { numeric: true })), id = codes.join('\u0000');
      const e = konfliktMap.get(id) || { berichte: codes, proben: [], n: 0, werte: [] }; const pk = k.split('\u0000')[0];
      if (!e.proben.includes(pk)) e.proben.push(pk); e.n += g.length; e.werte.push(...g.map(c => messung(c.x.b, c.pr, c.w, k))); konfliktMap.set(id, e);
    }
    const konflikte = [...konfliktMap.values()].map(k => ({ ...k, proben: k.proben.map(p => /^p\d+$/i.test(p) ? p.toUpperCase() : p).sort((a, b) => a.localeCompare(b, 'de', { numeric: true })) }));
    const ersetzt = liste.filter(x => !x.fremd && mitWerten(x.b) && !gilt.has(x) && !konflikte.some(k => k.berichte.includes(tidy(x.b.bericht) || x.b.datei))).map(x => tidy(x.b.bericht) || x.b.datei);
    return { werte, konflikte, fremd, ersetzt };
  }
  /** Geltende Messwerte (vorläufige ohne endgültigen bleiben, gekennzeichnet). Zwei Berichte für dieselbe Probe und Berichte eines
      anderen Projekts zählen nicht (siehe projektAuswerten). */
  const projektMessungen = (berichte, projektNr) => listeMessungen(projektAuswerten(berichte, projektNr).werte.values());

  /** Werte aus ResultKits „_Ergebnisse.json“ (berichte[].proben[].werte) als Map key → Messung. pdf: Bericht ohne XML (nur aus der PDF gelesen). */
  function ergebnisWerte(datei, projektNr){
    const m = new Map();
    for (const b of Array.isArray(datei && datei.berichte) ? datei.berichte : []) if (!(projektNr && projektnummer(b && b.auftragsreferenz) && projektnummer(b.auftragsreferenz) !== projektNr)) for (const pr of Array.isArray(b && b.proben) ? b.proben : [])
      for (const w of Array.isArray(pr && pr.werte) ? pr.werte : []){ if (!w || !tidy(w.p) || !tidy(w.r)) continue;
        const k = wertKey(pr, w); m.set(k, { ...messung(b, pr, w, k), pdf: !(b.sources && b.sources.xml), pdfName: (b.sources && b.sources.pdf) || '' }); }
    return m;
  }
  /** Zusammenführen mit der ResultKit-Übernahme (ab 1.3, Audit o1, Entscheidung Basti 11.11.2026).
      eigen = projektAuswerten(…); datei = gelesene _Ergebnisse.json oder null; aktuell = ihr Dateistand passt zum Ordner;
      pdfDa(name) = liegt diese PDF (Dateiname aus der Datei) noch in „Laborergebnisse“? projektNr: Werte eines Berichts, dessen
      Auftragsreferenz ein anderes Projekt nennt, zählen auch aus der Datei nie (Übernahme vor ResultKit 2.2).
      • Gleicher Schlüssel, anderer Wert → es zählt der Wert aus den Prüfberichten; der Unterschied wird genannt.
      • Nur in der Datei: zählt, wenn die Übernahme aktuell ist – oder der Wert aus einer PDF kam, die noch im Ordner liegt.
      • Nur in den Prüfberichten bei aktueller Übernahme: ResultKit hat ihn nicht übernommen (z. B. Probe in LabelKit storniert,
        XML in einem Unterordner) → zählt nicht, wird mitgezählt unter „nicht mitgezählt“.
      → { messungen, unterschiede: [{ probe, p, u, eigen: {roh, bericht}, resultkit: {roh, bericht} }], nichtUebernommen: [Messung], quelle } */
  function mitErgebnisDatei(eigen, datei, aktuell, pdfDa, projektNr){
    const werte = [...eigen.werte.values()];
    if (!datei) return { messungen: listeMessungen(werte), unterschiede: [], nichtUebernommen: [], quelle: 'pruefberichte' };
    const rk = ergebnisWerte(datei, projektNr), out = [], unterschiede = [], nichtUebernommen = [], strittig = new Set();
    for (const k of eigen.konflikte.flatMap(x => x.werte.map(w => w.key))) strittig.add(k);
    for (const x of werte){
      const r = rk.get(x.key);
      if (!r){ if (aktuell) nichtUebernommen.push(x); else out.push(x); continue; }
      if (r.roh !== x.roh || r.vorlaeufig !== x.vorlaeufig)   // gleicher Wert aus einer anderen Fassung: ändert nichts, kein Hinweis
        unterschiede.push({ probe: x.label || x.ref || x.probe, p: x.p, u: x.u, eigen: { roh: x.roh, bericht: x.bericht }, resultkit: { roh: r.roh, bericht: r.bericht } });
      out.push(x);
    }
    for (const [k, r] of rk){ if (eigen.werte.has(k) || strittig.has(k)) continue;
      if (aktuell || (r.pdf && r.pdfName && pdfDa && pdfDa(r.pdfName))) out.push(r); }
    return { messungen: listeMessungen(out), unterschiede, nichtUebernommen, quelle: aktuell ? 'resultkit' : 'pruefberichte' };
  }
  /** Für die Statistik nutzbar: endgültig und gemessen oder unter BG / n. n. */
  const zaehlt = x => !x.vorlaeufig && (x.q === 'gemessen' || x.q === 'unter' || x.q === 'nn');
  const unterBG = x => x.q === 'unter' || x.q === 'nn';

  /** Rangstatistik mit Werten unter BG als kleinste Werte. Quantil nach dem Rangverfahren (nearest rank);
      fällt es auf einen Wert unter BG, lautet das Ergebnis „unter BG“ statt einer erfundenen Zahl. */
  function statistik(liste){
    const xs = liste.filter(zaehlt), n = xs.length, gem = xs.filter(x => x.q === 'gemessen').map(x => x.v).sort((a, b) => a - b), nu = n - gem.length;
    const quantil = p => { if (!n) return null; const i = Math.max(0, Math.ceil(p * n) - 1); return i < nu ? { unter: true } : { wert: gem[i - nu] }; };
    return { n, gemessen: gem.length, unter: nu, genug: n >= MIN_N, median: n >= MIN_N ? quantil(0.5) : null, p90: n >= MIN_N ? quantil(0.9) : null,
      min: gem.length ? gem[0] : null, max: gem.length ? gem[gem.length - 1] : null };
  }
  /** Gruppenschlüssel Parameter|Einheit und Anzahl nutzbarer Werte, häufigste zuerst. */
  function parameterListe(messungen){
    const z = new Map();
    for (const x of messungen) if (zaehlt(x)){ const k = x.p + '|' + x.u; z.set(k, (z.get(k) || 0) + 1); }
    return [...z].map(([k, n]) => ({ key: k, p: k.slice(0, k.lastIndexOf('|')), u: k.slice(k.lastIndexOf('|') + 1), n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, 'de'));
  }

  /** PAK-Muster je Probe: Anteil jedes Einzel-PAK an der Summe der gemessenen Einzel-PAK (dimensionslos, je Einheit getrennt).
      anteile[i]: Zahl (Anteil), 0 mit unter[i] = true (unter BG), undefined (nicht bestimmt). k = Anzahl gemessener Einzel-PAK. */
  function profile(messungen){
    const proben = new Map();
    for (const x of messungen){
      if (!zaehlt(x)) continue; const i = pakIndex(x.p); if (i < 0) continue;
      const k = x.probe + '|' + x.u; if (!proben.has(k)) proben.set(k, { probe: x.probe, ref: x.ref, desc: x.desc, art: x.art, datum: x.datum, u: x.u, werte: new Array(16).fill(undefined), unter: new Array(16).fill(false) });
      const pr = proben.get(k); if (x.q === 'gemessen'){ pr.werte[i] = x.v; pr.unter[i] = false; } else if (pr.werte[i] === undefined){ pr.werte[i] = 0; pr.unter[i] = true; }
    }
    const out = [];
    for (const pr of proben.values()){
      const k = pr.werte.filter((v, i) => v !== undefined && !pr.unter[i]).length, summe = pr.werte.reduce((s, v, i) => s + (v !== undefined && !pr.unter[i] ? v : 0), 0);
      if (!k || !(summe > 0)) continue;
      out.push({ ...pr, k, summe, anteile: pr.werte.map((v, i) => v === undefined ? undefined : pr.unter[i] ? 0 : v / summe),
        quotienten: QUOTIENTEN.map(([, a, b]) => !pr.unter[a] && !pr.unter[b] && pr.werte[a] !== undefined && pr.werte[b] !== undefined && pr.werte[a] + pr.werte[b] > 0 ? pr.werte[a] / (pr.werte[a] + pr.werte[b]) : null) });
    }
    return out;
  }
  /** Mittleres Muster einer Vergleichsgruppe: Median der Anteile je Einzel-PAK (unter BG = 0, nicht bestimmt = ausgelassen). */
  function medianProfil(liste){
    if (liste.length < MIN_N) return null;
    return PAK16.map((_, i) => { const xs = liste.map(p => p.anteile[i]).filter(v => v !== undefined).sort((a, b) => a - b); if (xs.length < MIN_N) return undefined;
      const h = xs.length >> 1; return xs.length % 2 ? xs[h] : (xs[h - 1] + xs[h]) / 2; });
  }

  /* ---------- Rolle einer Probe (Konvention, nachträglich änderbar) ----------
     Gelesen aus Probenbezeichnung und Probenbeschreibung. Reihenfolge: Freimessung vor Referenz vor Verdachtsquelle vor Brandbereich.
     Konvention des Handbuchs: „F-“ vor der alten ID = Freimessung, „REF“ = Referenz aus unbelasteter Stelle. Nichts erkannt → keine Rolle. */
  const ROLLEN = [['brand', 'Brandbereich'], ['betroffen', 'betroffener Bereich'], ['referenz', 'Referenz (unbelastet)'], ['quelle', 'Verdachtsquelle (z. B. Kleber)'], ['frei', 'Freimessung nach Sanierung']];
  const ROLLE_NAME = Object.fromEntries(ROLLEN);
  const istFrei = id => /^F[-_ ]/i.test(tidy(id));
  function rolleAuto(ref, desc){
    const t = (tidy(ref) + ' | ' + tidy(desc)).toLocaleLowerCase('de');
    if (istFrei(ref) || istFrei(desc) || /freimessung|sanierungskontrolle|nach (der )?sanierung/.test(t)) return 'frei';
    if (/(^|[^a-zäöüß])ref([^a-zäöüß]|$)|referenz|unbelastet|nullprobe|hintergrund/.test(t)) return 'referenz';
    if (/kleber|teer|bitumen|dachpappe|schwarzanstrich/.test(t)) return 'quelle';
    if (/brandraum|brandbereich|brandherd|brandstelle|brandausbruch/.test(t)) return 'brand';
    return '';
  }
  /** Zur Freimessung „F-EG-WZ-B-7-T1“ gehört „EG-WZ-B-7-T1“: ID ohne das F-Präfix (gleich verglichen, ohne Groß/klein). */
  const freiBasis = id => istFrei(id) ? norm(tidy(id).replace(/^F[-_ ]/i, '')) : '';

  /** Kalendertag in Berlin aus einem Zeitstempel des Labors (2026-10-07T22:00:00Z → 2026-10-08) oder JJJJ-MM-TT. */
  function berlinTag(wert){
    const v = tidy(wert); if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v); if (!/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(d.getTime())) return '';
    const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d), g = k => t.find(x => x.type === k).value;
    return `${g('year')}-${g('month')}-${g('day')}`;
  }
  /** Tage zwischen Schadendatum und Probenahme; null, wenn eines fehlt oder die Probe vor dem Schaden liegt. */
  function tageNachBrand(schaden, probe){
    if (!/^\d{4}-\d{2}-\d{2}$/.test(schaden || '') || !/^\d{4}-\d{2}-\d{2}$/.test(probe || '')) return null;
    const t = Math.round((Date.parse(probe + 'T12:00:00Z') - Date.parse(schaden + 'T12:00:00Z')) / 864e5);
    return t >= 0 ? t : null;
  }
  /* Nur zum Gruppieren in der Anzeige, keine Bewertung. */
  const TAGE_KLASSEN = [[7, '0–7 Tage'], [30, '8–30 Tage'], [90, '31–90 Tage'], [Infinity, 'über 90 Tage']];
  const tageKlasse = t => t == null ? 'Datum unbekannt' : TAGE_KLASSEN.find(([g]) => t <= g)[1];

  /** Einzel-PAK, die in allen Proben über BG gemessen sind (Indizes 0–15). */
  const gemeinsam = profile => PAK16.map((_, i) => i).filter(i => profile.length && profile.every(p => p.werte[i] !== undefined && !p.unter[i] && p.werte[i] > 0));
  /** Anteile einer Probe, normiert nur über die gemeinsame Stoffmenge; null, wenn ein Stoff der Menge fehlt oder unter BG ist. */
  function aufMenge(p, menge){
    if (!menge.length || menge.some(i => p.werte[i] === undefined || p.unter[i] || !(p.werte[i] > 0))) return null;
    const s = menge.reduce((a, i) => a + p.werte[i], 0); return menge.map(i => p.werte[i] / s);
  }
  /** Kosinus-Ähnlichkeit zweier Anteilsvektoren (1 = gleiches Muster). Stützt nur – ein deutlicher Unterschied sagt mehr als hohe Ähnlichkeit. */
  function kosinus(a, b){ let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++){ ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; } return aa && bb ? ab / Math.sqrt(aa * bb) : null; }
  /** Median je Stelle über mehrere Vektoren gleicher Länge (ab MIN_N Vektoren). */
  function medianVektor(vs){
    if (vs.length < MIN_N) return null;
    return vs[0].map((_, i) => { const xs = vs.map(v => v[i]).sort((a, b) => a - b), h = xs.length >> 1; return xs.length % 2 ? xs[h] : (xs[h - 1] + xs[h]) / 2; });
  }


  /** Dateistand wie ResultKit (standKennung): „Name|Größe|Zeit“ je Datei, nach Namen sortiert. */
  const standKennung = dateien => [...dateien].sort((a, b) => a.name.localeCompare(b.name)).map(d => `${d.name}|${d.size}|${d.t}`).join('\n');
  /** Rollenwahl aus BerichtKits „_BerichtKit.json“ (form.brand.rolle[Label] = { auto, wahl }, Audit M4/o6) – nur gültige Einträge. */
  function berichtkitRollen(o){
    if (!o || !o.form || !o.form.brand || typeof o.form.brand !== 'object') return null;   // kein Brandbericht: BerichtKit nimmt keine Rollen an
    const r = typeof o.form.brand.rolle === 'object' && o.form.brand.rolle ? o.form.brand.rolle : {}, out = {};
    for (const [k, v] of Object.entries(r)) if (/^P\d+$/.test(k) && v && ['frei', 'referenz'].includes(v.auto) && ['ok', 'keine'].includes(v.wahl)) out[k] = { auto: v.auto, wahl: v.wahl };
    return out;
  }
  /** Rolle einer Probe im Datenarchiv (ab 1.3): eigene Korrektur hier → „Normale Probe“ aus BerichtKit (nur solange die Regel dieselbe
      Rolle annimmt wie damals in BerichtKit) → Konvention aus dem Namen. → { rolle, auto, bk: 'keine'|'ok'|'', korrektur } */
  function rolleWirksam(x, korrektur, bkRollen){
    const auto = rolleAuto(x.ref, x.desc), w = bkRollen && bkRollen[probeLabel(x.ref)], bk = w && w.auto === auto ? w.wahl : '';
    if (korrektur) return { rolle: korrektur === 'keine' ? '' : korrektur, auto, bk, korrektur };
    return { rolle: bk === 'keine' ? '' : auto, auto, bk, korrektur: '' };
  }
  /** Sicht von BerichtKit (Brandbericht) auf eine Probe: nur Freimessung, Referenz oder normal. */
  const bkSicht = rolle => rolle === 'frei' || rolle === 'referenz' ? rolle : 'normal';

  /** Semikolon-CSV mit Dezimalkomma für Excel. Keine Ortsangaben, keine Probenbeschreibung – nur Projektnummer. */
  function csv(zeilen){
    const zelle = v => { const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const kopf = ['Projekt', 'Jahr', 'Nutzung', 'Brandgut', 'Probe', 'Rolle', 'Tage nach Brand', 'Matrix', 'Parameter', 'Einheit', 'Ergebnis', 'Wert', 'unter BG', 'BG', 'Prüfbericht', 'vorläufig'];
    const q = { gemessen: 'gemessen', unter: '< BG', nn: 'n. n.', nb: 'n. b.', unklar: 'unklar' };
    return '﻿' + [kopf, ...zeilen.map(x => [x.nr, x.jahr, x.nutzung, x.brandgut, x.probe, x.rolle ? ROLLE_NAME[x.rolle] : '', x.tage, x.art, x.p, x.u, x.roh, x.v, unterBG(x) ? q[x.q] : '', x.bg, x.bericht, x.vorlaeufig ? 'ja' : ''])]
      .map(r => r.map(zelle).join(';')).join('\r\n') + '\r\n';
  }

  const api = Object.freeze({ zahl, ergebnis, einheit, PAK16, pakIndex, QUOTIENTEN, QUELLE, MIN_N, projektKopf, projektMessungen, projektAuswerten, ergebnisWerte, mitErgebnisDatei, berichtsFassung, probeLabel, zaehlt, unterBG, statistik, parameterListe, profile, medianProfil, csv, norm, tidy,
    ROLLEN, ROLLE_NAME, rolleAuto, rolleWirksam, bkSicht, berichtkitRollen, standKennung, freiBasis, berlinTag, tageNachBrand, tageKlasse, gemeinsam, aufMenge, kosinus, medianVektor });
  root.ArchivAuswertung = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
