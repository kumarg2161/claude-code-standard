#!/usr/bin/env node
// Render the HTML status report for a run.
//   node ccs-report.mjs [--run <runId>|--ledger <path>] [--repo <root>] [--out <dir>]
// Defaults: latest run under <repo>/.ccs/runs, output <repo>/ccs-reports/<runId>.html + latest.html
import { writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { readLedger } from './lib/ledger.mjs';
import { renderReport } from './lib/report.mjs';

export function writeReport({ ledgerPath, outDir }) {
  const events = readLedger(ledgerPath);
  const runId = events.find(e => e.ev === 'run_start')?.runId || basename(dirname(ledgerPath));
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${runId}.html`);
  writeFileSync(file, renderReport(events));
  copyFileSync(file, join(outDir, 'latest.html'));
  return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const opt = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  const repo = resolve(opt('--repo') || process.cwd());
  let ledger = opt('--ledger');
  if (!ledger) {
    const runs = join(repo, '.ccs/runs');
    const id = opt('--run') || (existsSync(runs) ? readdirSync(runs).sort().pop() : null);
    if (!id) { console.error('no runs found under .ccs/runs'); process.exit(2); }
    ledger = join(runs, id, 'ledger.jsonl');
  }
  if (!existsSync(ledger)) { console.error(`ledger not found: ${ledger}`); process.exit(2); }
  console.log(writeReport({ ledgerPath: resolve(ledger), outDir: resolve(opt('--out') || join(repo, 'ccs-reports')) }));
}
