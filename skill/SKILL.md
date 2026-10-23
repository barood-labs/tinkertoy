---
name: tinkertoy
description: Answer "how does X work?", "explain X", "why does X happen" or "what goes wrong if X fails" by building ONE self-contained, offline HTML file with a live simulation: sliders to change the inputs, a play/step/scrub timeline, a "break it" button that triggers a real failure mode, and a clear visual. Use it for systems, algorithms, protocols and processes that are easier to understand by playing with them than by reading about them. Do not use it for plain factual lookups or for code changes.
---

# tinkertoy

Instead of writing three paragraphs about how something works, build a toy the reader can **play with**.
The deliverable is exactly one `.html` file that works offline by double-clicking it.

## When to use it

Use it when the question is about *behaviour over time or under changing inputs*: hash table resizing, TCP congestion control, leader election, a TLS handshake, garbage collection, a rate limiter, a cache, a scheduler, a database index, a CPU pipeline.

Skip it for definitions, API lookups, "which library should I use", or when the user clearly just wants a short text answer.

## How to build one

1. **Pick the one idea.** Name the single behaviour the reader should *feel*. A tinkertoy explains one thing well; it is not a textbook.
2. **Pick 2 to 5 parameters** that change that behaviour (sizes, rates, timeouts, counts, a seed). Each becomes a slider with a plain-English label and units.
3. **Pick one failure mode** for the *Break it* button: the thing that really goes wrong when a key mechanism is removed or fails (never resize, ignore loss, skip certificate checks, forget a root, crash the leader). It must visibly change the picture and the numbers.
4. **Copy `template.html`** (in this skill's folder) to the output path and edit it. Keep the runtime block as is, and change:
   - the `<title>`, the `<h1>`, the `.sub` line and the canvas `aria-label`,
   - the parameter sliders (see *Parameters* below),
   - the break button text and `#breakinfo`,
   - the *What to notice* list,
   - the `Tinkertoy({ ... })` call at the bottom, which is the actual simulation.
5. **Write `build(p, broken)`** as a pure function that returns an array of frames. Write `draw(ctx)` to paint one frame on the canvas.
6. **Validate** (see *Check your work*), fix every error, then tell the user the path.

Output path: `./tinkertoys/<topic-slug>.html` unless the user asked for somewhere else. Do **not** start a server, and do not open a browser unless asked; say how to open it (`open tinkertoys/<file>.html` / double-click).

## The runtime API (already in the template)

```js
Tinkertoy({
  rate: 4,                       // frames per second at 1x speed
  breakOn:  'what broke, in one or two sentences',
  breakOff: 'what normal looks like',
  fmt: { size: v => v + ' KB' }, // optional: format a slider's value readout, keyed by slider id
  minWidth: 0,                   // optional: canvas gets horizontal scroll below this width
  height: (W, { params, frames }) => W * 0.5,  // optional canvas height
  build(p, broken) { /* → frames[] */ },
  draw({ g, W, H, frame, prev, frames, i, t, n, p, broken, T, C }) { /* paint */ },
});
```

- **`p`** holds the current slider values, keyed by slider `id`.
- **A frame** is any object you like plus: `msg` (HTML caption for that step, one or two sentences that explain *what just happened and why*), `bad` (true paints the caption red), `stats` (an array of `[label, value, tone]` where tone is `ok`, `warn`, `bad` or empty; 3 to 5 cards).
- **`draw`** gets `frame` (the settled frame at index `i`) and `t` in 0..1, the tween from frame `i-1` to `i`. Use `T.lerp(prev.x, frame.x, T.ease(t))` to animate. At integer scrub positions `t` is 1, so what you draw is exactly the frame.
- **`T`** helpers: `T.rng(seed)` (seeded random), `T.hash(str)`, `T.lerp`, `T.ease`, `T.clamp`, `T.rr` (rounded rect), `T.text`, `T.line`, `T.arrow`, `T.circle`. **`C`** has the palette (`C.acc`, `C.ok`, `C.bad`, `C.warn`, `C.mut`, `C.teal`, `C.pur`, `C.text`).
- The runtime provides play/pause, step, back, scrub, speed, keyboard shortcuts, URL-hash state and `window.tinkertoy` (`seek`, `setParam`, `setBreak`, `frames()`, `state`) for tests.

### Parameters

Each slider is plain HTML. `id` is the key in `p`; keep `data-param`:

```html
<div class="param">
  <label for="load">Load factor limit</label><output for="load"></output>
  <input type="range" id="load" data-param min="0.5" max="2" step="0.05" value="0.75">
</div>
```

## Output rules (strict)

These are checked by `tinkertoy validate`. Do not bend them.

1. **One file.** All HTML, CSS and JavaScript inline. No CDN, no `<script src>`, no `<link>`, no web fonts, no images by URL, no `fetch`, no `import`. It must work with the network unplugged. Draw with canvas or inline SVG.
2. **Interactive, not animated.** At least one parameter slider (aim for 2 to 5), the scrub bar (`#scrub`), play and step buttons, and one **Break it** button (`#break`). If any is missing it is not a tinkertoy.
3. **Deterministic.** The same sliders and break state always give the same frames. Use `T.rng(seed)`; never `Math.random()` or the clock inside `build`. If randomness matters, expose the seed as a slider.
4. **`build` is pure, `draw` only paints.** `build` computes every frame up front from `p` and `broken`. `draw` never mutates state. That is what makes scrubbing backwards correct.
5. **Honest model.** It is a simplified model, and it must say so (the footer already does). Do not invent numbers. If a curve is illustrative, label it "illustrative". Toy sizes (a 23-element prime, 5 nodes) are fine when labelled as toy.
6. **The break must teach.** Show *why* it fails, not just that it fails: the numbers go bad (`stats` tone `bad`), the picture changes, and the caption names the cause. The button toggles; un-breaking restores normal.
7. **Every frame explains itself.** The `msg` caption tells the reader what happened at this step and why, in plain language. A reader who never touches a slider should still learn from stepping through.
8. **Readable at 390 px wide.** Keep the viewport meta. Use `minWidth` for wide diagrams instead of squashing them. Text on the canvas at least 10 px. Keep the template's controls: they are sized for touch.
9. **Accessible basics.** Every slider has a `<label for>`. The canvas has an `aria-label` that says what it shows. Respect `prefers-reduced-motion` (the runtime skips autoplay).
10. **Small and calm.** Under about 100 KB. 20 to 120 frames. Dark theme and the template's styles. No sound, no popups, no tracking.

## Check your work

1. Run the validator and fix every error and, ideally, every warning:
   ```bash
   npx @barood-labs/tinkertoy validate tinkertoys/<file>.html
   ```
   If the package isn't available, check the rules in [CHECKLIST.md](CHECKLIST.md) by hand.
2. If you can run a browser, add `--run` (needs `playwright-core` and Chrome) to load the file and fail on console errors. Otherwise at least reread your JavaScript for typos.
3. Walk the [CHECKLIST.md](CHECKLIST.md): defaults look healthy, extreme slider values don't crash, break and un-break both work, step 0 and the last step both look right.

## What to say to the user

Keep the chat reply short. The sim is the explanation. Give: the file path, one sentence on what it shows, and two things to try ("drag X to the right", "press Break it"). Mention it is a simplified model. Do not paste the HTML into the chat.
