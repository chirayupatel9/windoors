/* "Quotation" setup tab (company, customer, charges, terms) and the
 * "Library" tab where rates and profile geometry are maintained. */

import * as U from './util.js';
import * as UI from './ui.js';
import * as S from './store.js';
import { priceQuote } from './pricing.js';
import { FAMILIES, PROFILE_ROLES } from './catalog.js';
import { ICON } from './icons.js';

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

/* ================= Masters ================= */

/*
 * Master tables. When a passcode is set these render read-only until it is
 * entered — enough to stop a rate being changed by accident, which is what it
 * is for. It is not a security boundary and the UI says so.
 */

let ro = false;   // read-only for this render pass

const tIn = (v, on, a = {}) => UI.textInput(v, on, { ...a, disabled: ro });
const nIn = (v, on, a = {}) => UI.numInput(v, on, { ...a, disabled: ro });
const sIn = (v, opts, on, a = {}) => UI.select(v, opts, on, { ...a, disabled: ro });
const del = (title, fn, can) =>
  UI.iconBtn(ICON.trash, title, fn, { class: 'ibtn danger tiny', disabled: ro || !can });
const addBtn = (label, fn) => UI.button(label, fn, { class: 'btn sm', disabled: ro });

export function renderMastersTab(root) {
  const lib = S.state.lib;
  ro = S.mastersLocked();

  root.replaceChildren(el('div', { class: 'library' },
    lockBar(),
    profileTable(lib),
    seriesCards(lib),
    rateTable('Glazing', lib.glass, ['name', 'rate'], ['Glass', '₹ / sq.ft'], 'gl'),
    rateTable('Mesh', lib.mesh, ['name', 'rate'], ['Mesh', '₹ / sq.ft'], 'msh'),
    colourTable(lib),
    hardwareTable(lib),
    UI.section('Reset',
      el('p', { class: 'note' }, 'Restores the built-in profiles, series, glass and hardware. Your quotation items are kept.'),
      UI.button('Restore default masters', () => UI.confirmDialog(
        'Replace every master table with the built-in defaults?',
        () => S.update((s) => {
          const lock = s.lib.lock;
          s.lib = S.defaultLibrary();
          s.lib.lock = lock;
        }), 'Restore'), { class: 'btn', disabled: ro }))));
}

/* ---- lock ---- */

function lockBar() {
  const protectedNow = S.mastersProtected();
  const locked = S.mastersLocked();

  const actions = [];
  if (!protectedNow) {
    actions.push(UI.button('Set a passcode', askSetPasscode, { class: 'btn primary sm' }));
  } else if (locked) {
    actions.push(UI.button('Unlock to edit', askUnlock, { class: 'btn primary sm' }));
  } else {
    actions.push(UI.button('Lock now', () => { S.lockMasters(); UI.toast('Masters locked'); }, { class: 'btn sm' }));
    actions.push(UI.button('Change passcode', askSetPasscode, { class: 'btn sm' }));
    actions.push(UI.button('Remove passcode', () => UI.confirmDialog(
      'Remove the passcode? Anyone using this browser will be able to change rates.',
      () => { S.removePasscode(); UI.toast('Passcode removed'); }, 'Remove'), { class: 'btn sm' }));
  }

  return el('div', { class: 'lockbar' + (locked ? ' locked' : '') },
    el('span', { class: 'lockbar-icon', html: locked ? ICON.lock : protectedNow ? ICON.unlock : ICON.alert }),
    el('div', { class: 'lockbar-text' },
      el('strong', {},
        locked ? 'Masters are locked' : protectedNow ? 'Masters unlocked' : 'No passcode set'),
      el('span', {},
        locked
          ? 'Rates and profiles are read-only until you enter the passcode.'
          : protectedNow
            ? 'Changes are allowed. Lock again when you hand this device over.'
            : 'Anyone using this browser can change your rates. Set a passcode to prevent accidents — it is not encryption, and someone determined can still read the data stored here.')),
    el('div', { class: 'lockbar-actions' }, ...actions));
}

function askSetPasscode() {
  const a = el('input', { type: 'password', class: 'inp', placeholder: 'New passcode', autocomplete: 'new-password' });
  const b = el('input', { type: 'password', class: 'inp', placeholder: 'Repeat passcode', autocomplete: 'new-password' });
  const msg = el('p', { class: 'note' });
  const close = UI.modal('Set a passcode for the master tables',
    el('div', { class: 'stack' },
      UI.field('Passcode', a), UI.field('Repeat', b), msg,
      el('p', { class: 'note' },
        'Stored as a one-way hash in this browser only. If you forget it, clear the site data and set it again — your quotation is saved separately and survives that.')),
    [{ label: 'Save passcode', class: 'btn primary', onClick: async (done) => {
      if (!a.value) { msg.textContent = 'Enter a passcode.'; return; }
      if (a.value !== b.value) { msg.textContent = 'The two passcodes do not match.'; return; }
      await S.setPasscode(a.value);
      UI.toast('Passcode saved — masters unlocked');
      done();
    } }]);
  setTimeout(() => a.focus(), 30);
}

function askUnlock() {
  const inp = el('input', { type: 'password', class: 'inp', placeholder: 'Passcode', autocomplete: 'current-password' });
  const msg = el('p', { class: 'note' });
  const submit = async (done) => {
    if (await S.unlockMasters(inp.value)) { UI.toast('Masters unlocked'); done(); }
    else { msg.textContent = 'That passcode is not right.'; inp.select(); }
  };
  const close = UI.modal('Unlock the master tables',
    el('div', { class: 'stack' }, UI.field('Passcode', inp), msg),
    [{ label: 'Unlock', class: 'btn primary', onClick: submit }]);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(close); });
  setTimeout(() => inp.focus(), 30);
}

/* ---- profile sections ---- */

function profileTable(lib) {
  const body = el('tbody', {});
  lib.profiles.forEach((p, i) => {
    const perM = U.num(p.kgPerM) * U.num(p.ratePerKg);
    body.append(el('tr', {},
      el('td', {}, tIn(p.code, (v) => S.update(() => { p.code = v; }), { class: 'inp sm' })),
      el('td', {}, tIn(p.name, (v) => S.update(() => { p.name = v; }), { class: 'inp sm' })),
      el('td', {}, sIn(p.role, Object.entries(PROFILE_ROLES).map(([v, l]) => ({ value: v, label: l })),
        (v) => S.update(() => { p.role = v; }), { class: 'inp sm' })),
      el('td', {}, nIn(p.face, (v) => S.update(() => { p.face = U.num(v); }), { class: 'inp num sm', step: 1 })),
      el('td', {}, nIn(p.kgPerM, (v) => S.update(() => { p.kgPerM = U.num(v); }), { class: 'inp num sm', step: 0.001 })),
      el('td', {}, nIn(p.ratePerKg, (v) => S.update(() => { p.ratePerKg = U.num(v); }), { class: 'inp num sm', step: 1 })),
      el('td', {}, nIn(p.barLength, (v) => S.update(() => { p.barLength = U.num(v); }), { class: 'inp num sm', step: 1 })),
      el('td', { class: 'r calc' }, '₹ ' + U.inr(perM)),
      el('td', {}, del('Remove profile', () => S.update(() => lib.profiles.splice(i, 1)), lib.profiles.length > 1))));
  });

  return UI.section('Profile sections',
    el('p', { class: 'note' },
      'One row per extrusion you buy. The face width feeds the drawing wherever the section is assigned to a series; kg/m and ₹/kg cost it by weight. Bar length gives the number of lengths to order.'),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'libtable' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Code'), el('th', {}, 'Description'), el('th', {}, 'Role'),
          el('th', { title: 'Visible face width — drives the drawing' }, 'Face mm'),
          el('th', {}, 'kg / m'), el('th', {}, '₹ / kg'),
          el('th', { title: 'Standard stock length' }, 'Bar mm'),
          el('th', { class: 'r' }, '₹ / m'), el('th', {}))),
        body)),
    addBtn('+ Add profile section', () => S.update(() => lib.profiles.push({
      id: U.uid('pr'), code: 'NEW-01', name: 'New section', role: 'other',
      face: 0, kgPerM: 0.5, ratePerKg: 350, barLength: 4877,
    }))));
}

/* ---- series ---- */

function seriesCards(lib) {
  const cards = lib.series.map((s, i) => seriesCard(lib, s, i));
  return UI.section('Profile series',
    el('p', { class: 'note' },
      'A series is what you pick on an item. Assign profile sections to its roles, then choose how it is costed.'),
    el('div', { class: 'sercards' }, ...cards),
    addBtn('+ Add series', () => S.update(() => lib.series.push({
      id: U.uid('ser'), name: 'New series', family: 'casement',
      face: 40, sash: 38, mullion: 40, transom: 40, interlock: 18, bead: 6,
      rate: 500, minSqft: 10, wastagePct: 0, costing: 'sqft', labourPerSqft: 0, sections: {},
    }))));
}

function seriesCard(lib, s, i) {
  const byWeight = s.costing === 'weight';
  const set = (patch) => S.update(() => Object.assign(s, patch));
  const assigned = s.sections || (s.sections = {});

  const roleRow = (role) => {
    const opts = [
      { value: '', label: '— none —' },
      ...lib.profiles
        .filter((p) => p.role === role || p.role === 'other')
        .map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
    ];
    return UI.field(PROFILE_ROLES[role],
      sIn(assigned[role] || '', opts, (v) => S.update(() => {
        if (v) assigned[role] = v; else delete assigned[role];
      }), { class: 'inp sm' }));
  };

  const faceField = (key, label, role) => {
    const prof = lib.profiles.find((p) => p.id === assigned[role]);
    const driven = prof && U.num(prof.face) > 0;
    return UI.field(label,
      UI.numInput(driven ? U.num(prof.face) : s[key], (v) => S.update(() => { s[key] = U.num(v); }),
        { class: 'inp num sm', step: 1, disabled: ro || driven }),
      driven ? `from ${prof.code}` : null);
  };

  return el('div', { class: 'sercard' },
    el('div', { class: 'sercard-head' },
      tIn(s.name, (v) => set({ name: v }), { class: 'inp' }),
      sIn(s.family, Object.entries(FAMILIES).map(([v, l]) => ({ value: v, label: l })),
        (v) => set({ family: v }), { class: 'inp sm' }),
      del('Remove series', () => S.update(() => lib.series.splice(i, 1)), lib.series.length > 1)),

    el('div', { class: 'sercard-body' },
      el('div', { class: 'costmode' },
        el('span', { class: 'field-label' }, 'Costed by'),
        el('div', { class: 'seg' },
          segBtn('Flat ₹ / sq.ft', !byWeight, () => set({ costing: 'sqft' })),
          segBtn('Weight of metal', byWeight, () => set({ costing: 'weight' })))),

      byWeight
        ? UI.grid(3,
          UI.field('Fabrication labour ₹/sq.ft', nIn(s.labourPerSqft, (v) => set({ labourPerSqft: U.num(v) }), { class: 'inp num sm', step: 5 })),
          UI.field('Min sq.ft', nIn(s.minSqft, (v) => set({ minSqft: U.num(v) }), { class: 'inp num sm', step: 1 })),
          UI.field('Wastage %', nIn(s.wastagePct, (v) => set({ wastagePct: U.num(v) }), { class: 'inp num sm', step: 0.5 })))
        : UI.grid(3,
          UI.field('Rate ₹ / sq.ft', nIn(s.rate, (v) => set({ rate: U.num(v) }), { class: 'inp num sm', step: 5 })),
          UI.field('Min sq.ft', nIn(s.minSqft, (v) => set({ minSqft: U.num(v) }), { class: 'inp num sm', step: 1 })),
          UI.field('Wastage %', nIn(s.wastagePct, (v) => set({ wastagePct: U.num(v) }), { class: 'inp num sm', step: 0.5 }))),

      el('div', { class: 'subhead' }, 'Profile sections'),
      UI.grid(4, ...['frame', 'sash', 'mullion', 'transom', 'bead', 'interlock', 'meshSash', 'louver'].map(roleRow)),

      el('div', { class: 'subhead' }, 'Face widths used by the drawing'),
      UI.grid(3,
        faceField('face', 'Outer frame mm', 'frame'),
        faceField('sash', 'Sash mm', 'sash'),
        faceField('mullion', 'Mullion mm', 'mullion'),
        faceField('transom', 'Transom mm', 'transom'),
        faceField('interlock', 'Interlock mm', 'interlock'),
        faceField('bead', 'Glazing bead mm', 'bead')),

      byWeight && !hasAnySection(assigned)
        ? el('p', { class: 'warn' }, 'This series is costed by weight but has no profile sections assigned, so the aluminium will price at zero. Assign at least the outer frame and sash.')
        : null));
}

const hasAnySection = (a) => Object.values(a || {}).some(Boolean);

const segBtn = (label, active, onClick) => el('button', {
  type: 'button', class: 'segbtn' + (active ? ' on' : ''), disabled: ro, onclick: onClick,
}, label);

/* ---- simple rate tables ---- */

function rateTable(title, list, keys, labels, prefix) {
  const body = el('tbody', {});
  list.forEach((row, i) => {
    body.append(el('tr', {},
      ...keys.map((k) => el('td', {},
        k === 'rate'
          ? nIn(row[k], (v) => S.update(() => { row[k] = U.num(v); }), { class: 'inp num sm', step: 1 })
          : tIn(row[k], (v) => S.update(() => { row[k] = v; }), { class: 'inp sm' }))),
      el('td', {}, del('Remove', () => S.update(() => list.splice(i, 1)), list.length > 1))));
  });
  return UI.section(title,
    el('div', { class: 'tablewrap' },
      el('table', { class: 'libtable' },
        el('thead', {}, el('tr', {}, ...labels.map((l) => el('th', {}, l)), el('th', {}))),
        body)),
    addBtn('+ Add', () => S.update(() => list.push({ id: U.uid(prefix), name: 'New', rate: 0 }))));
}

function colourTable(lib) {
  const body = el('tbody', {});
  lib.colours.forEach((c, i) => {
    body.append(el('tr', {},
      el('td', {}, tIn(c.name, (v) => S.update(() => { c.name = v; }), { class: 'inp sm' })),
      el('td', {}, tIn(c.brand, (v) => S.update(() => { c.brand = v; }), { class: 'inp sm' })),
      el('td', {}, nIn(c.extra, (v) => S.update(() => { c.extra = U.num(v); }), { class: 'inp num sm', step: 1 })),
      el('td', {}, el('input', {
        type: 'color', class: 'inp colour', value: c.swatch || '#8d9199', disabled: ro,
        oninput: (e) => S.update(() => { c.swatch = e.target.value; }),
      })),
      el('td', {}, del('Remove', () => S.update(() => lib.colours.splice(i, 1)), lib.colours.length > 1))));
  });
  return UI.section('Profile colours',
    el('p', { class: 'note' }, 'The swatch is what the drawing paints the aluminium with.'),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'libtable' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Colour'), el('th', {}, 'Brand'),
          el('th', { title: 'Extra ₹ per sq.ft' }, 'Extra ₹/sq.ft'),
          el('th', {}, 'Swatch'), el('th', {}))),
        body)),
    addBtn('+ Add colour', () => S.update(() => lib.colours.push({
      id: U.uid('col'), name: 'NEW', brand: 'AkzoNobel', extra: 0, swatch: '#8d9199',
    }))));
}

function hardwareTable(lib) {
  const body = el('tbody', {});
  lib.hardware.forEach((h, i) => {
    body.append(el('tr', {},
      el('td', {}, tIn(h.name, (v) => S.update(() => { h.name = v; }), { class: 'inp sm' })),
      el('td', {}, sIn(h.per, [
        { value: 'sash', label: 'per leaf / sash' },
        { value: 'item', label: 'per window' },
        { value: 'sqft', label: 'per sq.ft' },
      ], (v) => S.update(() => { h.per = v; }), { class: 'inp sm' })),
      el('td', {}, nIn(h.rate, (v) => S.update(() => { h.rate = U.num(v); }), { class: 'inp num sm', step: 10 })),
      el('td', {}, del('Remove', () => S.update(() => lib.hardware.splice(i, 1)), lib.hardware.length > 1))));
  });
  return UI.section('Hardware',
    el('p', { class: 'note' }, 'Leaf hardware is applied automatically by opening type.'),
    el('div', { class: 'tablewrap' },
      el('table', { class: 'libtable' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Item'), el('th', {}, 'Charged'), el('th', {}, '₹'), el('th', {}))),
        body)),
    addBtn('+ Add hardware', () => S.update(() => lib.hardware.push({
      id: U.uid('hw'), name: 'New hardware', per: 'sash', rate: 0,
    }))));
}
