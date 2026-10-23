# tinkertoy checklist

Run through this before telling the user it is done. `tinkertoy validate <file>` covers the first group.

## Machine-checkable (`tinkertoy validate`)
- [ ] One file: no external scripts, stylesheets, images, fonts, `@import`, `fetch`, `import`
- [ ] Complete HTML document with `<title>` and a viewport meta tag
- [ ] At least one parameter `<input type="range">` besides `#scrub`
- [ ] A scrub control: `<input type="range" id="scrub">`
- [ ] A break button: `<button id="break">`
- [ ] Play and/or step buttons
- [ ] A `<canvas>` or `<svg>` visual
- [ ] (warning) `window.tinkertoy` present, reduced-motion handled, labels present, file small, no loop with a huge literal bound
- [ ] (warning, `--run` only) `build()` is cheap: frames 20-120 (200 max) and each call under ~5 ms

## By hand
- [ ] **One idea.** The title is a question or "How X works", and the sim shows exactly that
- [ ] **Defaults are healthy.** On load the system behaves normally and the numbers look sensible
- [ ] **Sliders do something visible.** Move each one end to end: the picture and the stats change, nothing crashes, nothing goes `NaN`
- [ ] **`build()` is cheap.** It reruns on every slider move: target under ~5 ms per call, no heavy loops, 20 to 120 frames (up to about 200 for a smooth real-time timeline if `build` stays trivially cheap). The runtime coalesces slider input to one `build` per animation frame (latest value wins), but a slow `build` still makes dragging janky. Drag a slider fast and check it stays smooth
- [ ] **Scrub works both ways.** Drag back to step 0 and forward to the end; the frame at a step is identical whichever way you got there
- [ ] **Break it.** The failure is real (it is what actually happens), the cause is named in the caption, the stats turn `bad`, and pressing the button again restores normal
- [ ] **Captions teach.** Every step says what happened and why; no step is just "tick 7"
- [ ] **No invented numbers.** Anything illustrative is labelled; toy sizes are labelled
- [ ] **Mobile.** Looks right at 390 px wide; wide diagrams scroll instead of overlapping
- [ ] **Offline.** Open it with the network off; nothing is missing
- [ ] **Reply is short:** path, one sentence, two things to try
