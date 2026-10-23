## Explain with a tinkertoy

When the user asks how something works ("how does X work?", "explain X", "what happens if X fails"), and the answer is about behaviour over time or under changing inputs, answer with a **tinkertoy** instead of a long text: ONE self-contained offline HTML file with sliders, a play/step/scrub timeline, a "Break it" button that triggers a real failure mode, and a clear visual.

- Follow the `tinkertoy` skill (`.claude/skills/tinkertoy/SKILL.md` or `.agents/skills/tinkertoy/SKILL.md`). Start from its `template.html`.
- Write the file to `./tinkertoys/<topic>.html`. No CDN, no network calls, no dependencies.
- Validate with `npx @barood-labs/tinkertoy validate <file>` and fix every error before replying.
- Reply briefly: the path, one sentence on what it shows, and two things to try.
