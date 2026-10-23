const P = 23, G = 5, M_SEC = 7, REQ = 'GET /login?pw=hunter2', RES = 'HTTP/1.1 200 OK  Welcome';
const modpow = (b, e, m) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; } return r; };
const cipher = (txt, S) => { let ks = (S * 2654435761) >>> 0; const out = []; for (let i = 0; i < txt.length; i++) { ks = (Math.imul(ks, 1103515245) + 12345) & 0x7fffffff; out.push((txt.charCodeAt(i) ^ ((ks >> 16) & 255)).toString(16).padStart(2, '0')); } return out; };

Tinkertoy({
  rate: 1.4,
  breakOn: 'Mallory sits on the path and answers with her own key share and a forged certificate. The browser has verification switched off (like curl -k), so it accepts it.',
  breakOff: 'Normal run: Eve can watch every packet, but only sees public numbers and then ciphertext.',
  fmt: { rtt: v => v + ' ms', ver: v => '1.' + v },
  posLabel: (f, i, n) => `step ${i} / ${n - 1}`,
  build(p, broken) {
    const A = modpow(G, p.a, P), B = modpow(G, p.b, P), Mk = modpow(G, M_SEC, P);
    const Sc = broken ? modpow(Mk, p.a, P) : modpow(B, p.a, P), Ss = broken ? modpow(Mk, p.b, P) : modpow(A, p.b, P);
    const half = p.rtt / 2, v13 = p.ver === 3;
    const frames = []; let clock = 0, known = { c: false, s: false };
    const stats = () => [['Elapsed', Math.round(clock) + ' ms'], ['Round trips', (clock / p.rtt).toFixed(1)], ['Browser key S', known.c ? Sc : '?', known.c && broken ? 'bad' : known.c ? 'ok' : ''], ['Server key S', known.s ? Ss : '?', known.s && broken ? 'bad' : known.s ? 'ok' : ''], ['Keys match', known.c && known.s ? (Sc === Ss ? 'yes ✓' : 'NO ✗') : '–', known.c && known.s ? (Sc === Ss ? 'ok' : 'bad') : '']];
    const add = f => { frames.push({ ...f, clock, stats: stats(), bad: !!f.bad }); };
    const msg = (dir, label, sub, enc, cap, wire, extra = {}) => { clock += half; add({ k: 'msg', dir, label, sub, enc, msg: cap, wire, ...extra }); };
    const local = (who, label, cap, extra = {}) => add({ k: 'local', who, label, msg: cap, ...extra });
    add({ k: 'start', msg: `You open <b>shop.example</b> in the address bar. The browser needs a TCP connection, then a TLS handshake, then it can finally send the HTTP request. ${broken ? '<b>Mallory</b> is sitting on the network path.' : '<b>Eve</b> can see every packet, but she can only watch.'}`, stats: stats() });
    msg(1, 'SYN', 'TCP: open a connection', false, 'TCP handshake, part 1: the browser says <b>SYN</b>. This costs one round trip before TLS can even begin.', ['TCP SYN']);
    msg(-1, 'SYN-ACK', 'TCP: okay, go', false, 'The server answers <b>SYN-ACK</b>. (The browser\'s ACK rides along with the next message.)', ['TCP SYN-ACK']);
    msg(1, 'ClientHello', v13 ? `ciphers, key_share A=${A}` : 'ciphers, client random', false,
      v13 ? `The browser picks a secret <b>a = ${p.a}</b> and sends <b>A = g^a mod p = ${G}^${p.a} mod ${P} = ${A}</b> in its ClientHello, plus the ciphers it supports. The secret itself never leaves the browser.` : `ClientHello: supported TLS versions, cipher suites and a random number. In TLS 1.2 the key shares come in the <i>next</i> messages, which costs an extra round trip.`,
      ['ClientHello  TLS 1.' + p.ver, 'ciphers: AES-GCM, ChaCha20', v13 ? 'key_share A=' + A : 'random=0x9c4e…']);
    if (v13) {
      known.s = true;
      msg(-1, broken ? 'ServerHello + 🔒{forged cert}' : 'ServerHello + 🔒{Certificate, Finished}', `key_share B=${broken ? Mk : B}`, true,
        broken ? `<b>Mallory intercepts</b> and replies as the server with <b>her</b> key share M = ${G}^${M_SEC} mod ${P} = ${Mk}, and a <b>forged certificate</b>. The real server never sees the browser's traffic.` : `The server picked <b>b = ${p.b}</b> and replies with <b>B = ${G}^${p.b} mod ${P} = ${B}</b>. It already computed <b>S = A^b mod p = ${Ss}</b>, so everything after ServerHello (its certificate and Finished) is already encrypted.`,
        ['ServerHello  key_share B=' + (broken ? Mk : B), '… ' + cipher('Certificate shop.example + Finished', Ss).slice(0, 12).join(' ') + ' …'], { via: broken });
      known.c = true;
      local('both', `🔑 S = ${broken ? Sc + ' (browser) ≠ ' + Ss + ' (server)' : Sc + ' on both sides'}`, broken ? `The browser computes <b>S = ${broken ? 'M' : 'B'}^a mod p = ${Sc}</b>. Meanwhile the real server derived <b>${Ss}</b> from Mallory's key share. <b>The two sides do not share a key</b>: Mallory shares one with each.` : `The browser computes <b>S = B^a mod p = ${B}^${p.a} mod ${P} = ${Sc}</b>. The server got <b>${Ss}</b> from <b>A^b</b>. They match, and Eve, who saw only A=${A} and B=${B}, can't get it without a or b.`, { bad: broken });
      local('c', broken ? '⚠ certificate NOT checked' : '✓ certificate verified', broken ? `Verification is <b>off</b> (like <code>curl -k</code> or clicking through the warning), so the forged certificate is accepted. With checks on, the browser would see the name and signature don't match a trusted CA and <b>abort</b>.` : `The browser checks the certificate: signed by a CA it trusts, name matches <b>shop.example</b>, not expired. The server's Finished message proves it holds the matching private key.`, { bad: broken });
      msg(1, 'Finished + 🔒 GET /login', 'handshake done, request sent', true, broken ? `The browser sends its Finished and the HTTP request. <b>Mallory decrypts it with ${Sc}</b>: <b>“${REQ}”</b>. She re-encrypts it with ${Ss} and forwards it, so the server never notices.` : `The browser sends Finished and the request <i>in the same flight</i>, encrypted with S=${Sc}. The handshake took <b>one round trip</b>. Eve only sees ciphertext.`,
        ['encrypted: ' + cipher(REQ, Sc).slice(0, 14).join(' ') + ' …'], { via: broken, leak: broken ? REQ : null, S: Sc });
    } else {
      msg(-1, broken ? 'ServerHello, forged cert, M' : 'ServerHello, Certificate, B', broken ? `key share B=${Mk}` : `ServerKeyExchange B=${B}, HelloDone`, false,
        broken ? `<b>Mallory intercepts</b> and answers as the server: her certificate (forged) and her key share <b>M = ${Mk}</b>.` : `The server sends its <b>certificate</b> and its key share <b>B = ${G}^${p.b} mod ${P} = ${B}</b> (signed with its private key). That is a lot to learn before the browser can reply.`,
        ['ServerHello', 'Certificate: shop.example', 'ServerKeyExchange B=' + (broken ? Mk : B)], { via: broken });
      local('c', broken ? '⚠ certificate NOT checked' : '✓ certificate verified', broken ? 'Verification is <b>off</b>, so the forged certificate is accepted.' : 'The browser verifies the certificate chain and that the key share was signed by the certificate\'s key.', { bad: broken });
      known.c = true;
      msg(1, 'ClientKeyExchange A + Finished', `A=${A}, ChangeCipherSpec`, false, `The browser picks <b>a = ${p.a}</b> and sends <b>A = ${G}^${p.a} mod ${P} = ${A}</b>, then switches to encryption.`, ['ClientKeyExchange A=' + A, 'ChangeCipherSpec', 'Finished (🔒)'], { via: broken });
      known.s = true;
      local('both', `🔑 S = ${broken ? Sc + ' (browser) ≠ ' + Ss + ' (server)' : Sc + ' on both sides'}`, broken ? `The two sides derive <b>different</b> keys, ${Sc} and ${Ss}. Mallory shares one with each.` : `Both compute <b>S = ${Sc}</b>: browser <b>B^a</b>, server <b>A^b</b>. Eve saw A=${A} and B=${B} but not a or b.`, { bad: broken });
      msg(-1, 'ChangeCipherSpec + Finished', '🔒 server is ready', true, 'The server confirms with its own encrypted Finished. <b>Two round trips</b> of handshake so far, one more than TLS 1.3.', ['encrypted: ' + cipher('Finished', Ss).slice(0, 14).join(' ')], { via: broken });
      msg(1, '🔒 GET /login', 'HTTP request', true, broken ? `Mallory decrypts the request with ${Sc}: <b>“${REQ}”</b>, re-encrypts it and forwards it.` : `Finally the HTTP request goes out, encrypted with S=${Sc}.`, ['encrypted: ' + cipher(REQ, Sc).slice(0, 14).join(' ') + ' …'], { via: broken, leak: broken ? REQ : null, S: Sc });
    }
    msg(-1, '🔒 200 OK + page', 'first byte arrives', true, `<b>First byte of the page arrives after ${Math.round(clock + half)} ms</b> = ${((clock + half) / p.rtt).toFixed(1)} round trips (${p.ver === 3 ? '1 TCP + 1 TLS + 1 HTTP' : '1 TCP + 2 TLS + 1 HTTP'}). ${broken ? '<b>Mallory read and could change everything.</b>' : 'Nobody on the path saw anything useful.'}`, ['encrypted: ' + cipher(RES, Ss).slice(0, 14).join(' ') + ' …'], { via: broken, bad: broken });
    frames[frames.length - 1].clock = clock; frames[frames.length - 1].stats = stats();
    return frames;
  },
  height(W, { frames }) { const rows = frames.length - 1; return 74 + rows * 40 + 92; },
  draw({ g, W, H, frame, prev, frames, i, t, broken, T, C }) {
    const small = W < 560, cx = small ? 52 : 96, sx = W - cx, mx = W / 2, top = 70, rowH = 40;
    const lanes = [[cx, 'Browser', C.acc], [mx, broken ? (small ? 'Mallory (MITM)' : 'Mallory (active attacker)') : 'Eve (can only watch)', broken ? C.bad : C.mut], [sx, 'Server', C.ok]];
    lanes.forEach(([x, name, col], li) => { const bw = li === 1 ? (small ? 112 : 172) : (small ? 92 : 140); T.rr(g, x - bw / 2, 14, bw, 28, 8, '#1a2133', col); T.text(g, name, x, 28, { size: small ? 10.5 : 12.5, weight: 700, color: col, align: 'center' }); T.line(g, x, 44, x, H - 96, '#2a3454', 1.5, [4, 5]); });
    let row = 0;
    for (let k = 1; k <= i; k++) {
      const f = frames[k], y = top + row * rowH + 16, e = k === i ? T.ease(t) : 1; row++;
      T.text(g, Math.round(f.clock) + 'ms', 4, y - 12, { size: 9.5, color: '#566182', mono: true });
      if (f.k === 'msg') {
        const x1 = f.dir > 0 ? cx : sx, x2 = f.dir > 0 ? sx : cx, xe = T.lerp(x1, x2, e), col = f.enc ? C.teal : f.via ? C.bad : C.pur;
        if (f.via) { const xm = Math.abs(xe - x1) < Math.abs(mx - x1) ? xe : mx; T.arrow(g, x1, y, xm, y, col, 2); if (e > 0.5) T.arrow(g, mx, y, xe, y, '#ff9aa5', 2); T.circle(g, mx, y, 4, C.bad); }
        else T.arrow(g, x1, y, xe, y, col, 2);
        g.globalAlpha = e; 
        T.text(g, f.label, mx, y - 9, { size: small ? 10.5 : 12, weight: 700, color: f.enc ? C.teal : C.text, align: 'center' });
        if (!small) T.text(g, f.sub, mx, y + 11, { size: 10.5, color: C.mut, align: 'center' });
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = e;
        const bx = f.who === 'both' ? cx - 20 : f.who === 'c' ? cx - 20 : sx - 140, bw = f.who === 'both' ? sx - cx + 40 : small ? 190 : 250, col = f.bad ? C.bad : C.ok;
        T.rr(g, f.who === 's' ? sx - bw + 20 : bx, y - 14, bw, 28, 8, f.bad ? 'rgba(255,93,108,.14)' : 'rgba(74,222,128,.10)', col, 1.5);
        T.text(g, f.label, f.who === 's' ? sx - bw / 2 + 20 : bx + bw / 2, y, { size: small ? 10.5 : 12.5, weight: 700, color: col, align: 'center' });
        g.globalAlpha = 1;
      }
    }
    // wire panel
    const cur = frame.k === 'msg' ? frame : null, py = H - 84, ph = 74;
    T.rr(g, 10, py, W - 20, ph, 10, '#0e1320', broken ? '#5a2535' : '#262f45');
    T.text(g, broken ? 'WHAT MALLORY SEES' : 'WHAT EVE SEES ON THE WIRE', 22, py + 14, { size: 10.5, weight: 700, color: broken ? C.bad : C.mut });
    if (cur) {
      const hexLine = (cur.wire[cur.wire.length - 1] || '');
      cur.wire.forEach((s, k) => T.text(g, s.length > (small ? 44 : 100) ? s.slice(0, small ? 44 : 100) + '…' : s, 22, py + 32 + k * 14, { mono: true, size: small ? 10 : 11.5, color: s.startsWith('encrypted') ? C.teal : '#c9d3f0' }));
      if (cur.leak) T.text(g, '🔓 decrypted with key ' + cur.S + ':  "' + cur.leak + '"', 22, py + 32 + cur.wire.length * 14 + 4, { mono: true, size: small ? 10 : 12, weight: 700, color: C.bad });
      else if (cur.enc && !broken) T.text(g, 'without the key S this is noise to Eve', 22, py + 32 + cur.wire.length * 14 + 4, { size: 11, color: C.mut });
      if (!cur.leak && broken) { const lf = frames.slice(0, i + 1).find(x => x.leak); if (lf) T.text(g, '🔓 Mallory already read:  "' + lf.leak + '"', 22, py + 32 + cur.wire.length * 14 + 4, { mono: true, size: small ? 10 : 12, weight: 700, color: C.bad }); }
    } else T.text(g, frame.k === 'start' ? 'nothing sent yet' : 'local computation, nothing on the wire', 22, py + 38, { size: 12, color: C.mut });
  }
});
