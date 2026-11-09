#!/usr/bin/env node
// Structural lint for a feature's spec.md + tasks.md. Deterministic: no model involved.
//   node ccs-lint.mjs specs/001-signup [--components api,web,mobile,shared] [--json]
// Exit 0 = no errors (warnings allowed), 1 = errors, 2 = usage / unreadable input.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseTasks, hasCycle } from './lib/tasks.mjs';

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (!dir) { console.error('usage: ccs-lint.mjs <specs/NNN-feature> [--components a,b] [--json]'); process.exit(2); }

const read = f => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : null);
const spec = read('spec.md');
const tasksMd = read('tasks.md');
if (spec === null || tasksMd === null) { console.error(`missing spec.md or tasks.md in ${dir}`); process.exit(2); }

const errors = [];
const warnings = [];
const E = (id, msg) => errors.push({ id, msg });
const W = (id, msg) => warnings.push({ id, msg });

// ---- spec
const markers = spec.match(/\[NEEDS CLARIFICATION[^\]]*\]/g) || [];
if (markers.length) E('spec', `${markers.length} unresolved [NEEDS CLARIFICATION] marker(s); run /ccs-core:ccs-clarify`);
const frs = [...new Set(spec.match(/\bFR-\d{3}\b/g) || [])];
if (!frs.length) E('spec', 'no FR-### requirements found');
if (!/^- \*\*Status:\*\*/m.test(spec)) W('spec', 'spec.md has no "- **Status:**" line');

// ---- tasks
const { tasks, problems } = parseTasks(tasksMd);
problems.forEach(p => E(`tasks.md:${p.line}`, p.msg));
if (!tasks.length) E('tasks', 'no tasks parsed from tasks.md');

const ids = new Set();
const RISKY = /\b(auth\w*|password|passwd|token|jwt|oauth|session|encrypt\w*|crypto\w*|secret|permission|rbac|acl|migrat\w*|schema change|visual|pixel|animation|layout|look and feel|brand)\b/i;
const components = (flag('--components') || '').split(',').map(s => s.trim()).filter(Boolean);

for (const t of tasks) {
  if (ids.has(t.id)) E(t.id, 'duplicate task id'); ids.add(t.id);
  if (!t.acs.length) E(t.id, 'no acceptance criteria (AC: ... | check: ...)');
  if (!t.autonomy) E(t.id, 'missing "autonomy: auto|human"');
  if (t.autonomy === 'human' && !t.reason) E(t.id, 'autonomy: human needs "(reason: ...)"');
  if (!t.component && !t.kind) W(t.id, 'no component tag ([api]/[web]/[mobile]/[shared])');
  if (components.length && t.component && !components.includes(t.component))
    E(t.id, `component tag [${t.component}] is not one of: ${components.join(', ')}`);
  if (t.autonomy === 'auto' && !t.reason) {
    const hay = `${t.title} ${t.acs.map(a => a.text).join(' ')}`;
    const hit = hay.match(RISKY);
    if (hit) E(t.id, `autonomy: auto but mentions "${hit[0]}" (auth/crypto/migration/visual work is never auto by default). Mark autonomy: human, or add "(reason: ...)" to override explicitly`);
  }
  const accIds = new Set();
  for (const a of t.acs) { if (accIds.has(a.id)) E(t.id, `duplicate ${a.id}`); accIds.add(a.id); }
}
for (const t of tasks) for (const d of t.deps) if (!ids.has(d)) E(t.id, `depends on unknown task ${d}`);
const cyc = hasCycle(tasks);
if (cyc) E('deps', `dependency cycle: ${cyc.join(' -> ')}`);

const stories = [...new Set(tasks.map(t => t.story).filter(Boolean))];
for (const s of stories) {
  const inStory = tasks.filter(t => t.story === s);
  if (!inStory.some(t => t.acs.some(a => a.negative))) E(s, 'no negative AC (something that must still work) in any task of this story');
}

// Every FR must be referenced by tasks.md or plan (traceability), as a warning.
const plan = read('plan.md') || '';
for (const fr of frs) if (!tasksMd.includes(fr) && !plan.includes(fr)) W(fr, 'not referenced in tasks.md or plan.md (traceability)');

const out = { ok: errors.length === 0, dir, tasks: tasks.length, autoTasks: tasks.filter(t => t.autonomy === 'auto').length,
  humanTasks: tasks.filter(t => t.autonomy === 'human').length, errors, warnings };
if (args.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`${dir}: ${out.tasks} tasks (${out.autoTasks} auto, ${out.humanTasks} human)`);
  errors.forEach(e => console.log(`  ERROR  ${e.id}: ${e.msg}`));
  warnings.forEach(w => console.log(`  warn   ${w.id}: ${w.msg}`));
  console.log(out.ok ? 'LINT: OK' : `LINT: FAILED (${errors.length} error(s))`);
}
process.exit(out.ok ? 0 : 1);
