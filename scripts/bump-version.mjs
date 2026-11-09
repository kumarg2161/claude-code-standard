#!/usr/bin/env node
// Bump the lockstep version of all plugins and cut the CHANGELOG section.
//   node scripts/bump-version.mjs patch|minor|major|X.Y.Z [--dry-run]
// Updates plugins/*/.claude-plugin/plugin.json and moves "## [Unreleased]" content under the new version.
// Does NOT run git. Review `git diff`, then commit and tag (see README "Releasing").
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2]; const dry = process.argv.includes('--dry-run');
if (!arg) { console.error('usage: bump-version.mjs patch|minor|major|X.Y.Z [--dry-run]'); process.exit(2); }

const manifests = readdirSync(join(root, 'plugins')).map(d => join(root, 'plugins', d, '.claude-plugin/plugin.json')).filter(existsSync);
const cur = new Set(manifests.map(f => JSON.parse(readFileSync(f, 'utf8')).version));
if (cur.size !== 1) { console.error(`plugin versions are out of sync: ${[...cur].join(', ')}. Fix them first.`); process.exit(1); }
const [maj, min, pat] = [...cur][0].split('.').map(Number);
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : ({ major: `${maj + 1}.0.0`, minor: `${maj}.${min + 1}.0`, patch: `${maj}.${min}.${pat + 1}` }[arg]);
if (!next) { console.error(`bad bump: ${arg}`); process.exit(2); }
if (next === [...cur][0]) { console.error(`already at ${next}`); process.exit(1); }

const clPath = join(root, 'CHANGELOG.md'); const cl = readFileSync(clPath, 'utf8');
const m = cl.match(/## \[Unreleased\]\n([\s\S]*?)(?=\n## \[)/);
if (!m || !m[1].trim()) { console.error('CHANGELOG.md has an empty [Unreleased] section. Describe the changes before releasing.'); process.exit(1); }
const date = new Date().toISOString().slice(0, 10);
const newCl = cl.replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${next}] - ${date}\n`)
  .replace(/\[Unreleased\]: (\S+)\/compare\/v[\d.]+\.\.\.HEAD/, `[Unreleased]: $1/compare/v${next}...HEAD`)
  .replace(/(\[Unreleased\]:.*\n)/, `$1[${next}]: ${(cl.match(/\[Unreleased\]: (\S+)\/compare/) || [, 'https://github.com/OWNER/REPO'])[1]}/compare/v${[...cur][0]}...v${next}\n`);

console.log(`${[...cur][0]} -> ${next}  (${manifests.length} plugins)${dry ? '  [dry run]' : ''}`);
if (dry) process.exit(0);
for (const f of manifests) { const j = JSON.parse(readFileSync(f, 'utf8')); j.version = next; writeFileSync(f, JSON.stringify(j, null, 2) + '\n'); }
writeFileSync(clPath, newCl);
console.log(`Next: git diff && git commit -am "chore(release): v${next}" && git tag -a v${next} -m "v${next}"`);
