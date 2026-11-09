// Append-only JSONL ledger. Sync appends so a crash or kill never loses recorded events.
// The ledger, not the model, is the source of truth for the status report.
import { appendFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export class Ledger {
  constructor(path) { this.path = path; mkdirSync(dirname(path), { recursive: true }); }
  add(ev, data = {}) {
    const rec = { t: new Date().toISOString(), ev, ...data };
    appendFileSync(this.path, JSON.stringify(rec) + '\n');
    return rec;
  }
}

// Tolerates a truncated final line (process killed mid-write).
export function readLedger(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* partial line */ }
  }
  return out;
}
