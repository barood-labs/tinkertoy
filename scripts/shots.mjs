// Screenshot + console-error check for every example. node scripts/shots.mjs [id...]
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(resolve(root, 'examples')).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5));
mkdirSync(resolve(root, 'docs/shots'), { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let bad = 0;
for (const id of ids) for (const [tag, w, h, brk] of [['', 1100, 900, false], ['-broken', 1100, 900, true], ['-mobile', 390, 900, false]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: tag === '-mobile' ? 2 : 1 });
  const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + resolve(root, `examples/${id}.html`) + '?autoplay=0');
  await p.waitForFunction(() => window.tinkertoy);
  await p.evaluate(brk => { if (brk) window.tinkertoy.setBreak(true); window.tinkertoy.seek(window.tinkertoy.steps - 1); }, brk);
  await p.waitForTimeout(100);
  await p.screenshot({ path: resolve(root, `docs/shots/${id}${tag}.png`), fullPage: true });
  if (tag === '') await p.locator('#stagewrap').screenshot({ path: resolve(root, `docs/shots/${id}-stage.png`) });
  if (tag === '-broken') await p.locator('#stagewrap').screenshot({ path: resolve(root, `docs/shots/${id}-stage-broken.png`) });
  if (errs.length) { bad++; console.log(id + tag, 'ERRORS', errs); }
  await p.close();
}
await b.close(); console.log(bad ? 'FAILED' : 'all clean', ids.length, 'examples');
