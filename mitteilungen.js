/* Spektron – Mitteilungen eines Projekts als Ebene (_Projekt.json → weitereMitteilungen), nur rechnen (kein Lesen, kein Schreiben).
   Grundlage: claude/projektzentrale-mitteilungen-plan.md (Abschnitte 3, 4, 7) und spektron-mitteilungen-ebene-plan.md (M1–M18).
   - Ein Projekt mit einer Mitteilung hat kein Feld. Erst beim Anlegen der 2. Mitteilung wird der Bezug BEIDER aufgeschrieben
     (Entscheidung 1, 2): weitereMitteilungen: [{ id: "m1", nr: 1, termine: ["t1"], auftraege: [], angelegt, von },
     { id: "m2", nr: 2, termine: ["t2"], auftraege: [], anlass?, angelegt, von, anlagenDazu?: [Pfad], anlagenWeg?: [Pfad] }].
   - Kennungen werden nie neu vergeben (O13 sinngemäß): Zähler „mitteilungZaehler“ = höchste je vergebene Nummer, im selben Patch
     wie die Liste, sinkt nie, bleibt auch, wenn die Liste wieder wegfällt. Kennung (m2) und Nummer (2) sind getrennt: die Nummer
     folgt den Dateinamen (Entscheidung 6: höchste aus Dateinamen und Einträgen + 1).
   - Der Zustand wird gerechnet, nie gespeichert: in Arbeit (keine Word-Datei) · Entwurf (Word-Datei, keine Büroaufgabe nennt
     sie) · beim Büro (neueste nicht zurückgezogene Gutachten-Aufgabe nennt sie, nicht erledigt) · versandt am (dieselbe erledigt).
     Büroaufgabe ↔ Mitteilung nur über den Word-Pfad (Entscheidung 3): die Nummer vorn im Dateinamen.
   - Anlagen-Liste je Mitteilung (M15–M18): Vorschlag wird gerechnet (BerichtKit-Eintrag zur Word-Datei, sonst aus dem Bezug),
     gespeichert wird nur, was von Hand abweicht (anlagenDazu/anlagenWeg). Fest wird die Liste mit der Übergabe – in der
     Büroaufgabe (anlagen, einmal geschrieben). Nummern nach der Hausreihenfolge aus BerichtKits anlagen.js (Entscheidung 8).
   Unbekannte Felder in Einträgen bleiben erhalten. Byte-gleich später nach BerichtKit (Stufe 4). */
(function(root){
  'use strict';
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const KENNUNG = /^m(\d+)$/;
  const TERMIN = /^t(\d+)$/;
  /** Gleich wie Stufen.MITTEILUNG und WordWahl.MITTEILUNG (Test vergleicht). */
  const MITTEILUNG = /^\d+[._\s]*Mitteilung(?![a-zäöüß]).*\.docx$/i;
  const BILDDOKU = /^Bilddokumentation(?![a-zäöüß]).*\.pdf$|[_ ]Bilddokumentation(?:[_ -]+Teil[_ ]\d+[_ ]von[_ ]\d+)?\.pdf$/i;   // wie anlagen.js
  const WORD_ANLAGE = { probenahme: /_Probenahme_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i, raumbuch: /_Raumbuch_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i, wandansichten: /_Wandansichten_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i };
  const text = v => typeof v === 'string' ? v : v == null ? '' : String(v);
  const nfc = v => text(v).normalize('NFC');
  const key = v => nfc(v).toLowerCase();
  const base = v => text(v).split(/[\\/]/).pop();
  const nummer = id => { const m = KENNUNG.exec(text(id)); return m ? +m[1] : 0; };
  const pad = n => String(n).padStart(2, '0');
  /** Tag (JJJJ-MM-TT, Ortszeit) aus Millisekunden, ISO-Zeit oder ISO-Datum; '' wenn nicht lesbar. */
  function tag(x){
    if (typeof x === 'string' && ISO.test(x)) return x;
    if (x == null || x === '' || x === 0) return '';
    const d = new Date(x); if (!Number.isFinite(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const de = iso => ISO.test(iso || '') ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : '';
  const deLang = iso => ISO.test(iso || '') ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '';
  const gueltig = s => { if (typeof s !== 'string' || !ISO.test(s)) return false; const d = new Date(s + 'T12:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s; };

  /** Nummer einer Mitteilung aus dem Dateinamen („2._Mitteilung_26.0999.docx“ → 2); 0, wenn der Name keine Mitteilung ist. */
  function nrAusName(name){ const n = base(name); return MITTEILUNG.test(n) ? +(/^\d+/.exec(n)[0]) : 0; }

  /* ---------- Datensatz ---------- */
  /** Einträge mit gültiger Kennung und Nummer (andere bleiben in der Datei, werden aber nicht gezeigt). */
  function eintraege(pj){
    const l = pj && Array.isArray(pj.weitereMitteilungen) ? pj.weitereMitteilungen : [];
    return l.filter(e => e && typeof e === 'object' && !Array.isArray(e) && nummer(e.id) >= 1 && Number.isInteger(e.nr) && e.nr >= 1);
  }
  /** Zähler (ganze Zahl ≥ 1) oder null. */
  function zaehler(pj){ const z = pj ? pj.mitteilungZaehler : null; return typeof z === 'number' && Number.isInteger(z) && z >= 1 ? z : null; }
  /** Nächste Kennung: Zähler + 1; ohne Zähler höchste Kennung in der Liste + 1 (m1 gilt immer als vergeben). Nie unter einer
      Kennung, die schon in der Liste steht (falls ein Schreiber ohne Zähler darüber liegt), und nie unter auchDiese. */
  function naechsteKennung(pj, auchDiese = []){
    const n = [1, zaehler(pj) || 0];
    for (const e of (pj && Array.isArray(pj.weitereMitteilungen) ? pj.weitereMitteilungen : [])) if (e) n.push(nummer(e.id));
    for (const id of auchDiese) n.push(nummer(id));
    return 'm' + (Math.max(...n) + 1);
  }
  /** Zählerstand nach dem Vergeben dieser Kennungen: nie kleiner als vorher. */
  const zaehlerNach = (pj, ...ids) => Math.max(zaehler(pj) || 0, ...ids.map(nummer));
  /** Nummer für eine neue Mitteilung (Entscheidung 6): höchste aus Dateinamen in „Mitteilungen“ und Einträgen + 1; die
      1. Mitteilung zählt immer (auch ohne Datei), die neue ist also mindestens die 2. */
  function naechsteNr(word, pj){
    const n = [1, ...(word || []).map(w => nrAusName(w && w.name)), ...eintraege(pj).map(e => e.nr)];
    return Math.max(...n) + 1;
  }
  /** Zum Speichern: Texte getrimmt, Listen ohne leere/doppelte Werte, alles andere unverändert; leere Liste → null (Feld weg). */
  function bereinigt(l){
    const liste = v => { const s = new Set(), out = []; for (const x of v) { const t = text(x).trim(); if (t && !s.has(key(t))) { s.add(key(t)); out.push(t); } } return out; };
    const out = (Array.isArray(l) ? l : []).map(e => {
      if (!e || typeof e !== 'object' || Array.isArray(e)) return e;
      const o = { ...e };
      for (const k of ['id', 'anlass', 'von']) if (typeof o[k] === 'string') o[k] = o[k].trim();
      for (const k of ['termine', 'anlagenDazu', 'anlagenWeg']) if (Array.isArray(o[k])) o[k] = liste(o[k]);
      for (const k of ['anlagenDazu', 'anlagenWeg']) if (Array.isArray(o[k]) && !o[k].length) delete o[k];
      return o;
    });
    return out.length ? out : null;
  }

  /* ---------- Termine (aus _Projekt.json, wie ortstermine.js) ---------- */
  function termine(pj){
    const t = [{ id: 't1', datum: pj && gueltig(pj.ortstermin) ? pj.ortstermin : '', bezeichnung: text(pj && pj.ortsterminBezeichnung).trim() }];
    for (const e of (pj && Array.isArray(pj.weitereOrtstermine) ? pj.weitereOrtstermine : []))
      if (e && typeof e === 'object' && (TERMIN.exec(text(e.id)) || [])[1] >= 2) t.push({ id: e.id, datum: gueltig(text(e.datum)) ? e.datum : '', bezeichnung: text(e.bezeichnung).trim() });
    return t;
  }
  /** „20.08. (Nachbeprobung)“ – für Bezug und Rückfragen; entfernter Termin: „t3 (entfernt)“. */
  function terminText(t, kurz){
    if (!t) return '';
    if (t.entfernt) return `${t.id} (entfernt)`;
    const d = t.datum ? (kurz ? de(t.datum) : deLang(t.datum)) : 'ohne Datum';
    return t.bezeichnung ? `${d} (${t.bezeichnung})` : d;
  }

  /* ---------- Liste der Mitteilungen mit Zustand ---------- */
  /** pj: Projektdaten; word: [{ name, rel, t }] Word-Dateien in „Mitteilungen“; aufgaben: BueroAufgaben.projektLesen().aufgaben;
      o.versandt: frühere Versandangabe (#vtBox, JJJJ-MM-TT) – nur, wenn keine Büroaufgabe die Mitteilung nennt (ungefähr, wie
      Stufen.mitteilungUebergeben: Versand am Tag der Datei oder später).
      → { mitteilungen: [{ id, nr, schluessel, eintrag, datei, dateien, aufgabe, aufgaben, jeUebergeben, zustand, versandtAm,
            uebergebenAm, quelle, fest, mehrdeutig }], mehrere, bestand, ohneWord: [Aufgaben], fremd: [Aufgaben] } */
  function liste(pj, word, aufgaben, o = {}){
    const ein = eintraege(pj), jeNr = new Map();
    for (const e of ein) if (!jeNr.has(e.nr)) jeNr.set(e.nr, e);
    const dateien = new Map();
    for (const w of word || []){ const n = nrAusName(w && w.name); if (n){ if (!dateien.has(n)) dateien.set(n, []); dateien.get(n).push(w); } }
    for (const l of dateien.values()) l.sort((a, b) => (+b.t || 0) - (+a.t || 0) || text(b.name).localeCompare(text(a.name), 'de', { numeric: true }));
    const g = (aufgaben || []).filter(a => a && a.art === 'gutachten'), jeAufgabe = new Map(), ohneWord = [], fremd = [];
    for (const a of g){
      if (!text(a.word).trim()){ if (!a.geloescht) ohneWord.push(a); continue; }
      const n = nrAusName(a.word);
      if (!n){ if (!a.geloescht) fremd.push(a); continue; }
      if (!jeAufgabe.has(n)) jeAufgabe.set(n, []); jeAufgabe.get(n).push(a);
    }
    const nrn = [...new Set([...jeNr.keys(), ...dateien.keys(), ...jeAufgabe.keys()])].sort((a, b) => a - b);
    const m = nrn.map(nr => {
      const eintrag = jeNr.get(nr) || null, dl = dateien.get(nr) || [], al = (jeAufgabe.get(nr) || []).slice().sort((a, b) => text(a.erstellt).localeCompare(text(b.erstellt)));
      const aufgabe = al.filter(a => !a.geloescht).pop() || null, datei = dl[0] || null;
      let zustand = aufgabe ? (aufgabe.erledigt ? 'versandt' : 'buero') : datei ? 'entwurf' : 'arbeit', versandtAm = aufgabe && aufgabe.erledigt ? tag(aufgabe.erledigtAm) : '', quelle = aufgabe ? 'buero' : '';
      if (!aufgabe && datei && ISO.test(o.versandt || '') && o.versandt >= tag(datei.t)){ zustand = 'versandt'; versandtAm = o.versandt; quelle = 'verteiler'; }
      return { id: eintrag ? eintrag.id : '', nr, schluessel: eintrag ? eintrag.id : 'nr' + nr, eintrag, datei, dateien: dl, aufgabe, aufgaben: al, jeUebergeben: al.length > 0,
        zustand, versandtAm, uebergebenAm: aufgabe ? tag(aufgabe.erstellt) : '', quelle, fest: !!aufgabe || quelle === 'verteiler', mehrdeutig: dl.length > 1 };
    });
    return { mitteilungen: m, mehrere: m.length > 1, bestand: m.length > 1 && !ein.length, ohneWord, fremd };
  }
  const ZUSTAND = { arbeit: 'in Arbeit', entwurf: 'Entwurf', buero: 'beim Büro', versandt: 'versandt' };
  /** „versandt 15.08.“, „beim Büro“, „Entwurf“, „in Arbeit“ */
  const zustandText = m => m.zustand === 'versandt' ? `versandt${m.versandtAm ? ' ' + de(m.versandtAm) : ''}` : ZUSTAND[m.zustand] || '';
  /** Darf die Mitteilung entfernt werden? Nur mit Eintrag, ohne Word-Datei und nie übergeben (Entscheidung 11). */
  const entfernbar = m => !!m && !!m.eintrag && !m.datei && !m.jeUebergeben && m.zustand === 'arbeit';
  /** Vorwahl in der Zeile: gemerkte Wahl (Kennung oder „nr<n>“), sonst die neueste nicht versandte, sonst die neueste. */
  function vorwahl(l, gemerkt){
    const m = (l && l.mitteilungen) || [];
    return m.find(x => gemerkt && x.schluessel === gemerkt) || m.filter(x => x.zustand !== 'versandt').pop() || m[m.length - 1] || null;
  }

  /* ---------- Grenze und Vorwahl beim Anlegen (Abschnitt 3) ---------- */
  /** Ende einer Mitteilung für die Vorwahl: Übergabe (erste nicht zurückgezogene Büroaufgabe), sonst Versand laut früheren
      Versandangaben, sonst Dateizeit der Word-Datei; ohne alles null. → { datum, quelle, text } | null */
  function ende(m, o = {}){
    if (!m) return null;
    const a = (m.aufgaben || []).filter(x => !x.geloescht)[0];
    if (a && tag(a.erstellt)) return { datum: tag(a.erstellt), quelle: 'uebergabe', text: `nach der Übergabe am ${de(tag(a.erstellt))}` };
    if (m.quelle === 'verteiler' && m.versandtAm) return { datum: m.versandtAm, quelle: 'versand', text: `nach dem Versand am ${de(m.versandtAm)} (frühere Versandangaben)` };
    if (!m.aufgaben.length && ISO.test(o.versandt || '') && m.datei && o.versandt >= tag(m.datei.t)) return { datum: o.versandt, quelle: 'versand', text: `nach dem Versand am ${de(o.versandt)} (frühere Versandangaben)` };
    if (m.datei && tag(m.datei.t)) return { datum: tag(m.datei.t), quelle: 'datei', text: `nach dem letzten Speichern der Word-Datei am ${de(tag(m.datei.t))}` };
    return null;
  }
  /** Grenze für die 1. Mitteilung (3.2). */
  const grenze = (l, o) => ende(((l && l.mitteilungen) || [])[0], o);
  /** Vorwahl der Termine je Spalte. spalten: [{ schluessel, eintrag?, m? }] in Nummernfolge (bestehende Mitteilungen, dann
      die neue). Bestehende Einträge behalten ihre Termine (nicht neu gerechnet). Termine, die in keinem Eintrag stehen, gehen
      bei Spalten ohne Eintrag nach dem Datum: zur ersten Mitteilung, deren Ende am Termintag oder später liegt (ohne Ende:
      offen); hat die erste Mitteilung kein Ende, geht nur der neueste Termin an die letzte Spalte (3.2). Gibt es schon Einträge,
      bekommt die neue Spalte alles, was in keinem Eintrag steht (M6, Regel 3.3). → { <schluessel>: [Termin-Kennungen] } */
  function vorwahlTermine(pj, spalten, o = {}){
    const t = termine(pj), out = {};
    const inEintrag = new Set(); for (const s of spalten) if (s.eintrag && Array.isArray(s.eintrag.termine)) s.eintrag.termine.forEach(x => inEintrag.add(text(x)));
    for (const s of spalten) out[s.schluessel] = s.eintrag && Array.isArray(s.eintrag.termine) ? s.eintrag.termine.map(text).filter(x => t.some(y => y.id === x)) : [];
    const frei = t.filter(x => !inEintrag.has(x.id)), offen = spalten.filter(s => !s.eintrag);
    if (!frei.length || !offen.length) return out;
    if (spalten.some(s => s.eintrag)){ out[offen[offen.length - 1].schluessel].push(...frei.map(x => x.id)); return out; }
    const enden = offen.map(s => ende(s.m, o));
    if (!enden[0] && frei.length > 1 && offen.length > 1){
      const neu = frei.filter(x => x.datum).sort((a, b) => a.datum.localeCompare(b.datum)).pop() || frei[frei.length - 1];
      for (const x of frei) out[(x === neu ? offen[offen.length - 1] : offen[0]).schluessel].push(x.id);
      return out;
    }
    for (const x of frei){
      const i = x.datum ? enden.findIndex(e => !e || x.datum <= e.datum) : 0;
      out[offen[i < 0 ? offen.length - 1 : i].schluessel].push(x.id);
    }
    return out;
  }

  /* ---------- Anlagen ---------- */
  /** Art einer Anlage nach Ordner und Name (wie BerichtKit sie erkennt). */
  function artVon(pfad){
    const p = nfc(pfad), ordner = key(p.split('/')[0]), n = base(p);
    if (ordner === 'laborergebnisse' && /\.pdf$/i.test(n)) return 'pruefbericht';
    if (ordner === 'fotos' && BILDDOKU.test(n)) return 'bilddoku';
    if ((ordner === 'pläne' || ordner === 'plaene') && /^Probenplan\b.*\.pdf$/i.test(n)) return / - Ergebniskarte(?: \(\d+\))?\.pdf$/i.test(n) ? 'ergebniskarte' : 'probenplan';
    if (ordner === 'mitteilungen') for (const [a, re] of Object.entries(WORD_ANLAGE)) if (re.test(n)) return a;
    return 'sonstiges';
  }
  const titelVon = (A, art) => (A && A.ARTEN && A.ARTEN[art] ? A.ARTEN[art].titel : 'Anlage');
  /** Zeilen nach der Hausreihenfolge nummerieren – mit BerichtKits zusammenstellen() (anlagen.js), damit beide Apps dieselben
      Nummern rechnen: Prüfberichte (je eine Nummer, in der gegebenen Reihenfolge) → Bilddokumentation → Probenplan → optionale
      Arten → Weiteres. Mehrere Dateien derselben Art (Bilddoku je Termin, Plan je Geschoss) sind eine Anlage. Zeilen ohne Datei
      bekommen keine Nummer. o.ohnePruefbericht: kein Platzhalter „Prüfbericht folgt“. → Zeilen mit nr (null = keine Nummer) */
  function nummerieren(zeilen, A, o = {}){
    const z = zeilen.map(x => ({ ...x, nr: null }));
    // ohne anlagen.js (z. B. veralteter Zwischenspeicher): fortlaufend in der gegebenen Folge – nie still eine Anlage verlieren
    if (!A || typeof A.zusammenstellen !== 'function'){ let n = 0; for (const x of z) if (x.dateien && x.dateien.length) x.nr = ++n; return z; }
    const mitDatei = z.filter(x => x.dateien && x.dateien.length);
    const pruef = mitDatei.filter(x => x.art === 'pruefbericht'), gefunden = {}, wahl = {}, extra = [];
    const profil = A.PROFILE.asbest, arten = [...profil.fest, ...profil.optional];
    for (const art of arten){
      const r = mitDatei.filter(x => x.art === art); if (!r.length) continue;
      const dateien = r.flatMap(x => x.dateien);
      gefunden[art] = { art, dateien, t: 0, key: 'pz', veraltet: false, grund: '', unvollstaendig: false, nrImDokument: 0, nrQuelle: '', details: '' };
      wahl[art] = { an: true, key: 'pz' };
    }
    for (const x of mitDatei) if (x.art !== 'pruefbericht' && !arten.includes(x.art)) extra.push({ pfad: x.dateien[0], bezeichnung: x.titel || '' });
    const erg = A.zusammenstellen({ profil: 'asbest', pruefberichte: pruef.map(x => ({ nr: x.titel || '', pdf: x.dateien[0] })), gefunden, wahl, extra,
      ohnePruefbericht: !!o.ohnePruefbericht, ohneEigeneProbenahme: true });
    for (const a of erg.liste){
      if (a.art === 'pruefbericht' && !a.dateien.length){   // Platzhalter „Prüfbericht folgt“ – wie im Bericht Anlage 1, gelb
        const x = z.find(y => y.art === 'pruefbericht' && !(y.dateien && y.dateien.length) && y.nr == null);
        if (x) x.nr = a.nr; else z.unshift({ art: 'pruefbericht', titel: 'Prüfbericht', dateien: [], herkunft: 'fehlt', herkunftText: '', fehlt: true, grund: 'kein Prüfbericht zugeordnet', veraltet: null, termin: '', nr: a.nr });
      }
      else if (a.art === 'pruefbericht'){ const x = pruef.find(y => y.dateien[0] === a.dateien[0] && y.nr == null); if (x) x.nr = a.nr; }
      else if (a.art === 'sonstiges'){ const x = mitDatei.find(y => !arten.includes(y.art) && y.art !== 'pruefbericht' && y.dateien[0] === a.dateien[0] && y.nr == null); if (x) x.nr = a.nr; }
      else mitDatei.filter(y => y.art === a.art).forEach(y => { y.nr = a.nr; });
    }
    // in Nummernfolge; Zeilen ohne Nummer (fehlt) hinter den Zeilen ihrer Art (Hausreihenfolge)
    const ORD = ['pruefbericht', ...arten, 'sonstiges'], rang = a => { const i = ORD.indexOf(a); return i < 0 ? ORD.length - 1 : i; };
    return z.map((x, i) => [x, i]).sort((a, b) => rang(a[0].art) - rang(b[0].art) || (a[0].nr == null ? 1e9 : a[0].nr) - (b[0].nr == null ? 1e9 : b[0].nr) || a[1] - b[1]).map(a => a[0]);
  }
  /** Pfade in Nummernfolge (Übergabe ans Büro, auch bei einer Mitteilung – Entscheidung 7). Jeder Pfad genau einmal; was keine
      Anlage im Sinne von anlagen.js ist, kommt als „Weiteres“ in der gegebenen Reihenfolge ans Ende. reihe: Pfade in der
      Reihenfolge des Berichts (berichte[].anlagen), falls bekannt – bestimmt die Folge der Prüfberichte. */
  function sortiert(pfade, A, reihe){
    const r = (reihe || []).map(key), pos = p => { const i = r.indexOf(key(p)); return i < 0 ? 1e6 : i; };
    const gesehen = new Set(), liste = [];
    for (const p of pfade || []) { const t = text(p); if (t && !gesehen.has(key(t))) { gesehen.add(key(t)); liste.push(t); } }
    const geordnet = liste.map((p, i) => [p, i]).sort((a, b) => artVon(a[0]) === 'pruefbericht' && artVon(b[0]) === 'pruefbericht' ? pos(a[0]) - pos(b[0]) || a[1] - b[1] : a[1] - b[1]).map(a => a[0]);
    const z = nummerieren(geordnet.map(p => ({ art: artVon(p), titel: base(p).replace(/\.[^.]+$/, ''), dateien: [p] })), A, { ohnePruefbericht: true });
    const out = z.filter(x => x.nr != null).flatMap(x => x.dateien);
    for (const p of liste) if (!out.some(x => key(x) === key(p))) out.push(p);
    return out;
  }

  /** Bilddoku eines Termins: FotoKit 2.7.0 bilddokus[t] → bei Termin 1 ohne bilddokus die gemerkte bilddoku → PDF mit dem
      Termindatum im Namen (O4). → { dateien: ['Fotos/…'], quelle: 'fotokit'|'name', veraltet } | null */
  function bilddokuFuer(t, e, A){
    const fotos = (e && e.fotos) || [], fk = e && e.fk && typeof e.fk === 'object' ? e.fk : null;
    const da = new Map(fotos.map(f => [key(f.name), f]));
    const vermerk = fk && fk.bilddokus && typeof fk.bilddokus === 'object' && fk.bilddokus[t.id] ? fk.bilddokus[t.id]
      : fk && t.id === 't1' && !fk.bilddokus && fk.bilddoku && (!fk.bilddoku.termin || fk.bilddoku.termin === 't1') ? fk.bilddoku : null;
    if (vermerk){
      const namen = (Array.isArray(vermerk.dateien) ? vermerk.dateien : [vermerk.dateien]).map(text).filter(Boolean).map(base);
      if (namen.length && namen.every(n => da.has(key(n)))){
        let veraltet = null;
        if (A && typeof A.bilddokuFinden === 'function'){
          const fk2 = { ...fk, bilddoku: vermerk, dokuGeaendert: fk.dokuGeaendertJe && fk.dokuGeaendertJe[t.id] !== undefined ? fk.dokuGeaendertJe[t.id] : fk.bilddokus ? undefined : fk.dokuGeaendert };
          const k = A.bilddokuFinden(namen.map(n => da.get(key(n))), fk2, e.projektNr || '', []);
          veraltet = k ? k.veraltet : null;
        }
        return { dateien: namen.map(n => 'Fotos/' + nfc(da.get(key(n)).name)), quelle: 'fotokit', veraltet };
      }
    }
    if (!t.datum) return null;
    const imNamen = fotos.filter(f => BILDDOKU.test(nfc(f.name)) && nfc(f.name).includes('_' + t.datum) && !/alle Termine/i.test(nfc(f.name))).sort((a, b) => nfc(a.name).localeCompare(nfc(b.name), 'de', { numeric: true }));
    return imNamen.length ? { dateien: imNamen.map(f => 'Fotos/' + nfc(f.name)), quelle: 'name', veraltet: null } : null;
  }
  /** Neuester Eintrag aus _BerichtKit.json → berichte[] zur Word-Datei der Mitteilung. */
  function berichtEintrag(m, bk){
    if (!m || !m.datei) return null;
    const n = key(base(m.datei.name));
    return (bk || []).filter(b => b && key(base(b.datei)) === n).sort((a, b) => text(a.am).localeCompare(text(b.am))).pop() || null;
  }
  const festeDateien = m => m && m.aufgabe && Array.isArray(m.aufgabe.anlagen) ? m.aufgabe.anlagen.map(text) : [];

  /** Anlagen-Liste jeder Mitteilung. l = liste(); e = { pj, fotos: [{name, t}] (PDFs in „Fotos“), plaene: [{name, t}],
      labor: [{name, t}], vorhanden: Set der Pfade (kleingeschrieben, „Ordner/Datei“), fk, bk: berichte[], plan, ordnerName,
      projektNr }; A = BerichtAnlagen (anlagen.js).
      → Map schluessel → { zeilen: [{ nr, art, titel, dateien, herkunft, herkunftText, fehlt, grund, veraltet, termin, auch }],
                           weg: [Pfade, von Hand entfernt], fest, quelle: 'buero'|'berichtkit'|'bezug', bk: Eintrag | null } */
  function anlagenListen(l, e, A){
    e = e || {};
    const ms = (l && l.mitteilungen) || [], t = termine(e.pj), tJe = new Map(t.map(x => [x.id, x]));
    const vorhanden = e.vorhanden instanceof Set ? e.vorhanden : null;
    const festJe = new Map(ms.map(m => [m.schluessel, new Set(festeDateien(m).map(key))]));
    const inFestAnderer = (m, p) => ms.some(x => x !== m && festJe.get(x.schluessel).has(key(p)));
    const out = new Map();
    for (const m of ms){
      if (m.fest){
        // Nummern wie vor der Übergabe (nummerieren): aufeinanderfolgende Dateien einer Art, die eine Anlage ist (Bilddoku in Teilen,
        // Plan je Geschoss), tragen eine Nummer; Prüfberichte, Weiteres und Texte je eine (Codex-Review #94)
        const gruppe = A && A.PROFILE ? [...A.PROFILE.asbest.fest, ...A.PROFILE.asbest.optional] : ['bilddoku', 'probenplan'];
        let n = 0, vorige = '';
        const zeilen = festeDateien(m).map(p => {
          const pfad = /^[^/\\]+\/[^/\\]+$/.test(p), fehlt = pfad && !!vorhanden && !vorhanden.has(key(p)), art = pfad ? artVon(p) : 'text';
          if (!(gruppe.includes(art) && art === vorige)) n++;
          vorige = art;
          return { nr: n, art, titel: pfad ? titelVon(A, artVon(p)) : p, dateien: pfad ? [p] : [], herkunft: 'fest', herkunftText: 'mit der Übergabe festgehalten',
            fehlt, grund: fehlt ? 'Datei liegt nicht mehr im Projektordner' : '', veraltet: null, termin: '' };
        });
        out.set(m.schluessel, { zeilen, weg: [], fest: true, quelle: 'buero', bk: berichtEintrag(m, e.bk) });
        continue;
      }
      const bkE = berichtEintrag(m, e.bk);
      let zeilen = [], quelle = 'bezug';
      if (bkE && Array.isArray(bkE.anlagenListe) && bkE.anlagenListe.some(a => a && Array.isArray(a.dateien))){
        quelle = 'berichtkit';
        for (const a of bkE.anlagenListe){
          if (!a || !Array.isArray(a.dateien)) continue;
          const art = ['pruefbericht', 'bilddoku', 'probenplan', 'ergebniskarte', 'raumbuch', 'wandansichten', 'probenahme', 'sonstiges'].includes(a.art) ? a.art : 'sonstiges';
          if (!a.dateien.length){ if (art === 'pruefbericht') zeilen.push({ art, titel: text(a.titel) || 'Prüfbericht', dateien: [], herkunft: 'berichtkit', herkunftText: 'aus BerichtKit', fehlt: true, grund: 'im Bericht ohne PDF (Prüfbericht folgt)' }); continue; }
          if (art === 'pruefbericht' || art === 'sonstiges') for (const d of a.dateien) zeilen.push({ art, titel: art === 'sonstiges' ? text(a.titel) || base(d) : 'Prüfbericht', dateien: [text(d)], herkunft: 'berichtkit', herkunftText: 'aus BerichtKit' });
          else zeilen.push({ art, titel: titelVon(A, art), dateien: a.dateien.map(text), herkunft: 'berichtkit', herkunftText: 'aus BerichtKit' });
        }
      } else if (bkE && Array.isArray(bkE.anlagen) && bkE.anlagen.length){
        quelle = 'berichtkit';
        for (const d of bkE.anlagen) zeilen.push({ art: artVon(d), titel: titelVon(A, artVon(d)), dateien: [text(d)], herkunft: 'berichtkit', herkunftText: 'aus BerichtKit' });
      } else {
        // eigener Vorschlag aus dem Bezug: Prüfberichte und Plan „noch in keiner Mitteilung“ (keiner festen Liste), Bilddoku je Termin
        for (const f of (e.labor || []).slice().sort((a, b) => nfc(a.name).localeCompare(nfc(b.name), 'de', { numeric: true }))){
          const p = 'Laborergebnisse/' + nfc(f.name);
          if (!inFestAnderer(m, p)) zeilen.push({ art: 'pruefbericht', titel: 'Prüfbericht', dateien: [p], herkunft: 'frei', herkunftText: 'noch in keiner Mitteilung' });
        }
        const bez = m.eintrag && Array.isArray(m.eintrag.termine) ? m.eintrag.termine.map(text) : null;
        if (bez) for (const id of bez){
          const tt = tJe.get(id) || { id, datum: '', bezeichnung: '', entfernt: true };
          const b = tt.entfernt ? null : bilddokuFuer(tt, e, A);
          if (b && !b.dateien.some(p => inFestAnderer(m, p))) zeilen.push({ art: 'bilddoku', titel: 'Bilddokumentation', dateien: b.dateien, herkunft: 'termin', herkunftText: `aus Termin ${terminText(tt, true)}${b.quelle === 'name' ? ' (Datum im Namen)' : ''}`, veraltet: b.veraltet, termin: id });
          else zeilen.push({ art: 'bilddoku', titel: 'Bilddokumentation', dateien: [], herkunft: 'termin', herkunftText: `aus Termin ${terminText(tt, true)}`, fehlt: true, termin: id,
            grund: tt.entfernt ? `Termin ${id} gibt es nicht mehr` : b ? `für den ${de(tt.datum)} schon in einer anderen Mitteilung` : `fehlt für den ${tt.datum ? de(tt.datum) : id}` });
        } else {
          for (const f of (e.fotos || []).filter(f => BILDDOKU.test(nfc(f.name))).sort((a, b) => nfc(a.name).localeCompare(nfc(b.name), 'de', { numeric: true }))){
            const p = 'Fotos/' + nfc(f.name);
            if (!inFestAnderer(m, p)) zeilen.push({ art: 'bilddoku', titel: 'Bilddokumentation', dateien: [p], herkunft: 'frei', herkunftText: 'noch in keiner Mitteilung' });
          }
        }
        const plan = A && typeof A.planFinden === 'function' ? A.planFinden('probenplan', e.plaene || [], e.plan || null, e.ordnerName || '') : null;
        if (plan && !plan.dateien.some(p => inFestAnderer(m, p))) zeilen.push({ art: 'probenplan', titel: 'Probenplan', dateien: plan.dateien, herkunft: 'frei', herkunftText: 'noch in keiner Mitteilung', veraltet: plan.veraltet });
      }
      // von Hand: weg / dazu (M16 – bleiben, auch wenn sich der Bezug ändert)
      const weg = m.eintrag && Array.isArray(m.eintrag.anlagenWeg) ? m.eintrag.anlagenWeg.map(text) : [];
      const dazu = m.eintrag && Array.isArray(m.eintrag.anlagenDazu) ? m.eintrag.anlagenDazu.map(text) : [];
      const wegKeys = new Set(weg.map(key));
      zeilen = zeilen.map(z => {
        if (!z.dateien.length || !z.dateien.some(p => wegKeys.has(key(p)))) return z;
        return { ...z, dateien: z.dateien.filter(p => !wegKeys.has(key(p))) };
      }).filter(z => z.dateien.length || z.fehlt);
      for (const p of dazu){
        if (zeilen.some(z => z.dateien.some(d => key(d) === key(p)))) continue;
        const art = artVon(p);
        zeilen.push({ art, titel: art === 'pruefbericht' ? 'Prüfbericht' : art === 'sonstiges' ? base(p).replace(/\.[^.]+$/, '') : titelVon(A, art), dateien: [p], herkunft: 'hand', herkunftText: 'von Hand' });
      }
      // Bilddoku-Lücke geschlossen, wenn von Hand eine Bilddoku dazukam
      if (zeilen.some(z => z.art === 'bilddoku' && z.dateien.length && z.herkunft === 'hand')) zeilen = zeilen.filter(z => !(z.art === 'bilddoku' && z.fehlt && !z.dateien.length));
      zeilen = zeilen.map(z => {
        const fehltDatei = !!vorhanden && z.dateien.some(p => !vorhanden.has(key(p)));
        return { herkunftText: '', fehlt: false, grund: '', veraltet: null, termin: '', ...z, ...(fehltDatei ? { fehlt: true, grund: 'Datei liegt nicht mehr im Projektordner' } : {}) };
      });
      out.set(m.schluessel, { zeilen: nummerieren(zeilen, A), weg, fest: false, quelle, bk: bkE });
    }
    // „auch in der 1. Mitteilung“ (M17)
    for (const m of ms){
      const eigene = out.get(m.schluessel);
      for (const z of eigene.zeilen){
        z.auch = ms.filter(x => x !== m && out.get(x.schluessel).zeilen.some(y => y.dateien.some(p => z.dateien.some(q => key(p) === key(q))))).map(x => `${x.nr}. Mitteilung`);
      }
    }
    return out;
  }
  /** Pfade einer Liste in Nummernfolge (nur Zeilen mit Nummer, ohne die Word-Datei selbst). */
  const pfade = (zeilen, ohne) => (zeilen || []).filter(z => z.nr != null && z.dateien.length).flatMap(z => z.dateien).filter(p => !ohne || key(p) !== key(ohne));
  /** Vergleich mit dem, was BerichtKit beim Speichern als Anlagen vermerkt hat (R9). → { fehlen: [im Bericht, nicht in der Liste], mehr: [in der Liste, nicht im Bericht] } | null */
  function vergleich(liste, bkE){
    if (!bkE || !Array.isArray(bkE.anlagen)) return null;
    const b = bkE.anlagen.map(text), lk = new Set(liste.map(key)), bkk = new Set(b.map(key));
    return { fehlen: b.filter(p => !lk.has(key(p))), mehr: liste.filter(p => !bkk.has(key(p))) };
  }

  /** Texte unter den Kacheln für die gewählte Mitteilung (Plan 4.3) – nur Text und gelbe Lücke, nie das ✓ (Stufen.kacheln je). */
  function kachelTexte(m, liste, pj){
    if (!m || !liste) return null;
    const z = liste.zeilen, tJe = new Map(termine(pj).map(x => [x.id, x]));
    const anz = (n, e, v) => `${n} ${n === 1 ? e : v}`;
    let fotos;
    const bez = !m.fest && m.eintrag && Array.isArray(m.eintrag.termine) ? m.eintrag.termine.map(text) : null;
    if (bez && bez.length){
      const fehlt = bez.filter(id => !z.some(x => x.art === 'bilddoku' && x.termin === id && x.dateien.length && !x.fehlt));
      const tt = id => tJe.has(id) ? terminText({ ...tJe.get(id), bezeichnung: '' }, true) : `${id} (entfernt)`;
      fotos = fehlt.length ? { text: `Bilddoku für ${fehlt.map(tt).join(' · ')} fehlt`, luecke: true } : { text: `Bilddoku für ${bez.map(tt).join(' · ')} da`, luecke: false };
      if (!fehlt.length && z.some(x => x.art === 'bilddoku' && x.veraltet === true)) fotos = { text: fotos.text + ' · veraltet', luecke: true };
    } else {
      const da = z.some(x => x.art === 'bilddoku' && x.dateien.length && !x.fehlt);
      fotos = da ? { text: 'Bilddoku in der Liste', luecke: false } : { text: bez ? 'kein Ortstermin zugeordnet' : 'keine Bilddoku zugeordnet', luecke: true };
    }
    const pb = z.filter(x => x.art === 'pruefbericht' && x.dateien.length && !x.fehlt).length;
    const plan = z.some(x => x.art === 'probenplan' && x.dateien.length && !x.fehlt);
    return {
      fotos,
      labor: pb ? { text: `${anz(pb, 'Prüfbericht', 'Prüfberichte')} in der Liste`, luecke: false } : { text: 'kein Prüfbericht zugeordnet', luecke: true },
      plan: plan ? { text: 'Probenplan in der Liste', luecke: false } : { text: 'kein Plan zugeordnet', luecke: true },
      bericht: { text: `${m.nr}. Mitteilung · ${zustandText(m)}`, luecke: false },
    };
  }

  /** Angebot in „Jetzt dran“ (M5): nur eine Mitteilung, sie ist übergeben, danach ist etwas Neues da – ein Termin nach der
      Grenze oder eine Bilddoku/ein Plan/ein Prüfbericht, der in keiner festen Liste steht und nach der Grenze entstand.
      → { text, neu: [...] } | null */
  function angebot(l, e){
    const ms = (l && l.mitteilungen) || [];
    if (ms.length !== 1 || !ms[0].fest) return null;
    const g = ende(ms[0]); if (!g) return null;
    const fest = new Set(festeDateien(ms[0]).map(key)), neu = [];
    for (const t of termine(e && e.pj)) if (t.datum && t.datum > g.datum) neu.push(`Ortstermin ${deLang(t.datum)}`);
    const neuere = (liste, ordner, re) => (liste || []).filter(f => re.test(nfc(f.name)) && tag(f.t) > g.datum && !fest.has(key(ordner + '/' + nfc(f.name)))).map(f => `„${nfc(f.name)}“`);
    neu.push(...neuere(e && e.fotos, 'Fotos', BILDDOKU), ...neuere(e && e.plaene, 'Pläne', /^Probenplan\b.*\.pdf$/i), ...neuere(e && e.labor, 'Laborergebnisse', /\.pdf$/i));
    if (!neu.length) return null;
    const zeigen = neu.slice(0, 3).join(', ') + (neu.length > 3 ? ` und ${neu.length - 3} weitere` : '');
    return { text: `Neu ${g.text}: ${zeigen}.`, neu };
  }

  const api = Object.freeze({ MITTEILUNG, nrAusName, eintraege, zaehler, naechsteKennung, zaehlerNach, naechsteNr, bereinigt, termine, terminText,
    liste, zustandText, entfernbar, vorwahl, ende, grenze, vorwahlTermine, artVon, nummerieren, sortiert, bilddokuFuer, berichtEintrag, anlagenListen, pfade, vergleich,
    kachelTexte, angebot, tag, nummer });
  root.Mitteilungen = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
