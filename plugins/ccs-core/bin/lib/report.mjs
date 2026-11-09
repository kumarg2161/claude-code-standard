// Deterministic HTML status report. Everything comes from the ledger; every value is escaped.
// One self-contained file: inline CSS, light/dark/print, no JavaScript, no network.
import { summarize, nextActions } from './summarize.mjs';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dur = ms => { if (!ms) return '0s'; const s = Math.round(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${r}s` : `${r}s`; };
const usd = n => `$${(n || 0).toFixed(2)}`;
const when = iso => iso ? new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : '';
const safeUrl = u => (/^https?:\/\//.test(u || '') ? u : null);

const STATUS_LABEL = { DONE: 'Done', FAILED: 'Failed', BLOCKED: 'Blocked', 'SKIPPED-HUMAN': 'Human task', 'NOT-STARTED': 'Not started',
  'ALREADY-DONE': 'Already done', PENDING: 'Pending', RUNNING: 'Incomplete' };
const badge = s => `<span class="b b-${esc(String(s).toLowerCase())}">${esc(STATUS_LABEL[s] || s)}</span>`;

const CSS = `
:root{--bg:#fff;--fg:#17202a;--mut:#5b6673;--line:#d9dee5;--card:#f6f8fa;--ok:#116329;--okbg:#dafbe1;--bad:#a40e26;--badbg:#ffebe9;--warn:#7d4e00;--warnbg:#fff1c2;--info:#0b4f8a;--infobg:#ddf0ff;--neu:#4b5563;--neubg:#eceff3}
@media (prefers-color-scheme:dark){:root{--bg:#0e1116;--fg:#e6edf3;--mut:#9aa7b4;--line:#2b3340;--card:#151a22;--ok:#7ee2a0;--okbg:#12361f;--bad:#ff9a9a;--badbg:#401418;--warn:#f1cb6a;--warnbg:#3a2d0a;--info:#8cc8ff;--infobg:#0f2a45;--neu:#b5bfcb;--neubg:#232a34}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:1080px;margin:0 auto;padding:32px 16px 64px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:36px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}h3{font-size:15px;margin:22px 0 6px}
.sub{color:var(--mut);margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px}.tile .n{font-size:26px;font-weight:650;line-height:1.1}.tile .l{color:var(--mut);font-size:12.5px;text-transform:uppercase;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin:6px 0 4px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.mono,code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}
pre{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:10px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;margin:6px 0}
.b{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.b-done,.b-approved,.b-pass{background:var(--okbg);color:var(--ok)}.b-failed,.b-changes-required,.b-fail{background:var(--badbg);color:var(--bad)}
.b-blocked,.b-skipped-human,.b-draft,.b-incomplete,.b-skipped{background:var(--warnbg);color:var(--warn)}.b-not-started,.b-already-done,.b-pending,.b-none{background:var(--neubg);color:var(--neu)}.b-running,.b-ready{background:var(--infobg);color:var(--info)}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 18px;margin:6px 0}.kv dt{color:var(--mut)}.kv dd{margin:0}
.fh{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.note{color:var(--mut);font-size:13px}ul.act{padding-left:20px}a{color:var(--info)}
details{margin:4px 0}summary{cursor:pointer;color:var(--mut)}footer{margin-top:40px;color:var(--mut);font-size:12.5px;border-top:1px solid var(--line);padding-top:12px}
@media print{body{font-size:12px}.tile{break-inside:avoid}details{display:block}details>summary{display:none}main{padding:0}}`;

export function renderReport(events, opts = {}) {
  const s = summarize(events, opts);
  const { run, counts } = s;
  const total = ['DONE', 'FAILED', 'BLOCKED', 'SKIPPED-HUMAN', 'NOT-STARTED', 'ALREADY-DONE'].reduce((a, k) => a + (counts[k] || 0), 0);
  const verdictBanner = run.status === 'INCOMPLETE'
    ? '<p class="note"><strong>This run did not finish cleanly</strong> (crash or kill). The figures below are what the ledger recorded up to that point.</p>' : '';
  const tile = (n, l) => `<div class="tile"><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`;

  const header = `
<h1>Autonomous run report</h1>
<p class="sub">Run <span class="mono">${esc(run.runId || 'unknown')}</span> · ${esc(when(run.start))} → ${esc(when(run.end))} · ${esc(dur(s.wallMs))}</p>
${verdictBanner}
<dl class="kv">
<dt>Outcome</dt><dd>${badge(run.status === 'complete' ? 'DONE' : ['INCOMPLETE', 'aborted'].includes(run.status) ? 'INCOMPLETE' : run.status === 'stopped' ? 'BLOCKED' : 'FAILED')} ${esc(run.status)}${run.stopReason ? ` · stop reason: <strong>${esc(run.stopReason)}</strong>` : ''}</dd>
<dt>Spend</dt><dd>${esc(usd(run.spentUsd))}${run.budgetUsd != null ? ` of ${esc(usd(run.budgetUsd))} budget` : ''} <span class="note">(client-side estimate)</span></dd>
<dt>Window</dt><dd>${run.until ? `until ${esc(when(run.until))}` : 'no end time set'}</dd>
<dt>Base branch</dt><dd class="mono">${esc(run.base || '')}</dd>
<dt>Mode</dt><dd>${run.dryRun ? 'dry run (no agent sessions)' : 'live'}${run.noPr ? ' · PRs disabled' : ''}</dd>
<dt>Independent reviewer</dt><dd>${esc(run.reviewer || 'none ran')}</dd>
<dt>Claude Code</dt><dd class="mono">${esc(run.claudeVersion || '')}</dd>
</dl>`;

  const tiles = `<h2>Summary</h2><div class="grid">${tile(counts.DONE, 'Done')}${tile(counts.FAILED, 'Failed')}${tile(counts.BLOCKED, 'Blocked')}${tile(counts['SKIPPED-HUMAN'], 'Human tasks')}${tile(counts['NOT-STARTED'], 'Not started')}${tile(counts['ALREADY-DONE'], 'Already done')}${tile(total, 'Tasks in scope')}${tile(s.features.length, 'Features')}</div>`;

  const featureHtml = s.features.map(f => {
    const pr = f.pr;
    const prCell = pr?.url ? `<a href="${esc(safeUrl(pr.url) || '#')}">${esc(pr.url)}</a> ${badge(pr.draft ? 'DRAFT' : 'READY')}${pr.labels?.length ? ` <span class="note">labels: ${esc(pr.labels.join(', '))}</span>` : ''}`
      : pr?.skipped ? `<span class="note">not created: ${esc(pr.skipped)}</span>` : pr?.error ? `<span class="note">failed: ${esc(pr.error)}</span>` : '<span class="note">none</span>';
    const rev = f.reviews.length ? f.reviews.map(r => `<tr><td>${esc(r.round)}</td><td>${esc(r.reviewer)}</td><td>${badge(r.verdict || 'NONE')}</td>
<td class="num">${esc(r.counts.CRITICAL ?? 0)}</td><td class="num">${esc(r.counts.HIGH ?? 0)}</td><td class="num">${esc(r.counts.MEDIUM ?? 0)}</td><td class="num">${esc(r.counts.LOW ?? 0)}</td>
<td class="mono">${esc(r.artifact || '')}${r.note ? ` <span class="note">${esc(r.note)}</span>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="8" class="note">No review ran for this feature.</td></tr>';
    const gate = f.gate ? `<p class="note">Final gate (runner-executed, deterministic): ${badge(f.gate.ok ? 'PASS' : 'FAIL')} ${esc(f.gate.rows.map(r => `${r.dir}:${r.kind}=${r.exit}`).join('  '))}</p>` : '';
    const rows = f.tasks.map(t => `<tr><td class="mono">${esc(t.id)}</td><td>${esc(t.story || '')}</td><td>${esc(t.component || '')}</td><td>${esc(t.title)}</td><td>${badge(t.status)}</td>
<td class="num">${esc(t.attempts.length)}</td><td>${t.verdict ? badge(t.verdict) : ''}</td><td class="num">${esc(dur(t.durationMs))}</td><td class="num">${esc(usd(t.costUsd))}</td><td class="mono">${esc((t.commit || '').slice(0, 9))}</td></tr>
${t.reason && !['DONE', 'ALREADY-DONE'].includes(t.status) ? `<tr><td></td><td colspan="9" class="note">${esc(t.reason)}</td></tr>` : ''}`).join('');
    return `<h2>Feature ${esc(f.feature)} ${badge(f.status === 'RUNNING' ? 'INCOMPLETE' : f.status)}</h2>
<dl class="kv"><dt>Branch</dt><dd class="mono">${esc(f.branch || '')}</dd><dt>Pull request</dt><dd>${prCell}</dd>${f.skippedReason ? `<dt>Skipped</dt><dd>${esc(f.skippedReason)}</dd>` : ''}${f.error ? `<dt>Error</dt><dd>${esc(f.error)}</dd>` : ''}</dl>
<h3>Tasks</h3><table><thead><tr><th>ID</th><th>Story</th><th>Comp.</th><th>Task</th><th>Status</th><th class="num">Tries</th><th>Verdict</th><th class="num">Time</th><th class="num">Cost</th><th>Commit</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="note">No tasks.</td></tr>'}</tbody></table>
<h3>Independent review</h3><table><thead><tr><th>Round</th><th>Reviewer</th><th>Verdict</th><th class="num">Crit</th><th class="num">High</th><th class="num">Med</th><th class="num">Low</th><th>Artifact</th></tr></thead><tbody>${rev}</tbody></table>${gate}`;
  }).join('');

  const errTasks = s.features.flatMap(f => f.tasks.filter(t => t.error && ['FAILED', 'BLOCKED'].includes(t.status)).map(t => ({ f, t })));
  const errors = (errTasks.length || s.errors.length) ? `<h2>Errors</h2>
${errTasks.map(({ f, t }) => `<h3>${esc(f.feature)} / ${esc(t.id)} ${badge(t.status)}</h3><pre>${esc(t.error)}</pre>`).join('')}
${s.errors.length ? `<h3>Runner errors</h3><table><thead><tr><th>Time</th><th>Where</th><th>Message</th></tr></thead><tbody>${s.errors.map(e => `<tr><td class="mono">${esc(when(e.t))}</td><td>${esc([e.feature, e.task, e.where].filter(Boolean).join(' / '))}</td><td>${esc(e.message)}</td></tr>`).join('')}</tbody></table>` : ''}`
    : '<h2>Errors</h2><p class="note">None recorded.</p>';

  const gaps = s.features.flatMap(f => f.tasks.filter(t => ['SKIPPED-HUMAN', 'BLOCKED', 'NOT-STARTED'].includes(t.status)).map(t => ({ f, t })));
  const gapHtml = `<h2>Not proven or not done</h2>${gaps.length ? `<table><thead><tr><th>Feature</th><th>Task</th><th>Status</th><th>Why</th></tr></thead><tbody>${gaps.map(({ f, t }) => `<tr><td>${esc(f.feature)}</td><td class="mono">${esc(t.id)}</td><td>${badge(t.status)}</td><td>${esc(t.reason || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Nothing outstanding.</p>'}
<p class="note">A green verdict means every acceptance criterion had an automated check that passed. MANUAL checks and human tasks are never counted as passed.</p>`;

  const act = nextActions(s);
  const actions = `<h2>Next actions</h2>${act.length ? `<ul class="act">${act.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="note">Nothing to do.</p>'}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autonomous run report ${esc(run.runId || '')}</title><style>${CSS}</style></head><body><main>
${header}${tiles}${featureHtml}${errors}${gapHtml}${actions}
<footer>Generated by ccs-report from the run ledger. No agent wrote this page. Task logs: .ccs/runs/${esc(run.runId || '')}/logs/</footer>
</main></body></html>`;
}
