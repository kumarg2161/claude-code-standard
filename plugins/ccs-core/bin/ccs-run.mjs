#!/usr/bin/env node
// Autonomous, time-boxed delivery cycle.
//   node ccs-run.mjs --until 07:00 --budget-usd 40 [--features 001,002] [--base main] [--dry-run] [--no-pr]
// For every APPROVED feature: worktree + branch -> one FRESH headless session per task (retries capped)
// -> deterministic gate -> independent review (fresh session / codex) -> fix loop -> push + PR.
// The model never pushes and never reports its own status: this script reads files, exit codes and git.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ledger } from './lib/ledger.mjs';
import { parseTasks, nextRunnable, classifyBlocked } from './lib/tasks.mjs';
import { run, killAll, tail } from './lib/proc.mjs';
import * as G from './lib/git.mjs';
import { reviewOnce } from './lib/review.mjs';
import { writeReport } from './ccs-report.mjs';
import { readLedger } from './lib/ledger.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = resolve(HERE, '..');

// ------------------------------------------------------------------ args
function parseArgs(argv) {
  const c = { until: null, budget: 20, taskBudget: 5, reviewBudget: 3, taskTimeoutMin: 45, maxAttempts: 3, reviewRounds: 2, features: null,
    base: null, dryRun: false, noPr: false, claudeBin: 'claude', codexBin: 'codex', reviewer: 'auto', model: null, reviewModel: null,
    repo: process.cwd(), install: true, pluginDirs: [], autoPluginDirs: true, runId: null, userSettings: false };
  const need = (i, n) => { if (i + 1 >= argv.length) { console.error(`${n} needs a value`); process.exit(2); } return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--until': c.until = need(i, a); i++; break;
      case '--budget-usd': c.budget = Number(need(i, a)); i++; break;
      case '--task-budget-usd': c.taskBudget = Number(need(i, a)); i++; break;
      case '--review-budget-usd': c.reviewBudget = Number(need(i, a)); i++; break;
      case '--task-timeout-min': c.taskTimeoutMin = Number(need(i, a)); i++; break;
      case '--max-attempts': c.maxAttempts = Number(need(i, a)); i++; break;
      case '--review-rounds': c.reviewRounds = Number(need(i, a)); i++; break;
      case '--features': c.features = need(i, a).split(',').map(s => s.trim()).filter(Boolean); i++; break;
      case '--base': c.base = need(i, a); i++; break;
      case '--repo': c.repo = resolve(need(i, a)); i++; break;
      case '--claude-bin': c.claudeBin = need(i, a); i++; break;
      case '--codex-bin': c.codexBin = need(i, a); i++; break;
      case '--reviewer': c.reviewer = need(i, a); i++; break;
      case '--model': c.model = need(i, a); i++; break;
      case '--review-model': c.reviewModel = need(i, a); i++; break;
      case '--run-id': c.runId = need(i, a); i++; break;
      case '--plugin-dir': c.pluginDirs.push(resolve(need(i, a))); i++; break;
      case '--no-auto-plugin-dirs': c.autoPluginDirs = false; break;
      case '--user-settings': c.userSettings = true; break;
      case '--no-install': c.install = false; break;
      case '--dry-run': c.dryRun = true; break;
      case '--no-pr': c.noPr = true; break;
      case '-h': case '--help': console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 6).join('\n').replace(/^\/\/ ?/gm, '')); process.exit(0);
      default: console.error(`unknown argument: ${a}`); process.exit(2);
    }
  }
  if (!(c.budget > 0)) { console.error('--budget-usd must be > 0'); process.exit(2); }
  c.taskBudget = Math.min(c.taskBudget, c.budget);
  return c;
}

export function parseUntil(s, now = new Date()) {
  if (!s) return null;
  let m = s.match(/^\+(\d+)(m|h)$/); if (m) return now.getTime() + Number(m[1]) * (m[2] === 'h' ? 3600e3 : 60e3);
  m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) { const d = new Date(now); d.setHours(Number(m[1]), Number(m[2]), 0, 0); if (d <= now) d.setDate(d.getDate() + 1); return d.getTime(); }
  const t = Date.parse(s); if (Number.isNaN(t)) { console.error(`bad --until: ${s} (use HH:MM, +90m, +8h or an ISO time)`); process.exit(2); }
  return t;
}

// ------------------------------------------------------------------ main
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main().catch(e => { console.error(e); process.exit(1); });

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const repo = await G.toplevel(cfg.repo);
  if (!repo) { console.error('not inside a git repository'); process.exit(2); }
  if (await G.isLinkedWorktree(repo)) { console.error('run ccs-run from the main checkout, not from a linked worktree'); process.exit(2); }

  const runId = cfg.runId || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  cfg.runId = runId;
  const runDir = join(repo, '.ccs', 'runs', runId);
  mkdirSync(join(runDir, 'logs'), { recursive: true });
  const ledgerPath = join(runDir, 'ledger.jsonl');
  const L = new Ledger(ledgerPath);
  await run('bash', [join(PLUGIN, 'scripts/ensure-ignored.sh')], { cwd: repo, timeoutMs: 15000, graceMs: 1000 });

  const until = parseUntil(cfg.until);
  const ver = await run(cfg.claudeBin, ['--version'], { timeoutMs: 15000, graceMs: 1000 });
  const st = { aborted: null, spent: 0, stop: null, consecutiveFails: 0, finalized: false, status: 'complete' };
  cfg.codexAvailable = cfg.reviewer !== 'claude' && (await run(cfg.codexBin, ['--version'], { timeoutMs: 8000, graceMs: 500 })).code === 0;
  cfg.reviewTimeoutMs = 30 * 60e3;

  const finalize = (sync = false) => {
    if (st.finalized) return; st.finalized = true;
    try {
      L.add('stop', { reason: st.stop || (st.aborted ? `signal:${st.aborted}` : 'complete') });
      L.add('run_end', { status: st.aborted ? 'aborted' : st.status });
      const f = writeReport({ ledgerPath, outDir: join(repo, 'ccs-reports') });
      console.log(`\nReport: ${f}`);
    } catch (e) { console.error(`report failed: ${e.message}`); }
  };
  const onSignal = sig => { if (st.aborted) return; st.aborted = sig; st.stop = `signal:${sig}`; killAll('SIGINT'); setTimeout(() => killAll('SIGTERM'), 5000).unref(); };
  process.on('SIGINT', () => onSignal('SIGINT')); process.on('SIGTERM', () => onSignal('SIGTERM')); process.on('SIGHUP', () => onSignal('SIGHUP'));
  process.on('uncaughtException', e => { try { L.add('error', { where: 'uncaught', message: String(e && e.stack || e) }); } catch { /* */ } st.status = 'failed'; finalize(true); process.exit(1); });
  process.on('exit', () => finalize(true));

  const base = cfg.base || await G.defaultBase(repo);
  L.add('run_start', { runId, until: until ? new Date(until).toISOString() : null, budgetUsd: cfg.budget, base, claudeVersion: ver.stdout.trim(),
    dryRun: cfg.dryRun, noPr: cfg.noPr || cfg.dryRun, reviewerPref: cfg.reviewer, codexAvailable: cfg.codexAvailable });

  const shouldStop = () => {
    if (st.aborted) return `signal:${st.aborted}`;
    if (st.stop) return st.stop;
    if (until && Date.now() >= until) return 'time';
    if (st.spent >= cfg.budget - 0.25) return 'budget';
    if (st.consecutiveFails >= 3) return 'consecutive-failures';
    return null;
  };

  try {
    if (!base || !(await G.branchExists(repo, base))) throw new Error(`base branch not found (${base}); pass --base`);
    // ---- which features are APPROVED on the base branch (specs must be committed there)
    const dirs = (await G.listDirs(repo, base, 'specs')).filter(d => /^\d{3,}-/.test(d)).sort();
    const features = [];
    for (const d of dirs) {
      if (cfg.features && !cfg.features.some(f => d === f || d.startsWith(`${f}-`))) continue;
      const spec = await G.showFile(repo, base, `specs/${d}/spec.md`);
      const status = spec && (spec.match(/^- \*\*Status:\*\*\s*([A-Z-]+)/m) || [])[1];
      if (status === 'APPROVED') features.push(d);
      else L.add('feature_skipped', { feature: d, reason: `spec Status is ${status || 'unknown'} on ${base}, not APPROVED (run /ccs-core:ccs-approve and commit)` });
    }
    if (!features.length) { st.stop = 'nothing-to-do'; console.log('No APPROVED features on', base); }

    const pluginDirs = [PLUGIN, ...cfg.pluginDirs];
    if (cfg.autoPluginDirs) for (const d of existsSync(join(PLUGIN, '..')) ? readdirSync(join(PLUGIN, '..')) : [])
      if (d.startsWith('ccs-') && resolve(PLUGIN, '..', d) !== PLUGIN && existsSync(join(PLUGIN, '..', d, '.claude-plugin/plugin.json'))) pluginDirs.push(resolve(PLUGIN, '..', d));
    const settingsFile = writeRunSettings(repo, runDir);

    for (const feature of features) {
      if (shouldStop()) break;
      await runFeature({ cfg, repo, base, feature, L, st, runDir, shouldStop, pluginDirs, settingsFile });
    }
  } catch (e) {
    st.status = 'failed';
    L.add('error', { where: 'runner', message: e.message });
    console.error(e.message);
  } finally {
    st.stop = st.stop || shouldStop();
    if (st.stop === 'budget' || st.stop === 'time' || st.stop === 'consecutive-failures') st.status = 'stopped';
    finalize();
  }
  process.exit(st.status === 'failed' ? 1 : st.aborted ? 130 : 0);
}

// ------------------------------------------------------------------ settings
function writeRunSettings(repo, runDir) {
  const base = JSON.parse(readFileSync(join(PLUGIN, 'templates/run-settings.json'), 'utf8'));
  const over = join(repo, '.claude/ccs-run.json'); // optional project extension: { "allow": [], "deny": [] }
  if (existsSync(over)) {
    try { const o = JSON.parse(readFileSync(over, 'utf8')); base.permissions.allow.push(...(o.allow || [])); base.permissions.deny.push(...(o.deny || [])); } catch { /* ignore bad file */ }
  }
  const f = join(runDir, 'settings.json'); writeFileSync(f, JSON.stringify(base, null, 2)); return f;
}

function claudeArgs({ cfg, prompt, settingsFile, pluginDirs, budget }) {
  const a = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'acceptEdits', '--permission-prompts', 'none',
    '--settings', settingsFile, '--max-budget-usd', budget.toFixed(2), '--add-dir', PLUGIN];
  if (!cfg.userSettings) a.push('--setting-sources', 'project,local');
  for (const d of pluginDirs) a.push('--plugin-dir', d);
  if (cfg.model) a.push('--model', cfg.model);
  return a;
}

function readVerdict(file) {
  if (!existsSync(file)) return null;
  const m = readFileSync(file, 'utf8').match(/^VERDICT:\s*(PASS|FAIL|BLOCKED)\s*$/m);
  return m ? m[1] : null;
}
const rd = p => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// ------------------------------------------------------------------ feature
async function runFeature(ctx) {
  const { cfg, repo, base, feature, L, st, runDir, shouldStop } = ctx;
  const branch = `ccs/${feature}`;
  const wt = join(repo, '.ccs', 'worktrees', feature);
  const tasksRel = `specs/${feature}/tasks.md`;
  try {
    // initial snapshot from base so the report has denominators even for a dry run
    const snapMd = await G.showFile(repo, base, tasksRel);
    if (!snapMd) { L.add('feature_skipped', { feature, reason: `${tasksRel} missing on ${base}` }); return; }
    const snap = parseTasks(snapMd).tasks;
    L.add('feature_start', { feature, branch, worktree: wt, tasks: snap.map(t => ({ id: t.id, title: t.title, story: t.story, component: t.component, done: t.done })) });

    if (cfg.dryRun) {
      for (const b of classifyBlocked(snap)) L.add('task_skipped', { feature, task: b.id, status: b.status, reason: b.reason });
      for (const t of snap.filter(t => !t.done && t.autonomy === 'auto')) L.add('task_skipped', { feature, task: t.id, status: 'NOT-STARTED', reason: 'dry run: would run' });
      L.add('pr', { feature, skipped: 'dry run' }); L.add('feature_end', { feature, status: 'DRY-RUN' }); return;
    }

    // ---- isolation: one worktree + branch per feature, cut from base. Main checkout is never touched.
    if (!existsSync(wt)) {
      const args = (await G.branchExists(repo, branch)) ? ['worktree', 'add', wt, branch] : ['worktree', 'add', '-b', branch, wt, base];
      const r = await G.git(repo, args); if (r.code !== 0) throw new Error(`worktree add failed: ${r.stderr.trim()}`);
    }
    if (cfg.install && !(await installDeps(wt, runDir, feature))) throw new Error('dependency install failed (see logs); fix the lockfile or pass --no-install');

    const failedOrBlocked = new Set();
    for (;;) {
      if (shouldStop()) break;
      const { tasks } = parseTasks(rd(join(wt, tasksRel)));
      const next = nextRunnable(tasks, { skip: failedOrBlocked });
      if (!next) break;
      const res = await runTask({ ...ctx, wt, branch, task: next });
      if (res.status === 'NOT-RUN') break; // stop condition hit before any attempt: leave it NOT-STARTED
      if (res.status === 'DONE') { st.consecutiveFails = 0; await markDone(wt, tasksRel, next.id); }
      else { failedOrBlocked.add(next.id); if (res.status === 'FAILED') st.consecutiveFails++; }
    }

    // ---- everything that did not run, with the reason
    const { tasks: fin } = parseTasks(rd(join(wt, tasksRel)));
    const stopWhy = shouldStop();
    const reported = new Set();
    for (const b of classifyBlocked(fin, { failed: failedOrBlocked })) { L.add('task_skipped', { feature, task: b.id, status: b.status, reason: b.reason }); reported.add(b.id); }
    for (const t of fin) if (!t.done && !reported.has(t.id) && !failedOrBlocked.has(t.id) && t.autonomy === 'auto')
      L.add('task_skipped', { feature, task: t.id, status: 'NOT-STARTED', reason: stopWhy ? `run stopped: ${stopWhy}` : 'not reached' });

    const ahead = Number(await G.gitOut(wt, ['rev-list', '--count', `${base}..HEAD`]) || 0);
    const allDone = fin.every(t => t.done);
    if (!ahead) { L.add('pr', { feature, skipped: 'no commits on the branch' }); L.add('feature_end', { feature, status: failedOrBlocked.size ? 'FAILED' : 'NOTHING-TO-DO' }); return; }
    if (stopWhy && stopWhy !== 'time' && stopWhy !== 'budget' && stopWhy !== 'consecutive-failures') { L.add('pr', { feature, skipped: `run aborted (${stopWhy})` }); L.add('feature_end', { feature, status: 'ABORTED' }); return; }

    await finishFeature({ ...ctx, wt, branch, allDone, humanLeft: fin.filter(t => !t.done && t.autonomy === 'human').length, failedCount: failedOrBlocked.size, stopWhy });
  } catch (e) {
    L.add('error', { where: 'feature', feature, message: e.message });
    L.add('feature_end', { feature, status: 'ERROR', error: e.message });
  }
}

async function installDeps(wt, runDir, feature) {
  const has = f => existsSync(join(wt, f));
  let cmd = null;
  if (has('pnpm-lock.yaml')) cmd = ['pnpm', ['install', '--frozen-lockfile']];
  else if (has('package-lock.json')) cmd = ['npm', ['ci']];
  else if (has('yarn.lock')) cmd = ['yarn', ['install', '--immutable']];
  else return true;
  const r = await run(cmd[0], cmd[1], { cwd: wt, timeoutMs: 15 * 60e3, graceMs: 5000 });
  mkdirSync(join(runDir, 'logs', feature), { recursive: true });
  writeFileSync(join(runDir, 'logs', feature, 'install.log'), r.stdout + '\n' + r.stderr);
  return r.code === 0;
}

async function markDone(wt, tasksRel, id) {
  const p = join(wt, tasksRel); const s = readFileSync(p, 'utf8');
  const n = s.replace(new RegExp(`^- \\[ \\] ${id}\\b`, 'm'), `- [x] ${id}`);
  if (n === s) return;
  writeFileSync(p, n);
  await G.git(wt, ['add', tasksRel]);
  await G.git(wt, ['commit', '-q', '-m', `chore(tasks): mark ${id} done`]);
}

// ------------------------------------------------------------------ one task, with retries
async function runTask(ctx) {
  const { cfg, repo, feature, task, wt, L, st, runDir, settingsFile, pluginDirs, shouldStop } = ctx;
  const taskRel = `specs/${feature}/tasks/${task.id}`;
  const logs = join(runDir, 'logs', feature); mkdirSync(logs, { recursive: true });
  let retryNote = null, last = { status: 'NOT-RUN' }, ran = 0;
  const startHead = await G.head(wt);
  // Keep evidence from a task that did not land, then give the next task a clean tree.
  const discard = async () => {
    const src = join(wt, taskRel);
    if (existsSync(src)) { const dst = join(logs, `${task.id}.artifacts`); mkdirSync(dst, { recursive: true });
      for (const f of readdirSync(src)) { try { copyFileSync(join(src, f), join(dst, f)); } catch { /* subdir */ } } }
    await G.resetHard(wt, startHead);
  };

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    if (shouldStop()) break;
    const remaining = cfg.budget - st.spent;
    const slice = Math.min(cfg.taskBudget, remaining - 0.1);
    if (slice < 0.5) { st.stop = 'budget'; break; }
    ran++;
    const preHead = await G.head(wt);
    L.add('task_start', { feature, task: task.id, attempt });

    let prompt = `/ccs-core:ccs-run-task ${feature} ${task.id}`;
    if (retryNote) { const rel = `.ccs/retry/${task.id}.md`; mkdirSync(join(wt, '.ccs/retry'), { recursive: true }); writeFileSync(join(wt, rel), retryNote); prompt += ` retry=${rel}`; }
    const r = await run(cfg.claudeBin, claudeArgs({ cfg, prompt, settingsFile, pluginDirs, budget: slice }), { cwd: wt, timeoutMs: cfg.taskTimeoutMin * 60e3, graceMs: 30000 });
    writeFileSync(join(logs, `${task.id}.attempt${attempt}.json`), r.stdout);
    if (r.stderr.trim()) writeFileSync(join(logs, `${task.id}.attempt${attempt}.err`), r.stderr);

    let cost = 0, resultText = '', isError = false;
    try { const j = JSON.parse(r.stdout); cost = Number(j.total_cost_usd) || 0; resultText = String(j.result || ''); isError = !!j.is_error; } catch { resultText = r.stdout; }
    const verdict = readVerdict(join(wt, taskRel, '04-verification.md'));
    const blocked = rd(join(wt, taskRel, 'BLOCKED.md')).trim();
    const headNow = await G.head(wt);
    const dirty = await G.dirtyFiles(wt);
    const committed = headNow && headNow !== preHead;

    let status, error = null, reason = null;
    if (blocked) { status = 'BLOCKED'; reason = blocked.slice(0, 600); }
    else if (r.timedOut) { status = 'FAILED'; error = `timed out after ${cfg.taskTimeoutMin} min`; }
    else if (r.spawnError) { status = 'FAILED'; error = `could not start ${cfg.claudeBin}: ${tail(r.stderr, 3)}`; }
    else if (verdict === 'PASS' && committed && !dirty.length && !isError) status = 'DONE';
    else {
      status = 'FAILED';
      const why = [];
      if (verdict !== 'PASS') why.push(`verification verdict: ${verdict || 'none (no 04-verification.md)'}`);
      if (!committed) why.push('no commit was produced');
      if (dirty.length) why.push(`uncommitted changes left: ${dirty.slice(0, 5).join('; ')}`);
      if (isError) why.push('session reported is_error');
      error = `${why.join('\n')}\n\n--- verification ---\n${tail(rd(join(wt, taskRel, '04-verification.md')), 40)}\n\n--- session result ---\n${tail(resultText, 15)}`;
    }
    const commit = status === 'DONE' ? headNow : null;
    L.add('task_end', { feature, task: task.id, attempt, status, verdict, exitCode: r.code, costUsd: cost, durationMs: r.durationMs, commit, error, reason });
    st.spent += cost;
    last = { status };
    console.log(`[${feature}] ${task.id} attempt ${attempt}: ${status}${verdict ? ` (${verdict})` : ''}  $${cost.toFixed(2)}  total $${st.spent.toFixed(2)}`);

    if (status === 'DONE') return last;
    if (status === 'BLOCKED') { await discard(); return last; }
    // retry: keep the evidence, then restore a clean tree so the next session starts fresh
    retryNote = `Previous attempt ${attempt} of ${task.id} failed.\n\n${error}\n\nStart from the code as committed (the working tree was reset). Fix the cause; do not weaken an acceptance criterion.\n`;
    writeFileSync(join(logs, `${task.id}.attempt${attempt}.failure.md`), retryNote);
    await G.resetHard(wt, preHead);
    if (r.timedOut) break; // a timeout will likely repeat; do not burn the budget
  }
  if (last.status !== 'DONE') await discard();
  return ran ? last : { status: 'NOT-RUN' };
}

// ------------------------------------------------------------------ deterministic gate
async function runGate(wt, runDir, feature) {
  const d = await run('bash', [join(PLUGIN, 'scripts/detect-verify.sh')], { cwd: wt, timeoutMs: 30000, graceMs: 1000 });
  const lines = d.stdout.split('\n').filter(l => l.includes('\t'));
  if (!lines.length) return { ok: false, rows: [{ dir: '.', kind: 'detect', exit: 'UNKNOWN' }] };
  const rows = [];
  for (const l of lines) {
    const [dir, , kind, cmd] = l.split('\t');
    if (!['test', 'typecheck', 'lint', 'suite'].includes(kind)) continue;
    const r = await run('sh', ['-c', cmd], { cwd: join(wt, dir), timeoutMs: 15 * 60e3, graceMs: 5000 });
    writeFileSync(join(runDir, 'logs', feature, `gate.${dir.replace(/\W/g, '_')}.${kind}.log`), r.stdout + '\n' + r.stderr);
    rows.push({ dir, kind, exit: r.code });
  }
  return { ok: rows.length > 0 && rows.every(x => x.exit === 0), rows };
}

// ------------------------------------------------------------------ review -> fix -> PR
async function finishFeature(ctx) {
  const { cfg, repo, base, feature, wt, branch, L, st, runDir, allDone, humanLeft, failedCount, stopWhy, settingsFile, pluginDirs } = ctx;
  let gate = await runGate(wt, runDir, feature); L.add('gate', { feature, ok: gate.ok, rows: gate.rows });
  let verdict = 'NONE';

  for (let round = 1; round <= cfg.reviewRounds + 1; round++) {
    if (st.aborted) break;
    if (st.spent >= cfg.budget - 0.5) { st.stop = st.stop || 'budget'; break; }
    const rv = await reviewOnce({ wt, feature, base, round, runDir, cfg: { ...cfg, reviewBudget: Math.min(cfg.reviewBudget, cfg.budget - st.spent - 0.1) }, pluginRoot: PLUGIN });
    st.spent += rv.costUsd; verdict = rv.verdict;
    L.add('review', { feature, round, reviewer: rv.reviewer, verdict: rv.verdict, counts: rv.counts, costUsd: rv.costUsd, artifact: rv.artifact, note: rv.note });
    await G.git(wt, ['add', `specs/${feature}/review`]); await G.git(wt, ['commit', '-q', '-m', `docs(review): independent review round ${round} (${rv.reviewer})`]);
    if (rv.verdict === 'APPROVED' || round > cfg.reviewRounds) break;
    if (!rv.counts.CRITICAL && !rv.counts.HIGH && rv.verdict !== 'UNPARSEABLE') break; // only MEDIUM/LOW: ship as draft with findings, do not churn
    if (rv.verdict === 'UNPARSEABLE') break;

    // fix in a FRESH session that sees only the findings
    const rel = `.ccs/review/findings-round${round}.md`; mkdirSync(join(wt, '.ccs/review'), { recursive: true });
    writeFileSync(join(wt, rel), `# Findings to fix (round ${round})\n\n${rv.text}\n`);
    const slice = Math.min(cfg.taskBudget, cfg.budget - st.spent - 0.1); if (slice < 0.5) { st.stop = st.stop || 'budget'; break; }
    const preHead = await G.head(wt);
    const r = await run(cfg.claudeBin, claudeArgs({ cfg, prompt: `/ccs-core:ccs-run-fix ${feature} findings=${rel}`, settingsFile, pluginDirs, budget: slice }), { cwd: wt, timeoutMs: cfg.taskTimeoutMin * 60e3, graceMs: 30000 });
    let cost = 0; try { cost = Number(JSON.parse(r.stdout).total_cost_usd) || 0; } catch { /* */ }
    st.spent += cost; L.add('fix', { feature, round, costUsd: cost, exitCode: r.code });
    writeFileSync(join(runDir, 'logs', feature, `fix-r${round}.json`), r.stdout);
    if ((await G.dirtyFiles(wt)).length) await G.resetHard(wt, preHead);
    gate = await runGate(wt, runDir, feature); L.add('gate', { feature, ok: gate.ok, rows: gate.rows });
  }

  const clean = allDone && !humanLeft && !failedCount && verdict === 'APPROVED' && gate.ok;
  const draft = !clean;
  const reasons = [];
  if (!allDone) reasons.push('not every task is done');
  if (humanLeft) reasons.push(`${humanLeft} human task(s) remain`);
  if (failedCount) reasons.push(`${failedCount} task(s) failed or blocked`);
  if (verdict !== 'APPROVED') reasons.push(`independent review: ${verdict}`);
  if (!gate.ok) reasons.push('final gate not green');
  if (stopWhy) reasons.push(`run stopped: ${stopWhy}`);

  if (cfg.noPr) { L.add('pr', { feature, skipped: '--no-pr' }); L.add('feature_end', { feature, status: clean ? 'READY' : 'PARTIAL' }); return; }
  await openPr({ cfg, repo, base, feature, wt, branch, L, draft, reasons, runDir, clean });
}

async function openPr({ cfg, repo, base, feature, wt, branch, L, draft, reasons, runDir, clean }) {
  try {
    if (!branch.startsWith('ccs/') || branch === base) throw new Error(`refusing to push ${branch}`);
    const remote = await G.gitOut(repo, ['remote', 'get-url', 'origin']);
    if (!remote) { L.add('pr', { feature, skipped: 'no origin remote' }); L.add('feature_end', { feature, status: clean ? 'READY' : 'PARTIAL' }); return; }
    const push = await G.git(wt, ['push', '-u', 'origin', branch], { timeoutMs: 180000 });
    if (push.code !== 0) throw new Error(`push failed: ${tail(push.stderr, 3)}`);
    const labels = draft ? ['needs-human'] : [];
    if (draft) await run('gh', ['label', 'create', 'needs-human', '--color', 'D93F0B', '--description', 'Autonomous run left open items', '--force'], { cwd: wt, timeoutMs: 30000, graceMs: 1000 });
    const { tasks } = parseTasks(rd(join(wt, `specs/${feature}/tasks.md`)));
    const title = (rd(join(wt, `specs/${feature}/spec.md`)).match(/^# Feature Spec:\s*(.+)$/m) || [, feature])[1].trim();
    const body = [`## ${title}`, '', `Autonomous run branch \`${branch}\` for \`specs/${feature}\`. Spec, plan, tasks and per-task evidence are in the diff.`, '',
      `**State:** ${draft ? 'DRAFT: needs a human' : 'ready for review'}`, ...(reasons.length ? ['', '**Open items:**', ...reasons.map(r => `- ${r}`)] : []), '',
      '### Tasks', ...tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.id} ${t.title}${t.autonomy === 'human' ? ' _(human)_' : ''}`), '',
      '### Independent review', `See \`specs/${feature}/review/\` (written by a fresh session that did not see the implementation notes).`, '',
      `_Run \`${cfg.runId || 'see ccs-reports/latest.html'}\`; the HTML report is local and git-ignored._`].join('\n');
    const bodyFile = join(runDir, `${feature}.pr-body.md`); writeFileSync(bodyFile, body);
    const args = ['pr', 'create', '--base', base, '--head', branch, '--title', `${draft ? '[DRAFT] ' : ''}${title}`, '--body-file', bodyFile];
    if (draft) args.push('--draft', '--label', 'needs-human');
    let r = await run('gh', args, { cwd: wt, timeoutMs: 60000, graceMs: 1000 });
    if (r.code !== 0 && draft) r = await run('gh', args.filter((a, i) => !(a === '--label' || args[i - 1] === '--label')), { cwd: wt, timeoutMs: 60000, graceMs: 1000 });
    if (r.code !== 0) throw new Error(`gh pr create failed: ${tail(r.stderr, 3)}`);
    const url = (r.stdout.match(/https?:\/\/\S+/g) || []).pop() || null;
    L.add('pr', { feature, url, draft, labels: labels });
    L.add('feature_end', { feature, status: clean ? 'READY' : 'PARTIAL' });
  } catch (e) {
    L.add('pr', { feature, error: e.message }); L.add('error', { where: 'pr', feature, message: e.message });
    L.add('feature_end', { feature, status: 'PARTIAL', error: e.message });
  }
}
