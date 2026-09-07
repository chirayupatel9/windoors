/* Image / file output: PNG and SVG of a single elevation, JSON of the whole
 * job, and printing the quotation (which is how a PDF gets made). */

import * as U from './util.js';
import * as UI from './ui.js';
import * as S from './store.js';
import { drawSVG } from './draw.js';

const safe = (s) => String(s || 'quote').replace(/[^\w.-]+/g, '_').slice(0, 60);

export function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function itemSVG(item, lib, opts = {}) {
  const series = lib.series.find((s) => s.id === item.seriesId) || lib.series[0];
  const colour = lib.colours.find((c) => c.id === item.colourId) || lib.colours[0];
  return drawSVG(item, series, {
    colour: colour?.swatch,
    caption: S.state.doc.viewLabel || 'View From Inside',
    sqft: U.areaSqft(item.width, item.height),
    ...opts,
  });
}

export function exportItemSVG(item) {
  const svg = itemSVG(item, S.state.lib);
  download(`${safe(item.label)}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  UI.toast(`${item.label}.svg saved`);
}

/** Rasterises an SVG string to a PNG blob at `scale`x. */
export function svgToPng(svg, scale = 3) {
  return new Promise((resolve, reject) => {
    const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    const w = m ? parseFloat(m[1]) : 800;
    const h = m ? parseFloat(m[2]) : 600;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.round(w * scale);
      cv.height = Math.round(h * scale);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas is empty'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Could not rasterise the drawing'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

export async function exportItemPNG(item) {
  try {
    const blob = await svgToPng(itemSVG(item, S.state.lib), 3);
    download(`${safe(item.label)}.png`, blob);
    UI.toast(`${item.label}.png saved`);
  } catch (e) {
    UI.toast(e.message, 'err');
  }
}

/** Every drawing in one PNG contact sheet — handy for the site file. */
export async function exportAllPNG() {
  const items = S.state.doc.items;
  if (!items.length) return;
  UI.toast('Rendering drawings…');
  const imgs = [];
  for (const it of items) {
    const svg = itemSVG(it, S.state.lib, { caption: it.label });
    imgs.push(await loadImage(svg));
  }
  const cols = Math.min(4, Math.ceil(Math.sqrt(imgs.length)));
  const rows = Math.ceil(imgs.length / cols);
  const cw = Math.max(...imgs.map((i) => i.width)) + 24;
  const chh = Math.max(...imgs.map((i) => i.height)) + 24;
  const cv = document.createElement('canvas');
  cv.width = cols * cw;
  cv.height = rows * chh;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  imgs.forEach((im, i) => {
    const x = (i % cols) * cw + (cw - im.width) / 2;
    const y = Math.floor(i / cols) * chh + (chh - im.height) / 2;
    ctx.drawImage(im, x, y);
  });
  cv.toBlob((b) => {
    if (b) download(`${safe(S.state.doc.quoteNo)}_drawings.png`, b);
    UI.toast('Contact sheet saved');
  }, 'image/png');
}

function loadImage(svg) {
  return new Promise((resolve, reject) => {
    const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    const img = new Image();
    img.width = m ? parseFloat(m[1]) * 2 : 800;
    img.height = m ? parseFloat(m[2]) * 2 : 600;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('render failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/* ---- job file ---- */

export function exportJSON() {
  download(`${safe(S.state.doc.quoteNo)}.windoors.json`,
    new Blob([S.toJSON()], { type: 'application/json' }));
  UI.toast('Job file saved');
}

export function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      S.fromJSON(await f.text());
      UI.toast('Job loaded');
    } catch (e) {
      UI.toast(e.message, 'err');
    }
  };
  input.click();
}

/* ---- CSV of the priced lines, for a spreadsheet ---- */

export function exportCSV(q) {
  const head = ['#', 'Mark', 'Type', 'Width mm', 'Height mm', 'Sq.ft', 'Qty', 'Series', 'Glass',
    'Colour', 'Location', 'Floor', 'Unit price', 'Total price'];
  const rows = q.lines.map((l, i) => [
    i + 1, l.item.label, l.price.sol ? '' : '', U.num(l.item.width), U.num(l.item.height),
    U.round(l.price.sqft, 2), l.price.qty, l.price.series?.name || '',
    S.state.lib.glass.find((g) => g.id === l.item.glassId)?.name || '',
    l.price.colour?.name || '', l.item.location || '', l.item.floor || '',
    U.round(l.price.unit, 2), U.round(l.price.total, 2),
  ]);
  const csv = [head, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  download(`${safe(S.state.doc.quoteNo)}.csv`, new Blob(['﻿' + csv], { type: 'text/csv' }));
  UI.toast('CSV saved');
}

/* ---- print ---- */

export function printQuote(goToQuote) {
  goToQuote();
  // two frames: one for the tab swap, one for pagination to settle
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => window.print(), 120)));
}
