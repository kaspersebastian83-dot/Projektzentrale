import {execFileSync} from 'node:child_process';

export const git = (root, ...args) => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, ...args], {encoding:'utf8'}).trim();

export function sourceRevision(repo, root, referenceSha) {
  const checkoutSha = git(root, 'rev-parse', 'HEAD');
  // Projektzentrale is the PR checkout (GitHub may check out its trial merge).
  // Other applications remain pinned to the reviewed manifest snapshots.
  const applicationSha = repo === 'Projektzentrale' ? checkoutSha : referenceSha;
  try {
    git(root, 'diff', '--exit-code', applicationSha, '--', '.', ':!tests', ':!.github', ':!README.md', ':!.gitignore');
  } catch (cause) {
    throw new Error(`${repo}: tracked product files differ from ${applicationSha}`, {cause});
  }
  return {applicationSha, checkoutSha, referenceSha};
}
