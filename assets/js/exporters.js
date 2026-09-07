/* Image / file output: PNG and SVG of a single elevation, JSON of the whole
 * job, and printing the quotation (which is how a PDF gets made). */

import * as U from './util.js';
import * as UI from './ui.js';
import * as S from './store.js';
import { drawSVG } from './draw.js';
import { seriesFor, solve, cutList, metalSummary } from './geometry.js';

const safe = (s) => String(s || 'quote').replace(/[^\w.-]+/g, '_').slice(0, 60);

/*
 * Saving a file. Served normally (GitHub Pages, a local server, a file off a
 * USB stick) a plain download link is the whole story. Inside a hosted viewer
 * the frame is not allowed to start a download, so the host mediates it and
 * the viewer confirms. Probe once, then take whichever path exists.
 */
let downloadsNs;   // undefined = not probed, null = plain links

export async function primeDownloads() {
  if (downloadsNs !== undefined) return downloadsNs;
  downloadsNs = null;
  try {
    if (typeof window !== 'undefined' && typeof window.claude?.use === 'function') {
      downloadsNs = (await window.claude.use('downloads')) || null;
    }
  } catch (e) {
    downloadsNs = null;
  }
  return downloadsNs;
}

/** @returns {Promise<boolean>} true when the file was handed over. */
export async function download(filename, blob) {
  const ns = await primeDownloads();
  if (ns) {
    try {
      await ns.save({ filename, data: blob });
      return true;
    } catch (err) {
      if (err?.code === 'declined') return false;
      if (err?.code === 'rate_limited') {
        UI.toast('A save is already open — finish that one first', 'err');
        return false;
      }
      UI.toast(err?.message || 'Could not save the file', 'err');
      return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

export function itemSVG(item, lib, opts = {}) {
  const series = seriesFor(item, lib);
  const colour = lib.colours.find((c) => c.id === item.colourId) || lib.colours[0];
  return drawSVG(item, series, {
    colour: colour?.swatch,
    caption: S.state.doc.viewLabel || 'View From Inside',
    sqft: U.areaSqft(item.width, item.height),
    ...opts,
  });
}

export async function exportItemSVG(item) {
  const svg = itemSVG(item, S.state.lib);
  const ok = await download(`${safe(item.label)}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  if (ok) UI.toast(`${item.label}.svg saved`);
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
    if (await download(`${safe(item.label)}.png`, blob)) UI.toast(`${item.label}.png saved`);
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
  cv.toBlob(async (b) => {
    if (b && await download(`${safe(S.state.doc.quoteNo)}_drawings.png`, b)) {
      UI.toast('Contact sheet saved');
    }
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

export async function exportJSON() {
  const ok = await download(`${safe(S.state.doc.quoteNo)}.windoors.json`,
    new Blob([S.toJSON()], { type: 'application/json' }));
  if (ok) UI.toast('Job file saved');
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

export async function exportCSV(q) {
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
  const ok = await download(`${safe(S.state.doc.quoteNo)}.csv`, new Blob(['﻿' + csv], { type: 'text/csv' }));
  if (ok) UI.toast('CSV saved');
}

/* ---- print ---- */

export function printQuote(goToQuote) {
  goToQuote();
  // two frames: one for the tab swap, one for pagination to settle
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => window.print(), 120)));
}


/* ---- cutting list for the factory ---- */

/**
 * Every cut length in the job, plus the metal roll-up per profile. This is
 * shop paperwork, not customer paperwork — it never goes on the quotation.
 */
export function exportCutList() {
  const { doc, lib } = S.state;
  const head = ['Mark', 'Location', 'Qty', 'Series', 'Role', 'Profile code', 'Profile',
    'Pieces per unit', 'Length mm', 'Total mm per unit', 'Total mm for qty'];
  const rows = [];
  const metalTotals = new Map();

  for (const item of doc.items) {
    const series = seriesFor(item, lib);
    const sol = solve(item, series);
    const qty = Math.max(1, Math.round(U.num(item.qty, 1)));
    const assigned = series.sections || {};

    for (const c of cutList(sol, item)) {
      const prof = lib.profiles?.find((p) => p.id === assigned[c.role]);
      rows.push([item.label, item.location || '', qty, series.name, c.role,
        prof?.code || '', prof?.name || 'not assigned',
        c.count, c.each, c.total, c.total * qty]);
    }

    for (const line of metalSummary(sol, item, series, lib).lines) {
      if (!line.profile) continue;
      const key = line.profile.id;
      const acc = metalTotals.get(key) || { profile: line.profile, metres: 0, kg: 0, cost: 0 };
      acc.metres += line.metres * qty;
      acc.kg += line.kg * qty;
      acc.cost += line.cost * qty;
      metalTotals.set(key, acc);
    }
  }

  rows.push([]);
  rows.push(['SUMMARY BY PROFILE']);
  rows.push(['Profile code', 'Profile', 'Total metres', 'Total kg', 'Bars to order', 'Bar length mm', 'Metal cost']);
  for (const a of metalTotals.values()) {
    const bars = U.num(a.profile.barLength) > 0
      ? Math.ceil((a.metres * 1000) / U.num(a.profile.barLength)) : '';
    rows.push([a.profile.code, a.profile.name, U.round(a.metres, 2), U.round(a.kg, 3),
      bars, a.profile.barLength, U.round(a.cost, 2)]);
  }

  const csv = [head, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  return download(`${safe(S.state.doc.quoteNo)}_cutting_list.csv`,
    new Blob(['\ufeff' + csv], { type: 'text/csv' }))
    .then((ok) => { if (ok) UI.toast('Cutting list saved'); });
}
