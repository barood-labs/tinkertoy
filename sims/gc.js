Tinkertoy({
  rate: 5,
  breakOn: 'The collector skips root R1, as if a stack variable was missed. Everything only reachable through it never gets marked, so it is freed while the program still points at it.',
  breakOff: 'Normal run: mark from every root, then free only the unmarked objects.',
  height: W => (W < 560 ? 430 : 470),
  build(p, broken) {
    const rnd = (() => { let a = (p.seed * 7919) >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const n = p.n, nl = Math.ceil(n * 0.6), R = Math.min(p.roots, nl);
    // shuffle ids so live/dead are mixed in heap order
    const ids = [...Array(n).keys()]; for (let k = n - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
    const live = ids.slice(0, nl), dead = ids.slice(nl), refs = Array.from({ length: n }, () => new Set());
    for (let k = R; k < nl; k++) refs[live[Math.floor(rnd() * k)]].add(live[k]);
    for (const o of live) { const extra = Math.floor(rnd() * p.refs); for (let e = 0; e < extra; e++) { const t = live[Math.floor(rnd() * nl)]; if (t !== o) refs[o].add(t); } }
    for (const o of dead) { const c = 1 + Math.floor(rnd() * p.refs); for (let e = 0; e < c; e++) { const t = Math.floor(rnd() * n); if (t !== o) refs[o].add(t); } }
    const rootT = live.slice(0, R), adj = refs.map(s => [...s].sort((a, b) => a - b));
    const size = Array.from({ length: n }, () => 1 + Math.floor(rnd() * 3));
    // layout (unit square), roots pinned to the left
    const pos = Array.from({ length: n }, () => ({ x: 0.25 + rnd() * 0.7, y: 0.05 + rnd() * 0.9 }));
    const rootY = k => (R === 1 ? 0.5 : 0.12 + (0.76 * k) / (R - 1));
    for (let it = 0; it < 300; it++) {
      const f = pos.map(() => ({ x: 0, y: 0 })), cool = 1 - it / 320;
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { let dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y; const d2 = dx * dx + dy * dy + 1e-4, d = Math.sqrt(d2), s = 0.0006 / d2; f[a].x += dx / d * s; f[a].y += dy / d * s; f[b].x -= dx / d * s; f[b].y -= dy / d * s; }
      for (let a = 0; a < n; a++) for (const b of adj[a]) { const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y, d = Math.sqrt(dx * dx + dy * dy) + 1e-6, s = (d - 0.09) * 0.07; f[a].x += dx / d * s; f[a].y += dy / d * s; f[b].x -= dx / d * s; f[b].y -= dy / d * s; }
      rootT.forEach((o, k) => { f[o].x += (0.22 - pos[o].x) * 0.05; f[o].y += (rootY(k) - pos[o].y) * 0.03; });
      for (let a = 0; a < n; a++) { f[a].x += (0.58 - pos[a].x) * 0.035; f[a].y += (0.5 - pos[a].y) * 0.05; pos[a].x = Math.min(0.98, Math.max(0.2, pos[a].x + Math.max(-0.03, Math.min(0.03, f[a].x)) * cool)); pos[a].y = Math.min(0.97, Math.max(0.03, pos[a].y + Math.max(-0.03, Math.min(0.03, f[a].y)) * cool)); }
    }
    // truth: reachable from all roots
    const truth = new Array(n).fill(false); { const q = [...rootT]; q.forEach(o => (truth[o] = true)); while (q.length) { const o = q.shift(); for (const t of adj[o]) if (!truth[t]) { truth[t] = true; q.push(t); } } }
    const skipped = broken ? 0 : -1;
    // states: 0 white, 1 gray, 2 black, 3 freed, 4 dangling (freed but still reachable), 5 live (after sweep)
    const st = new Array(n).fill(0), frames = [], base = { pos, adj, rootT, rootY, size, skipped, n };
    const count = k => st.filter(s => s === k).length;
    const stats = (phase, tone) => [['Phase', phase, tone || ''], ['Marked', count(2) + count(1) + count(5), ''], ['Freed', count(3) + count(4), ''], ['Live kept', count(5), 'ok'], ['Dangling', count(4), count(4) ? 'bad' : '']];
    const push = (f) => frames.push({ ...base, st: st.slice(), active: -1, phase: 'idle', ...f });
    push({ msg: `A heap of <b>${n}</b> objects. The program holds <b>${R}</b> root${R > 1 ? 's' : ''} (left). Which objects can it still reach? Everything else is garbage. ${broken ? '<b>This collector will skip root R1.</b>' : ''}`, stats: stats('Idle') });
    const q = [];
    rootT.forEach((o, k) => { if (k === skipped) return; st[o] = 1; q.push(o); });
    push({ phase: 'mark', msg: `<b>Mark begins:</b> the collector colours the objects the roots point to <b style="color:#fbbf24">amber</b> (found, not scanned yet).${broken ? ' <b>R1 is skipped</b>, so its target stays white.' : ''}`, stats: stats('Mark'), bad: broken });
    while (q.length) {
      const o = q.shift(); const found = [];
      for (const t of adj[o]) if (st[t] === 0) { st[t] = 1; q.push(t); found.push(t); }
      st[o] = 2;
      push({ phase: 'mark', active: o, found, msg: `Scan <b>#${o}</b>: ${adj[o].length ? 'it points to ' + adj[o].map(t => '#' + t).join(', ') + (found.length ? `, newly found: ${found.map(t => '#' + t).join(', ')}` : ', all already seen') : 'it points to nothing'}. It turns <b style="color:#6ea8ff">blue</b> (fully scanned).`, stats: stats('Mark') });
    }
    push({ phase: 'mark', msg: `<b>Mark done.</b> No amber left. Every object reachable from the roots the collector knew is blue; the white ones were never reached.`, stats: stats('Mark done') });
    let dang = 0;
    for (let o = 0; o < n; o++) {
      let m;
      if (st[o] === 2) { st[o] = 5; m = `<b>#${o}</b> is marked: keep it (and clear the mark for next time).`; }
      else { if (truth[o]) { st[o] = 4; dang++; m = `<b>#${o}</b> is white, so it is freed. <b>But the program can still reach it.</b> That is a dangling pointer.`; } else { st[o] = 3; m = `<b>#${o}</b> is white: nothing reachable points to it. <b>Freed.</b>`; } }
      push({ phase: 'sweep', active: o, msg: 'Sweep: ' + m, bad: st[o] === 4, stats: stats('Sweep', st[o] === 4 ? 'bad' : '') });
    }
    const freed = count(3) + count(4), freedBlocks = st.reduce((a, s, o) => a + (s === 3 || s === 4 ? size[o] : 0), 0), tot = size.reduce((a, b) => a + b, 0);
    push({ phase: 'done', msg: broken ? `<b>Sweep done, but it freed ${dang} object${dang === 1 ? '' : 's'} the program still uses.</b> Nothing complained yet: the damage shows up later, when the program follows a stale pointer.` : `<b>Sweep done:</b> ${freed} of ${n} objects freed, ${freedBlocks} of ${tot} memory blocks reclaimed. Everything left is reachable from a root. Garbage that pointed at garbage (even in a loop) was collected too.`, stats: stats('Done', dang ? 'bad' : ''), bad: dang > 0 });
    if (broken && dang) push({ phase: 'crash', crash: rootT[0], msg: `<b>💥 Use after free.</b> The program follows root R1 to <b>#${rootT[0]}</b>, but that memory is gone. In C this is undefined behaviour; in a managed runtime this bug is exactly what a correct collector exists to prevent.`, stats: stats('Crash', 'bad'), bad: true });
    return frames;
  },
  draw({ g, W, H, frame: f, T, C }) {
    const small = W < 560, gx0 = 92, gx1 = W - 24, gy0 = 12, gy1 = H - 82, rad = f.n > 28 || small ? 12 : 15;
    const X = u => gx0 + (u - 0.2) / 0.78 * (gx1 - gx0), Y = u => gy0 + rad + 4 + u * (gy1 - gy0 - 2 * rad - 8), P = o => [X(f.pos[o].x), Y(f.pos[o].y)];
    const col = s => ({ 0: ['#232c45', '#8b96b0'], 1: ['#5b4515', '#fbbf24'], 2: ['#1f3d6e', '#6ea8ff'], 3: ['rgba(0,0,0,0)', '#3a4468'], 4: ['rgba(255,93,108,.25)', '#ff5d6c'], 5: ['rgba(74,222,128,.16)', '#4ade80'] }[s]);
    const edge = (x1, y1, x2, y2, c, lw, bend) => {
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, sx = x1 + ux * rad, sy = y1 + uy * rad, ex = x2 - ux * (rad + 3), ey = y2 - uy * (rad + 3), mx = (sx + ex) / 2 - uy * bend, my = (sy + ey) / 2 + ux * bend;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(mx, my, ex, ey); g.strokeStyle = c; g.lineWidth = lw; g.stroke();
      const a = Math.atan2(ey - my, ex - mx); g.beginPath(); g.moveTo(ex + Math.cos(a) * 4, ey + Math.sin(a) * 4); g.lineTo(ex - 5 * Math.cos(a - 0.5), ey - 5 * Math.sin(a - 0.5)); g.lineTo(ex - 5 * Math.cos(a + 0.5), ey - 5 * Math.sin(a + 0.5)); g.fillStyle = c; g.fill();
    };
    // edges
    for (let o = 0; o < f.n; o++) {
      if (f.st[o] === 3 || f.st[o] === 4) continue;
      const hot = f.active === o && f.phase === 'mark', [x1, y1] = P(o);
      for (const t of f.adj[o]) { const [x2, y2] = P(t), c = hot ? '#e6eaf3' : f.st[o] === 2 ? '#3d5a94' : '#2a3350'; edge(x1, y1, x2, y2, c, hot ? 2.2 : 1.2, 5); }
    }
    // roots
    f.rootT.forEach((o, k) => {
      const ry = Y(f.rootY(k)), rx = 26, skip = k === f.skipped, [x2, y2] = P(o);
      T.rr(g, 4, ry - 12, 44, 24, 6, skip ? 'rgba(255,93,108,.15)' : '#17302f', skip ? C.bad : C.teal, 1.5);
      T.text(g, 'R' + (k + 1) + (skip ? ' ✕' : ''), rx, ry, { size: 11.5, weight: 700, color: skip ? C.bad : C.teal, align: 'center' });
      const crash = f.crash === o && k === 0;
      if (skip) g.setLineDash([4, 4]);
      edge(52 + rad, ry, x2, y2, crash ? C.bad : skip ? '#ff8d98' : '#2dd4bf', crash ? 3 : 1.8, 0);
      g.setLineDash([]);
    });
    // nodes
    for (let o = 0; o < f.n; o++) {
      const [x, y] = P(o), [fill, stroke] = col(f.st[o]), act = f.active === o;
      g.setLineDash(f.st[o] === 3 ? [3, 3] : []);
      T.circle(g, x, y, rad, fill, stroke, act ? 3 : 1.6); g.setLineDash([]);
      if (act) { g.beginPath(); g.arc(x, y, rad + 5, 0, 6.2832); g.strokeStyle = f.phase === 'sweep' ? (f.st[o] === 3 ? '#8b96b0' : f.st[o] === 4 ? C.bad : C.ok) : '#fff'; g.lineWidth = 1.5; g.stroke(); }
      T.text(g, String(o), x, y, { size: rad > 12 ? 11.5 : 10, weight: 700, color: f.st[o] === 3 ? '#4a5578' : '#e6eaf3', align: 'center' });
      if (f.crash === o) T.text(g, '💥', x, y - rad - 12, { size: 18, align: 'center' });
    }
    // legend + heap strip
    const lg = [['unseen', 0], ['found', 1], ['scanned', 2], ['freed', 3], ['kept', 5], ['dangling', 4]]; let lx = 8;
    lg.forEach(([name, s]) => { const [fl, sk] = col(s); T.circle(g, lx + 5, gy1 + 12, 5, fl, sk, 1.5); T.text(g, name, lx + 14, gy1 + 12, { size: 10.5, color: C.mut }); lx += small ? 58 : 76; });
    T.text(g, 'HEAP (each block is one object, wider = bigger)', 8, gy1 + 34, { size: 9.5, weight: 700, color: '#566182' });
    const total = f.size.reduce((a, b) => a + b, 0), hw = W - 16; let hx = 8;
    for (let o = 0; o < f.n; o++) { const w = hw * f.size[o] / total, [fl, sk] = col(f.st[o]); T.rr(g, hx + 1, gy1 + 42, Math.max(2, w - 2), 20, 3, f.st[o] === 3 ? 'rgba(0,0,0,0)' : fl === '#232c45' ? '#2a3350' : fl, sk, 1); hx += w; }
  }
});
