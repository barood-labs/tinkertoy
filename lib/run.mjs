// Optional browser check for `tinkertoy validate --run`. Needs playwright-core and a Chrome/Chromium binary.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function findChrome() {
  const c = [process.env.CHROME, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
  return c.find(p => p && existsSync(p)) || null;
}

async function loadPlaywright() {
  const req = createRequire(resolve(process.cwd(), 'noop.js'));
  for (const resolver of [() => req.resolve('playwright-core'), () => req.resolve('playwright'), () => createRequire(import.meta.url).resolve('playwright-core')]) {
    try { return await import(pathToFileURL(resolver()).href); } catch { /* try next */ }
  }
  return null;
}

/** Loads the file in headless Chrome, drives the controls, returns {skipped?, errors[], warnings[]}. */
export async function runInBrowser(file) {
  const pw = await loadPlaywright(), exe = findChrome();
  if (!pw || !exe) return { skipped: true, errors: [], warnings: [], reason: !pw ? 'playwright-core not found (npm i -D playwright-core)' : 'no Chrome/Chromium found (set CHROME=/path/to/chrome)' };
  const chromium = pw.chromium || pw.default?.chromium;
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const errors = [], warnings = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    page.on('pageerror', e => errors.push('page error: ' + e.message));
    page.on('console', m => m.type() === 'error' && errors.push('console error: ' + m.text()));
    page.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) errors.push('network request: ' + u.slice(0, 80)); });
    await page.goto(pathToFileURL(resolve(file)).href + '?autoplay=0');
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const out = [], warn = [];
      const sl = [...document.querySelectorAll('input[type=range]')].filter(i => i.id !== 'scrub');
      const scrub = document.getElementById('scrub'), brk = document.getElementById('break');
      if (scrub) { scrub.value = scrub.max; scrub.dispatchEvent(new Event('input', { bubbles: true })); scrub.value = scrub.min; scrub.dispatchEvent(new Event('input', { bubbles: true })); }
      // setParam rebuilds synchronously (real slider input events are coalesced to one build per frame), so every extreme really gets built and timed.
      const tt = window.tinkertoy, set = (s, v) => { if (tt && tt.setParam) tt.setParam(s.id, v); else { s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); } };
      let worstMs = 0, maxFrames = 0;
      const sample = () => { if (tt) { worstMs = Math.max(worstMs, tt.buildMs || 0); maxFrames = Math.max(maxFrames, tt.steps || 0); } };
      for (const s of sl) { const o = s.value; set(s, s.max); sample(); set(s, s.min); sample(); set(s, o); sample(); }
      if (brk) { brk.click(); sample(); brk.click(); }
      if (maxFrames > 200) warn.push(`build() produced ${maxFrames} frames; keep it to 20-120 so scrubbing and rebuilds stay snappy.`);
      if (worstMs > 16) warn.push(`build() took ${worstMs.toFixed(1)} ms at its slowest; target under ~5 ms so slider drags stay smooth.`);
      else if (worstMs > 5) warn.push(`build() took ${worstMs.toFixed(1)} ms at its slowest (target under ~5 ms).`);
      const c = document.querySelector('canvas');
      if (c && (!c.width || !c.height)) out.push('canvas has zero size');
      return { out, warn };
    });
    errors.push(...r.out); warnings.push(...r.warn);
    await page.waitForTimeout(150);
  } finally { await browser.close(); }
  return { skipped: false, errors, warnings };
}
