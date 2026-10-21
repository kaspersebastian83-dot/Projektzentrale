import assert from 'node:assert/strict';
import {files,json,until,sha256} from './environment.mjs';

// Faults are injected only at browser filesystem boundaries. No application function is replaced.
async function instrument(page){
  await page.evaluate(()=>{
    if(window.__suiteIO)return;
    const io=window.__suiteIO={holdMeta:false,holdPJ:false,waitingMeta:false,waitingPJ:false,failAfterImage:false,imageDone:false,imageOps:[],metaAttempts:0};
    const create=FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable=async function(...args){
      const stream=await create.apply(this,args),name=this.name,close=stream.close.bind(stream);
      stream.close=async()=>{
        if(name==='_Bildumbenenner.json'){
          io.metaAttempts++;
          if(io.holdMeta){io.waitingMeta=true;await new Promise(r=>io.releaseMeta=r);io.waitingMeta=false;}
          if(io.failAfterImage&&io.imageDone)throw new Error('SYNTHETIC integration metadata close failure');
        }
        if(name==='_Projekt.json'&&io.holdPJ){io.waitingPJ=true;await new Promise(r=>io.releasePJ=r);io.waitingPJ=false;}
        return close();
      };
      return stream;
    };
    const move=FileSystemFileHandle.prototype.move;
    if(move)FileSystemFileHandle.prototype.move=async function(...args){
      const name=this.name,result=await move.apply(this,args);
      if(/\.jpg$/i.test(name)&&!name.includes('check')){io.imageDone=true;io.imageOps.push({op:'move',name,args:args.filter(a=>typeof a==='string')});}return result;
    };
    const remove=FileSystemDirectoryHandle.prototype.removeEntry;
    FileSystemDirectoryHandle.prototype.removeEntry=async function(name,...args){
      const result=await remove.call(this,name,...args);
      if(/\.jpg$/i.test(name)&&!name.includes('check')){io.imageDone=true;io.imageOps.push({op:'remove',name});}return result;
    };
  });
}
async function release(page,kind){await page.evaluate(kind=>{const io=window.__suiteIO;io[kind==='Meta'?'holdMeta':'holdPJ']=false;io['release'+kind]?.();},kind);}
const hashImages=disk=>Object.entries(disk).filter(([n])=>/\.jpg$/i.test(n)).map(([,b])=>sha256(Buffer.from(b))).sort();

export async function security({env,central,foto,F}){
  const {inspector,step,context,base,result}=env;
  result.security=[];
  await step('A: real named FotoKit window, pending write, cancelled and successful project change',async()=>{
    await instrument(foto);await foto.evaluate(()=>window.__suiteIO.holdMeta=true);
    const description='TEST Ungespeichert A';await foto.locator('#list .desc').first().fill(description);
    await foto.waitForFunction(()=>window.__suiteIO.waitingMeta);
    const originalUrl=foto.url(),controlBefore=await files(inspector,F.control);
    await central.locator('.proj').filter({hasText:F.control}).click();
    await central.locator('#mkSubs').click();await central.locator('#dYes').click();await central.locator('#mkSubs').waitFor({state:'detached'});
    await central.locator('#goFotos').waitFor();
    foto.removeAllListeners('dialog');
    let warnings=0;foto.on('dialog',async d=>{if(d.type()!=='beforeunload')env.failures.push('Unexpected project-change dialog: '+d.message());warnings++;await d.dismiss();});
    const warning=foto.waitForEvent('dialog');await central.locator('#goFotos').click();assert.equal((await warning).type(),'beforeunload');
    assert.equal(warnings,1);assert.equal(foto.url(),originalUrl);assert.equal(await foto.locator('#list .desc').first().inputValue(),description);
    assert.deepEqual(await files(inspector,F.control),controlBefore);
    await release(foto,'Meta');
    await until(async()=>Object.values(json(await files(inspector,F.project),'Fotos/_Bildumbenenner.json').bilder).some(b=>b.beschreibung===description),'pending A input persisted');
    foto.removeAllListeners('dialog');foto.on('dialog',d=>{env.failures.push('Unexpected security dialog: '+d.message());d.dismiss();});
    const openedPages=context.pages().length;
    await central.locator('#goFotos').click();
    await foto.waitForFunction(name=>document.querySelector('#folderName')?.textContent.includes(name),F.control);
    assert.equal(context.pages().length,openedPages,'existing named window reused');
    assert.equal(new URLSearchParams(new URL(foto.url()).hash.slice(1)).get('projekt'),F.control);
    assert.equal(await foto.locator('#list .desc').count(),0);
    const b=await files(inspector,F.control);assert.deepEqual(b['Kontrolle.txt'],controlBefore['Kontrolle.txt']);
    assert.ok(!b['Fotos/_Bildumbenenner.json']||!JSON.stringify(json(b,'Fotos/_Bildumbenenner.json')).includes(description));
    await central.locator('.proj').filter({hasText:F.project}).click();
    await central.waitForFunction(object=>document.querySelector('#pj_objekt')?.value===object,F.object);
    // B has no user input. If its initial empty-project save still triggers a leave warning,
    // explicitly confirm this return; the preceding A warning was cancelled and verified.
    foto.removeAllListeners('dialog');foto.on('dialog',d=>{if(d.type()==='beforeunload')d.accept();else{env.failures.push('Unexpected return dialog: '+d.message());d.dismiss();}});
    await central.locator('#goFotos').click();
    await foto.waitForFunction(text=>document.querySelector('#list .desc')?.value===text,description);
    foto.removeAllListeners('dialog');foto.on('dialog',d=>{env.failures.push('Unexpected security dialog: '+d.message());d.dismiss();});
    result.security.push({scenario:'A',warningCancelled:true,namedWindowReused:true,noLeakIntoB:true});
  });

  await step('B: genuine Zentrale and FotoKit writers preserve independent fields in both orders',async()=>{
    await instrument(central);await instrument(foto);
    const editCentral=async value=>{
      if(!await central.locator('#pjBox').evaluate(e=>e.open))await central.locator('#pjBox summary').click();
      await central.locator('#pj_auftraggeber').fill(value);
    };
    const editFoto=async value=>{await foto.locator('#btnMeta').click();await foto.locator('#m_objekt').fill(value);await foto.locator('#zCancel').click();};
    for(const first of ['central','foto']){
      const owner=first==='central'?central:foto,other=first==='central'?foto:central;
      const customer='TEST Auftraggeber '+first,object='TEST Objekt '+first;
      await owner.evaluate(()=>window.__suiteIO.holdPJ=true);
      await(first==='central'?editCentral(customer):editFoto(object));
      await owner.waitForFunction(()=>window.__suiteIO.waitingPJ);
      await(first==='central'?editFoto(object):editCentral(customer));
      await other.waitForFunction(async()=> (await navigator.locks.query()).pending.some(l=>l.name.startsWith('mosaik:projekt:')));
      await release(owner,'PJ');
      await until(async()=>{const pj=json(await files(inspector,F.project),'_Projekt.json');return pj.objekt===object&&pj.auftraggeber===customer;},'both independent patches '+first);
      const pj=json(await files(inspector,F.project),'_Projekt.json');assert.equal(pj.schadennummer,F.claim);assert.equal(pj.ortstermin,F.date);assert.equal(pj.projektnummer,F.nr);
    }
    result.security.push({scenario:'B',orders:['central-first','foto-first'],independentFieldsPreserved:true});
  });

  await step('C: metadata close failure after actual rename, retry without repeating image operations',async()=>{
    await instrument(foto);
    if(await foto.locator('#btnNaming').getAttribute('aria-expanded')!=='true')await foto.locator('#btnNaming').click();
    await foto.locator('#oPrefix').fill('TEST_RETRY');
    await until(async()=>json(await files(inspector,F.project),'Fotos/_Bildumbenenner.json').benennung.prefix==='TEST_RETRY','naming setting saved');
    const before=await files(inspector,F.project),description=await foto.locator('#list .desc').first().inputValue();
    await foto.evaluate(()=>{const io=window.__suiteIO;io.imageOps=[];io.imageDone=false;io.failAfterImage=true;});
    await foto.locator('#btnRename').click();await foto.locator('#dOk').click();await foto.locator('#bSaveRetry').waitFor();
    assert.match(await foto.locator('#banner').getAttribute('class'),/err/);assert.doesNotMatch(await foto.locator('#banner').innerText(),/✓.*umbenannt/);
    assert.equal(await foto.locator('#list .desc').first().inputValue(),description);
    const failed=await files(inspector,F.project),operations=await foto.evaluate(()=>window.__suiteIO.imageOps.length);
    assert.ok(operations>0,'physical image operations actually occurred');assert.deepEqual(hashImages(failed),hashImages(before));
    assert.notDeepEqual(Object.keys(failed).filter(n=>n.endsWith('.jpg')),Object.keys(before).filter(n=>n.endsWith('.jpg')),'file names really changed');
    assert.deepEqual(failed['Fotos/_Bildumbenenner.json'],before['Fotos/_Bildumbenenner.json'],'failed close did not replace committed metadata');
    const attempts=await foto.evaluate(()=>window.__suiteIO.metaAttempts);await foto.locator('#bSaveRetry').click();
    await foto.waitForFunction(n=>window.__suiteIO.metaAttempts>n&&!!document.querySelector('#bSaveRetry')&&!document.body.inert,attempts);
    assert.equal(await foto.evaluate(()=>window.__suiteIO.imageOps.length),operations,'failed retry must not rename again');
    assert.deepEqual(await files(inspector,F.project),failed);
    await foto.evaluate(()=>window.__suiteIO.failAfterImage=false);await foto.locator('#bSaveRetry').click();await foto.locator('#bUndo').waitFor();
    const after=await files(inspector,F.project);assert.equal(await foto.evaluate(()=>window.__suiteIO.imageOps.length),operations,'successful retry must not rename again');
    for(const [name,bytes] of Object.entries(failed))if(name!=='Fotos/_Bildumbenenner.json')assert.deepEqual(after[name],bytes,name);
    const data=json(after,'Fotos/_Bildumbenenner.json');const live=Object.entries(data.bilder).filter(([name])=>after['Fotos/'+name]);assert.equal(live.length,3);assert.ok(live.some(([,b])=>b.beschreibung===description));
    const fresh=await context.newPage();await fresh.goto(base+'/Bildumbenenner/#projekt='+encodeURIComponent(F.project));
    await fresh.waitForFunction(d=>document.querySelector('#list .desc')?.value===d,description);
    assert.deepEqual(await fresh.locator('#list .probe').evaluateAll(es=>es.map(e=>e.value)),['P1','P2','P3']);
    await fresh.close();result.security.push({scenario:'C',nativeImageOperations:operations,metadataPreserved:true,retryDidNotRepeatRename:true,freshSessionConfirmed:true});
  });
}
