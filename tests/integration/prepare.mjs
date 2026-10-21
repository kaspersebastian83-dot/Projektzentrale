import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),dest=resolve(root,'tests/.integration-work');
const manifestPath=resolve(here,'stand.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const call=(command,args,cwd)=>execFileSync(command,args,{cwd,stdio:'inherit',shell:process.platform==='win32'&&/^(npm|pnpm)$/.test(command)});
const git=(args,cwd)=>call('git',['-c',`safe.directory=${cwd.replaceAll('\\','/')}`,...args],cwd);
await mkdir(dest,{recursive:true});
for(const [repo,sha] of Object.entries(manifest)){
  if(!/^[A-Za-z0-9-]+$/.test(repo)||!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid repository manifest');
  if(repo==='Projektzentrale')continue;
  const dir=resolve(dest,repo);await mkdir(dir,{recursive:true});
  git(['init'],dir);
  const url=`https://github.com/kaspersebastian83-dot/${repo}.git`;
  // Fresh source copies only, no credentials or local project folders are used.
  git(['fetch','--depth=1',url,process.argv.includes('--refresh-main')?'refs/heads/main':sha],dir);
  git(['checkout','--detach','FETCH_HEAD'],dir);
  if(process.argv.includes('--refresh-main'))manifest[repo]=execFileSync('git',['-c',`safe.directory=${dir.replaceAll('\\','/')}`,'rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();
  if(repo==='Probenplan'){call('pnpm',['install','--frozen-lockfile'],dir);call('pnpm',['run','build'],dir);}
  if(repo==='reisekosten-pro'){call('npm',['ci'],dir);call('npm',['run','build'],dir);}
}
if(process.argv.includes('--refresh-main')){
  manifest.Projektzentrale=execFileSync('git',['ls-remote','https://github.com/kaspersebastian83-dot/Projektzentrale.git','refs/heads/main'],{encoding:'utf8'}).split(/\s/)[0];
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
