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

import { isGlazed, ALL_FN, FACE_ROLES } from './catalog.js';
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

      // dimension chain at the interlock centre-lines, measured across the frame.
      // Sash widths follow from the track count and interlock, so they are shown
      // but not editable — the overall width is what you change.
      if (tracks > 1) {
        const stops = [0];
        for (let k = 1; k < tracks; k++) stops.push(left + k * step + OL / 2);
        stops.push(W);
        chainsX.push(toChain(stops, 'sliding', si));
      }
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

      if (cells.length > 1) chainsX.push(toChain(xEdge, 'cells', si));
    }
  });

  if (sections.length > 1) chainsY.push(toChain(yEdge, 'rows'));
  chainsX.push(toChain([0, W], 'width'));
  chainsY.push(toChain([0, H], 'height'));

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

function toChain(stops, source = 'other', sectionIndex = -1) {
  const parts = [];
  for (let i = 1; i < stops.length; i++) {
    // shop drawings dimension to whole millimetres
    parts.push({ from: stops[i - 1], to: stops[i], value: Math.round(stops[i] - stops[i - 1]), index: i - 1 });
  }
  return {
    stops, parts, source, sectionIndex,
    editable: source === 'cells' || source === 'rows' || source === 'width' || source === 'height',
    total: stops[stops.length - 1] - stops[0],
  };
}

/**
 * Drops a chain that repeats one already drawn *for the same thing*. Two rows
 * that happen to share a column split are NOT the same thing — each has to stay
 * separately dimensioned, or half the item becomes uneditable on the sheet.
 */
function dedupeChains(chains) {
  const seen = new Map();
  const out = [];
  for (const c of chains) {
    const key = [c.source, c.sectionIndex, ...c.stops.map((s) => Math.round(s))].join('|');
    const prev = seen.get(key);
    if (prev) {
      if (c.editable && !prev.editable) Object.assign(prev, c);
      continue;
    }
    seen.set(key, c);
    out.push(c);
  }
  return out;
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


/* --------------------------------------------------------------------
 * Profile sections -> geometry, and geometry -> cut lengths.
 * ------------------------------------------------------------------ */

/**
 * A series with its face widths taken from the profile sections assigned to
 * it, so the master table drives the drawing and not just the price.
 */
export function resolveSeries(series, lib) {
  if (!series) return series;
  const assigned = series.sections || {};
  const out = { ...series };
  for (const [key, role] of Object.entries(FACE_ROLES)) {
    const prof = lib?.profiles?.find((p) => p.id === assigned[role]);
    if (prof && N(prof.face) > 0) out[key] = N(prof.face);
  }
  return out;
}

/** Finds an item's series and resolves it in one step. */
export function seriesFor(item, lib) {
  const raw = lib.series.find((s) => s.id === item?.seriesId) || lib.series[0];
  return resolveSeries(raw, lib);
}

const perim = (w, h) => 2 * (N(w) + N(h));

/**
 * Cut lengths per profile role, in millimetres — the same list a saw operator
 * would work from, and the basis for weight costing.
 * @returns {Array<{role, label, count, each, total}>}
 */
export function cutList(sol, item) {
  const W = sol.width, H = sol.height;
  const rows = [];
  const push = (role, label, count, each) => {
    if (!(count > 0) || !(each > 0)) return;
    rows.push({ role, label, count, each: Math.round(each), total: Math.round(count * each) });
  };

  // outer frame: mitred head, sill and two jambs
  push('frame', 'Outer frame — head & sill', 2, W);
  push('frame', 'Outer frame — jambs', 2, H);

  for (const m of sol.members) {
    if (m.kind === 'transom') push('transom', `Transom ${m.label || ''}`.trim(), 1, m.w);
    if (m.kind === 'mullion') push('mullion', `Mullion ${m.label || ''}`.trim(), 1, m.h);
  }

  const slidingBySection = new Map();

  for (const p of sol.panes) {
    const isLeaf = !!ALL_FN[p.fn]?.sash;
    const isMesh = p.fn === 'mesh' || p.fn === 'slide-mesh';

    if (isMesh) {
      push('meshSash', `Mesh sash ${p.tag}`, 2, p.w);
      push('meshSash', `Mesh sash ${p.tag}`, 2, p.h);
    } else if (isLeaf && p.fn !== 'louver' && p.fn !== 'fan') {
      push('sash', `Sash ${p.tag} — rails`, 2, p.w);
      push('sash', `Sash ${p.tag} — stiles`, 2, p.h);
      if (p.sliding) {
        slidingBySection.set(p.sectionIndex, (slidingBySection.get(p.sectionIndex) || 0) + 1);
      }
    }

    if (p.fn === 'louver') {
      // blades at roughly 100mm pitch
      const blades = Math.max(2, Math.round(p.glass.h / 100));
      push('louver', `Louver blades ${p.tag}`, blades, p.glass.w);
    }

    if (isGlazed(p.fn)) {
      push('bead', `Glazing bead pane ${p.no}`, 2, p.glass.w);
      push('bead', `Glazing bead pane ${p.no}`, 2, p.glass.h);
    }
  }

  // meeting stiles: each pair of adjacent sliding sashes contributes two
  for (const [si, count] of slidingBySection) {
    if (count < 2) continue;
    const pane = sol.panes.find((p) => p.sectionIndex === si && p.sliding);
    push('interlock', 'Sliding interlock stiles', 2 * (count - 1), pane?.h || 0);
  }

  // merge identical role+length rows so the list reads like a cutting sheet
  const merged = new Map();
  for (const r of rows) {
    const key = `${r.role}|${r.each}|${r.label}`;
    if (merged.has(key)) merged.get(key).count += r.count;
    else merged.set(key, { ...r });
  }
  return [...merged.values()].map((r) => ({ ...r, total: r.count * r.each }));
}

/** Rolls the cut list up per assigned profile: metres, kilos and bars. */
export function metalSummary(sol, item, series, lib) {
  const assigned = series.sections || {};
  const byRole = new Map();
  for (const r of cutList(sol, item)) {
    byRole.set(r.role, (byRole.get(r.role) || 0) + r.total);
  }
  const lines = [];
  let kg = 0, cost = 0, unpriced = [];
  for (const [role, totalMm] of byRole) {
    const prof = lib.profiles?.find((p) => p.id === assigned[role]);
    const metres = totalMm / 1000;
    if (!prof) {
      unpriced.push(role);
      lines.push({ role, profile: null, metres, kg: 0, cost: 0, bars: 0 });
      continue;
    }
    const lineKg = metres * N(prof.kgPerM);
    const lineCost = lineKg * N(prof.ratePerKg);
    const bars = N(prof.barLength) > 0 ? Math.ceil(totalMm / N(prof.barLength)) : 0;
    kg += lineKg;
    cost += lineCost;
    lines.push({ role, profile: prof, metres, kg: lineKg, cost: lineCost, bars });
  }
  return { lines, kg, cost, unpriced, totalMm: [...byRole.values()].reduce((a, b) => a + b, 0) };
}


/* --------------------------------------------------------------------
 * Editing a dimension on the drawing.
 *
 * Changing one module keeps the overall size and moves the divider: the
 * millimetres come off the neighbouring module, the way dragging a mullion
 * behaves on a drawing board. Changing an overall dimension rescales the
 * modules inside it proportionally.
 * ------------------------------------------------------------------ */

export const MIN_MODULE = 80;   // mm — below this a panel cannot be built

/**
 * @returns {boolean} true when the model changed.
 */
export function applyDimension(item, { source, sectionIndex, index }, valueMm) {
  const want = Math.round(N(valueMm));
  if (!Number.isFinite(want) || want < MIN_MODULE) return false;

  if (source === 'width' || source === 'height') {
    const key = source === 'width' ? 'width' : 'height';
    if (want === N(item[key])) return false;
    item[key] = want;
    refit(item);
    return true;
  }

  const list = source === 'rows'
    ? item.sections
    : item.sections[sectionIndex]?.cells;
  if (!list || index < 0 || index >= list.length) return false;

  const key = source === 'rows' ? 'h' : 'w';
  const total = list.reduce((a, p) => a + N(p[key]), 0);
  const current = N(list[index][key]);
  if (want === current) return false;

  // take the difference from the neighbour, keeping the overall size
  const nb = index + 1 < list.length ? index + 1 : index - 1;
  if (nb < 0) {
    // the only module — this is really the overall dimension
    return applyDimension(item, { source: source === 'rows' ? 'height' : 'width' }, want);
  }
  const spare = N(list[nb][key]) - MIN_MODULE;
  const delta = U.clamp(want - current, -(current - MIN_MODULE), spare);
  if (!delta) return false;

  list[index][key] = current + delta;
  list[nb][key] = N(list[nb][key]) - delta;

  // guard against drift from earlier rounding
  const after = list.reduce((a, p) => a + N(p[key]), 0);
  if (after !== total) list[nb][key] += total - after;
  return true;
}

/** Section heights sum to the item height, cell widths to the item width. */
export function refit(item) {
  const hs = U.normaliseParts(item.sections.map((s) => N(s.h)), N(item.height));
  item.sections.forEach((s, i) => {
    s.h = hs[i];
    if (s.cells?.length) {
      const ws = U.normaliseParts(s.cells.map((c) => N(c.w)), N(item.width));
      s.cells.forEach((c, j) => (c.w = ws[j]));
    }
  });
}
