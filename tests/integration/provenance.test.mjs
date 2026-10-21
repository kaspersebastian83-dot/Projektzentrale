import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, resolve, sep} from 'node:path';
import {test} from 'node:test';
import {git, sourceRevision} from './provenance.mjs';

async function repository(run) {
  const parent = resolve(tmpdir());
  const root = await mkdtemp(resolve(parent, 'spektron-provenance-'));
  try {
    git(root, 'init', '--quiet');
    git(root, 'config', 'user.name', 'Synthetic integration test');
    git(root, 'config', 'user.email', 'synthetic@example.invalid');
    await writeFile(resolve(root, 'index.html'), '<!doctype html><title>synthetic base</title>');
    git(root, 'add', 'index.html');
    git(root, 'commit', '--quiet', '-m', 'Synthetic baseline');
    await run(root, git(root, 'rev-parse', 'HEAD'));
  } finally {
    assert.ok(root.startsWith(parent + sep) && basename(root).startsWith('spektron-provenance-'));
    await rm(root, {recursive:true, force:true});
  }
}

test('Projektzentrale accepts a committed product change and records the actual checkout', async()=> {
  await repository(async(root, referenceSha)=> {
    await writeFile(resolve(root, 'index.html'), '<!doctype html><title>synthetic PR change</title>');
    git(root, 'add', 'index.html');
    git(root, 'commit', '--quiet', '-m', 'Synthetic product PR');
    const checkoutSha = git(root, 'rev-parse', 'HEAD');
    assert.notEqual(checkoutSha, referenceSha);
    assert.deepEqual(sourceRevision('Projektzentrale', root, referenceSha), {applicationSha:checkoutSha, checkoutSha, referenceSha});
    await mkdir(resolve(root, 'tests'));
    await writeFile(resolve(root, 'tests', 'local-test.txt'), 'synthetic test edit');
    git(root, 'add', 'tests');
    assert.equal(sourceRevision('Projektzentrale', root, referenceSha).applicationSha, checkoutSha);
    await writeFile(resolve(root, 'index.html'), '<title>uncommitted product edit</title>');
    assert.throws(()=>sourceRevision('Projektzentrale', root, referenceSha), /tracked product files differ/);
  });
});

test('external application rejects product changes against its pinned manifest snapshot', async()=> {
  await repository(async(root, referenceSha)=> {
    assert.deepEqual(sourceRevision('labelkit', root, referenceSha), {applicationSha:referenceSha, checkoutSha:referenceSha, referenceSha});
    await writeFile(resolve(root, 'index.html'), '<title>unreviewed external product</title>');
    git(root, 'add', 'index.html');
    git(root, 'commit', '--quiet', '-m', 'Synthetic external change');
    assert.throws(()=>sourceRevision('labelkit', root, referenceSha), /tracked product files differ/);
  });
});
