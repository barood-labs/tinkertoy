#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, TARGETS } from '../lib/init.mjs';
import { validateFile } from '../lib/validate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = s => c(31, s), green = s => c(32, s), yellow = s => c(33, s), dim = s => c(2, s), bold = s => c(1, s);

const HELP = `${bold('tinkertoy')} ${pkg.version}: make your coding agent answer "how does X work" with a playable simulation

Usage
  tinkertoy init [options]            install the skill for your coding agents
  tinkertoy validate <file.html>...   check a generated sim against the rules
  tinkertoy --help | --version

init options
  --cursor            also install into .cursor/skills
  --only <a,b>        only these targets (${Object.keys(TARGETS).join(', ')})
  --global            install into your home directory (no AGENTS.md)
  --dir <path>        install into <path> instead of the current directory
  --no-agents-md      don't touch AGENTS.md
  --dry-run           show what would happen

validate options
  --run               also load it in headless Chrome (needs playwright-core) and fail on console errors
  --strict            treat warnings as errors
  --json              machine-readable output

Default init targets: .claude/skills/tinkertoy, .agents/skills/tinkertoy (Codex + Cursor) and an AGENTS.md snippet.
`;

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') o.only = (argv[++i] || '').split(',').filter(Boolean);
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').filter(Boolean);
    else if (a === '--dir') o.dir = argv[++i];
    else if (a.startsWith('--dir=')) o.dir = a.slice(6);
    else if (a === '--no-agents-md') o.agentsMd = false;
    else if (a.startsWith('--')) o[a.slice(2)] = true;
    else o._.push(a);
  }
  return o;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') { process.stdout.write(HELP); return 0; }
  if (cmd === '--version' || cmd === '-v') { console.log(pkg.version); return 0; }
  const o = parse(rest);

  if (cmd === 'init') {
    try {
      const { actions, base } = init({ dir: o.dir, global: !!o.global, only: o.only, cursor: !!o.cursor, agentsMd: o.agentsMd, dryRun: !!o['dry-run'] });
      console.log(bold(o['dry-run'] ? 'tinkertoy init (dry run)' : 'tinkertoy init') + dim('  ' + base));
      for (const a of actions) console.log('  ' + green('✓') + ' ' + a);
      console.log('\nNow ask your agent: ' + bold('"how does a hash table resize? make me a tinkertoy"'));
      return 0;
    } catch (e) { console.error(red('error: ') + e.message); return 2; }
  }

  if (cmd === 'validate') {
    if (!o._.length) { console.error(red('error: ') + 'give at least one .html file\n\n' + HELP); return 2; }
    let bad = 0; const results = [];
    for (const f of o._) {
      const r = validateFile(f);
      if (o.run && !r.errors.length) { const { runInBrowser } = await import('../lib/run.mjs'); const b = await runInBrowser(f); if (b.skipped) r.warnings.push('--run skipped: ' + b.reason); else { r.errors.push(...b.errors); r.warnings.push(...(b.warnings || [])); } }
      const fail = r.errors.length > 0 || (o.strict && r.warnings.length > 0);
      if (fail) bad++;
      results.push({ file: f, ok: !fail, ...r });
      if (!o.json) {
        console.log((fail ? red('✗ ') : green('✓ ')) + bold(f) + dim(`  ${(r.info.bytes / 1024).toFixed(1)} KB, ${r.info.sliders} slider${r.info.sliders === 1 ? '' : 's'}`));
        for (const e of r.errors) console.log('    ' + red('error  ') + e);
        for (const w of r.warnings) console.log('    ' + yellow('warn   ') + w);
      }
    }
    if (o.json) console.log(JSON.stringify(results, null, 2));
    else if (results.length > 1) console.log(`\n${results.length - bad}/${results.length} passed`);
    return bad ? 1 : 0;
  }

  console.error(red('error: ') + `unknown command "${cmd}"\n\n` + HELP);
  return 2;
}

main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => { console.error(e); process.exitCode = 2; });
