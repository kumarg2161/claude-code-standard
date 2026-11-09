import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLedger, Ledger } from '../plugins/ccs-core/bin/lib/ledger.mjs';
import { renderReport } from '../plugins/ccs-core/bin/lib/report.mjs';
import { summarize } from '../plugins/ccs-core/bin/lib/summarize.mjs';
import { writeReport } from '../plugins/ccs-core/bin/ccs-report.mjs';

const XSS = '<script>alert(1)</script>';
function sample(d) {
  const l = new Ledger(join(d, 'runs/r1/ledger.jsonl'));
  l.add('run_start', { runId: 'r1', budgetUsd: 10, base: 'main', claudeVersion: '2.1.319', until: '2026-11-10T06:00:00Z' });
  l.add('feature_start', { feature: '001-signup', branch: 'ccs/001-signup', tasks: [
    { id: 'T001', title: 'Scaffold', story: null, component: 'shared', done: false },
    { id: 'T002', title: `Add endpoint ${XSS}`, story: 'US1', component: 'api', done: false },
    { id: 'T003', title: 'Signup form', story: 'US1', component: 'web', done: false },
    { id: 'T004', title: 'Dependent', story: 'US1', component: 'api', done: false },
    { id: 'T000', title: 'Earlier', story: null, component: 'shared', done: true }] });
  l.add('task_start', { feature: '001-signup', task: 'T001', attempt: 1 });
  l.add('task_end', { feature: '001-signup', task: 'T001', attempt: 1, status: 'DONE', verdict: 'PASS', exitCode: 0, costUsd: 0.42, durationMs: 61000, commit: 'abcdef1234567' });
  for (let a = 1; a <= 3; a++) {
    l.add('task_start', { feature: '001-signup', task: 'T002', attempt: a });
    l.add('task_end', { feature: '001-signup', task: 'T002', attempt: a, status: 'FAILED', verdict: 'FAIL', exitCode: 0, costUsd: 0.5, durationMs: 30000, error: `1 failed\n${XSS}` });
  }
  l.add('task_skipped', { feature: '001-signup', task: 'T003', status: 'SKIPPED-HUMAN', reason: 'visual design' });
  l.add('task_skipped', { feature: '001-signup', task: 'T004', status: 'NOT-STARTED', reason: 'depends on T002, which is not done' });
  l.add('review', { feature: '001-signup', round: 1, reviewer: 'claude', verdict: 'CHANGES-REQUIRED', counts: { HIGH: 1 }, costUsd: 0.3, artifact: 'specs/001-signup/review/pr-review.md' });
  l.add('pr', { feature: '001-signup', url: 'https://github.com/o/r/pull/7', draft: true, labels: ['needs-human'] });
  l.add('feature_end', { feature: '001-signup', status: 'PARTIAL' });
  l.add('stop', { reason: 'complete' });
  l.add('run_end', { status: 'complete' });
  return l.path;
}

test('summary counts and spend', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-rep-'));
  const s = summarize(readLedger(sample(d)));
  assert.equal(s.counts.DONE, 1); assert.equal(s.counts.FAILED, 1); assert.equal(s.counts['SKIPPED-HUMAN'], 1);
  assert.equal(s.counts['NOT-STARTED'], 1); assert.equal(s.counts['ALREADY-DONE'], 1);
  assert.ok(Math.abs(s.run.spentUsd - (0.42 + 1.5 + 0.3)) < 1e-9);
  assert.equal(s.features[0].tasks.find(t => t.id === 'T002').attempts.length, 3);
});

test('html escapes untrusted text and has no script', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-rep-'));
  const html = renderReport(readLedger(sample(d)));
  assert.ok(!html.includes('<script'), 'no <script> anywhere');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('https://github.com/o/r/pull/7'));
  assert.ok(html.includes('needs-human'));
  assert.ok(html.includes('SKIPPED') || html.includes('Human task'));
});

test('javascript: urls are not linked', () => {
  const html = renderReport([{ ev: 'run_start', runId: 'x' }, { ev: 'feature_start', feature: 'f', tasks: [] },
    { ev: 'pr', feature: 'f', url: 'javascript:alert(1)', draft: false }]);
  assert.ok(!/href="javascript:/i.test(html));
});

test('truncated final line and unfinished run still render as INCOMPLETE', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-rep-'));
  const p = sample(d);
  const lines = readFileSync(p, 'utf8').trim().split('\n').slice(0, 6);
  writeFileSync(p, lines.join('\n') + '\n{"t":"2026","ev":"task_en');
  const html = renderReport(readLedger(p));
  assert.ok(html.includes('did not finish cleanly'));
  assert.ok(html.includes('Incomplete') || html.includes('Not started'));
});

test('writeReport writes <run>.html and latest.html', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-rep-'));
  const out = join(d, 'ccs-reports');
  const f = writeReport({ ledgerPath: sample(d), outDir: out });
  assert.ok(f.endsWith('r1.html'));
  assert.equal(readFileSync(f, 'utf8'), readFileSync(join(out, 'latest.html'), 'utf8'));
});
