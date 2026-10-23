/* ===== tinkertoy runtime v0.1.1 (inline, no deps) ===== */
const T = (() => {
  const C = { bg:'#131826', panel:'#1a2133', line:'#2c3753', text:'#e6eaf3', mut:'#8b96b0', acc:'#6ea8ff', ok:'#4ade80', bad:'#ff5d6c', warn:'#fbbf24', pur:'#b794f6', teal:'#2dd4bf' };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const rng = seed => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rr = (g, x, y, w, h, r, fill, stroke, lw) => { g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw || 1; g.strokeStyle = stroke; g.stroke(); } };
  const text = (g, s, x, y, o = {}) => { g.font = `${o.weight || 500} ${o.size || 13}px ${o.mono ? 'ui-monospace,Menlo,Consolas,monospace' : 'system-ui,-apple-system,Segoe UI,sans-serif'}`; g.fillStyle = o.color || C.text; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'middle'; g.fillText(s, x, y); };
  const line = (g, x1, y1, x2, y2, color, lw, dash) => { g.beginPath(); g.setLineDash(dash || []); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = color || C.line; g.lineWidth = lw || 1; g.stroke(); g.setLineDash([]); };
  const arrow = (g, x1, y1, x2, y2, color, lw) => { line(g, x1, y1, x2, y2, color, lw || 1.5); const a = Math.atan2(y2 - y1, x2 - x1), s = 7; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4)); g.lineTo(x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4)); g.closePath(); g.fillStyle = color || C.line; g.fill(); };
  const circle = (g, x, y, r, fill, stroke, lw) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw || 1; g.strokeStyle = stroke; g.stroke(); } };
  return { C, clamp, lerp, ease, rng, hash, rr, text, line, arrow, circle };
})();

function Tinkertoy(cfg) {
  const $ = id => document.getElementById(id);
  const canvas = $('stage'), wrap = $('stagewrap'), g = canvas.getContext('2d');
  const inputs = [...document.querySelectorAll('input[data-param]')];
  const params = {}, fmt = cfg.fmt || {};
  let lastWrapW = 0, frames = [], n = 1, pos = 0, playing = false, broken = false, speed = 1, lastTs = 0, cssW = 0, cssH = 0, statKey = '', raf = 0, builds = 0, buildMs = 0;
  const SPEEDS = [0.5, 1, 2, 4];
  const rate = cfg.rate || 2;

  function readParams() { for (const el of inputs) { params[el.id] = +el.value; const o = document.querySelector(`output[for="${el.id}"]`); if (o) o.textContent = (fmt[el.id] || (v => v))(+el.value); } }
  function saveHash() { try { const q = inputs.map(el => `${el.id}=${el.value}`); if (broken) q.push('break=1'); history.replaceState(null, '', '#' + q.join('&')); } catch (e) {} }
  function loadHash() { try { const h = new URLSearchParams(location.hash.slice(1)); for (const el of inputs) if (h.has(el.id)) el.value = h.get(el.id); if (h.get('break') === '1') broken = true; } catch (e) {} }
  // rebuild() is synchronous. Slider drags go through schedule() instead, which coalesces them.
  function rebuild() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; } // a pending coalesced build is superseded by this one
    readParams();
    const t0 = performance.now();
    frames = cfg.build({ ...params }, broken);
    buildMs = performance.now() - t0; builds++;
    n = frames.length;
    $('scrub').max = String(n - 1);
    pos = T.clamp(pos, 0, n - 1);
    resize();
  }
  // At most one build() per animation frame while a slider is dragged; the latest value wins
  // because rebuild() reads the sliders when it runs. The value readouts update immediately.
  function schedule() {
    readParams();
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; rebuild(); saveHash(); });
  }
  function resize() {
    const w = wrap.clientWidth || 600; lastWrapW = w;
    cssW = Math.max(w, cfg.minWidth || 0);
    cssH = Math.round(cfg.height ? cfg.height(cssW, { params, frames }) : cssW * 0.5);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }
  function cur() { const i = Math.min(n - 1, Math.max(0, Math.ceil(pos - 1e-9))); const t = i === 0 ? 1 : T.clamp(1 - (i - pos), 0, 1); return { i, t }; }
  function render() {
    const { i, t } = cur(), frame = frames[i], prev = frames[Math.max(0, i - 1)];
    g.clearRect(0, 0, cssW, cssH); g.fillStyle = T.C.bg; g.fillRect(0, 0, cssW, cssH);
    cfg.draw({ g, W: cssW, H: cssH, frame, prev, i, t, n, frames, p: params, broken, T, C: T.C });
    $('scrub').value = String(pos);
    $('pos').textContent = (cfg.posLabel ? cfg.posLabel(frame, i, n) : `step ${i + 1} / ${n}`);
    const cap = $('caption'); cap.innerHTML = frame.msg || ''; cap.classList.toggle('bad', !!frame.bad);
    const key = JSON.stringify(frame.stats || []);
    if (key !== statKey) { statKey = key; $('stats').innerHTML = (frame.stats || []).map(([k, v, tone]) => `<div class="stat ${tone || ''}"><small>${k}</small><b>${v}</b></div>`).join(''); }
    $('play').textContent = playing ? '⏸ Pause' : (pos >= n - 1 ? '↺ Replay' : '▶ Play');
  }
  function loop(ts) {
    if (playing) {
      const dt = Math.min(0.1, (ts - lastTs) / 1000); pos = Math.min(n - 1, pos + dt * rate * speed);
      if (pos >= n - 1) playing = false;
      render();
    }
    lastTs = ts; requestAnimationFrame(loop);
  }
  const play = () => { if (pos >= n - 1) pos = 0; playing = true; render(); };
  const pause = () => { playing = false; render(); };
  const seek = v => { pos = T.clamp(+v, 0, n - 1); render(); };
  const setBreak = b => { broken = !!b; wrap.classList.toggle('broken', broken); $('break').setAttribute('aria-pressed', String(broken)); $('badge').hidden = !broken; $('breakinfo').innerHTML = broken ? cfg.breakOn || '' : cfg.breakOff || ''; const lb = $('break'); lb.textContent = broken ? '↩ Un-break it (restore normal behaviour)' : lb.dataset.label; rebuild(); saveHash(); };

  $('break').dataset.label = $('break').textContent;
  loadHash(); readParams();
  $('play').onclick = () => (playing ? pause() : play());
  $('step').onclick = () => { playing = false; seek(Math.floor(pos + 1e-9) + 1); };
  $('back').onclick = () => { playing = false; seek(Math.ceil(pos - 1e-9) - 1); };
  $('scrub').oninput = e => { playing = false; seek(e.target.value); };
  $('speed').onclick = () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; $('speed').textContent = speed + '×'; };
  $('break').onclick = () => { setBreak(!broken); pos = 0; play(); };
  inputs.forEach(el => el.addEventListener('input', schedule));
  addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,button,select,textarea')) return; if (e.key === ' ') { e.preventDefault(); $('play').click(); } else if (e.key === 'ArrowRight') $('step').click(); else if (e.key === 'ArrowLeft') $('back').click(); else if (e.key === 'b') $('break').click(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (Math.abs(wrap.clientWidth - lastWrapW) > 1) resize(); }).observe(wrap);
  setBreak(broken);
  requestAnimationFrame(loop);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, auto = new URLSearchParams(location.search).get('autoplay') !== '0';
  if (auto && !reduce) setTimeout(play, 350); else render();
  window.tinkertoy = {
    get steps() { return n; }, get state() { const { i, t } = cur(); return { pos, i, t, n, broken, playing, params: { ...params }, frame: frames[i] }; },
    seek, play, pause, setBreak: b => { setBreak(b); pos = 0; render(); }, setParam(id, v) { $(id).value = v; rebuild(); saveHash(); }, // synchronous on purpose: tests need the frames right now
    get builds() { return builds; }, get buildMs() { return buildMs; },
    frames: () => frames
  };
}
