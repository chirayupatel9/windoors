/*
 * Layout solver. Turns an item definition into real mm geometry:
 * frame members, mullions/transoms, panel openings, sliding sash overlaps,
 * pane numbering and the dimension chains a shop drawing needs.
 *
 * An item is a vertical stack of SECTIONS. A section is either:
 *   grid    - a horizontal run of cells split by mullions
 *   sliding - N sliding sashes overlapping at their interlocks (+ optional mesh sash)
 *
 * Column widths inside a section sum to the overall width, and section heights
 * sum to the overall height, exactly as they are dimensioned on a drawing:
 * the module dimension runs to the centre-line of the divider.
 */

import { isGlazed, ALL_FN } from './catalog.js';
import * as U from './util.js';

const { normaliseParts } = U;

const N = U.num;

export function seriesOf(item, lib) {
  return lib.series.find((s) => s.id === item.seriesId) || lib.series[0];
}

/**
 * @returns {{
 *   width, height, frame, members, panes, chainsX, chainsY, sqft, plan
 * }}
 */
export function solve(item, series) {
  const W = Math.max(1, N(item.width));
  const H = Math.max(1, N(item.height));
  const F = Math.min(N(series.face, 40), Math.min(W, H) / 4);
  const T = N(series.transom, 40);
  const M = N(series.mullion, 40);
  const OL = N(series.interlock, 18);
  const BEAD = N(series.bead, 6);
  const SASH = N(series.sash, 38);

  const sections = item.sections?.length ? item.sections : [{ type: 'grid', h: H, cells: [{ fn: 'fix' }] }];

  // --- vertical split -------------------------------------------------
  const rowH = normaliseParts(sections.map((s) => N(s.h, 1)), H);
  const yEdge = [0];
  rowH.forEach((h) => yEdge.push(yEdge[yEdge.length - 1] + h));

  const members = [];   // frame/mullion/transom rectangles, in mm
  const panes = [];     // every visible pane, numbered
  const chainsX = [];   // horizontal dimension chains (below drawing)
  const chainsY = [];   // vertical dimension chains (left of drawing)

  // outer frame drawn as a ring
  members.push({ kind: 'frame', x: 0, y: 0, w: W, h: H, t: F });

  let paneNo = 0;

  sections.forEach((sec, si) => {
    const top = si === 0 ? F : yEdge[si] + T / 2;
    const bot = si === sections.length - 1 ? H - F : yEdge[si + 1] - T / 2;
    const openH = Math.max(1, bot - top);

    // transom above this section (skip for the first)
    if (si > 0) {
      members.push({ kind: 'transom', x: F, y: yEdge[si] - T / 2, w: W - 2 * F, h: T, label: `T${si}` });
    }

    if (sec.type === 'sliding') {
      const left = F, right = W - F;
      const C = Math.max(1, right - left);
      const tracks = U.clamp(Math.round(N(sec.tracks, 2)), 1, 6);
      const list = (sec.panels || []).slice(0, tracks);
      while (list.length < tracks) list.push({ fn: list.length ? 'slide-r' : 'slide-l' });

      // true sash width so that N sashes overlapping by OL fill the clear width
      const S = (C + (tracks - 1) * OL) / tracks;
      const step = S - OL;

      list.forEach((p, k) => {
        const x = left + k * step;
        panes.push({
          no: ++paneNo,
          kind: 'sash',
          sliding: true,
          track: k,
          fn: p.fn || (k === 0 ? 'slide-l' : 'slide-r'),
          glassId: p.glassId,
          x, y: top, w: S, h: openH,
          glass: inset({ x, y: top, w: S, h: openH }, SASH + BEAD),
          sectionIndex: si,
          z: k,
        });
      });

      // optional mosquito-net sash on its own track — same leaf size as a
      // glass sash, parked at whichever end the user chose
      if (sec.mesh && sec.mesh !== 'none') {
        const mw = S;
        const mx = sec.mesh === 'right' ? right - mw : left;
        panes.push({
          no: ++paneNo,
          kind: 'sash',
          sliding: true,
          mesh: true,
          track: tracks,
          fn: 'slide-mesh',
          meshId: sec.meshId,
          x: mx, y: top, w: mw, h: openH,
          glass: inset({ x: mx, y: top, w: mw, h: openH }, SASH + BEAD),
          sectionIndex: si,
          z: 10, // hatched over the half it parks on, the way shop drawings show it
        });
      }

      // dimension chain at the interlock centre-lines, measured across the frame
      const stops = [0];
      for (let k = 1; k < tracks; k++) stops.push(left + k * step + OL / 2);
      stops.push(W);
      chainsX.push(toChain(stops));
    } else {
      const cells = sec.cells?.length ? sec.cells : [{ fn: 'fix' }];
      const colW = normaliseParts(cells.map((c) => N(c.w, 1)), W);
      const xEdge = [0];
      colW.forEach((w) => xEdge.push(xEdge[xEdge.length - 1] + w));

      cells.forEach((cell, ci) => {
        const l = ci === 0 ? F : xEdge[ci] + M / 2;
        const r = ci === cells.length - 1 ? W - F : xEdge[ci + 1] - M / 2;
        const openW = Math.max(1, r - l);
        const fn = cell.fn || 'fix';
        const opening = { x: l, y: top, w: openW, h: openH };
        const leaf = !!ALL_FN[fn]?.sash;

        panes.push({
          no: ++paneNo,
          kind: leaf ? 'sash' : 'fixed',
          fn,
          glassId: cell.glassId,
          meshId: cell.meshId,
          ...opening,
          glass: inset(opening, leaf ? SASH + BEAD : BEAD),
          sectionIndex: si,
          cellIndex: ci,
          z: 0,
        });

        if (ci > 0) {
          members.push({ kind: 'mullion', x: xEdge[ci] - M / 2, y: top, w: M, h: openH, label: `M${ci}` });
        }
      });

      if (cells.length > 1) chainsX.push(toChain(xEdge));
    }
  });

  if (sections.length > 1) chainsY.push(toChain(yEdge));
  chainsX.push(toChain([0, W]));
  chainsY.push(toChain([0, H]));

  labelPanes(panes);

  return {
    width: W, height: H, series, frame: F,
    members, panes,
    chainsX: dedupeChains(chainsX),
    chainsY: dedupeChains(chainsY),
    sqft: U.areaSqft(W, H),
    plan: buildPlan(item, series, W, sections),
  };
}

const inset = (r, d) => ({
  x: r.x + d, y: r.y + d,
  w: Math.max(1, r.w - 2 * d), h: Math.max(1, r.h - 2 * d),
});

function toChain(stops) {
  const parts = [];
  for (let i = 1; i < stops.length; i++) {
    // shop drawings dimension to whole millimetres
    parts.push({ from: stops[i - 1], to: stops[i], value: Math.round(stops[i] - stops[i - 1]) });
  }
  return { stops, parts, total: stops[stops.length - 1] - stops[0] };
}

/** Drops a sub-chain that says the same thing as the overall chain. */
function dedupeChains(chains) {
  const seen = new Set();
  return chains.filter((c) => {
    const key = c.stops.map((s) => Math.round(s)).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Shop labels: S1.. for leaves, F1.. for fixed, L1.., MS1.., FAN. */
function labelPanes(panes) {
  const seq = { S: 0, F: 0, L: 0, MS: 0, FAN: 0, D: 0, P: 0, G: 0 };
  for (const p of panes) {
    let tag = ALL_FN[p.fn]?.short || 'F';
    if (p.fn === 'louver') tag = 'L';
    if (p.fn === 'mesh' || p.fn === 'slide-mesh') tag = 'MS';
    if (p.fn === 'fan') tag = 'FAN';
    seq[tag] = (seq[tag] || 0) + 1;
    p.tag = tag === 'FAN' ? 'FAN' : tag + seq[tag];
  }
}

/** Horizontal section through the tracks, drawn under sliding items. */
function buildPlan(item, series, W, sections) {
  const sec = sections.find((s) => s.type === 'sliding');
  if (!sec) return null;
  const tracks = U.clamp(Math.round(N(sec.tracks, 2)), 1, 6);
  const meshTrack = sec.mesh && sec.mesh !== 'none' ? 1 : 0;
  return {
    width: W,
    tracks,
    meshTrack,
    meshSide: sec.mesh || 'none',
    dirs: (sec.panels || []).map((p) => (p.fn === 'slide-l' ? -1 : p.fn === 'slide-r' ? 1 : 0)),
  };
}

/* --------------------------------------------------------------------
 * Derived quantities used by pricing and by the spec block.
 * ------------------------------------------------------------------ */

export function paneAreas(sol) {
  return sol.panes.map((p) => ({
    ...p,
    sqft: U.areaSqft(p.glass.w, p.glass.h),
    openingSqft: U.areaSqft(p.w, p.h),
  }));
}

/** Groups pane numbers by glass so the spec reads "(1,2,3) 5 MM ...". */
export function glazingGroups(sol, item, lib) {
  const fallback = item.glassId || lib.glass[0]?.id;
  const map = new Map();
  for (const p of sol.panes) {
    if (!isGlazed(p.fn)) continue;
    const gid = p.glassId || fallback;
    if (!map.has(gid)) map.set(gid, []);
    map.get(gid).push(p.no);
  }
  return [...map.entries()].map(([gid, nos]) => ({
    glass: lib.glass.find((g) => g.id === gid) || { name: '—', rate: 0, id: gid },
    nos,
  }));
}

export function meshGroups(sol, item, lib) {
  const fallback = item.meshId || lib.mesh[0]?.id;
  const map = new Map();
  for (const p of sol.panes) {
    if (p.fn !== 'mesh' && p.fn !== 'slide-mesh') continue;
    const mid = p.meshId || fallback;
    if (!map.has(mid)) map.set(mid, []);
    map.get(mid).push(p.no);
  }
  return [...map.entries()].map(([mid, nos]) => ({
    mesh: lib.mesh.find((m) => m.id === mid) || { name: '—', rate: 0, id: mid },
    nos,
  }));
}

/** Human name for the configuration, e.g. "2 TRACK WITH MOSQUITO NET". */
export function describe(item) {
  const secs = item.sections || [];
  const sliding = secs.find((s) => s.type === 'sliding');
  if (sliding) {
    const t = `${N(sliding.tracks, 2)} TRACK`;
    const mesh = sliding.mesh && sliding.mesh !== 'none' ? ' WITH MOSQUITO NET' : '';
    const extra = secs.length > 1 ? ' + FIXED LIGHT' : '';
    return t + mesh + extra;
  }
  const fns = secs.flatMap((s) => (s.cells || []).map((c) => c.fn || 'fix'));
  if (fns.length && fns.every((f) => f === 'fix')) return 'FIX GLASS';
  if (fns.some((f) => f.startsWith('door'))) return 'OPENABLE DOOR';
  if (fns.some((f) => f === 'louver' || f === 'fan')) return 'VENTILATOR';
  if (fns.some((f) => f.startsWith('casement') || f.startsWith('tilt'))) {
    const n = fns.filter((f) => f.startsWith('casement') || f.startsWith('tilt')).length;
    return `${n} TRACK OPENABLE`.replace('TRACK ', '') + ' CASEMENT';
  }
  return 'FIXED';
}
