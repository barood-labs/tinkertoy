// 1) build(params, broken) -> frames[]   pure + deterministic (use T.rng(seed) for randomness)
// 2) draw(ctx)            -> paints frame ctx.frame, tweening from ctx.prev with ctx.t (0..1)
Tinkertoy({
  rate: 8, // frames per second at 1x
  breakOn: 'The worker hangs from tick 10 to 19, and the backlog piles up.',
  breakOff: 'Normal run: the worker is healthy.',
  build(p, broken) {
    const frames = []; let q = 0;
    for (let t = 0; t < 40; t++) {
      const stalled = broken && t >= 10 && t < 20;
      q += p.arrive; const done = stalled ? 0 : Math.min(q, p.serve); q -= done;
      frames.push({
        q, msg: stalled ? `Tick ${t}: the worker is <b>stalled</b>, so ${q} jobs are waiting.` : `Tick ${t}: ${p.arrive} arrive, ${done} finish, ${q} waiting.`,
        bad: stalled, stats: [['Tick', t], ['Backlog', q, q > 20 ? 'bad' : q > 8 ? 'warn' : 'ok'], ['Net / tick', p.arrive - p.serve]]
      });
    }
    return frames;
  },
  draw({ g, W, H, frame, frames, i, t, T }) {
    const max = Math.max(10, ...frames.map(f => f.q)), bw = (W - 40) / frames.length;
    for (let k = 0; k <= i; k++) {
      const v = k === i ? T.lerp(frames[Math.max(0, i - 1)].q, frames[i].q, T.ease(t)) : frames[k].q, h = (v / max) * (H - 50);
      T.rr(g, 20 + k * bw, H - 25 - h, bw - 2, Math.max(2, h), 2, k === i ? T.C.acc : '#3b4a72');
    }
    T.text(g, 'jobs waiting', 20, 14, { color: T.C.mut, size: 12 });
  }
});
