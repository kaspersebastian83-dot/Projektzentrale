'use strict';
const D=BueroData,$=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=t=>new Date(t).toLocaleString('de-DE');
const state={archive:null,records:[],errors:['Archivordner nicht verbunden.'],selected:null,busy:false,refreshing:false,updated:null,drafts:new Map(),pending:null,personen:null,maFehler:'',zust:new Map()};
const M=BueroMa,lsGet=k=>{try{return localStorage.getItem(k)||'';}catch(e){return '';}},lsSet=(k,v)=>{try{v?localStorage.setItem(k,v):localStorage.removeItem(k);}catch(e){}};
/** Ort ohne Kürzel und zuständige Person (manuelle Auswahl der Projektzentrale vor Ordnername). */
const view=r=>M.ansicht(r.content.project,state.personen,state.zust.get(r.projectHandle?.name||r.content.project.name));
const suchtext=r=>{const v=view(r);return `${r.content.project.nr} ${v.ort} ${v.kuerzel} ${v.name}`.toLocaleLowerCase('de');};
const zustText=v=>!state.personen&&!v.manuell?'':v.kuerzel?esc(v.name)+(v.manuell?' <small>(in der Projektzentrale gewählt)</small>':''):(v.manuell?'Keine Angabe':'Nicht erkannt');
function werPasst(r){const w=$('wer').value;if(!w||!state.personen)return true;const k=M.maNorm(view(r).kuerzel);
  if(w==='ich')return !!k&&k===M.maNorm(lsGet('spektron-ich'));if(w==='ohne')return !M.person(state.personen,view(r).kuerzel);return k===w.slice(2);}
function werOptionen(){const sel=$('wer'),alt=sel.value||lsGet('buero-wer'),ps=state.personen||[],ich=M.person(ps,lsGet('spektron-ich'));
  $('wer-feld').hidden=!ps.length;
  $('ma-hinweis').textContent=state.maFehler?' · Zuständige Personen nicht verfügbar ('+state.maFehler+')':'';
  sel.innerHTML=`<option value="">Alle</option>${ich?`<option value="ich">Meine Übergaben</option>`:''}${ps.filter(p=>p.aktiv!==false).map(p=>`<option value="k:${esc(M.maNorm(p.ordnerKuerzel))}">${esc(p.name)}</option>`).join('')}<option value="ohne">Ohne erkannte Person</option>`;
  sel.value=[...sel.options].some(o=>o.value===alt)?alt:'';}
try{const raw=sessionStorage.getItem('buero-office-pending');try{state.pending=JSON.parse(raw);}catch{state.pending={unreadable:raw};}}catch{state.pending={unreadable:'Lokaler Sitzungsspeicher nicht zugänglich.'};}
const pendingStore=BueroPending.create();
const store={async open(){return new Promise((res,rej)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});},async get(){const db=await this.open();return new Promise((res,rej)=>{const r=db.transaction('kv').objectStore('kv').get('archiv');r.onsuccess=()=>{db.close();res(r.result);};r.onerror=()=>rej(r.error);});},async set(h){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(h,'archiv');t.oncomplete=()=>{db.close();res();};t.onerror=()=>rej(t.error);});}};
function message(text,error=false){$('message').hidden=false;$('message').textContent=text;$('message').classList.toggle('b-error',error);}
function warning(){const bad=state.errors.length;$('warning').hidden=!bad;$('warning').textContent='Übersicht möglicherweise unvollständig/veraltet: '+state.errors.join(' · ');$('updated').textContent=state.updated?'Zuletzt aktualisiert '+time(state.updated):'Noch nicht aktualisiert';$('retry').hidden=!state.pending;$('pending').hidden=!state.pending;$('pending-text').textContent=state.pending?JSON.stringify(state.pending,null,2):'';}
// These actions never assign a new directory to an old attempt.
$('pending-discard').onclick=async()=>{
  if(state.busy||!state.pending)return;
  if(!confirm('Eingaben zuerst nachlesen und bei Bedarf kopieren/sichern. Nur diesen lokalen Schreibversuch verwerfen? Bereits gespeicherte Rückmeldungen bleiben erhalten. Danach die Ablage mit dem Büro klären, den richtigen Auftrag neu öffnen und den Verlauf vor einer neuen Rückmeldung prüfen.'))return;
  state.busy=true;try{await pendingStore.discard(state.pending);sessionStorage.removeItem(BueroPending.KEY);state.pending=null;message('Lokalen Schreibversuch verworfen. Richtigen Projektordner und Auftrag neu öffnen, Verlauf prüfen und Eingaben bewusst neu erfassen.');}catch(e){message('Schreibversuch bleibt erhalten: '+e.message,true);}finally{state.busy=false;warning();await refresh();}
};
$('pending-recover').onclick=async()=>{
  if(state.busy||state.pending)return;
  try{const attempts=await pendingStore.list(),box=$('pending-choices');box.replaceChildren();
    for(const p of attempts){const button=document.createElement('button');button.textContent=(p.project||'Unbekanntes Projekt')+' · '+(labels[p.data?.type]||'Schreibversuch')+' · '+time(p.data?.at);button.onclick=()=>{if(state.busy||state.pending)return;try{sessionStorage.setItem(BueroPending.KEY,JSON.stringify(p));state.pending=p;box.replaceChildren();warning();renderDetail();message('Schreibversuch wiederhergestellt. Eingaben prüfen und ursprüngliches Archiv verbinden; das Wiederherstellen schreibt keine Rückmeldung.');}catch(e){message(e.message,true);}};box.append(button);}
    if(!attempts.length)message('Keine weiteren lokal gespeicherten Schreibversuche gefunden.');
  }catch(e){message('Lokale Schreibversuche nicht lesbar: '+e.message,true);}
};
async function use(h){state.archive=h;$('folder').textContent=h.name;$('grant').hidden=true;await refresh();}
$('archive').onclick=async()=>{try{const h=await showDirectoryPicker({mode:'readwrite',id:'mosaik-archiv'});if(/^\d{2}\.\d+/.test(h.name))throw Error('Bitte den Archivordner mit allen Projekten wählen.');await store.set(h);state.records=[];state.selected=null;await use(h);}catch(e){if(e.name!=='AbortError')message(e.message,true);}};
$('grant').onclick=async()=>{try{if(await state.archive.requestPermission({mode:'readwrite'})!=='granted')throw Error('Ordnerzugriff nicht erlaubt.');await use(state.archive);}catch(e){state.errors=[e.message];warning();}};
$('refresh').onclick=refresh;$('retry').onclick=retry;
$('search').oninput=renderList;$('filter').onchange=renderList;$('wer').onchange=()=>{lsSet('buero-wer',$('wer').value);renderList();};
async function refresh(){
  if(state.refreshing||state.busy)return;state.refreshing=true;
  try{
    if(!state.archive)throw Error('Bitte Archivordner verbinden.');
    if(state.archive.queryPermission&&await state.archive.queryPermission({mode:'readwrite'})!=='granted'){$('grant').hidden=false;throw Error('Ordnerzugriff fehlt.');}
    const r=await D.scan(state.archive);state.errors=r.errors;
    // Leicht: eine kleine Datei im Archiv, je Projekt mit Übergaben nur _Projekt.json. Fehler hier blockieren die Arbeitsliste nie.
    const ma=await M.personenLaden(state.archive);state.maFehler=ma&&ma.error?ma.error:'';if(!state.maFehler)state.personen=ma;
    const projekte=new Map(r.records.map(x=>[x.projectHandle.name,x.projectHandle]));
    await Promise.all([...projekte].map(async([n,h])=>state.zust.set(n,await M.zustaendigLaden(h))));
    if(!r.errors.length){state.records=r.records;state.updated=new Date().toISOString();}
    else{const merged=new Map(state.records.map(x=>[x.order.id,x]));r.records.forEach(x=>merged.set(x.order.id,x));state.records=[...merged.values()].sort((a,b)=>a.order.created.localeCompare(b.order.created));}
  }catch(e){state.errors=[e.message];}
  finally{state.refreshing=false;warning();werOptionen();renderList();renderDetail();}
}
function renderList(){
  const query=$('search').value.toLocaleLowerCase('de'),all=$('filter').value==='all';
  const rows=state.records.filter(r=>werPasst(r)&&(all||r.status!=='Erledigt'&&!r.withdrawn||r.conflict)&&(!query||suchtext(r).includes(query)));
  $('list').innerHTML=rows.length?`<table><thead><tr><th>Projekt / Schadenort · Zuständig</th><th>Übergabe</th><th>Stand / Kürzel</th></tr></thead><tbody>${rows.map(r=>`<tr data-order="${r.order.id}" tabindex="0" aria-label="${esc(r.content.project.nr+' '+view(r).ort)}"><td><b>${esc(r.content.project.nr)}</b><br>${esc(view(r).ort)}${zustText(view(r))?`<br><small data-zust>${zustText(view(r))}</small>`:''}</td><td>${esc(r.content.who)}<br><small>${time(r.order.created)}</small></td><td><span class="b-tag">${esc(r.status)}</span><br>${esc(r.actor||'—')}${r.withdrawn?'<br>Zurückgenommen':''}${r.conflict?'<br><b>Parallel geändert · prüfen</b>':''}</td></tr>`).join('')}</tbody></table><p class="b-hint">${rows.length} Auftrag / Aufträge</p>`:state.errors.length?'<p>Kein verlässlich vollständiger Stand verfügbar.</p>':'<p>Keine passenden '+(all?'':'offenen ')+'Aufträge.</p>';
  if(!all){const cancelled=state.records.filter(r=>r.withdrawn&&werPasst(r)&&(!query||suchtext(r).includes(query)));if(cancelled.length)$('list').innerHTML+=`<details><summary>Zurückgenommene Übergaben (${cancelled.length}) · bitte beachten</summary>${cancelled.map(r=>`<p><button data-order="${r.order.id}">${esc(r.content.project.nr)} · ${esc(view(r).ort)} · Rücknahme ansehen</button></p>`).join('')}</details>`;}
  $('list').querySelectorAll('[data-order]').forEach(el=>{const select=()=>{if(state.busy)return;state.selected=el.dataset.order;renderDetail();};el.onclick=select;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};});
}
const labels={claim:'Übernommen',proof:'Gegengelesen',pdf:'PDF erstellt / zugeordnet',send:'Versand dokumentiert',question:'Rückfrage an Sachverständigen',answer:'Rückfrage beantwortet',withdraw:'Übergabe zurückgenommen',revise:'Übergabe geändert',correct:'Status bewusst korrigiert',resolve:'Parallele Rückmeldungen geprüft'};
function renderDetail(){
  const r=state.records.find(x=>x.order.id===state.selected);if(!r)return;
  const draft=state.drafts.get(r.order.id)||{actor:localStorage.getItem('buero-kuerzel')||'',pdf:r.pdf?.path||'',text:'',date:new Date().toLocaleDateString('sv-SE'),selected:r.content.recipients.filter(x=>!r.sent[x.id]).map(x=>x.id),step:'proof',reason:''};state.drafts.set(r.order.id,draft);
  if(state.renderedId===r.order.id)draft.open=Array.from($('detail').querySelectorAll('details'),el=>el.open);
  state.renderedId=r.order.id;
  // Preserve focus and selection while new append-only records arrive.
  const active=document.activeElement,key=active?.dataset?.field,pos=key?active.selectionStart:null;
  const blocked=state.busy||!!state.errors.length||!!state.pending||r.withdrawn;
  $('detail').innerHTML=`<div class="b-row"><h2>${esc(r.content.project.nr)} · ${esc(view(r).ort)}</h2><span class="b-tag">${r.status}</span></div>${zustText(view(r))?`<p data-zust-detail>Zuständig: ${zustText(view(r))}</p>`:''}
    <p>Von ${esc(r.content.who)} · ${time(r.order.created)}${r.actor?' · Bearbeitung '+esc(r.actor):''}</p>
    ${r.withdrawn?'<p class="b-message b-error">Die Übergabe wurde zurückgenommen. Nicht weiter bearbeiten; Rücknahmegrund im Verlauf beachten.</p>':''}
    ${r.conflict?'<p class="b-message b-error">Parallele Rückmeldungen erkannt. Alle Einträge im Verlauf prüfen, mit den Beteiligten abstimmen und den angezeigten Stand bewusst bestätigen. Bis dahin kein Abschluss.</p>':''}
    <h3>Gutachtendatei</h3><p class="b-path">${esc(r.content.project.name+'/'+r.content.word)}</p><button data-copy="${esc(r.content.project.name+'/'+r.content.word)}">Dateipfad kopieren</button>
    <p class="b-hint">Original im Projektordner mit Word öffnen und bearbeiten. Die App lädt keine Bearbeitungskopie herunter.</p>
    <p>${esc(r.content.instruction)}</p>${r.content.note?'<div class="b-message b-address">'+esc(r.content.note)+'</div>':''}
    ${r.question?'<div class="b-message b-address"><b>Rückfrage:</b> '+esc(r.question)+'</div>':''}
    <h3>Bestätigte Empfänger</h3>${r.content.recipients.map(x=>`<div class="b-recipient"><b>${esc(x.label)}</b><div class="b-address">${esc(x.details)}</div><div class="b-hint">${r.sent[x.id]?'Versandt '+esc(r.sent[x.id].date)+' · '+esc(r.sent[x.id].actor):'Versand offen'}</div></div>`).join('')}
    <label>Bearbeitendes Kürzel<input data-field="actor" value="${esc(draft.actor)}"></label>
    <div class="b-row"><button data-action="claim" ${blocked||r.conflict?'disabled':''}>Übernehmen</button><button data-action="proof" ${blocked||r.conflict?'disabled':''}>Gegengelesen</button><span class="b-hint">${r.proof?'✓ '+time(r.proof.at)+' / '+esc(r.proof.actor):'Gegenlesen offen'}</span></div>
    <label>Versand-PDF · relativer Ablageort<input data-field="pdf" value="${esc(draft.pdf)}" placeholder="Mitteilungen/Gutachten.pdf"></label>
    <div class="b-row"><button data-pdf-pick ${blocked?'disabled':''}>PDF im Projektordner auswählen …</button><button data-action="pdf" ${blocked||r.conflict?'disabled':''}>PDF erstellt</button></div>
    ${r.pdf?'<p class="b-path">'+esc(r.content.project.name+'/'+r.pdf.path)+'</p><button data-copy="'+esc(r.content.project.name+'/'+r.pdf.path)+'">PDF-Pfad kopieren</button>':''}
    <details><summary>Versand dokumentieren</summary><p class="b-hint">Versand erfolgt außerhalb der App. Nur tatsächlich versandte Empfänger bestätigen.</p>
      ${r.content.recipients.filter(x=>!r.sent[x.id]).map(x=>`<label><input type="checkbox" data-send="${x.id}" ${draft.selected.includes(x.id)?'checked':''}>${esc(x.details)}</label>`).join('')}
      <label>Versanddatum<input type="date" data-field="date" value="${esc(draft.date)}"></label><button data-action="send" ${blocked||r.conflict?'disabled':''}>Versand für ausgewählte Empfänger dokumentieren</button>
    </details><details><summary>Rückfrage an Sachverständigen</summary><label>Rückfrage / ergänzende Nachricht<textarea data-field="text">${esc(draft.text)}</textarea></label><button data-action="question" ${blocked||r.conflict?'disabled':''}>Rückfrage dokumentieren</button>${r.question?'<button data-action="answer" '+(blocked||r.conflict?'disabled':'')+'>Rückfrage nach Klärung schließen</button>':''}</details>
    <details><summary>Fehlerhafte Statusangabe korrigieren</summary><label>Welche Angabe soll zurückgenommen werden?<select data-field="step"><option value="proof">Gegenlesen wieder offen</option><option value="pdf">PDF-Zuordnung wieder offen</option>${r.content.recipients.filter(x=>r.sent[x.id]).map(x=>`<option value="send:${x.id}">Versand wieder offen: ${esc(x.details)}</option>`).join('')}</select></label><label>Begründung<textarea data-field="reason">${esc(draft.reason)}</textarea></label><button data-action="correct" ${blocked||r.conflict?'disabled':''}>Ausgewählte Angabe bewusst korrigieren</button><p class="b-hint">Andere Versandvermerke bleiben erhalten. Der ursprüngliche Eintrag bleibt im Verlauf.</p></details>
    ${r.conflict?'<button data-action="resolve" '+(state.busy||state.errors.length||state.pending?'disabled':'')+'>Angezeigten Stand nach Prüfung bestätigen</button>':''}
    <details ${r.conflict?'open':''}><summary>Bearbeitungsverlauf (${r.events.length})</summary><ol class="b-history"><li>${time(r.order.created)} · ${esc(r.order.content.who)} · Übergabe<br><small>Word: ${esc(r.order.content.word)}<br>${r.order.content.recipients.map(x=>esc(x.details)).join('<br>')}</small></li>${r.events.map(e=>`<li>${time(e.at)} · ${esc(e.actor)} · <b>${esc(labels[e.type]||e.type)}</b><br><small class="b-address">${esc(eventText(e,r))}</small></li>`).join('')}</ol></details><p class="b-hint">Auftrag ${r.order.id}</p>`;
  $('detail').querySelectorAll('details').forEach((el,i)=>{if(draft.open&&i<draft.open.length)el.open=draft.open[i];});
  if(r.conflict)$('detail').querySelector('details:last-of-type').open=true;
  $('detail').querySelector('[data-field=step]').value=draft.step;
  $('detail').querySelectorAll('[data-field]').forEach(el=>{el.oninput=()=>{draft[el.dataset.field]=el.value;if(el.dataset.field==='actor')localStorage.setItem('buero-kuerzel',el.value);};});
  $('detail').querySelectorAll('[data-send]').forEach(el=>el.onchange=()=>{draft.selected=Array.from($('detail').querySelectorAll('[data-send]:checked'),x=>x.dataset.send);});
  $('detail').querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>act(r,draft,el.dataset.action));
  $('detail').querySelector('[data-pdf-pick]').onclick=async()=>{try{draft.pdf=await D.selectFile(r.projectHandle,/\.pdf$/i);renderDetail();}catch(e){if(e.name!=='AbortError')message(e.message,true);}};
  $('detail').querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);message('Dateipfad kopiert.');}catch{message('Kopieren nicht verfügbar. Den sichtbaren Dateipfad markieren und mit Strg+C kopieren.',true);}});
  if(key){const el=$('detail').querySelector('[data-field="'+key+'"]');if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch{}}}
}
function eventText(e,r){const p=e.payload;switch(e.type){case 'send':return p.date+' · PDF: '+(p.pdf||'nicht vermerkt')+' · '+p.ids.map(id=>r.content.recipients.find(x=>x.id===id)?.details||id).join(' | ');case 'pdf':return p.path;case 'revise':return 'Word: '+p.content.word+'\nHinweis: '+p.content.note+'\n'+p.content.recipients.map(x=>x.details).join('\n');case 'correct':return p.step+' '+(p.recipient||'')+' · '+p.reason;default:return p.text||'';}}
async function act(r,d,type){
  if(state.busy||state.pending)return;state.busy=true;
  try{
    if(state.errors.length)throw Error('Zuerst vollständigen Ordnerzugriff wiederherstellen und aktualisieren.');
    const fresh=await D.load(r.projectHandle,r.order.id);
    if(JSON.stringify(fresh.heads)!==JSON.stringify(r.heads))throw Error('Der Auftrag wurde inzwischen geändert. Aktualisieren und den neuen Stand prüfen.');
    if(fresh.withdrawn&&type!=='resolve')throw Error('Übergabe zurückgenommen.');
    if(fresh.conflict&&type!=='resolve')throw Error('Zuerst parallele Rückmeldungen prüfen.');
    let payload={};
    if(type==='pdf'){await D.checkFile(r.projectHandle,d.pdf,/\.pdf$/i);payload={path:d.pdf};}
    if(type==='send'){
      if(!fresh.proof||!fresh.pdf)throw Error('Zuerst Gegenlesen und die tatsächlich erstellte PDF dokumentieren.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!d.selected.length)throw Error('Versanddatum und tatsächlich versandte Empfänger auswählen.');
      payload={date:d.date,pdf:fresh.pdf.path,ids:d.selected.filter(id=>fresh.content.recipients.some(x=>x.id===id)&&!fresh.sent[id])};if(!payload.ids.length)throw Error('Keine offenen Empfänger ausgewählt.');
    }
    if(type==='question'||type==='answer'){if(!d.text.trim())throw Error('Rückfrage beziehungsweise Klärungsvermerk ergänzen.');payload={text:d.text.trim()};}
    if(type==='correct'){if(!d.reason.trim())throw Error('Begründung der Korrektur ergänzen.');const[step,recipient]=d.step.split(':');payload={step,recipient:recipient||null,reason:d.reason.trim()};}
    if(type==='resolve')payload={text:'Alle angezeigten parallelen Rückmeldungen geprüft; Stand bewusst bestätigt.'};
    const e=D.event(r,type,payload,d.actor);
    state.pending=await pendingStore.prepare(state.archive,r.projectHandle,fresh.order,e);
    sessionStorage.setItem(BueroPending.KEY,JSON.stringify(state.pending));
    await savePending();
  }catch(e){message('Nicht bestätigt gespeichert: '+e.message,true);}
  finally{state.busy=false;warning();await refresh();}
}
async function savePending(){
  if(!state.archive)throw Error('Archivordner verbinden.');const p=state.pending;
  // Only the persisted original native handle is a write target, including after restart.
  const project=await pendingStore.source(p,state.archive);
  const scan=await D.scanProject(project,p.data);
  if(scan.errors.length)throw Error('Büroaufträge nicht vollständig geprüft: '+scan.errors.join(' · '));
  const matches=scan.records.filter(r=>r.order.id===p.data.orderId);
  if(matches.length!==1)throw Error('Projektzuordnung des Speicherversuchs nicht eindeutig. Bitte den ursprünglichen Projektordner und Auftrag prüfen.');
  const r=matches[0];
  if(JSON.stringify(p.order)!==JSON.stringify(r.order))throw Error('Der Auftrag des Speicherversuchs wurde ausgetauscht. Bitte den ursprünglichen Auftrag prüfen.');
  await D.append(project,p.data);
  await pendingStore.finish(p);sessionStorage.removeItem(BueroPending.KEY);state.pending=null;message('✓ Gespeichert und rückgelesen.');
}
async function retry(){if(state.busy||!state.pending)return;state.busy=true;try{await savePending();}catch(e){message('Nicht bestätigt gespeichert: '+e.message,true);}finally{state.busy=false;warning();await refresh();}}
window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(()=>{if(!document.hidden)refresh();},30000);
window.addEventListener('beforeunload',e=>{if(state.busy||state.pending){e.preventDefault();e.returnValue='';}});
(async()=>{try{const h=await store.get();if(h)await use(h);else warning();}catch(e){state.errors=[e.message];warning();}})();
if('serviceWorker'in navigator)navigator.serviceWorker.register('../sw.js').catch(()=>{});
