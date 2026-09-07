/* The "Items" tab: item list, live elevation preview, and the panel/section
 * editor where a window or door is actually configured. */

import * as U from './util.js';
import * as UI from './ui.js';
import * as S from './store.js';
import { drawSVG } from './draw.js';
import { priceItem } from './pricing.js';
import { describe, solve, seriesFor, metalSummary, applyDimension, refit, MIN_MODULE } from './geometry.js';
import { CELL_FN, SLIDING_FN, ALL_FN, PROFILE_ROLES } from './catalog.js';

const roleName = (r) => PROFILE_ROLES[r] || r;
import { PRESETS, PRESET_GROUPS, applyPreset } from './presets.js';
import { ICON } from './icons.js';

const { el } = U;

export function renderItemsTab(root) {
  const st = S.state;
  const item = S.findItem(st.ui.selected) || st.doc.items[0];
  if (item) st.ui.selected = item.id;

  root.replaceChildren(
    el('div', { class: 'work' },
      itemList(st, item),
      item ? editorPane(st, item) : el('div', { class: 'empty' }, 'Add an item to begin.')));
}

/* ------------------------------------------------------------------ */

function itemList(st, current) {
  const list = el('div', { class: 'itemlist-scroll' });
  st.doc.items.forEach((it, i) => {
    const series = seriesFor(it, st.lib);
    const colour = st.lib.colours.find((c) => c.id === it.colourId);
    const p = priceItem(it, st.lib);
    const card = el('button', {
      type: 'button',
      class: 'itemcard' + (it.id === current?.id ? ' active' : ''),
      onclick: () => S.update((s) => { s.ui.selected = it.id; s.ui.section = 0; s.ui.cell = 0; }),
    },
      el('div', { class: 'itemcard-thumb', html: drawSVG(it, series, { colour: colour?.swatch, showPlan: false, showNumbers: false, showTags: false }) }),
      el('div', { class: 'itemcard-meta' },
        el('div', { class: 'itemcard-title' }, `${i + 1} · ${it.label}`),
        el('div', { class: 'itemcard-sub dim' }, `${U.mm(it.width)} × ${U.mm(it.height)} mm`),
        el('div', { class: 'itemcard-sub' }, describe(it)),
        el('div', { class: 'itemcard-price' }, `₹ ${U.inr(p.total)}${p.qty > 1 ? ` · ${p.qty} nos` : ''}`)));
    list.append(card);
  });

  return el('aside', { class: 'itemlist' },
    el('div', { class: 'itemlist-head' },
      el('strong', {}, `Items (${st.doc.items.length})`),
      UI.button('+ Add', () => openPresetPicker(), { class: 'btn primary sm' })),
    list,
    el('div', { class: 'itemlist-foot' },
      UI.iconBtn(ICON.copy, 'Duplicate selected', () => S.duplicateItem(st.ui.selected)),
      UI.iconBtn(ICON.up, 'Move up', () => S.moveItem(st.ui.selected, -1)),
      UI.iconBtn(ICON.down, 'Move down', () => S.moveItem(st.ui.selected, 1)),
      UI.iconBtn(ICON.trash, 'Delete selected', () => {
        const it = S.findItem(st.ui.selected);
        UI.confirmDialog(`Delete ${it?.label}?`, () => S.removeItem(st.ui.selected));
      }, { class: 'ibtn danger' })));
}

/* ------------------------------------------------------------------ */

function editorPane(st, item) {
  const lib = st.lib;
  const series = seriesFor(item, lib);
  const colour = lib.colours.find((c) => c.id === item.colourId) || lib.colours[0];
  const price = priceItem(item, lib);

  const set = (patch) => S.update(() => Object.assign(item, patch));

  // title block, the way a drawing sheet carries its own identification
  const canvas = el('div', { class: 'preview-canvas' });
  const paint = () => {
    canvas.innerHTML = drawSVG(item, series, { colour: colour?.swatch, interactive: true });
  };
  paint();
  bindSheetEditing(canvas, item, paint);

  const preview = el('div', { class: 'preview' }, canvas,
    el('div', { class: 'preview-legend' },
      el('span', { class: 'lead' }, `${item.label} · ${describe(item)}`),
      el('span', {}, `${U.mm(item.width)} × ${U.mm(item.height)} mm · ${U.round(price.sqft, 2).toFixed(2)} sq.ft`),
      el('span', { class: 'preview-hint' }, 'Click a dimension · drag a divider')));

  return el('div', { class: 'editor' },
    el('div', { class: 'editor-top' },
      preview,
      el('div', { class: 'editor-side' },
        basics(item, st, set),
        specs(item, st, set),
        priceBox(item, price, set))),
    layoutEditor(item, st, series),
  );
}

/* ---- basics ---- */

function basics(item, st, set) {
  const lib = st.lib;
  const series = seriesFor(item, lib);
  return UI.section('Item',
    UI.grid(2,
      UI.field('Mark / label', UI.textInput(item.label, (v) => set({ label: v }))),
      UI.field('Qty', UI.numInput(item.qty, (v) => set({ qty: Math.max(1, U.num(v, 1)) }), { min: 1, step: 1 }))),
    UI.grid(2,
      UI.field('Width (mm)', UI.numInput(item.width, (v) => resize(item, U.num(v, 1), null), { min: 100, step: 5 })),
      UI.field('Height (mm)', UI.numInput(item.height, (v) => resize(item, null, U.num(v, 1)), { min: 100, step: 5 }))),
    UI.field('Series / profile system',
      UI.select(item.seriesId, lib.series.map((s) => ({ value: s.id, label: s.name })), (v) => set({ seriesId: v })),
      seriesHint(series)),
    UI.grid(2,
      UI.field('Location', UI.textInput(item.location, (v) => set({ location: v }), { placeholder: 'GF HALL FRONT SIDE' })),
      UI.field('Floor', UI.textInput(item.floor, (v) => set({ floor: v }), { placeholder: '0' }))),
    UI.field('Notes', UI.areaInput(item.notes, (v) => set({ notes: v }), { rows: 2, placeholder: 'EXTRA PREMIUM HARDWARE = HIVIK BRAND' })),
    UI.row(
      UI.button('Change type…', () => openPresetPicker(item), { class: 'btn' }),
      UI.button('Duplicate', () => S.duplicateItem(item.id), { class: 'btn' })));
}

const seriesHint = (s) => {
  if (!s) return '';
  const cost = s.costing === 'weight'
    ? `costed by weight · labour ₹${U.num(s.labourPerSqft)}/sq.ft`
    : `₹${U.num(s.rate)}/sq.ft`;
  return `frame ${U.mm(s.face)}mm · sash ${U.mm(s.sash)}mm · ${cost} · min ${U.num(s.minSqft)} sq.ft`;
};

/** Resizing keeps the section/cell proportions and re-fits them to the new size. */
function resize(item, w, h) {
  S.update(() => {
    if (w) item.width = Math.max(MIN_MODULE, w);
    if (h) item.height = Math.max(MIN_MODULE, h);
    refit(item);
  });
}

/* ---- specification ---- */

function specs(item, st, set) {
  const lib = st.lib;
  return UI.section('Specification',
    UI.field('Default glazing',
      UI.select(item.glassId, lib.glass.map((g) => ({ value: g.id, label: `${g.name} — ₹${g.rate}/sq.ft` })), (v) => set({ glassId: v })),
      'Applies to every pane that has no glass of its own.'),
    UI.grid(2,
      UI.field('Profile colour',
        UI.select(item.colourId, lib.colours.map((c) => ({ value: c.id, label: `${c.name}${c.extra ? ` (+₹${c.extra})` : ''}` })), (v) => set({ colourId: v }))),
      UI.field('Mesh type',
        UI.select(item.meshId, lib.mesh.map((m) => ({ value: m.id, label: `${m.name} — ₹${m.rate}` })), (v) => set({ meshId: v })))),
    UI.grid(2,
      UI.field('Locking', UI.select(item.locking, LOCK_OPTS, (v) => set({ locking: v }))),
      UI.field('Handle colour', UI.select(item.handleColour, HANDLE_OPTS, (v) => set({ handleColour: v })))));
}

const LOCK_OPTS = ['Multi-point', 'Touch lock', 'Single point', 'Mortise lock', '—'].map((v) => ({ value: v, label: v }));
const HANDLE_OPTS = ['BLACK', 'SILVER', 'WHITE', 'CHAMPAGNE', 'ROSE GOLD'].map((v) => ({ value: v, label: v }));

/* ---- price ---- */

function priceBox(item, price, set) {
  const b = price.breakdown;
  const rows = [
    [price.byWeight ? 'Aluminium (by weight)' : 'Aluminium + fabrication', price.byWeight ? b.metalCost : b.profile],
    ['Fabrication labour', b.labour],
    ['Powder coat / finish', b.finish],
    ['Glass', b.glass],
    ['Mesh', b.mesh],
    ['Hardware', b.hardware],
    ['Wastage', b.wastage],
    ['Add-on', b.addons],
    ['Line discount', -b.discount],
  ].filter(([, v]) => Math.abs(v) > 0.005);

  const metalRows = price.byWeight && price.metal
    ? el('details', { class: 'metal' },
      el('summary', {}, `Aluminium — ${U.round(price.metal.kg, 2)} kg over ${U.round(price.metal.totalMm / 1000, 1)} m`),
      el('table', { class: 'mini' }, el('tbody', {},
        ...price.metal.lines.map((l) => el('tr', {},
          el('td', {}, l.profile ? `${l.profile.code} · ${roleName(l.role)}` : `${roleName(l.role)} — no section assigned`),
          el('td', { class: 'r' }, `${U.round(l.metres, 2)} m`),
          el('td', { class: 'r' }, `${U.round(l.kg, 2)} kg`),
          el('td', { class: 'r' }, l.profile ? U.inr(l.cost) : '—'))),
        el('tr', { class: 'sep' },
          el('td', {}, 'Bars to order'),
          el('td', { class: 'r', colspan: 3 },
            price.metal.lines.filter((l) => l.bars).map((l) => `${l.bars} × ${l.profile.code}`).join(', ') || '—')))))
    : null;

  return UI.section('Price',
    el('table', { class: 'mini' },
      el('tbody', {},
        ...rows.map(([k, v]) => el('tr', {}, el('td', {}, k), el('td', { class: 'r' }, U.inr(v)))),
        el('tr', { class: 'sep' },
          el('td', {}, price.overridden ? 'Unit price (manual)' : 'Unit price'),
          el('td', { class: 'r b' }, U.inr(price.unit))),
        el('tr', {},
          el('td', {}, `Rate / sq.ft${price.minApplied ? ` · min ${price.series.minSqft} sq.ft applied` : ''}`),
          el('td', { class: 'r' }, U.inr(price.ratePerSqft))),
        el('tr', { class: 'tot' },
          el('td', {}, `Total × ${price.qty}`),
          el('td', { class: 'r b' }, '₹ ' + U.inr(price.total))))),
    metalRows,
    UI.grid(3,
      UI.field('Add-on ₹', UI.numInput(item.addonAmount, (v) => set({ addonAmount: U.num(v) }), { step: 100 })),
      UI.field('Discount %', UI.numInput(item.discountPct, (v) => set({ discountPct: U.num(v) }), { step: 1, min: 0, max: 100 })),
      UI.field('Override ₹', UI.numInput(item.unitPriceOverride ?? '', (v) => set({ unitPriceOverride: v === '' ? null : U.num(v) }), { step: 100, placeholder: 'auto' }))));
}

/* ---- layout: sections and panels ---- */

function layoutEditor(item, st, series) {
  const body = el('div', { class: 'sections' });

  item.sections.forEach((sec, si) => body.append(sectionCard(item, sec, si, st)));

  return el('div', { class: 'panel layout' },
    el('h3', { class: 'panel-title' }, 'Layout',
      el('span', { class: 'spacer' }),
      UI.button('+ Row above', () => addSection(item, 0), { class: 'btn sm' }),
      UI.button('+ Row below', () => addSection(item, item.sections.length), { class: 'btn sm' })),
    el('div', { class: 'panel-body' }, body,
      el('p', { class: 'note' },
        'A row spans the full width. Widths inside a row and the row heights are measured to the centre-line of the divider, exactly as they are dimensioned on the drawing — they always add up to the overall size.')));
}

function sectionCard(item, sec, si, st) {
  const isSliding = sec.type === 'sliding';
  const upd = (fn) => S.update(() => { fn(); refit(item); });

  const head = el('div', { class: 'sec-head' },
    el('span', { class: 'sec-no' }, `Row ${si + 1}`),
    UI.select(sec.type, [
      { value: 'grid', label: 'Fixed / openable panels' },
      { value: 'sliding', label: 'Sliding track' },
    ], (v) => upd(() => {
      sec.type = v;
      if (v === 'sliding' && !sec.panels?.length) {
        sec.tracks = 2;
        sec.panels = [{ id: U.uid('p'), fn: 'slide-l' }, { id: U.uid('p'), fn: 'slide-r' }];
      }
      if (v === 'grid' && !sec.cells?.length) sec.cells = [{ id: U.uid('c'), w: item.width, fn: 'fix' }];
    }), { class: 'inp sm' }),
    el('label', { class: 'inline-field' }, 'Height',
      UI.numInput(sec.h, (v) => upd(() => { sec.h = Math.max(50, U.num(v, 50)); }), { class: 'inp num sm', step: 5, min: 50 })),
    el('span', { class: 'spacer' }),
    UI.iconBtn(ICON.up, 'Move row up', () => upd(() => swap(item.sections, si, si - 1)), { disabled: si === 0 }),
    UI.iconBtn(ICON.down, 'Move row down', () => upd(() => swap(item.sections, si, si + 1)), { disabled: si === item.sections.length - 1 }),
    UI.iconBtn(ICON.plus, 'Add row below', () => addSection(item, si + 1)),
    UI.iconBtn(ICON.trash, 'Remove row', () => upd(() => {
      if (item.sections.length > 1) item.sections.splice(si, 1);
    }), { class: 'ibtn danger', disabled: item.sections.length < 2 }));

  return el('div', { class: 'sec-card' }, head,
    isSliding ? slidingBody(item, sec, st, upd) : gridBody(item, sec, st, upd));
}

function slidingBody(item, sec, st, upd) {
  const lib = st.lib;
  const tracks = U.clamp(Math.round(U.num(sec.tracks, 2)), 1, 6);
  while (sec.panels.length < tracks) sec.panels.push({ id: U.uid('p'), fn: 'slide-r' });
  sec.panels.length = tracks;

  return el('div', { class: 'sec-body' },
    UI.row(
      UI.field('Tracks', UI.numInput(tracks, (v) => upd(() => {
        sec.tracks = U.clamp(Math.round(U.num(v, 2)), 1, 6);
        while (sec.panels.length < sec.tracks) sec.panels.push({ id: U.uid('p'), fn: 'slide-r' });
        sec.panels.length = sec.tracks;
      }), { min: 1, max: 6, step: 1, class: 'inp num sm' })),
      UI.field('Mosquito net', UI.select(sec.mesh || 'none', [
        { value: 'none', label: 'No mesh' },
        { value: 'left', label: 'Mesh sash — parks left' },
        { value: 'right', label: 'Mesh sash — parks right' },
      ], (v) => upd(() => { sec.mesh = v; }), { class: 'inp sm' }))),
    el('div', { class: 'cellgrid' },
      ...sec.panels.map((p, pi) => el('div', { class: 'cellbox' },
        el('div', { class: 'cellbox-head' }, `Sash ${pi + 1}`),
        UI.select(p.fn, Object.entries(SLIDING_FN).map(([k, v]) => ({ value: k, label: v.label })),
          (v) => upd(() => { p.fn = v; }), { class: 'inp sm' }),
        UI.select(p.glassId || '', glassOpts(lib, item), (v) => upd(() => { p.glassId = v || null; }), { class: 'inp sm' })))));
}

function gridBody(item, sec, st, upd) {
  const lib = st.lib;
  return el('div', { class: 'sec-body' },
    el('div', { class: 'cellgrid' },
      ...sec.cells.map((c, ci) => el('div', { class: 'cellbox' },
        el('div', { class: 'cellbox-head' }, `Panel ${ci + 1}`,
          el('span', { class: 'spacer' }),
          UI.iconBtn(ICON.close, 'Remove panel', () => upd(() => {
            if (sec.cells.length > 1) sec.cells.splice(ci, 1);
          }), { class: 'ibtn tiny danger', disabled: sec.cells.length < 2 })),
        UI.field('Width (mm)', UI.numInput(c.w, (v) => upd(() => { c.w = Math.max(50, U.num(v, 50)); }), { class: 'inp num sm', step: 5, min: 50 })),
        UI.select(c.fn, Object.entries(CELL_FN).map(([k, v]) => ({ value: k, label: v.label })),
          (v) => upd(() => { c.fn = v; }), { class: 'inp sm' }),
        UI.select(c.glassId || '', glassOpts(lib, item), (v) => upd(() => { c.glassId = v || null; }), { class: 'inp sm' }))),
      el('button', {
        type: 'button', class: 'cellbox add',
        onclick: () => upd(() => sec.cells.push({ id: U.uid('c'), w: Math.round(item.width / (sec.cells.length + 1)), fn: 'fix' })),
      }, '+ Panel')));
}

const glassOpts = (lib, item) => [
  { value: '', label: `Default — ${lib.glass.find((g) => g.id === item.glassId)?.name || '—'}` },
  ...lib.glass.map((g) => ({ value: g.id, label: g.name })),
];

function addSection(item, at) {
  S.update(() => {
    const h = Math.max(100, Math.round(item.height / (item.sections.length + 1)));
    item.sections.splice(at, 0, {
      id: U.uid('sec'), type: 'grid', h, mesh: 'none', tracks: 2, panels: [],
      cells: [{ id: U.uid('c'), w: item.width, fn: 'fix' }],
    });
    refit(item);
  });
}

function swap(arr, a, b) {
  if (b < 0 || b >= arr.length) return;
  [arr[a], arr[b]] = [arr[b], arr[a]];
}

/* refit lives in geometry.js — the drawing and the editor must agree on it. */

/* ---- preset picker ---- */

export function openPresetPicker(target) {
  const st = S.state;
  const body = el('div', { class: 'presets' });

  for (const group of PRESET_GROUPS) {
    body.append(el('h4', { class: 'presets-group' }, group));
    const gridEl = el('div', { class: 'presets-grid' });
    for (const p of PRESETS.filter((x) => x.group === group)) {
      const demo = { width: p.w, height: p.h, sections: [] };
      applyPreset(demo, p, st.lib, true);
      const series = seriesFor(demo, st.lib);
      gridEl.append(el('button', {
        type: 'button', class: 'preset',
        onclick: () => {
          close();
          if (target) {
            S.update(() => applyPreset(target, p, st.lib, false));
          } else {
            const it = S.addItem({});
            S.update(() => applyPreset(it, p, st.lib, true));
          }
        },
      },
        el('div', { class: 'preset-thumb', html: drawSVG(demo, series, { colour: '#8d9199', showPlan: false, showNumbers: false, showTags: false }) }),
        el('div', { class: 'preset-name' }, p.name)));
    }
    body.append(gridEl);
  }

  const close = UI.modal(target ? `Change type — ${target.label}` : 'Add window or door', body);
}


/* --------------------------------------------------------------------
 * Editing on the sheet.
 *
 * Click any dimension to type an exact millimetre value, or drag a divider
 * or the frame edge to size it by eye. Changing a module keeps the overall
 * size and takes the difference from its neighbour; changing an overall
 * dimension rescales what is inside it.
 *
 * During a drag only the drawing is repainted — the surrounding UI is left
 * alone until the pointer is released, so the price and the item list do not
 * churn on every pixel.
 * ------------------------------------------------------------------ */

function bindSheetEditing(canvas, item, paint) {
  const infoOf = (n) => ({
    source: n.dataset.src,
    sectionIndex: U.num(n.dataset.si, -1),
    index: U.num(n.dataset.idx, 0),
    value: U.num(n.dataset.val, 0),
    axis: n.dataset.axis,
    x: U.num(n.dataset.x, 0),
    y: U.num(n.dataset.y, 0),
  });

  canvas.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.grip');
    if (!grip) return;
    e.preventDefault();
    beginDrag(e, infoOf(grip), item, canvas, paint);
  });

  const open = (node) => openDimensionInput(canvas, item, infoOf(node), paint);
  canvas.addEventListener('click', (e) => {
    const h = e.target.closest('.dimhit');
    if (h) open(h);
  });
  canvas.addEventListener('keydown', (e) => {
    const h = e.target.closest('.dimhit');
    if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(h); }
  });
}

function beginDrag(e, info, item, canvas, paint) {
  const svg = canvas.querySelector('svg');
  const scale = U.num(svg?.dataset.scale, 0);
  const shown = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
  const mmPerPx = scale > 0 ? 1 / (scale * shown) : 0;
  if (!mmPerPx) return;

  const start = { x: e.clientX, y: e.clientY };
  document.body.classList.add(info.axis === 'x' ? 'dragging-x' : 'dragging-y');
  let changed = false;

  const move = (ev) => {
    const d = (info.axis === 'x' ? ev.clientX - start.x : ev.clientY - start.y) * mmPerPx;
    if (applyDimension(item, info, info.value + d)) { changed = true; paint(); }
  };
  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    document.body.classList.remove('dragging-x', 'dragging-y');
    if (changed) S.emit();   // now refresh price, list and totals
  };
  // listeners live on the window so repainting the sheet cannot interrupt the drag
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function openDimensionInput(canvas, item, info, paint) {
  canvas.querySelector('.dim-input')?.remove();
  const svg = canvas.querySelector('svg');
  if (!svg) return;

  const box = svg.getBoundingClientRect();
  const host = canvas.getBoundingClientRect();
  const k = box.width / svg.viewBox.baseVal.width;

  const input = el('input', {
    type: 'number', class: 'dim-input', value: Math.round(info.value),
    min: MIN_MODULE, step: 1, 'aria-label': 'Dimension in millimetres',
  });
  Object.assign(input.style, {
    left: `${box.left - host.left + info.x * k - 34}px`,
    top: `${box.top - host.top + info.y * k - 13}px`,
  });
  canvas.append(input);
  input.focus();
  input.select();

  let done = false;
  const commit = (save) => {
    if (done) return;
    done = true;
    const v = U.num(input.value, NaN);
    input.remove();
    if (save && Number.isFinite(v) && applyDimension(item, info, v)) S.emit();
    else paint();
  };
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(true); }
    if (ev.key === 'Escape') { ev.preventDefault(); commit(false); }
  });
  input.addEventListener('blur', () => commit(true));
}
