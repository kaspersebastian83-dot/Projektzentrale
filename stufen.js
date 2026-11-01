/* Spektron – Stufen eines Projekts und „Jetzt dran“ (nur rechnen, nichts lesen oder schreiben).
   Sechs Stufen in Arbeitsreihenfolge; jede mit Zustand, einem Satz und der App, in der es weitergeht:
     1 Projekt anlegen (Projektdaten)          4 Gutachten (PlanKit, BerichtKit: Asbest- oder Brandbericht, Anlage)
     2 Ortstermin: Proben & Fotos (LabelKit, FotoKit)   5 Ans Büro → Versand (BüroKit)
     3 Labor (ResultKit)                       6 Abrechnung (BelegKit)
   Zustände: 'fertig' | 'dran' (der nächste Schritt liegt bei dir) | 'wartet' (Labor oder Büro sind dran) | 'offen' (später) |
   'hinweis' (nur Stufe 1: Angaben fehlen, blockiert aber nichts) | 'uebersprungen' (keine Spur, aber eine spätere Stufe ist erreicht).
   Die Fakten kommen aus dem Ordner (Liste: schneller Scan) oder aus der geöffneten Projektansicht (genauer). Fehlt eine
   Angabe, gilt sie als „noch nicht“ – die Stufen sind eine Orientierung, keine Pflichtabfolge. */
(function(root){
  'use strict';
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const de = s => ISO.test(String(s || '')) ? `${s.slice(8, 10)}.${s.slice(5, 7)}.` : '';
  const anz = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;

  const STUFEN = [
    ['projekt', 'Projekt anlegen', 'Projektdaten'],
    ['ortstermin', 'Ortstermin: Proben & Fotos', 'LabelKit · FotoKit'],
    ['labor', 'Labor', 'ResultKit'],
    ['gutachten', 'Gutachten', 'PlanKit · BerichtKit · Anlage'],
    ['buero', 'Ans Büro → Versand', 'BüroKit'],
    ['abrechnung', 'Abrechnung', 'BelegKit'],
  ];

  /**
   * f: {
   *   pj: Projektdaten vorhanden, pflichtFehlt: Anzahl, arbeitszettel: eingelesen,
   *   proben: Probendaten (LabelKit) vorhanden, laborauftrag: Datum,
   *   fotos: { bilder, begonnen, doku },
   *   berichte: Anzahl Prüfberichte, ergebnisse: null | { vollstaendig, veraltet, offen, fehler }, pruefbericht: Datum,
   *   plan: Probenplan vorhanden, berichtsart: 'asbest' | 'brand' | '' – welcher Bericht dran ist (gemerkt in BerichtKit, sonst nach den
   *     LabelKit-Proben; '' = unbekannt, BerichtKit entscheidet selbst), mitteilung: { datei, datum } neueste „n. Mitteilung ….docx“ in „Mitteilungen“ (neuesteMitteilung) | null,
   *   buero: { offen, frage, erledigt, rechnungOffen, rechnung: Datum, rechnungVon, woerter: übergebene Word-Dateien, zuletzt: Datum der
   *     letzten Übergabe } | null (unbekannt), uebergabe: Datum, versand: Datum,
   *   abrechnung: Datum des letzten BelegKit-Stands
   * }
   */
  function berechnen(f){
    f = f || {};
    const fotos = f.fotos || {}, er = f.ergebnisse, b = f.buero || {};
    const s = {};

    // 1 Projekt anlegen
    const pflicht = f.pflichtFehlt || 0;
    s.projekt = !f.pj ? { zustand: 'dran', text: 'Noch keine Projektdaten – Arbeitszettel einlesen', aktion: 'az' }
      : pflicht ? { zustand: 'hinweis', text: `${anz(pflicht, 'Pflichtangabe fehlt', 'Pflichtangaben fehlen')}`, aktion: 'daten' }
      : { zustand: 'fertig', text: f.arbeitszettel ? 'Projektdaten vollständig · Arbeitszettel eingelesen' : 'Projektdaten vollständig', aktion: 'daten' };

    // 2 Ortstermin: Proben & Fotos
    const fotoText = fotoStand(fotos);
    // Probendaten aus LabelKit oder eine Laborübergabe (Datum im Dateinamen) zeigen, dass Proben genommen wurden
    s.ortstermin = f.proben || f.laborauftrag
      ? { zustand: 'fertig', text: `Proben erfasst${f.laborauftrag ? ` · Laborauftrag ${de(f.laborauftrag)}` : ''} · ${fotoText}` }
      : { zustand: 'offen', text: `Noch keine Proben erfasst · ${fotoText}`, aktion: 'label' };

    // 3 Labor
    if (er && er.fehler) s.labor = { zustand: 'dran', text: 'Ergebnisdatei nicht lesbar – in ResultKit neu übernehmen', aktion: 'ergebnis' };
    else if (er && er.vollstaendig && !er.veraltet) s.labor = { zustand: 'fertig', text: `Ergebnisse vollständig übernommen${f.pruefbericht ? ` · erster Bericht ${de(f.pruefbericht)}` : ''}` };
    else if (er && er.veraltet) s.labor = { zustand: 'dran', text: 'Neue Prüfberichte seit der Übernahme – prüfen und übernehmen', aktion: 'ergebnis' };
    else if (f.berichte && !er) s.labor = { zustand: 'dran', text: `${anz(f.berichte, 'Prüfbericht', 'Prüfberichte')} eingegangen, noch nicht geprüft`, aktion: 'ergebnis' };
    else if (er) s.labor = { zustand: 'wartet', text: `Zwischenstand übernommen${er.offen ? ` · ${er.offen} offen beim Labor` : ''}`, aktion: 'ergebnis' };
    else if (f.proben || f.laborauftrag) s.labor = { zustand: 'wartet', text: `Beim Labor${f.laborauftrag ? ` seit ${de(f.laborauftrag)}` : ''} – noch keine Prüfberichte`, aktion: 'ergebnis' };
    else s.labor = { zustand: 'offen', text: 'Noch kein Laborauftrag', aktion: 'ergebnis' };

    // 4 Gutachten – erledigt, sobald es beim Büro ist. Liegt eine Mitteilung (BerichtKit oder von Hand) vor, die noch nicht
    // übergeben ist, ist das Übergeben dran – auch nach einer früheren Übergabe (z. B. 2. Mitteilung).
    const uebergeben = !!(f.uebergabe || f.versand || b.offen || b.frage || b.erledigt);
    const mt = f.mitteilung && ISO.test(f.mitteilung.datum || '') ? f.mitteilung : null;
    const mtOffen = !!mt && !b.unklar && !mitteilungUebergeben(mt, f);
    s.gutachten = mtOffen ? { zustand: 'offen', text: `Mitteilung vom ${de(mt.datum)} erstellt – ans Büro übergeben`, aktion: 'uebergeben' }
      : uebergeben ? { zustand: 'fertig', text: `Gutachten übergeben${f.uebergabe ? ` ${de(f.uebergabe)}` : ''}` }
      : f.plan ? { zustand: 'offen', text: `Probenplan angelegt · ${BERICHT[f.berichtsart] || 'Gutachten'} schreiben, Anlage erstellen`, aktion: BERICHT_AKTION[f.berichtsart] || 'berichtkit' }
      : { zustand: 'offen', text: 'Noch kein Probenplan', aktion: 'plan' };

    // 5 Ans Büro → Versand
    if (b.unklar) s.buero = { zustand: 'dran', text: 'Büroaufgaben nicht vollständig lesbar – in BüroKit prüfen', aktion: 'buerokit' };
    else if (b.frage) s.buero = { zustand: 'dran', text: 'Rückfrage vom Büro – bitte antworten', aktion: 'frage' };
    // Ein offenes Gutachten beim Büro geht vor ältere Versandangaben (z. B. Nachtrag nach einem früheren Versand)
    else if (b.offen) s.buero = { zustand: 'wartet', text: `Beim Büro${b.offenText ? ` · noch offen: ${b.offenText}` : ''}`, aktion: 'buerokit' };
    else if (f.versand || b.erledigt) s.buero = { zustand: 'fertig', text: `Versandt${f.versand ? ` ${de(f.versand)}` : ''}` };
    else s.buero = { zustand: 'offen', text: 'Noch nicht übergeben', aktion: 'uebergeben' };

    // 6 Abrechnung – mit BüroKit (ab 1.1): fertig, wenn das Büro „Rechnung“ abgehakt hat. Das Büro rechnet nach dem
    // BelegKit-Stand ab; fehlt er, ist der Sachverständige dran. Ohne Rechnungsschritt (frühere Übergaben, Versand
    // außerhalb BüroKit) wie bisher: fertig, wenn nach dem Versand ein BelegKit-Stand gespeichert wurde.
    const versandt = s.buero.zustand === 'fertig';
    if (versandt && b.rechnungOffen) s.abrechnung = f.abrechnung
      ? { zustand: 'wartet', text: `Rechnung beim Büro · Abrechnungsstand vom ${de(f.abrechnung)}`, aktion: 'buerokit' }
      : { zustand: 'dran', text: 'Das Büro braucht für die Rechnung den Abrechnungsstand – in BelegKit „Stand speichern“', aktion: 'beleg' };
    else if (versandt && b.rechnung) s.abrechnung = { zustand: 'fertig', text: `Abgerechnet ${de(b.rechnung)}${b.rechnungVon ? ` (${b.rechnungVon})` : ''}` };
    else s.abrechnung = f.abrechnung && versandt && (!f.versand || f.abrechnung >= f.versand)
      ? { zustand: 'fertig', text: `Abgerechnet · Stand ${de(f.abrechnung)}` }
      : { zustand: 'offen', text: f.abrechnung ? `Abrechnungsstand vom ${de(f.abrechnung)}${versandt ? ' – nach dem Versand abschließen' : ''}` : 'Noch keine Zeiten erfasst', aktion: 'beleg' };

    // Spätere Stufe schon erreicht (z. B. Gutachten beim Büro, versandt): frühere Stufen ohne Spur im Ordner gelten als erledigt
    // („übersprungen“) – etwa Prüfberichte, die anderswo abgelegt sind. Was die Fakten ausdrücklich verlangen („dran“), bleibt.
    const reiheAlle = ['ortstermin', 'labor', 'gutachten', 'buero'];
    const spur = k => s[k].zustand === 'fertig' || (k === 'labor' && !!(f.berichte || er)) || (k === 'gutachten' && !!mt) || (k === 'buero' && s[k].zustand !== 'offen');
    const erreicht = Math.max(-1, ...reiheAlle.map((k, i) => spur(k) ? i : -1));
    for (let i = 0; i < erreicht; i++){
      const k = reiheAlle[i];
      // Labor mit Prüfberichten (z. B. Zwischenstand übernommen) wurde nicht übersprungen, nur nicht abgeschlossen: eigenen Stand behalten
      const mitBerichten = k === 'labor' && !!(f.berichte || er);
      if (k === 'gutachten' && mtOffen) continue;   // neue Mitteilung liegt vor: das Übergeben ist nicht übersprungen
      if (s[k].zustand === 'offen' || s[k].zustand === 'wartet') s[k] = { zustand: 'uebersprungen', text: mitBerichten ? `${s[k].text} – nicht abgeschlossen` : UEBERSPRUNGEN[k] };
    }
    // Aktuelle Stufe: die erste nicht fertige ab Stufe 2. Was Labor/Büro gerade tun, wartet; danach ist alles „später“.
    const reihe = STUFEN.slice(1).map(([k]) => k);
    const aktuell = reihe.find(k => s[k].zustand !== 'fertig' && s[k].zustand !== 'uebersprungen') || null;
    if (aktuell && s[aktuell].zustand === 'offen') s[aktuell].zustand = 'dran';
    // Spätere Stufen bleiben „offen“ (nicht verboten: Abrechnung, Probenplan … gehen jederzeit). „Dran“ ist dort nur, was die
    // Fakten selbst verlangen (z. B. eingegangene Prüfberichte, Rückfrage vom Büro).

    const stufen = STUFEN.map(([key, name, app]) => ({ key, name, app, ...s[key] }));
    return { stufen, aktuell, jetzt: jetztDran(s, aktuell, f), gruppe: gruppe(s, aktuell), kurz: kurz(s, aktuell) };
  }

  const fotoStand = fotos => fotos.doku ? 'Bilddokumentation erstellt' : fotos.begonnen ? 'Fotos in Bearbeitung' : fotos.bilder ? anz(fotos.bilder, 'Foto', 'Fotos') : 'noch keine Fotos';

  /** Sechs Kacheln der Projektansicht – dieselben sechs Schritte wie im Kopfband der Apps (Spektron-Leiste v3), ohne Nummern.
      ✓ (fertig) = die Datei der App ist da, wie in der Leiste: LabelKit-Projektdatei (probendaten, sonst proben), FotoKit-Datei
      (fotos.begonnen), ResultKit-Ergebnisse, Probenplan, Bericht (berichtDa – Regel der Leiste; ohne Angabe: eine Mitteilung liegt
      vor), BelegKit-Stand. Der Text darunter ist der genaue Stand. zustand: Labor und Abrechnung wie ihre Stufe, sonst
      fertig / dran (die Aktion von „Jetzt dran“) / offen. jetzt = die Kachel, zu der „Jetzt dran“ führt.
      r = berechnen(f), falls schon gerechnet. → [{ key, name, app, aktion, fertig, zustand, jetzt, text }] */
  function kacheln(f, r){
    f = f || {}; r = r || berechnen(f);
    const s = {}; for (const x of r.stufen) s[x.key] = x;
    const fotos = f.fotos || {}, art = BERICHT[f.berichtsart] ? f.berichtsart : '';
    const mt = f.mitteilung && ISO.test(f.mitteilung.datum || '') ? f.mitteilung : null;
    const liste = [
      { key: 'proben', name: 'Proben', app: 'LabelKit', aktion: 'label', fertig: typeof f.probendaten === 'boolean' ? f.probendaten : !!f.proben,
        text: f.proben || f.laborauftrag ? `Proben erfasst${f.laborauftrag ? ` · Laborauftrag ${de(f.laborauftrag)}` : ''}` : 'Noch keine Proben erfasst' },
      { key: 'fotos', name: 'Fotos', app: 'FotoKit', aktion: 'fotos', fertig: !!fotos.begonnen, text: fotoStand(fotos) },
      { key: 'labor', name: 'Labor', app: 'ResultKit', aktion: 'ergebnis', fertig: !!f.ergebnisse, text: s.labor.text, stufe: s.labor.zustand },
      { key: 'plan', name: 'Plan', app: 'PlanKit', aktion: 'plan', fertig: !!f.plan, text: f.plan ? 'Probenplan angelegt' : 'Noch kein Probenplan' },
      { key: 'bericht', name: BERICHT[art] || 'Bericht', app: 'BerichtKit', aktion: BERICHT_AKTION[art] || 'berichtkit',
        fertig: typeof f.berichtDa === 'boolean' ? f.berichtDa : !!mt,
        text: mt || s.gutachten.zustand === 'fertig' ? s.gutachten.text : `${BERICHT[art] || 'Bericht'} noch nicht gespeichert` },
      { key: 'abrechnung', name: 'Abrechnung', app: 'BelegKit', aktion: 'beleg', fertig: !!f.abrechnung, text: s.abrechnung.text, stufe: s.abrechnung.zustand },
    ];
    const j = r.jetzt || {}, zu = KACHEL_ZU[j.aktion] || '';
    return liste.map(({ stufe, ...k }) => ({ ...k, jetzt: k.key === zu, zustand: stufe || (k.fertig ? 'fertig' : k.key === zu ? 'dran' : 'offen') }));
  }
  /** Aktion von „Jetzt dran“ → Kachel (Projektdaten, Übergabe, Rückfrage, BüroKit haben keine Kachel) */
  const KACHEL_ZU = { label: 'proben', fotos: 'fotos', ergebnis: 'labor', plan: 'plan', bericht: 'bericht', brandbericht: 'bericht', berichtkit: 'bericht', beleg: 'abrechnung' };

  const name = s => String(s || '').split('/').pop().normalize('NFC').toLowerCase();
  /** Mitteilung beim Büro? Ja, wenn eine Büroaufgabe genau diese Datei nennt – oder (Übergaben ohne Dateinamen, vor BüroKit,
      umbenannte Dateien) eine Übergabe oder ein Versand am Tag der Datei oder später liegt. Bearbeitet das Büro die Datei
      nach der Übergabe, bleibt der Name gleich. */
  function mitteilungUebergeben(mt, f){
    const b = f.buero || {};
    if ((b.woerter || []).some(w => name(w) === name(mt.datei))) return true;
    return [b.zuletzt, f.uebergabe, f.versand].some(d => ISO.test(d || '') && d >= mt.datum);
  }
  /** Word-Datei einer Mitteilung: „1. Mitteilung ….docx“, „2._Mitteilung_26.0512.docx“, „1__Mitteilung.docx“ (wie die Spektron-Leiste). */
  const MITTEILUNG = /^\d+[._\s]*Mitteilung(?![a-zäöüß]).*\.docx$/i;
  /** Neueste Mitteilung aus [{ name, t }] (t = Änderungszeit in ms) → { datei, datum } oder null. */
  function neuesteMitteilung(liste){
    const m = (liste || []).filter(x => x && MITTEILUNG.test(x.name) && Number.isFinite(x.t) && x.t > 0).sort((a, b) => b.t - a.t || b.name.localeCompare(a.name, 'de', { numeric: true }))[0];
    if (!m) return null;
    const d = new Date(m.t), pad = n => String(n).padStart(2, '0');
    return { datei: m.name, datum: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
  }

  /** Welcher Bericht passt zu den LabelKit-Proben (neueste `*_Daten.json`)? Hervorgehoben wird nur ein Knopf, beide bleiben da.
      Brandbericht, sobald Chlorid- (auch Chlorid-Bohrmehl unter „Sonstige“), PAK- oder Brandgeruch-Proben da sind – Asbestproben
      eines Brandschadens stehen im Brandbericht (5.5). Nur Asbestproben → Asbestbericht. Sonst (keine Datei, keine Proben, nur
      weitere Proben) keiner. Stornierte Proben zählen nicht, Bohrmehl wie BerichtKit (`istBohrmehl` in bericht-brand.js).
      → { art: 'brand' | 'asbest' | '', grund: 'kurzer Text für den Tooltip' } */
  function berichtsart(lk){
    const liste = k => (lk && Array.isArray(lk[k]) ? lk[k] : []).filter(p => p && typeof p === 'object' && !p.storniert);
    const txt = v => String(v == null ? '' : v).trim();
    const bohrAn = !!(lk && ((lk.ui && lk.ui.bohrmehlAktiv) || lk.bohrmehlAktiv));
    const bohrmehl = liste('sonstigeProben').filter(p => bohrAn || (!!txt(p.tiefe) && /chlorid/i.test(txt(p.notiz)))).length;
    const n = { cl: liste('chloridProben').length + bohrmehl, pak: liste('proben').length, bg: liste('brandgeruchProben').length, as: liste('asbestProben').length };
    const teile = [[n.cl, 'Chlorid-Probe', 'Chlorid-Proben'], [n.pak, 'PAK-Probe', 'PAK-Proben'], [n.bg, 'Brandgeruch-Probe', 'Brandgeruch-Proben']]
      .filter(([z]) => z).map(([z, e, v]) => anz(z, e, v));
    if (teile.length) return { art: 'brand', grund: teile.join(', ') + (n.as ? ` und ${anz(n.as, 'Asbestprobe', 'Asbestproben')}` : '') };
    if (n.as) return { art: 'asbest', grund: anz(n.as, 'Asbestprobe', 'Asbestproben') };
    return { art: '', grund: '' };
  }

  /** Gemerkte Berichtsart aus „_BerichtKit.json“ ({ art, berichte }) wie BerichtKit bericht-vorgaben.js artGemerkt – dort ändern,
      hier nachziehen: Feld „art“, sonst die Art des zuletzt gespeicherten Berichts (ohne Angabe: asbest). → 'asbest' | 'brand' | '' */
  function artGemerkt(datei){
    const ok = a => { const x = String(a == null ? '' : a).trim().toLowerCase(); return BERICHT[x] ? x : ''; };
    if (!datei || typeof datei !== 'object') return '';
    const a = ok(datei.art); if (a) return a;
    const b = (Array.isArray(datei.berichte) ? datei.berichte : []).filter(x => x && x.datei).pop();
    return b ? (ok(b.art) || (b.art ? '' : 'asbest')) : '';
  }
  const BERICHT = { asbest: 'Asbestbericht', brand: 'Brandbericht' }, BERICHT_AKTION = { asbest: 'bericht', brand: 'brandbericht' };

  const UEBERSPRUNGEN = { ortstermin: 'Keine Probendaten im Ordner – übersprungen', labor: 'Keine Prüfberichte im Ordner – übersprungen', gutachten: 'Übersprungen' };
  const b0 = f => f.buero || {};
  const AKTIONEN = {
    az: 'Arbeitszettel einlesen', daten: 'Angaben ergänzen', label: 'Proben erfassen', ergebnis: 'Ergebnisse prüfen',
    plan: 'Probenplan zeichnen', bericht: 'Asbestbericht schreiben', brandbericht: 'Brandbericht schreiben', berichtkit: 'Bericht schreiben', uebergeben: 'Ans Büro übergeben', frage: 'Antworten', buerokit: 'BüroKit öffnen', beleg: 'Zeiten erfassen',
  };

  function jetztDran(s, aktuell, f){
    if (b0(f).unklar) return { titel: 'Büro-Stand unklar', text: s.buero.text, aktion: 'buerokit', knopf: AKTIONEN.buerokit };
    if (s.buero.aktion === 'frage') return { titel: 'Rückfrage vom Büro', text: 'Das Büro wartet auf deine Antwort.', aktion: 'frage', knopf: AKTIONEN.frage };
    const begonnen = f.proben || f.laborauftrag || f.berichte || f.plan || f.uebergabe || f.versand || (f.buero && (f.buero.offen || f.buero.erledigt));
    if (s.projekt.aktion === 'az' && s.projekt.zustand === 'dran' && !begonnen) return { titel: 'Projekt anlegen', text: 'Arbeitszettel einlesen – Objekt, Auftraggeber und Termine stehen dann in allen Apps.', aktion: 'az', knopf: AKTIONEN.az };
    if (!aktuell) return { titel: 'Alles erledigt', text: 'Versandt und abgerechnet.', aktion: null, knopf: '' };
    const st = s[aktuell];
    if (st.zustand === 'dran') return { titel: (st.aktion === 'uebergeben' ? TITEL.buero : TITEL[aktuell]) || st.text, text: st.text, aktion: st.aktion, knopf: AKTIONEN[st.aktion] || '' };
    // Labor oder Büro sind dran: was sich inzwischen tun lässt
    if (aktuell === 'labor'){
      if (!f.plan) return { titel: 'Labor läuft', text: `${st.text}. Inzwischen: Probenplan zeichnen.`, aktion: 'plan', knopf: AKTIONEN.plan, wartet: true };
      if (s.projekt.zustand === 'hinweis') return { titel: 'Labor läuft', text: `${st.text}. Inzwischen: ${s.projekt.text.toLowerCase()} – ergänzen.`, aktion: 'daten', knopf: AKTIONEN.daten, wartet: true };
      return { titel: 'Labor läuft', text: st.text, aktion: 'ergebnis', knopf: 'ResultKit öffnen', wartet: true };
    }
    if (aktuell === 'buero') return { titel: 'Beim Büro', text: f.buero && f.buero.offenText ? `Noch offen: ${f.buero.offenText}` : 'Das Büro arbeitet das Gutachten in BüroKit ab.', aktion: 'buerokit', knopf: AKTIONEN.buerokit, wartet: true };
    if (aktuell === 'abrechnung') return { titel: 'Rechnung beim Büro', text: st.text, aktion: 'buerokit', knopf: AKTIONEN.buerokit, wartet: true };
    return { titel: st.text, text: '', aktion: st.aktion, knopf: AKTIONEN[st.aktion] || '', wartet: true };
  }
  const TITEL = {
    ortstermin: 'Proben erfassen und Laborauftrag erstellen', labor: 'Laborergebnisse prüfen', gutachten: 'Gutachten schreiben',
    buero: 'Gutachten ans Büro übergeben', abrechnung: 'Zeiten und Abrechnung abschließen',
  };

  /** Gruppe in der Liste: 'dich' (nächster Schritt bei dir), 'laeuft' (Labor/Büro sind dran), 'fertig'. */
  function gruppe(s, aktuell){
    if (s.buero.aktion === 'frage' || s.buero.zustand === 'dran') return 'dich';
    if (!aktuell) return 'fertig';
    return s[aktuell].zustand === 'wartet' ? 'laeuft' : 'dich';
  }
  /** Kurzer Stand für die Projektliste. */
  function kurz(s, aktuell){
    if (s.buero.aktion === 'frage') return 'Rückfrage vom Büro';
    if (s.buero.zustand === 'dran' && s.buero.aktion === 'buerokit') return 'Büro-Stand unklar';
    if (!aktuell) return 'Versandt und abgerechnet';
    const name = { ortstermin: 'Ortstermin', labor: 'Labor', gutachten: 'Gutachten', buero: 'Büro', abrechnung: 'Abrechnung' }[aktuell];
    const st = s[aktuell];
    if (aktuell === 'labor') return st.zustand === 'wartet' ? 'Beim Labor' : 'Labor · Ergebnisse da';
    if (aktuell === 'buero') return st.zustand === 'wartet' ? 'Beim Büro' : 'Ans Büro übergeben';
    if (aktuell === 'abrechnung') return st.zustand === 'wartet' ? 'Versandt · Rechnung beim Büro' : 'Versandt · Abrechnung offen';
    if (aktuell === 'ortstermin') return 'Proben erfassen';
    if (aktuell === 'gutachten' && st.aktion === 'uebergeben') return 'Mitteilung ans Büro übergeben';
    return name + (aktuell === 'gutachten' ? ' schreiben' : '');
  }

  const api = Object.freeze({ berechnen, kacheln, neuesteMitteilung, berichtsart, artGemerkt, MITTEILUNG, STUFEN, AKTIONEN });
  root.Stufen = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
