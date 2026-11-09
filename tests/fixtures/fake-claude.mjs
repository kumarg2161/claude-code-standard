#!/usr/bin/env node
// Stand-in for `claude -p` used by runner tests. Behaviour per task comes from FAKE_BEHAVIOR:
//   {"T001":["fail","pass"],"T002":["blocked"]}   outcomes per attempt: pass|fail|blocked|nocommit|slow
// Reviews: FAKE_REVIEW = ["changes","approved"] per round. Cost per call: FAKE_COST (default 0.11).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const a = process.argv.slice(2);
if (a.includes('--version')) { console.log('9.9.9 (fake)'); process.exit(0); }
const prompt = a[a.indexOf('-p') + 1] || '';
const cost = Number(process.env.FAKE_COST || 0.11);
const cwd = process.cwd();
const out = (result, extra = {}) => { console.log(JSON.stringify({ result, total_cost_usd: cost, is_error: false, ...extra })); process.exit(0); };
const git = (...x) => execFileSync('git', x, { cwd, encoding: 'utf8' });
const counter = (name) => { const d = join(cwd, '.ccs/fake'); mkdirSync(d, { recursive: true }); const f = join(d, name);
  const n = (existsSync(f) ? Number(readFileSync(f, 'utf8')) : 0) + 1; writeFileSync(f, String(n)); return n; };
appendFileSync(process.env.FAKE_LOG || '/dev/null', JSON.stringify({ argv: a.filter(x => x !== prompt), prompt: prompt.slice(0, 80), cwd }) + '\n');

let m;
if ((m = prompt.match(/^\/ccs-core:ccs-run-task (\S+) (T\d+)/))) {
  const [, feature, id] = m;
  const attempt = counter(`${id}.attempts`);
  const beh = (JSON.parse(process.env.FAKE_BEHAVIOR || '{}')[id] || ['pass']);
  const mode = beh[Math.min(attempt - 1, beh.length - 1)];
  const dir = join(cwd, 'specs', feature, 'tasks', id); mkdirSync(dir, { recursive: true });
  if (mode === 'slow') { await new Promise(r => setTimeout(r, 30000)); }
  if (mode === 'blocked') { writeFileSync(join(dir, 'BLOCKED.md'), `Need a decision for ${id}: option A or B.`); out(`TASK ${id}: BLOCKED needs decision`); }
  writeFileSync(join(dir, '01-plan.md'), `# plan ${id}\n`);
  writeFileSync(join(dir, '04-verification.md'), `# Verification\nVERDICT: ${mode === 'fail' ? 'FAIL' : 'PASS'}\n\n| AC | Result |\n|---|---|\n| AC-1 | ${mode === 'fail' ? 'FAIL' : 'PASS'} |\n`);
  if (mode === 'fail') out(`TASK ${id}: FAIL assertion`);
  mkdirSync(join(cwd, 'src'), { recursive: true }); writeFileSync(join(cwd, 'src', `${id}.txt`), `impl ${id} attempt ${attempt}\n`);
  if (mode === 'nocommit') out(`TASK ${id}: PASS`);
  git('add', '-A'); git('commit', '-q', '-m', `feat(api): implement ${id}`);
  out(`TASK ${id}: PASS`);
}
if (prompt.startsWith('/ccs-core:ccs-run-fix')) {
  mkdirSync(join(cwd, 'src'), { recursive: true }); writeFileSync(join(cwd, 'src', 'fixed.txt'), 'fixed\n');
  git('add', '-A'); git('commit', '-q', '-m', 'fix(review): address findings'); out('FIX: DONE', { total_cost_usd: 0.05 });
}
if (prompt.startsWith('Review the feature branch')) {
  const round = counter('review.rounds');
  const seq = JSON.parse(process.env.FAKE_REVIEW || '["approved"]'); const v = seq[Math.min(round - 1, seq.length - 1)];
  const body = v === 'approved' ? '# Review: x\n\n## Findings\n\nNone.\n\nVerdict: APPROVED\n'
    : '# Review: x\n\n## Findings\n| ID | Severity | Location | Issue | Fix |\n|---|---|---|---|---|\n| F-1 | HIGH | src/T001.txt:1 | bad | fix it |\n| F-2 | LOW | src/T002.txt:1 | nit | tidy |\n\nVerdict: CHANGES-REQUIRED\n';
  out(body);
}
out('unrecognised fake prompt', { is_error: true });
