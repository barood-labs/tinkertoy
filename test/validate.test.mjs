import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateHtml } from '../lib/validate.mjs';
import { template } from './helpers.mjs';

const good = template();
const errs = html => validateHtml(html).errors.join('\n');

test('the shipped template passes with no errors', () => {
  const r = validateHtml(good);
  assert.deepEqual(r.errors, []);
  assert.ok(r.info.sliders >= 1);
});

test('rejects a plain page with no controls', () => {
  const r = validateHtml('<!doctype html><html><head><title>x</title><meta name="viewport" content="width=device-width"></head><body><p>hi</p></body></html>');
  const e = r.errors.join('\n');
  assert.match(e, /No parameter slider/);
  assert.match(e, /No scrub control/);
  assert.match(e, /No break button/);
  assert.match(e, /canvas/);
});

test('rejects external scripts, stylesheets, images and fonts', () => {
  assert.match(errs(good.replace('<script>', '<script src="https://cdn.example.com/x.js"></script><script>')), /External script/);
  assert.match(errs(good.replace('</head>', '<link rel="stylesheet" href="style.css"></head>')), /External resource: <link/);
  assert.match(errs(good.replace('</head>', '<link rel="preconnect" href="https://fonts.gstatic.com"></head>')), /External resource: <link/);
  assert.match(errs(good.replace('<main', '<img src="https://x.test/a.png"><main')), /External resource: <img/);
  assert.match(errs(good.replace('</style>', '@import url("https://fonts.googleapis.com/css?family=Inter");</style>')), /@import/);
  assert.match(errs(good.replace('</style>', 'body{background:url(bg.png)}</style>')), /url\(bg\.png\)/);
});

test('allows data: URIs', () => {
  const html = good.replace('<main', '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="1" height="1"><main');
  assert.deepEqual(validateHtml(html).errors, []);
});

test('rejects network APIs and module imports in script', () => {
  assert.match(errs(good.replace('Tinkertoy({', "fetch('/data.json');\nTinkertoy({")), /Network or worker API/);
  assert.match(errs(good.replace('Tinkertoy({', "new WebSocket('wss://x');\nTinkertoy({")), /Network or worker API/);
  assert.match(errs(good.replace('Tinkertoy({', "const m = import('./x.js');\nTinkertoy({")), /import/);
});

test('ignores URLs that only appear in HTML comments', () => {
  assert.deepEqual(validateHtml(good.replace('<main', '<!-- <script src="https://x.test/a.js"></script> --><main')).errors, []);
});

test('requires slider, scrub, break, play/step and a visual, one at a time', () => {
  assert.match(errs(good.replace(/<input type="range" id="arrive"[^>]*>/, '').replace(/<input type="range" id="serve"[^>]*>/, '')), /No parameter slider/);
  assert.match(errs(good.replace('id="scrub"', 'id="seek"')), /No scrub control/);
  assert.match(errs(good.replace('id="break"', 'id="oops"')), /No break button/);
  assert.match(errs(good.replace('id="play"', 'id="p"').replace('id="step"', 'id="s"')), /No play\/step/);
  assert.match(errs(good.replace(/<canvas[^>]*><\/canvas>/, '')), /canvas/);
});

test('the scrub slider alone does not count as a parameter slider', () => {
  const noParams = good.replace(/<input type="range" id="arrive"[^>]*>/, '').replace(/<input type="range" id="serve"[^>]*>/, '');
  assert.equal(validateHtml(noParams).info.sliders, 0);
});

test('requires title, viewport and html', () => {
  assert.match(errs(good.replace(/<title>[^<]*<\/title>/, '')), /title/);
  assert.match(errs(good.replace(/<meta name="viewport"[^>]*>/, '')), /viewport/);
  assert.match(errs('<div>fragment</div>'), /missing <html>/);
});

test('warns (not errors) on external links, missing window.tinkertoy and reduced motion', () => {
  const r = validateHtml(good.replace('<main', '<a href="https://example.org/docs">docs</a><main'));
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some(w => /External link/.test(w)));
  const r2 = validateHtml(good.replace(/window\.tinkertoy/g, 'window.other').replace(/prefers-reduced-motion/g, 'nope'));
  assert.ok(r2.warnings.some(w => /window\.tinkertoy/.test(w)));
  assert.ok(r2.warnings.some(w => /reduced-motion/.test(w)));
});

test('warns on a very large file', () => {
  const r = validateHtml(good.replace('</body>', `<!-- ${'x'.repeat(10)} --><script>/*${'y'.repeat(420 * 1024)}*/</script></body>`));
  assert.ok(r.warnings.some(w => /KB/.test(w)));
});
