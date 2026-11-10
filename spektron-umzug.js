/* SPEKTRON-UMZUG v1 – nur Projektzentrale. Verschiebt die App-Daten eines Projekts in den Ordner „_Spektron“
   (Bereiche und Orte aus spektron-ordner.js). Grundsätze:
     • Erst kopieren, zurücklesen und byteweise vergleichen – dann in „_Spektron/_Umzug.json“ vermerken – erst dann löschen.
       Bricht der Umzug dazwischen ab, gilt: ohne Vermerk zählen die Originale, mit Vermerk die Kopien; nichts ist weg.
     • Ein Bereich wird erst vermerkt (= neuer Ort gilt), wenn ALLE seine Dateien fehlerfrei und ohne Konflikt kopiert sind;
       sonst werden die in diesem Lauf angelegten Kopien wieder zurückgenommen (die Originale sind unverändert da), damit der
       nächste Lauf nicht gegen veraltete Kopien vergleicht. Ist er schon vermerkt (Nachzügler), werden nur identische Dateien nachgeholt.
     • Gelöscht wird nur, was nachweislich identisch am neuen Ort liegt UND seit dem Kopieren unverändert ist. Gleicher Name
       mit anderem Inhalt: beide bleiben, wird gemeldet – der Mensch entscheidet.
     • Ein unlesbarer oder fremder Umzugsvermerk stoppt den Umzug des Projekts (wird nie überschrieben); nur eine leere
       Vermerkdatei (unterbrochenes Schreiben) gilt als „kein Vermerk“. Leere Zieldateien in noch nicht vermerkten Bereichen
       (unterbrochenes Kopieren) werden ersetzt; in vermerkten Bereichen zählen sie als Konflikt (eine App könnte sie geleert haben).
     • Nur Dateien der Apps (passt() je Bereich). Fotos, Excel, PDF, Word, CSV, Laborberichte werden nie angefasst; Windows-
       Beiwerk (Thumbs.db, desktop.ini, .DS_Store, *.crswap) wird übergangen und bleibt liegen.
     • Büro-Ordner bleiben bestehen; nur leer gewordene App-Ordner werden entfernt – nie rekursiv, nur wenn wirklich leer.
     • Wiederholbar: Ein erneuter Lauf findet nur noch Nachzügler und räumt leere Reste auf. Jede Datei, jeder Konflikt und jeder
       Fehler steht mit Uhrzeit in <Archiv>/_Spektron-Umzug.log (wird nach jedem Bereich geschrieben, nicht erst am Ende).
     • Sperren: eine je Projekt für den ganzen Umzug („spektron:umzug:<Name>“, gegen zwei Projektzentrale-Tabs) und zusätzlich
       dieselben wie die Apps („mosaik:projekt:<Name>“, „plankit:project:<Name>“, „belegkit:zeiten:<Nr>:<Kürzel>“). Die anderen
       Apps kennen keine Sperre – darum vor dem Umzug alle Spektron-Tabs schließen; was trotzdem dazwischen schreibt, wird
       durch den Vergleich vor dem Löschen erkannt und behalten (auch am neuen Ort: eine fremde Datei wird nie entfernt).
       Sperren gelten nur im selben Browserprofil – den Umzug führt eine Person an einem Rechner aus. Auf eine belegte Sperre
       wird höchstens 20 s gewartet; dann wird der Bereich (bzw. das Projekt) übersprungen und gemeldet, nichts hängt.
     • Vor jedem Löschen wird auch die Kopie am neuen Ort noch einmal gelesen: fehlt sie oder ist sie anders, bleibt das Original.
     • Dateien eines Bereichs werden in der Reihenfolge ihres Änderungsdatums kopiert (älteste zuerst), damit „neueste Datei“
       (z. B. die LabelKit-Tagesdateien) auch nach dem Umzug dieselbe ist – die Kopien bekommen ja neue Zeitstempel.
     • Seit K1 (10.11.2026) gilt in den Apps der neue Ort, sobald dort etwas liegt. Damit ein abgebrochener Umzug nicht halbe
       Kopien gelten lässt, steht vor dem Kopieren eines Bereichs „laeuft: { <bereich>: Zeit }“ im Vermerk; erst mit dem
       Vermerk (oder der Rücknahme) wird es wieder entfernt. Solange es dasteht, gelten in den Apps die Originale.
     • Liegt ein Bereich schon in „_Spektron“ (ohne Vermerk, ohne „laeuft“) und am früheren Ort nur eine abweichende Datei
       (z. B. eine dorthin kopierte oder heruntergeladene), wird sie NICHT hereingeholt – sonst würde eine alte Datei mit neuem
       Zeitstempel zur „neuesten“. Gemeldet, der Mensch entscheidet (zweiOrtePruefen sagt, wie es aussieht).
   Läuft im Browser (globalThis.SpektronUmzug) und in Node (module.exports, Tests). */
(function(root){
'use strict';

const SO = () => root.SpektronOrdner;
const nfc = s => String(s == null ? '' : s).normalize('NFC');
const gleichName = (a, b) => nfc(a).toLowerCase() === nfc(b).toLowerCase();
async function sha256(bytes){
  const c = (root.crypto || globalThis.crypto).subtle;
  return Array.from(new Uint8Array(await c.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
}
const bytesGleich = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
async function lesen(fh){ return new Uint8Array(await (await fh.getFile()).arrayBuffer()); }
async function kind(dir, name){ for await (const h of dir.values()) if (gleichName(h.name, name)) return h; return null; }
const BEIWERK = /^(thumbs\.db|desktop\.ini|\.ds_store)$|\.crswap$/i;   // Windows/Chrome-Beiwerk: nie kopieren, nie löschen
const jetzt = () => new Date().toISOString();
/** Datei anlegen und schreiben. Schlägt das Schreiben fehl, wird die dabei entstandene leere Datei wieder entfernt
    (nur eine leere – etwas anderes wird nie angefasst). Wird nur für nicht vorhandene bzw. leere Ziele aufgerufen. */
async function schreiben(dir, name, bytes){
  const h = await dir.getFileHandle(name, { create: true });
  let w; try{ w = await h.createWritable(); await w.write(bytes); await w.close(); }
  catch(e){ try{ if (w) await w.abort(); }catch(_){} try{ if (!(await lesen(h)).length) await dir.removeEntry(h.name); }catch(_){} throw e; }
  return h;
}
const WARTEN = 20000;   // ms: so lange höchstens auf eine Sperre warten
/** Sperre holen, aber nie endlos warten: ist sie nach `warten` ms noch belegt, Fehler (belegt: true) – fn läuft dann nicht. */
function locked(name, fn, warten){
  const L = api._locks || (root.navigator && root.navigator.locks);
  if (!L) return fn();
  const ms = warten == null ? WARTEN : warten, opt = {};
  let uhr = null, gestartet = false;
  if (ms > 0 && typeof AbortController !== 'undefined'){ const ac = new AbortController(); opt.signal = ac.signal; uhr = setTimeout(() => ac.abort(), ms); }
  return L.request(name, opt, () => { gestartet = true; clearTimeout(uhr); return fn(); }).catch(e => {
    clearTimeout(uhr);
    if (!gestartet && e && (e.name === 'TimeoutError' || e.name === 'AbortError'))
      throw Object.assign(Error('„' + name + '“ ist belegt – eine Spektron-App arbeitet gerade an diesem Projekt. Übersprungen; bitte die App schließen und den Umzug erneut ausführen.'), { belegt: true });
    throw e;
  });
}
/** Sperren der Apps je Bereich – wie in project-store.js, PlanKit und time-store.js. */
function sperre(bereich, projektName, projektNr, datei, fn, warten){
  // Projektnamen wie die Apps (roher Ordnername) und zusätzlich NFC-normalisiert, falls beides vorkommt
  const beide = (praefix, f) => { const a = praefix + projektName.roh, b = praefix + projektName.nfc; return a === b ? locked(a, f, warten) : locked(a, () => locked(b, f, warten), warten); };
  if (bereich === 'projekt') return beide('mosaik:projekt:', fn);
  if (bereich === 'plankit') return beide('plankit:project:', fn);
  if (bereich === 'belegkit' && datei){ const m = /^Aufwand_([^.]+)\.json$/i.exec(datei); if (m) return locked('belegkit:zeiten:' + projektNr + ':' + m[1].toUpperCase(), fn, warten); }
  return fn();
}
const pause = ms => new Promise(r => setTimeout(r, ms));
const projektNr = name => (/^(\d{2}\.\d{2,6})(?:[\s_-]|$)/.exec(nfc(name)) || [])[1] || '';

/** Alle Dateien unter einem Eintrag (Datei oder Ordner) als [{pfad:[...], handle}] – rekursiv, über die Handles selbst
    (kein erneutes Auflisten je Kind; NFC/NFD-Zwillinge bleiben getrennt). Beiwerk wird übergangen. */
async function dateienVon(dir, name, pfad, aus){
  const h = await kind(dir, name);
  return h ? dateienAb(h, pfad, aus) : aus;
}
async function dateienAb(h, pfad, aus){
  if (BEIWERK.test(h.name)) return aus;
  if (h.kind === 'file'){ aus.push({ pfad: pfad.concat(h.name), handle: h }); return aus; }
  for await (const x of h.values()) await dateienAb(x, pfad.concat(h.name), aus);
  return aus;
}
const unterordner = (dir, pfad, anlegen) => SO().unter(dir, pfad, anlegen);   // dieselbe Auflösung wie in spektron-ordner.js
/** Leere Unterordner von unten nach oben entfernen (nie rekursiv löschen); den Ordner selbst nur, wenn er danach leer ist. */
async function leereOrdnerEntfernen(parent, name){
  const h = await kind(parent, name); if (!h || h.kind !== 'directory') return false;
  const d = await parent.getDirectoryHandle(h.name);
  const kinder = []; for await (const x of d.values()) kinder.push(x);   // erst sammeln, dann ändern (Iterator nicht unter Änderung)
  for (const x of kinder) if (x.kind === 'directory') await leereOrdnerEntfernen(d, x.name);
  for await (const _ of d.values()) return false;
  try{ await parent.removeEntry(h.name); return true; }catch(e){ return false; }
}
const LEER = () => ({ format: 'spektron-umzug', version: 1, bereiche: {} });
/** Vermerk lesen: fehlt oder leer → neuer Vermerk; sonst muss er lesbar und von diesem Format sein, sonst Abbruch. */
async function vermerkLesen(sp){
  const h = await kind(sp, SO().MARKER);
  if (!h) return LEER();
  if (h.kind !== 'file') throw Error('„' + SO().MARKER + '“ ist ein Ordner – bitte prüfen.');
  const bytes = await lesen(h);
  if (!bytes.length) return LEER();   // unterbrochenes Schreiben
  let o; try{ o = JSON.parse(new TextDecoder().decode(bytes)); }catch(e){ throw Error('„' + SO().MARKER + '“ ist nicht lesbar (' + e.message + ') – nichts verändert, bitte prüfen.'); }
  if (!o || o.format !== 'spektron-umzug' || typeof o.version !== 'number' || !o.bereiche || typeof o.bereiche !== 'object') throw Error('„' + SO().MARKER + '“ hat ein unbekanntes Format – nichts verändert, bitte prüfen.');
  if (o.version > 1) throw Error('„' + SO().MARKER + '“ stammt von einer neueren Projektzentrale – bitte aktualisieren.');
  return o;
}
async function vermerkSchreiben(sp, o){
  const bytes = new TextEncoder().encode(JSON.stringify(o, null, 1) + '\n');
  const h = await schreiben(sp, SO().MARKER, bytes);
  if (!bytesGleich(await lesen(h), bytes)) throw Error('Umzugsvermerk konnte nicht bestätigt werden.');
}

/** „laeuft“ für einen Bereich setzen (an=true) oder entfernen – frisch gelesen, innerhalb der Projekt-Sperre. */
async function laeuftSetzen(sp, bereich, an, zeit){
  const v = await vermerkLesen(sp);
  const l = v.laeuft && typeof v.laeuft === 'object' ? Object.assign({}, v.laeuft) : {};
  if (an) l[bereich] = zeit; else delete l[bereich];
  if (Object.keys(l).length) v.laeuft = l; else delete v.laeuft;
  await vermerkSchreiben(sp, v);
  return v;
}

/**
 * Wie sieht es aus, wo ein Bereich an beiden Orten Einträge hat? Nur lesen. Je Bereich:
 *   art 'nachzuegler'  – Umzug vermerkt, am früheren Ort danach noch geschrieben (es gilt „_Spektron“, wie bisher)
 *   art 'unterbrochen' – Umzug begonnen („laeuft“) oder es liegen gleiche bzw. leere Kopien in „_Spektron“: sieht nach einem
 *                        abgebrochenen Umzug aus → „Umzug erneut ausführen“ holt nach, was fehlt
 *   art 'streu'        – „_Spektron“ hat eigene Daten, am früheren Ort liegt nur Abweichendes (kopiert, heruntergeladen,
 *                        von einer alten App-Fassung gespeichert) → von Hand prüfen, der Umzug holt es nicht herein
 *   art 'leer'         – am früheren Ort nur leere Ordner (harmlos; ein Umzug räumt sie weg)
 * dateien: [{ pfad, stand:'gleich'|'neuLeer'|'anders'|'nurAlt'|'nurNeu', altZeit, neuZeit }]
 */
async function zweiOrtePruefen(projektDir){
  const S = SO(), aus = [];
  if (!(await S.istSpektronProjekt(projektDir))) return aus;
  const sp = await S.spektronDir(projektDir, false); if (!sp) return aus;
  let v = null; try{ v = await vermerkLesen(sp); }catch(e){ v = null; }
  for (const id of Object.keys(S.BEREICHE)){
    const b = S.BEREICHE[id];
    const altDir = await unterordner(projektDir, b.alt, false), neuDir = await unterordner(sp, b.neu, false);
    if (!altDir || !neuDir) continue;
    const eintr = async d => { const r = []; for await (const h of d.values()) if (b.passt(h.name, h.kind)) r.push(h.name); return r; };
    const altE = await eintr(altDir), neuE = await eintr(neuDir);
    if (!altE.length || !neuE.length) continue;
    const sammeln = async (d, namen) => { const f = []; for (const n of namen) await dateienVon(d, n, [], f); const m = new Map(); for (const x of f) m.set(nfc(x.pfad.join('/')).toLowerCase(), x); return m; };
    const alt = await sammeln(altDir, altE), neu = await sammeln(neuDir, neuE);
    const zeit = async h => { try{ return (await h.getFile()).lastModified || 0; }catch(e){ return 0; } };
    const dateien = [];
    for (const [k, a] of alt){
      const n = neu.get(k), d = { pfad: a.pfad.join('/'), altZeit: await zeit(a.handle), neuZeit: n ? await zeit(n.handle) : 0 };
      if (!n) d.stand = 'nurAlt';
      else { const ab = await lesen(a.handle), nb = await lesen(n.handle); d.stand = bytesGleich(ab, nb) ? 'gleich' : (!nb.length && ab.length ? 'neuLeer' : 'anders'); }
      dateien.push(d);
    }
    for (const [k, n] of neu) if (!alt.has(k)) dateien.push({ pfad: n.pfad.join('/'), stand: 'nurNeu', altZeit: 0, neuZeit: await zeit(n.handle) });
    const vermerkt = !!(v && v.bereiche[id]), laeuft = !!(v && v.laeuft && v.laeuft[id]);
    // Gilt laut ort() noch der frühere Ort (z. B. in „_Spektron“ nur eine Sicherung oder ein leerer Ordner, keine Hauptdatei),
    // ist das ein unvollständiger Umzug – nie eine Streudatei, sonst könnte der Umzug ihn nicht mehr nachholen.
    let wo = 'neu'; try{ wo = (await S.ort(projektDir, id)).wo; }catch(e){}
    const art = vermerkt ? 'nachzuegler' : laeuft || wo === 'alt' || dateien.some(d => d.stand === 'gleich' || d.stand === 'neuLeer') ? 'unterbrochen'
      : !dateien.some(d => d.stand === 'nurAlt' || d.stand === 'anders') ? 'leer' : 'streu';
    aus.push({ bereich: id, app: b.app, von: b.alt.join('/'), nach: [S.ORDNER].concat(b.neu).join('/'), art, vermerkt, laeuft, dateien });
  }
  return aus;
}

/**
 * Ein Projekt umziehen. optionen: { von (Kürzel), trocken (nur planen), log(zeile), sichern() (Log nach jedem Bereich schreiben), fortschritt(text),
 *   sperreWarten (ms, Standard 20000), zeitstempelWarten (ms, Standard 4000) }.
 * Ergebnis: { projekt, bereiche: [{bereich, app, von, nach, eintraege, kopiert, geloescht, uebersprungen, konflikte:[...], fehler:[...]}], fehler:[...] }
 */
async function projektUmziehen(projektDir, optionen){
  const o = optionen || {}, S = SO(), log = o.log || (() => {}), sichern = o.sichern || (async () => {}), fortschritt = o.fortschritt || (() => {});
  const warten = o.sperreWarten == null ? WARTEN : o.sperreWarten, zeitWarten = o.zeitstempelWarten == null ? 4000 : o.zeitstempelWarten;
  const name = nfc(projektDir.name), namen = { roh: String(projektDir.name), nfc: name }, nr = projektNr(name), ergebnis = { projekt: name, bereiche: [], fehler: [] };
  if (!S) throw Error('spektron-ordner.js ist nicht geladen.');
  if (!(await S.istSpektronProjekt(projektDir))){ ergebnis.fehler.push('Kein Spektron-Projekt (Nummer unter ' + S.AB + ' und kein „_Spektron“-Ordner).'); return ergebnis; }
  const liste = await S.umzugListe(projektDir);
  if (o.trocken){ for (const l of liste) ergebnis.bereiche.push({ bereich: l.bereich, app: l.app, von: l.von || '(Projektordner)', nach: l.nach, eintraege: l.eintraege.map(e => e.name + (e.art === 'directory' ? '/' : '')), kopiert: 0, geloescht: 0, uebersprungen: 0, konflikte: [], fehler: [] }); return ergebnis; }
  try{ await locked('spektron:umzug:' + name, async () => {
    let sp, vermerk, vermerkWarDa = true;
    const lage = new Map();   // Bereich → Art aus zweiOrtePruefen (vor dem ersten Schreiben ermittelt)
    try{
      sp = await S.spektronDir(projektDir, false);            // erst prüfen, ob ein vorhandener Vermerk lesbar ist – vorher nichts anlegen
      vermerk = sp ? await vermerkLesen(sp) : LEER();
      sp = await S.spektronDir(projektDir, true);             // legt „_Spektron“ und die Hinweisdatei an (z. B. Datei namens „_Spektron“ → Fehler)
      vermerkWarDa = !!(await kind(sp, S.MARKER));
    }catch(e){ ergebnis.fehler.push(e.message); log([jetzt(), name, '', '', 'ABBRUCH – ' + e.message, ''].join(' | ')); await sichern(); return; }
    try{ for (const x of await zweiOrtePruefen(projektDir)) lage.set(x.bereich, x); }catch(e){ /* dann wie bisher je Datei vergleichen */ }
    const zeit = jetzt();   // Beginn des Laufs (steht im Vermerk); jede Logzeile trägt ihre eigene Uhrzeit
    log([zeit, name, '', '', 'Umzug begonnen (' + liste.length + ' Bereiche)', ''].join(' | '));
    for (const l of liste){
      const b = S.BEREICHE[l.bereich], r = { bereich: l.bereich, app: l.app, von: l.von || '(Projektordner)', nach: l.nach, eintraege: l.eintraege.map(e => e.name + (e.art === 'directory' ? '/' : '')), kopiert: 0, geloescht: 0, uebersprungen: 0, konflikte: [], fehler: [] };
      ergebnis.bereiche.push(r);
      try{
        await sperre(l.bereich, namen, nr, null, async () => {
          const altDir = await unterordner(projektDir, b.alt, false);
          if (!altDir) return;
          const schonVermerkt = !!vermerk.bereiche[l.bereich];
          // Bereich lebt schon in „_Spektron“ (ohne Vermerk, kein abgebrochener Umzug): Abweichendes am früheren Ort nicht hereinholen
          const x = lage.get(l.bereich);
          if (!schonVermerkt && x && x.art === 'streu'){
            for (const d of x.dateien) if (d.stand === 'anders' || d.stand === 'nurAlt'){
              r.konflikte.push({ datei: d.pfad, streu: true, altNeuer: d.altZeit > d.neuZeit, alt: d.altZeit ? new Date(d.altZeit).toISOString() : '', neu: d.neuZeit ? new Date(d.neuZeit).toISOString() : '',
                hinweis: 'liegt schon in „' + S.ORDNER + '“ – die Datei am früheren Ort wird nicht übernommen' });
              log([jetzt(), name, l.bereich, d.pfad, 'NICHT ÜBERNOMMEN – Bereich liegt schon in ' + S.ORDNER + ', Datei am früheren Ort bitte prüfen', ''].join(' | '));
            }
            return;
          }
          const neuDir = await unterordner(sp, b.neu, true);
          // vor dem ersten Kopieren: „laeuft“ vermerken – bricht der Lauf ab, gelten in den Apps weiter die Originale
          if (!schonVermerkt) vermerk = await laeuftSetzen(sp, l.bereich, true, zeit);
          // 1. alle Dateien sammeln, kopieren und prüfen – nichts löschen
          const dateien = [];
          for (const e of l.eintraege) await dateienVon(altDir, e.name, [], dateien);
          // älteste zuerst kopieren: die Kopien bekommen neue Zeitstempel in Kopierreihenfolge – so bleibt „neueste Datei“ dieselbe
          for (const f of dateien){ try{ f.zeit = (await f.handle.getFile()).lastModified; }catch(e){ f.zeit = 0; } }
          dateien.sort((a, b) => a.zeit - b.zeit);
          let letzteQuelle = -Infinity, letzteKopie = -Infinity;
          const geprueft = [], angelegt = [];   // angelegt: in diesem Lauf neu geschriebene Kopien (für die Rücknahme)
          for (const f of dateien){
            const rel = f.pfad.join('/'); fortschritt(name + ': ' + l.von + '/' + rel);
            try{
              const bytes = await lesen(f.handle);
              const zielDir = await unterordner(neuDir, f.pfad.slice(0, -1), true), zielName = f.pfad[f.pfad.length - 1];
              let vorhanden = await kind(zielDir, zielName);
              if (vorhanden && vorhanden.kind !== 'file') throw Error('am neuen Ort liegt ein Ordner gleichen Namens');
              // leere Zieldatei: vor dem Vermerk ein unterbrochenes Kopieren → ersetzen; nach dem Vermerk könnte eine App sie geleert haben → Konflikt
              if (vorhanden && !schonVermerkt && !(await lesen(vorhanden)).length) vorhanden = null;
              if (vorhanden){
                const da = await lesen(vorhanden);
                if (!bytesGleich(da, bytes)){
                  const alt = await f.handle.getFile(), neu = await vorhanden.getFile();
                  r.konflikte.push({ datei: rel, alt: new Date(alt.lastModified).toISOString(), neu: new Date(neu.lastModified).toISOString(), altNeuer: alt.lastModified > neu.lastModified });
                  log([jetzt(), name, l.bereich, rel, 'KONFLIKT – beide bleiben', ''].join(' | ')); continue;
                }
                r.uebersprungen++; geprueft.push({ f, bytes, zielDir, zielName }); log([jetzt(), name, l.bereich, rel, 'schon identisch am neuen Ort', ''].join(' | ')); continue;
              }
              let h = await schreiben(zielDir, zielName, bytes), zurueck = await lesen(h);
              // Ist das Original jünger als das vorige, muss es auch die Kopie sein (gleicher Zeitstempel → warten, neu schreiben).
              // Reicht auch für Laufwerke mit grober Zeitauflösung (FAT: 2 s); klappt es nicht, ist das ein Fehler: Bereich wird
              // nicht vermerkt, Kopien zurückgenommen, nichts gelöscht.
              if (bytesGleich(zurueck, bytes) && f.zeit > letzteQuelle){
                const bis = Date.now() + zeitWarten;
                for (let w = 50; (await h.getFile()).lastModified <= letzteKopie; w = Math.min(w * 2, 1000)){
                  if (Date.now() >= bis){ angelegt.push({ zielDir, zielName, bytes, rel }); throw Error('Kopie bekommt keinen neueren Zeitstempel als die vorige (Laufwerk mit grober Zeitauflösung?) – Reihenfolge „neueste Datei“ wäre nicht sicher'); }
                  await pause(w); h = await schreiben(zielDir, zielName, bytes); zurueck = await lesen(h); if (!bytesGleich(zurueck, bytes)) break;
                }
              }
              if (!bytesGleich(zurueck, bytes)){
                // Nur die eigene, unvollständige Kopie (leer) entfernen. Steht etwas anderes drin, hat eine App gleichzeitig
                // geschrieben – das bleibt und wird als Konflikt gemeldet.
                if (!zurueck.length){ try{ await zielDir.removeEntry(zielName); }catch(_){} throw Error('Kopie stimmt nicht mit dem Original überein'); }
                r.konflikte.push({ datei: rel, alt: '', neu: '', altNeuer: false, hinweis: 'am neuen Ort gleichzeitig von einer App geschrieben – beide bleiben' });
                log([jetzt(), name, l.bereich, rel, 'KONFLIKT – am neuen Ort gleichzeitig geschrieben, beide bleiben', ''].join(' | ')); continue;
              }
              log([jetzt(), name, l.bereich, rel, 'kopiert ' + bytes.length + ' B', await sha256(bytes)].join(' | '));
              r.kopiert++; geprueft.push({ f, bytes, zielDir, zielName }); angelegt.push({ zielDir, zielName, bytes, rel });
              letzteQuelle = Math.max(letzteQuelle, f.zeit); try{ letzteKopie = Math.max(letzteKopie, (await h.getFile()).lastModified); }catch(_){}
            }catch(e){ r.fehler.push(rel + ': ' + e.message); log([jetzt(), name, l.bereich, rel, 'FEHLER – ' + e.message, ''].join(' | ')); }
          }
          // 2. vermerken – ab jetzt gilt der neue Ort für diesen Bereich. Beim ersten Mal nur, wenn alles fehlerfrei kopiert ist
          //    (auch ein Bereich ohne Dateien – nur leere Ordner – wird vermerkt, damit er aufgeräumt wird und nicht jedes Mal wieder ansteht).
          if (!schonVermerkt){
            if (r.fehler.length || r.konflikte.length){
              geprueft.length = 0;
              // Die eigenen Kopien dieses Laufs zurücknehmen: die Originale sind unverändert da, und beim nächsten Lauf soll
              // nicht gegen eine inzwischen veraltete Kopie verglichen werden. Nur, was noch genau unsere Bytes enthält.
              for (const a of angelegt){
                try{
                  const h = await kind(a.zielDir, a.zielName);
                  if (h && h.kind === 'file' && bytesGleich(await lesen(h), a.bytes)){ await a.zielDir.removeEntry(h.name); r.kopiert--; r.zurueckgenommen = (r.zurueckgenommen || 0) + 1; log([jetzt(), name, l.bereich, a.rel, 'Kopie zurückgenommen (Bereich nicht vermerkt)', ''].join(' | ')); }
                }catch(e){ r.fehler.push(a.rel + ': Kopie nicht zurückgenommen (' + e.message + ')'); }
              }
              for (const e of l.eintraege) if (e.art === 'directory') await leereOrdnerEntfernen(neuDir, e.name);
              if (b.neu.length){ const eltern = await unterordner(sp, b.neu.slice(0, -1), false); if (eltern) await leereOrdnerEntfernen(eltern, b.neu[b.neu.length - 1]); }
              // „laeuft“ nur entfernen, wenn am neuen Ort für diesen Bereich nichts mehr liegt. Bleibt dort etwas (eine App hat
              // gleichzeitig geschrieben, Reste eines früheren Abbruchs), gelten weiter die Originale – sonst würde der neue Ort
              // mit unvollständigen Daten gelten, obwohl der Umzug nicht vermerkt ist.
              let rest = 0; try{ for await (const h of neuDir.values()) if (b.passt(h.name, h.kind)) rest++; }catch(e){}
              if (rest){ log([jetzt(), name, l.bereich, '', '„laeuft“ bleibt – am neuen Ort liegen noch ' + rest + ' Einträge, der frühere Ort gilt weiter', ''].join(' | ')); vermerk = await vermerkLesen(sp); }
              else vermerk = await laeuftSetzen(sp, l.bereich, false);   // nichts mehr „in Arbeit“: am früheren Ort liegt alles wie vorher
            } else {
              vermerk = await vermerkLesen(sp);   // frisch (innerhalb der Projekt-Sperre)
              vermerk.bereiche[l.bereich] = { am: zeit, von: o.von || '', dateien: r.kopiert + r.uebersprungen };
              if (vermerk.laeuft){ delete vermerk.laeuft[l.bereich]; if (!Object.keys(vermerk.laeuft).length) delete vermerk.laeuft; }
              await vermerkSchreiben(sp, vermerk);
              log([jetzt(), name, l.bereich, '', 'vermerkt (' + (r.kopiert + r.uebersprungen) + ' Dateien) – neuer Ort gilt', ''].join(' | '));
            }
          }
          if (!vermerk.bereiche[l.bereich]){ log([jetzt(), name, l.bereich, '', 'NICHT vermerkt – nichts gelöscht (' + r.fehler.length + ' Fehler, ' + r.konflikte.length + ' Konflikte)', ''].join(' | ')); return; }
          // 3. löschen – nur geprüfte Dateien, nur wenn das Original seit dem Kopieren unverändert ist UND die Kopie am neuen Ort
          //    noch da ist und genau diese Bytes enthält (sonst wäre das Original die letzte Fassung)
          for (const { f, bytes, zielDir, zielName } of geprueft){
            const rel = f.pfad.join('/');
            try{
              await sperre(l.bereich === 'belegkit' ? 'belegkit' : '', namen, nr, f.pfad[f.pfad.length - 1], async () => {
                const d = await unterordner(altDir, f.pfad.slice(0, -1), false);
                const noch = d && await kind(d, f.pfad[f.pfad.length - 1]);
                if (!noch) return;
                let kopie = null; try{ kopie = await kind(zielDir, zielName); }catch(_){}
                let kopieOk = false; try{ kopieOk = !!kopie && kopie.kind === 'file' && bytesGleich(await lesen(kopie), bytes); }catch(_){}
                if (!kopieOk){ const hinweis = kopie ? 'Kopie am neuen Ort inzwischen geändert – Original bleibt' : 'Kopie am neuen Ort fehlt – Original bleibt'; r.konflikte.push({ datei: rel, alt: '', neu: '', altNeuer: false, hinweis }); log([jetzt(), name, l.bereich, rel, 'KONFLIKT – ' + hinweis, ''].join(' | ')); return; }
                if (!bytesGleich(await lesen(noch), bytes)){ r.konflikte.push({ datei: rel, alt: '', neu: '', altNeuer: true, hinweis: 'am früheren Ort inzwischen geändert' }); log([jetzt(), name, l.bereich, rel, 'KONFLIKT – am früheren Ort inzwischen geändert, nicht gelöscht', ''].join(' | ')); return; }
                await d.removeEntry(noch.name); r.geloescht++;
                log([jetzt(), name, l.bereich, rel, 'gelöscht am früheren Ort', ''].join(' | '));
              }, warten);
            }catch(e){ r.fehler.push(rel + ': nicht gelöscht (' + e.message + ')'); log([jetzt(), name, l.bereich, rel, 'FEHLER – nicht gelöscht (' + e.message + ')', ''].join(' | ')); }
          }
          // 4. leer gewordene Ordner der Einträge entfernen (z. B. _Projekt_Sicherungen, _FotoKit_Fassungen, aufgaben/, <UUID>/)
          for (const e of l.eintraege) if (e.art === 'directory') await leereOrdnerEntfernen(altDir, e.name);
        }, warten);
        // Ein reiner App-Ordner, der leer wurde (nur „_Buero“ – alle anderen alten Orte sind Büro-Ordner)
        if (l.bereich === 'buero') await leereOrdnerEntfernen(projektDir, b.alt[0]);
      }catch(e){ r.fehler.push(e.message); log([jetzt(), name, l.bereich, '', 'FEHLER – ' + e.message, ''].join(' | ')); }
      await sichern();   // Log nach jedem Bereich auf die Platte – auch bei Absturz steht der bisherige Verlauf da
    }
    // Nur für „laeuft“ angelegter Vermerk, am Ende ohne Inhalt: wieder entfernen (keine neue Datei ohne Grund)
    if (!vermerkWarDa){
      try{ const h = await kind(sp, S.MARKER); if (h && h.kind === 'file'){ const v = await vermerkLesen(sp); if (!Object.keys(v.bereiche).length && !v.laeuft) await sp.removeEntry(h.name); } }catch(e){}
    }
    log([jetzt(), name, '', '', 'Umzug beendet', ''].join(' | ')); await sichern();
  }, warten); }catch(e){
    if (!e || !e.belegt) throw e;
    ergebnis.fehler.push('Das Projekt wird gerade schon umgezogen (anderer Tab) – übersprungen.'); log([jetzt(), name, '', '', 'ÜBERSPRUNGEN – ' + e.message, ''].join(' | ')); await sichern();
  }
  return ergebnis;
}

/** Protokollzeilen in <Archiv>/_Spektron-Umzug.log anhängen (Zusatz – der Umzug selbst hängt nicht davon ab).
    speichern() gibt null zurück oder die Fehlermeldung, wenn das Protokoll nicht geschrieben werden konnte (fehler hält die letzte). */
async function logSchreiber(archivDir){
  const NAME = '_Spektron-Umzug.log', zeilen = [], w = { fehler: null };
  w.zeile = z => zeilen.push(z);
  w.speichern = async () => {
    if (!zeilen.length || !archivDir) return null;
    try{
      await locked('spektron:umzug-log', async () => {
        const h = await archivDir.getFileHandle(NAME, { create: true }), alt = await h.getFile();
        const kopf = alt.size ? '' : 'Spektron-Umzug – je Zeile: Zeit (UTC) | Projekt | Bereich | Datei | Vorgang | SHA-256\r\n';
        const ws = await h.createWritable({ keepExistingData: true });
        await ws.write({ type: 'write', position: alt.size, data: kopf + zeilen.join('\r\n') + '\r\n' }); await ws.close();
      }, 5000);
      zeilen.length = 0; return null;
    }catch(e){ w.fehler = 'Protokoll „' + NAME + '“ nicht geschrieben: ' + e.message; return w.fehler; }   // Zeilen bleiben für den nächsten Versuch
  };
  return w;
}

const api = { projektUmziehen, zweiOrtePruefen, logSchreiber, sha256, _locks: null };   // _locks: nur für Tests (Ersatz für navigator.locks)
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.SpektronUmzug = api;
})(typeof window !== 'undefined' ? window : globalThis);
/* SPEKTRON-UMZUG-ENDE */
