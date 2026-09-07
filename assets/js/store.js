/* Application state: the quotation document + the parts library.
 * Persisted to localStorage; portable via JSON export/import. */

import * as U from './util.js';
import * as CAT from './catalog.js';

const KEY = 'windoors.v1';

export const emptyItem = (lib, n = 1) => ({
  id: U.uid('it'),
  label: `W${n}`,
  qty: 1,
  width: 1500,
  height: 1200,
  seriesId: lib.series[0]?.id,
  colourId: lib.colours.find((c) => c.name === 'GREY')?.id || lib.colours[0]?.id,
  glassId: lib.glass[0]?.id,
  meshId: lib.mesh[0]?.id,
  handleColour: 'BLACK',
  locking: 'Multi-point',
  location: '',
  floor: '',
  notes: '',
  sections: [{ id: U.uid('sec'), type: 'grid', h: 1200, cells: [{ id: U.uid('c'), w: 1500, fn: 'fix' }] }],
  hardwareIds: null,
  extraHardwareIds: [],
  addonAmount: 0,
  discountPct: 0,
  unitPriceOverride: null,
});

export const defaultLibrary = () => ({
  profiles: CAT.defaultProfiles(),
  series: CAT.defaultSeries(),
  glass: CAT.defaultGlass(),
  mesh: CAT.defaultMesh(),
  colours: CAT.defaultColours(),
  hardware: CAT.defaultHardware(),
  lock: { hash: '', unlocked: true },
});

export const defaultCompany = () => ({
  name: 'WOLF GERMAN WINDOW',
  address: 'Opp. Rural Police Station, Kadodra-Surat Road,\nTen, Ta. Bardoli - 394601',
  phone: '+91 9512368444',
  email: 'wolfgermanwindow@gmail.com',
  gstin: '',
  logo: '',           // data URL, set by the user
  bankName: '',
  bankAccountName: '',
  bankAccount: '',
  bankIfsc: '',
  bankBranch: '',
  footer: 'powered by WinDoors Quotation Studio',
});

/* A first-run job so the tool opens showing what it does rather than blank.
 * "Start a new quotation" in the Export menu clears it. */
export function starterItems(lib) {
  const ser = (family) => lib.series.find((s) => s.family === family)?.id || lib.series[0].id;
  const glass = (frag) => lib.glass.find((g) => g.name.includes(frag))?.id || lib.glass[0].id;
  const base = (n) => emptyItem(lib, n);

  const sliding = {
    ...base(1), label: 'W1', seriesId: ser('sliding'), glassId: glass('REFLECTIVE'),
    width: 1800, height: 1500, location: 'LIVING ROOM', floor: '0',
    sections: [{
      id: U.uid('sec'), type: 'sliding', h: 1500, tracks: 2, mesh: 'left', cells: [],
      panels: [{ id: U.uid('p'), fn: 'slide-l' }, { id: U.uid('p'), fn: 'slide-r' }],
    }],
  };
  const casement = {
    ...base(2), label: 'W2', seriesId: ser('casement'), glassId: glass('5 MM CLEAR'),
    width: 1400, height: 1900, location: 'BEDROOM-1', floor: '1',
    sections: [
      { id: U.uid('sec'), type: 'grid', h: 500, tracks: 2, mesh: 'none', panels: [],
        cells: [{ id: U.uid('c'), w: 700, fn: 'fix' }, { id: U.uid('c'), w: 700, fn: 'fix' }] },
      { id: U.uid('sec'), type: 'grid', h: 1400, tracks: 2, mesh: 'none', panels: [],
        cells: [{ id: U.uid('c'), w: 700, fn: 'casement-l' }, { id: U.uid('c'), w: 700, fn: 'casement-r' }] },
    ],
  };
  const vent = {
    ...base(3), label: 'V1', seriesId: ser('ventilator'), glassId: glass('FROSTED'),
    width: 600, height: 900, location: 'COMMON BATHROOM', floor: '1',
    sections: [
      { id: U.uid('sec'), type: 'grid', h: 420, tracks: 2, mesh: 'none', panels: [],
        cells: [{ id: U.uid('c'), w: 300, fn: 'casement-r' }, { id: U.uid('c'), w: 300, fn: 'fan' }] },
      { id: U.uid('sec'), type: 'grid', h: 480, tracks: 2, mesh: 'none', panels: [],
        cells: [{ id: U.uid('c'), w: 600, fn: 'louver' }] },
    ],
  };
  return [sliding, casement, vent].map((i) => normaliseItem(i, lib));
}

export const defaultDoc = (lib) => ({
  company: defaultCompany(),
  quoteNo: 'QT-00001',
  date: U.todayISO(),
  salesPerson: '',
  customer: { name: '', address: '', phone: '', email: '', site: '' },
  items: starterItems(lib),
  charges: {
    discountPct: 0,
    installation: 0,
    transport: 0,
    loading: 0,
    other: 0,
    otherLabel: 'Other charges',
    gstPct: 0,
    gstLabel: 'GST',
    roundOff: true,
  },
  terms: CAT.defaultTerms(),
  showTerms: true,
  showBreakup: false,
  viewLabel: 'View From Inside',
});

/* ------------------------------------------------------------------ */

const listeners = new Set();

export const state = {
  lib: defaultLibrary(),
  doc: null,
  ui: { tab: 'items', selected: null, section: 0, cell: 0 },
};
state.doc = defaultDoc(state.lib);
state.doc.items = state.doc.items.map((i) => normaliseItem(i, state.lib));
state.ui.selected = state.doc.items[0].id;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let frame = null;
export function emit() {
  save();
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    listeners.forEach((fn) => fn(state));
  });
}

/** Mutate state then notify. */
export function update(fn) {
  fn(state);
  emit();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, lib: state.lib, doc: state.doc }));
  } catch (e) { /* private mode / quota — the app still works in memory */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data?.doc) return false;
    state.lib = migrateLib(data.lib);
    state.doc = migrateDoc(data.doc, state.lib);
    return true;
  } catch (e) {
    return false;
  }
}

export function reset() {
  state.lib = defaultLibrary();
  state.doc = defaultDoc(state.lib);
  state.ui.selected = state.doc.items[0].id;
  emit();
}

/** Fills in anything a newer build added, so old saves keep working. */
function migrateLib(lib) {
  const d = defaultLibrary();
  if (!lib) return d;
  const out = { ...d, ...lib };
  for (const k of Object.keys(d)) {
    if (!Array.isArray(d[k])) continue;
    if (!Array.isArray(out[k]) || !out[k].length) out[k] = d[k];
  }
  out.lock = { hash: '', unlocked: true, ...(lib.lock || {}) };
  // series saved before profile sections existed default to flat-rate costing
  out.series = out.series.map((s) => ({
    costing: 'sqft', labourPerSqft: 0, sections: {}, ...s,
  }));
  return out;
}

function migrateDoc(doc, lib) {
  const d = defaultDoc(lib);
  const out = { ...d, ...doc };
  out.company = { ...d.company, ...(doc.company || {}) };
  out.customer = { ...d.customer, ...(doc.customer || {}) };
  out.charges = { ...d.charges, ...(doc.charges || {}) };
  out.terms = doc.terms?.length ? doc.terms : d.terms;
  out.items = (doc.items || []).map((it) => normaliseItem(it, lib));
  if (!out.items.length) out.items = [emptyItem(lib, 1)];
  return out;
}

export function normaliseItem(it, lib) {
  const base = emptyItem(lib, 1);
  const out = { ...base, ...it };
  out.sections = (it.sections?.length ? it.sections : base.sections).map((s) => ({
    id: s.id || U.uid('sec'),
    type: s.type === 'sliding' ? 'sliding' : 'grid',
    h: U.num(s.h, 1),
    tracks: U.clamp(Math.round(U.num(s.tracks, 2)), 1, 6),
    mesh: s.mesh || 'none',
    meshId: s.meshId || out.meshId,
    cells: (s.cells || [{ fn: 'fix' }]).map((c) => ({
      id: c.id || U.uid('c'), w: U.num(c.w, 1), fn: c.fn || 'fix',
      glassId: c.glassId || null, meshId: c.meshId || null,
    })),
    panels: (s.panels || []).map((p) => ({
      id: p.id || U.uid('p'), fn: p.fn || 'slide-r', glassId: p.glassId || null,
    })),
  }));
  return out;
}

/* ---- item helpers ---------------------------------------------------- */

export const findItem = (id) => state.doc.items.find((i) => i.id === id) || null;

export function addItem(preset) {
  const n = state.doc.items.length + 1;
  const it = normaliseItem({ ...emptyItem(state.lib, n), ...(preset || {}) }, state.lib);
  it.id = U.uid('it');
  it.label = preset?.label || `W${n}`;
  state.doc.items.push(it);
  state.ui.selected = it.id;
  state.ui.section = 0;
  state.ui.cell = 0;
  emit();
  return it;
}

export function duplicateItem(id) {
  const src = findItem(id);
  if (!src) return null;
  const copy = U.clone(src);
  copy.id = U.uid('it');
  copy.label = nextLabel(src.label);
  copy.sections.forEach((s) => {
    s.id = U.uid('sec');
    (s.cells || []).forEach((c) => (c.id = U.uid('c')));
    (s.panels || []).forEach((p) => (p.id = U.uid('p')));
  });
  const at = state.doc.items.findIndex((i) => i.id === id);
  state.doc.items.splice(at + 1, 0, copy);
  state.ui.selected = copy.id;
  emit();
  return copy;
}

function nextLabel(label) {
  const m = /^([A-Za-z]*)(\d+)$/.exec(String(label || 'W1'));
  if (!m) return label + ' copy';
  const used = new Set(state.doc.items.map((i) => i.label));
  let n = parseInt(m[2], 10);
  let out;
  do { out = m[1] + ++n; } while (used.has(out));
  return out;
}

export function removeItem(id) {
  const at = state.doc.items.findIndex((i) => i.id === id);
  if (at < 0) return;
  state.doc.items.splice(at, 1);
  if (!state.doc.items.length) state.doc.items.push(emptyItem(state.lib, 1));
  state.ui.selected = state.doc.items[Math.min(at, state.doc.items.length - 1)].id;
  emit();
}

export function moveItem(id, dir) {
  const at = state.doc.items.findIndex((i) => i.id === id);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= state.doc.items.length) return;
  const [it] = state.doc.items.splice(at, 1);
  state.doc.items.splice(to, 0, it);
  emit();
}

/* ---- import / export ------------------------------------------------- */

export function toJSON() {
  return JSON.stringify({ v: 1, exported: new Date().toISOString(), lib: state.lib, doc: state.doc }, null, 2);
}

export function fromJSON(text) {
  const data = JSON.parse(text);
  if (!data?.doc) throw new Error('Not a WinDoors quotation file.');
  state.lib = migrateLib(data.lib);
  state.doc = migrateDoc(data.doc, state.lib);
  state.ui.selected = state.doc.items[0]?.id || null;
  emit();
}


/* --------------------------------------------------------------------
 * Master-table lock.
 *
 * This keeps a salesperson from changing rates by accident. It is not a
 * security boundary: the data lives in this browser and anyone determined
 * can read it. Say so plainly in the UI rather than implying otherwise.
 * ------------------------------------------------------------------ */

export async function hashCode(code) {
  const text = String(code ?? '');
  if (!text) return '';
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('windoors:' + text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // http:// without a secure context has no SubtleCrypto — still better than nothing
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return 'fnv' + h.toString(16);
  }
}

export const mastersLocked = () => !!state.lib.lock?.hash && !state.lib.lock?.unlocked;
export const mastersProtected = () => !!state.lib.lock?.hash;

export async function setPasscode(code) {
  const hash = await hashCode(code);
  update((s) => { s.lib.lock = { hash, unlocked: true }; });
  return true;
}

export async function unlockMasters(code) {
  const hash = await hashCode(code);
  if (!hash || hash !== state.lib.lock?.hash) return false;
  update((s) => { s.lib.lock.unlocked = true; });
  return true;
}

export function lockMasters() {
  if (!state.lib.lock?.hash) return;
  update((s) => { s.lib.lock.unlocked = false; });
}

export function removePasscode() {
  update((s) => { s.lib.lock = { hash: '', unlocked: true }; });
}
