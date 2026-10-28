/* BUEROKIT-AUFGABEN v1 – in BüroKit (buero-aufgaben.js) und Projektzentrale (buero-aufgaben.js) byte-gleich halten.
   Aufgaben des Büros je Projekt, ohne zentrale Gesamtdatei und ohne Server:

     <Archiv>/<JJ.Nummer Ort Kürzel>/_Buero/aufgaben/<id>.json   eine Aufgabe (Gutachten oder eigene Aufgabe)
     <Archiv>/<JJ.Nummer Ort Kürzel>/_Buero/vermerke/<id>.json   ein Haken (gegengelesen, PDF, versandt, Rechnung, Rückfrage …)

   Jede Datei wird einmal neu geschrieben und nie geändert; zwei Kollegen können also nichts gegenseitig überschreiben.
   Der Stand eines Schritts ist einfach der neueste Vermerk dazu (Zeit, dann Kennung) – Haken setzen und wieder
   wegnehmen geht ohne Begründung. „Rechnung“ ist ein eigener Haken neben dem Versand: „erledigt“ heißt weiterhin
   „versandt“ (Durchlaufzeiten bleiben gleich), „abgeschlossen“ heißt versandt und abgerechnet. Ältere Büroübergaben der Projektzentrale (bis 1.27, „_Buero/<Auftrags-UUID>/“) werden
   gelesen und wie Aufgaben gezeigt; neue Haken dazu landen ebenfalls in „vermerke“.
   Läuft im Browser (window.BueroAufgaben) und in Node (module.exports, für Tests). */
(function(root){
'use strict';
const FORMAT = 'spektron-buerokit', VERSION = 1, DIR = '_Buero', AUFGABEN = 'aufgaben', VERMERKE = 'vermerke', ALT = 'spektron-buero';
const MAX_DATEI = 256 * 1024, MAX_TEXT = 2000;
/** Schritte eines Gutachtens; Versand je Empfänger. Rechnung nur bei Übergaben über BüroKit (nicht bei früheren). */
const SCHRITTE = [['gegenlesen', 'Gegenlesen'], ['pdf', 'PDF'], ['versand', 'Versand'], ['rechnung', 'Rechnung']];
const VERMERK_ARTEN = ['gegenlesen', 'pdf', 'versand', 'rechnung', 'erledigt', 'uebernommen', 'frage', 'antwort', 'faellig', 'geloescht'];
const MAX_ANLAGEN = 60;
/** Empfängergruppen (gleiche Kennungen wie die früheren Büroübergaben) mit dem Feld in _Projekt.json. */
const GRUPPEN = [['versicherung', 'Auftraggeber', 'auftraggeber'], ['sachverstaendiger', 'Empfangende Sachverständige', 'sachverstaendigerBeteiligt'],
  ['versicherungsnehmer', 'Versicherungsnehmer', 'versicherungsnehmer'], ['sanierung', 'Sanierung', 'sanierung']];
const PROJEKT = /^(\d{2}\.\d{2,6})(?:[\s_-]|$)/;
const ID = /^[0-9a-zA-Z-]{8,80}$/, EMPF_ID = /^[0-9a-zA-Z-]{1,80}$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const fehlt = e => e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');
const uid = () => (root.crypto || globalThis.crypto).randomUUID();
const nfc = s => String(s == null ? '' : s).normalize('NFC');
const text = (v, max = MAX_TEXT) => typeof v === 'string' ? v.slice(0, max) : '';
const gueltigeZeit = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const gueltigesDatum = v => typeof v === 'string' && DATUM.test(v) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const nr = name => (PROJEKT.exec(nfc(name)) || [])[1] || '';

async function unter(dir, name, anlegen){
  try{ return await dir.getDirectoryHandle(name, anlegen ? { create: true } : undefined); }
  catch(e){ if (!anlegen && fehlt(e)) return null; throw e; }
}
async function jsonLesen(dir, name){
  const f = await (await dir.getFileHandle(name)).getFile();
  if (f.size > MAX_DATEI) throw Error(name + ' ist zu groß.');
  const t = await f.text();
  if (!t.trim()) throw Object.assign(Error(name + ' ist leer (unterbrochenes Speichern?).'), { leer: true });
  return JSON.parse(t);
}
/** Neue Datei schreiben, nie eine vorhandene ersetzen; erst bestätigtes Rücklesen gilt als gespeichert. */
async function neuSchreiben(dir, name, obj){
  const inhalt = JSON.stringify(obj, null, 1) + '\n';
  let vorhanden = true;
  try{ await dir.getFileHandle(name); }catch(e){ if (!fehlt(e)) throw e; vorhanden = false; }
  if (vorhanden) throw Error('Datei gibt es schon: ' + name);
  const h = await dir.getFileHandle(name, { create: true });
  const w = await h.createWritable();
  try{ await w.write(inhalt); await w.close(); }catch(e){ try{ await w.abort(); }catch(_){} throw e; }
  if (await (await h.getFile()).text() !== inhalt) throw Error('Speichern nicht bestätigt: ' + name);
  return obj;
}

/* ---------- prüfen ---------- */
function empfaengerPruefen(liste){
  if (!Array.isArray(liste)) return [];
  const ids = new Set();
  return liste.filter(r => r && typeof r.id === 'string' && EMPF_ID.test(r.id) && !ids.has(r.id) && ids.add(r.id))
    .map(r => ({ id: r.id, gruppe: text(r.gruppe || r.group, 40), label: text(r.label, 120), details: text(r.details) }))
    .filter(r => r.details.trim() || r.label.trim());
}
/** Anlagen: Pfade im Projektordner („Fotos/Bilddokumentation.pdf“) oder kurze Texte („Laborberichte Eurofins“). */
function anlagenPruefen(liste){
  if (!Array.isArray(liste)) return [];
  const da = new Set();
  return liste.map(x => text(x, 400).trim()).filter(x => x && !da.has(x) && da.add(x)).slice(0, MAX_ANLAGEN);
}
function aufgabePruefen(o, dateiId, projektName){
  if (!o || o.format !== FORMAT || o.version !== VERSION || o.typ !== 'aufgabe' || o.id !== dateiId || !ID.test(o.id)) throw Error('Unbekanntes oder beschädigtes Aufgabenformat.');
  if (!gueltigeZeit(o.erstellt)) throw Error('Aufgabe ohne gültigen Zeitpunkt.');
  if (!o.projekt || nfc(o.projekt.name) !== nfc(projektName)) throw Error(`Aufgabe gehört zu „${text(o.projekt && o.projekt.name, 200)}“, liegt aber in „${projektName}“ – nicht berücksichtigt.`);
  if (!['gutachten', 'eigene'].includes(o.art)) throw Error('Unbekannte Aufgabenart.');
  return { id: o.id, art: o.art, titel: text(o.titel, 300) || (o.art === 'gutachten' ? 'Gutachten' : 'Aufgabe'), erstellt: o.erstellt, von: text(o.von, 40),
    fuer: text(o.fuer, 40), faellig: gueltigesDatum(o.faellig) ? o.faellig : '', hinweis: text(o.hinweis), word: text(o.word, 400), empfaenger: empfaengerPruefen(o.empfaenger), anlagen: anlagenPruefen(o.anlagen), alt: false };
}
function vermerkPruefen(o, dateiId){
  if (!o || o.format !== FORMAT || o.version !== VERSION || o.typ !== 'vermerk' || o.id !== dateiId || !ID.test(o.id)) throw Error('Unbekanntes oder beschädigtes Vermerkformat.');
  if (!gueltigeZeit(o.zeit) || typeof o.aufgabe !== 'string' || !ID.test(o.aufgabe) || !VERMERK_ARTEN.includes(o.schritt)) throw Error('Unvollständiger Vermerk.');
  return { id: o.id, aufgabe: o.aufgabe, zeit: o.zeit, von: text(o.von, 40), schritt: o.schritt, wert: o.wert !== false,
    empfaenger: text(o.empfaenger, 80), text: text(o.text), pdf: text(o.pdf, 400), stand: text(o.stand, 400), datum: gueltigesDatum(o.datum) ? o.datum : '' };
}

/* ---------- frühere Büroübergaben (Projektzentrale bis 1.27) ---------- */
async function altLesen(dir, id, projektName, fehler){
  try{
    const o = await jsonLesen(dir, 'auftrag.json');
    if (!o || o.format !== ALT || o.version !== 1 || o.id !== id || !o.content) throw Error('unbekanntes Format');
    const c = o.content;
    if (!c.project || nfc(c.project.name) !== nfc(projektName)) throw Error(`gehört zu „${text(c.project && c.project.name, 200)}“`);
    const aufgabe = { id, art: 'gutachten', titel: 'Gutachten', erstellt: gueltigeZeit(o.created) ? o.created : new Date(0).toISOString(), von: text(c.who, 40), fuer: '', faellig: '',
      hinweis: text(c.note), word: text(c.word, 400), empfaenger: empfaengerPruefen(c.recipients), anlagen: [], alt: true };
    const vermerke = [], ereignisse = [];
    for await (const h of dir.values()){
      if (h.kind !== 'file' || !/^rueckmeldung-[0-9a-zA-Z-]+\.json$/.test(h.name)) continue;
      let e; try{ e = await jsonLesen(dir, h.name); }catch(x){ fehler.push(`${projektName}: frühere Übergabe ${h.name}: ${x.message}`); continue; }
      if (!e || e.format !== ALT || e.orderId !== id || !gueltigeZeit(e.at) || !e.payload) continue;
      ereignisse.push(e);
    }
    // Zeitlich ordnen, bevor sie wirken: „revise“ ändert Word, Empfänger und Hinweis – die letzte Fassung muss zuletzt kommen,
    // unabhängig davon, in welcher Reihenfolge das Dateisystem die Dateien liefert.
    ereignisse.sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));
    for (const e of ereignisse){
      const v = (schritt, mehr = {}) => vermerke.push({ id: e.id + (mehr.empfaenger ? ':' + mehr.empfaenger : ''), aufgabe: id, zeit: e.at, von: text(e.actor, 40), schritt, wert: true, empfaenger: '', text: '', pdf: '', stand: '', datum: '', ...mehr });
      const p = e.payload;
      switch (e.type){
        case 'claim': v('uebernommen'); break;
        case 'proof': v('gegenlesen'); break;
        case 'pdf': v('pdf', { pdf: text(p.path, 400) }); break;
        case 'send': for (const r of Array.isArray(p.ids) ? p.ids : []) v('versand', { empfaenger: text(r, 80), datum: gueltigesDatum(p.date) ? p.date : '' }); break;
        case 'question': v('frage', { text: text(p.text) }); break;
        case 'answer': v('antwort', { text: text(p.text) }); break;
        case 'withdraw': v('geloescht', { text: text(p.text) }); break;
        case 'correct':
          if (p.step === 'proof') v('gegenlesen', { wert: false });
          else if (p.step === 'pdf') v('pdf', { wert: false });
          else if (p.step === 'send') v('versand', { wert: false, empfaenger: text(p.recipient, 80) });
          break;
        case 'revise':   // neue Fassung der Übergabe: Word und Empfänger wie dort, Gegenlesen und PDF wieder offen
          if (p.content){ aufgabe.word = text(p.content.word, 400) || aufgabe.word; const r = empfaengerPruefen(p.content.recipients); if (r.length) aufgabe.empfaenger = r; aufgabe.hinweis = text(p.content.note) || aufgabe.hinweis; }
          v('gegenlesen', { wert: false }); v('pdf', { wert: false });
          break;
      }
    }
    return { aufgabe, vermerke };
  }catch(e){ fehler.push(`${projektName}: frühere Übergabe ${id}: ${e.message}`); return null; }
}

/* ---------- Stand berechnen ---------- */
const reihenfolge = (a, b) => a.zeit.localeCompare(b.zeit) || a.id.localeCompare(b.id);
/** Stand einer Aufgabe aus ihren Vermerken. Jeder Schritt (Versand: je Empfänger) = neuester Vermerk dazu.
    erledigt = versandt (wie bisher); abgeschlossen = versandt und – bei Übergaben über BüroKit – abgerechnet. */
function zustand(projekt, aufgabe, alleVermerke){
  const verlauf = alleVermerke.filter(v => v.aufgabe === aufgabe.id).sort(reihenfolge);
  const letzter = new Map();
  for (const v of verlauf) letzter.set(v.schritt + (v.schritt === 'versand' ? ':' + v.empfaenger : ''), v);
  const haken = k => { const v = letzter.get(k); return v && v.wert ? { von: v.von, zeit: v.zeit, pdf: v.pdf, stand: v.stand, datum: v.datum } : null; };
  const versand = {};
  for (const r of aufgabe.empfaenger){ const h = haken('versand:' + r.id); if (h) versand[r.id] = h; }
  // Rückfrage: offen, wenn die letzte Frage/Antwort eine Frage ist
  const dialog = verlauf.filter(v => v.schritt === 'frage' || v.schritt === 'antwort');
  const zuletzt = dialog[dialog.length - 1];
  const frage = zuletzt && zuletzt.schritt === 'frage' && zuletzt.wert ? { text: zuletzt.text, von: zuletzt.von, zeit: zuletzt.zeit } : null;
  const faelligV = letzter.get('faellig'), faellig = faelligV ? (faelligV.wert ? faelligV.datum : '') : aufgabe.faellig;
  const gegenlesen = haken('gegenlesen'), pdf = haken('pdf'), uebernommen = haken('uebernommen');
  const ausdruecklich = letzter.get('erledigt');
  const schritteFertig = aufgabe.art === 'gutachten' && !!gegenlesen && !!pdf && aufgabe.empfaenger.every(r => versand[r.id]);
  const erledigt = ausdruecklich ? ausdruecklich.wert : schritteFertig;
  const geloescht = !!(letzter.get('geloescht') || {}).wert;
  const relevant = verlauf.filter(v => v.schritt !== 'frage' && v.schritt !== 'antwort' && v.schritt !== 'faellig');
  const erledigtAm = erledigt ? (ausdruecklich && ausdruecklich.wert ? ausdruecklich.zeit : (relevant[relevant.length - 1] || {}).zeit || aufgabe.erstellt) : '';
  const rechnungNoetig = aufgabe.art === 'gutachten' && !aufgabe.alt, rechnung = rechnungNoetig ? haken('rechnung') : null;
  const abgeschlossen = !geloescht && erledigt && (!rechnungNoetig || !!rechnung);
  const abgeschlossenAm = abgeschlossen ? [erledigtAm, rechnung ? rechnung.zeit : ''].sort().pop() : '';
  const status = geloescht ? 'Zurückgezogen' : erledigt ? 'Erledigt' : frage ? 'Rückfrage' : (gegenlesen || pdf || Object.keys(versand).length || uebernommen) ? 'In Bearbeitung' : 'Neu';
  return { ...aufgabe, projekt, faellig, gegenlesen, pdf, versand, uebernommen, frage, erledigt, erledigtAm, rechnungNoetig, rechnung, abgeschlossen, abgeschlossenAm, geloescht, status, verlauf };
}

/* ---------- lesen ---------- */
/** Alle Aufgaben eines Projektordners: {aufgaben, fehler}. Fehlerhafte Einzeldateien werden genannt, der Rest gezeigt. */
async function projektLesen(projektDir){
  const name = nfc(projektDir.name), fehler = [], aufgaben = [], vermerke = [];
  const projekt = { name, nr: nr(name) };
  const b = await unter(projektDir, DIR, false);
  if (!b) return { projekt, aufgaben, fehler };
  for await (const h of b.values()){
    if (h.kind !== 'directory') continue;
    if (h.name === AUFGABEN){
      for await (const f of h.values()){
        if (f.kind !== 'file' || !f.name.endsWith('.json')) continue;
        try{ aufgaben.push(aufgabePruefen(await jsonLesen(h, f.name), f.name.slice(0, -5), name)); }catch(e){ fehler.push(`${name}: Aufgabe ${f.name}: ${e.message}`); }
      }
    } else if (h.name === VERMERKE){
      for await (const f of h.values()){
        if (f.kind !== 'file' || !f.name.endsWith('.json')) continue;
        try{ vermerke.push(vermerkPruefen(await jsonLesen(h, f.name), f.name.slice(0, -5))); }catch(e){ fehler.push(`${name}: Vermerk ${f.name}: ${e.message}`); }
      }
    } else if (ID.test(h.name)){
      const alt = await altLesen(h, h.name, name, fehler);
      if (alt){ aufgaben.push(alt.aufgabe); vermerke.push(...alt.vermerke); }
    }
  }
  return { projekt, aufgaben: aufgaben.map(a => zustand(projekt, a, vermerke)).sort((a, b) => a.erstellt.localeCompare(b.erstellt)), fehler };
}
/** Alle Projekte im Archivordner mit Büroaufgaben. Nur Ordnernamen und die kleinen „_Buero“-Dateien werden gelesen. */
async function archivLesen(archiv, fortschritt){
  const projekte = [], fehler = [], aufgaben = [];
  for await (const h of archiv.values()) if (h.kind === 'directory' && nr(h.name)) projekte.push(h);
  let i = 0;
  for (const p of projekte){
    if (fortschritt) fortschritt(++i, projekte.length);
    try{
      if (!(await unter(p, DIR, false))) continue;
      const r = await projektLesen(p);
      aufgaben.push(...r.aufgaben); fehler.push(...r.fehler);
    }catch(e){ fehler.push(`${p.name}: ${e.message}`); }
  }
  return { aufgaben, fehler, projekte: projekte.map(p => nfc(p.name)).sort((a, b) => b.localeCompare(a, 'de', { numeric: true })) };
}

/* ---------- schreiben ---------- */
function projektPruefen(projektDir){
  if (!nr(projektDir.name)) throw Error(`„${projektDir.name}“ ist kein Projektordner (z. B. „26.0123 Köln“).`);
}
/** Neue Aufgabe anlegen. a: {art, titel, von, fuer?, faellig?, hinweis?, word?, empfaenger?: [{gruppe, label, details}], anlagen?: [Pfad oder Text]} */
async function aufgabeAnlegen(projektDir, a){
  projektPruefen(projektDir);
  if (!['gutachten', 'eigene'].includes(a.art)) throw Error('Unbekannte Aufgabenart.');
  if (!String(a.von || '').trim()) throw Error('Bitte ein Kürzel angeben (wer legt die Aufgabe an?).');
  if (a.art === 'eigene' && !String(a.titel || '').trim()) throw Error('Bitte beschreiben, was zu tun ist.');
  if (a.faellig && !gueltigesDatum(a.faellig)) throw Error('Ungültiges Fälligkeitsdatum.');
  const empfaenger = (a.empfaenger || []).map(r => ({ id: uid(), gruppe: text(r.gruppe, 40), label: text(r.label, 120), details: text(r.details).trim() })).filter(r => r.details);
  if (a.art === 'gutachten' && !empfaenger.length) throw Error('Mindestens einen Empfänger mit Anschrift oder E-Mail angeben.');
  const anlagen = anlagenPruefen(a.anlagen);
  const name = nfc(projektDir.name);
  const o = { format: FORMAT, version: VERSION, typ: 'aufgabe', id: uid(), erstellt: new Date().toISOString(), von: text(a.von, 40).trim(),
    projekt: { name, nr: nr(name) }, art: a.art, titel: text(a.titel, 300).trim() || (a.art === 'gutachten' ? 'Gutachten' : ''),
    ...(a.fuer ? { fuer: text(a.fuer, 40).trim() } : {}), ...(a.faellig ? { faellig: a.faellig } : {}), ...(a.hinweis && a.hinweis.trim() ? { hinweis: text(a.hinweis).trim() } : {}),
    ...(a.word ? { word: text(a.word, 400) } : {}), ...(empfaenger.length ? { empfaenger } : {}), ...(anlagen.length ? { anlagen } : {}) };
  await neuSchreiben(await unter(await unter(projektDir, DIR, true), AUFGABEN, true), o.id + '.json', o);
  return o;
}
/** Haken setzen oder wegnehmen. v: {aufgabe, schritt, wert?, von, empfaenger?, text?, pdf?, stand?, datum?}
    stand: beim Haken „Rechnung“ der BelegKit-Stand, nach dem abgerechnet wurde („Abrechnung/26.0123_Aufwand_2026-10-28.json“). */
async function vermerken(projektDir, v){
  projektPruefen(projektDir);
  if (!VERMERK_ARTEN.includes(v.schritt)) throw Error('Unbekannter Schritt.');
  if (!String(v.von || '').trim()) throw Error('Bitte oben dein Kürzel wählen.');
  if (typeof v.aufgabe !== 'string' || !ID.test(v.aufgabe)) throw Error('Unbekannte Aufgabe.');
  if (v.schritt === 'versand' && !v.empfaenger) throw Error('Empfänger fehlt.');
  if ((v.schritt === 'frage' || v.schritt === 'antwort') && !String(v.text || '').trim()) throw Error('Bitte einen Text eingeben.');
  if (v.datum && !gueltigesDatum(v.datum)) throw Error('Ungültiges Datum.');
  const o = { format: FORMAT, version: VERSION, typ: 'vermerk', id: uid(), aufgabe: v.aufgabe, zeit: new Date().toISOString(), von: text(v.von, 40).trim(),
    schritt: v.schritt, wert: v.wert !== false, ...(v.empfaenger ? { empfaenger: text(v.empfaenger, 80) } : {}), ...(v.text ? { text: text(v.text).trim() } : {}),
    ...(v.pdf ? { pdf: text(v.pdf, 400) } : {}), ...(v.stand ? { stand: text(v.stand, 400) } : {}), ...(v.datum ? { datum: v.datum } : {}) };
  await neuSchreiben(await unter(await unter(projektDir, DIR, true), VERMERKE, true), o.id + '.json', o);
  return o;
}

/* ---------- Hilfen für die Apps ---------- */
/** Empfänger-Vorschlag aus _Projekt.json (Auftraggeber und beteiligte Sachverständige angehakt, wenn eingetragen). */
function empfaengerVorschlag(pj){
  const d = pj && typeof pj === 'object' ? pj : {};
  return GRUPPEN.map(([gruppe, label, feld], i) => { const details = typeof d[feld] === 'string' ? d[feld].trim() : ''; return { gruppe, label, details, an: i < 2 && !!details }; });
}
/** Stand für Durchlaufzeiten und Auslastung der Projektzentrale (Form der früheren Büroübergaben). */
function alsDurchlauf(aufgaben){
  return aufgaben.filter(a => a.art === 'gutachten').map(a => ({ order: { created: a.erstellt }, withdrawn: a.geloescht, status: a.geloescht ? 'Zurückgezogen' : a.status,
    sent: Object.fromEntries(Object.entries(a.versand).map(([k, v]) => [k, { date: v.datum || String(v.zeit).slice(0, 10) }])) }));
}
/** Offene Schritte als kurzer Text („Gegenlesen · PDF · Versand 1/3 · Rechnung“). */
function offenText(a){
  if (a.geloescht) return 'zurückgezogen';
  const rechnung = a.rechnungNoetig && !a.rechnung && 'Rechnung';
  if (a.erledigt) return rechnung || 'erledigt';
  if (a.art !== 'gutachten') return 'offen';
  const n = a.empfaenger.length, v = Object.keys(a.versand).length;
  return [!a.gegenlesen && 'Gegenlesen', !a.pdf && 'PDF', v < n && (v ? `Versand ${v}/${n}` : 'Versand'), rechnung].filter(Boolean).join(' · ') || 'erledigt';
}

const api = { FORMAT, VERSION, DIR, SCHRITTE, GRUPPEN, projektLesen, archivLesen, aufgabeAnlegen, vermerken, zustand, empfaengerVorschlag, alsDurchlauf, offenText, gueltigesDatum };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BueroAufgaben = api;
})(typeof window !== 'undefined' ? window : globalThis);
/* BUEROKIT-AUFGABEN-ENDE */
