// Fold ledger events into the structure the report renders. Pure function, unit-tested.
const TASK_FINAL = new Set(['DONE', 'FAILED', 'BLOCKED']);

export function summarize(events, { now = new Date() } = {}) {
  const run = { runId: null, start: null, end: null, until: null, budgetUsd: null, base: null, claudeVersion: null,
    dryRun: false, noPr: false, stopReason: null, status: 'INCOMPLETE', spentUsd: 0, reviewer: null };
  const features = new Map();
  const errors = [];
  const F = id => {
    if (!features.has(id)) features.set(id, { feature: id, branch: null, status: 'NOT-STARTED', tasks: new Map(),
      reviews: [], pr: null, gate: null, error: null, skippedReason: null });
    return features.get(id);
  };
  const T = (f, id) => {
    if (!f.tasks.has(id)) f.tasks.set(id, { id, title: '', story: null, component: null, status: 'PENDING',
      attempts: [], verdict: null, durationMs: 0, costUsd: 0, commit: null, error: null, reason: null });
    return f.tasks.get(id);
  };

  for (const e of events) {
    switch (e.ev) {
      case 'run_start': Object.assign(run, { runId: e.runId, start: e.t, until: e.until ?? null, budgetUsd: e.budgetUsd ?? null,
        base: e.base ?? null, claudeVersion: e.claudeVersion ?? null, dryRun: !!e.dryRun, noPr: !!e.noPr }); break;
      case 'feature_skipped': { const f = F(e.feature); f.status = 'SKIPPED'; f.skippedReason = e.reason; break; }
      case 'feature_start': { const f = F(e.feature); f.status = 'RUNNING'; f.branch = e.branch ?? null;
        for (const t of e.tasks || []) { const r = T(f, t.id); Object.assign(r, { title: t.title, story: t.story, component: t.component });
          if (t.done) r.status = 'ALREADY-DONE'; } break; }
      case 'task_start': { const r = T(F(e.feature), e.task); r.status = 'RUNNING'; break; }
      case 'task_end': { const r = T(F(e.feature), e.task);
        r.attempts.push({ attempt: e.attempt, status: e.status, verdict: e.verdict ?? null, exitCode: e.exitCode ?? null,
          costUsd: e.costUsd ?? 0, durationMs: e.durationMs ?? 0, error: e.error ?? null });
        r.costUsd += e.costUsd ?? 0; r.durationMs += e.durationMs ?? 0; r.verdict = e.verdict ?? r.verdict;
        r.status = e.status; if (e.commit) r.commit = e.commit; r.error = e.error ?? r.error; r.reason = e.reason ?? r.reason;
        run.spentUsd += e.costUsd ?? 0; break; }
      case 'task_skipped': { const r = T(F(e.feature), e.task); r.status = e.status; r.reason = e.reason; if (e.title) r.title = e.title; break; }
      case 'review': { const f = F(e.feature); f.reviews.push({ round: e.round, reviewer: e.reviewer, verdict: e.verdict,
        counts: e.counts || {}, costUsd: e.costUsd ?? 0, artifact: e.artifact ?? null, note: e.note ?? null });
        run.spentUsd += e.costUsd ?? 0; run.reviewer = e.reviewer; break; }
      case 'fix': { run.spentUsd += e.costUsd ?? 0; break; }
      case 'gate': { F(e.feature).gate = { ok: e.ok, rows: e.rows || [] }; break; }
      case 'pr': { F(e.feature).pr = { url: e.url ?? null, draft: !!e.draft, labels: e.labels || [], skipped: e.skipped ?? null, error: e.error ?? null }; break; }
      case 'feature_end': { const f = F(e.feature); f.status = e.status; if (e.error) f.error = e.error; break; }
      case 'error': errors.push({ t: e.t, where: e.where, message: e.message, feature: e.feature, task: e.task }); break;
      case 'stop': run.stopReason = e.reason; break;
      case 'run_end': run.end = e.t; run.status = e.status; break;
    }
  }
  if (!run.end) { run.end = now.toISOString(); run.status = run.status === 'INCOMPLETE' ? 'INCOMPLETE' : run.status; }

  const counts = { DONE: 0, FAILED: 0, BLOCKED: 0, 'SKIPPED-HUMAN': 0, 'NOT-STARTED': 0, 'ALREADY-DONE': 0, PENDING: 0, RUNNING: 0 };
  const list = [...features.values()].map(f => ({ ...f, tasks: [...f.tasks.values()] }));
  for (const f of list) for (const t of f.tasks) {
    if (t.status === 'RUNNING' || t.status === 'PENDING') t.status = 'NOT-STARTED'; // run ended before it finished
    counts[t.status] = (counts[t.status] || 0) + 1;
  }
  return { run, features: list, counts, errors,
    wallMs: run.start ? Math.max(0, new Date(run.end) - new Date(run.start)) : 0, final: [...TASK_FINAL] };
}

export function nextActions(s) {
  const out = [];
  for (const f of s.features) {
    if (f.pr?.url) out.push(`Review ${f.pr.draft ? 'DRAFT ' : ''}PR for ${f.feature}: ${f.pr.url}`);
    if (f.pr?.error) out.push(`${f.feature}: PR could not be created (${f.pr.error}). The branch ${f.branch || ''} is committed locally.`);
    if (f.skippedReason) out.push(`${f.feature}: skipped. ${f.skippedReason}`);
    for (const t of f.tasks) {
      if (t.status === 'FAILED') out.push(`${f.feature}/${t.id} FAILED after ${t.attempts.length} attempt(s). Read the logs, fix the cause (often the AC or the spec), re-run.`);
      if (t.status === 'BLOCKED') out.push(`${f.feature}/${t.id} needs a human decision: ${t.reason || 'see BLOCKED.md'}`);
      if (t.status === 'SKIPPED-HUMAN') out.push(`${f.feature}/${t.id} is a human task: ${t.reason || ''}`);
      if (t.status === 'NOT-STARTED') out.push(`${f.feature}/${t.id} was not started${t.reason ? ` (${t.reason})` : ''}.`);
    }
  }
  if (s.run.stopReason && !['complete', 'done'].includes(s.run.stopReason)) out.push(`Run stopped early: ${s.run.stopReason}.`);
  return [...new Set(out)];
}
