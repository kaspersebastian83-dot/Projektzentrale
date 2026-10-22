// Chromium OPFS + real IndexedDB structured cloning. No synthetic handle/IDB adapter.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),pw=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');let f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(f!==root&&!f.startsWith(root+path.sep))throw Error();if((await fs.stat(f)).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await pw.chromium.launch(),context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/buero/');
  const fixture=await page.evaluate(async()=>{
   const archive=await(await navigator.storage.getDirectory()).getDirectoryHandle('n1-'+crypto.randomUUID(),{create:true}),a=await archive.getDirectoryHandle('26.0101 Muster A',{create:true}),b=await archive.getDirectoryHandle('26.0999 Muster B',{create:true});
   const content={project:{name:b.name,nr:'26.0999',ort:'Muster B'},word:'Mitteilungen/Gutachten.docx',who:'QA',note:'synthetic',instruction:'Prüfen',recipients:[{id:'r1',group:'versicherung',label:'Auftraggeber',details:'Musterempfänger'}]};
   const order=BueroData.order(content);await BueroData.create(b,order);
   const copy=await(await a.getDirectoryHandle('_Buero',{create:true})).getDirectoryHandle(order.id,{create:true}),h=await copy.getFileHandle('auftrag.json',{create:true}),w=await h.createWritable();await w.write(JSON.stringify(order));await w.close();
   const event=BueroData.event(await BueroData.load(b,order.id),'question',{text:'N1 native OPFS'},'QA');
   await store.set(archive);sessionStorage.setItem('buero-office-pending',JSON.stringify({project:b.name,order,data:event}));return {order,event};
  });
  await page.reload();await page.waitForFunction(()=>state.archive&&!state.refreshing);
  await page.evaluate(async()=>{await(await state.archive.getDirectoryHandle('26.0101 Muster A')).removeEntry('_Buero',{recursive:true});await refresh();});
  await page.locator('#retry').click();await page.locator('#message').filter({hasText:'Projektzuordnung blockiert'}).waitFor();
  assert.equal(await page.evaluate(async id=>(await BueroData.load(await state.archive.getDirectoryHandle('26.0999 Muster B'),id)).events.length,fixture.order.id),0);
  // Create a verified attempt, persist real handles, then reload without any live original handle.
  const pending=await page.evaluate(async f=>{const b=await state.archive.getDirectoryHandle('26.0999 Muster B');const p=await pendingStore.prepare(state.archive,b,f.order,f.event);sessionStorage.setItem(BueroPending.KEY,JSON.stringify(p));return p;},fixture);
  await page.reload();await page.waitForFunction(()=>state.archive&&!state.refreshing);
  assert.equal(await page.evaluate(async()=>{const p=await pendingStore.source(state.pending,state.archive),b=await state.archive.getDirectoryHandle('26.0999 Muster B');return p instanceof FileSystemDirectoryHandle&&await p.isSameEntry(b);}),true);
  await page.locator('#retry').click();await page.locator('#retry').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(async id=>(await BueroData.load(await state.archive.getDirectoryHandle('26.0999 Muster B'),id)).question,fixture.order.id),'N1 native OPFS');
  // A newly created same-name directory with identical order bytes cannot inherit a saved handle.
  await page.evaluate(async f=>{
   const b=await state.archive.getDirectoryHandle('26.0999 Muster B'),r=await BueroData.load(b,f.order.id),e=BueroData.event(r,'answer',{text:'Native replacement must block'},'QA'),p=await pendingStore.prepare(state.archive,b,f.order,e);
   sessionStorage.setItem(BueroPending.KEY,JSON.stringify(p));await state.archive.removeEntry(b.name,{recursive:true});const replacement=await state.archive.getDirectoryHandle(b.name,{create:true});await BueroData.create(replacement,f.order);
  },fixture);
  await page.reload();await page.waitForFunction(()=>state.archive&&!state.refreshing);await page.locator('#retry').click();await page.locator('#message').filter({hasText:'Projektzuordnung blockiert'}).waitFor();
  assert.equal(await page.evaluate(async id=>(await BueroData.load(await state.archive.getDirectoryHandle('26.0999 Muster B'),id)).events.length,fixture.order.id),0);
  assert.ok(pending.attempt);console.log('OK N1 native Chromium: original F5 legacy hole blocked after copy removal; actual OPFS DirectoryHandles survive IndexedDB+reload, verified retry succeeds, deleted/recreated same-name folder cannot inherit attempt. OPFS is not Windows/SMB.');
 }finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
