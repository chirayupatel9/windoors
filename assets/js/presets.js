/* Ready-made configurations. Each builds the section stack for a given size. */

import * as U from './util.js';

const sec = (type, h, extra = {}) => ({ id: U.uid('sec'), type, h, cells: [], panels: [], mesh: 'none', tracks: 2, ...extra });
const cells = (n, fns, w) => Array.from({ length: n }, (_, i) => ({ id: U.uid('c'), w: w ? w[i] : 1, fn: fns[i] || fns[fns.length - 1] || 'fix' }));
const panels = (n, fns) => Array.from({ length: n }, (_, i) => ({ id: U.uid('p'), fn: fns[i] || (i === 0 ? 'slide-l' : 'slide-r') }));

const slide = (h, tracks, mesh, dirs) =>
  sec('sliding', h, { tracks, mesh: mesh || 'none', panels: panels(tracks, dirs || defaultDirs(tracks)) });

function defaultDirs(n) {
  if (n <= 1) return ['slide-fix'];
  if (n === 2) return ['slide-l', 'slide-r'];
  if (n === 3) return ['slide-l', 'slide-fix', 'slide-r'];
  return ['slide-l', 'slide-l', 'slide-r', 'slide-r'];
}

export const PRESETS = [
  /* ---- fixed ---- */
  { id: 'fix1', group: 'Fixed', name: 'Fix glass', family: 'fix', w: 1200, h: 1200,
    build: (w, h) => [sec('grid', h, { cells: cells(1, ['fix']) })] },
  { id: 'fix2', group: 'Fixed', name: 'Fix glass — 2 panes', family: 'fix', w: 1800, h: 1500,
    build: (w, h) => [sec('grid', h, { cells: cells(2, ['fix']) })] },
  { id: 'fix3', group: 'Fixed', name: 'Fix glass — 3 panes', family: 'fix', w: 2400, h: 1800,
    build: (w, h) => [sec('grid', h, { cells: cells(3, ['fix']) })] },
  { id: 'fixv4', group: 'Fixed', name: 'Tall fix — 4 stacked panes', family: 'fix', w: 600, h: 3200,
    build: (w, h) => Array.from({ length: 4 }, () => sec('grid', h / 4, { cells: cells(1, ['fix']) })) },

  /* ---- sliding windows ---- */
  { id: 'sl2', group: 'Sliding', name: '2 track', family: 'sliding', w: 1800, h: 1500,
    build: (w, h) => [slide(h, 2)] },
  { id: 'sl2m', group: 'Sliding', name: '2 track with mosquito net', family: 'sliding', w: 1800, h: 1500,
    build: (w, h) => [slide(h, 2, 'left')] },
  { id: 'sl3', group: 'Sliding', name: '3 track', family: 'sliding', w: 2700, h: 1500,
    build: (w, h) => [slide(h, 3)] },
  { id: 'sl3m', group: 'Sliding', name: '3 track with mosquito net', family: 'sliding', w: 2700, h: 1500,
    build: (w, h) => [slide(h, 3, 'left')] },
  { id: 'sl4', group: 'Sliding', name: '4 track', family: 'sliding', w: 3600, h: 1500,
    build: (w, h) => [slide(h, 4)] },
  { id: 'sl2top', group: 'Sliding', name: '2 track + fixed top light', family: 'sliding', w: 1800, h: 2100,
    build: (w, h) => [sec('grid', h * 0.25, { cells: cells(2, ['fix']) }), slide(h * 0.75, 2)] },

  /* ---- casement ---- */
  { id: 'cs1', group: 'Casement', name: '1 openable', family: 'casement', w: 750, h: 1200,
    build: (w, h) => [sec('grid', h, { cells: cells(1, ['casement-l']) })] },
  { id: 'cs2', group: 'Casement', name: '2 openable', family: 'casement', w: 1400, h: 1400,
    build: (w, h) => [sec('grid', h, { cells: cells(2, ['casement-l', 'casement-r']) })] },
  { id: 'cs21', group: 'Casement', name: 'Openable + fix + openable', family: 'casement', w: 2100, h: 1400,
    build: (w, h) => [sec('grid', h, { cells: cells(3, ['casement-l', 'fix', 'casement-r'], [1, 1.4, 1]) })] },
  { id: 'cs2t', group: 'Casement', name: '2 openable + fixed top light', family: 'casement', w: 1400, h: 1900,
    build: (w, h) => [sec('grid', h * 0.26, { cells: cells(2, ['fix']) }), sec('grid', h * 0.74, { cells: cells(2, ['casement-l', 'casement-r']) })] },
  { id: 'th1', group: 'Casement', name: 'Top hung', family: 'casement', w: 900, h: 700,
    build: (w, h) => [sec('grid', h, { cells: cells(1, ['top-hung']) })] },
  { id: 'tt2', group: 'Casement', name: 'Tilt & turn — 2 leaf', family: 'casement', w: 1400, h: 1500,
    build: (w, h) => [sec('grid', h, { cells: cells(2, ['tilt-turn-l', 'tilt-turn-r']) })] },

  /* ---- ventilators ---- */
  { id: 'vt1', group: 'Ventilator', name: 'Louver + top openable', family: 'ventilator', w: 600, h: 900,
    build: (w, h) => [sec('grid', h * 0.45, { cells: cells(1, ['top-hung']) }), sec('grid', h * 0.55, { cells: cells(1, ['louver']) })] },
  { id: 'vt2', group: 'Ventilator', name: 'Openable + exhaust fan + louver', family: 'ventilator', w: 600, h: 900,
    build: (w, h) => [sec('grid', h * 0.47, { cells: cells(2, ['casement-r', 'fan']) }), sec('grid', h * 0.53, { cells: cells(1, ['louver']) })] },
  { id: 'vt3', group: 'Ventilator', name: 'Fix + louver', family: 'ventilator', w: 600, h: 750,
    build: (w, h) => [sec('grid', h * 0.55, { cells: cells(1, ['fix']) }), sec('grid', h * 0.45, { cells: cells(1, ['louver']) })] },

  /* ---- doors ---- */
  { id: 'dr1', group: 'Doors', name: 'Single openable door', family: 'casement', w: 900, h: 2100,
    build: (w, h) => [sec('grid', h, { cells: cells(1, ['door-l']) })] },
  { id: 'dr2', group: 'Doors', name: 'Double openable door', family: 'casement', w: 1500, h: 2100,
    build: (w, h) => [sec('grid', h, { cells: cells(2, ['door-l', 'door-r']) })] },
  { id: 'dr2t', group: 'Doors', name: 'Double door + top light', family: 'casement', w: 1500, h: 2550,
    build: (w, h) => [sec('grid', h * 0.16, { cells: cells(2, ['fix']) }), sec('grid', h * 0.84, { cells: cells(2, ['door-l', 'door-r']) })] },
  { id: 'drs', group: 'Doors', name: 'Door + side lights + top light', family: 'casement', w: 2400, h: 2400,
    build: (w, h) => [
      sec('grid', h * 0.15, { cells: cells(3, ['fix']) }),
      sec('grid', h * 0.85, { cells: cells(4, ['fix', 'door-l', 'door-r', 'fix'], [1, 0.9, 0.9, 1]) })] },
  { id: 'sld2', group: 'Doors', name: 'Sliding door — 2 track', family: 'sliding', w: 2100, h: 2100,
    build: (w, h) => [slide(h, 2)] },
  { id: 'sld3', group: 'Doors', name: 'Sliding door — 3 track', family: 'sliding', w: 3000, h: 2400,
    build: (w, h) => [slide(h, 3)] },
  { id: 'sld4', group: 'Doors', name: 'Sliding door — 4 track', family: 'sliding', w: 3600, h: 2400,
    build: (w, h) => [slide(h, 4)] },
];

export const PRESET_GROUPS = [...new Set(PRESETS.map((p) => p.group))];

/** Applies a preset to an item, keeping its identity, label and specs. */
export function applyPreset(item, preset, lib, resize = true) {
  const w = resize ? preset.w : U.num(item.width, preset.w);
  const h = resize ? preset.h : U.num(item.height, preset.h);
  item.width = w;
  item.height = h;
  item.sections = preset.build(w, h).map((s) => ({
    ...s,
    h: Math.round(s.h),
    cells: (s.cells || []).map((c) => ({ ...c, w: Math.round((U.num(c.w, 1) / sum(s.cells)) * w) })),
  }));
  // re-normalise section heights to the overall height
  const hs = U.normaliseParts(item.sections.map((s) => s.h), h);
  item.sections.forEach((s, i) => (s.h = hs[i]));
  item.sections.forEach((s) => {
    if (s.cells?.length) {
      const ws = U.normaliseParts(s.cells.map((c) => c.w), w);
      s.cells.forEach((c, i) => (c.w = ws[i]));
    }
  });
  const match = lib.series.find((x) => x.family === preset.family);
  if (match) item.seriesId = match.id;
  return item;
}

const sum = (arr) => (arr || []).reduce((a, c) => a + U.num(c.w, 1), 0) || 1;
