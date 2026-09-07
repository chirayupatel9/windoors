/* Bootstrap: top bar, tab routing, keyboard shortcuts. */

import * as U from './util.js';
import * as UI from './ui.js';
import * as S from './store.js';
import { renderItemsTab, openPresetPicker } from './editor.js';
import { renderQuoteTab } from './quote.js';
import { renderSetupTab, renderMastersTab } from './settings.js';
import * as X from './exporters.js';
import { priceQuote } from './pricing.js';
import { BRAND_MARK, ICON } from './icons.js';

const { el, $ } = U;

const TABS = [
  { id: 'items', label: 'Items', render: renderItemsTab },
  { id: 'quote', label: 'Quotation', render: renderQuoteTab },
  { id: 'setup', label: 'Setup', render: renderSetupTab },
  { id: 'masters', label: 'Masters', render: renderMastersTab },
];

let mount, bar;

function go(tab) {
  if (S.state.ui.tab === tab) return;
  S.state.ui.tab = tab;
  location.hash = tab;
  draw();
}

function draw() {
  const st = S.state;
  const tab = TABS.find((t) => t.id === st.ui.tab) || TABS[0];
  bar.replaceChildren(...topbar(st));
  document.body.dataset.tab = tab.id;
  tab.render(mount);
}

function topbar(st) {
  const q = priceQuote(st.doc, st.lib);
  return [
    el('div', { class: 'brand' },
      el('span', { class: 'brand-mark', html: BRAND_MARK }),
      el('span', { class: 'brand-name' }, 'WinDoors'),
      el('span', { class: 'brand-sub' }, 'Quotation Studio')),

    quoteSwitcher(st),

    el('nav', { class: 'tabs' },
      ...TABS.map((t) => el('button', {
        type: 'button',
        class: 'tab' + (t.id === st.ui.tab ? ' active' : ''),
        onclick: () => go(t.id),
      }, t.label))),

    el('div', { class: 'topsum' },
      el('span', {}, `${q.totalQty} nos`),
      el('span', {}, `${U.round(q.totalSqft, 1)} sq.ft`),
      el('strong', {}, '₹ ' + U.inr(q.grand, 0))),

    el('div', { class: 'actions' },
      themeToggle(st),
      printButton(),
      el('div', { class: 'menu' },
        exportButton(),
        el('div', { class: 'menu-pop' },
          menuItem('Save job file (.json)', X.exportJSON),
          menuItem('Open job file…', X.importJSON),
          menuItem('Drawings as PNG sheet', X.exportAllPNG),
          menuItem('Priced lines as CSV', () => X.exportCSV(priceQuote(S.state.doc, S.state.lib))),
          menuItem('Cutting list as CSV (factory)', X.exportCutList),
          menuItem('Current drawing as PNG', () => {
            const it = S.findItem(S.state.ui.selected);
            if (it) X.exportItemPNG(it); else UI.toast('Select an item first', 'err');
          }),
          menuItem('Current drawing as SVG', () => {
            const it = S.findItem(S.state.ui.selected);
            if (it) X.exportItemSVG(it); else UI.toast('Select an item first', 'err');
          }),
          el('hr', {}),
          menuItem('Quotations…', openQuoteBrowser),
          menuItem('New quotation', () => {
            S.newQuote(S.state.doc?.customerId || null);
            go('items');
            UI.toast('New quotation started');
          }))))
  ];
}

/* Which job is open, and the way into all the others. */
function quoteSwitcher(st) {
  const doc = st.doc;
  const cust = S.customerOf(doc);
  const b = UI.button('', openQuoteBrowser, { class: 'btn quoteswitch', title: 'Open another quotation' });
  b.append(
    el('span', { class: 'qs-text' },
      el('strong', {}, doc?.quoteNo || '—'),
      el('span', {}, cust?.name?.trim() || 'No customer')),
    el('span', { class: 'btn-icon caret', html: ICON.chevron }));
  return b;
}

/*
 * Every quotation, grouped under the customer it is addressed to — which is
 * how they are remembered ("that job for Nirmal in August"), not by number.
 */
function openQuoteBrowser() {
  const st = S.state;
  const body = el('div', { class: 'quotelist' });

  const groups = new Map();
  for (const q of st.quotes) {
    const key = q.customerId || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  // customers with the most recent work first
  const latest = (list) => Math.max(...list.map((q) => Date.parse(q.createdAt) || 0));
  const ordered = [...groups.entries()].sort((a, b) => latest(b[1]) - latest(a[1]));

  for (const [cid, list] of ordered) {
    const cust = S.findCustomer(cid);
    const value = list.reduce((a, q) => a + priceQuote(q, st.lib).grand, 0);
    body.append(el('h4', { class: 'quotelist-group' },
      el('span', {}, cust?.name?.trim() || 'Not addressed to a customer'),
      el('span', { class: 'quotelist-sum' },
        `${list.length} quotation${list.length > 1 ? 's' : ''} · ₹ ${U.inr(value, 0)}`)));

    for (const q of list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
      const t = priceQuote(q, st.lib);
      const open = q.id === st.currentId;
      body.append(el('div', { class: 'quoterow' + (open ? ' open' : '') },
        el('button', {
          type: 'button', class: 'quoterow-main',
          onclick: () => { close(); S.openQuote(q.id); },
        },
          el('span', { class: 'quoterow-no' }, q.quoteNo || '—'),
          el('span', { class: 'quoterow-meta' },
            `${U.fmtDate(q.date)} · ${t.totalQty} nos · ${U.round(t.totalSqft, 1)} sq.ft`),
          el('span', { class: 'quoterow-val' }, '₹ ' + U.inr(t.grand, 0)),
          open ? el('span', { class: 'quoterow-open' }, 'open') : null),
        UI.iconBtn(ICON.copy, 'Duplicate this quotation',
          () => { close(); S.duplicateQuote(q.id); UI.toast('Copied — new number assigned'); }),
        UI.iconBtn(ICON.trash, 'Delete this quotation', () => UI.confirmDialog(
          `Delete ${q.quoteNo}? This cannot be undone.`,
          () => { close(); S.removeQuote(q.id); UI.toast('Quotation deleted'); }),
          { class: 'ibtn danger' })));
    }
  }

  const close = UI.modal('Quotations', body, [
    { label: '+ New quotation', class: 'btn primary', onClick: (done) => {
      done();
      S.newQuote(S.state.doc?.customerId || null);
      go('items');
      UI.toast('New quotation started');
    } },
  ]);
}

/* system / light / dark, cycled in that order; the icon shows what is on. */
function themeToggle(st) {
  const order = { system: 'light', light: 'dark', dark: 'system' };
  const icon = { system: ICON.monitor, light: ICON.sun, dark: ICON.moon };
  const label = { system: 'Theme: follows your device', light: 'Theme: light', dark: 'Theme: dark' };
  const cur = st.ui.theme;
  return UI.iconBtn(icon[cur], `${label[cur]} — click for ${order[cur]}`,
    () => S.setTheme(order[cur]), { class: 'ibtn theme' });
}

function printButton() {
  const b = UI.button('', () => X.printQuote(() => go('quote')),
    { class: 'btn primary', title: 'Print the quotation', 'aria-label': 'Print the quotation' });
  b.append(
    el('span', { class: 'btn-icon', html: ICON.print }),
    el('span', { class: 'btn-label' }, 'Print / PDF'));
  return b;
}

function exportButton() {
  const b = UI.button('Export', (e) => toggleMenu(e.currentTarget), { class: 'btn', 'aria-haspopup': 'true' });
  b.append(el('span', { class: 'btn-icon caret', html: ICON.chevron }));
  return b;
}

const menuItem = (label, fn) => el('button', {
  type: 'button', class: 'menu-item',
  onclick: () => { closeMenus(); fn(); },
}, label);

function toggleMenu(btn) {
  const pop = btn.parentElement.querySelector('.menu-pop');
  const open = pop.classList.contains('open');
  closeMenus();
  if (!open) pop.classList.add('open');
}
const closeMenus = () => U.$$('.menu-pop.open').forEach((m) => m.classList.remove('open'));

function bindGlobalEvents() {
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) closeMenus(); });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      X.printQuote(() => go('quote'));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      X.exportJSON();
      return;
    }
    if (typing) return;
    if (e.key === 'n' && S.state.ui.tab === 'items') { e.preventDefault(); openPresetPicker(); }
    if (e.key >= '1' && e.key <= '4') go(TABS[+e.key - 1].id);
  });
}

/* ---- start ---- */

export function start() {
  mount = $('#mount');
  bar = $('#topbar');
  bindGlobalEvents();
  X.primeDownloads();   // resolve the save path before anyone clicks Export
  S.setSaveErrorHandler(() => UI.toast(
    'This browser will not store any more quotations — save a job file to keep your work', 'err'));

  const restored = S.load();
  S.applyTheme();
  if (!S.state.ui.selected) S.state.ui.selected = S.state.doc.items[0]?.id || null;

  const hash = location.hash.replace('#', '');
  if (hash === 'library') S.state.ui.tab = 'masters';        // pre-rename links
  else if (TABS.some((t) => t.id === hash)) S.state.ui.tab = hash;

  S.subscribe(() => draw());
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#', '');
    if (TABS.some((t) => t.id === h) && h !== S.state.ui.tab) { S.state.ui.tab = h; draw(); }
  });

  draw();
  if (restored) UI.toast('Picked up where you left off');
  $('#boot')?.remove();
}
