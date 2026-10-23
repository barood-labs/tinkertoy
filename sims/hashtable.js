const WORDS = ['apple','banana','cherry','date','elder','fig','grape','honey','iris','jade','kiwi','lemon','mango','nectar','olive','peach','quince','rose','sage','thyme','umber','vanilla','walnut','yarrow'];
const hex = n => '0x' + n.toString(16).padStart(8, '0');
const hue = k => 'hsl(' + (T.hash(k + '!') % 360) + ',62%,62%)';

Tinkertoy({
  rate: 1.6,
  breakOn: 'Resizing is switched off. The bucket count never changes, so chains keep growing and every insert has to walk a longer list.',
  breakOff: 'Normal run: the table doubles whenever items ÷ buckets passes the threshold.',
  fmt: { load: v => v.toFixed(2) },
  build(p, broken) {
    let b = p.buckets, tab = Array.from({ length: b }, () => []);
    const frames = []; let work = 0, inserts = 0, resizes = 0;
    const snap = () => tab.map(c => c.slice());
    const longest = () => Math.max(...tab.map(c => c.length));
    const stats = () => {
      const n = tab.reduce((s, c) => s + c.length, 0), lf = n / b, L = longest();
      const lk = n ? tab.reduce((s, c) => s + c.reduce((a, _, j) => a + j + 1, 0), 0) / n : 0;
      return [['Items', n], ['Buckets', b], ['Load factor', lf.toFixed(2), lf > p.load ? 'warn' : 'ok'], ['Longest chain', L, L >= 6 ? 'bad' : L >= 4 ? 'warn' : 'ok'], ['Avg lookup cost', lk.toFixed(1) + ' cmp', lk >= 3 ? 'bad' : lk >= 2 ? 'warn' : 'ok'], ['Work so far', work + ' steps']];
    };
    frames.push({ type: 'start', tab: snap(), b, msg: `An empty hash table with <b>${b}</b> buckets. We will insert ${p.keys} keys one at a time.`, stats: stats() });
    for (let k = 0; k < p.keys; k++) {
      const key = WORDS[k], h = T.hash(key), idx = h % b, cost = tab[idx].length + 1;
      tab[idx].push(key); work += cost; inserts++;
      const note = tab[idx].length > 1 ? `Bucket ${idx} already holds ${tab[idx].length - 1}, so this is a <b>collision</b>: we walk the chain (${cost} steps) and append.` : `Bucket ${idx} was empty: 1 step.`;
      frames.push({ type: 'insert', key, idx, h, tab: snap(), b, msg: `Insert “<b>${key}</b>”: hash = ${hex(h)}, ${hex(h)} mod ${b} = <b>${idx}</b>. ${note}`, stats: stats() });
      const n = k + 1;
      if (!broken && n / b > p.load) {
        const old = snap(), nb = b * 2, nt = Array.from({ length: nb }, () => []);
        for (const c of old) for (const kk of c) { nt[T.hash(kk) % nb].push(kk); work++; }
        resizes++; b = nb; tab = nt;
        frames.push({ type: 'grow', tab: snap(), b, msg: `Load factor ${n}/${nb / 2} = <b>${(n / (nb / 2)).toFixed(2)}</b> is over ${p.load.toFixed(2)}. <b>Resize:</b> allocate ${nb} buckets and re-hash all ${n} keys (${n} extra steps). Chains get shorter.`, stats: stats() });
      } else if (broken && n / b > p.load && n === Math.ceil(p.load * b) + 1) {
        frames[frames.length - 1].msg += ` <b>Load factor is now ${(n / b).toFixed(2)}</b> (over ${p.load.toFixed(2)}) and nothing reacts.`;
      }
    }
    const avg = work / inserts, L = longest();
    frames.push({ type: 'done', tab: snap(), b, bad: broken && L >= 6, msg: broken ? `Done. Longest chain is <b>${L}</b>, so finding a key can take up to ${L} comparisons. Average work per insert: <b>${avg.toFixed(1)}</b> steps and rising.` : `Done after ${resizes} resize${resizes === 1 ? '' : 's'}. Longest chain is only <b>${L}</b>. Average work per insert, resizes included: <b>${avg.toFixed(1)}</b> steps.`, stats: stats().concat([['Avg / insert', avg.toFixed(1), broken && avg > 3 ? 'bad' : 'ok']]) });
    return frames;
  },
  height(W, { frames }) {
    const mb = Math.max(...frames.map(f => f.b)), cols = W >= 720 && mb > 8 ? 2 : 1;
    return 62 + Math.ceil(mb / cols) * 27 + 14;
  },
  draw({ g, W, H, frame, prev, t, frames, T, C }) {
    const mb = Math.max(...frames.map(f => f.b)), cols = W >= 720 && mb > 8 ? 2 : 1, rowH = 27, top = 58, colW = (W - 24) / cols;
    const maxChain = Math.max(...frames.map(f => Math.max(...f.tab.map(c => c.length))));
    const cw = Math.max(9, Math.min(50, (colW - 70) / Math.max(maxChain, 4))), ch = 20;
    const slot = (b, i, j) => ({ x: 12 + Math.floor(i / Math.ceil(b / cols)) * colW + 44 + j * (cw + 2), y: top + (i % Math.ceil(b / cols)) * rowH });
    const find = (tab, k) => { for (let i = 0; i < tab.length; i++) { const j = tab[i].indexOf(k); if (j >= 0) return [i, j]; } return null; };
    const rows = Math.ceil(frame.b / cols), fade = frame.type === 'grow' ? T.ease(t) : 1;
    // header
    if (frame.type === 'insert') T.text(g, `hash("${frame.key}") = ${hex(frame.h)}   →   ${hex(frame.h)} mod ${frame.b} = ${frame.idx}`, 14, 26, { mono: true, size: 13, color: C.acc });
    else if (frame.type === 'grow') T.text(g, `↻ rehash: every key moves to hash mod ${frame.b}`, 14, 26, { size: 14, weight: 700, color: C.warn });
    else T.text(g, frame.type === 'done' ? 'done' : 'empty table', 14, 26, { size: 13, color: C.mut });
    // bucket rows
    for (let i = 0; i < frame.b; i++) {
      const s = slot(frame.b, i, 0), isNew = frame.type === 'grow' && i >= prev.b;
      const hl = frame.type === 'insert' && i === frame.idx, a = isNew ? fade : 1;
      g.globalAlpha = a;
      T.rr(g, s.x - 44, s.y, colW - 8, rowH - 3, 5, hl ? 'rgba(110,168,255,.16)' : '#171e30', hl ? C.acc : '#222b43');
      T.text(g, String(i), s.x - 30, s.y + 11, { mono: true, size: 12, color: hl ? C.acc : C.mut, align: 'center' });
      g.globalAlpha = 1;
    }
    // chips
    for (let i = 0; i < frame.b; i++) frame.tab[i].forEach((k, j) => {
      const to = slot(frame.b, i, j); let x = to.x, y = to.y, a = 1;
      const pf = frame.type === 'grow' ? find(prev.tab, k) : null;
      if (frame.type === 'grow' && pf) { const from = slot(prev.b, pf[0], pf[1]), e = T.ease(t); x = T.lerp(from.x, to.x, e); y = T.lerp(from.y, to.y, e); }
      if (frame.type === 'insert' && k === frame.key) { const e = T.ease(t); x = T.lerp(14, to.x, e); y = T.lerp(12, to.y, e); }
      const hot = frame.type === 'insert' && k === frame.key;
      T.rr(g, x, y + 1, cw, ch, 4, hue(k), hot ? '#fff' : null, 2);
      if (cw >= 34) T.text(g, k.slice(0, 5), x + cw / 2, y + 11, { size: 10, weight: 700, color: '#0b0e14', align: 'center' });
    });
    // chain length badges
    for (let i = 0; i < frame.b; i++) { const L = frame.tab[i].length; if (L >= 4) { const s = slot(frame.b, i, L); T.text(g, '×' + L, Math.min(s.x + 2, 12 + colW - 36), s.y + 12, { size: 12, weight: 700, color: L >= 6 ? C.bad : C.warn }); } }
  }
});
