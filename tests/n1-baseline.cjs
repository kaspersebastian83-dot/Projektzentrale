// The same no-misdirected-write assertion must fail on the pinned, unmodified F5 writer.
const assert=require('node:assert/strict'),cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const base='1c8fa53bd362f6111e280c6478959f1b696bbb24',root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'n1-baseline-'));
try{
 const git=file=>cp.execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'});
 assert.equal(fs.readFileSync(path.join(root,'buero/data.js'),'utf8').replace(/\r\n/g,'\n'),git('buero/data.js').replace(/\r\n/g,'\n'),'shared record IO must remain identical to F5');
 fs.mkdirSync(path.join(tmp,'buero'));fs.writeFileSync(path.join(tmp,'buero/office.js'),git('buero/office.js'));
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,'buero-n1.cjs')],{cwd:root,env:{...process.env,N1_SOURCE_ROOT:tmp},encoding:'utf8'});
 assert.equal(r.status,1,r.error?.message||r.stdout+r.stderr);assert.match(r.stderr,/N1: after deleting the A copy, no feedback may appear in A or B/);assert.match(r.stderr,/rueckmeldung-/);
 console.log('EXPECTED FAILURE on F5 '+base+': same regression proves the unwanted feedback file in B.\n'+r.stderr);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
