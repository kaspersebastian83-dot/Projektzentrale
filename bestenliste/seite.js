/* Spektron · Bestenliste – Seite: Archivordner lesen (nur lesen), Punkte über punkte.js, Anzeige.
   Archivordner wie Büroübersicht und Apps aus IndexedDB „mosaik-suite/kv/archiv“. Läuft auch als Bildschirm im Büro:
   aktualisiert sich alle 10 Minuten und beim Zurückkehren auf die Seite. */
(function(){
'use strict';
const B = Bestenliste, M = BueroMa, $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = k => { try{ return localStorage.getItem(k) || ''; }catch(e){ return ''; } };
const lsSet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
const S = { archiv: null, personen: null, projekte: [], eintraege: [], fehler: [], zeit: ['monat', 'jahr', 'gesamt'].includes(lsGet('bestenliste-zeit')) ? lsGet('bestenliste-zeit') : 'monat', laeuft: false, stand: null };
const INTERVALL = 10 * 60 * 1000, PARALLEL = 6, MAX_DATEN = 10 * 1024 * 1024;

const store = {
  open(){ return new Promise((res, rej) => { const r = indexedDB.open('mosaik-suite', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(){ const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get('archiv'); r.onsuccess = () => { db.close(); res(r.result); }; r.onerror = () => rej(r.error); }); },
  async set(h){ const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(h, 'archiv'); t.oncomplete = () => { db.close(); res(); }; t.onerror = () => rej(t.error); }); },
};
function meldung(text, fehler){ const m = $('meldung'); m.hidden = !text; m.textContent = text || ''; m.classList.toggle('fehler', !!fehler); }

/* ---------- Lesen ---------- */
const nameNorm = s => String(s).normalize('NFC').toLowerCase();
/** Unterordner direkt per Namen öffnen, sonst in der Auflistung suchen (andere Unicode-Form oder Schreibweise). */
async function unterordner(projekt, name){
  try{ return await projekt.getDirectoryHandle(name); }catch(e){}
  try{ for await (const h of projekt.values()) if (h.kind === 'directory' && nameNorm(h.name) === nameNorm(name)) return h; }catch(e){}
  return null;
}
async function dateien(dir){ const out = []; if (!dir) return out; try{ for await (const h of dir.values()) if (h.kind === 'file' && !h.name.startsWith('~$')) out.push(h); }catch(e){} return out; }
async function probenLesen(dir){
  const kandidaten = (await dateien(dir)).filter(h => /_Daten\.json$/i.test(h.name));
  let neueste = null;
  for (const h of kandidaten){ try{ const f = await h.getFile(); if (!neueste || f.lastModified > neueste.lastModified) neueste = f; }catch(e){} }
  if (!neueste || neueste.size > MAX_DATEN) return 0;
  try{ return B.probenZaehlen(JSON.parse(await neueste.text())); }catch(e){ return 0; }
}
async function projektLesen(h, l){
  const zust = await M.zustaendigLaden(h);
  const p = { name: h.name, nr: l.nr, yy: l.yy, ort: l.ort, kuerzel: zust ? zust.kuerzel : l.kuerzel, proben: 0, fotoPdf: false, plan: false, records: [] };
  try{ const r = await BueroData.scanProject(h); p.records = r.records; if (r.errors.length) S.fehler.push(...r.errors); }catch(e){ S.fehler.push(h.name + ': ' + e.message); }
  if (p.records.some(r => !r.withdrawn && r.status === 'Erledigt')){
    p.proben = await probenLesen(await unterordner(h, 'Laboraufträge'));
    p.fotoPdf = (await dateien(await unterordner(h, 'Fotos'))).some(f => /bilddokumentation.*\.pdf$/i.test(f.name));
    p.plan = (await dateien(await unterordner(h, 'Pläne'))).some(f => /\.probenplan$/i.test(f.name) && !/ \((vorher|Wiederherstellung) [^)]*\)\.probenplan$/i.test(f.name));
  }
  return p;
}
async function einlesen(){
  if (S.laeuft || !S.archiv) return;
  S.laeuft = true; $('neu').disabled = true; S.fehler = [];
  try{
    const ma = await M.personenLaden(S.archiv);
    if (ma && ma.error) S.fehler.push(ma.error);
    S.personen = Array.isArray(ma) ? ma : null;
    const ordner = [];
    for await (const h of S.archiv.values()) if (h.kind === 'directory'){ const l = M.leseProjektordner(h.name, S.personen); if (l) ordner.push([h, l]); }
    const projekte = []; let i = 0, fertig = 0;
    const arbeiter = async () => { while (i < ordner.length){ const [h, l] = ordner[i++]; projekte.push(await projektLesen(h, l)); fertig++; if (fertig % 10 === 0) $('stand').textContent = `Lese Projekte … ${fertig} von ${ordner.length}`; } };
    await Promise.all(Array.from({ length: PARALLEL }, arbeiter));
    S.projekte = projekte; S.eintraege = B.eintraege(projekte, S.personen || []); S.stand = new Date();
    meldung(S.fehler.length ? `Einige Angaben waren nicht lesbar und fehlen in der Wertung (${S.fehler.length}): ${S.fehler.slice(0, 3).join(' · ')}${S.fehler.length > 3 ? ' …' : ''}` : (S.personen ? '' : 'Ohne Mitarbeiterliste (in der Projektzentrale unter „👥 Mitarbeiter“) kann niemand Punkte bekommen.'), S.fehler.length > 0);
    zeichnen(); feiern();
  }catch(e){ meldung('Archivordner nicht lesbar: ' + e.message, true); }
  finally{ S.laeuft = false; $('neu').disabled = !S.archiv; }
}

/* ---------- Anzeige ---------- */
/** CSS-Variablen aus data-css setzen (Inhalts-Sicherheitsrichtlinie erlaubt keine style-Attribute im HTML). */
function css(root){ root.querySelectorAll('[data-css]').forEach(el => { for (const t of el.dataset.css.split(';')){ const i = t.indexOf(':'); if (i > 0) el.style.setProperty(t.slice(0, i).trim(), t.slice(i + 1).trim()); } el.removeAttribute('data-css'); }); }
const FARBEN = ['#e4572e', '#3f7cc0', '#2e9e6b', '#b5179e', '#f2a541', '#7b5ea7', '#1b998b', '#c0392b'];
const farbe = key => FARBEN[[...String(key)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % FARBEN.length];
const initialen = name => String(name).replace(/^(Dr\.|Prof\.)\s*/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const avatar = (key, name, gross) => `<span class="ava${gross ? ' gross' : ''}" data-css="--f:${farbe(key)}" aria-hidden="true">${esc(initialen(name))}</span>`;
const zeitText = iso => { const d = new Date(iso), t = Date.now() - d; if (t < 36e5) return 'gerade eben'; if (t < 864e5) return 'heute, ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); if (t < 2 * 864e5) return 'gestern'; return d.toLocaleDateString('de-DE'); };

function zeichnen(){
  const zr = B.zeitraum(S.zeit), rang = B.rangliste(S.eintraege, S.personen, zr.von), max = Math.max(1, ...rang.map(r => r.punkte));
  document.querySelectorAll('[data-zeit]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.zeit === S.zeit)));
  $('zeit-titel').textContent = '· ' + zr.titel;
  $('stand').textContent = S.stand ? `Stand ${S.stand.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · ${S.projekte.length} Projekte` : 'Noch nicht eingelesen';
  const top = rang.filter(r => r.punkte > 0).slice(0, 3), medaille = ['🥇', '🥈', '🥉'];
  $('podest').innerHTML = top.length ? [1, 0, 2].filter(i => top[i]).map(i => { const r = top[i]; return `<div class="stufe p${r.platz}" data-key="${esc(r.key)}">${avatar(r.key, r.name, true)}<div class="medaille" aria-hidden="true">${medaille[r.platz - 1] || ''}</div><div class="nm">${esc(r.name)}</div><div class="pk"><b>${r.punkte}</b> Punkte</div><div class="block">${r.platz}</div></div>`; }).join('')
    : `<p class="leer">${S.stand ? 'In diesem Zeitraum noch keine Punkte. Wer schließt das erste Projekt ab?' : 'Archivordner wählen, um die Bestenliste zu sehen.'}</p>`;
  $('liste').innerHTML = rang.map(r => `<li data-key="${esc(r.key)}"><span class="pl">${r.platz}.</span>${avatar(r.key, r.name)}<span class="nm">${esc(r.name)}<small>${r.abschluesse} Abschl. · ${r.proben} Proben</small></span><span class="balken"><span data-css="--w:${Math.round(100 * r.punkte / max)}%"></span></span><b class="pk">${r.punkte}</b></li>`).join('');
  const ohne = B.ohneZuordnung(S.eintraege, zr.von);
  $('ohne').innerHTML = ohne.length ? `Nicht zugeordnet (Kürzel passt zu keiner Person der Mitarbeiterliste): ${ohne.map(o => `„${esc(o.roh)}“ ${o.punkte} P.`).join(' · ')}` : '';
  $('ticker').innerHTML = B.ticker(S.eintraege).map(t => `<li>${t.key ? avatar(t.key, t.name) : '<span class="ava grau" aria-hidden="true">?</span>'}<span><b>${esc(t.name)}</b> ${esc(B.tickerText(t))}: ${esc(t.nr)} ${esc(t.ort)}<small>${zeitText(t.at)}${t.art === 'abschluss' && t.teile.length > 1 ? ' · inkl. ' + t.teile.filter(x => x !== 'abschluss').map(x => B.REGELN[x].titel).join(', ') : ''}</small></span><span class="plus">+${t.punkte}</span></li>`).join('') || '<li class="leer">Noch keine Erfolge.</li>';
  const abz = B.abzeichen(S.eintraege, S.personen), alle = B.rangliste(S.eintraege, S.personen, '');
  $('abzeichen').innerHTML = alle.map(r => { const a = abz.get(r.key) || [], naechster = [1, 10, 25, 50, 100].find(n => r.abschluesse < n);
    const ziel = r.abschluesse || !r.gegenlesen ? (naechster ? `noch ${naechster - r.abschluesse} bis ${naechster === 1 ? 'zum ersten Abschluss' : naechster + ' Abschlüsse'}` : '') : r.gegenlesen < 10 ? `noch ${10 - r.gegenlesen} Gegenlesen bis 🔍 Adlerauge` : r.gegenlesen < 50 ? `noch ${50 - r.gegenlesen} Gegenlesen bis Meister/in` : '';
    return `<div class="person">${avatar(r.key, r.name)}<div><div class="nm">${esc(r.name)}</div><div class="badges">${a.map(x => `<span class="badge" title="${esc(x.text)}"><i aria-hidden="true">${x.icon}</i>${esc(x.titel)}</span>`).join('') || '<span class="klein">noch keine</span>'}</div>${ziel ? `<div class="klein">${esc(ziel)}</div>` : ''}</div></div>`; }).join('') || '<p class="leer">—</p>';
  const j = B.jeJahr(S.projekte, S.personen);
  css(document.body);
  $('jahre').innerHTML = j.zeilen.length ? `<table><thead><tr><th>Person</th>${j.jahre.map(y => `<th>20${esc(y)}</th>`).join('')}</tr></thead><tbody>${j.zeilen.map(z => `<tr><td>${esc(z.name)}${z.inaktiv ? ' <small>(inaktiv)</small>' : ''}</td>${j.jahre.map(y => `<td>${z.jahre[y] || '–'}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
}
function regeln(){
  $('regeln').innerHTML = `<table><tbody>${Object.values(B.REGELN).map(r => `<tr><td><b>+${r.punkte}</b>${r.max ? ` <small>(max. ${r.max})</small>` : ''}</td><td><b>${esc(r.titel)}</b><br><small>${esc(r.text)}</small></td></tr>`).join('')}</tbody></table>
    <p class="klein">Abzeichen: Meilensteine (1, 10, 25, 50, 100 Abschlüsse), 👑 Probenkönig/in (meiste Proben in einem Monat), ⚡ schnellster Abschluss des Jahres, 🔥 Serie (mindestens 3 Wochen in Folge mit Abschluss), 🛟 Rückfrage-Retter/in (5 schnelle Antworten), 🔍 Adlerauge (10 Gutachten gegengelesen).</p>`;
}
/** Neue Erfolge seit dem letzten Besuch in diesem Browser feiern (nicht beim allerersten Laden). */
function feiern(){
  const neu = S.eintraege[0], marke = neu ? neu.gruppe + '@' + neu.at : '', alt = lsGet('bestenliste-zuletzt');
  lsSet('bestenliste-zuletzt', marke);
  if (!alt || !marke || alt === marke || (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const k = $('konfetti'); k.innerHTML = Array.from({ length: 60 }, (_, i) => `<i data-css="--x:${(Math.random() * 100).toFixed(1)}vw;--d:${(Math.random() * 1.5 + 1.8).toFixed(2)}s;--v:${(Math.random() * .6).toFixed(2)}s;--f:${FARBEN[i % FARBEN.length]}"></i>`).join('');
  css(k);
  k.classList.add('an'); setTimeout(() => { k.classList.remove('an'); k.innerHTML = ''; }, 4500);
}

/* ---------- Archivordner ---------- */
async function verbinden(h, nachfragen){
  if (!h) return;
  let erlaubt = h.queryPermission ? await h.queryPermission({ mode: 'read' }) : 'granted';
  if (erlaubt !== 'granted' && nachfragen && h.requestPermission) erlaubt = await h.requestPermission({ mode: 'read' });
  S.archiv = h; $('zugriff').hidden = erlaubt === 'granted';
  if (erlaubt !== 'granted'){ meldung(`Zugriff auf „${h.name}“ bitte erlauben.`); return; }
  $('archiv').textContent = '📁 ' + h.name; await einlesen();
}
$('archiv').onclick = async () => { try{ const h = await showDirectoryPicker({ id: 'mosaik-archiv', mode: 'read' }); await store.set(h).catch(() => {}); await verbinden(h, true); }catch(e){ if (e.name !== 'AbortError') meldung(e.message, true); } };
$('zugriff').onclick = () => verbinden(S.archiv, true).catch(e => meldung(e.message, true));
$('neu').onclick = () => einlesen();
document.querySelectorAll('[data-zeit]').forEach(b => b.onclick = () => { S.zeit = b.dataset.zeit; lsSet('bestenliste-zeit', S.zeit); zeichnen(); });
setInterval(() => { if (!document.hidden) einlesen(); }, INTERVALL);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.stand && Date.now() - S.stand > 60000) einlesen(); });
regeln(); zeichnen();
store.get().then(h => verbinden(h, false)).catch(() => {});
})();
