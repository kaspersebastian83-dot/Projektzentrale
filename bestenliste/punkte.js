/* Spektron · Bestenliste – Punkte, Ranglisten, Abzeichen, Ticker (reine Rechnung, läuft auch in Node: tests/bestenliste.cjs).
   Eingabe: Projekte wie von seite.js gesammelt, Mitarbeiterliste. Es wird nichts gespeichert.

   Projekt = { name, nr, yy, ort, kuerzel (zuständig, Ordnerkürzel oder ''), proben (Zahl), fotoPdf, plan, records (Büroübergaben, BueroData.reduce) }
   Punkte (REGELN unten) gibt es nur aus dokumentierten Ereignissen mit Zeitpunkt: Abschluss = Büroübergabe „Erledigt“. */
(function(root){
'use strict';
const REGELN = {
  abschluss: { punkte: 10, titel: 'Projekt abgeschlossen', text: 'Büroübergabe „Erledigt“ (Gegenlesen, PDF, Versand an alle) – für die zuständige Person' },
  proben:    { punkte: 1, max: 20, titel: 'Proben', text: 'je Probe in der LabelKit-Projektdatei, höchstens 20 je Projekt – für die zuständige Person, beim Abschluss' },
  foto:      { punkte: 2, titel: 'Bilddokumentation', text: 'Bilddokumentations-PDF im Ordner „Fotos“ – beim Abschluss' },
  plan:      { punkte: 2, titel: 'Probenplan', text: 'Probenplan (PlanKit) im Ordner „Pläne“ – beim Abschluss' },
  gegenlesen:{ punkte: 3, titel: 'Gegengelesen', text: 'für das Kürzel, das „Gegengelesen“ in der Büroübersicht eingetragen hat' },
  pdf:       { punkte: 1, titel: 'PDF zugeordnet', text: 'für das Kürzel, das das PDF zugeordnet hat' },
  versand:   { punkte: 1, titel: 'Versand dokumentiert', text: 'einmal je Übergabe, für das Kürzel des ersten Versandvermerks' },
  rueckfrage:{ punkte: 2, titel: 'Rückfrage schnell beantwortet', text: 'Antwort innerhalb von 2 Werktagen – für die zuständige Person' },
};
const PROBEN_LISTEN = ['pn98Proben', 'brandgeruchProben', 'chloridProben', 'asbestProben', 'sonstigeProben'];
const norm = s => String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s.]+/g, '');

/** Proben in einer LabelKit-Projektdatei (…_Daten.json). */
function probenZaehlen(daten){
  if (!daten || typeof daten !== 'object') return 0;
  return PROBEN_LISTEN.reduce((n, k) => n + (Array.isArray(daten[k]) ? daten[k].filter(x => x && typeof x === 'object').length : 0), 0);
}
/** Person zu einem Ordner- oder App-Kürzel (oder vollem Namen). Nichts wird geraten. */
function personZu(personen, text){
  const k = norm(text);
  if (!k || !Array.isArray(personen)) return null;
  return personen.find(p => norm(p.ordnerKuerzel) === k) || personen.find(p => p.appKuerzel && norm(p.appKuerzel) === k) || personen.find(p => norm(p.name) === k) || null;
}
const schluessel = p => norm(p.ordnerKuerzel);
/** Werktage (Mo–Fr) nach dem Tag von a bis einschließlich zum Tag von b. Gleicher Tag = 0. */
function werktage(a, b){
  const t = d => { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
  let d = t(a), n = 0; const ende = t(b);
  while (d < ende){ d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
const spaeter = (...xs) => xs.filter(Boolean).sort().pop() || '';
/** Zeitpunkt, an dem eine Übergabe „Erledigt“ wurde: der letzte der nötigen Vermerke. */
function erledigtAm(r){ return spaeter(r.proof && r.proof.at, r.pdf && r.pdf.at, ...Object.values(r.sent || {}).map(s => s.at)); }

/** Alle Punkteeinträge: { key (Person) | null, name, roh (Kürzel wie eingetragen), art, punkte, at, projekt, nr, ort, gruppe }. */
function eintraege(projekte, personen){
  const out = [];
  const fuer = (person, roh) => person ? { key: schluessel(person), name: person.name } : { key: null, name: roh ? String(roh) : 'Ohne erkannte Person', roh: roh || '' };
  for (const p of projekte){
    const recs = (p.records || []).filter(r => r && !r.withdrawn);
    const zust = personZu(personen, p.kuerzel), wer = fuer(zust, p.kuerzel);
    const basis = { projekt: p.name, nr: p.nr, ort: p.ort };
    const fertig = recs.filter(r => r.status === 'Erledigt').map(r => ({ r, at: erledigtAm(r) })).filter(x => x.at).sort((a, b) => a.at.localeCompare(b.at))[0];
    if (fertig){
      const gruppe = 'abschluss:' + p.name, at = fertig.at;
      const start = recs.map(r => r.order && r.order.created).filter(Boolean).sort()[0] || '';
      out.push({ ...wer, ...basis, art: 'abschluss', punkte: REGELN.abschluss.punkte, at, gruppe, dauerMs: start ? Date.parse(at) - Date.parse(start) : null });
      const pr = Math.min(REGELN.proben.max, Math.max(0, p.proben | 0));
      if (pr) out.push({ ...wer, ...basis, art: 'proben', punkte: pr * REGELN.proben.punkte, anzahl: pr, at, gruppe });
      if (p.fotoPdf) out.push({ ...wer, ...basis, art: 'foto', punkte: REGELN.foto.punkte, at, gruppe });
      if (p.plan) out.push({ ...wer, ...basis, art: 'plan', punkte: REGELN.plan.punkte, at, gruppe });
    }
    for (const r of recs){
      const buero = (art, v) => { if (v && v.at) out.push({ ...fuer(personZu(personen, v.actor), v.actor), ...basis, art, punkte: REGELN[art].punkte, at: v.at, gruppe: 'buero:' + r.order.id + ':' + String(v.at).slice(0, 10) }); };
      buero('gegenlesen', r.proof);
      buero('pdf', r.pdf);
      buero('versand', Object.values(r.sent || {}).filter(s => s && s.at).sort((a, b) => a.at.localeCompare(b.at))[0]);
      let frage = null;
      for (const e of r.events || []){
        if (e.type === 'question') frage = e;
        else if (e.type === 'answer' && frage){
          if (werktage(frage.at, e.at) <= 2) out.push({ ...wer, ...basis, art: 'rueckfrage', punkte: REGELN.rueckfrage.punkte, at: e.at, gruppe: 'rueckfrage:' + e.id });
          frage = null;
        }
      }
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Zeiträume relativ zu „jetzt“ (Ortszeit): Monat, Jahr, Gesamt. */
function zeitraum(art, jetzt = new Date()){
  if (art === 'monat') return { von: new Date(jetzt.getFullYear(), jetzt.getMonth(), 1).toISOString(), titel: jetzt.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) };
  if (art === 'jahr') return { von: new Date(jetzt.getFullYear(), 0, 1).toISOString(), titel: String(jetzt.getFullYear()) };
  return { von: '', titel: 'Gesamt' };
}
/** Rangliste: alle aktiven Personen (auch mit 0) und alle mit Punkten im Zeitraum. Gleiche Punkte = gleicher Platz. */
function rangliste(liste, personen, von){
  const z = new Map();
  for (const p of (personen || []).filter(p => p.aktiv !== false)) z.set(schluessel(p), { key: schluessel(p), name: p.name, punkte: 0, abschluesse: 0, proben: 0, gegenlesen: 0 });
  for (const e of liste){
    if (!e.key || (von && e.at < von)) continue;
    if (!z.has(e.key)) z.set(e.key, { key: e.key, name: e.name, punkte: 0, abschluesse: 0, proben: 0, gegenlesen: 0 });
    const r = z.get(e.key); r.punkte += e.punkte; if (e.art === 'abschluss') r.abschluesse++; if (e.art === 'proben') r.proben += e.anzahl; if (e.art === 'gegenlesen') r.gegenlesen++;
  }
  const out = [...z.values()].sort((a, b) => b.punkte - a.punkte || b.abschluesse - a.abschluesse || a.name.localeCompare(b.name, 'de'));
  out.forEach((r, i) => { r.platz = i && out[i - 1].punkte === r.punkte ? out[i - 1].platz : i + 1; });
  return out;
}
/** Nicht zugeordnete Kürzel (z. B. Tippfehler im Büro): { roh, punkte, anzahl }. */
function ohneZuordnung(liste, von){
  const m = new Map();
  for (const e of liste){ if (e.key || (von && e.at < von)) continue; const k = e.roh || 'ohne Kürzel im Ordnernamen'; const x = m.get(k) || { roh: k, punkte: 0, anzahl: 0 }; x.punkte += e.punkte; x.anzahl++; m.set(k, x); }
  return [...m.values()].sort((a, b) => b.punkte - a.punkte);
}

const monat = iso => { const d = new Date(iso); return d.getFullYear() * 100 + d.getMonth() + 1; };
/** ISO-Woche als fortlaufende Zahl (Montag-Wochen seit 1970). */
const woche = iso => { const d = new Date(iso); const t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); return Math.floor((t / 864e5 + 3) / 7); };
const MEILENSTEINE = [100, 50, 25, 10, 1];
/** Abzeichen je Person: [{ id, icon, titel, text }]. */
function abzeichen(liste, personen, jetzt = new Date()){
  const out = new Map(), gib = (key, a) => { if (!key) return; if (!out.has(key)) out.set(key, []); out.get(key).push(a); };
  const nachPerson = new Map();
  for (const e of liste) if (e.key){ if (!nachPerson.has(e.key)) nachPerson.set(e.key, []); nachPerson.get(e.key).push(e); }
  for (const [key, es] of nachPerson){
    const abs = es.filter(e => e.art === 'abschluss');
    const m = MEILENSTEINE.find(n => abs.length >= n);
    if (m) gib(key, { id: 'meilenstein', icon: m >= 100 ? '💎' : m >= 50 ? '🥇' : m >= 25 ? '🥈' : m >= 10 ? '🥉' : '🎯', titel: m === 1 ? 'Erster Abschluss' : `${m} Abschlüsse`, text: `${abs.length} Projekte abgeschlossen` });
    const schnell = es.filter(e => e.art === 'rueckfrage').length;
    if (schnell >= 5) gib(key, { id: 'retter', icon: '🛟', titel: 'Rückfrage-Retter/in', text: `${schnell} Rückfragen innerhalb von 2 Werktagen beantwortet` });
    const wochen = [...new Set(abs.map(e => woche(e.at)))].sort((a, b) => a - b);
    let best = 0, lauf = 0;
    wochen.forEach((w, i) => { lauf = i && w === wochen[i - 1] + 1 ? lauf + 1 : 1; best = Math.max(best, lauf); });
    const jetztW = woche(jetzt.toISOString()), aktuell = wochen.length && wochen[wochen.length - 1] >= jetztW - 1 ? lauf : 0;
    if (best >= 3) gib(key, { id: 'serie', icon: '🔥', titel: `Serie: ${best} Wochen`, text: `${best} Wochen in Folge mit mindestens einem Abschluss` + (aktuell >= 2 ? ` · läuft gerade (${aktuell})` : '') });
    const buero = es.filter(e => e.art === 'gegenlesen').length;
    if (buero >= 10) gib(key, { id: 'lektorat', icon: '🔍', titel: buero >= 50 ? 'Meister/in des Gegenlesens' : 'Adlerauge', text: `${buero} Gutachten gegengelesen` });
  }
  // Probenkönig/in: meiste Proben in einem Monat (abgeschlossene Monate und der laufende)
  const jeMonat = new Map();
  for (const e of liste) if (e.key && e.art === 'proben'){ const k = monat(e.at); if (!jeMonat.has(k)) jeMonat.set(k, new Map()); const m = jeMonat.get(k); m.set(e.key, (m.get(e.key) || 0) + e.anzahl); }
  const kronen = new Map(), dieserMonat = monat(jetzt.toISOString());
  for (const [k, m] of jeMonat){ const max = Math.max(...m.values()); for (const [key, n] of m) if (n === max) kronen.set(key, (kronen.get(key) || []).concat(k)); }
  for (const [key, ms] of kronen) gib(key, { id: 'probenkoenig', icon: '👑', titel: 'Probenkönig/in' + (ms.length > 1 ? ` ×${ms.length}` : ''), text: `meiste Proben im Monat` + (ms.includes(dieserMonat) ? ' · führt diesen Monat' : '') });
  // Schnellster Abschluss im laufenden Jahr (Übergabe bis Erledigt)
  const vonJahr = new Date(jetzt.getFullYear(), 0, 1).toISOString();
  const schnellste = liste.filter(e => e.key && e.art === 'abschluss' && e.at >= vonJahr && e.dauerMs > 0).sort((a, b) => a.dauerMs - b.dauerMs)[0];
  if (schnellste) gib(schnellste.key, { id: 'schnellster', icon: '⚡', titel: 'Schnellster Abschluss ' + jetzt.getFullYear(), text: `${schnellste.nr}: ${dauerText(schnellste.dauerMs)} von der Übergabe bis zum Versand` });
  return out;
}
function dauerText(ms){ const h = ms / 36e5; return h < 24 ? `${Math.max(1, Math.round(h))} Std.` : `${Math.round(h / 24)} Tage`; }

/** Ticker: neueste Erfolge, Abschluss mit Boni als eine Zeile. */
function ticker(liste, n = 12){
  const g = new Map();
  for (const e of liste){ const k = e.gruppe + '|' + (e.key || e.roh); if (!g.has(k)) g.set(k, { ...e, punkte: 0, teile: [] }); const x = g.get(k); x.punkte += e.punkte; x.teile.push(e.art); }
  return [...g.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, n);
}
const VERB = { abschluss: 'hat abgeschlossen', gegenlesen: 'hat gegengelesen', pdf: 'hat das PDF zugeordnet', versand: 'hat den Versand dokumentiert', rueckfrage: 'hat eine Rückfrage schnell beantwortet' };
const BUERO = { gegenlesen: 'gegengelesen', pdf: 'das PDF zugeordnet', versand: 'den Versand dokumentiert' };
/** Text einer Tickerzeile, z. B. „hat gegengelesen, das PDF zugeordnet und den Versand dokumentiert“. */
function tickerText(t){
  const b = ['gegenlesen', 'pdf', 'versand'].filter(a => t.teile.includes(a)).map(a => BUERO[a]);
  if (!b.length) return VERB[t.art] || t.art;
  return 'hat ' + (b.length > 1 ? b.slice(0, -1).join(', ') + ' und ' + b[b.length - 1] : b[0]);
}

/** Projekte je Jahr und Person (alle Projektordner, unabhängig von Punkten). */
function jeJahr(projekte, personen){
  const jahre = [...new Set(projekte.map(p => p.yy))].sort().reverse(), z = new Map();
  for (const p of projekte){
    const person = personZu(personen, p.kuerzel), key = person ? schluessel(person) : '', name = person ? person.name : 'Ohne erkannte Person';
    if (!z.has(key)) z.set(key, { key, name, inaktiv: !!person && person.aktiv === false, jahre: {} });
    const r = z.get(key); r.jahre[p.yy] = (r.jahre[p.yy] || 0) + 1;
  }
  const zeilen = [...z.values()].sort((a, b) => (!a.key) - (!b.key) || a.name.localeCompare(b.name, 'de'));
  return { jahre, zeilen };
}

const api = { REGELN, PROBEN_LISTEN, probenZaehlen, personZu, werktage, erledigtAm, eintraege, zeitraum, rangliste, ohneZuordnung, abzeichen, ticker, VERB, tickerText, jeJahr, dauerText, woche };
if (typeof module === 'object' && module.exports) module.exports = api; else root.Bestenliste = api;
})(typeof self !== 'undefined' ? self : this);
