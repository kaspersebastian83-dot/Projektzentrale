/* Spektron Datenarchiv – Lesen aus dem gemeinsamen Archivordner.
   Gelesen wird nur: Projektordner „JJ.Nummer …“, darin _Projekt.json (Nutzung, Brandgut, Schadenereignis) und die Eurofins-XML
   im Unterordner „Laborergebnisse“ (auch eine Ebene tiefer). PDF-Berichte werden in Version 1 nur gezählt.
   Geschrieben wird ausschließlich <Archiv>/_Spektron-Archiv.json (eigene Zuordnungen für Projekte ohne Angabe) – nie Projektdateien.
   Zwischenspeicher im Browser (IndexedDB „spektron-archiv“): bereits gelesene Projekte, solange sich ihre Dateien nicht ändern. */
(function(root){
  'use strict';
  const A = root.ArchivAuswertung;
  const TAGS = '_Spektron-Archiv.json', PJ = '_Projekt.json', MAX_XML = 10 * 1024 * 1024, MAX_PJ = 1024 * 1024;
  const norm = s => String(s || '').normalize('NFC').toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu, '');

  function idb(name, store){
    return new Promise((res, rej) => { const r = indexedDB.open(name, 1); r.onupgradeneeded = () => r.result.createObjectStore(store); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }
  async function idbGet(name, store, key){ const db = await idb(name, store); try{ return await new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); } finally { db.close(); } }
  async function idbPut(name, store, key, value){ const db = await idb(name, store); try{ await new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).put(value, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); } finally { db.close(); } }

  /** Archivordner aus dem gemeinsamen Browser-Speicher der Suite (wie Projektzentrale und BüroKit). */
  const archivAusSpeicher = async () => { try{ const h = await idbGet('mosaik-suite', 'kv', 'archiv'); return h && typeof h.values === 'function' ? h : null; }catch(e){ return null; } };
  const archivMerken = h => idbPut('mosaik-suite', 'kv', 'archiv', h);
  async function recht(h, modus, fragen){
    if (!h.queryPermission) return true;
    let p = await h.queryPermission({ mode: modus }); if (p === 'prompt' && fragen) p = await h.requestPermission({ mode: modus });
    return p === 'granted';
  }

  /** Eurofins-XML (AnalyticalReport) → { bericht, vorlaeufig, proben }. Andere Dateien → null. */
  function xmlLesen(text){
    if (text.length > MAX_XML || /<!DOCTYPE|<!ENTITY/i.test(text)) return null;
    const doc = new DOMParser().parseFromString(text, 'application/xml'), r = doc.documentElement;
    if (doc.getElementsByTagNameNS('*', 'parsererror').length || r.localName !== 'AnalyticalReport') return null;
    const kinder = (el, n) => [...el.children].filter(e => e.localName === n), kind = (el, n) => kinder(el, n)[0], wert = (el, n) => (kind(el, n)?.textContent || '').trim();
    const out = { bericht: (r.getAttribute('AnalyticalReportCode') || '').trim(), vorlaeufig: r.getAttribute('IsPreliminaryReport') === 'true', proben: [] };
    const batches = kind(r, 'Batches');
    for (const b of batches ? kinder(batches, 'Batch') : []){
      const s = kind(b, 'Samples');
      for (const sp of s ? kinder(s, 'SamplePartner') : []){
        const extra = n => { const el = kinder(sp, 'AdditionalFields').find(e => e.getAttribute('Name') === n); return el ? wert(el, 'Value') : ''; };
        const lines = kind(sp, 'Lines');
        out.proben.push({ labNr: wert(sp, 'SamplePartnerCode'), ref: wert(sp, 'Description'), desc: extra('SPLPT_NAME'), art: extra('SAMPLETYPE') || wert(sp, 'Matrix'), datum: A.berlinTag(wert(sp, 'SamplingDate')),
          werte: (lines ? kinder(lines, 'AnalyticalReportLine') : []).map(l => ({ p: wert(l, 'ParameterName') || wert(l, 'ParameterDescription'), r: wert(l, 'Result'), u: wert(l, 'Unit'), loq: wert(l, 'LOQ') })).filter(w => w.p && w.r) });
      }
    }
    return out;
  }

  /** Dateien eines Projekts sammeln (ohne Inhalte), Signatur für den Zwischenspeicher. */
  async function bestand(dir){
    const b = { pj: null, xml: [], pdf: 0 };
    const labor = async (d, tiefe) => { for await (const h of d.values()){
      if (h.kind === 'directory'){ if (tiefe < 1) await labor(h, tiefe + 1); continue; }
      if (h.name.startsWith('~$')) continue;
      if (/\.xml$/i.test(h.name)){ const f = await h.getFile(); b.xml.push({ h, name: h.name, size: f.size, t: f.lastModified }); }
      else if (/\.pdf$/i.test(h.name)) b.pdf++;
    } };
    let spektronDa = false;
    for await (const h of dir.values()){
      if (h.kind === 'file' && h.name === PJ){ const f = await h.getFile(); b.pj = { h, size: f.size, t: f.lastModified }; }
      else if (h.kind === 'directory' && norm(h.name) === 'laborergebnisse') await labor(h, 0);
      else if (h.kind === 'directory' && norm(h.name) === 'spektron') spektronDa = true;
    }
    // Projektdaten am neuen Ort „_Spektron“ (spektron-ordner.js entscheidet, welcher Ort gilt)
    const SO = root.SpektronOrdner;
    if (spektronDa && SO){ const r = await SO.ort(dir, 'projekt');
      if (r.wo === 'neu'){ b.pj = null; if (r.dir) for await (const h of r.dir.values()) if (h.kind === 'file' && h.name === PJ){ const f = await h.getFile(); b.pj = { h, size: f.size, t: f.lastModified }; } } }
    b.xml.sort((x, y) => x.name.localeCompare(y.name));
    b.sig = JSON.stringify(['v2', b.pj && [b.pj.size, b.pj.t], b.xml.map(x => [x.name, x.size, x.t]), b.pdf]);
    return b;
  }
  async function projektLesen(dir){
    const kopf = A.projektKopf(dir.name), b = await bestand(dir);
    const alt = await idbGet('spektron-archiv', 'projekte', dir.name).catch(() => null);
    if (alt && alt.sig === b.sig) return alt.eintrag;
    let pj = {};
    if (b.pj && b.pj.size <= MAX_PJ) try{ pj = JSON.parse((await (await b.pj.h.getFile()).text()).replace(/^﻿/, '')) || {}; }catch(e){ pj = {}; }
    const berichte = [];
    for (const x of b.xml){ if (x.size > MAX_XML) continue; let r = null; try{ r = xmlLesen(await (await x.h.getFile()).text()); }catch(e){} if (r) berichte.push({ ...r, datei: x.name, geaendert: x.t }); }
    const eintrag = { name: dir.name, nr: kopf.nr, jahr: kopf.jahr, nutzung: String(pj.nutzung || ''), brandgut: String(pj.brandgut || ''), schadenereignis: String(pj.schadenereignis || '').slice(0, 200), schadendatum: /^\d{4}-\d{2}-\d{2}$/.test(pj.schadendatum || '') ? pj.schadendatum : '',
      berichte: berichte.length, vorlaeufig: berichte.filter(r => r.vorlaeufig).length, pdf: b.pdf, messungen: A.projektMessungen(berichte) };
    await idbPut('spektron-archiv', 'projekte', dir.name, { sig: b.sig, eintrag }).catch(() => {});
    return eintrag;
  }
  /** Alle Projektordner lesen, vier gleichzeitig. fortschritt(gelesen, gesamt). Fehler je Projekt blockieren nie den Rest. */
  async function allesLesen(archiv, fortschritt){
    const ordner = [];
    for await (const h of archiv.values()) if (h.kind === 'directory' && A.projektKopf(h.name)) ordner.push(h);
    ordner.sort((a, b) => b.name.localeCompare(a.name, 'de', { numeric: true }));
    const projekte = [], fehler = []; let fertig = 0; const queue = ordner.slice();
    const worker = async () => { for (let d = queue.shift(); d; d = queue.shift()){
      try{ projekte.push(await projektLesen(d)); }catch(e){ fehler.push(d.name); }
      fortschritt && fortschritt(++fertig, ordner.length);
    } };
    await Promise.all([1, 2, 3, 4].map(worker));
    projekte.sort((a, b) => b.name.localeCompare(a.name, 'de', { numeric: true }));
    return { projekte, fehler, ordner: ordner.length };
  }

  /* Eigene Zuordnungen: { format: 'spektron-archiv', version: 1, projekte: { "<Ordnername>": { nutzung?, brandgut?, geaendert } } }.
     Gilt nur, wo _Projekt.json nichts angibt. Schreiben: frisch lesen, nur dieses Projekt ändern, unbekannte Felder behalten.
     Eine kaputte oder fremde Datei wird nie überschrieben. */
  async function tagsLesen(archiv){
    let f; try{ f = await (await archiv.getFileHandle(TAGS)).getFile(); }catch(e){ if (e && e.name === 'NotFoundError') return { roh: null, projekte: {} }; throw e; }
    const text = await f.text();
    if (!text.trim()) return { roh: null, projekte: {}, text };   // leer (z. B. abgebrochenes erstes Anlegen) = noch keine Zuordnungen
    const o = JSON.parse(text.replace(/^﻿/, ''));
    if (!o || o.format !== 'spektron-archiv' || !o.projekte || typeof o.projekte !== 'object' || Array.isArray(o.projekte)) throw Error(TAGS + ': unbekanntes Format – wird nicht überschrieben.');
    return { roh: o, projekte: o.projekte, text };
  }
  let schreibKette = Promise.resolve();
  /** Ein Feld eines Projekts setzen. Liest die Datei frisch, ändert nur dieses Projekt und prüft direkt vor dem Schreiben, ob
      inzwischen jemand anderes (anderer Tab, anderer Rechner) geschrieben hat – dann wird neu gelesen und die Änderung erneut
      angewendet (bis zu drei Versuche), statt dessen Stand zu überschreiben. Im selben Browserprofil zusätzlich eine Web-Lock-Sperre. */
  function tagSetzen(archiv, projekt, feld, wert){
    const lauf = async () => {
      if (!await recht(archiv, 'readwrite', true)) throw Error('Kein Schreibrecht für den Archivordner.');
      for (let versuch = 1; ; versuch++){
        const t = await tagsLesen(archiv), p = Object.assign({}, t.projekte[projekt]);
        if (feld.startsWith('probe:')){ const r = Object.assign({}, p.rollen), id = feld.slice(6); if (wert) r[id] = wert; else delete r[id]; if (Object.keys(r).length) p.rollen = r; else delete p.rollen; }
        else if (wert) p[feld] = wert; else delete p[feld];
        const projekte = Object.assign({}, t.projekte);
        if (Object.keys(p).some(k => k !== 'geaendert')){ p.geaendert = new Date().toISOString(); projekte[projekt] = p; } else delete projekte[projekt];
        const o = Object.assign({}, t.roh || {}, { format: 'spektron-archiv', version: 1, hinweis: 'Zuordnungen des Datenarchivs (Projektzentrale › Datenarchiv): Nutzung/Brandgut nur für Projekte ohne Angabe in _Projekt.json; rollen = korrigierte Rolle einzelner Proben (keine = Konvention aus der Probenbezeichnung).', projekte });
        const text = JSON.stringify(o, null, 2) + '\n';
        const h = await archiv.getFileHandle(TAGS, { create: true }), w = await h.createWritable();
        try{
          const jetzt = await (await h.getFile()).text();          // „create“ legt eine leere Datei an – leer = es gab noch keine
          if (jetzt !== (t.text || '')){
            await w.abort().catch(() => {});
            if (versuch < 3) continue;
            throw Error('Die Archivzuordnungen werden gerade an einem anderen Rechner geändert – bitte gleich noch einmal setzen.');
          }
          await w.write(text); await w.close();
        }catch(e){ try{ await w.abort(); }catch(_){} throw e; }
        if ((await tagsLesen(archiv)).text !== text) throw Error('Die Archivzuordnungen wurden gleichzeitig an einem anderen Rechner geändert – bitte neu einlesen und prüfen.');
        return projekte;
      }
    };
    const gesperrt = () => root.navigator && root.navigator.locks ? root.navigator.locks.request('spektron:archiv-tags', lauf) : lauf();
    schreibKette = schreibKette.catch(() => {}).then(gesperrt);
    return schreibKette;
  }

  root.ArchivLesen = Object.freeze({ archivAusSpeicher, archivMerken, recht, xmlLesen, allesLesen, tagsLesen, tagSetzen, TAGS });
})(typeof globalThis !== 'undefined' ? globalThis : this);
