/*
 * Builds a self-contained single-file version of the app.
 *
 *   node tools/build-single.mjs
 *
 *   dist/index.html    - standalone page (open it straight off a USB stick)
 *   dist/artifact.html - the same page as a body fragment, for hosts that
 *                        supply their own <html>/<head> wrapper
 *
 * GitHub Pages serves the un-bundled files from the repo root, so this build
 * is only needed for offline sharing.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(join(root, p), 'utf8');

const TITLE = 'WinDoors Quotation Studio';
const DESC = 'Draw aluminium windows and doors to size, pick the profile series and glazing, and print a priced quotation with elevation drawings.';

const bundle = await build({
  entryPoints: [join(root, 'assets/js/app.js')],
  bundle: true,
  format: 'iife',
  globalName: 'WinDoors',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
});
const js = bundle.outputFiles[0].text;

const css = [await read('assets/css/app.css'), await read('assets/css/print.css')].join('\n\n');

const body = `<header id="topbar" class="topbar"></header>
<main id="mount" class="mount"></main>
<div id="boot" class="boot">
  <div class="boot-card">
    <div class="boot-mark">&#9636;</div>
    <h1>WinDoors</h1>
    <p>Loading the quotation studio&hellip;</p>
    <noscript><p class="boot-err">This tool needs JavaScript enabled.</p></noscript>
  </div>
</div>`;

const boot = `
document.body.dataset.tab = 'items';
try { WinDoors.start(); }
catch (err) {
  console.error(err);
  var b = document.getElementById('boot');
  if (b) b.innerHTML = '<div class="boot-card"><h1>Something went wrong</h1><pre>' +
    String((err && err.message) || err) + '</pre></div>';
}`;

await mkdir(join(root, 'dist'), { recursive: true });

await writeFile(join(root, 'dist/index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="${DESC}">
<style>
${css}
</style>
</head>
<body data-tab="items">
${body}
<script>${js}${boot}</script>
</body>
</html>
`);

// Fragment build: no <html>/<head>/<body>, and the app's own reset overrides
// whatever ground the host paints.
await writeFile(join(root, 'dist/artifact.html'), `<title>${TITLE}</title>
<style>
html, body { margin: 0; padding: 0; }
${css}
</style>
${body}
<script>${js}${boot}</script>
`);

const kb = (s) => (s.length / 1024).toFixed(0) + ' KB';
console.log(`bundled js ${kb(js)} · css ${kb(css)}`);
console.log('dist/index.html, dist/artifact.html written');
