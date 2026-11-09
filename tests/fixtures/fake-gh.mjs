#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const a = process.argv.slice(2);
appendFileSync(process.env.FAKE_GH_LOG || '/dev/null', JSON.stringify(a) + '\n');
if (a[0] === 'pr' && a[1] === 'create') { console.log('https://github.com/acme/demo/pull/42'); process.exit(Number(process.env.FAKE_GH_FAIL || 0)); }
process.exit(0);
