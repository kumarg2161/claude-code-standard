// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTasks, nextRunnable, classifyBlocked, hasCycle } from '../plugins/ccs-core/bin/lib/tasks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const LINT = join(here, '../plugins/ccs-core/bin/ccs-lint.mjs');

const GOOD = `# Tasks: X
## Phase 1: Setup
- [ ] T001 [setup] [shared] Scaffold packages
      AC: AC-1.1 typecheck passes | check: pnpm -r typecheck
      deps: none        autonomy: auto

## Phase 3: User Story 1 — Signup (P1)
- [ ] T002 [US1] [api] [P] Add POST /users in apps/api/src/users.ts
      AC: AC-2.1 returns 201 for valid body | check: pnpm --filter api test users
      AC: AC-2.2 (negative) existing GET /health still 200 | check: pnpm --filter api test health
      deps: T001        autonomy: auto
- [ ] T003 [US1] [web] Signup form look and feel
      AC: AC-3.1 form renders | check: pnpm --filter web test signup
      deps: T002        autonomy: human (reason: visual design)
- [x] T004 [US1] [api] Already done
      AC: AC-4.1 ok | check: true
      deps: none        autonomy: auto
`;

test('parses ids, tags, acs, deps, autonomy', () => {
  const { tasks, problems } = parseTasks(GOOD);
  assert.deepEqual(problems, []);
  assert.equal(tasks.length, 4);
  const t2 = tasks[1];
  assert.equal(t2.story, 'US1'); assert.equal(t2.component, 'api'); assert.equal(t2.parallel, true);
  assert.equal(t2.acs.length, 2); assert.equal(t2.acs[1].negative, true);
  assert.deepEqual(t2.deps, ['T001']);
  assert.equal(tasks[2].autonomy, 'human'); assert.equal(tasks[2].reason, 'visual design');
  assert.equal(tasks[3].done, true);
  assert.equal(tasks[0].kind, 'setup'); assert.deepEqual(tasks[0].deps, []);
});

test('nextRunnable respects deps, autonomy and done', () => {
  const { tasks } = parseTasks(GOOD);
  assert.equal(nextRunnable(tasks).id, 'T001');
  tasks[0].done = true;
  assert.equal(nextRunnable(tasks).id, 'T002');
  tasks[1].done = true;
  assert.equal(nextRunnable(tasks), null, 'only the human task remains');
});

test('classifyBlocked reports human and dependants', () => {
  const { tasks } = parseTasks(GOOD);
  const b = classifyBlocked(tasks, { failed: new Set(['T001']) });
  assert.ok(b.find(x => x.id === 'T003' && x.status === 'SKIPPED-HUMAN'));
  assert.ok(b.find(x => x.id === 'T002' && x.status === 'NOT-STARTED'));
});

test('hasCycle', () => {
  const { tasks } = parseTasks(GOOD.replace('deps: none        autonomy: auto\n\n## Phase 3', 'deps: T002        autonomy: auto\n\n## Phase 3'));
  assert.ok(hasCycle(tasks));
});

function lint(spec, tasks, extra = []) {
  const d = mkdtempSync(join(tmpdir(), 'ccs-lint-'));
  mkdirSync(join(d, 'specs/001-x'), { recursive: true });
  writeFileSync(join(d, 'specs/001-x/spec.md'), spec);
  writeFileSync(join(d, 'specs/001-x/tasks.md'), tasks);
  return spawnSync('node', [LINT, join(d, 'specs/001-x'), '--json', ...extra], { encoding: 'utf8' });
}
const SPEC = '- **Status:** CLARIFIED\n- **FR-001:** MUST do x\n';

test('lint passes a good feature', () => {
  const r = lint(SPEC, GOOD, ['--components', 'api,web,mobile,shared']);
  const o = JSON.parse(r.stdout);
  assert.equal(r.status, 0, r.stdout); assert.equal(o.ok, true);
});

test('lint rejects leftover clarification marker', () => {
  const r = lint(SPEC + '[NEEDS CLARIFICATION: which?]\n', GOOD);
  assert.equal(r.status, 1);
});

test('lint rejects risky auto task and accepts it with a reason', () => {
  const risky = GOOD.replace('Add POST /users in apps/api/src/users.ts', 'Add password reset token flow');
  assert.equal(lint(SPEC, risky).status, 1);
  const overridden = risky.replace('deps: T001        autonomy: auto', 'deps: T001        autonomy: auto (reason: reviewed by lead)');
  assert.equal(lint(SPEC, overridden).status, 0);
});

test('lint rejects story without a negative AC and task without AC', () => {
  const noNeg = GOOD.replace('      AC: AC-2.2 (negative) existing GET /health still 200 | check: pnpm --filter api test health\n', '');
  assert.equal(lint(SPEC, noNeg).status, 1);
  const noAc = GOOD.replace(/      AC: AC-1\.1.*\n/, '');
  assert.equal(lint(SPEC, noAc).status, 1);
});

test('template: comment sample is not a task', () => {
  const md = readFileSync(join(here, '../plugins/ccs-core/templates/tasks.md'), 'utf8');
  const { tasks } = parseTasks(md);
  assert.deepEqual(tasks.map(t => t.id), ['T001']);
});

test('multi-line and inline comments are skipped', () => {
  const md = '<!--\n- [ ] T009 x\n      deps: none  autonomy: auto\n-->\n- [ ] T001 [setup] y <!-- note -->\n      AC: AC-1.1 ok | check: true\n      deps: none  autonomy: auto\n';
  assert.deepEqual(parseTasks(md).tasks.map(t => t.id), ['T001']);
});
