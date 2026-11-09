import { run } from './proc.mjs';

export async function git(cwd, args, o = {}) { return run('git', args, { cwd, timeoutMs: o.timeoutMs ?? 120000, graceMs: 2000, input: o.input }); }
export async function gitOut(cwd, args) { const r = await git(cwd, args); return r.code === 0 ? r.stdout.trim() : null; }

export async function toplevel(cwd) { return gitOut(cwd, ['rev-parse', '--show-toplevel']); }
export async function isLinkedWorktree(cwd) {
  const a = await gitOut(cwd, ['rev-parse', '--git-dir']); const b = await gitOut(cwd, ['rev-parse', '--git-common-dir']);
  if (a == null || b == null) return false;
  const norm = async p => (await run('node', ['-e', 'console.log(require("fs").realpathSync(require("path").resolve(process.argv[1])))', p], { cwd })).stdout.trim();
  return (await norm(a)) !== (await norm(b));
}
export async function branchExists(cwd, b) { return (await git(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${b}`])).code === 0; }
export async function head(cwd) { return gitOut(cwd, ['rev-parse', 'HEAD']); }
export async function defaultBase(cwd) {
  const o = await gitOut(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (o) return o.replace(/^origin\//, '');
  for (const b of ['main', 'master', 'develop']) if (await branchExists(cwd, b)) return b;
  return null;
}
export async function dirtyFiles(cwd) {
  const s = await gitOut(cwd, ['status', '--porcelain']);
  return (s || '').split('\n').filter(l => l.trim() && !/^\S+\s+"?\.ccs\//.test(l));
}
export async function resetHard(cwd, sha) {
  await git(cwd, ['reset', '--hard', '-q', sha]);
  await git(cwd, ['clean', '-fdq', '-e', '.ccs']);
}
export async function showFile(cwd, ref, path) { return gitOut(cwd, ['show', `${ref}:${path}`]); }
export async function listDirs(cwd, ref, path) {
  const s = await gitOut(cwd, ['ls-tree', '-d', '--name-only', ref, `${path}/`]);
  return (s || '').split('\n').filter(Boolean).map(x => x.replace(/\/$/, '').split('/').pop());
}
