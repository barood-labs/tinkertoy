// Renders docs/hero.gif (+ .webm) from the real examples: deterministic frames via the window.tinkertoy API,
// screenshotted in headless Chrome and encoded with ffmpeg. Run under `flock` on a shared machine.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FPS = Number(process.env.FPS || 10), OUT = process.env.HERO_TMP || '/tmp/tinkertoy-hero';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
mkdirSync(resolve(root, 'docs'), { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let n = 0;

async function scene(id, steps) {
  const p = await b.newPage({ viewport: { width: 940, height: 900 } });
  await p.goto('file://' + resolve(root, `examples/${id}.html`) + '?autoplay=0');
  await p.waitForFunction(() => window.tinkertoy);
  await p.addStyleTag({ content: '.back{display:none!important}' });
  const box = await p.evaluate(() => { const a = document.querySelector('header').getBoundingClientRect(); return { x: 0, y: Math.max(0, a.top - 8), width: innerWidth, height: 860 }; });
  const shot = async () => { await p.screenshot({ path: `${OUT}/f${String(n++).padStart(4, '0')}.png`, clip: box }); };
  for (const s of steps) await s(p, shot);
  await p.close();
  return box;
}
// helpers: each returns a step(p, shot)
const play = (seconds, from = 0, to = 1) => async (p, shot) => { const N = Math.round(seconds * FPS); for (let i = 0; i <= N; i++) { await p.evaluate(([f, t, k]) => { const T = window.tinkertoy; T.seek((f + (t - f) * k) * (T.steps - 1)); }, [from, to, i / N]); await shot(); } };
const sweep = (id, values, seconds) => async (p, shot) => { const N = Math.round(seconds * FPS); for (let i = 0; i <= N; i++) { const k = i / N, seg = Math.min(values.length - 2, Math.floor(k * (values.length - 1))), u = k * (values.length - 1) - seg, v = values[seg] + (values[seg + 1] - values[seg]) * u; await p.evaluate(([i2, v2]) => { window.tinkertoy.setParam(i2, Math.round(v2)); window.tinkertoy.seek(window.tinkertoy.steps - 1); }, [id, v]); await shot(); } };
const breakIt = on => async (p, shot) => { await p.evaluate(o => window.tinkertoy.setBreak(o), on); await shot(); };
const hold = seconds => async (p, shot) => { for (let i = 0; i < Math.round(seconds * FPS); i++) await shot(); };

await scene('tcp', [play(3.4), hold(0.4), sweep('cap', [40, 24, 56, 40], 2.2), hold(0.3), breakIt(true), play(3, 0, 1), hold(1.2)]);
await scene('hashtable', [breakIt(false), play(2.6), hold(0.3), breakIt(true), play(2.6), hold(1.2)]);
await b.close();

const W = process.env.W || 720;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${OUT}/f%04d.png`, '-vf', `scale=${W}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, resolve(root, 'docs/hero.gif')]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${OUT}/f%04d.png`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p', resolve(root, 'docs/hero.webm')]);
console.log('frames', n);
