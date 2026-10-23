// tinkertoy validator: static checks on a single-file HTML simulation.
// Zero dependencies. `--run` mode (browser check) is in lib/run.mjs and is optional.
import { readFileSync, statSync } from 'node:fs';

const MAX_WARN_BYTES = 400 * 1024;

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
}

const isExternal = u => /^\s*(?:https?:)?\/\//i.test(u) || /^\s*(?:ftp|wss?):/i.test(u);
const isLocalRef = u => !!u && !/^\s*(?:#|data:|blob:|javascript:|mailto:|about:)/i.test(u) && !isExternal(u);

/**
 * @param {string} html
 * @returns {{errors: string[], warnings: string[], info: {bytes:number, sliders:number}}}
 */
export function validateHtml(html) {
  const errors = [], warnings = [];
  const bytes = Buffer.byteLength(html);
  const src = stripComments(html);
  const scripts = [...src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const styles = [...src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  const code = scripts.map(m => m[2]).join('\n');
  const css = styles.map(m => m[1]).join('\n') + ' ' + [...src.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map(m => m[1]).join(' ');

  // 1. a complete document
  if (!/<html[\s>]/i.test(src)) errors.push('Not a complete HTML document: missing <html>.');
  if (!/<title>[^<]+<\/title>/i.test(src)) errors.push('Missing a non-empty <title>.');
  if (!/<meta[^>]+name=["']viewport["']/i.test(src)) errors.push('Missing <meta name="viewport"> (needed for mobile).');

  // 2. single file: no external or local-file resources
  for (const m of src.matchAll(/<script\b([^>]*)>/gi)) {
    const s = attr(m[0], 'src');
    if (s !== null) errors.push(`External script: <script src="${s}">. Inline all JavaScript.`);
  }
  for (const m of src.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(m[0], 'rel') || '').toLowerCase(), href = attr(m[0], 'href') || '';
    if (/stylesheet|preload|prefetch|modulepreload|preconnect|dns-prefetch|icon/.test(rel) && !/^\s*data:/i.test(href)) errors.push(`External resource: <link rel="${rel}" href="${href}">. Inline all CSS.`);
  }
  for (const m of src.matchAll(/<(img|iframe|embed|source|video|audio|track|object)\b[^>]*>/gi)) {
    for (const a of ['src', 'srcset', 'data', 'poster']) {
      const v = attr(m[0], a);
      if (v && !/^\s*(data:|blob:|#)/i.test(v)) errors.push(`External resource: <${m[1]} ${a}="${v.slice(0, 60)}">. Draw on a canvas/SVG or use a data: URI.`);
    }
  }
  if (/@import\b/i.test(css)) errors.push('CSS @import found. Inline all CSS.');
  for (const m of css.matchAll(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi)) {
    if (!/^\s*(data:|#)/i.test(m[2])) errors.push(`CSS url(${m[2].slice(0, 60)}) is not a data: URI.`);
  }
  if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\s*\(/.test(code) || /new\s+(WebSocket|EventSource|XMLHttpRequest|Worker|SharedWorker)\b/.test(code)) errors.push('Network or worker API used in script (fetch/XHR/WebSocket/Worker/...). Sims must run offline.');
  if (/\bimport\s*\(|^\s*import\s[^;]*\sfrom\s+['"]/m.test(code)) errors.push('JavaScript module import found. Inline everything.');

  // 3. controls
  const inputs = [...src.matchAll(/<input\b[^>]*>/gi)].map(m => m[0]);
  const ranges = inputs.filter(t => (attr(t, 'type') || '').toLowerCase() === 'range');
  const scrub = ranges.find(t => attr(t, 'id') === 'scrub');
  const sliders = ranges.filter(t => attr(t, 'id') !== 'scrub');
  if (!sliders.length) errors.push('No parameter slider: need at least one <input type="range"> besides #scrub, so the reader can change an input.');
  if (!scrub) errors.push('No scrub control: need <input type="range" id="scrub"> so the reader can drag through the timeline.');
  const btn = id => new RegExp(`<button\\b[^>]*\\sid=["']${id}["']`, 'i').test(src);
  if (!btn('break')) errors.push('No break button: need <button id="break"> that triggers a failure mode.');
  else if (!/id=["']break["'][^>]*>\s*[^<\s]/i.test(src)) warnings.push('The #break button has no visible label.');
  if (!btn('play') && !btn('step')) errors.push('No play/step controls: need <button id="play"> and/or <button id="step">.');
  if (!/<canvas\b|<svg\b/i.test(src)) errors.push('No <canvas> or <svg> found: a sim needs a visual.');

  // 4. warnings
  for (const m of src.matchAll(/<a\b[^>]*>/gi)) {
    const h = attr(m[0], 'href');
    if (h && isExternal(h) && !/github\.com\/barood-labs\/tinkertoy/i.test(h)) warnings.push(`External link <a href="${h.slice(0, 70)}">: fine for navigation, but the sim itself must not depend on it.`);
    else if (h && !isExternal(h) && isLocalRef(h) && !/^\s*\.\.?\//.test(h) && h !== '') warnings.push(`Link to a local file <a href="${h}"> will break if the file is moved.`);
  }
  const prose = src.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<a\b[^>]*>/gi, '<a>');
  const mentions = prose.match(/https?:\/\/[^\s"'<)]+/g);
  if (mentions) warnings.push(`URL text in the page (${mentions.slice(0, 2).join(', ')}): make sure it's not something the page tries to load.`);
  if (bytes > MAX_WARN_BYTES) warnings.push(`File is ${(bytes / 1024).toFixed(0)} KB (over ${MAX_WARN_BYTES / 1024} KB). Trim it; a sim should be small.`);
  if (!/window\.tinkertoy\b/.test(code)) warnings.push('window.tinkertoy is not set: automated checks (and the browser test) can\'t drive this sim.');
  if (!/prefers-reduced-motion/.test(css + code)) warnings.push('No prefers-reduced-motion handling: autoplay should be skipped for those users.');
  if (!/aria-label|aria-labelledby|<label\b/i.test(src)) warnings.push('No aria-label or <label>: add labels to sliders and the canvas for screen readers.');
  const unlabeled = sliders.filter(t => { const id = attr(t, 'id'); return !attr(t, 'aria-label') && !(id && new RegExp(`<label[^>]*for=["']${id}["']`, 'i').test(src)); });
  if (unlabeled.length) warnings.push(`${unlabeled.length} slider(s) have no <label for> or aria-label.`);

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], info: { bytes, sliders: sliders.length } };
}

export function validateFile(path) {
  let st;
  try { st = statSync(path); } catch { return { errors: [`File not found: ${path}`], warnings: [], info: { bytes: 0, sliders: 0 } }; }
  if (!st.isFile()) return { errors: [`Not a file: ${path}`], warnings: [], info: { bytes: 0, sliders: 0 } };
  return validateHtml(readFileSync(path, 'utf8'));
}
