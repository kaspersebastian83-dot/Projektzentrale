/* Büroübersicht · Zuständige Person je Übergabe (nur lesen).
   Ort und Kürzel kommen aus dem Projektordnernamen (Block unten identisch mit der Projektzentrale, geprüft in
   tests/buero-zustaendig.cjs). Eine abweichende Auswahl der Projektzentrale steht als „zustaendig“ in _Projekt.json.
   Gelesen werden nur _Spektron-Mitarbeiter.json im Archivordner und _Projekt.json der Projekte mit Übergaben. */
(function(){
'use strict';
const PROJ_RE = /^(\d{2})\.(\d{2,6})(?:[\s_-]+(.*))?$/;
/* SPEKTRON-ORDNERNAME v1 – in allen Apps identisch halten.
   Liest den Ordnernamen von hinten: Am Ende wird ein Kürzel der Mitarbeiterliste gesucht (bis zu drei Wörter, längster Treffer
   zuerst; verglichen ohne Groß-/Kleinschreibung, Leerzeichen und Punkte, also „Dr. Ka“ = „Dr.Ka“ = „dr ka“). Alles zwischen
   Projektnummer und Kürzel ist der Ort, mit oder ohne Straße. Nichts wird geraten: Kein Treffer → Ort = ganzer Rest, Hinweis.
   Ohne Mitarbeiterliste wird nichts abgetrennt (Verhalten wie vor 1.12). Kennung bleibt immer der volle Ordnername. */
const maNorm = s => String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s.]+/g, '');
function leseProjektordner(name, personen){
  const m = PROJ_RE.exec(String(name).normalize('NFC').trim());
  if (!m) return null;
  const rest = (m[3] || '').trim();
  const r = { nr: `${m[1]}.${m[2]}`, yy: m[1], ort: rest, key: (+m[1]) * 1e6 + (+m[2]), kuerzel: '', hinweis: '' };
  if (!Array.isArray(personen) || !personen.length) return r;
  const woerter = [...rest.matchAll(/[^\s_]+/g)];
  for (let n = Math.min(3, woerter.length); n >= 1; n--){
    const ende = maNorm(woerter.slice(-n).map(w => w[0]).join(''));
    const p = personen.find(x => x && maNorm(x.ordnerKuerzel) === ende);
    if (!p) continue;
    r.kuerzel = String(p.ordnerKuerzel).trim();
    r.ort = rest.slice(0, woerter[woerter.length - n].index).replace(/[\s_-]+$/, '');
    if (!r.ort) r.hinweis = 'Im Ordnernamen fehlt der Ort.';
    return r;
  }
  r.hinweis = rest ? 'Kein bekanntes Kürzel am Ende des Ordnernamens.' : 'Im Ordnernamen fehlen Ort und Kürzel.';
  return r;
}
/* SPEKTRON-ORDNERNAME-ENDE */
const MA_FILE='_Spektron-Mitarbeiter.json',PJ_FILE='_Projekt.json',MAX=1024*1024;
const fehlt=e=>e&&(e.name==='NotFoundError'||e.name==='TypeMismatchError');
async function klein(dir,name){const f=await(await dir.getFileHandle(name)).getFile();if(f.size>MAX)throw Error(name+' ist zu groß.');return JSON.parse(await f.text());}
/** Mitarbeiterliste; null ohne Datei, {error} wenn unlesbar. */
async function personenLaden(archive){
  try{const o=await klein(archive,MA_FILE);if(!o||o.format!=='spektron-mitarbeiter'||!Array.isArray(o.personen))throw Error('unbekanntes Format');
    return o.personen.filter(p=>p&&typeof p.ordnerKuerzel==='string'&&p.ordnerKuerzel.trim()&&typeof p.name==='string');}
  catch(e){if(fehlt(e))return null;return {error:MA_FILE+': '+e.message};}
}
/** Manuelle Zuständigkeit eines Projekts: {kuerzel} oder null (dann gilt der Ordnername). */
async function zustaendigLaden(projekt){
  try{const o=await klein(projekt,PJ_FILE),z=o&&o.zustaendig;return z&&typeof z==='object'&&typeof z.kuerzel==='string'?{kuerzel:z.kuerzel}:null;}
  catch(e){return null;}
}
const person=(personen,k)=>k&&Array.isArray(personen)?personen.find(p=>maNorm(p.ordnerKuerzel)===maNorm(k))||null:null;
/** Anzeige einer Übergabe: Ort ohne Kürzel, zuständige Person. project = content.project, zust = Ergebnis von zustaendigLaden. */
function ansicht(project,personen,zust){
  const liste=Array.isArray(personen)?personen:null,l=leseProjektordner(project.name||'',liste);
  const ort=l?l.ort:String(project.ort||''),kuerzel=zust?zust.kuerzel:(l?l.kuerzel:'');
  const p=person(liste,kuerzel);
  return {ort:ort||String(project.ort||''),kuerzel:p?String(p.ordnerKuerzel).trim():kuerzel,name:p?p.name:kuerzel,manuell:!!zust};
}
window.BueroMa={leseProjektordner,maNorm,personenLaden,zustaendigLaden,person,ansicht};
})();
