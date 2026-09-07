/* Bootstrap: top bar, tab routing, keyboard shortcuts. */

import * as U from './util.js';
import * as UI from './ui.js';
import * as S from './store.js';
import { renderItemsTab, openPresetPicker } from './editor.js';
import { renderQuoteTab } from './quote.js';
import { renderSetupTab, renderLibraryTab } from './settings.js';
import * as X from './exporters.js';
import { priceQuote } from './pricing.js';

const { el, $ } = U;

const TABS = [
  { id: 'items', label: 'Items', render: renderItemsTab },
  { id: 'quote', label: 'Quotation', render: renderQuoteTab },
  { id: 'setup', label: 'Setup', render: renderSetupTab },
  { id: 'library', label: 'Library', render: renderLibraryTab },
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
      el('span', { class: 'brand-mark' }, '▤'),
      el('span', { class: 'brand-name' }, 'WinDoors'),
      el('span', { class: 'brand-sub' }, 'Quotation Studio')),

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
      UI.button('Print / PDF', () => X.printQuote(() => go('quote')), { class: 'btn primary' }),
      el('div', { class: 'menu' },
        UI.button('Export ▾', (e) => toggleMenu(e.currentTarget), { class: 'btn' }),
        el('div', { class: 'menu-pop' },
          menuItem('Save job file (.json)', X.exportJSON),
          menuItem('Open job file…', X.importJSON),
          menuItem('Drawings as PNG sheet', X.exportAllPNG),
          menuItem('Priced lines as CSV', () => X.exportCSV(priceQuote(S.state.doc, S.state.lib))),
          menuItem('Current drawing as PNG', () => {
            const it = S.findItem(S.state.ui.selected);
            if (it) X.exportItemPNG(it); else UI.toast('Select an item first', 'err');
          }),
          menuItem('Current drawing as SVG', () => {
            const it = S.findItem(S.state.ui.selected);
            if (it) X.exportItemSVG(it); else UI.toast('Select an item first', 'err');
          }),
          el('hr', {}),
          menuItem('Start a new quotation', () => UI.confirmDialog(
            'Clear this quotation and start again? Your library is kept.',
            () => { S.reset(); go('items'); UI.toast('New quotation started'); }, 'Start new')))))
  ];
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

  const restored = S.load();
  if (!S.state.ui.selected) S.state.ui.selected = S.state.doc.items[0]?.id || null;

  const hash = location.hash.replace('#', '');
  if (TABS.some((t) => t.id === hash)) S.state.ui.tab = hash;

  S.subscribe(() => draw());
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#', '');
    if (TABS.some((t) => t.id === h) && h !== S.state.ui.tab) { S.state.ui.tab = h; draw(); }
  });

  draw();
  if (restored) UI.toast('Picked up where you left off');
  $('#boot')?.remove();
}
