const ROLE = { F: ['follower', '#5b6b94'], C: ['candidate', '#fbbf24'], L: ['LEADER', '#4ade80'] };
const KIND = { RV: '#b794f6', VR: '#2dd4bf', AE: '#6ea8ff' };
const sid = i => 'S' + (i + 1);
Tinkertoy({
  rate: 25,
  breakOn: 'The leader crashes 600 ms after it wins, and comes back 1.6 s later. Followers stop hearing heartbeats, so a new election starts.',
  breakOff: 'Normal run: a leader is elected and heartbeats keep the cluster stable.',
  fmt: { timeout: v => v + ' ms', spread: v => '+0…' + v + ' ms', latency: v => v + ' ms' },
  posLabel: f => f.time + ' ms',
  build(p, broken) {
    const N = p.nodes, rnd = T.rng(p.seed * 7919 + 13), END = 3600, DT = 20, HB = 60;
    const nodes = Array.from({ length: N }, (_, i) => ({ id: i, role: 'F', term: 0, voted: -1, votes: 0, alive: true, reset: 0, deadline: 0 }));
    const evq = []; let seq = 0, msgs = [], log = [], elections = 0, leaderless = 0, crashPlanned = false, last = null;
    const sched = (time, fn) => evq.push({ time, seq: seq++, fn });
    const delay = () => p.latency + Math.floor(rnd() * p.latency * 0.5);
    const toDur = () => p.timeout + Math.floor(rnd() * (p.spread + 1));
    const note = (time, text, tone) => { last = { time, text, tone }; log.push(last); if (log.length > 6) log.shift(); };
    const resetTimer = (n, now) => { n.reset = now; const d = now + toDur(); n.deadline = d; sched(d, () => { if (n.alive && n.deadline === d && n.role !== 'L') startElection(n, d); }); };
    const send = (from, to, kind, term, now, granted) => { const d = delay(); msgs.push({ from, to, kind, t0: now, t1: now + d, granted }); sched(now + d, () => deliver(from, to, kind, term, now + d, granted)); };
    function startElection(n, now) {
      const split = n.role === 'C';
      n.term++; n.role = 'C'; n.voted = n.id; n.votes = 1; elections++;
      note(now, split ? `${sid(n.id)}: no winner last time (a <b>split vote</b>). Timer expired again, so it tries <b>term ${n.term}</b>.` : `${sid(n.id)}'s election timer expired with no heartbeat. It becomes a <b>candidate for term ${n.term}</b>, votes for itself and asks everyone for votes.`, split ? 'bad' : 'warn');
      resetTimer(n, now);
      for (const m of nodes) if (m.id !== n.id) send(n.id, m.id, 'RV', n.term, now);
    }
    function becomeLeader(n, now) {
      n.role = 'L'; n.deadline = Infinity;
      note(now, `${sid(n.id)} has <b>${n.votes} of ${N}</b> votes, a majority. It is <b>LEADER of term ${n.term}</b> and starts sending heartbeats.`, 'ok');
      const hb = (at) => { if (!n.alive || n.role !== 'L') return; for (const m of nodes) if (m.id !== n.id) send(n.id, m.id, 'AE', n.term, at); sched(at + HB, () => hb(at + HB)); };
      hb(now);
      if (broken && !crashPlanned) { crashPlanned = true; sched(now + 600, () => { n.alive = false; n.role = 'F'; note(now + 600, `💥 <b>${sid(n.id)} (the leader) crashes.</b> Nobody is sending heartbeats any more.`, 'bad'); sched(now + 600 + 1600, () => { n.alive = true; n.role = 'F'; note(now + 2200, `${sid(n.id)} reboots as a follower (it still thinks it is in term ${n.term}).`, 'warn'); resetTimer(n, now + 2200); }); }); }
    }
    function deliver(from, to, kind, term, now, granted) {
      const m = nodes[to]; if (!m.alive) return;
      if (kind === 'RV') {
        if (term > m.term) { m.term = term; if (m.role === 'L') note(now, `${sid(m.id)} sees a higher term and steps down.`, 'warn'); m.role = 'F'; m.voted = -1; }
        const g = term === m.term && (m.voted === -1 || m.voted === from);
        if (g) { m.voted = from; resetTimer(m, now); note(now, `${sid(m.id)} votes for ${sid(from)} in term ${term}.`, ''); } else note(now, `${sid(m.id)} refuses ${sid(from)}: it already voted in term ${m.term}.`, 'warn');
        send(to, from, 'VR', m.term, now, g);
      } else if (kind === 'VR') {
        if (term > m.term) { m.term = term; m.role = 'F'; m.voted = -1; return; }
        if (m.role === 'C' && term === m.term && granted) { m.votes++; if (m.votes > N / 2) becomeLeader(m, now); }
      } else if (kind === 'AE') {
        if (term >= m.term) {
          if (term > m.term) { m.term = term; m.voted = -1; }
          if (m.role !== 'F') note(now, `${sid(m.id)} hears from the leader of term ${term} and becomes a follower.`, ''); else if (!m.heard) note(now, `${sid(m.id)} hears the first heartbeat. Its timer resets, so it stays a follower.`, '');
          m.heard = true; m.role = 'F'; resetTimer(m, now);
        }
      }
    }
    for (const n of nodes) resetTimer(n, 0);
    const frames = [];
    for (let tick = 0; tick <= END; tick += DT) {
      for (;;) { let bi = -1; for (let k = 0; k < evq.length; k++) if (evq[k].time <= tick && (bi < 0 || evq[k].time < evq[bi].time || (evq[k].time === evq[bi].time && evq[k].seq < evq[bi].seq))) bi = k; if (bi < 0) break; const e = evq.splice(bi, 1)[0]; e.fn(); }
      msgs = msgs.filter(m => m.t1 > tick);
      let leader = -1, maxTerm = 0; for (const n of nodes) { maxTerm = Math.max(maxTerm, n.term); if (n.alive && n.role === 'L' && (leader < 0 || n.term > nodes[leader].term)) leader = n.id; }
      if (leader < 0) leaderless += DT;
      frames.push({
        time: tick, leader, bad: last ? last.tone === 'bad' : false,
        nodes: nodes.map(n => ({ role: n.role, term: n.term, alive: n.alive, reset: n.reset, deadline: n.deadline })),
        msgs: msgs.filter(m => m.t0 <= tick).map(m => ({ ...m })), log: log.map(l => ({ ...l })),
        msg: last ? `<small>${(last.time / 1000).toFixed(2)}s</small> ${last.text}` : 'All nodes start as followers, each with a randomly chosen election timer.',
        stats: [['Time', tick + ' ms'], ['Leader', leader >= 0 ? sid(leader) : 'none', leader >= 0 ? 'ok' : 'bad'], ['Term', maxTerm], ['Elections started', elections], ['Time without leader', leaderless + ' ms', leader < 0 && tick > 0 ? 'bad' : '']]
      });
    }
    return frames;
  },
  height: W => (W >= 760 ? 430 : 560),
  draw({ g, W, H, frame, frames, i, p, T, C }) {
    const wide = W >= 760, ringW = wide ? W * 0.58 : W, ringH = wide ? H - 70 : 330, cx = ringW / 2, cy = ringH / 2 + 8, R = Math.min(ringW * 0.34, ringH * 0.36), N = frame.nodes.length, nr = Math.max(20, Math.min(30, R * 0.2));
    const pos = k => { const a = -Math.PI / 2 + (k / N) * Math.PI * 2; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
    // links
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) { const [x1, y1] = pos(a), [x2, y2] = pos(b); T.line(g, x1, y1, x2, y2, '#1e2640', 1); }
    // messages
    for (const m of frame.msgs) {
      const f = T.clamp((frame.time - m.t0) / (m.t1 - m.t0), 0, 1), [x1, y1] = pos(m.from), [x2, y2] = pos(m.to), x = T.lerp(x1, x2, f), y = T.lerp(y1, y2, f);
      T.circle(g, x, y, m.kind === 'AE' ? 4 : 5.5, m.kind === 'VR' && !m.granted ? C.bad : KIND[m.kind], '#0b0e14', 1.5);
    }
    // nodes
    frame.nodes.forEach((n, k) => {
      const [x, y] = pos(k), col = n.alive ? ROLE[n.role][1] : '#3a1f27';
      if (n.alive && n.role !== 'L' && isFinite(n.deadline)) { const fr = T.clamp((frame.time - n.reset) / (n.deadline - n.reset), 0, 1); g.beginPath(); g.arc(x, y, nr + 6, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2); g.strokeStyle = fr > 0.8 ? C.bad : C.warn; g.lineWidth = 3; g.stroke(); }
      if (n.alive && n.role === 'L') { const ph = (frame.time % 300) / 300; g.globalAlpha = 1 - ph; T.circle(g, x, y, nr + 4 + ph * 14, null, C.ok, 2); g.globalAlpha = 1; }
      T.circle(g, x, y, nr, col, n.alive ? 'rgba(255,255,255,.25)' : C.bad, 2);
      T.text(g, n.alive ? 'S' + (k + 1) : '✕', x, y - 3, { size: 14, weight: 800, color: n.role === 'C' ? '#1b1405' : n.role === 'L' ? '#04150a' : '#fff', align: 'center' });
      T.text(g, n.alive ? 'term ' + n.term : 'crashed', x, y + 12, { size: 9.5, color: n.role === 'C' ? '#1b1405' : n.role === 'L' ? '#04150a' : '#cbd5f5', align: 'center', weight: 600 });
      T.text(g, n.alive ? ROLE[n.role][0] : '', x, y + nr + 16 + (k === 0 ? -nr * 2 - 22 : 0) * 0, { size: 11, color: n.alive ? ROLE[n.role][1] : C.bad, align: 'center', weight: 700 });
    });
    // legend
    let ly = 14; [['vote request', KIND.RV], ['vote reply', KIND.VR], ['heartbeat', KIND.AE]].forEach(([s, c], k) => { T.circle(g, 14 + k * 104, ly, 5, c); T.text(g, s, 24 + k * 104, ly, { size: 11, color: C.mut }); });
    T.text(g, '◔ ring = election timer', 14, 32, { size: 11, color: C.mut });
    // event log
    const lx = wide ? ringW + 6 : 14, lw = wide ? W - ringW - 20 : W - 28, ly0 = wide ? 14 : ringH + 6;
    T.text(g, 'EVENT LOG', lx, ly0 + 4, { size: 11, color: C.mut, weight: 700 });
    frame.log.slice().reverse().forEach((l, k) => {
      const txt = l.text.replace(/<[^>]+>/g, ''), max = Math.floor(lw / 6.7) - 7, lines = [];
      for (let s = txt; s.length;) { let cut = s.length > max ? s.lastIndexOf(' ', max) : s.length; if (cut < 1) cut = max; lines.push(s.slice(0, cut)); s = s.slice(cut).trimStart(); }
      const y0 = ly0 + 24 + k * (wide ? 44 : 20);
      g.globalAlpha = 1 - k * 0.12;
      if (wide) lines.slice(0, 3).forEach((s, q) => T.text(g, (q ? '   ' : (l.time / 1000).toFixed(2) + 's ') + s, lx, y0 + q * 13, { size: 11, mono: true, color: l.tone === 'bad' ? C.bad : l.tone === 'ok' ? C.ok : l.tone === 'warn' ? C.warn : '#aab4d0' }));
      else T.text(g, (l.time / 1000).toFixed(2) + 's ' + lines[0], lx, y0, { size: 11, mono: true, color: l.tone === 'bad' ? C.bad : l.tone === 'ok' ? C.ok : l.tone === 'warn' ? C.warn : '#aab4d0' });
      g.globalAlpha = 1;
    });
    // leadership strip
    const sx = 14, sw = W - 28, sy = H - 34, END = frames[frames.length - 1].time;
    T.text(g, 'who is leader over time (red = no leader)', sx, sy - 12, { size: 11, color: C.mut });
    T.rr(g, sx, sy, sw, 14, 4, '#1b0f14');
    for (let k = 0; k <= i; k++) { const f = frames[k], x = sx + (f.time / END) * sw, w = Math.max(1, (20 / END) * sw + 0.6); g.fillStyle = f.leader < 0 ? C.bad : ['#4ade80', '#2dd4bf', '#6ea8ff', '#b794f6', '#f472b6', '#fbbf24', '#fb923c'][f.leader % 7]; g.fillRect(x, sy, w, 14); if (k > 0 && frames[k - 1].leader !== f.leader && f.leader >= 0) T.text(g, 'S' + (f.leader + 1), x + 3, sy + 7, { size: 10, weight: 800, color: '#06100c' }); }
    T.rr(g, sx + (frame.time / END) * sw - 1, sy - 3, 3, 20, 1, '#fff');
  }
});
