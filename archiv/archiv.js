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
const S = { archiv: null, projekte: [], tags: {}, tagsFehler: '', alle: [], profile: [], reiter: 'uebersicht', v: { key: '', matrix: '', nutzung: '', rolle: 'ohneFrei', gruppe: 'brandgut', hervor: '' }, m: { projekt: '', vergleich: 'matrix', aus: new Set(), an: new Set() }, nurOffen: true, z: { projekt: '' }, liest: false };

/* ---------- Zustand ---------- */
function wirksam(p){ const t = S.tags[p.name] || {}; return { nutzung: p.nutzung || t.nutzung || '', brandgut: p.brandgut || t.brandgut || '', nutzungTag: !p.nutzung && !!t.nutzung, brandgutTag: !p.brandgut && !!t.brandgut }; }
function aufbauen(){
  S.alle = []; S.profile = [];
  for (const p of S.projekte){
    const w = wirksam(p);
    const tage = x => A.tageNachBrand(p.schadendatum, x.datum);
    for (const x of p.messungen) S.alle.push({ ...x, projekt: p.name, nr: p.nr, jahr: p.jahr, nutzung: w.nutzung, brandgut: w.brandgut, rolle: rolleVon(p, x), tage: tage(x) });
    for (const pr of A.profile(p.messungen)) S.profile.push({ ...pr, projekt: p.name, nr: p.nr, nutzung: w.nutzung, brandgut: w.brandgut, rolle: rolleVon(p, pr), tage: tage(pr) });
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
  const rollePasst = x => S.v.rolle === 'alle' || (S.v.rolle === 'ohneFrei' ? x.rolle !== 'frei' : S.v.rolle === 'keine' ? !x.rolle : x.rolle === S.v.rolle);
  const gefiltert = basis.filter(x => (!S.v.matrix || (x.art || OHNE) === S.v.matrix) && (!S.v.nutzung || (x.nutzung || OHNE) === S.v.nutzung) && rollePasst(x));
  const projekte = [...new Set(gefiltert.map(x => x.projekt))].sort((a, b) => b.localeCompare(a, 'de', { numeric: true }));
  if (S.v.hervor && !projekte.includes(S.v.hervor)) S.v.hervor = '';
  const gruppeVon = x => S.v.gruppe === 'brandgut' ? x.brandgut || OHNE : S.v.gruppe === 'nutzung' ? x.nutzung || OHNE : S.v.gruppe === 'matrix' ? x.art || OHNE : S.v.gruppe === 'jahr' ? String(x.jahr) : S.v.gruppe === 'rolle' ? A.ROLLE_NAME[x.rolle] || 'ohne Rolle' : S.v.gruppe === 'tage' ? A.tageKlasse(x.tage) : 'Alle Werte';
  const gruppen = new Map(); for (const x of gefiltert){ const g = gruppeVon(x); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g).push(x); }
  const reihen = [...gruppen].map(([name, werte]) => ({ name, werte, s: A.statistik(werte) })).sort((a, b) => (a.name === OHNE) - (b.name === OHNE) || b.s.n - a.s.n);
  if (S.v.gruppe !== 'keine' && reihen.length > 1) reihen.unshift({ name: 'Alle Werte', werte: gefiltert, s: A.statistik(gefiltert), alle: true });
  $('ansicht').innerHTML = `<div class="filter">
      <label class="feld">Parameter · Einheit (Anzahl Werte)${auswahl('vP', S.v.key, params.map(x => [x.key, `${x.p} · ${x.u} (${x.n})`]))}</label>
      <label class="feld">Matrix${auswahl('vM', S.v.matrix, matrizen, 'alle')}</label>
      <label class="feld">Nutzung${auswahl('vN', S.v.nutzung, [...OPTIONEN.nutzung, OHNE], 'alle')}</label>
      <label class="feld">Proben${auswahl('vR', S.v.rolle, [['ohneFrei', 'ohne Freimessungen'], ['alle', 'alle'], ...A.ROLLEN.map(([v, t]) => [v, 'nur ' + t]), ['keine', 'nur ohne Rolle']])}</label>
      <label class="feld">Gruppieren nach${auswahl('vG', S.v.gruppe, [['brandgut', 'Brandgut'], ['nutzung', 'Nutzung'], ['rolle', 'Rolle der Probe'], ['tage', 'Tage nach dem Brand'], ['matrix', 'Matrix'], ['jahr', 'Jahr'], ['keine', 'nicht gruppieren']])}</label>
      <label class="feld">Projekt hervorheben${auswahl('vH', S.v.hervor, projekte, '—')}</label></div>
    ${gefiltert.length ? `<div class="legende"><span><i class="lg-pkt"></i>Messwert einer Probe</span>${S.v.hervor ? `<span><i class="lg-hp"></i>${esc(S.v.hervor.split(' ')[0])}</span>` : ''}<span>│ Median</span><span>┆ 90. Perzentil</span><span>Logarithmische Achse</span></div>
      <div class="diagramm">${streifen(reihen, u)}</div>
      <h3>Kennzahlen</h3><table><thead><tr><th>Gruppe</th><th class="z">Werte</th><th class="z">davon &lt; BG</th><th class="z">Median</th><th class="z">90. Perzentil</th><th class="z">Größter Wert</th><th class="z">Projekte</th></tr></thead><tbody>
      ${reihen.map(r => `<tr${r.alle ? ' class="ref"' : ''}><td>${esc(r.name)}</td><td class="z">${r.s.n}</td><td class="z">${r.s.unter}</td><td class="z">${r.s.genug ? kennText(r.s.median) : 'zu wenige'}</td><td class="z">${r.s.genug ? kennText(r.s.p90) : '–'}</td><td class="z">${zahlText(r.s.max)}</td><td class="z">${new Set(r.werte.map(x => x.projekt)).size}</td></tr>`).join('')}</tbody></table>
      <p class="quelle">${esc(u)} · Werte unter BG und „n. n.“ zählen als kleinste Werte; fällt eine Kennzahl darauf, steht „&lt; BG“. Kennzahlen ab ${A.MIN_N} Werten. Nur endgültige Prüfberichte. Rolle der Probe aus der Probenbezeichnung (änderbar unter „Zuordnen“). Keine Grenz- oder Orientierungswerte – nur der eigene Bestand.</p>`
    : '<p class="hinweis">Keine Werte für diese Auswahl.</p>'}`;
  const an = (id, k) => { $(id).onchange = e => { S.v[k] = e.target.value; if (k === 'key'){ S.v.matrix = ''; S.v.hervor = ''; } vergleich(); }; };
  an('vP', 'key'); an('vM', 'matrix'); an('vN', 'nutzung'); an('vR', 'rolle'); an('vG', 'gruppe'); an('vH', 'hervor');
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
    const pkte = r.werte.filter(w => w.q === 'gemessen' && w.v > 0), tip = w => `<title>${esc(w.nr)} · Probe ${esc(w.ref || w.probe)} · ${esc(w.roh)} ${esc(w.u)}${w.art ? ' · ' + esc(w.art) : ''}${w.rolle ? ' · ' + esc(A.ROLLE_NAME[w.rolle]) : ''}${w.tage != null ? ' · ' + w.tage + ' Tage nach Brand' : ''}</title>`;
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
  const proj = S.projekte.find(p => p.name === S.m.projekt), eigene = S.profile.filter(p => p.projekt === S.m.projekt), info = eigene[0];
  // Vergleichsproben anderer Projekte: typische Brandrückstände – ohne Freimessungen, Referenzen und Verdachtsquellen
  const andere = S.profile.filter(p => p.projekt !== S.m.projekt && !['frei', 'referenz', 'quelle'].includes(p.rolle));
  const passt = (o, a) => (o.art || OHNE) === (a.art || OHNE) && o.u === a.u && (S.m.vergleich === 'matrix' || (S.m.vergleich === 'brandgut' ? a.brandgut && o.brandgut === a.brandgut : a.nutzung && o.nutzung === a.nutzung));
  const pk = p => p.probe + '|' + p.u, abgewaehlt = p => { const k = S.m.projekt + '|' + pk(p); return S.m.aus.has(k) || (p.rolle === 'frei' && !S.m.an.has(k)); }, zahl3 = v => v == null ? '–' : v.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const kurz = i => A.PAK16[i][0];
  let html = '';
  for (const mtx of [...new Set(eigene.map(p => (p.art || OHNE) + '|' + p.u))]){
    const [art, u] = [mtx.slice(0, mtx.lastIndexOf('|')), mtx.slice(mtx.lastIndexOf('|') + 1)];
    const ps = eigene.filter(p => (p.art || OHNE) === art && p.u === u), drin = ps.filter(p => !abgewaehlt(p));
    const menge = A.gemeinsam(drin), vec = new Map(drin.map(p => [pk(p), A.aufMenge(p, menge)]));
    const ref = andere.filter(o => passt(o, ps[0])).map(o => A.aufMenge(o, menge)).filter(Boolean), refMed = menge.length >= 3 ? A.medianVektor(ref) : null;
    const kopf = A.PAK16.map(([k, n], i) => `<th class="z${menge.includes(i) ? ' gem' : ''}" title="${esc(n)}${menge.includes(i) ? ' – in allen gewählten Proben über BG, im Vergleich' : ' – nicht in allen gewählten Proben über BG, nicht im Vergleich'}">${k}</th>`).join('');
    const zeile = p => { const v = vec.get(pk(p)), aus = abgewaehlt(p);
      return `<tr${aus ? ' class="aus"' : ''}><td><label class="wahl"><input type="checkbox" data-probe="${esc(pk(p))}" ${aus ? '' : 'checked'} title="Im Vergleich"> ${esc(p.ref || p.probe)}</label><br><span class="aus-pj">${p.k}/16 über BG${p.tage != null ? ' · ' + p.tage + ' Tage nach Brand' : ''}</span></td>
        <td>${rolleWahl(proj, p)}</td>${A.PAK16.map((_, i) => { const j = menge.indexOf(i);
          if (j >= 0 && v) return `<td class="z" data-t="${v[j]}">${prozent(v[j])}</td>`;
          return p.werte[i] === undefined ? '<td class="z leer">–</td>' : p.unter[i] ? '<td class="z bg">&lt;BG</td>' : '<td class="z leer" title="gemessen, aber nicht im Vergleich">·</td>'; }).join('')}</tr>`; };
    html += `<h2>${esc(art)} · ${esc(u)}</h2>
      ${menge.length < 3 ? `<div class="meldung">Nur ${menge.length} Einzel-PAK liegen in allen gewählten Proben über BG – zu wenige für einen Mustervergleich. Proben mit vielen Werten unter BG abwählen.</div>` : ''}
      <div class="diagramm"><table class="waerme"><thead><tr><th>Probe</th><th>Rolle</th>${kopf}</tr></thead><tbody>${ps.map(zeile).join('')}
      <tr class="ref"><td colspan="2">Vergleich: Median aus ${ref.length} Proben anderer Projekte<br><span class="aus-pj">gleiche Matrix und Einheit${S.m.vergleich === 'brandgut' ? ', gleiches Brandgut' : S.m.vergleich === 'nutzung' ? ', gleiche Nutzung' : ''}; ohne Freimessungen, Referenzen, Verdachtsquellen</span></td>
        ${A.PAK16.map((_, i) => { const j = menge.indexOf(i); return j >= 0 && refMed ? `<td class="z" data-t="${refMed[j]}">${prozent(refMed[j])}</td>` : '<td class="z leer">·</td>'; }).join('')}</tr></tbody></table></div>
      ${!refMed && menge.length >= 3 ? `<p class="hinweis">Zu wenige Vergleichsproben mit allen ${menge.length} Stoffen über BG (mindestens ${A.MIN_N}).</p>` : ''}`;
    if (menge.length >= 3 && drin.length){
      const spalten = drin.concat(refMed ? [{ vergleich: true }] : []), v2 = s => s.vergleich ? refMed : vec.get(pk(s));
      html += `<h3>Ähnlichkeit der Muster (Kosinus, 1 = gleiches Muster)</h3><div class="diagramm"><table class="sim"><thead><tr><th></th>${spalten.map(s => `<th class="z">${s.vergleich ? 'Vergleich' : esc(s.ref || s.probe)}</th>`).join('')}</tr></thead><tbody>
        ${drin.map(a => `<tr><td>${esc(a.ref || a.probe)}<br><span class="aus-pj">${esc(A.ROLLE_NAME[a.rolle] || 'ohne Rolle')}</span></td>${spalten.map(s => `<td class="z">${(s.vergleich ? false : pk(s) === pk(a)) ? '<span class="aus-pj">–</span>' : zahl3(A.kosinus(vec.get(pk(a)), v2(s)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="quelle">Über die ${menge.length} Einzel-PAK, die in allen gewählten Proben über BG liegen (${menge.map(kurz).join(', ')}); Werte unter BG werden nicht ersetzt. Verbrennungsrückstände ähneln sich grundsätzlich: hohe Ähnlichkeit stützt nur, ein deutlicher Unterschied (z. B. zu einer Referenz) sagt mehr. Keine Schwelle.</p>`;
    }
  }
  // Freimessungen: Paare vorher / nachher über die ID ohne „F-“
  const roh = proj.messungen, rolleM = x => rolleVon(proj, x), sum = x => /^Summe 16 EPA-PAK/i.test(x.p);
  const paare = [];
  for (const f of [...new Set(roh.filter(x => rolleM(x) === 'frei').map(x => x.probe))]){
    const fx = roh.filter(x => x.probe === f), basis = A.freiBasis(fx[0].ref) || A.freiBasis(fx[0].desc); if (!basis) continue;
    const v = roh.find(x => x.probe !== f && (A.norm(x.ref) === basis || A.norm(x.desc) === basis)); if (!v) continue;
    for (const nach of fx.filter(x => sum(x) || A.pakIndex(x.p) === 12)){ const vor = roh.find(x => x.probe === v.probe && x.p === nach.p && x.u === nach.u); if (vor) paare.push({ id: v.ref || v.probe, f: fx[0].ref || f, p: nach.p, u: nach.u, vor, nach }); }
  }
  if (paare.length) html += `<h2>Freimessungen: vorher / nachher</h2><table><thead><tr><th>Stelle</th><th>Parameter</th><th class="z">vorher</th><th class="z">nach Sanierung</th><th>Einheit</th></tr></thead><tbody>
    ${paare.map(x => `<tr><td>${esc(x.id)} → ${esc(x.f)}</td><td>${esc(A.PAK16[12] && A.pakIndex(x.p) === 12 ? 'BaP' : x.p)}</td><td class="z">${esc(x.vor.roh)}</td><td class="z">${esc(x.nach.roh)}</td><td>${esc(x.u)}</td></tr>`).join('')}</tbody></table>
    <p class="quelle">Gepaart über die Probenbezeichnung: Freimessung = alte ID mit „F-“ davor (Konvention des Handbuchs). Nach der Sanierung oft unter BG – das ist selbst ein Ergebnis.</p>`;
  // Literaturquotienten, bewusst eingeklappt
  const quot = eigene.filter(p => p.quotienten.some(q => q != null));
  html += `<details class="lit-q"><summary>Literaturquotienten – nicht für Brandrückstände validiert</summary>
    <table><thead><tr><th>Probe</th>${A.QUOTIENTEN.map(q => `<th class="z">${q[0]}</th>`).join('')}</tr></thead><tbody>
    ${quot.map(p => `<tr><td>${esc(p.ref || p.probe)} <span class="aus-pj">${esc(p.art || '')}</span></td>${p.quotienten.map(q => `<td class="z">${q == null ? '–' : q.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="5" class="hinweis">Keine Probe mit beiden Stoffen eines Paares über BG.</td></tr>'}</tbody></table>
    <p class="quelle">Nur berechnet, wenn beide Stoffe über BG liegen. Hergeleitet für Flusssedimente und Außenluft (${esc(A.QUELLE)}); für Ruß und Wischproben nach Gebäudebränden nicht validiert. Kritische Bewertungen: Galarneau (2008), Atmospheric Environment 42, 8139–8149; Katsoyiannis et al. (2011), Environ. Sci. Technol. 45, 8897–8906. Teer und Brandruß fallen beide in den „pyrogenen“ Bereich, Alterung verschiebt die Werte. Darum ohne Schwellen und nur als Hinweis.</p></details>`;
  $('ansicht').innerHTML = `<div class="filter"><label class="feld">Projekt${auswahl('mP', S.m.projekt, projekte)}</label>
      <label class="feld">Vergleichen mit Proben anderer Projekte${auswahl('mV', S.m.vergleich, [['matrix', 'gleiche Matrix'], ['brandgut', 'gleiche Matrix und gleiches Brandgut'], ['nutzung', 'gleiche Matrix und gleiche Nutzung']])}</label>
      <p class="hinweis">Brandgut: ${esc(info.brandgut || OHNE)} · Nutzung: ${esc(info.nutzung || OHNE)}${proj.schadendatum ? ' · Schadendatum ' + new Date(proj.schadendatum + 'T12:00:00').toLocaleDateString('de-DE') : ''}</p></div>
    <p class="hinweis">Anteile je Einzel-PAK, normiert nur über die Stoffe, die in <b>allen</b> gewählten Proben über BG liegen (Spalten fett). Freimessungen sind zunächst abgewählt – sie stehen unten im Vorher/nachher-Vergleich. So hängt der Vergleich nicht davon ab, welche Stoffe in einer Probe zufällig unter BG fielen. &lt;BG = unter Bestimmungsgrenze, · = nicht im Vergleich, – = nicht bestimmt.</p>
    ${html}`;
  $('mP').onchange = e => { S.m.projekt = e.target.value; muster(); };
  $('mV').onchange = e => { S.m.vergleich = e.target.value; muster(); };
  $('ansicht').querySelectorAll('input[data-probe]').forEach(cb => cb.onchange = () => { const k = S.m.projekt + '|' + cb.dataset.probe; if (cb.checked){ S.m.aus.delete(k); S.m.an.add(k); } else { S.m.aus.add(k); S.m.an.delete(k); } muster(); });
  rollenAnbinden();
  // Einfarbige Abstufung (hell → Spektron-Blau) bis 30 %; Text wechselt auf Weiß, wo der Grund dunkel wird.
  const a = [0xF3, 0xF7, 0xFB], b = [0x24, 0x5C, 0x9E];
  $('ansicht').querySelectorAll('td[data-t]').forEach(td => { const t = Math.min(1, Number(td.dataset.t) / .3); td.style.background = `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; if (t > .55) td.style.color = '#fff'; });
}
/** Rolle einer Probe: eigene Korrektur im Archiv vor der Konvention aus Probenbezeichnung/-beschreibung. 'keine' = bewusst ohne Rolle. */
function rolleVon(p, x){ const k = ((S.tags[p.name] || {}).rollen || {})[x.probe]; return k === 'keine' ? '' : k || A.rolleAuto(x.ref, x.desc); }
function rolleWahl(p, x){
  const k = ((S.tags[p.name] || {}).rollen || {})[x.probe] || '', auto = A.rolleAuto(x.ref, x.desc);
  return `<select class="rolle" data-rprojekt="${esc(p.name)}" data-rprobe="${esc(x.probe)}" title="Automatisch aus der Probenbezeichnung: ${esc(A.ROLLE_NAME[auto] || 'keine')}">
    <option value="">${esc('automatisch: ' + (A.ROLLE_NAME[auto] || 'keine'))}</option>${A.ROLLEN.map(([v, t]) => `<option value="${v}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}<option value="keine" ${k === 'keine' ? 'selected' : ''}>bewusst keine Rolle</option></select>`;
}
function rollenAnbinden(){
  $('ansicht').querySelectorAll('select.rolle').forEach(sel => sel.onchange = async () => {
    sel.disabled = true;
    try{ S.tags = await L.tagSetzen(S.archiv, sel.dataset.rprojekt, 'probe:' + sel.dataset.rprobe, sel.value); S.tagsFehler = ''; aufbauen(); zeichnen(); meldung('Rolle gespeichert.'); }
    catch(e){ meldung('Nicht gespeichert: ' + e.message, true); zeichnen(); }
  });
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
  // Rollen der Proben eines Projekts: Konvention aus der Probenbezeichnung, hier korrigierbar
  const mitWerten = S.projekte.filter(p => p.messungen.length);
  if (!mitWerten.some(p => p.name === S.z.projekt)) S.z.projekt = (mitWerten[0] || {}).name || '';
  const pz = mitWerten.find(p => p.name === S.z.projekt);
  if (pz){
    const proben = [...new Map(pz.messungen.map(x => [x.probe, x])).values()];
    $('ansicht').insertAdjacentHTML('beforeend', `<h2 class="abstand">Rollen der Proben</h2>
      <p class="hinweis">Automatisch aus Probenbezeichnung und -beschreibung: „Brandraum“, „Brandbereich“, „Brandherd“ → Brandbereich · „REF“, „Referenz“, „unbelastet“ → Referenz · „Kleber“, „Teer“, „Bitumen“ → Verdachtsquelle · „F-“ vor der alten ID, „Freimessung“ → Freimessung. Eine Korrektur hier gilt vor der Konvention und steht nur in <code>${L.TAGS}</code>.</p>
      <div class="filter"><label class="feld">Projekt${auswahl('zP', S.z.projekt, mitWerten.map(p => [p.name, p.name]))}</label></div>
      <table><thead><tr><th>Probe</th><th>Beschreibung (Labor)</th><th>Matrix</th><th>Probenahme</th><th>Rolle</th></tr></thead><tbody>
      ${proben.map(x => `<tr><td>${esc(x.ref || x.probe)}</td><td>${esc(x.desc) || '<span class="aus-pj">–</span>'}</td><td>${esc(x.art)}</td><td>${x.datum ? new Date(x.datum + 'T12:00:00').toLocaleDateString('de-DE') : '–'}${A.tageNachBrand(pz.schadendatum, x.datum) != null ? ' <span class="aus-pj">(' + A.tageNachBrand(pz.schadendatum, x.datum) + ' Tage nach Brand)</span>' : ''}</td><td>${rolleWahl(pz, x)}</td></tr>`).join('')}</tbody></table>`);
    $('zP').onchange = e => { S.z.projekt = e.target.value; zuordnen(); };
    rollenAnbinden();
  }
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
