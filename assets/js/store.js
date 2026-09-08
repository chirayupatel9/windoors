/* Application state: the quotation document + the parts library.
 * Persisted to localStorage; portable via JSON export/import. */

import * as U from './util.js';
import * as CAT from './catalog.js';

const KEY = 'windoors.v1';

let quotaWarned = false;
let onSaveError = () => {};
/** The UI supplies a way to tell the user that saving stopped working. */
export const setSaveErrorHandler = (fn) => { onSaveError = fn; };

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
  customers: [],
  quotePrefix: 'QT-',
  quoteNext: 1,
  profiles: CAT.defaultProfiles(),
  series: CAT.defaultSeries(),
  glass: CAT.defaultGlass(),
  mesh: CAT.defaultMesh(),
  colours: CAT.defaultColours(),
  hardware: CAT.defaultHardware(),
  chargeRates: CAT.defaultChargeRates(),
  lock: { hash: '', unlocked: true },
});

/**
 * The next quote number, from the prefix and running count held in Masters.
 * Reading it does not consume it — `newQuote()` does that, so a preview of the
 * number never burns one.
 */
export function nextQuoteNo(lib) {
  const prefix = lib?.quotePrefix ?? 'QT-';
  const n = Math.max(1, Math.round(U.num(lib?.quoteNext, 1)));
  return prefix + String(n).padStart(5, '0');
}

export const emptyCustomer = () => ({
  id: U.uid('cus'),
  name: '',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  site: '',
  note: '',
});

/*
 * Blank on purpose. These print on the letterhead of every quotation the
 * software sends out, so they are filled in by whoever is using it — shipping
 * one firm's name and GSTIN as another's default would put the wrong company
 * on a customer's paperwork.
 */
export const defaultCompany = () => ({
  name: '',
  address: '',
  phone: '',
  email: '',
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
  id: U.uid('q'),
  createdAt: new Date().toISOString(),
  company: defaultCompany(),
  quoteNo: nextQuoteNo(lib),
  date: U.todayISO(),
  salesPerson: '',
  customerId: null,
  // kept for quotations made before customers existed, and as a fallback
  customer: { name: '', address: '', phone: '', email: '', site: '' },
  items: starterItems(lib),
  // seeded from the library so a new quote starts on your standard rates
  charges: {
    discountPct: U.num(lib.chargeRates?.discountPct),
    labourPerSqft: U.num(lib.chargeRates?.labourPerSqft),
    labourLabel: lib.chargeRates?.labourLabel || 'Labour charges',
    installation: U.num(lib.chargeRates?.installation),
    transport: U.num(lib.chargeRates?.transport),
    loading: U.num(lib.chargeRates?.loading),
    other: 0,
    otherLabel: lib.chargeRates?.otherLabel || 'Other charges',
    gstPct: U.num(lib.chargeRates?.gstPct),
    gstLabel: lib.chargeRates?.gstLabel || 'GST',
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
  quotes: [],
  currentId: null,
  ui: { tab: 'items', selected: null, section: 0, cell: 0, theme: 'system' },
};

/*
 * Everything downstream reads `state.doc` — the quotation being worked on.
 * Keeping it a live view of `quotes[currentId]` means switching customers or
 * opening an older job needs no changes anywhere else.
 */
Object.defineProperty(state, 'doc', {
  enumerable: true,
  get() {
    return state.quotes.find((q) => q.id === state.currentId) || state.quotes[0] || null;
  },
  set(next) {
    const at = state.quotes.findIndex((q) => q.id === state.currentId);
    if (at >= 0) state.quotes[at] = next;
    else state.quotes.push(next);
    state.currentId = next.id;
  },
});

state.quotes = [defaultDoc(state.lib)];
state.lib.quoteNext += 1;   // the opening quotation consumes its number too
state.currentId = state.quotes[0].id;
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
    localStorage.setItem(KEY, JSON.stringify({
      v: 2, lib: state.lib, quotes: state.quotes, currentId: state.currentId, theme: state.ui.theme,
    }));
    quotaWarned = false;
  } catch (e) {
    // private mode, or the browser's storage is full. The app keeps working in
    // memory, but the user needs to know their work is no longer being kept.
    if (!quotaWarned) {
      quotaWarned = true;
      onSaveError(e);
    }
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const saved = data?.quotes?.length ? data.quotes : (data?.doc ? [data.doc] : null);
    if (!saved) return false;
    state.lib = migrateLib(data.lib);
    state.quotes = saved.map((q) => migrateDoc(q, state.lib));
    adoptLooseCustomers();
    state.currentId = state.quotes.some((q) => q.id === data.currentId)
      ? data.currentId : state.quotes[0].id;
    if (['light', 'dark', 'system'].includes(data.theme)) state.ui.theme = data.theme;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Starts a fresh quotation on the CURRENT library — your profiles, rates and
 * charge defaults are yours and survive this. Restoring the built-in library
 * is a separate, explicit action in Masters.
 */
/** Starts a fresh quotation on the CURRENT masters, keeping the ones already made. */
export function reset() {
  newQuote(state.doc?.customerId || null);
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
  out.chargeRates = { ...CAT.defaultChargeRates(), ...(lib.chargeRates || {}) };
  out.customers = Array.isArray(lib.customers) ? lib.customers : [];
  out.quotePrefix = lib.quotePrefix ?? 'QT-';
  out.quoteNext = U.num(lib.quoteNext, 1);
  // series saved before profile sections existed default to flat-rate costing
  out.series = out.series.map((s) => ({
    costing: 'sqft', labourPerSqft: 0, sections: {}, ...s,
  }));
  return out;
}

function migrateDoc(doc, lib) {
  const d = defaultDoc(lib);
  const out = { ...d, ...doc };
  out.id = doc.id || U.uid('q');
  out.createdAt = doc.createdAt || new Date().toISOString();
  if (out.customerId === undefined) out.customerId = null;
  out.company = { ...d.company, ...(doc.company || {}) };
  out.customer = { ...d.customer, ...(doc.customer || {}) };
  out.charges = { ...d.charges, ...(doc.charges || {}) };
  // labour was briefly a lump sum; it is a rate per sq.ft now
  if (out.charges.labour !== undefined) delete out.charges.labour;
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
  return JSON.stringify({
    v: 2, exported: new Date().toISOString(),
    lib: state.lib, quotes: state.quotes, currentId: state.currentId,
  }, null, 2);
}

export function fromJSON(text) {
  const data = JSON.parse(text);
  const saved = data?.quotes?.length ? data.quotes : (data?.doc ? [data.doc] : null);
  if (!saved) throw new Error('Not a WinDoors quotation file.');
  state.lib = migrateLib(data.lib);
  state.quotes = saved.map((q) => migrateDoc(q, state.lib));
  adoptLooseCustomers();
  state.currentId = state.quotes.some((q) => q.id === data.currentId)
    ? data.currentId : state.quotes[0].id;
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


/* --------------------------------------------------------------------
 * Theme. "system" leaves the document unstamped so prefers-color-scheme —
 * or the theme a host has already stamped on us — decides; an explicit
 * choice stamps data-theme and wins in both directions.
 * ------------------------------------------------------------------ */

export const THEMES = ['system', 'light', 'dark'];

export function applyTheme() {
  const root = document.documentElement;
  if (state.ui.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = state.ui.theme;
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  state.ui.theme = theme;
  applyTheme();
  emit();
}

/** What the page is actually showing right now. */
export function resolvedTheme() {
  if (state.ui.theme !== 'system') return state.ui.theme;
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'light' || stamped === 'dark') return stamped;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}


/* --------------------------------------------------------------------
 * Customers
 * ------------------------------------------------------------------ */

export const findCustomer = (id) => state.lib.customers.find((c) => c.id === id) || null;

/** The customer a quotation is addressed to, falling back to typed-in details. */
export function customerOf(doc) {
  return findCustomer(doc?.customerId) || doc?.customer || null;
}

export function addCustomer(fields = {}) {
  const c = { ...emptyCustomer(), ...fields, id: U.uid('cus') };
  state.lib.customers.push(c);
  emit();
  return c;
}

export function removeCustomer(id) {
  const at = state.lib.customers.findIndex((c) => c.id === id);
  if (at < 0) return;
  state.lib.customers.splice(at, 1);
  // quotations keep the details they were addressed to rather than going blank
  for (const q of state.quotes) {
    if (q.customerId !== id) continue;
    q.customerId = null;
  }
  emit();
}

/** How many quotations are addressed to this customer. */
export const quotesFor = (id) => state.quotes.filter((q) => q.customerId === id);

/*
 * Quotations made before customers existed carry typed-in details. Turn each
 * distinct name into a real customer so the whole history groups properly.
 */
function adoptLooseCustomers() {
  for (const q of state.quotes) {
    if (q.customerId || !q.customer?.name?.trim()) continue;
    const name = q.customer.name.trim();
    let c = state.lib.customers.find((x) => x.name.trim().toLowerCase() === name.toLowerCase());
    if (!c) {
      c = { ...emptyCustomer(), id: U.uid('cus'), name,
        address: q.customer.address || '', phone: q.customer.phone || '',
        email: q.customer.email || '', site: q.customer.site || '' };
      state.lib.customers.push(c);
    }
    q.customerId = c.id;
  }
}

/* --------------------------------------------------------------------
 * Quotations
 * ------------------------------------------------------------------ */

export const currentQuote = () => state.doc;

/** Starts a new quotation on the current masters, optionally for a customer. */
export function newQuote(customerId = null) {
  const q = defaultDoc(state.lib);
  q.customerId = customerId;
  q.items = q.items.map((i) => normaliseItem(i, state.lib));
  state.lib.quoteNext = Math.max(1, Math.round(U.num(state.lib.quoteNext, 1))) + 1;
  state.quotes.push(q);
  openQuote(q.id);
  return q;
}

export function openQuote(id) {
  if (!state.quotes.some((q) => q.id === id)) return;
  state.currentId = id;
  state.ui.selected = state.doc.items[0]?.id || null;
  state.ui.section = 0;
  state.ui.cell = 0;
  emit();
}

/** Copies a quotation — the usual way to quote a revision or a similar job. */
export function duplicateQuote(id, customerId) {
  const src = state.quotes.find((q) => q.id === id);
  if (!src) return null;
  const copy = U.clone(src);
  copy.id = U.uid('q');
  copy.createdAt = new Date().toISOString();
  copy.date = U.todayISO();
  copy.quoteNo = nextQuoteNo(state.lib);
  state.lib.quoteNext = Math.max(1, Math.round(U.num(state.lib.quoteNext, 1))) + 1;
  if (customerId !== undefined) copy.customerId = customerId;
  copy.items.forEach((it) => {
    it.id = U.uid('it');
    it.sections.forEach((sec) => {
      sec.id = U.uid('sec');
      (sec.cells || []).forEach((c) => (c.id = U.uid('c')));
      (sec.panels || []).forEach((pn) => (pn.id = U.uid('p')));
    });
  });
  const at = state.quotes.findIndex((q) => q.id === id);
  state.quotes.splice(at + 1, 0, copy);
  openQuote(copy.id);
  return copy;
}

export function removeQuote(id) {
  const at = state.quotes.findIndex((q) => q.id === id);
  if (at < 0) return;
  state.quotes.splice(at, 1);
  if (!state.quotes.length) {
    const q = defaultDoc(state.lib);
    q.items = q.items.map((i) => normaliseItem(i, state.lib));
    state.quotes.push(q);
  }
  const next = state.quotes[Math.min(at, state.quotes.length - 1)];
  state.currentId = next.id;
  state.ui.selected = next.items[0]?.id || null;
  emit();
}
