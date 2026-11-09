// Integration tests: real ccs-run.mjs + real git + fake claude/gh. No network, no spend.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLedger } from '../plugins/ccs-core/bin/lib/ledger.mjs';
import { summarize } from '../plugins/ccs-core/bin/lib/summarize.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const RUN = join(here, '../plugins/ccs-core/bin/ccs-run.mjs');
const FAKE = join(here, 'fixtures/fake-claude.mjs');
const GHDIR = mkdtempSync(join(tmpdir(), 'fakegh-')); 
writeFileSync(join(GHDIR, 'gh'), `#!/bin/sh\nexec node ${join(here, 'fixtures/fake-gh.mjs')} "$@"\n`); chmodSync(join(GHDIR, 'gh'), 0o755);

const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const TASKS = `# Tasks: Demo
## Phase 1: Setup
- [ ] T001 [setup] [shared] Scaffold
      AC: AC-1.1 ok | check: npm run test
      deps: none        autonomy: auto
## Phase 3: User Story 1 (P1)
- [ ] T002 [US1] [api] Add endpoint
      AC: AC-2.1 ok | check: npm run test
      AC: AC-2.2 (negative) health still ok | check: npm run test
      deps: T001        autonomy: auto
- [ ] T003 [US1] [web] Signup form
      AC: AC-3.1 renders | check: npm run test
      deps: T002        autonomy: human (reason: visual design)
- [ ] T004 [US1] [api] After the form
      AC: AC-4.1 ok | check: npm run test
      deps: T003        autonomy: auto
`;

function makeRepo({ tasks = TASKS, status = 'APPROVED', withOrigin = false } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'ccs-e2e-')); 
  g(d, 'init', '-q', '-b', 'main'); g(d, 'config', 'user.email', 't@t'); g(d, 'config', 'user.name', 't');
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node test.js' } }));
  writeFileSync(join(d, 'test.js'), 'process.exit(0)\n');
  mkdirSync(join(d, '.specify/memory'), { recursive: true }); writeFileSync(join(d, '.specify/memory/constitution.md'), '# Constitution\n');
  mkdirSync(join(d, 'specs/001-demo/contracts'), { recursive: true });
  writeFileSync(join(d, 'specs/001-demo/spec.md'), `# Feature Spec: Demo feature\n\n- **Status:** ${status}\n- **FR-001:** MUST do it\n`);
  writeFileSync(join(d, 'specs/001-demo/plan.md'), '# Plan\n'); writeFileSync(join(d, 'specs/001-demo/tasks.md'), tasks);
  g(d, 'add', '-A'); g(d, 'commit', '-q', '-m', 'init');
  let origin = null;
  if (withOrigin) { origin = mkdtempSync(join(tmpdir(), 'ccs-origin-')); g(origin, 'init', '-q', '--bare', '-b', 'main'); g(d, 'remote', 'add', 'origin', origin); g(d, 'push', '-q', 'origin', 'main'); }
  return { d, origin };
}

function runner(repo, extra = [], env = {}) {
  const logs = { claude: join(repo, '..', `claude-${Date.now()}.log`), gh: join(repo, '..', `gh-${Date.now()}.log`) };
  const p = spawn('node', [RUN, '--repo', repo, '--claude-bin', FAKE, '--no-install', '--no-auto-plugin-dirs', ...extra], {
    cwd: repo, env: { ...process.env, PATH: `${GHDIR}:${process.env.PATH}`, FAKE_LOG: logs.claude, FAKE_GH_LOG: logs.gh, ...env } });
  let out = ''; p.stdout.on('data', x => out += x); p.stderr.on('data', x => out += x);
  const done = new Promise(r => p.on('close', code => r({ code, out })));
  return { p, done, logs };
}
const ledgerOf = repo => { const runs = join(repo, '.ccs/runs'); const id = readdirSync(runs).sort().pop(); return readLedger(join(runs, id, 'ledger.jsonl')); };
const statusOf = (s, id) => s.features[0].tasks.find(t => t.id === id);

test('happy path: isolation, per-task commits, human + dependent skipped, review, report, main untouched', async () => {
  const { d } = makeRepo(); const mainHead = g(d, 'rev-parse', 'main');
  const { done } = runner(d, ['--no-pr', '--budget-usd', '10']); const r = await done;
  assert.equal(r.code, 0, r.out);
  const s = summarize(ledgerOf(d));
  assert.equal(statusOf(s, 'T001').status, 'DONE'); assert.equal(statusOf(s, 'T002').status, 'DONE');
  assert.equal(statusOf(s, 'T003').status, 'SKIPPED-HUMAN'); assert.equal(statusOf(s, 'T004').status, 'NOT-STARTED');
  assert.equal(s.features[0].reviews[0].verdict, 'APPROVED');
  assert.equal(g(d, 'rev-parse', 'main'), mainHead, 'main branch must not move');
  assert.ok(!existsSync(join(d, 'src')), 'main checkout files untouched');
  const log = g(d, 'log', '--format=%s', 'ccs/001-demo');
  assert.match(log, /feat\(api\): implement T001/); assert.match(log, /chore\(tasks\): mark T002 done/); assert.match(log, /docs\(review\)/);
  assert.match(readFileSync(join(d, '.ccs/worktrees/001-demo/specs/001-demo/tasks.md'), 'utf8'), /- \[x\] T001/);
  assert.ok(existsSync(join(d, '.ccs/worktrees/001-demo/specs/001-demo/review/pr-review-round1.md')));
  const html = readFileSync(join(d, 'ccs-reports/latest.html'), 'utf8');
  assert.match(html, /Autonomous run report/); assert.match(html, /T003/); assert.ok(s.run.spentUsd > 0);
  assert.equal(g(d, 'status', '--porcelain'), '', 'reports and scratch must be git-ignored in the main checkout');
});

test('fail then pass retries with a fresh session; three failures end FAILED and the tree stays clean', async () => {
  const { d } = makeRepo();
  const beh = JSON.stringify({ T001: ['fail', 'pass'], T002: ['fail', 'fail', 'fail'] });
  const { done, logs } = runner(d, ['--no-pr', '--budget-usd', '10'], { FAKE_BEHAVIOR: beh }); const r = await done;
  assert.equal(r.code, 0, r.out);
  const s = summarize(ledgerOf(d));
  assert.equal(statusOf(s, 'T001').status, 'DONE'); assert.equal(statusOf(s, 'T001').attempts.length, 2);
  assert.equal(statusOf(s, 'T002').status, 'FAILED'); assert.equal(statusOf(s, 'T002').attempts.length, 3);
  assert.match(statusOf(s, 'T002').error, /verification verdict: FAIL/);
  assert.equal(statusOf(s, 'T004').status, 'NOT-STARTED');
  const wt = join(d, '.ccs/worktrees/001-demo');
  assert.equal(g(wt, 'status', '--porcelain'), '', 'worktree clean after a failed task');
  assert.ok(existsSync(join(wt, '.ccs/retry/T001.md')), 'retry evidence handed to the next session');
  const calls = readFileSync(logs.claude, 'utf8').trim().split('\n').map(JSON.parse).filter(c => c.prompt.startsWith('/ccs-core:ccs-run-task'));
  assert.ok(calls.some(c => c.prompt.includes('retry=.ccs/retry/T001.md')));
  for (const c of calls) { const f = c.argv; assert.ok(f.includes('--permission-prompts') && f.includes('none')); assert.ok(f.includes('--max-budget-usd')); assert.ok(!f.includes('--bare'), 'hooks must stay on'); assert.ok(!f.includes('--resume')); assert.equal(c.cwd.endsWith('001-demo'), true); }
});

test('BLOCKED task is not retried, reason recorded, dependants not started', async () => {
  const { d } = makeRepo();
  const { done } = runner(d, ['--no-pr'], { FAKE_BEHAVIOR: JSON.stringify({ T001: ['blocked'] }) }); const r = await done;
  assert.equal(r.code, 0, r.out);
  const s = summarize(ledgerOf(d));
  assert.equal(statusOf(s, 'T001').status, 'BLOCKED'); assert.equal(statusOf(s, 'T001').attempts.length, 1);
  assert.match(statusOf(s, 'T001').reason, /Need a decision/);
  assert.equal(statusOf(s, 'T002').status, 'NOT-STARTED');
  assert.equal(g(join(d, '.ccs/worktrees/001-demo'), 'status', '--porcelain'), '');
});

test('budget stop: stops starting work, records stop reason, still writes the report', async () => {
  const { d } = makeRepo();
  const { done } = runner(d, ['--no-pr', '--budget-usd', '0.8'], { FAKE_COST: '0.5' }); const r = await done;
  const s = summarize(ledgerOf(d));
  assert.equal(s.run.stopReason, 'budget'); assert.equal(s.run.status, 'stopped');
  assert.equal(statusOf(s, 'T001').status, 'DONE'); assert.equal(statusOf(s, 'T002').status, 'NOT-STARTED');
  assert.match(statusOf(s, 'T002').reason, /budget/);
  assert.match(readFileSync(join(d, 'ccs-reports/latest.html'), 'utf8'), /stop reason: <strong>budget/);
});

test('SIGTERM mid-task: child killed, report still produced, run marked aborted', async () => {
  const { d } = makeRepo();
  const { p, done } = runner(d, ['--no-pr'], { FAKE_BEHAVIOR: JSON.stringify({ T001: ['slow'] }) });
  await new Promise(r => setTimeout(r, 2500)); p.kill('SIGTERM');
  const r = await done;
  assert.equal(r.code, 130, r.out);
  assert.ok(existsSync(join(d, 'ccs-reports/latest.html')), 'report must exist after SIGTERM');
  const ev = ledgerOf(d); assert.equal(ev.at(-1).ev, 'run_end'); assert.equal(ev.at(-1).status, 'aborted');
  assert.match(readFileSync(join(d, 'ccs-reports/latest.html'), 'utf8'), /signal:SIGTERM/);
});

test('unapproved spec is skipped and reported; dry run creates no worktree and no sessions', async () => {
  const a = makeRepo({ status: 'CLARIFIED' });
  assert.equal((await runner(a.d, ['--no-pr']).done).code, 0);
  const s = summarize(ledgerOf(a.d)); assert.equal(s.features[0].status, 'SKIPPED'); assert.match(s.features[0].skippedReason, /not APPROVED/);
  assert.ok(!existsSync(join(a.d, '.ccs/worktrees')));

  const b = makeRepo(); const { done, logs } = runner(b.d, ['--dry-run']);
  assert.equal((await done).code, 0);
  assert.ok(!existsSync(join(b.d, '.ccs/worktrees'))); assert.ok(!existsSync(logs.claude), 'no agent session in a dry run');
  assert.equal(summarize(ledgerOf(b.d)).counts['SKIPPED-HUMAN'], 1);
  assert.ok(existsSync(join(b.d, 'ccs-reports/latest.html')));
});

test('fix loop: CHANGES-REQUIRED -> fresh fix session -> re-review in a new session', async () => {
  const { d } = makeRepo();
  const { done, logs } = runner(d, ['--no-pr', '--budget-usd', '10'], { FAKE_REVIEW: JSON.stringify(['changes', 'approved']) });
  assert.equal((await done).code, 0);
  const s = summarize(ledgerOf(d)); const rv = s.features[0].reviews;
  assert.equal(rv.length, 2); assert.equal(rv[0].verdict, 'CHANGES-REQUIRED'); assert.equal(rv[0].counts.HIGH, 1); assert.equal(rv[1].verdict, 'APPROVED');
  const calls = readFileSync(logs.claude, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(calls.some(c => c.prompt.startsWith('/ccs-core:ccs-run-fix')));
  const reviews = calls.filter(c => c.prompt.startsWith('Review the feature branch'));
  assert.equal(reviews.length, 2); for (const c of reviews) { assert.ok(!c.argv.includes('--resume') && !c.argv.includes('--continue')); assert.ok(c.argv.includes('--no-session-persistence')); }
});

test('PR path: only the ccs/ branch is pushed; outstanding work opens a DRAFT labelled needs-human', async () => {
  const { d, origin } = makeRepo({ withOrigin: true }); const mainHead = g(d, 'rev-parse', 'main');
  const { done, logs } = runner(d, ['--budget-usd', '10']); const r = await done;
  assert.equal(r.code, 0, r.out);
  assert.equal(g(origin, 'rev-parse', 'main'), mainHead, 'origin/main must not move');
  assert.match(g(origin, 'branch', '--list', 'ccs/*'), /ccs\/001-demo/);
  const calls = readFileSync(logs.gh, 'utf8').trim().split('\n').map(JSON.parse);
  const create = calls.find(a => a[0] === 'pr' && a[1] === 'create');
  assert.ok(create.includes('--draft') && create.includes('needs-human') && create.includes('--head') && create.includes('ccs/001-demo'));
  assert.ok(!calls.some(a => a[0] === 'pr' && ['merge', 'ready'].includes(a[1])), 'never merges');
  const s = summarize(ledgerOf(d)); assert.equal(s.features[0].pr.url, 'https://github.com/acme/demo/pull/42'); assert.equal(s.features[0].pr.draft, true);
});

test('PR path: everything done + APPROVED + gate green -> READY (not draft)', async () => {
  const all = TASKS.replace('autonomy: human (reason: visual design)', 'autonomy: auto');
  const { d } = makeRepo({ tasks: all, withOrigin: true });
  const { done, logs } = runner(d, ['--budget-usd', '10']); assert.equal((await done).code, 0);
  const create = readFileSync(logs.gh, 'utf8').trim().split('\n').map(JSON.parse).find(a => a[1] === 'create');
  assert.ok(!create.includes('--draft')); assert.ok(!create.includes('--label'));
  const s = summarize(ledgerOf(d)); assert.equal(s.counts.DONE, 4); assert.equal(s.features[0].pr.draft, false);
});
