/* Spektron Datenarchiv – Oberfläche. Rechnet mit ArchivAuswertung, liest mit ArchivLesen. */
(function(){
'use strict';
const A = ArchivAuswertung, L = ArchivLesen, $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zahlText = v => v == null ? '–' : v.toLocaleString('de-DE', { maximumSignificantDigits: 3 });
const kennText = k => !k ? '–' : k.unter ? '&lt; BG' : zahlText(k.wert);
const prozent = v => (v * 100).toLocaleString('de-DE', { maximumFractionDigits: v < .1 ? 1 : 0 }) + ' %';
/* Gleiche Auswahllisten wie die Projektdaten der Projektzentrale (PJ_OPTIONEN) – dort ändern, hier mitändern. */
const OPTIONEN = {
  nutzung: ['Wohnen', 'Büro', 'Öffentlich', 'Gesundheit & Labor', 'Gewerbe/Industrie', 'Landwirtschaft'],
  brandgut: ['Kunststoffe/PVC', 'Holz/Möbel', 'Elektro/Geräte', 'Küche/Lebensmittel', 'Fahrzeug', 'Lager/gemischt', 'unbekannt'] };
const OHNE = 'ohne Angabe';
const S = { archiv: null, projekte: [], tags: {}, tagsFehler: '', alle: [], profile: [], reiter: 'uebersicht', v: { key: '', matrix: '', nutzung: '', gruppe: 'brandgut', hervor: '' }, m: { projekt: '', vergleich: 'matrix' }, nurOffen: true, liest: false };

/* ---------- Zustand ---------- */
function wirksam(p){ const t = S.tags[p.name] || {}; return { nutzung: p.nutzung || t.nutzung || '', brandgut: p.brandgut || t.brandgut || '', nutzungTag: !p.nutzung && !!t.nutzung, brandgutTag: !p.brandgut && !!t.brandgut }; }
function aufbauen(){
  S.alle = []; S.profile = [];
  for (const p of S.projekte){
    const w = wirksam(p);
    for (const x of p.messungen) S.alle.push({ ...x, projekt: p.name, nr: p.nr, jahr: p.jahr, nutzung: w.nutzung, brandgut: w.brandgut });
    for (const pr of A.profile(p.messungen)) S.profile.push({ ...pr, projekt: p.name, nr: p.nr, nutzung: w.nutzung, brandgut: w.brandgut });
  }
  const offen = S.projekte.filter(p => p.messungen.length && (!wirksam(p).nutzung || !wirksam(p).brandgut)).length;
  $('offenZahl').hidden = !offen; $('offenZahl').textContent = offen;
  $('csv').disabled = !S.alle.length;
}
function meldung(text, fehler){ const el = document.createElement('div'); el.className = 'meldung' + (fehler ? ' fehler' : ''); el.setAttribute('role', 'status'); el.textContent = text; $('ansicht').prepend(el); setTimeout(() => el.remove(), fehler ? 12000 : 4000); }

/* ---------- Archivordner ---------- */
async function verbinden(h){
  S.archiv = h; $('ordner').textContent = h ? 'Archivordner: ' + h.name : '';
  const ok = h && await L.recht(h, 'read', false);
  $('erlauben').hidden = !h || ok; $('lesen').disabled = !ok;
}
$('waehlen').onclick = async () => {
  try{ const h = await showDirectoryPicker({ mode: 'read', id: 'mosaik-archiv' }); if (A.projektKopf(h.name)) throw Error('Bitte den Archivordner mit allen Projekten wählen, nicht einen einzelnen Projektordner.'); await L.archivMerken(h); await verbinden(h); einlesen(); }
  catch(e){ if (e.name !== 'AbortError') meldung(e.message, true); }
};
$('erlauben').onclick = async () => { if (await L.recht(S.archiv, 'read', true)){ await verbinden(S.archiv); einlesen(); } else meldung('Ordnerzugriff nicht erlaubt.', true); };
$('lesen').onclick = () => einlesen();
async function einlesen(){
  if (S.liest || !S.archiv) return; S.liest = true; $('lesen').disabled = true;
  const bar = $('fortschritt'); bar.hidden = false; bar.removeAttribute('value'); $('stand').textContent = 'Lese Projektordner …';
  try{
    const r = await L.allesLesen(S.archiv, (n, g) => { bar.max = g; bar.value = n; $('stand').textContent = `Lese Projektordner ${n} von ${g} …`; });
    S.projekte = r.projekte;
    try{ S.tags = (await L.tagsLesen(S.archiv)).projekte; S.tagsFehler = ''; }catch(e){ S.tags = {}; S.tagsFehler = e.message; }
    aufbauen();
    $('stand').textContent = `Eingelesen ${new Date().toLocaleString('de-DE')} · ${r.ordner} Projektordner` + (r.fehler.length ? ` · ${r.fehler.length} nicht lesbar (${r.fehler.slice(0, 3).join(', ')}${r.fehler.length > 3 ? ' …' : ''})` : '');
    zeichnen();
  }catch(e){ $('stand').textContent = 'Einlesen fehlgeschlagen: ' + e.message; }
  finally{ S.liest = false; $('lesen').disabled = false; bar.hidden = true; }
}

/* ---------- Reiter ---------- */
document.querySelectorAll('[data-reiter]').forEach(b => b.onclick = () => { S.reiter = b.dataset.reiter; zeichnen(); });
function zeichnen(){
  document.querySelectorAll('[data-reiter]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.reiter === S.reiter)));
  if (!S.projekte.length){ return; }
  ({ uebersicht, vergleich, muster, zuordnen })[S.reiter]();
}

/* ---------- Übersicht ---------- */
function uebersicht(){
  const mit = S.projekte.filter(p => p.messungen.length), proben = new Set(S.alle.map(x => x.projekt + '|' + x.probe)), zaehlen = S.alle.filter(A.zaehlt);
  const nurPdf = S.projekte.filter(p => !p.berichte && p.pdf).length, vorl = S.alle.filter(x => x.vorlaeufig).length;
  const jahre = new Map(); for (const p of mit){ const j = jahre.get(p.jahr) || { p: 0, w: 0 }; j.p++; j.w += p.messungen.filter(A.zaehlt).length; jahre.set(p.jahr, j); }
  const projJeParam = new Map(); for (const x of zaehlen){ const k = x.p + '|' + x.u; if (!projJeParam.has(k)) projJeParam.set(k, new Set()); projJeParam.get(k).add(x.projekt); }
  const liste = A.parameterListe(S.alle).slice(0, 20);
  $('ansicht').innerHTML = `<div class="kacheln">
      <div class="kachel"><b>${mit.length.toLocaleString('de-DE')}</b><span>Projekte mit Laborwerten</span></div>
      <div class="kachel"><b>${S.projekte.reduce((s, p) => s + p.berichte, 0).toLocaleString('de-DE')}</b><span>Prüfberichte (XML)</span></div>
      <div class="kachel"><b>${proben.size.toLocaleString('de-DE')}</b><span>Proben</span></div>
      <div class="kachel"><b>${zaehlen.length.toLocaleString('de-DE')}</b><span>Messwerte in der Statistik</span></div></div>
    ${nurPdf || vorl || S.tagsFehler ? `<p class="hinweis">${nurPdf ? `${nurPdf} Projekte haben nur PDF-Berichte – in Version 1 noch nicht gelesen. ` : ''}${vorl ? `${vorl} Werte stammen aus vorläufigen Berichten ohne endgültigen – sie zählen nicht. ` : ''}${S.tagsFehler ? esc(S.tagsFehler) : ''}</p>` : ''}
    <div class="zwei"><div><h2>Häufigste Parameter</h2><table><thead><tr><th>Parameter</th><th>Einheit</th><th class="z">Werte</th><th class="z">Projekte</th></tr></thead><tbody>
      ${liste.map(x => `<tr class="klick" data-key="${esc(x.key)}" tabindex="0" title="Im Vergleich öffnen"><td>${esc(x.p)}</td><td>${esc(x.u)}</td><td class="z">${x.n.toLocaleString('de-DE')}</td><td class="z">${projJeParam.get(x.key).size}</td></tr>`).join('')}</tbody></table></div>
    <div><h2>Je Jahr</h2><table><thead><tr><th>Jahr</th><th class="z">Projekte</th><th class="z">Messwerte</th></tr></thead><tbody>
      ${[...jahre].sort((a, b) => b[0] - a[0]).map(([j, v]) => `<tr><td>${j}</td><td class="z">${v.p}</td><td class="z">${v.w.toLocaleString('de-DE')}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('ansicht').querySelectorAll('[data-key]').forEach(tr => { const go = () => { S.v.key = tr.dataset.key; S.v.hervor = ''; S.reiter = 'vergleich'; zeichnen(); }; tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); }; });
}

/* ---------- Vergleich ---------- */
function auswahl(id, wert, optionen, leer){ return `<select id="${id}">${leer != null ? `<option value="">${esc(leer)}</option>` : ''}${optionen.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === wert ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`; }
function vergleich(){
  const params = A.parameterListe(S.alle);
  if (!params.some(x => x.key === S.v.key)) S.v.key = (params.find(x => /^Summe 16 EPA-PAK/i.test(x.p)) || params[0] || {}).key || '';
  const [p, u] = [S.v.key.slice(0, S.v.key.lastIndexOf('|')), S.v.key.slice(S.v.key.lastIndexOf('|') + 1)];
  const basis = S.alle.filter(x => x.p === p && x.u === u && A.zaehlt(x));
  const matrizen = [...new Set(basis.map(x => x.art || OHNE))].sort();
  if (S.v.matrix && !matrizen.includes(S.v.matrix)) S.v.matrix = '';
  const gefiltert = basis.filter(x => (!S.v.matrix || (x.art || OHNE) === S.v.matrix) && (!S.v.nutzung || (x.nutzung || OHNE) === S.v.nutzung));
  const projekte = [...new Set(gefiltert.map(x => x.projekt))].sort((a, b) => b.localeCompare(a, 'de', { numeric: true }));
  if (S.v.hervor && !projekte.includes(S.v.hervor)) S.v.hervor = '';
  const gruppeVon = x => S.v.gruppe === 'brandgut' ? x.brandgut || OHNE : S.v.gruppe === 'nutzung' ? x.nutzung || OHNE : S.v.gruppe === 'matrix' ? x.art || OHNE : S.v.gruppe === 'jahr' ? String(x.jahr) : 'Alle Werte';
  const gruppen = new Map(); for (const x of gefiltert){ const g = gruppeVon(x); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g).push(x); }
  const reihen = [...gruppen].map(([name, werte]) => ({ name, werte, s: A.statistik(werte) })).sort((a, b) => (a.name === OHNE) - (b.name === OHNE) || b.s.n - a.s.n);
  if (S.v.gruppe !== 'keine' && reihen.length > 1) reihen.unshift({ name: 'Alle Werte', werte: gefiltert, s: A.statistik(gefiltert), alle: true });
  $('ansicht').innerHTML = `<div class="filter">
      <label class="feld">Parameter · Einheit (Anzahl Werte)${auswahl('vP', S.v.key, params.map(x => [x.key, `${x.p} · ${x.u} (${x.n})`]))}</label>
      <label class="feld">Matrix${auswahl('vM', S.v.matrix, matrizen, 'alle')}</label>
      <label class="feld">Nutzung${auswahl('vN', S.v.nutzung, [...OPTIONEN.nutzung, OHNE], 'alle')}</label>
      <label class="feld">Gruppieren nach${auswahl('vG', S.v.gruppe, [['brandgut', 'Brandgut'], ['nutzung', 'Nutzung'], ['matrix', 'Matrix'], ['jahr', 'Jahr'], ['keine', 'nicht gruppieren']])}</label>
      <label class="feld">Projekt hervorheben${auswahl('vH', S.v.hervor, projekte, '—')}</label></div>
    ${gefiltert.length ? `<div class="legende"><span><i class="lg-pkt"></i>Messwert einer Probe</span>${S.v.hervor ? `<span><i class="lg-hp"></i>${esc(S.v.hervor.split(' ')[0])}</span>` : ''}<span>│ Median</span><span>┆ 90. Perzentil</span><span>Logarithmische Achse</span></div>
      <div class="diagramm">${streifen(reihen, u)}</div>
      <h3>Kennzahlen</h3><table><thead><tr><th>Gruppe</th><th class="z">Werte</th><th class="z">davon &lt; BG</th><th class="z">Median</th><th class="z">90. Perzentil</th><th class="z">Größter Wert</th><th class="z">Projekte</th></tr></thead><tbody>
      ${reihen.map(r => `<tr${r.alle ? ' class="ref"' : ''}><td>${esc(r.name)}</td><td class="z">${r.s.n}</td><td class="z">${r.s.unter}</td><td class="z">${r.s.genug ? kennText(r.s.median) : 'zu wenige'}</td><td class="z">${r.s.genug ? kennText(r.s.p90) : '–'}</td><td class="z">${zahlText(r.s.max)}</td><td class="z">${new Set(r.werte.map(x => x.projekt)).size}</td></tr>`).join('')}</tbody></table>
      <p class="quelle">${esc(u)} · Werte unter BG und „n. n.“ zählen als kleinste Werte; fällt eine Kennzahl darauf, steht „&lt; BG“. Kennzahlen ab ${A.MIN_N} Werten. Nur endgültige Prüfberichte. Keine Grenz- oder Orientierungswerte – nur der eigene Bestand.</p>`
    : '<p class="hinweis">Keine Werte für diese Auswahl.</p>'}`;
  const an = (id, k) => { $(id).onchange = e => { S.v[k] = e.target.value; if (k === 'key'){ S.v.matrix = ''; S.v.hervor = ''; } vergleich(); }; };
  an('vP', 'key'); an('vM', 'matrix'); an('vN', 'nutzung'); an('vG', 'gruppe'); an('vH', 'hervor');
  document.querySelectorAll('.lg-pkt').forEach(i => { i.style.background = '#245C9E'; i.style.opacity = '.45'; });
  document.querySelectorAll('.lg-hp').forEach(i => { i.style.background = '#C2410C'; });
}
function streuung(s){ let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000 - .5; }
/** Ein Streifen je Gruppe auf logarithmischer Achse; Werte unter BG gezählt in einem eigenen Feld links. */
function streifen(reihen, u){
  const W = 960, L0 = 200, BG = 66, X0 = L0 + BG + 14, X1 = W - 24, H = 38, oben = 8, unten = 30, Ht = oben + reihen.length * H + unten;
  const gem = reihen.flatMap(r => r.werte.filter(x => x.q === 'gemessen' && x.v > 0).map(x => x.v));
  let lo = Math.floor(Math.log10(Math.min(...gem))), hi = Math.ceil(Math.log10(Math.max(...gem)));
  if (!gem.length){ lo = 0; hi = 1; } if (hi === lo) hi = lo + 1;
  const x = v => X0 + (Math.log10(v) - lo) / (hi - lo) * (X1 - X0);
  let s = `<svg viewBox="0 0 ${W} ${Ht}" width="${W}" height="${Ht}" role="img" aria-label="Verteilung der Messwerte je Gruppe">`;
  for (let k = lo; k <= hi; k++){ const xx = x(10 ** k); s += `<line class="gitter" x1="${xx}" x2="${xx}" y1="${oben}" y2="${Ht - unten}"/><text x="${xx}" y="${Ht - unten + 16}" text-anchor="middle">${zahlText(10 ** k)}</text>`; }
  s += `<text x="${L0 + BG / 2}" y="${Ht - unten + 16}" text-anchor="middle">&lt; BG</text><text x="${X1}" y="${Ht - 2}" text-anchor="end">${esc(u)}</text>`;
  reihen.forEach((r, i) => {
    const y = oben + i * H + H / 2, hv = S.v.hervor;
    s += `<text class="n" x="${L0 - 10}" y="${y - 2}" text-anchor="end"${r.alle ? ' font-weight="600"' : ''}>${esc(r.name.length > 26 ? r.name.slice(0, 25) + '…' : r.name)}</text><text x="${L0 - 10}" y="${y + 12}" text-anchor="end">n = ${r.s.n}</text>`;
    s += `<rect class="bgbox" x="${L0}" y="${y - 13}" width="${BG}" height="26" rx="4"/><text class="n" x="${L0 + BG / 2}" y="${y + 4}" text-anchor="middle">${r.s.unter}</text>`;
    const pkte = r.werte.filter(w => w.q === 'gemessen' && w.v > 0), tip = w => `<title>${esc(w.nr)} · Probe ${esc(w.ref || w.probe)} · ${esc(w.roh)} ${esc(w.u)}${w.art ? ' · ' + esc(w.art) : ''}</title>`;
    for (const w of pkte) if (w.projekt !== hv) s += `<circle class="pkt" cx="${x(w.v).toFixed(1)}" cy="${(y + streuung(w.projekt + w.probe) * 20).toFixed(1)}" r="3.5">${tip(w)}</circle>`;
    for (const w of pkte) if (w.projekt === hv) s += `<circle class="hp" cx="${x(w.v).toFixed(1)}" cy="${(y + streuung(w.projekt + w.probe) * 20).toFixed(1)}" r="5.5">${tip(w)}</circle>`;
    if (hv) for (const w of r.werte) if (w.projekt === hv && w.q !== 'gemessen') s += `<circle class="hp" cx="${L0 + BG / 2 + 16 + streuung(w.probe) * 12}" cy="${y + streuung(w.probe + 'x') * 16}" r="4.5"><title>${esc(w.nr)} · Probe ${esc(w.ref || w.probe)} · ${esc(w.roh)}</title></circle>`;
    const strich = (k, cls) => { if (!k) return; const xx = k.unter ? L0 + BG - 6 : x(k.wert); s += `<line class="${cls}" x1="${xx}" x2="${xx}" y1="${y - 15}" y2="${y + 15}"/>`; };
    if (r.s.genug){ strich(r.s.median, 'med'); strich(r.s.p90, 'p90'); }
  });
  return s + `<line class="achse" x1="${X0}" x2="${X1}" y1="${Ht - unten}" y2="${Ht - unten}"/></svg>`;
}

/* ---------- PAK-Muster ---------- */
function muster(){
  const projekte = [...new Set(S.profile.map(p => p.projekt))].sort((a, b) => b.localeCompare(a, 'de', { numeric: true }));
  if (!projekte.length){ $('ansicht').innerHTML = '<p class="hinweis">Noch keine Proben mit Einzel-PAK gefunden.</p>'; return; }
  if (!projekte.includes(S.m.projekt)) S.m.projekt = projekte[0];
  const eigene = S.profile.filter(p => p.projekt === S.m.projekt), andere = S.profile.filter(p => p.projekt !== S.m.projekt), info = eigene[0];
  const gleich = (a, b) => (a.art || OHNE) === (b.art || OHNE) && (S.m.vergleich === 'matrix' || (S.m.vergleich === 'brandgut' ? a.brandgut && a.brandgut === b.brandgut : a.nutzung && a.nutzung === b.nutzung));
  const matrizen = [...new Set(eigene.map(p => p.art || OHNE))];
  const kopf = A.PAK16.map(([k, n]) => `<th class="z" title="${esc(n)}">${k}</th>`).join('');
  const zelle = (v, unter) => v === undefined ? '<td class="z leer">–</td>' : unter ? '<td class="z bg">&lt;BG</td>' : `<td class="z" data-t="${v}">${prozent(v)}</td>`;
  let zeilen = '', quot = '';
  for (const mtx of matrizen){
    const ps = eigene.filter(p => (p.art || OHNE) === mtx), ref = andere.filter(o => gleich(o, ps[0])), med = A.medianProfil(ref);
    for (const p of ps){ zeilen += `<tr><td>${esc(p.ref || p.probe)}<br><span class="aus-pj">${esc(mtx)} · ${p.k}/16 über BG</span></td>${p.anteile.map((v, i) => zelle(v, p.unter[i])).join('')}</tr>`;
      quot += `<tr><td>${esc(p.ref || p.probe)}</td>${p.quotienten.map(q => `<td class="z">${q == null ? '–' : q.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`).join('')}</tr>`; }
    zeilen += `<tr class="ref"><td>Vergleich ${esc(mtx)}<br><span class="aus-pj">Median aus ${ref.length} Proben anderer Projekte</span></td>${med ? med.map(v => zelle(v, false)).join('') : `<td colspan="16" class="hinweis">Zu wenige Vergleichsproben (mindestens ${A.MIN_N}).</td>`}</tr>`;
    const qm = A.QUOTIENTEN.map((_, j) => { const xs = ref.map(r => r.quotienten[j]).filter(v => v != null).sort((a, b) => a - b); return xs.length >= A.MIN_N ? xs[xs.length >> 1] : null; });
    quot += `<tr class="ref"><td>Vergleich ${esc(mtx)} (Median)</td>${qm.map(q => `<td class="z">${q == null ? '–' : q.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`).join('')}</tr>`;
  }
  $('ansicht').innerHTML = `<div class="filter"><label class="feld">Projekt${auswahl('mP', S.m.projekt, projekte)}</label>
      <label class="feld">Vergleichen mit Proben anderer Projekte${auswahl('mV', S.m.vergleich, [['matrix', 'gleiche Matrix'], ['brandgut', 'gleiche Matrix und gleiches Brandgut'], ['nutzung', 'gleiche Matrix und gleiche Nutzung']])}</label>
      <p class="hinweis">Brandgut: ${esc(info.brandgut || OHNE)} · Nutzung: ${esc(info.nutzung || OHNE)}</p></div>
    <h2>Anteil jedes Einzel-PAK an der Summe der gemessenen Einzel-PAK</h2>
    <div class="diagramm"><table class="waerme"><thead><tr><th>Probe</th>${kopf}</tr></thead><tbody>${zeilen}</tbody></table></div>
    <p class="quelle">Je Probe ergeben die Anteile zusammen 100 %. &lt;BG = unter Bestimmungsgrenze (nicht mitgerechnet), – = nicht bestimmt. Das Muster ist unabhängig von der Einheit; verglichen wird nur innerhalb derselben Matrix.</p>
    <h3>Diagnostische Quotienten</h3>
    <table><thead><tr><th>Probe</th>${A.QUOTIENTEN.map(q => `<th class="z">${q[0]}</th>`).join('')}</tr></thead><tbody>${quot}</tbody></table>
    <p class="quelle">Nur berechnet, wenn beide Stoffe über BG liegen. Ohne Schwellen: Die Quotienten wurden überwiegend für Sedimente und Luft hergeleitet; wie gut sie sich auf Brandrückstände in Innenräumen übertragen lassen, ist offen. Quelle: ${esc(A.QUELLE)}</p>`;
  $('mP').onchange = e => { S.m.projekt = e.target.value; muster(); };
  $('mV').onchange = e => { S.m.vergleich = e.target.value; muster(); };
  // Einfarbige Abstufung (hell → Spektron-Blau) bis 30 %; Text wechselt auf Weiß, wo der Grund dunkel wird.
  const a = [0xF3, 0xF7, 0xFB], b = [0x24, 0x5C, 0x9E];
  $('ansicht').querySelectorAll('td[data-t]').forEach(td => { const t = Math.min(1, Number(td.dataset.t) / .3); td.style.background = `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; if (t > .55) td.style.color = '#fff'; });
}

/* ---------- Zuordnen ---------- */
function zuordnen(){
  const liste = S.projekte.filter(p => p.messungen.length && (!S.nurOffen || !wirksam(p).nutzung || !wirksam(p).brandgut));
  const feld = (p, k) => { if (p[k]) return `<span title="Aus den Projektdaten der Projektzentrale">${esc(p[k])}</span><br><span class="aus-pj">aus Projektdaten</span>`;
    const t = (S.tags[p.name] || {})[k] || ''; return `<select data-projekt="${esc(p.name)}" data-feld="${k}" aria-label="${k === 'nutzung' ? 'Nutzung' : 'Brandgut'} für ${esc(p.nr)}"><option value="">—</option>${OPTIONEN[k].map(o => `<option ${o === t ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; };
  $('ansicht').innerHTML = `<p class="hinweis">Für den Vergleich nach Brandgut und Nutzung. Hier ergänzte Angaben stehen nur in <code>${L.TAGS}</code> im Archivordner – die Projektdaten bleiben unverändert, und was dort eingetragen ist, gilt immer vorrangig.</p>
    ${S.tagsFehler ? `<div class="meldung fehler">${esc(S.tagsFehler)}</div>` : ''}
    <label><input type="checkbox" id="nurOffen" ${S.nurOffen ? 'checked' : ''}> nur Projekte mit fehlender Angabe</label>
    <table><thead><tr><th>Projekt</th><th>Schadenereignis (aus Projektdaten)</th><th class="z">Proben</th><th>Nutzung</th><th>Brandgut</th></tr></thead><tbody>
    ${liste.map(p => `<tr><td><b>${esc(p.nr)}</b></td><td>${esc(p.schadenereignis) || '<span class="aus-pj">–</span>'}</td><td class="z">${new Set(p.messungen.map(x => x.probe)).size}</td><td>${feld(p, 'nutzung')}</td><td>${feld(p, 'brandgut')}</td></tr>`).join('') || '<tr><td colspan="5" class="hinweis">Alles zugeordnet.</td></tr>'}</tbody></table>`;
  $('nurOffen').onchange = e => { S.nurOffen = e.target.checked; zuordnen(); };
  $('ansicht').querySelectorAll('select[data-projekt]').forEach(sel => sel.onchange = async () => {
    sel.disabled = true;
    try{ S.tags = await L.tagSetzen(S.archiv, sel.dataset.projekt, sel.dataset.feld, sel.value); S.tagsFehler = ''; aufbauen(); meldung('Gespeichert.'); }
    catch(e){ meldung('Nicht gespeichert: ' + e.message, true); sel.value = (S.tags[sel.dataset.projekt] || {})[sel.dataset.feld] || ''; }
    finally{ sel.disabled = false; }
  });
}

/* ---------- Export ---------- */
$('csv').onclick = () => {
  const blob = new Blob([A.csv(S.alle)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `Spektron-Datenarchiv_${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

/* ---------- Start: Archivordner der Suite übernehmen, ohne nachzufragen ---------- */
(async () => {
  if (!('showDirectoryPicker' in window)){ $('stand').textContent = 'Dieser Browser kann keine Ordner öffnen. Bitte Chrome oder Edge verwenden.'; $('waehlen').disabled = true; return; }
  const h = await L.archivAusSpeicher(); if (!h) return;
  await verbinden(h); if (!$('lesen').disabled) einlesen();
})();
})();
