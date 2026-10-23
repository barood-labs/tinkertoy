// `tinkertoy init`: copy the skill into the places coding agents look for skills,
// and add an idempotent snippet to AGENTS.md.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL_SRC = join(PKG_ROOT, 'skill');
const START = '<!-- tinkertoy:start -->', END = '<!-- tinkertoy:end -->';

// target id -> skill directory (relative to the base dir)
export const TARGETS = {
  claude: '.claude/skills/tinkertoy',
  agents: '.agents/skills/tinkertoy', // Codex and Cursor both read .agents/skills
  cursor: '.cursor/skills/tinkertoy',
};
const DEFAULT_TARGETS = ['claude', 'agents'];

export function snippet() {
  return readFileSync(join(SKILL_SRC, 'AGENTS.snippet.md'), 'utf8').trim();
}

/** Insert or replace the marked block in AGENTS.md. Returns 'created' | 'updated' | 'unchanged'. */
export function writeAgentsMd(file) {
  const block = `${START}\n${snippet()}\n${END}\n`;
  if (!existsSync(file)) { writeFileSync(file, block); return 'created'; }
  const cur = readFileSync(file, 'utf8');
  const a = cur.indexOf(START), b = cur.indexOf(END);
  let next;
  if (a !== -1 && b > a) next = cur.slice(0, a) + block.trimEnd() + cur.slice(b + END.length);
  else next = cur.replace(/\s*$/, '') + (cur.trim() ? '\n\n' : '') + block;
  if (next === cur) return 'unchanged';
  writeFileSync(file, next);
  return 'updated';
}

/**
 * @param {{dir?: string, global?: boolean, only?: string[], cursor?: boolean, agentsMd?: boolean, dryRun?: boolean}} o
 * @returns {{actions: string[]}}
 */
export function init(o = {}) {
  const base = resolve(o.global ? homedir() : o.dir || process.cwd());
  let ids = o.only && o.only.length ? o.only : [...DEFAULT_TARGETS];
  if (o.cursor && !ids.includes('cursor')) ids.push('cursor');
  const bad = ids.filter(i => !TARGETS[i]);
  if (bad.length) throw new Error(`Unknown target "${bad[0]}". Choose from: ${Object.keys(TARGETS).join(', ')}.`);
  const actions = [];
  for (const id of ids) {
    const dest = join(base, TARGETS[id]);
    const existed = existsSync(join(dest, 'SKILL.md'));
    if (!o.dryRun) { mkdirSync(dest, { recursive: true }); cpSync(SKILL_SRC, dest, { recursive: true, filter: p => !p.endsWith('AGENTS.snippet.md') }); }
    actions.push(`${existed ? 'updated' : 'installed'} skill → ${TARGETS[id]}`);
  }
  const wantMd = o.agentsMd !== false && !o.global;
  if (wantMd) {
    const f = join(base, 'AGENTS.md');
    const r = o.dryRun ? (existsSync(f) ? 'would update' : 'would create') : writeAgentsMd(f);
    actions.push(`${r} AGENTS.md`);
  }
  return { actions, base };
}
