// usage: node scripts/shot.mjs <file.html> <out.png> [w h] [hash]
import { chromium } from 'playwright-core';
const [file, out, w = 1000, h = 900, hash = ''] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + file + '?autoplay=0' + hash);
await p.waitForFunction(() => window.tinkertoy);
await p.evaluate(() => window.tinkertoy.seek(window.tinkertoy.steps * 0.6));
await p.screenshot({ path: out, fullPage: true });
console.log('errors', errs); await b.close();
