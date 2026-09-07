/* "Quotation" setup tab (company, customer, charges, terms) and the
 * "Library" tab where rates and profile geometry are maintained. */

import * as U from './util.js';
import * as UI from './ui.js';
import * as S from './store.js';
import { priceQuote } from './pricing.js';
import { FAMILIES } from './catalog.js';

const { el } = U;

/* ================= Setup ================= */

export function renderSetupTab(root) {
  const doc = S.state.doc;
  const set = (patch) => S.update(() => Object.assign(doc, patch));
  const setCo = (patch) => S.update(() => Object.assign(doc.company, patch));
  const setCust = (patch) => S.update(() => Object.assign(doc.customer, patch));
  const setChg = (patch) => S.update(() => Object.assign(doc.charges, patch));
  const q = priceQuote(doc, S.state.lib);

  root.replaceChildren(el('div', { class: 'setup' },
    el('div', { class: 'setup-col' },
      UI.section('Your company',
        UI.field('Company name', UI.textInput(doc.company.name, (v) => setCo({ name: v }))),
        UI.field('Address', UI.areaInput(doc.company.address, (v) => setCo({ address: v }), { rows: 3 })),
        UI.grid(2,
          UI.field('Contact no.', UI.textInput(doc.company.phone, (v) => setCo({ phone: v }))),
          UI.field('Email', UI.textInput(doc.company.email, (v) => setCo({ email: v })))),
        UI.field('GSTIN', UI.textInput(doc.company.gstin, (v) => setCo({ gstin: v }), { placeholder: '24XXXXXXXXXXXZX' })),
        UI.field('Footer note', UI.textInput(doc.company.footer, (v) => setCo({ footer: v }))),
        logoField(doc, setCo)),

      UI.section('Bank details (printed with the terms)',
        el('p', { class: 'note' }, 'Stored only in this browser — nothing is uploaded anywhere.'),
        UI.grid(2,
          UI.field('Account name', UI.textInput(doc.company.bankAccountName, (v) => setCo({ bankAccountName: v }))),
          UI.field('Bank name', UI.textInput(doc.company.bankName, (v) => setCo({ bankName: v })))),
        UI.grid(3,
          UI.field('Account no.', UI.textInput(doc.company.bankAccount, (v) => setCo({ bankAccount: v }))),
          UI.field('IFSC', UI.textInput(doc.company.bankIfsc, (v) => setCo({ bankIfsc: v }))),
          UI.field('Branch', UI.textInput(doc.company.bankBranch, (v) => setCo({ bankBranch: v }))))),

      UI.section('Terms & conditions',
        ...(doc.terms || []).map((block, bi) => el('div', { class: 'terms-edit' },
          UI.field(`Heading ${bi + 1}`, UI.textInput(block.heading, (v) => S.update(() => { block.heading = v; }))),
          UI.field('Clauses — one per line',
            UI.areaInput((block.lines || []).join('\n'),
              (v) => S.update(() => { block.lines = v.split('\n'); }), { rows: 8 })))),
        UI.checkbox(doc.showTerms, 'Print the terms pages', (v) => set({ showTerms: v })))),

    el('div', { class: 'setup-col' },
      UI.section('Quotation',
        UI.grid(2,
          UI.field('Quote no.', UI.textInput(doc.quoteNo, (v) => set({ quoteNo: v }))),
          UI.field('Date', el('input', {
            type: 'date', class: 'inp', value: doc.date,
            oninput: (e) => set({ date: e.target.value }),
          }))),
        UI.field('Sales person', UI.textInput(doc.salesPerson, (v) => set({ salesPerson: v }))),
        UI.field('Drawing view label', UI.textInput(doc.viewLabel, (v) => set({ viewLabel: v }), { placeholder: 'View From Inside' })),
        UI.checkbox(doc.showBreakup, 'Show the per-item cost break-up on the quotation', (v) => set({ showBreakup: v }))),

      UI.section('Customer',
        UI.field('Name', UI.textInput(doc.customer.name, (v) => setCust({ name: v }), { placeholder: 'Mr NIRMAL SIR - VALSAD' })),
        UI.field('Address', UI.areaInput(doc.customer.address, (v) => setCust({ address: v }), { rows: 3 })),
        UI.grid(2,
          UI.field('Contact', UI.textInput(doc.customer.phone, (v) => setCust({ phone: v }))),
          UI.field('Email', UI.textInput(doc.customer.email, (v) => setCust({ email: v })))),
        UI.field('Site', UI.textInput(doc.customer.site, (v) => setCust({ site: v })))),

      UI.section('Charges & tax',
        UI.grid(2,
          UI.field('Overall discount %', UI.numInput(doc.charges.discountPct, (v) => setChg({ discountPct: U.num(v) }), { step: 0.5, min: 0, max: 100 })),
          UI.field('Installation ₹', UI.numInput(doc.charges.installation, (v) => setChg({ installation: U.num(v) }), { step: 500 }))),
        UI.grid(2,
          UI.field('Transportation ₹', UI.numInput(doc.charges.transport, (v) => setChg({ transport: U.num(v) }), { step: 500 })),
          UI.field('Loading & unloading ₹', UI.numInput(doc.charges.loading, (v) => setChg({ loading: U.num(v) }), { step: 500 }))),
        UI.grid(2,
          UI.field('Other charge label', UI.textInput(doc.charges.otherLabel, (v) => setChg({ otherLabel: v }))),
          UI.field('Other charge ₹', UI.numInput(doc.charges.other, (v) => setChg({ other: U.num(v) }), { step: 500 }))),
        UI.grid(2,
          UI.field('Tax label', UI.textInput(doc.charges.gstLabel, (v) => setChg({ gstLabel: v }), { placeholder: 'GST' })),
          UI.field('Tax %', UI.numInput(doc.charges.gstPct, (v) => setChg({ gstPct: U.num(v) }), { step: 1, min: 0, max: 50 }))),
        UI.checkbox(doc.charges.roundOff !== false, 'Round the grand total to the nearest rupee', (v) => setChg({ roundOff: v })),
        el('table', { class: 'mini big' }, el('tbody', {},
          el('tr', {}, el('td', {}, 'Total area'), el('td', { class: 'r' }, `${U.round(q.totalSqft, 2)} sq.ft`)),
          el('tr', {}, el('td', {}, 'Items'), el('td', { class: 'r' }, `${q.totalQty} nos`)),
          el('tr', {}, el('td', {}, 'Avg. rate / sq.ft'), el('td', { class: 'r' }, '₹ ' + U.inr(q.avgPerSqft))),
          el('tr', {}, el('td', {}, 'Basic value'), el('td', { class: 'r' }, '₹ ' + U.inr(q.basic))),
          el('tr', { class: 'tot' }, el('td', {}, 'Total project cost'), el('td', { class: 'r b' }, '₹ ' + U.inr(q.grand)))))))));
}

function logoField(doc, setCo) {
  const preview = doc.company.logo
    ? el('img', { class: 'logo-prev', src: doc.company.logo, alt: 'logo' })
    : el('span', { class: 'note' }, 'No logo set');
  const input = el('input', {
    type: 'file', accept: 'image/*', class: 'inp',
    onchange: (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 1.5 * 1024 * 1024) return UI.toast('Please use a logo under 1.5 MB', 'err');
      const fr = new FileReader();
      fr.onload = () => setCo({ logo: String(fr.result) });
      fr.readAsDataURL(f);
    },
  });
  return UI.field('Logo', el('div', { class: 'logo-field' }, preview, input,
    doc.company.logo ? UI.button('Remove', () => setCo({ logo: '' }), { class: 'btn sm' }) : null));
}

/* ================= Library ================= */

export function renderLibraryTab(root) {
  const lib = S.state.lib;
  root.replaceChildren(el('div', { class: 'library' },
    seriesTable(lib),
    rateTable('Glazing', lib.glass, ['name', 'rate'], ['Glass', '₹ / sq.ft'], 'gl'),
    rateTable('Mesh', lib.mesh, ['name', 'rate'], ['Mesh', '₹ / sq.ft'], 'msh'),
    colourTable(lib),
    hardwareTable(lib),
    UI.section('Reset',
      el('p', { class: 'note' }, 'Restores the built-in series, glass and hardware rates. Your quotation items are kept.'),
      UI.button('Restore default library', () => UI.confirmDialog(
        'Replace the whole library with the built-in defaults?',
        () => S.update((s) => { s.lib = S.defaultLibrary(); }), 'Restore'), { class: 'btn' }))));
}

function seriesTable(lib) {
  const cols = [
    ['name', 'Series name', 'text', ''],
    ['family', 'Family', 'family', ''],
    ['face', 'Frame mm', 'num', 'Outer frame face width'],
    ['sash', 'Sash mm', 'num', 'Sash face width'],
    ['mullion', 'Mullion mm', 'num', ''],
    ['transom', 'Transom mm', 'num', ''],
    ['interlock', 'Interlock mm', 'num', 'Sliding sash overlap'],
    ['rate', '₹ / sq.ft', 'num', 'Aluminium + fabrication'],
    ['minSqft', 'Min sq.ft', 'num', 'Minimum billed area'],
    ['wastagePct', 'Wastage %', 'num', ''],
  ];
  const body = el('tbody', {});
  lib.series.forEach((s, i) => {
    body.append(el('tr', {},
      ...cols.map(([k, , kind]) => el('td', {},
        kind === 'family'
          ? UI.select(s[k], Object.entries(FAMILIES).map(([v, l]) => ({ value: v, label: l })),
            (v) => S.update(() => { s[k] = v; }), { class: 'inp sm' })
          : kind === 'num'
            ? UI.numInput(s[k], (v) => S.update(() => { s[k] = U.num(v); }), { class: 'inp num sm', step: 1 })
            : UI.textInput(s[k], (v) => S.update(() => { s[k] = v; }), { class: 'inp sm' }))),
      el('td', {}, UI.iconBtn('🗑', 'Remove series', () => S.update(() => {
        if (lib.series.length > 1) lib.series.splice(i, 1);
      }), { class: 'ibtn danger tiny', disabled: lib.series.length < 2 }))));
  });
  return UI.section('Aluminium profile series',
    el('p', { class: 'note' }, 'Frame, sash, mullion, transom and interlock widths drive the drawing; the rate and minimum area drive the price.'),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'libtable' },
        el('thead', {}, el('tr', {}, ...cols.map(([, label, , hint]) => el('th', { title: hint }, label)), el('th', {}))),
        body)),
    UI.button('+ Add series', () => S.update(() => lib.series.push({
      id: U.uid('ser'), name: 'New series', family: 'casement',
      face: 40, sash: 38, mullion: 40, transom: 40, interlock: 18, bead: 6,
      rate: 500, minSqft: 10, wastagePct: 0,
    })), { class: 'btn sm' }));
}

function rateTable(title, list, keys, labels, prefix) {
  const body = el('tbody', {});
  list.forEach((row, i) => {
    body.append(el('tr', {},
      ...keys.map((k) => el('td', {},
        k === 'rate'
          ? UI.numInput(row[k], (v) => S.update(() => { row[k] = U.num(v); }), { class: 'inp num sm', step: 1 })
          : UI.textInput(row[k], (v) => S.update(() => { row[k] = v; }), { class: 'inp sm' }))),
      el('td', {}, UI.iconBtn('🗑', 'Remove', () => S.update(() => {
        if (list.length > 1) list.splice(i, 1);
      }), { class: 'ibtn danger tiny', disabled: list.length < 2 }))));
  });
  return UI.section(title,
    el('div', { class: 'tablewrap' },
      el('table', { class: 'libtable' },
        el('thead', {}, el('tr', {}, ...labels.map((l) => el('th', {}, l)), el('th', {}))),
        body)),
    UI.button('+ Add', () => S.update(() => list.push({ id: U.uid(prefix), name: 'New', rate: 0 })), { class: 'btn sm' }));
}

function colourTable(lib) {
  const body = el('tbody', {});
  lib.colours.forEach((c, i) => {
    body.append(el('tr', {},
      el('td', {}, UI.textInput(c.name, (v) => S.update(() => { c.name = v; }), { class: 'inp sm' })),
      el('td', {}, UI.textInput(c.brand, (v) => S.update(() => { c.brand = v; }), { class: 'inp sm' })),
      el('td', {}, UI.numInput(c.extra, (v) => S.update(() => { c.extra = U.num(v); }), { class: 'inp num sm', step: 1 })),
      el('td', {}, el('input', {
        type: 'color', class: 'inp colour', value: c.swatch || '#8d9199',
        oninput: (e) => S.update(() => { c.swatch = e.target.value; }),
      })),
      el('td', {}, UI.iconBtn('🗑', 'Remove', () => S.update(() => {
        if (lib.colours.length > 1) lib.colours.splice(i, 1);
      }), { class: 'ibtn danger tiny', disabled: lib.colours.length < 2 }))));
  });
  return UI.section('Profile colours',
    el('p', { class: 'note' }, 'The swatch is what the drawing paints the aluminium with.'),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'libtable' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Colour'), el('th', {}, 'Brand'), el('th', { title: 'Extra ₹ per sq.ft' }, 'Extra ₹/sq.ft'),
          el('th', {}, 'Swatch'), el('th', {}))),
        body)),
    UI.button('+ Add colour', () => S.update(() => lib.colours.push({
      id: U.uid('col'), name: 'NEW', brand: 'AkzoNobel', extra: 0, swatch: '#8d9199',
    })), { class: 'btn sm' }));
}

function hardwareTable(lib) {
  const body = el('tbody', {});
  lib.hardware.forEach((h, i) => {
    body.append(el('tr', {},
      el('td', {}, UI.textInput(h.name, (v) => S.update(() => { h.name = v; }), { class: 'inp sm' })),
      el('td', {}, UI.select(h.per, [
        { value: 'sash', label: 'per leaf / sash' },
        { value: 'item', label: 'per window' },
        { value: 'sqft', label: 'per sq.ft' },
      ], (v) => S.update(() => { h.per = v; }), { class: 'inp sm' })),
      el('td', {}, UI.numInput(h.rate, (v) => S.update(() => { h.rate = U.num(v); }), { class: 'inp num sm', step: 10 })),
      el('td', {}, UI.iconBtn('🗑', 'Remove', () => S.update(() => {
        if (lib.hardware.length > 1) lib.hardware.splice(i, 1);
      }), { class: 'ibtn danger tiny', disabled: lib.hardware.length < 2 }))));
  });
  return UI.section('Hardware',
    el('p', { class: 'note' }, 'Leaf hardware is applied automatically by opening type. Anything priced "per window" can be added to an item as an extra.'),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'libtable' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Item'), el('th', {}, 'Charged'), el('th', {}, '₹'), el('th', {}))),
        body)),
    UI.button('+ Add hardware', () => S.update(() => lib.hardware.push({
      id: U.uid('hw'), name: 'New hardware', per: 'sash', rate: 0,
    })), { class: 'btn sm' }));
}
