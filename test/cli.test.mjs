import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root, template } from './helpers.mjs';

const bin = join(root, 'cli/tinkertoy.mjs');
const run = (args, opts = {}) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', ...(opts.env || {}) }, cwd: opts.cwd });
const tmp = () => mkdtempSync(join(tmpdir(), 'tinkertoy-'));

test('--help and --version', () => {
  const h = run(['--help']);
  assert.equal(h.status, 0);
  assert.match(h.stdout, /tinkertoy init/);
  assert.match(h.stdout, /tinkertoy validate/);
  assert.match(run(['--version']).stdout, /^\d+\.\d+\.\d+/);
});

test('unknown command exits 2', () => assert.equal(run(['nope']).status, 2));

test('init installs the skill for Claude Code and Codex/Cursor plus AGENTS.md', () => {
  const d = tmp();
  try {
    const r = run(['init', '--dir', d]);
    assert.equal(r.status, 0, r.stderr);
    for (const base of ['.claude/skills/tinkertoy', '.agents/skills/tinkertoy']) {
      for (const f of ['SKILL.md', 'template.html', 'CHECKLIST.md']) assert.ok(existsSync(join(d, base, f)), `${base}/${f}`);
      assert.ok(!existsSync(join(d, base, 'AGENTS.snippet.md')), 'snippet is not copied into the skill');
    }
    assert.ok(!existsSync(join(d, '.cursor')), 'cursor dir only with --cursor');
    const md = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    assert.match(md, /tinkertoy:start/);
    assert.match(md, /Explain with a tinkertoy/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('init --cursor adds .cursor/skills', () => {
  const d = tmp();
  try {
    assert.equal(run(['init', '--dir', d, '--cursor']).status, 0);
    assert.ok(existsSync(join(d, '.cursor/skills/tinkertoy/SKILL.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('init --only and --no-agents-md', () => {
  const d = tmp();
  try {
    assert.equal(run(['init', '--dir', d, '--only', 'claude', '--no-agents-md']).status, 0);
    assert.ok(existsSync(join(d, '.claude/skills/tinkertoy/SKILL.md')));
    assert.ok(!existsSync(join(d, '.agents')));
    assert.ok(!existsSync(join(d, 'AGENTS.md')));
    assert.equal(run(['init', '--dir', d, '--only', 'bogus']).status, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('init is idempotent and preserves existing AGENTS.md content', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'AGENTS.md'), '# My project\n\nBe nice.\n');
    run(['init', '--dir', d]);
    const first = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    run(['init', '--dir', d]);
    run(['init', '--dir', d]);
    const again = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    assert.equal(again, first);
    assert.match(again, /^# My project\n\nBe nice\./);
    assert.equal((again.match(/tinkertoy:start/g) || []).length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('init --global writes to HOME and skips AGENTS.md', () => {
  const d = tmp();
  try {
    const r = run(['init', '--global'], { env: { HOME: d, USERPROFILE: d } });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(d, '.claude/skills/tinkertoy/SKILL.md')));
    assert.ok(!existsSync(join(d, 'AGENTS.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('init --dry-run writes nothing', () => {
  const d = tmp();
  try {
    assert.equal(run(['init', '--dir', d, '--dry-run']).status, 0);
    assert.ok(!existsSync(join(d, '.claude')) && !existsSync(join(d, 'AGENTS.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('the installed skill is identical to the packaged one', () => {
  const d = tmp();
  try {
    run(['init', '--dir', d]);
    assert.equal(readFileSync(join(d, '.claude/skills/tinkertoy/SKILL.md'), 'utf8'), readFileSync(join(root, 'skill/SKILL.md'), 'utf8'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('validate: exit 0 on a good file, 1 on a bad one, 2 on no args', () => {
  const d = tmp();
  try {
    const good = join(d, 'good.html'), bad = join(d, 'bad.html');
    writeFileSync(good, template());
    writeFileSync(bad, '<!doctype html><html><head><title>t</title><meta name="viewport" content="width=device-width"><script src="https://cdn.example.com/a.js"></script></head><body></body></html>');
    assert.equal(run(['validate', good]).status, 0);
    const b = run(['validate', bad]);
    assert.equal(b.status, 1);
    assert.match(b.stdout, /External script/);
    assert.equal(run(['validate', good, bad]).status, 1);
    assert.equal(run(['validate']).status, 2);
    assert.equal(run(['validate', join(d, 'missing.html')]).status, 1);
    const j = JSON.parse(run(['validate', '--json', good]).stdout);
    assert.equal(j[0].ok, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('validate --strict fails on warnings', () => {
  const d = tmp();
  try {
    const f = join(d, 'w.html');
    writeFileSync(f, template().replace(/window\.tinkertoy/g, 'window.other'));
    assert.equal(run(['validate', f]).status, 0);
    assert.equal(run(['validate', '--strict', f]).status, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
