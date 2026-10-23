const PHASE = { ss: ['Slow start', '#6ea8ff'], ca: ['Congestion avoidance', '#4ade80'], fr: ['Fast recovery', '#fbbf24'], to: ['Timeout', '#ff5d6c'], ig: ['Ignoring loss', '#ff5d6c'] };
Tinkertoy({
  rate: 3,
  breakOn: 'The sender keeps growing its window no matter what. Past capacity the buffer overflows, dropped packets get resent, and useful throughput collapses.',
  breakOff: 'Normal run: TCP Reno-style. Slow start, then +1 per round trip, and halve on loss.',
  fmt: { loss: v => v.toFixed(1) + ' %' },
  build(p, broken) {
    const R = 50, rnd = T.rng(11), frames = []; let cwnd = 1, ss = p.ssthresh, phase = 'ss', losses = 0, total = 0;
    for (let r = 0; r < R; r++) {
      const sent = cwnd, over = sent > p.cap, rl = p.loss > 0 && rnd() < 1 - Math.pow(1 - p.loss / 100, sent);
      let delivered = over ? p.cap : sent, msg = '', ev = null, bad = false;
      if (over && broken) delivered = Math.round(p.cap * Math.pow(p.cap / sent, 2));
      else if (rl) delivered = Math.max(0, delivered - 1);
      total += delivered;
      const head = `Round trip ${r + 1}: sending <b>${sent}</b> packet${sent > 1 ? 's' : ''}. `;
      if (broken) {
        phase = over ? 'ig' : cwnd < ss ? 'ss' : 'ca';
        if (over) { ev = 'loss'; losses++; bad = true; msg = head + `Capacity is ${p.cap}, so <b>${sent - p.cap}</b> packets are dropped. The sender <b>ignores</b> this and resends them on top of new data, so the useful goodput falls to <b>${delivered}</b>.`; }
        else msg = head + (phase === 'ss' ? 'Slow start: window doubles.' : 'Congestion avoidance: +1.');
        cwnd = cwnd < ss ? Math.min(cwnd * 2, Math.max(ss, cwnd + 1)) : cwnd + 1;
        if (cwnd >= ss && phase === 'ss') phase = 'ca';
      } else if (over || rl) {
        ev = 'loss'; losses++;
        const why = over ? `the bottleneck holds ${p.cap}, so <b>${sent - p.cap}</b> packets were dropped` : 'a packet was randomly lost';
        if (sent >= 4) { ss = Math.max(2, Math.floor(cwnd / 2)); msg = head + `Loss: ${why}. Three duplicate ACKs → <b>fast retransmit</b>. Halve: ssthresh = cwnd = <b>${ss}</b>.`; cwnd = ss; phase = 'fr'; }
        else { ss = Math.max(2, Math.floor(cwnd / 2)); msg = head + `Loss with too few packets in flight for duplicate ACKs → <b>timeout</b>. ssthresh = ${ss}, cwnd back to <b>1</b>.`; cwnd = 1; phase = 'to'; ev = 'timeout'; }
        bad = true;
      } else {
        if (cwnd < ss) { msg = head + `<b>Slow start</b>: every ACK adds a packet, so the window <b>doubles</b>.`; phase = 'ss'; cwnd = Math.min(cwnd * 2, ss); if (cwnd >= ss) phase = 'ca'; }
        else { msg = head + `<b>Congestion avoidance</b>: no loss, so add just <b>1</b> packet per round trip.`; phase = 'ca'; cwnd += 1; }
      }
      frames.push({ r, sent, ss: broken ? p.ssthresh : ss, phase, delivered, ev, bad, msg, cap: p.cap, stats: [['Window (cwnd)', sent], ['ssthresh', broken ? '–' : ss], ['Phase', PHASE[phase][0]], ['Goodput', delivered + ' / RTT', delivered < p.cap * 0.6 && r > 6 ? 'bad' : 'ok'], ['Loss events', losses, losses ? 'warn' : '']] });
    }
    const last = frames[R - 1]; last.msg += ` <i>Total delivered over ${R} round trips: <b>${total}</b> packets (the link could carry ${p.cap * R}).</i>`;
    frames.forEach(f => (f.total = total));
    return frames;
  },
  height: W => (W < 560 ? 330 : 400),
  draw({ g, W, H, frame, prev, frames, i, t, p, T, C }) {
    const L = 46, Rr = 16, Tp = 30, Bt = 48, cw = W - L - Rr, ch = H - Tp - Bt, N = frames.length;
    const ymax = Math.ceil(Math.max(p.cap * 1.4, ...frames.map(f => f.sent)) * 1.02 / 20) * 20;
    const X = r => L + (r / N) * cw, Y = v => Tp + ch - (v / ymax) * ch;
    // grid + axis
    for (let k = 0; k <= 4; k++) { const v = (ymax / 4) * k; T.line(g, L, Y(v), W - Rr, Y(v), '#1f2740'); T.text(g, String(Math.round(v)), L - 8, Y(v), { size: 11, color: C.mut, align: 'right' }); }
    T.text(g, 'packets per round trip', L, 14, { size: 11, color: C.mut });
    T.text(g, 'round trips →', W - Rr, H - 10, { size: 11, color: C.mut, align: 'right' });
    // capacity + ssthresh
    T.line(g, L, Y(p.cap), W - Rr, Y(p.cap), C.bad, 1.5, [6, 4]);
    T.text(g, 'bottleneck capacity ' + p.cap, W - Rr - 4, Y(p.cap) - 9, { size: 11, color: C.bad, align: 'right', weight: 600 });
    // bars: delivered (goodput) and cwnd
    const bw = Math.max(2, cw / N - 2);
    for (let k = 0; k <= i; k++) {
      const f = frames[k], e = k === i ? T.ease(t) : 1, ph = PHASE[f.phase][1];
      const sv = f.sent * e, dv = f.delivered * e;
      g.globalAlpha = 0.28; T.rr(g, X(k), Y(sv), bw, Y(0) - Y(sv), 2, ph); g.globalAlpha = 1;
      T.rr(g, X(k), Y(dv), bw, Math.max(0, Y(0) - Y(dv)), 2, C.teal);
      if (k < i || t > 0.6) { g.fillStyle = ph; g.fillRect(X(k), H - Bt + 14, bw + 2, 7); }
    }
    // cwnd line
    g.beginPath(); for (let k = 0; k <= i; k++) { const f = frames[k], e = k === i ? T.ease(t) : 1, x = X(k) + bw / 2, y = Y(f.sent * e); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
    // ssthresh
    g.beginPath(); for (let k = 0; k <= i; k++) { const x = X(k) + bw / 2, y = Y(frames[k].ss); if (k) g.lineTo(x, Y(frames[k - 1].ss)); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.setLineDash([3, 3]); g.strokeStyle = C.warn; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
    // loss markers
    for (let k = 0; k <= i; k++) if (frames[k].ev) T.text(g, frames[k].ev === 'timeout' ? '⏱' : '✕', X(k) + bw / 2, Y(frames[k].sent) - 10, { size: 12, color: C.bad, align: 'center', weight: 700 });
    // legend
    let lx = L + 6; const ly = H - 18;
    [['window (cwnd)', '#fff'], ['goodput delivered', C.teal], ['ssthresh', C.warn]].forEach(([s, c]) => { T.rr(g, lx, ly - 5, 14, 4, 2, c); T.text(g, s, lx + 20, ly - 3, { size: 11, color: C.mut }); lx += 28 + s.length * 6.3; });
    T.text(g, PHASE[frame.phase][0], L + 4, Tp + 8, { size: 13, weight: 700, color: PHASE[frame.phase][1] });
  }
});
