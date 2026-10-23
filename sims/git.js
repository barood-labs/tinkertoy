Tinkertoy({
  rate: 1.6,
  minWidth: 640,
  breakOn: "Main and every feature commit edit the same lines of one file. Git can't decide, so it stops and asks you to resolve a conflict.",
  breakOff: 'Normal run: the two branches touched different files, so Git combines them without asking.',
  height: () => 392,
  build(p, broken) {
    const frames = []; let res = { L: 0, R: 0 }, rew = 0;
    const L = { c: [], tags: {}, pending: null }, R = { c: [], tags: {}, pending: null };
    const hx = (label, par) => T.hash(label + '|' + par.join(',')).toString(16).padStart(8, '0').slice(0, 6);
    const mk = (S, id, label, col, row, parents, kind) => { const c = { id, label, col, row, parents, kind, hash: hx(label, parents.map(q => S.c.find(z => z.id === q).hash)), ghost: false, fresh: true }; S.c.push(c); return c; };
    const snap = () => JSON.parse(JSON.stringify({ L, R }));
    const cnt = S => S.c.filter(c => !c.ghost).length;
    const push = (msg, extra = {}) => { const s = snap(); frames.push({ ...s, new: extra.new || [], msg, bad: !!extra.bad, stats: [['Merge: commits', cnt(L)], ['Rebase: commits', cnt(R)], ['Merge conflicts fixed', res.L, res.L ? 'warn' : ''], ['Rebase conflicts fixed', res.R, res.R ? 'warn' : ''], ['Commits rewritten', rew, rew ? 'warn' : '']] }); L.c.forEach(c => (c.fresh = false)); R.c.forEach(c => (c.fresh = false)); };
    const both = (id, label, col, row, parents) => { mk(L, id, label, col, row, parents, row); mk(R, id, label, col, row, parents, row); };
    const names = 'ABCD';
    let prev = null;
    for (let k = 0; k < p.base; k++) { both(names[k], names[k], k, 'm', prev ? [prev] : []); prev = names[k]; }
    const bl = prev; L.tags = { main: bl, feature: bl }; R.tags = { main: bl, feature: bl };
    push(`Both branches start at the same commit <b>${bl}</b>. <b>main</b> and <b>feature</b> point at it. Left: we'll use <b>merge</b>. Right: <b>rebase</b>. Same input for both.`);
    let mp = bl;
    for (let k = 1; k <= p.m; k++) { both('M' + k, 'M' + k, p.base + k - 1, 'm', [mp]); mp = 'M' + k; L.tags.main = R.tags.main = mp; push(`A teammate adds <b>M${k}</b> to <b>main</b>.`, { new: ['M' + k] }); }
    let fp = bl;
    for (let k = 1; k <= p.f; k++) { both('F' + k, 'F' + k, p.base + k - 1, 'f', [fp]); fp = 'F' + k; L.tags.feature = R.tags.feature = fp; push(`You commit <b>F${k}</b> on <b>feature</b>.`, { new: ['F' + k] }); }
    push(`The histories have <b>diverged</b>: main has ${p.m} new commit${p.m > 1 ? 's' : ''} you don't have, and feature has ${p.f} that main doesn't. To integrate, merge (top) or rebase (bottom).`);
    // merge
    const mcol = p.base + Math.max(p.m, p.f);
    if (broken) { L.pending = { col: mcol, row: 'f', label: 'merge' }; push(`<b>git merge main</b> → <b>CONFLICT.</b> Main (M${p.m}) and feature (F${p.f}) changed the <i>same lines</i>. Git stops and puts conflict markers in the file. You resolve it by hand, once.`, { bad: true }); L.pending = null; }
    mk(L, 'MG', 'G', mcol, 'f', ['F' + p.f, 'M' + p.m], 'g'); L.tags.feature = 'MG'; if (broken) res.L = 1;
    push(`<b>git merge main:</b> one new <b>merge commit G</b> with two parents (F${p.f} and M${p.m}). ${broken ? 'Conflict resolved: 1 time. ' : ''}Existing commits and hashes are <b>unchanged</b>, and the graph still shows that the work happened in parallel.`, { new: ['MG'] });
    // rebase
    let tip = 'M' + p.m, firstReplay = true;
    for (let k = 1; k <= p.f; k++) {
      const col = p.base + p.m + k - 1;
      if (firstReplay) { for (let j = 1; j <= p.f; j++) R.c.find(c => c.id === 'F' + j).ghost = true; firstReplay = false; }
      if (broken) { R.pending = { col, row: 'm', label: "F" + k + "'" }; push(`<b>git rebase main</b>, replaying <b>F${k}</b> onto ${k === 1 ? 'M' + p.m : "F" + (k - 1) + "'"}: <b>CONFLICT</b> on the same lines. You resolve it, then <code>git rebase --continue</code>.`, { bad: true }); R.pending = null; res.R = k; }
      mk(R, "F" + k + "'", "F" + k + "'", col, 'm', [tip], 'r'); tip = "F" + k + "'"; R.tags.feature = tip; rew = k;
      push(`<b>git rebase main:</b> replay <b>F${k}</b> as a <b>brand new commit F${k}'</b> (new hash <code>${R.c.find(c => c.id === tip).hash}</code>) on top of ${k === 1 ? 'M' + p.m : "F" + (k - 1) + "'"}.${broken ? ` Conflicts resolved so far: ${k}.` : ''}`, { new: [tip] });
    }
    push(`<b>Result.</b> <b>Merge:</b> ${cnt(L)} commits, branches visible, 1 extra merge commit, 0 hashes changed, ${broken ? '1 conflict to resolve' : 'no conflicts'}. <b>Rebase:</b> ${cnt(R)} commits, one straight line, but F1–F${p.f} were <b>rewritten</b> (${p.f} new hashes; the old ones are dashed), ${broken ? p.f + ' conflict' + (p.f > 1 ? 's' : '') + ' to resolve' : 'no conflicts'}.`, { bad: broken });
    return frames;
  },
  draw({ g, W, H, frame: f, t, T, C }) {
    const cols = Math.max(...f.L.c.concat(f.R.c).map(c => c.col), 0) + 1, x0 = 56, dx = Math.min(78, (W - x0 - 24) / Math.max(cols, 1)), rad = 13, ph = H / 2;
    const col = c => (c.kind === 'g' ? [C.ok, '#14361f'] : c.kind === 'r' ? [C.teal, '#0f3a36'] : c.row === 'f' ? [C.warn, '#3d3010'] : [C.acc, '#1d3560']);
    const panel = (S, y0, title, sub) => {
      const Y = { m: y0 + 62, f: y0 + 128 }, X = k => x0 + dx * k + dx / 2;
      T.text(g, title, 10, y0 + 16, { size: 13, weight: 700, mono: true, color: '#e6eaf3' }); T.text(g, sub, W - 10, y0 + 16, { size: 11, color: C.mut, align: 'right' });
      T.text(g, 'main', 8, Y.m, { size: 10.5, color: '#566182' }); T.text(g, 'feature', 8, Y.f, { size: 10.5, color: '#566182' });
      const by = id => S.c.find(c => c.id === id);
      for (const c of S.c) for (const pid of c.parents) { const q = by(pid); g.globalAlpha = (c.ghost || q.ghost ? 0.3 : 1) * (c.fresh ? T.ease(t) : 1); T.line(g, X(q.col), Y[q.row], X(c.col), Y[c.row], '#4a5578', 2, c.ghost ? [4, 4] : null); }
      g.globalAlpha = 1;
      if (S.pending) { const pp = S.pending, pulse = 0.6 + 0.4 * Math.sin(performance.now() / 160); T.circle(g, X(pp.col), Y[pp.row], rad + 2, 'rgba(255,93,108,.15)', C.bad, 2); T.text(g, '⚡', X(pp.col), Y[pp.row], { size: 13, align: 'center' }); T.text(g, 'CONFLICT', X(pp.col), Y[pp.row] + 26, { size: 10, weight: 700, color: C.bad, align: 'center' }); }
      for (const c of S.c) {
        const [stroke, fill] = col(c), a = (c.ghost ? 0.35 : 1) * (c.fresh ? T.ease(t) : 1), x = X(c.col), y = Y[c.row] - (c.fresh ? (1 - T.ease(t)) * 10 : 0);
        g.globalAlpha = a; g.setLineDash(c.ghost ? [3, 3] : []);
        T.circle(g, x, y, rad, fill, stroke, 2); g.setLineDash([]);
        T.text(g, c.label, x, y, { size: c.label.length > 2 ? 9 : 10.5, weight: 700, color: '#e6eaf3', align: 'center' });
        T.text(g, c.hash, x, y + rad + 10, { size: 9.5, mono: true, color: c.ghost ? '#566182' : '#8b96b0', align: 'center' });
        g.globalAlpha = 1;
      }
      for (const [name, id] of Object.entries(S.tags)) { const c = by(id); if (!c) continue; const x = X(c.col), y = Y[c.row] - rad - 14, w = name.length * 6.4 + 14, same = Object.entries(S.tags).filter(([, o]) => o === id).map(([n]) => n), idx = same.indexOf(name); const yy = y - idx * 17; T.rr(g, x - w / 2, yy - 8, w, 16, 8, name === 'main' ? '#1d3560' : '#3d3010', name === 'main' ? C.acc : C.warn, 1); T.text(g, name, x, yy, { size: 10, weight: 700, color: name === 'main' ? C.acc : C.warn, align: 'center' }); }
    };
    panel(f.L, 0, '$ git merge main', 'adds one merge commit');
    T.line(g, 8, ph, W - 8, ph, '#2a3350', 1, [4, 4]);
    panel(f.R, ph + 6, '$ git rebase main', 'replays your commits as new ones');
  }
});
