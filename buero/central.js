/* Compact handover panel; independent drafts survive project/detail rerenders. */
(function(){
'use strict';
const D=BueroData,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drafts=new Map();let current=null,busy=false;
function saved(name){try{return JSON.parse(sessionStorage.getItem('buero-draft:'+name));}catch{return null;}}
function keep(name,d){drafts.set(name,d);try{sessionStorage.setItem('buero-draft:'+name,JSON.stringify(d));}catch{}}
function time(t){return new Date(t).toLocaleString('de-DE');}
// A known immutable attempt may be retried despite an incomplete overview. Its own
// read/compare/write checks still reject unreadable or different existing files.
function submitDisabled(c){return busy||!c.loaded||(!c.d.pending&&!!c.errors.length);}
function openOrders(c){return c.records.filter(r=>r.status!=='Erledigt'&&!r.withdrawn);}
// Only the entry presentation depends on a fully read overview.
function canPrepare(c){return c.loaded&&!c.reading&&!c.errors.length&&!openOrders(c).length;}
function revisionStamp(r){return JSON.stringify({heads:r.heads,content:r.content});}
function draftText(d){return ['Word-Datei: '+d.word,'Person / Kürzel: '+d.who,'Hinweis: '+d.note,...d.rows.map(r=>r.label+' ('+(r.selected?'ausgewählt':'abgewählt')+'):\n'+r.entries.join('\n'))].join('\n');}
function mount(container,p,readData,flush){
  const d=drafts.get(p.name)||saved(p.name)||{who:'',word:'',note:'',rows:D.recipients(readData()),pending:null,revision:null,message:''};
  // Older local drafts have no explicit marker; successfully submitted values are not a new draft.
  if(d.creationDraft==null)d.creationDraft=!d.revision&&!d.pending&&!!(d.open||d.prepared&&!d.message?.startsWith('✓ Gespeichert'));keep(p.name,d);
  if(current?.container===container&&current.p.name===p.name){Object.assign(current,{p,readData,flush});refresh();return;}
  current={container,p,readData,flush,d,records:[],errors:[],loaded:false};
  document.getElementById('vtBox')?.querySelectorAll('input,button').forEach(el=>el.disabled=true);render();refresh();
}
function rememberFocus(c){
  const el=document.activeElement,scroll=document.getElementById('detail')?.scrollTop;
  if(!c.container.contains(el)&&!document.getElementById('bueroAttention')?.contains(el))return {scroll};
  const summary=el.tagName==='SUMMARY',target=summary?el.parentElement:el;
  const attr=target.getAttributeNames().find(n=>n.startsWith('data-'));
  return {scroll,attr,value:attr?target.getAttribute(attr):'',summary,start:el.selectionStart,end:el.selectionEnd};
}
function restoreFocus(c,f){
  if(f.attr){let el=[...c.container.querySelectorAll('['+f.attr+']'),...document.getElementById('bueroAttention')?.querySelectorAll('['+f.attr+']')||[]].find(el=>el.getAttribute(f.attr)===f.value);if(f.summary)el=el?.querySelector(':scope > summary');if(!el||!el.getClientRects().length)el=c.container.querySelector('[data-handover-label]');if(el){el.focus({preventScroll:true});try{el.setSelectionRange(f.start,f.end);}catch{}}}
  if(f.scroll!=null)document.getElementById('detail').scrollTop=f.scroll;
}
function openForm(c){if(!c.d.pending&&!c.d.revision&&!c.d.creationDraft&&!canPrepare(c))return;if(!c.d.pending&&!c.d.revision)c.d.creationDraft=true;c.d.handOpen=true;c.d.open=true;keep(c.p.name,c.d);c.container.querySelector('[data-handover]').open=true;c.container.querySelector('[data-form]').open=true;}
function render(){
  const c=current;if(!c||!c.container.isConnected)return;const {container,p,d}=c;
  const focus=rememberFocus(c);container.className='buero b-card';
  container.innerHTML=`<h3>Übergabe ans Büro</h3><div data-overview></div><div data-alerts role="status"></div>
    <div data-message role="status" class="b-message ${d.messageError?'b-error':''}" ${d.message?'':'hidden'}>${esc(d.message)}</div>
    ${d.pending?`<p class="b-message b-error">Speicherung noch ungeklärt. Derselbe Versuch bleibt erhalten. <button data-retry ${submitDisabled(c)?'disabled':''}>Speicherung erneut prüfen / versuchen</button> <button data-show-form>Eingaben ansehen</button></p>`:''}
    <div class="b-row"><button data-refresh>Aktualisieren</button><span class="b-hint" data-updated>${c.updated?'Zuletzt aktualisiert '+time(c.updated):'Noch nicht aktualisiert'}</span></div>
    <details data-handover ${d.handOpen?'open':''}><summary data-handover-label>Details ansehen / Übergabe vorbereiten</summary>
    <div data-records></div>
    <details data-form hidden ${d.open?'open':''}><summary data-form-label>${d.revision?'Offene Übergabe ändern':'Übergabe vorbereiten'}</summary><p data-draft-hint class="b-hint" hidden>Dieser Entwurf wurde noch nicht übergeben. Es gibt inzwischen eine offene Übergabe. Bitte diese prüfen; der Entwurf bleibt erhalten.</p>
      ${d.revisionPrevious?`<details data-previous open><summary>Bisheriger Entwurf zum Nachlesen und Kopieren</summary><div class="b-address">${esc(d.revisionPrevious)}</div></details>`:''}
      <button data-pick class="primary" ${d.pending?'disabled':''}>Word-Datei auswählen</button>
      <p data-chosen class="b-path">${d.word?esc(d.word):'Noch keine Word-Datei ausgewählt'}</p>
      <details data-path ${d.pathOpen?'open':''}><summary>Alternativ: relativen Dateipfad eingeben</summary><label>Word-Datei im Projektordner<input data-word value="${esc(d.word)}" placeholder="Mitteilungen/Gutachten.docx" ${d.pending?'readonly':''}></label></details>
      <h4>Empfänger bestätigen</h4>
      ${d.rows.map((r,i)=>`<div class="b-recipient"><label><input type="checkbox" data-group="${i}" ${r.selected?'checked':''} ${d.pending?'disabled':''}>${esc(r.label)}</label><div data-group-fields="${i}" ${r.selected?'':'hidden'}>${r.entries.map((v,j)=>`<label>Empfängerangaben ${j+1}<textarea data-entry="${i}:${j}" ${d.pending?'readonly':''}>${esc(v)}</textarea></label>`).join('')}<button data-add="${i}" ${d.pending?'disabled':''}>Weiterer Empfänger</button></div></div>`).join('')}
      <label>Optionaler Hinweis fürs Büro<textarea data-note ${d.pending?'readonly':''}>${esc(d.note)}</textarea></label>
      <label>Übergebende Person / Kürzel<input data-who value="${esc(d.who)}" ${d.pending?'readonly':''}></label>
      <p class="b-hint">Papiermappe ans Büro geben. Auftrag: Gegenlesen, PDF erstellen und versenden. Keine weitere Freigabe nach Korrektur.</p>
      <button class="primary" data-submit ${submitDisabled(c)?'disabled':''}>${d.pending?'Speicherung erneut prüfen / versuchen':d.revision?'Geänderte Übergabe speichern':'Zur Büroprüfung übergeben'}</button>
    </details><details><summary>Hilfe zur Übergabe</summary><p>Originaldatei bewusst im Projektordner auswählen; keine automatische Fassungsauswahl. Empfänger mit vollständigen Angaben bestätigen. Kommas bleiben erhalten; weitere Personen einzeln ergänzen. Die Papiermappe bleibt Bestandteil des Büroablaufs.</p></details></details>`;
  const q=s=>container.querySelector(s);
  q('[data-handover]').ontoggle=e=>{d.handOpen=e.target.open;if(d.handOpen){if(d.pending||d.revision||d.creationDraft||canPrepare(c))openForm(c);for(const r of openOrders(c))q('[data-record="'+r.order.id+'"]').open=true;}keep(p.name,d);};
  q('[data-path]').ontoggle=e=>{d.pathOpen=e.target.open;keep(p.name,d);};
  if(q('[data-retry]'))q('[data-retry]').onclick=()=>submit(c);
  if(q('[data-show-form]'))q('[data-show-form]').onclick=()=>openForm(c);
  q('[data-form]').ontoggle=e=>{d.open=e.target.open;if(d.open&&!d.pending&&!d.revision)d.creationDraft=true; if(d.open&&!d.prepared&&!d.pending&&!d.revision){d.rows=D.recipients(c.readData());d.prepared=true;keep(p.name,d);render();return;}keep(p.name,d);};
  for(const [sel,key] of [['[data-word]','word'],['[data-who]','who'],['[data-note]','note']])q(sel).oninput=e=>{d[key]=e.target.value;if(key==='word')q('[data-chosen]').textContent=d.word||'Noch keine Word-Datei ausgewählt';keep(p.name,d);};
  container.querySelectorAll('[data-group]').forEach(el=>el.onchange=()=>{d.rows[+el.dataset.group].selected=el.checked;q('[data-group-fields="'+el.dataset.group+'"]').hidden=!el.checked;keep(p.name,d);});
  container.querySelectorAll('[data-entry]').forEach(el=>el.oninput=()=>{const[i,j]=el.dataset.entry.split(':');d.rows[i].entries[j]=el.value;keep(p.name,d);});
  container.querySelectorAll('[data-add]').forEach(el=>el.onclick=()=>{d.rows[+el.dataset.add].entries.push('');keep(p.name,d);render();});
  q('[data-pick]').onclick=async()=>{try{d.word=await D.selectFile(p.handle,/\.docx?$/i);keep(p.name,d);render();}catch(e){if(e.name!=='AbortError')message(c,e.message,true);}};
  q('[data-submit]').onclick=()=>submit(c);q('[data-refresh]').onclick=refresh;c.recordKey=null;renderRecords(c);restoreFocus(c,focus);
}
function message(c,text,error=false){c.d.message=text;c.d.messageError=error;keep(c.p.name,c.d);const el=c.container.querySelector('[data-message]');if(el){el.hidden=false;el.textContent=text;el.classList.toggle('b-error',error);}renderRecords(c);}
function recordHtml(r){
  const history=r.events.map(e=>`${time(e.at)} · ${e.actor} · ${{claim:'Übernommen',proof:'Gegengelesen',pdf:'PDF zugeordnet',send:'Versand dokumentiert',question:'Rückfrage',answer:'Antwort',revise:'Übergabe geändert',withdraw:'Zurückgenommen',correct:'Status korrigiert',resolve:'Paralleländerungen geprüft'}[e.type]||e.type}${e.payload.text?' · '+e.payload.text:''}${e.payload.path?' · '+e.payload.path:''}${e.payload.date?' · '+e.payload.date:''}${e.payload.content?'\n'+e.payload.content.word+'\n'+e.payload.content.note+'\n'+e.payload.content.recipients.map(r=>r.details).join('\n'):''}`).join('\n');
  return `<details data-record="${r.order.id}"><summary>${esc(r.status)}${r.actor?' · '+esc(r.actor):''}${r.withdrawn?' · Zurückgenommen':''} · ${time(r.order.created)}</summary><p>Übergeben von ${esc(r.content.who)}</p><p class="b-path">${esc(r.content.word)}</p>${r.content.note?'<p class="b-address">'+esc(r.content.note)+'</p>':''}
    ${r.content.recipients.map(x=>`<p class="b-address">${esc(x.details)} · ${r.sent[x.id]?'versandt '+esc(r.sent[x.id].date)+' / '+esc(r.sent[x.id].actor):'Versand offen'}</p>`).join('')}
    ${r.status!=='Erledigt'&&!r.withdrawn?`<p><button data-revise="${r.order.id}" ${current.d.pending?'disabled':''}>Übergabe ändern</button> <button data-withdraw="${r.order.id}" ${current.d.pending?'disabled':''}>Übergabe zurücknehmen …</button></p>`:''}
    <details><summary>Bearbeitungsverlauf</summary><p class="b-address">${esc(history||'Noch keine Rückmeldungen.')}</p></details><p class="b-hint">Auftrag ${esc(r.order.id)}</p></details>`;
}
function renderRecords(c){
  if(!c.container.isConnected)return;
  const el=c.container.querySelector('[data-records]');if(!el)return;
  const ordered=[...c.records].sort((a,b)=>a.order.created.localeCompare(b.order.created)),active=ordered.filter(r=>r.status!=='Erledigt'&&!r.withdrawn),history=ordered.filter(r=>r.status==='Erledigt'||r.withdrawn);
  const d=c.d,form=c.container.querySelector('[data-form]');
  form.hidden=!(d.pending||d.revision||d.creationDraft||canPrepare(c));
  c.container.querySelector('[data-handover-label]').textContent=d.pending?'Speicherversuch ansehen':d.revision?'Übergabe ändern':active.length?(active.length===1?'Übergabe ansehen':'Offene Übergaben ansehen'):!c.loaded||c.reading?'Übergaben werden geprüft …':c.errors.length?'Übergabestand prüfen':history.length?'Neue Übergabe vorbereiten':'Übergabe vorbereiten';
  c.container.querySelector('[data-form-label]').textContent=d.pending?'Ungeklärter Speicherversuch':d.revision?'Offene Übergabe ändern':active.length?'Noch nicht übergebener Entwurf':history.length?'Neue Übergabe vorbereiten':'Übergabe vorbereiten';
  c.container.querySelector('[data-draft-hint]').hidden=!(active.length&&d.creationDraft&&!d.revision&&!d.pending);
  const latest=ordered.at(-1),latestChanged=[...ordered].sort((a,b)=>(a.events.at(-1)?.at||a.order.created).localeCompare(b.events.at(-1)?.at||b.order.created)).at(-1);
  const overview=c.container.querySelector('[data-overview]');
  overview.textContent=!c.loaded?'Übergaben werden geprüft …':active.length?active.map(r=>`${r.status}${r.actor?' · '+r.actor:''} · ${r.content.word} · ${r.proof?'Gegengelesen':'Gegenlesen offen'} · ${r.pdf?'PDF zugeordnet':'PDF noch offen'} · Versand ${r.content.recipients.filter(x=>r.sent[x.id]).length} von ${r.content.recipients.length}`).join(' | ')+(d.creationDraft&&!d.pending&&!d.revision?' · Noch nicht übergebener Entwurf vorhanden':''):c.errors.length?'Kein verlässlich vollständiger Stand verfügbar':latest?.withdrawn?'Letzte Übergabe zurückgenommen':latest?'Letzte Übergabe erledigt':'Noch nicht übergeben';
  const alerts=`${c.d.messageError?'<p class="b-message b-error">'+esc(c.d.message)+' <button data-head-show>Eingaben ansehen</button></p>':''}${c.d.pending?'<p class="b-message b-error">Speicherung noch ungeklärt. <button data-head-retry>Speicherung erneut prüfen / versuchen</button></p>':''}${c.errors.length?'<p class="b-message b-error">Übersicht möglicherweise unvollständig/veraltet: '+c.errors.map(esc).join(' · ')+' <button data-alert-refresh>Aktualisieren</button></p>':''}
    ${c.records.filter(r=>r.question||r.conflict||r===latestChanged&&r.withdrawn).map(r=>`<div class="b-message b-error">${r.question?`<b>Rückfrage:</b> ${esc(r.question)} <button data-answer="${r.order.id}">Rückfrage beantworten …</button>`:''}${r.conflict?'<p>Parallele Rückmeldungen: in der <a href="buero/" target="spektron-buero" rel="noopener">Büroübersicht prüfen</a>.</p>':''}${r.withdrawn?'<p>Aktuelle Übergabe zurückgenommen. <button data-show-record="'+r.order.id+'">Rücknahme ansehen</button></p>':''}</div>`).join('')}`;
  const alertBox=document.getElementById('bueroAttention')||c.container.querySelector('[data-alerts]');
  if(c.alertKey!==alerts||c.alertBox!==alertBox){const focus=rememberFocus(c);alertBox.innerHTML=alerts;c.alertKey=alerts;c.alertBox=alertBox;restoreFocus(c,focus);}
  const html=active.map(recordHtml).join('')+(history.length?`<details data-history ${c.d.historyOpen?'open':''}><summary>Frühere Übergaben</summary>${history.map(recordHtml).join('')}</details>`:'');
  if(c.recordKey!==html){
    const focus=rememberFocus(c);el.innerHTML=html;c.recordKey=html;
    el.querySelectorAll('[data-record]').forEach(box=>{box.open=!!c.d.recordOpen?.[box.dataset.record];box.ontoggle=()=>{c.d.recordOpen??={};c.d.recordOpen[box.dataset.record]=box.open;keep(c.p.name,c.d);};});
    const historyBox=el.querySelector('[data-history]');if(historyBox)historyBox.ontoggle=()=>{c.d.historyOpen=historyBox.open;keep(c.p.name,c.d);};
    restoreFocus(c,focus);
  }
  alertBox.querySelectorAll('[data-head-show]').forEach(b=>b.onclick=()=>openForm(c));
  alertBox.querySelectorAll('[data-head-retry]').forEach(b=>{b.disabled=submitDisabled(c);b.onclick=()=>submit(c);});
  alertBox.querySelectorAll('[data-alert-refresh]').forEach(b=>b.onclick=refresh);
  alertBox.querySelectorAll('[data-show-record]').forEach(b=>b.onclick=()=>{c.d.handOpen=true;c.container.querySelector('[data-handover]').open=true;el.querySelector('[data-history]').open=true;el.querySelector('[data-record="'+b.dataset.showRecord+'"]').open=true;});
  el.querySelectorAll('[data-revise]').forEach(b=>b.onclick=async()=>{
    if(busy||c.d.pending)return;
    try{
      const r=await D.load(c.p.handle,b.dataset.revise);const d=c.d;
      if(current!==c)return;
      if(r.conflict||r.status==='Erledigt'||r.withdrawn)throw Error('Stand geändert. Bitte aktualisieren und den Auftrag prüfen.');
      if(d.revision===r.order.id)d.revisionPrevious=draftText(d);else d.revisionPrevious=null;
      d.prepared=true;d.revision=r.order.id;d.revisionBase=revisionStamp(r);d.word=r.content.word;d.who=r.content.who;d.note=r.content.note;d.open=true;
      d.rows=D.groups.map(([group,label])=>({group,label,selected:r.content.recipients.some(x=>x.group===group),entries:r.content.recipients.filter(x=>x.group===group).map(x=>x.details)}));
      if(d.revisionPrevious){d.message='Neueren Stand ins Formular geladen. Den bisherigen Entwurf kannst du nachlesen und gewünschte Eingaben bewusst erneut übernehmen.';d.messageError=false;}
      d.handOpen=true;keep(c.p.name,d);render();
    }catch(e){message(c,e.message,true);}
  });
  for(const kind of ['answer','withdraw'])[...c.container.querySelectorAll('[data-'+kind+']'),...alertBox.querySelectorAll('[data-'+kind+']')].forEach(b=>b.onclick=async()=>{
    if(busy)return;const r=c.records.find(r=>r.order.id===b.dataset[kind]);
    const text=prompt(kind==='answer'?'Antwort an das Büro (bleibt im Verlauf erhalten):':'Grund der Rücknahme (bleibt fürs Büro sichtbar):');if(!text?.trim())return;
    const actor=prompt('Person / Kürzel:',c.d.who);if(!actor?.trim())return;
    try{const latest=await D.load(c.p.handle,r.order.id);if(latest.conflict)throw Error('Parallele Rückmeldungen zuerst in der Büroübersicht prüfen.');if(kind==='withdraw'&&latest.status==='Erledigt')throw Error('Erledigte Übergaben bleiben erhalten.');const e=D.event(latest,kind,{text},actor);c.d.pending={kind:'event',data:e};keep(c.p.name,c.d);await submit(c);}catch(e){message(c,e.message,true);}
  });
}
async function submit(c){
  if(busy)return;busy=true;
  document.getElementById('vtBox')?.querySelectorAll('input,button').forEach(el=>el.disabled=true);
  try{
    const d=c.d;await c.flush();
    if(!d.pending){
      const fresh=await D.scanProject(c.p.handle);if(fresh.errors.length)throw Error('Übergaben nicht vollständig lesbar. Bitte aktualisieren.');
      await D.checkFile(c.p.handle,d.word,/\.docx?$/i);
      const content=D.snapshot({name:c.p.name,nr:c.p.nr,ort:c.p.ort},d.word,d.who,d.note,d.rows);
      if(d.revision){
        const r=await D.load(c.p.handle,d.revision);
        if(d.revisionBase!==revisionStamp(r))throw Error('Der Auftrag wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Bitte aktualisieren und „Übergabe ändern“ erneut wählen, um den neueren Stand bewusst zu prüfen. Der bisherige Entwurf bleibt dabei zum Nachlesen erhalten.');
        if(r.status==='Erledigt'||r.withdrawn||r.conflict)throw Error('Stand geändert. Bitte aktualisieren; erledigte Aufträge bleiben erhalten.');
        content.recipients=content.recipients.map(x=>({...x,id:r.content.recipients.find(y=>y.group===x.group&&y.details===x.details)?.id||x.id}));
        if(Object.keys(r.sent).some(id=>!content.recipients.some(x=>x.id===id)))throw Error('Bereits versandte Empfänger bitte erhalten. Für geänderte Empfänger einen neuen Ergänzungsauftrag anlegen.');
        d.pending={kind:'event',data:D.event(r,'revise',{content},d.who)};
      }else{
        if(fresh.records.some(r=>r.status!=='Erledigt'&&!r.withdrawn))throw Error('Es gibt bereits eine offene Übergabe. Bitte diese ändern oder bewusst zurücknehmen.');
        d.pending={kind:'order',data:D.order(content)};
      }
      // Persist attempt before shared IO; a failed sessionStorage write blocks the write.
      sessionStorage.setItem('buero-draft:'+c.p.name,JSON.stringify(d));
    }
    sessionStorage.setItem('buero-draft:'+c.p.name,JSON.stringify(d));
    const pending=d.pending;
    if(pending.kind==='order')await D.create(c.p.handle,pending.data);else await D.append(c.p.handle,pending.data);
    d.pending=null;d.revision=null;d.revisionBase=null;d.revisionPrevious=null;if(pending.kind==='order'||pending.data.type==='revise')d.creationDraft=false;d.open=false;keep(c.p.name,d);
    message(c,'✓ Gespeichert und rückgelesen. Die Papiermappe gehört weiterhin zur Übergabe.');await refresh();
  }catch(e){message(c,'Nicht bestätigt gespeichert: '+e.message,true);}
  finally{busy=false;if(current===c)render();}
}
async function refresh(){
  const c=current;if(!c)return;c.reading=(c.reading||0)+1;renderRecords(c);
  try{const r=await D.scanProject(c.p.handle);c.records=r.records;c.errors=r.errors;c.loaded=true;if(!r.errors.length)c.updated=new Date().toISOString();}
  catch(e){c.errors=[e.message];c.loaded=true;}
  c.reading--;if(current!==c)return;renderRecords(c);
  const t=c.container.querySelector('[data-updated]');if(t)t.textContent=c.updated?'Zuletzt aktualisiert '+time(c.updated):'Noch nicht aktualisiert';
  c.container.querySelectorAll('[data-submit],[data-retry]').forEach(b=>b.disabled=submitDisabled(c));
  const legacy=document.getElementById('vtBox');
  if(legacy){const digital=c.records.length||c.errors.length||c.d.pending||busy;legacy.querySelectorAll('tr[data-k]').forEach(tr=>{const entry=c.readData().verteiler?.[tr.dataset.k]||{};tr.querySelectorAll('input,button').forEach(el=>el.disabled=!!digital||!!c.readData().__bueroReadonly||(!el.classList.contains('vtAn')&&!entry.an));});const hint=legacy.querySelector('.vtHint');if(hint&&digital)hint.textContent='Historischer Verteiler (erhalten). Der Versand digitaler Aufträge wird ausschließlich in der Büroübersicht geführt.';}
}
setInterval(()=>{if(!document.hidden)refresh();},30000);
window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('beforeunload',e=>{if(busy||[...drafts.values()].some(d=>d.pending)){e.preventDefault();e.returnValue='';}});
window.BueroCentral={mount,refresh};
})();
