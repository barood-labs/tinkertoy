// Loads every example in headless Chrome and drives the controls. Skipped when Chrome or playwright-core is missing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome } from '../lib/run.mjs';
import { root, manifest } from './helpers.mjs';

let chromium = null, browser = null;
const exe = findChrome();
const nodeMajor = Number(process.versions.node.split('.')[0]);
let skip = nodeMajor < 20 ? `Playwright needs Node 20+ (got ${process.versions.node})`
  : !exe ? 'Chrome not available'
  : false;
if (!skip) {
  try { ({ chromium } = await import('playwright-core')); }
  catch (e) { skip = 'playwright-core not available: ' + (e?.message || e); }
}
if (!skip && !chromium) skip = 'Chrome or playwright-core not available';

before(async () => { if (!skip) browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] }); });
after(async () => { if (browser) await browser.close(); });

async function open(file, size = { width: 1100, height: 900 }) {
  const page = await browser.newPage({ viewport: size });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) errors.push('network: ' + r.url()); });
  await page.goto(pathToFileURL(resolve(root, file)).href + '?autoplay=0');
  await page.waitForFunction(() => window.tinkertoy);
  return { page, errors };
}

for (const m of manifest()) {
  const file = `examples/${m.id}.html`;

  test(`${m.id}: loads with no console errors and makes no network requests`, { skip }, async () => {
    const { page, errors } = await open(file);
    try {
      const st = await page.evaluate(() => ({ steps: window.tinkertoy.steps, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] }));
      assert.ok(st.steps >= 5, 'has a timeline');
      assert.ok(st.canvas[0] > 100 && st.canvas[1] > 100, 'canvas has size');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test(`${m.id}: every slider changes the model, end to end, without NaN`, { skip }, async () => {
    const { page, errors } = await open(file);
    try {
      const res = await page.evaluate(() => {
        const t = window.tinkertoy, out = [];
        const sliders = [...document.querySelectorAll('input[data-param]')];
        for (const s of sliders) {
          const orig = s.value, sigs = [];
          for (const v of [s.min, s.max, orig]) { t.setParam(s.id, v); t.seek(t.steps - 1); sigs.push(JSON.stringify(t.frames().map(f => f.stats || f.msg))); t.seek(0.5); t.seek(t.steps * 0.5); }
          out.push({ id: s.id, nan: sigs.some(x => /NaN|undefined|Infinity/.test(x)), changed: sigs[0] !== sigs[1] || sigs[0] !== sigs[2] });
        }
        return out;
      });
      assert.ok(res.length >= 2, 'at least two sliders');
      for (const r of res) assert.equal(r.nan, false, `${r.id} produces NaN/undefined`);
      assert.ok(res.some(r => r.changed), 'moving sliders changes the output');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test(`${m.id}: scrubbing is deterministic and the break changes the outcome`, { skip }, async () => {
    const { page, errors } = await open(file);
    try {
      const r = await page.evaluate(() => {
        const t = window.tinkertoy, sig = () => JSON.stringify([t.state.frame.stats, t.state.frame.msg]);
        const n = t.steps, mid = Math.floor(n / 2);
        t.seek(mid); const a = sig(); t.seek(n - 1); t.seek(0); t.seek(mid); const b = sig();
        t.seek(n - 1); const normalEnd = sig(), normalFrames = t.frames().length;
        t.setBreak(true); t.seek(t.steps - 1); const brokenEnd = sig(), brokenState = t.state.broken;
        const badTone = JSON.stringify(t.frames().map(f => f.stats)).includes('"bad"') || t.frames().some(f => f.bad);
        t.setBreak(false); t.seek(t.steps - 1); const restored = sig();
        return { same: a === b, differs: normalEnd !== brokenEnd, brokenState, badTone, restored: restored === normalEnd, normalFrames };
      });
      assert.equal(r.same, true, 'same step gives same frame regardless of path');
      assert.equal(r.brokenState, true);
      assert.equal(r.differs, true, 'break changes the final state');
      assert.equal(r.badTone, true, 'break shows something going wrong');
      assert.equal(r.restored, true, 'un-breaking restores normal');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test(`${m.id}: real UI controls work (click break, step, scrub, play)`, { skip }, async () => {
    const { page, errors } = await open(file);
    try {
      await page.click('#step'); await page.click('#step');
      assert.ok((await page.evaluate(() => window.tinkertoy.state.i)) >= 1, 'step advances');
      await page.click('#break');
      assert.equal(await page.evaluate(() => window.tinkertoy.state.broken), true);
      assert.equal(await page.getAttribute('#break', 'aria-pressed'), 'true');
      await page.click('#break');
      assert.equal(await page.evaluate(() => window.tinkertoy.state.broken), false);
      await page.fill('#scrub', '3');
      assert.equal(await page.evaluate(() => Math.round(window.tinkertoy.state.pos)), 3);
      await page.click('#play'); await page.waitForTimeout(400);
      assert.ok(await page.evaluate(() => window.tinkertoy.state.pos > 3), 'play advances');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test(`${m.id}: a burst of slider input events is coalesced into one build per frame (latest value wins)`, { skip }, async () => {
    const { page, errors } = await open(file);
    try {
      const r = await page.evaluate(async () => {
        const t = window.tinkertoy, s = document.querySelector('input[data-param]');
        const min = +s.min, max = +s.max, before = t.builds;
        for (let k = 0; k < 50; k++) { s.value = String(min + ((max - min) * k) / 49); s.dispatchEvent(new Event('input', { bubbles: true })); }
        const sync = t.builds - before; // nothing built synchronously from input events
        await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const burst = t.builds - before;
        const lastValue = t.state.params[s.id];
        t.setParam(s.id, s.min); const afterSet = t.builds - before; // setParam stays synchronous
        return { sync, burst, lastValue, max, afterSet, readout: document.querySelector(`output[for="${s.id}"]`).textContent !== '' };
      });
      assert.equal(r.sync, 0, 'input events do not build synchronously');
      assert.equal(r.burst, 1, '50 input events -> exactly 1 build');
      assert.equal(r.lastValue, r.max, 'latest value wins');
      assert.equal(r.afterSet, r.burst + 1, 'setParam builds synchronously');
      assert.ok(r.readout, 'value readout is updated');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test(`${m.id}: build() is cheap (few frames, well under 16 ms)`, { skip }, async () => {
    const { page, errors } = await open(file);
    try {
      const r = await page.evaluate(() => {
        const t = window.tinkertoy; let worst = t.buildMs, frames = t.steps;
        for (const s of document.querySelectorAll('input[data-param]')) for (const v of [s.min, s.max]) { t.setParam(s.id, v); worst = Math.max(worst, t.buildMs); frames = Math.max(frames, t.steps); }
        return { worst, frames };
      });
      assert.ok(r.frames >= 5 && r.frames <= 200, `frames ${r.frames}`);
      assert.ok(r.worst < 16, `build took ${r.worst} ms`);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  test(`${m.id}: no horizontal page overflow at 390px wide`, { skip }, async () => {
    const { page, errors } = await open(file, { width: 390, height: 800 });
    try {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 1, `page overflows horizontally by ${over}px`);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('gallery loads with no errors and lists every example', { skip }, async () => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
  const hrefs = await page.$$eval('a[href^="examples/"]', as => as.map(a => a.getAttribute('href')));
  for (const m of manifest()) assert.ok(hrefs.includes(`examples/${m.id}.html`), m.id);
  assert.deepEqual(errors, []);
  await page.close();
});
