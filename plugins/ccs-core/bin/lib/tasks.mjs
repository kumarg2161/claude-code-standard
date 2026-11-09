// Parser for specs/<feature>/tasks.md. Shared by ccs-run, ccs-lint and ccs-report.
// Format is documented in templates/tasks.md. Zero dependencies (Node >= 20).

const TASK_RE = /^- \[( |x|X)\] (T\d{3,})\s+(.*)$/;
const AC_RE = /^AC:\s*(AC-[\w.]+)\s*(\(negative\))?\s*(.*?)\s*\|\s*check:\s*(.+?)\s*$/i;
const TAG_RE = /^\[([^\]]+)\]\s*/;

export function parseTasks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tasks = [];
  let phase = '';
  let cur = null;
  const problems = [];

  const flush = () => { if (cur) tasks.push(cur); cur = null; };

  lines.forEach((raw, i) => {
    const n = i + 1;
    const h = raw.match(/^##\s+(Phase[^\n]*)$/);
    if (h) { flush(); phase = h[1].trim(); return; }
    if (/^#{1,3}\s/.test(raw) && !raw.startsWith('## Phase')) { if (!/^#{3,}\s/.test(raw)) flush(); return; }

    const t = raw.match(TASK_RE);
    if (t) {
      flush();
      let rest = t[3];
      const tags = [];
      let m;
      while ((m = rest.match(TAG_RE))) { tags.push(m[1]); rest = rest.slice(m[0].length); }
      const story = tags.find(x => /^US\d+$/i.test(x)) || null;
      const kind = tags.find(x => ['setup', 'found', 'polish'].includes(x.toLowerCase())) || null;
      const parallel = tags.some(x => x.toUpperCase() === 'P');
      const component = tags.find(x =>
        !/^US\d+$/i.test(x) && x.toUpperCase() !== 'P' && !['setup', 'found', 'polish'].includes(x.toLowerCase())) || null;
      cur = {
        id: t[2], done: t[1].toLowerCase() === 'x', story, kind, component, parallel,
        title: rest.trim(), acs: [], deps: [], autonomy: null, reason: null, phase, line: n,
      };
      return;
    }

    if (cur && /^\s{2,}\S/.test(raw)) {
      const s = raw.trim();
      if (/^AC:/i.test(s)) {
        const a = s.match(AC_RE);
        if (a) cur.acs.push({ id: a[1], negative: !!a[2], text: a[3].trim(), check: a[4].trim() });
        else problems.push({ line: n, msg: `unparseable AC line (need "AC: AC-n.m [(negative)] text | check: cmd"): ${s.slice(0, 80)}` });
        return;
      }
      const d = s.match(/deps:\s*(.*?)(?=\s{2,}autonomy:|\s+autonomy:|$)/i);
      if (d) cur.deps = d[1].trim().toLowerCase() === 'none' || d[1].trim() === ''
        ? [] : d[1].split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      const a = s.match(/autonomy:\s*(auto|human)\b(?:\s*\(reason:\s*(.*?)\))?/i);
      if (a) { cur.autonomy = a[1].toLowerCase(); cur.reason = a[2] ? a[2].trim() : null; }
      return;
    }
    if (cur && raw.trim() === '') return; // blank line inside a task block is allowed
    if (cur && !/^\s/.test(raw)) flush();
  });
  flush();
  return { tasks, problems };
}

// Next runnable task: pending, autonomy:auto, every dep done, in file order.
export function nextRunnable(tasks, { skip = new Set() } = {}) {
  const done = new Set(tasks.filter(t => t.done).map(t => t.id));
  return tasks.find(t =>
    !t.done && !skip.has(t.id) && t.autonomy === 'auto' && t.deps.every(d => done.has(d))) || null;
}

// Tasks that can never run in this cycle, with the reason (feeds the report).
export function classifyBlocked(tasks, { failed = new Set() } = {}) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const out = [];
  for (const t of tasks) {
    if (t.done) continue;
    if (t.autonomy === 'human') { out.push({ id: t.id, status: 'SKIPPED-HUMAN', reason: t.reason || 'marked autonomy: human' }); continue; }
    const bad = t.deps.find(d => failed.has(d) || (byId.get(d) && byId.get(d).autonomy === 'human' && !byId.get(d).done));
    if (bad) out.push({ id: t.id, status: 'NOT-STARTED', reason: `depends on ${bad}, which is not done` });
  }
  return out;
}

export function hasCycle(tasks) {
  const g = new Map(tasks.map(t => [t.id, t.deps]));
  const state = new Map();
  const visit = (id, path) => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...path, id];
    state.set(id, 1);
    for (const d of g.get(id) || []) { if (!g.has(d)) continue; const c = visit(d, [...path, id]); if (c) return c; }
    state.set(id, 2);
    return null;
  };
  for (const id of g.keys()) { const c = visit(id, []); if (c) return c; }
  return null;
}
