/* Compact handover panel; independent drafts survive project/detail rerenders. */
(function(){
'use strict';
const D=BueroData,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drafts=new Map();let current=null,busy=false;
function saved(name){try{return JSON.parse(sessionStorage.getItem('buero-draft:'+name));}catch{return null;}}
function keep(name,d){drafts.set(name,d);try{sessionStorage.setItem('buero-draft:'+name,JSON.stringify(d));}catch{}}
function time(t){return new Date(t).toLocaleString('de-DE');}
function mount(container,p,readData,flush){
  const d=drafts.get(p.name)||saved(p.name)||{who:'',word:'',note:'',rows:D.recipients(readData()),pending:null,revision:null,message:''};keep(p.name,d);
  current={container,p,readData,flush,d,records:[],errors:[],loaded:false};
  document.getElementById('vtBox')?.querySelectorAll('input,button').forEach(el=>el.disabled=true);render();refresh();
}
function render(){
  const c=current;if(!c||!c.container.isConnected)return;const {container,p,d}=c;
  container.className='buero b-card';
  container.innerHTML=`<h3>Übergabe ans Büro</h3><p class="b-hint">Papiermappe ans Büro geben. Gutachten gegenlesen, PDF erstellen und versenden. Nach Korrektur ist keine weitere Freigabe erforderlich.</p>
    <div class="b-row"><button data-refresh>Aktualisieren</button><span class="b-hint" data-updated>${c.updated?'Zuletzt aktualisiert '+time(c.updated):'Noch nicht aktualisiert'}</span></div>
    <div data-records></div>
    <details data-form ${d.open?'open':''}><summary>${d.revision?'Offene Übergabe ändern':'Neue Übergabe vorbereiten'}</summary>
      <p>${esc(p.nr)} · ${esc(p.ort)}</p>
      <label>Konkrete Word-Datei · relativer Pfad<input data-word value="${esc(d.word)}" placeholder="Mitteilungen/Gutachten.docx" ${d.pending?'readonly':''}></label>
      <button data-pick ${d.pending?'disabled':''}>Word-Datei im Projektordner auswählen …</button>
      <p class="b-hint">Alternativ relativen Pfad eintragen. Die Datei wird vor der Übergabe geprüft; es wird keine Fassung automatisch ausgewählt.</p>
      <h4>Empfänger bestätigen</h4><p class="b-hint">Vollständige Angaben je Eintrag. Zusätzliche Personen mit „Weiterer Empfänger“ getrennt ergänzen. Kommas bleiben Teil des Namens oder der Adresse.</p>
      ${d.rows.map((r,i)=>`<div class="b-recipient"><label><input type="checkbox" data-group="${i}" ${r.selected?'checked':''} ${d.pending?'disabled':''}>${esc(r.label)}</label>${r.entries.map((v,j)=>`<label>Empfängerangaben ${j+1}<textarea data-entry="${i}:${j}" ${d.pending?'readonly':''}>${esc(v)}</textarea></label>`).join('')}<button data-add="${i}" ${d.pending?'disabled':''}>Weiterer Empfänger</button></div>`).join('')}
      <label>Optionaler Hinweis fürs Büro<textarea data-note ${d.pending?'readonly':''}>${esc(d.note)}</textarea></label>
      <label>Übergebende Person / Kürzel<input data-who value="${esc(d.who)}" ${d.pending?'readonly':''}></label>
      <button class="primary" data-submit ${busy||!c.loaded||c.errors.length?'disabled':''}>${d.pending?'Speicherung erneut prüfen / versuchen':d.revision?'Geänderte Übergabe speichern':'Zur Büroprüfung übergeben'}</button>
      ${d.pending?'<p class="b-hint">Ein Speicherergebnis ist noch offen. Dieser Versuch behält dieselbe Kennung und denselben Inhalt, bis das Rücklesen bestätigt ist.</p>':''}
    </details><div data-message role="status" class="b-message" ${d.message?'':'hidden'}>${esc(d.message)}</div>`;
  const q=s=>container.querySelector(s);
  q('[data-form]').ontoggle=e=>{d.open=e.target.open; if(d.open&&!d.prepared&&!d.pending&&!d.revision){d.rows=D.recipients(c.readData());d.prepared=true;keep(p.name,d);render();return;}keep(p.name,d);};
  for(const [sel,key] of [['[data-word]','word'],['[data-who]','who'],['[data-note]','note']])q(sel).oninput=e=>{d[key]=e.target.value;keep(p.name,d);};
  container.querySelectorAll('[data-group]').forEach(el=>el.onchange=()=>{d.rows[+el.dataset.group].selected=el.checked;keep(p.name,d);});
  container.querySelectorAll('[data-entry]').forEach(el=>el.oninput=()=>{const[i,j]=el.dataset.entry.split(':');d.rows[i].entries[j]=el.value;keep(p.name,d);});
  container.querySelectorAll('[data-add]').forEach(el=>el.onclick=()=>{d.rows[+el.dataset.add].entries.push('');keep(p.name,d);render();});
  q('[data-pick]').onclick=async()=>{try{d.word=await D.selectFile(p.handle,/\.docx?$/i);keep(p.name,d);render();}catch(e){if(e.name!=='AbortError')message(c,e.message,true);}};
  q('[data-submit]').onclick=()=>submit(c);q('[data-refresh]').onclick=refresh;renderRecords(c);
}
function message(c,text,error=false){c.d.message=text;keep(c.p.name,c.d);const el=c.container.querySelector('[data-message]');if(el){el.hidden=false;el.textContent=text;el.classList.toggle('b-error',error);}}
function renderRecords(c){
  if(!c.container.isConnected)return;
  const el=c.container.querySelector('[data-records]');if(!el)return;
  el.innerHTML=`${c.errors.length?'<p class="b-message b-error">Übersicht möglicherweise unvollständig/veraltet: '+c.errors.map(esc).join(' · ')+'</p>':''}
    ${!c.loaded?'<p>Übergaben werden gelesen …</p>':!c.records.length&&!c.errors.length?'<p class="b-hint">Noch keine digitale Übergabe.</p>':''}
    ${c.records.map(r=>`<div class="b-message"><b>${esc(r.status)}${r.withdrawn?' · Zurückgenommen':''}${r.conflict?' · Parallele Rückmeldungen – im Büro prüfen':''}</b> · ${time(r.order.created)} · ${esc(r.content.who)}<br><span class="b-path">${esc(r.content.word)}</span>
      <p>${r.proof?'✓ Gegengelesen':'Gegenlesen offen'} · ${r.pdf?'✓ PDF: '+esc(r.pdf.path):'PDF offen'} · Versand ${r.content.recipients.filter(x=>r.sent[x.id]).length}/${r.content.recipients.length}</p>
      ${r.content.recipients.map(x=>`<div class="b-address">${esc(x.details)}${r.sent[x.id]?' · versandt '+esc(r.sent[x.id].date)+' / '+esc(r.sent[x.id].actor):' · offen'}</div>`).join('')}
      ${r.question?'<p><b>Rückfrage:</b> '+esc(r.question)+'</p><button data-answer="'+r.order.id+'">Rückfrage beantworten …</button>':''}
      ${r.status!=='Erledigt'&&!r.withdrawn?`<p><button data-revise="${r.order.id}" ${c.d.pending?'disabled':''}>Übergabe ändern</button> <button data-withdraw="${r.order.id}" ${c.d.pending?'disabled':''}>Übergabe zurücknehmen …</button></p>`:''}
      <small>Auftrag ${esc(r.order.id)}</small></div>`).join('')}`;
  el.querySelectorAll('[data-revise]').forEach(b=>b.onclick=()=>{
    const r=c.records.find(r=>r.order.id===b.dataset.revise);const d=c.d;
    if(r.conflict){message(c,'Zuerst parallele Rückmeldungen in der Büroübersicht prüfen.',true);return;}
    d.prepared=true;d.revision=r.order.id;d.word=r.content.word;d.who=r.content.who;d.note=r.content.note;d.open=true;
    d.rows=D.groups.map(([group,label])=>({group,label,selected:r.content.recipients.some(x=>x.group===group),entries:r.content.recipients.filter(x=>x.group===group).map(x=>x.details)}));keep(c.p.name,d);render();
  });
  for(const kind of ['answer','withdraw'])el.querySelectorAll('[data-'+kind+']').forEach(b=>b.onclick=async()=>{
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
        const r=await D.load(c.p.handle,d.revision);if(r.status==='Erledigt'||r.withdrawn||r.conflict)throw Error('Stand geändert. Bitte aktualisieren; erledigte Aufträge bleiben erhalten.');
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
    d.pending=null;d.revision=null;d.open=false;keep(c.p.name,d);
    message(c,'✓ Gespeichert und rückgelesen. Die Papiermappe gehört weiterhin zur Übergabe.');await refresh();
  }catch(e){message(c,'Nicht bestätigt gespeichert: '+e.message,true);}
  finally{busy=false;if(current===c)render();}
}
async function refresh(){
  const c=current;if(!c)return;
  try{const r=await D.scanProject(c.p.handle);c.records=r.records;c.errors=r.errors;c.loaded=true;if(!r.errors.length)c.updated=new Date().toISOString();}
  catch(e){c.errors=[e.message];c.loaded=true;}
  if(current!==c)return;renderRecords(c);
  const t=c.container.querySelector('[data-updated]');if(t)t.textContent=c.updated?'Zuletzt aktualisiert '+time(c.updated):'Noch nicht aktualisiert';
  const b=c.container.querySelector('[data-submit]');if(b)b.disabled=busy||!c.loaded||!!c.errors.length;
  const legacy=document.getElementById('vtBox');
  if(legacy){const digital=c.records.length||c.errors.length||c.d.pending||busy;legacy.querySelectorAll('tr[data-k]').forEach(tr=>{const entry=c.readData().verteiler?.[tr.dataset.k]||{};tr.querySelectorAll('input,button').forEach(el=>el.disabled=!!digital||!!c.readData().__bueroReadonly||(!el.classList.contains('vtAn')&&!entry.an));});const hint=legacy.querySelector('.vtHint');if(hint&&digital)hint.textContent='Historischer Verteiler (erhalten). Der Versand digitaler Aufträge wird ausschließlich in der Büroübersicht geführt.';}
}
setInterval(()=>{if(!document.hidden)refresh();},30000);
window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('beforeunload',e=>{if(busy||[...drafts.values()].some(d=>d.pending)){e.preventDefault();e.returnValue='';}});
window.BueroCentral={mount,refresh};
})();
