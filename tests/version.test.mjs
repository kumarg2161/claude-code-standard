import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versions = readdirSync(join(root, 'plugins')).map(d => join(root, 'plugins', d, '.claude-plugin/plugin.json')).filter(existsSync)
  .map(f => ({ f, v: JSON.parse(readFileSync(f, 'utf8')).version }));

test('all plugins share one valid semver version', () => {
  assert.equal(versions.length, 4);
  for (const { f, v } of versions) assert.match(v, /^\d+\.\d+\.\d+$/, f);
  assert.equal(new Set(versions.map(x => x.v)).size, 1, `versions drifted: ${JSON.stringify(versions.map(x => x.v))}`);
});
test('CHANGELOG has a section for the current version and an Unreleased section', () => {
  const cl = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  assert.ok(cl.includes('## [Unreleased]'));
  assert.ok(cl.includes(`## [${versions[0].v}] - `), `CHANGELOG.md has no heading for ${versions[0].v}`);
});
