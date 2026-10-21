import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {start,files,json,until,popup,sha256} from './environment.mjs';
import {fixture as F,expected as E,expectedNetCents,planSvg,reportPdf} from './fixtures.mjs';

const env=await start();const {context,base,inspector,step,result}=env;
let error;
try {
  await step('Raw synthetic inputs and empty project roots',async()=>{
    await inspector.evaluate(async({F,svg,pdf})=>{
      const r=await navigator.storage.getDirectory(),test=await r.getDirectoryHandle('suite-test',{create:true}),archive=await test.getDirectoryHandle('Archiv',{create:true});
      const write=async(d,n,b)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(b);await w.close();};
      const a=await archive.getDirectoryHandle(F.project,{create:true}),b=await archive.getDirectoryHandle(F.control,{create:true});
      await write(b,'Kontrolle.txt','TEST CONTROL - MUST NEVER CHANGE');
      const photos=await a.getDirectoryHandle('Fotos',{create:true});
      for(let i=1;i<=4;i++){
        const c=new OffscreenCanvas(800,600),g=c.getContext('2d');g.fillStyle=['#345','#456','#567','#678'][i-1];g.fillRect(0,0,800,600);g.fillStyle='white';g.font='40px sans-serif';g.fillText(`TEST FIKTIV ${i}`,40,100);
        await write(photos,`IMG_000${i}.jpg`,await c.convertToBlob({type:'image/jpeg',quality:.85}));
      }
      await write(await a.getDirectoryHandle('Pläne',{create:true}),'TEST Grundriss.svg',svg);
      await write(await a.getDirectoryHandle('Mitteilungen',{create:true}),'TEST Bericht.pdf',new Uint8Array(pdf));
    },{F,svg:planSvg,pdf:reportPdf()});
  });
  const before=await files(inspector,F.control),raw=await files(inspector,F.project);
  const central=await context.newPage();await central.goto(base+'/Projektzentrale/');
  await step('Projektzentrale: real save and navigation',async()=>{
    await central.locator('#btnStart, #btnArchive').first().click();
    await central.locator('.proj').filter({hasText:F.project}).click();
    await central.locator('#mkSubs').click();await central.locator('#dYes').click();await central.locator('#mkSubs').waitFor({state:'detached'});
    if(!await central.locator('#pjBox').evaluate(e=>e.open))await central.locator('#pjBox summary').click();
    for(const [k,v] of Object.entries({objekt:F.object,auftraggeber:F.customer,schadennummer:F.claim,ortstermin:F.date}))await central.locator('#pj_'+k).fill(v);
    await central.locator('#pjSave.ok').waitFor();
    const pj=json(await files(inspector,F.project),'_Projekt.json');assert.equal(pj.objekt,F.object);assert.equal(pj.projektnummer,F.nr);assert.equal(pj.auftraggeber,F.customer);
  });
  const label=await popup(central,'#goLabel');
  let labelName,labelBytes;
  await step('LabelKit: enter three samples through UI, real JSON save',async()=>{
    await label.locator('#pj-info').filter({hasText:F.object}).waitFor();
    for(const [type,tbody,add] of [['pak','proben-tbody','addProbe()'],['chlorid','chlorid-tbody','addChloridProbe()'],['asbest','asbest-tbody','addAsbest()']]){
      await label.locator('#main-'+type).click();
      await label.locator(`button[onclick="${add}"]:visible`).first().click();
      const row=label.locator('#'+tbody+' tr').first();
      await row.locator('input[placeholder="TT.MM.JJJJ"]').fill('15.10.2026');
      await row.locator('input[placeholder="Raum / Ort"]').fill('Testraum '+({pak:1,chlorid:2,asbest:3}[type]));
      const projectField=row.locator('input[oninput*="\'z1\'"]');await projectField.fill(F.nr);
      if(type==='asbest')await row.locator('select[onchange*="\'matrix\'"]').selectOption('Material (mineralisch)');
    }
    await label.locator('#btn-zwischenstand-speichern').click();
    await label.locator('#header-save-status').filter({hasText:/^Gespeichert:/}).waitFor();
    const disk=await files(inspector,F.project);const matches=Object.keys(disk).filter(n=>/^Laboraufträge\/.*_Daten\.json$/.test(n));assert.equal(matches.length,1);
    labelName=matches[0];labelBytes=disk[labelName];const data=json(disk,labelName);
    assert.equal(data.version,result.revisions.labelkit.version);assert.equal(data.projekt.nr,F.nr);
    assert.deepEqual([data.proben.length,data.chloridProben.length,data.asbestProben.length],[1,1,1]);
    assert.deepEqual([...data.proben,...data.chloridProben,...data.asbestProben].map(p=>p._nr),[1,2,3]);
    result.labelkit={file:labelName,sha256:sha256(Buffer.from(labelBytes))};
  });
  const foto=await popup(central,'#goFotos');
  await step('FotoKit: real metadata, rename and discarded-image move',async()=>{
    await foto.locator('#list .row').nth(3).waitFor();
    const rows=foto.locator('#list .row');
    for(let i=0;i<4;i++){
      await rows.nth(i).locator('.desc').fill(F.descriptions[i]);await rows.nth(i).locator('.sec').fill('TEST Abschnitt');
      if(i<3)await rows.nth(i).locator('.probe').fill('P'+(i+1));
    }
    await rows.nth(3).locator('button.x').click();
    await foto.locator('#btnRename').click();await foto.locator('#dOk').click();
    await foto.locator('#bUndo').waitFor();
    await until(async()=>{
      const d=await files(inspector,F.project);if(!d['Fotos/_Bildumbenenner.json'])return false;
      const m=json(d,'Fotos/_Bildumbenenner.json');return Object.values(m.bilder).filter(v=>v.beschreibung).length===4&&Object.keys(d).some(n=>n.startsWith('Fotos/_aussortiert/'));
    },'renamed files and metadata');
    const disk=await files(inspector,F.project),meta=json(disk,'Fotos/_Bildumbenenner.json');
    const active=Object.entries(meta.bilder).filter(([name,v])=>disk['Fotos/'+name]&&!v.aussortiert);assert.equal(active.length,3);
    for(const [name,data] of active){assert.ok(disk['Fotos/'+name],name);assert.ok(F.descriptions.includes(data.beschreibung));assert.match(data.probe,/^P[123]$/);}
    const originalHashes=Object.entries(raw).filter(([n])=>n.endsWith('.jpg')).map(([,b])=>sha256(Buffer.from(b))).sort();
    const actualHashes=Object.entries(disk).filter(([n])=>n.endsWith('.jpg')).map(([,b])=>sha256(Buffer.from(b))).sort();assert.deepEqual(actualHashes,originalHashes,'original image bytes preserved');
    result.fotokit={file:'Fotos/_Bildumbenenner.json',sha256:sha256(Buffer.from(disk['Fotos/_Bildumbenenner.json'])),active:3,discarded:1};
    await foto.locator('#btnPdf').click();await foto.locator('#zOk').click();await foto.locator('#banner .pdfOpen').first().waitFor();
    const pdfs=Object.entries(await files(inspector,F.project)).filter(([name])=>name.startsWith('Fotos/')&&name.endsWith('.pdf'));
    assert.equal(pdfs.length,1);assert.ok(pdfs[0][1].length>1000);assert.equal(Buffer.from(pdfs[0][1]).subarray(0,4).toString(),'%PDF');
    result.fotokit.pdf={file:pdfs[0][0],sha256:sha256(Buffer.from(pdfs[0][1]))};
  });
  const plan=await popup(central,'#goPlan');
  const planFile='Pläne/Probenplan '+F.project+'.probenplan';
  await step('PlanKit: consume actual LabelKit file, place three samples, reopen',async()=>{
    await plan.locator('#folder-plans button',{hasText:'TEST Grundriss.svg'}).click();await plan.locator('#welcome').waitFor({state:'hidden'});
    if(await plan.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await plan.locator('#panel-toggle').click();
    await plan.locator('#lab-import').click();await plan.locator('#lab-folder-dialog [data-labelkit]').filter({hasText:labelName.split('/').at(-1)}).click();
    await plan.locator('#lab-confirm:enabled').click();await plan.locator('#lab-review').waitFor({state:'hidden'});
    for(const [i,[fx,fy]] of [[.2,.3],[.5,.4],[.7,.6]].entries()){
      await plan.locator('[data-pending]').first().click();
      const pt=await plan.locator('#drawing').evaluate((el,[x,y])=>{const r=el.querySelector('#plan-clip rect'),p=new DOMPoint(x*Number(r.getAttribute('width')),y*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:p.x,y:p.y};},[fx,fy]);
      await plan.mouse.click(pt.x,pt.y);
    }
    await plan.locator('#save-project').click();
    await until(async()=>{const d=await files(inspector,F.project);return d[planFile]&&json(d,planFile).markers.length===3;},'three saved markers');
    const saved=json(await files(inspector,F.project),planFile);assert.deepEqual(saved.markers.map(m=>m.label).sort(),['P1','P2','P3']);assert.equal(saved.pending?.length||0,0);
    assert.ok(saved.markers.every(m=>m.lab?.desc?.includes('Testraum')));assert.deepEqual((await files(inspector,F.project))[labelName],labelBytes,'consumer did not replace producer file');
    await plan.reload();await plan.locator('#welcome').waitFor({state:'hidden'});assert.equal(await plan.locator('#count').textContent(),'3');
    result.plankit={file:planFile,labels:saved.markers.map(m=>m.label)};
  });
  const beleg=await popup(central,'#goAufwand');
  await step('BelegKit: actual sources, explicit test prices, independent 208.50 EUR',async()=>{
    await beleg.locator('nav.tabs').waitFor();await beleg.locator('[data-tab=zeiten]').click();
    await beleg.locator('#kzEin').fill(F.employee);await beleg.locator('#kzOk').click();
    await beleg.locator('#zNeu').click();
    const z=(i,k)=>beleg.locator(`#zRows tr[data-i="${i}"] [data-f="${k}"]`);
    await z(0,'datum').fill(F.date);await z(0,'stunden').fill('1');await z(0,'km').fill('10');
    await beleg.locator('#zNeuB').click();await z(1,'stunden').fill('0,5');await z(1,'datum').fill(F.date);
    await until(async()=>{
      const d=await files(inspector,F.project),name='Abrechnung/Aufwand_'+F.employee+'.json';
      if(!d[name])return false;const entries=json(d,name).eintraege;
      return entries.length===2&&entries[0].stunden==='1'&&entries[0].km==='10'&&entries[1].stunden==='0,5';
    },'confirmed time entries before billing');
    await beleg.locator('[data-tab=einst]').click();
    // Select existing positions by their immutable user-visible invoice numbers, not app calculation functions.
    for(const [nr,price] of [['1.007','100'],['1.004','0,50'],['2.001','10'],['2.008','20'],['3.001','80']]){
      const row=beleg.locator('#ePos tr').filter({has:beleg.locator(`input[data-p=nr][value="${nr}"]`)});await row.locator('[data-p=preis]').fill(price);
    }
    await beleg.locator('#eLab').click();const labRow=beleg.locator('#ePos tr').last();
    for(const [k,v] of Object.entries({nr:'2.099',text:'TEST Asbestanalyse',einheit:'Stk.',preis:'30'}))await labRow.locator(`[data-p=${k}]`).fill(v);
    await beleg.locator('[data-satz=seite]').fill('1');await beleg.locator('[data-satz=foto]').fill('0,50');await beleg.locator('[data-satz=pauschale]').fill('0');await beleg.locator('#eSpeichern').click();
    await beleg.locator('[data-tab=proben]').click();const select=beleg.locator('select[data-kat="asbest-material"]');await select.selectOption({label:'2.099 TEST Asbestanalyse'});
    await beleg.locator('#status').filter({hasText:/Zuordnung gespeichert/}).waitFor();
    await beleg.locator('[data-tab=bericht]').click();const reportRow=beleg.locator('#bRows tr').filter({hasText:'TEST Bericht'});await reportRow.locator('input[data-ab]').check();await reportRow.getByRole('button',{name:'PDF: 2 Seiten übernehmen'}).click();
    await until(async()=>{const d=await files(inspector,F.project);if(!d['Abrechnung/_Abrechnung.json'])return false;const b=json(d,'Abrechnung/_Abrechnung.json').berichte['TEST Bericht'];return b?.abrechnen&&b.seiten==='2';},'confirmed report selection');
    await beleg.locator('[data-tab=abrechnung]').click();await beleg.locator('#aPreise').check();await beleg.locator('#aStand').click();
    await until(async()=>Object.keys(await files(inspector,F.project)).some(n=>/^Abrechnung\/.*_Aufwand_.*\.json$/.test(n)),'billing snapshot');
    const disk=await files(inspector,F.project),name=Object.keys(disk).find(n=>/^Abrechnung\/.*_Aufwand_.*\.json$/.test(n)),billing=json(disk,name);
    assert.equal(Math.round(billing.netto*100),expectedNetCents);assert.equal(billing.fotos,3);assert.equal(billing.seiten,2);
    const lines=billing.titel.flatMap(t=>t.zeilen);
    for(const [key,soll] of Object.entries(E)){
      const line=lines.find(l=>key==='asbest'?l.nr==='2.099':l.key===key);assert.ok(line,key);assert.equal(line.menge,soll.quantity,key);assert.equal(Math.round(line.gesamt*100),soll.cents,key);
    }
    for(const source of billing.quellen.filter(q=>[labelName,'Fotos/_Bildumbenenner.json','_Projekt.json'].includes(q.datei)))assert.equal(source.sha256,sha256(Buffer.from(disk[source.datei])),source.datei);
    assert.ok(billing.quellen.some(q=>q.datei===labelName));assert.ok(billing.quellen.some(q=>q.datei==='Fotos/_Bildumbenenner.json'));
    assert.deepEqual(disk[labelName],labelBytes);assert.deepEqual(await files(inspector,F.control),before);
    // CSV exports positions rather than a net-total row. Verify its actual positions independently.
    const csv=Buffer.from(disk[name.replace(/\.json$/,'.csv')]).toString('utf8');
    const csvRows=csv.split('\r\n').filter(row=>/^[123];/.test(row)).map(row=>row.split(';'));
    assert.equal(csvRows.length,7);assert.equal(csvRows.reduce((sum,row)=>sum+Math.round(Number(row[6].replace(',','.'))*100),0),expectedNetCents);
    result.billing={file:name,netCents:expectedNetCents,positions:lines,expected:E};
  });
  await step('SpesenKit: real application startup, no project parameter',async()=>{
    const spesen=await popup(central,'#goReise');await spesen.getByRole('heading',{name:'Monatsübersicht',exact:true}).waitFor();assert.equal(new URL(spesen.url()).search,'');assert.equal(new URL(spesen.url()).hash,'');assert.deepEqual(await files(inspector,F.control),before);
  });
  // Retain actual synthetic producer outputs for review before the security scenarios change them.
  const produced=await files(inspector,F.project);
  for(const [name,bytes] of Object.entries(produced)){
    const target=resolve(env.output,'produced',name);await mkdir(dirname(target),{recursive:true});await writeFile(target,Buffer.from(bytes));
  }
  if(process.argv.includes('--security'))await(await import('./security.mjs')).security({env,central,foto,F});
  assert.deepEqual(env.failures,[]);
  result.producerFiles={labelkit:result.labelkit,fotokit:result.fotokit,plankit:result.plankit};
  await writeFile(resolve(env.output,'manifest.json'),JSON.stringify({fixture:F,expected:E,netCents:expectedNetCents,revisions:result.revisions},null,2));
} catch(e){error=e;console.error(e);}finally{await env.finish(error);}
if(error||!result.archiveRemoved)process.exitCode=1;
