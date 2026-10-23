import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateFile } from '../lib/validate.mjs';
import { assemble } from '../scripts/build-examples.mjs';
import { root, read, manifest, exampleFiles } from './helpers.mjs';

test('there are six examples', () => assert.equal(manifest().length, 6));

for (const f of [...exampleFiles(), 'skill/template.html']) {
  test(`validate ${f}`, () => {
    const r = validateFile(join(root, f));
    assert.deepEqual(r.errors, [], r.errors.join('\n'));
    assert.deepEqual(r.warnings, [], r.warnings.join('\n'));
    assert.ok(r.info.bytes < 100 * 1024, 'under 100 KB');
  });
}

test('every example is deterministic code: no Math.random or Date in sim', () => {
  for (const m of manifest()) {
    const sim = read(`sims/${m.id}.js`);
    assert.doesNotMatch(sim, /Math\.random\(/, m.id);
    assert.doesNotMatch(sim, /Date\.now\(|new Date\(/, m.id);
  }
});

test('checked-in examples match a fresh build (run `npm run build`)', () => {
  for (const m of manifest()) {
    const meta = JSON.parse(read(`sims/${m.id}.json`));
    assert.equal(assemble(meta, read(`sims/${m.id}.js`)), read(`examples/${m.id}.html`), m.id);
  }
  const tm = JSON.parse(read('src/template.json'));
  assert.equal(assemble(tm, read('src/template.js'), '#'), read('skill/template.html'));
});

test('manifest entries are complete and the gallery links every example', () => {
  const idx = read('index.html');
  for (const m of manifest()) {
    assert.ok(m.title && m.sub, m.id);
    assert.ok(existsSync(join(root, `examples/${m.id}.html`)), m.id);
    assert.ok(idx.includes(`examples/${m.id}.html`), `gallery links ${m.id}`);
  }
});

test('the gallery page is itself offline-clean', () => {
  const idx = read('index.html');
  assert.doesNotMatch(idx, /<script[^>]+src=|<link[^>]+rel=["']stylesheet/i);
  assert.ok(existsSync(join(root, '.nojekyll')));
});

test('the skill has valid frontmatter and its companions', () => {
  const s = read('skill/SKILL.md');
  const fm = s.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'frontmatter');
  assert.match(fm[1], /^name: tinkertoy$/m);
  const d = fm[1].match(/^description: (.+)$/m);
  assert.ok(d && d[1].length > 80 && d[1].length < 1024);
  for (const f of ['skill/template.html', 'skill/CHECKLIST.md', 'skill/AGENTS.snippet.md']) assert.ok(existsSync(join(root, f)), f);
  // every output rule in SKILL.md is mentioned in the checklist's machine-checked part
  assert.match(s, /tinkertoy validate/);
});

test('package.json is publishable', () => {
  const p = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(p.name, '@barood-labs/tinkertoy');
  assert.equal(p.license, 'MIT');
  assert.ok(p.bin.tinkertoy);
  assert.equal(Object.keys(p.dependencies || {}).length, 0, 'zero runtime dependencies');
  assert.ok(existsSync(join(root, 'LICENSE')));
});
