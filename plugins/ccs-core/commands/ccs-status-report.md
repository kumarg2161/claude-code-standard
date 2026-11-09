---
description: Regenerate the HTML status report from a run ledger (default: the latest run) and show its summary.
argument-hint: [run-id]
---

Regenerate the status report for: $ARGUMENTS

1. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/ccs-report.mjs"` (add `--run <run-id>` if given). It prints the absolute path of the HTML file it wrote
   (`ccs-reports/<run-id>.html` and `latest.html`). Runs are listed in `.ccs/runs/`.
2. Read the ledger (`.ccs/runs/<run-id>/ledger.jsonl`) and give a five-line summary: outcome and stop reason, spend vs budget,
   tasks DONE / FAILED / BLOCKED / human / not started, PR links, and what needs a human first.
3. Say the file path so the user can open it. The report is generated from the ledger by code; do not edit it and do not restate
   anything that is not in the ledger.
