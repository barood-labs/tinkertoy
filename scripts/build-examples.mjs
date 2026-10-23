// Assembles examples/*.html (and skill/template.html) from src/shell.html + runtime + sims/<id>.{json,js}.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => readFileSync(resolve(root, f), 'utf8');
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const shell = rd('src/shell.html'), css = rd('src/runtime.css').trim(), runtime = rd('src/runtime.js').trim();

export function assemble(meta, sim, backlink = '../index.html') {
  const params = meta.params.map(p => `      <div class="param">
        <label for="${p.id}">${p.label}</label><output for="${p.id}"></output>
        <input type="range" id="${p.id}" data-param min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}">
      </div>`).join('\n');
  const learn = meta.learn.map(l => `      <li>${l}</li>`).join('\n');
  const map = { TITLE: meta.title, SUB: meta.sub, ARIA: esc(meta.aria), PARAMS: params, BREAK_LABEL: meta.breakLabel, BREAK_OFF: meta.breakOff, LEARN: learn, CSS: css, RUNTIME: runtime, SIM: sim.trim(), BACKLINK: backlink };
  let out = shell.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k]);
  if (backlink === '#') out = out.replace(/\s*<a class="back"[^>]*>[^<]*<\/a>/, '');
  return out;
}

const escH = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function gallery(items) {
  const cards = items.map(m => `    <a class="card" href="examples/${m.id}.html">
      <span class="thumb"><img src="docs/shots/${m.id}-stage.png" alt="Preview of: ${escH(m.title)}" loading="lazy" width="1060" height="520"></span>
      <span class="body"><b>${escH(m.title)}</b><span>${escH(m.sub)}</span><span class="tags">${(m.tags || []).map(t => `<i>${escH(t)}</i>`).join('')}</span></span>
    </a>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>tinkertoy: explanations you can play with</title>
<meta name="description" content="An agent skill that answers 'how does X work' with one self-contained HTML simulation: sliders, a scrub bar and a break-it button.">
<style>
:root{--bg:#0b0e17;--panel:#131826;--line:#27304a;--text:#e6eaf3;--mut:#8b96b0;--acc:#6ea8ff}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:radial-gradient(1200px 500px at 50% -10%,#16213f 0,transparent 70%),var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1080px;margin:0 auto;padding:40px 20px 56px}
h1{font-size:clamp(34px,6vw,56px);line-height:1.05;margin:0 0 10px;letter-spacing:-.02em}
.lede{font-size:clamp(17px,2.4vw,21px);color:#c3cbe0;max-width:46em;margin:0 0 22px}
.install{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 34px}
.install code{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:11px 14px;font:14px ui-monospace,Menlo,Consolas,monospace;overflow-x:auto;max-width:100%}
.install button,.install a{background:var(--acc);color:#071022;border:0;border-radius:10px;padding:11px 16px;font:600 14px system-ui;cursor:pointer;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.install a{background:transparent;color:var(--acc);border:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:18px}
.card{display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;color:inherit;text-decoration:none;transition:transform .15s,border-color .15s}
.card:hover,.card:focus-visible{transform:translateY(-3px);border-color:var(--acc);outline:none}
.thumb{display:block;aspect-ratio:2/1;overflow:hidden;background:#0f1422;border-bottom:1px solid var(--line)}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.body{display:flex;flex-direction:column;gap:6px;padding:14px 16px 16px}
.body b{font-size:18px}.body span{color:var(--mut);font-size:14px}
.tags{display:flex;gap:6px;flex-wrap:wrap}.tags i{font-style:normal;font-size:11.5px;color:#9fb4e6;background:#1a2440;border-radius:99px;padding:2px 9px}
h2{margin:46px 0 10px;font-size:22px}
ol{color:#c3cbe0;padding-left:1.2em}li{margin:6px 0}
footer{margin-top:44px;color:var(--mut);font-size:13.5px}footer a{color:var(--acc)}
@media (prefers-reduced-motion:reduce){.card{transition:none}}
</style>
</head>
<body>
<main>
  <h1>tinkertoy</h1>
  <p class="lede">Ask your coding agent <i>how something works</i> and get a toy you can play with, not a wall of text: one HTML file with sliders, a scrub bar and a <b>Break it</b> button.</p>
  <div class="install">
    <code id="cmd">npx @barood-labs/tinkertoy init</code>
    <button id="copy" type="button" aria-label="Copy install command">Copy</button>
    <a href="https://github.com/barood-labs/tinkertoy">GitHub</a>
  </div>
  <div class="grid">
${cards}
  </div>
  <h2>How it works</h2>
  <ol>
    <li>Install the skill into your project (Claude Code, Codex, Cursor).</li>
    <li>Ask "how does a hash table resize?" The agent writes one self-contained <code>.html</code> file.</li>
    <li>Open it. Drag the sliders, scrub the timeline, press <b>Break it</b>. It works offline.</li>
  </ol>
  <footer>MIT licensed. Each example is a single file with no dependencies, and every model is simplified on purpose. <a href="https://github.com/barood-labs/tinkertoy">Source on GitHub</a>.</footer>
</main>
<script>
document.getElementById('copy').onclick=function(){var b=this,t=document.getElementById('cmd').textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent='Copied'},function(){var r=document.createRange();r.selectNode(document.getElementById('cmd'));getSelection().removeAllRanges();getSelection().addRange(r);b.textContent='Press Ctrl+C'});setTimeout(function(){b.textContent='Copy'},1800)};
</script>
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(resolve(root, 'examples'), { recursive: true });
  const ids = readdirSync(resolve(root, 'sims')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
  const index = [];
  for (const id of ids) {
    const meta = JSON.parse(rd(`sims/${id}.json`));
    const html = assemble(meta, rd(`sims/${id}.js`));
    if (/https?:\/\/(?!www\.w3\.org\/)/.test(html.replace('https://github.com/barood-labs/tinkertoy', ''))) throw new Error(id + ': external URL in output');
    writeFileSync(resolve(root, `examples/${id}.html`), html);
    index.push({ id, title: meta.title, sub: meta.sub, tags: meta.tags || [] });
    console.log('built examples/' + id + '.html', html.length, 'bytes');
  }
  writeFileSync(resolve(root, 'examples/manifest.json'), JSON.stringify(index, null, 2) + '\n');
  writeFileSync(resolve(root, 'index.html'), gallery(index));
  console.log('built index.html');
  // template for the skill: a tiny but fully working sim
  const tm = JSON.parse(rd('src/template.json'));
  mkdirSync(resolve(root, 'skill'), { recursive: true });
  writeFileSync(resolve(root, 'skill/template.html'), assemble(tm, rd('src/template.js'), '#'));
  console.log('built skill/template.html');
}
