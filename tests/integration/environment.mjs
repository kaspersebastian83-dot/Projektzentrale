import {createServer} from 'node:http';
import {readFile, stat, mkdir, writeFile} from 'node:fs/promises';
import {resolve, dirname, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {sourceRevision} from './provenance.mjs';

export const here = dirname(fileURLToPath(import.meta.url));
export const central = resolve(here, '../..');
export const manifest = JSON.parse(await readFile(resolve(here, 'stand.json'), 'utf8'));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function start() {
  const parent = process.env.SPEKTRON_SOURCES || resolve(central, 'tests/.integration-work');
  const roots = Object.fromEntries(Object.keys(manifest).map(name => [name, name === 'Projektzentrale' ? central : resolve(parent, name)]));
  const revisions = {};
  for (const [repo, root] of Object.entries(roots)) {
    const revision = sourceRevision(repo, root, manifest[repo]);
    const versionSource = await readFile(resolve(root, ['Probenplan','reisekosten-pro'].includes(repo) ? 'package.json' : 'index.html'), 'utf8');
    const version = versionSource.match(/APP_VERSION\s*=\s*['"]([^'"]+)/)?.[1] || JSON.parse(versionSource).version;
    revisions[repo] = {...revision, version};
  }
  const served = {...roots, Probenplan:resolve(roots.Probenplan, 'dist'), 'reisekosten-pro':resolve(roots['reisekosten-pro'], 'dist')};
  for (const root of Object.values(served)) await stat(resolve(root, 'index.html'));
  const server = createServer(async(req,res) => {
    try {
      const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if (path === '/__test/') { res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated Suite test archive</title>');return; }
      const [repo, ...parts] = path.split('/').filter(Boolean), root = served[repo];
      if (!root) { res.writeHead(404).end();return; }
      let file = resolve(root, ...parts);
      if (file !== root && !file.startsWith(root + sep)) {res.writeHead(403).end();return;}
      if ((await stat(file)).isDirectory()) file=resolve(file,'index.html');
      const type = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.woff2':'font/woff2','.png':'image/png'}[extname(file)] || 'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(await readFile(file));
    } catch {res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  let browser, context;
  const output=resolve(here,'results',`${Date.now()}-${process.pid}`);
  await mkdir(output,{recursive:true});
  const result={status:'running',revisions,tests:[],coverage:{engine:'chromium',filesystem:'OPFS; picker and permissions simulated',windowsRdpSmb:'not tested',webkit:'not run; no file coverage claimed'}};
  try {
    browser=await pw.chromium.launch(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{});
    result.runtime={node:process.version,browser:browser.version(),executable:process.env.BROWSER_EXECUTABLE||'Playwright Chromium'};
    context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Europe/Berlin',acceptDownloads:true});
    const failures=[];
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    context.on('page',page=>{
      page.setDefaultTimeout(15000);
      page.on('pageerror',e=>failures.push(`${page.url()}: ${e.message}`));
      page.on('dialog',dialog=>{failures.push(`Unexpected dialog: ${dialog.type()}: ${dialog.message()}`);dialog.dismiss();});
    });
    await context.addInitScript(()=>{
      // Named popups briefly have an opaque about:blank document; storage is unavailable there.
      try {localStorage.setItem('willkommen-gelesen','1');}catch{}
      for(const cls of [globalThis.FileSystemDirectoryHandle,globalThis.FileSystemFileHandle]) if(cls){
        cls.prototype.queryPermission=async()=> 'granted';cls.prototype.requestPermission=async()=> 'granted';
      }
      window.showDirectoryPicker=async()=>{
        let d=await navigator.storage.getDirectory();
        for(const part of (window.__picker || ['suite-test','Archiv'])) d=await d.getDirectoryHandle(part);
        return d;
      };
    });
    const inspector=await context.newPage();await inspector.goto(base+'/__test/');
    return {context,base,output,result,failures,inspector,
      async step(name,fn){console.log(name);const value=await fn();result.tests.push({name,status:'passed'});return value;},
      async finish(error){
        result.status=error?'failed':'passed';result.browserErrors=failures;if(error)result.error=String(error.stack||error);
        try {if(error)for(const [i,p] of context.pages().entries()){await p.screenshot({path:resolve(output,`failure-${i}.png`),fullPage:true}).catch(()=>{});await writeFile(resolve(output,`failure-${i}.txt`),JSON.stringify(await p.evaluate(()=>({url:location.href,ready:document.readyState,context:typeof PROJEKT_URL!=='undefined'?PROJEKT_URL:null,project:typeof PROJEKTORDNER!=='undefined'?PROJEKTORDNER.state:null})).catch(()=>({})),null,2)+'\n'+await p.locator('body').innerText().catch(()=>''));}}
        finally {
          // Stop every producer before removing the archive; a delayed autosave must not recreate it.
          for(const p of context.pages())if(p!==inspector){
            await p.evaluate(()=>{const io=window.__suiteIO;if(io){io.holdMeta=false;io.holdPJ=false;io.failAfterImage=false;io.releaseMeta?.();io.releasePJ?.();}}).catch(()=>{});
            await p.close({runBeforeUnload:false}).catch(()=>{});
          }
          try {await inspector.evaluate(async()=>{const r=await navigator.storage.getDirectory();await r.removeEntry('suite-test',{recursive:true});});result.archiveRemoved=true;}
          catch(e){result.archiveRemoved=false;result.cleanupError=String(e);}
          await context.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));
          await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(`Result: ${output}`);
        }
      }};
  } catch(e) {await context?.close();await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));throw e;}
}

// Independent observer: no production parser or application state is used to inspect files.
export async function files(page,project) {
  return page.evaluate(async project=>{
    let root=await navigator.storage.getDirectory();for(const n of ['suite-test','Archiv',...(project?[project]:[])])root=await root.getDirectoryHandle(n);
    const out={};async function walk(dir,prefix=''){for await(const [name,h] of dir.entries()){
      if(h.kind==='directory')await walk(h,prefix+name+'/');
      else {const b=new Uint8Array(await(await h.getFile()).arrayBuffer());out[prefix+name]=Array.from(b);}
    }}await walk(root);return out;
  },project);
}
export const json=(disk,name)=>JSON.parse(Buffer.from(disk[name]).toString('utf8'));
export async function until(fn,message='condition',timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,80));}throw Error('Timed out: '+message);}
export async function popup(source,selector){const waiting=source.waitForEvent('popup');await source.locator(selector).click();const page=await waiting;await page.waitForLoadState('domcontentloaded');return page;}
