import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const read = f => readFileSync(join(root, f), 'utf8');
export const template = () => read('skill/template.html');
export const manifest = () => JSON.parse(read('examples/manifest.json'));
export const exampleFiles = () => manifest().map(m => `examples/${m.id}.html`);
