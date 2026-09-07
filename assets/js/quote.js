/* The printable quotation: A4 pages, paginated by measuring real row heights
 * so a tall drawing never gets sliced across a page break. */

import * as U from './util.js';
import * as S from './store.js';
import * as UI from './ui.js';
import { drawSVG } from './draw.js';
import { priceQuote } from './pricing.js';
import { describe, solve, glazingGroups, meshGroups, seriesFor, cutList, metalSummary } from './geometry.js';
import { ALL_FN } from './catalog.js';

const { el } = U;

export function renderQuoteTab(root) {
  const sheet = el('div', { class: 'sheet', id: 'sheet' });
  const wrap = el('div', { class: 'quote-wrap' }, sheet);
  const repaginate = () => buildPages(sheet, S.state.doc, S.state.lib);

  root.replaceChildren(el('div', { class: 'quote-view' }, chargesBar(repaginate), wrap));
  // paginate after layout so measurements are real, then fit the sheet
  requestAnimationFrame(() => { repaginate(); fitSheet(wrap, sheet); });

  const onResize = U.debounce(() => fitSheet(wrap, sheet), 120);
  window.addEventListener('resize', onResize);
  // the tab swap replaces this subtree; drop the listener with it
  new MutationObserver((_, mo) => {
    if (!document.contains(wrap)) { window.removeEventListener('resize', onResize); mo.disconnect(); }
  }).observe(root, { childList: true });
}

/*
 * An A4 page is 210mm wide and a phone is not. Rather than crop the sheet or
 * make the reader scroll sideways through it, scale the whole page down to the
 * width available — the same thing a print preview does. `zoom` is used rather
 * than a transform because it takes part in layout, so the scrolling column
 * still ends where the pages end.
 */
const A4_PX = 794;   // 210mm at 96dpi

function fitSheet(wrap, sheet) {
  const style = getComputedStyle(wrap);
  const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const room = wrap.clientWidth - pad;
  sheet.style.zoom = room >= A4_PX ? '' : String(U.clamp(room / A4_PX, 0.25, 1));
}

/*
 * The charges that get settled at the last minute — labour, cartage, the
 * discount you agree on the phone — sit on the quotation itself, so they can
 * be adjusted while looking at the total instead of in a separate tab.
 * They write to the same document as the Setup tab.
 */
function chargesBar(repaginate) {
  const doc = S.state.doc;
  const q = priceQuote(doc, S.state.lib);

  // charges do not change pagination, so repaint the totals in place and
  // leave the pages alone unless a line appears or disappears
  const bump = () => { S.save(); requestAnimationFrame(repaginate); render(); };
  const set = (patch) => { Object.assign(doc.charges, patch); bump(); };

  const money = (label, key, step = 500) => UI.field(label,
    UI.numInput(doc.charges[key], (v) => set({ [key]: U.num(v) }), { class: 'inp num sm', step }));

  const box = el('div', { class: 'charges' });
  const render = () => {
    const t = priceQuote(doc, S.state.lib);
    box.replaceChildren(
      el('div', { class: 'charges-fields' },
        UI.field('Discount %', UI.numInput(doc.charges.discountPct,
          (v) => set({ discountPct: U.clamp(U.num(v), 0, 100) }), { class: 'inp num sm', step: 0.5, min: 0, max: 100 })),
        UI.field(`${doc.charges.labourLabel || 'Labour'} ₹/sq.ft`,
          UI.numInput(doc.charges.labourPerSqft, (v) => set({ labourPerSqft: U.num(v) }),
            { class: 'inp num sm', step: 5, min: 0 }),
          t.labour ? `= ₹ ${U.inr(t.labour)}` : null),
        money('Installation ₹', 'installation'),
        money('Transport ₹', 'transport'),
        money('Loading ₹', 'loading'),
        money(doc.charges.otherLabel || 'Other ₹', 'other'),
        UI.field('GST %', UI.numInput(doc.charges.gstPct,
          (v) => set({ gstPct: U.clamp(U.num(v), 0, 50) }), { class: 'inp num sm', step: 1, min: 0, max: 50 }))),
      el('div', { class: 'charges-total' },
        el('span', {}, `Basic ₹ ${U.inr(t.basic)}`),
        t.gst ? el('span', {}, `${doc.charges.gstLabel || 'GST'} ₹ ${U.inr(t.gst)}`) : null,
        el('strong', {}, `Total ₹ ${U.inr(t.grand)}`)));
  };
  render();

  return el('div', { class: 'chargesbar' },
    el('div', { class: 'chargesbar-head' },
      el('span', { class: 'field-label' }, 'Charges — adjust before printing'),
      el('span', { class: 'spacer' }),
      UI.button('More in Setup', () => { location.hash = 'setup'; }, { class: 'btn sm' })),
    box);
}

/** Renders the whole document into `host` as A4 pages. */
export function buildPages(host, doc, lib) {
  host.replaceChildren();
  const q = priceQuote(doc, lib);

  const pages = [];
  let page = newPage(host, doc, pages.length);
  pages.push(page);
  page.inner.prepend(headerBlock(doc));

  const table = quoteTable();
  page.inner.append(table);
  let tbody = table.tBodies[0];

  const overflows = () => page.inner.scrollHeight > page.inner.clientHeight + 1;

  const flow = (node) => {
    const wasEmpty = !tbody.children.length;
    tbody.append(node);
    if (!overflows()) return;
    if (wasEmpty) {
      // this one row is taller than a whole page — let the page run long
      page.page.classList.add('tall');
      return;
    }
    node.remove();
    page = newPage(host, doc, pages.length);
    pages.push(page);
    const t = quoteTable();
    page.inner.append(t);
    tbody = t.tBodies[0];
    tbody.append(node);
    if (overflows()) page.page.classList.add('tall');
  };

  q.lines.forEach((line, i) => flow(lineRow(line, i, doc, lib)));
  flow(totalsRow(q, doc));

  if (doc.showTerms) {
    for (const block of doc.terms || []) {
      let tp = newPage(host, doc, pages.length);
      pages.push(tp);
      const box = el('div', { class: 'terms' }, el('h4', { class: 'terms-head' }, block.heading));
      tp.inner.append(box);
      for (const t of block.lines || []) {
        const p = el('p', { class: 'terms-line' }, t);
        box.append(p);
        if (tp.inner.scrollHeight > tp.inner.clientHeight + 1) {
          p.remove();
          tp = newPage(host, doc, pages.length);
          pages.push(tp);
          const cont = el('div', { class: 'terms' }, el('h4', { class: 'terms-head' }, block.heading + ' (contd.)'));
          tp.inner.append(cont);
          cont.append(p);
        }
      }
      if (block === (doc.terms || [])[0] && bankFilled(doc.company)) {
        tp.inner.append(bankBlock(doc.company));
      }
    }
    const last = pages[pages.length - 1];
    last.inner.append(signBlock());
    if (last.inner.scrollHeight > last.inner.clientHeight + 1) {
      last.inner.lastChild.remove();
      const sp = newPage(host, doc, pages.length);
      pages.push(sp);
      sp.inner.append(signBlock());
    }
  }

  pages.forEach((p, i) => {
    p.foot.querySelector('.pg').textContent = `${i + 1} of ${pages.length}`;
  });
  return pages.length;
}

/* ------------------------------------------------------------------ */

function newPage(host, doc, index) {
  const inner = el('div', { class: 'page-inner' });
  const foot = el('div', { class: 'page-foot' },
    el('span', { class: 'foot-l' }, doc.company.gstin ? `GSTIN: ${doc.company.gstin}` : ''),
    el('span', { class: 'pg' }, ''),
    el('span', { class: 'foot-r' }, doc.company.footer || ''));
  const page = el('div', { class: 'page' }, inner, foot);
  host.append(page);
  return { page, inner, foot };
}

function headerBlock(doc) {
  const c = doc.company;
  return el('div', { class: 'q-head' },
    el('div', { class: 'q-head-top' },
      el('div', { class: 'q-co' },
        el('div', { class: 'q-co-name' }, c.name || ''),
        el('div', { class: 'q-co-addr' }, c.address || ''),
        c.phone ? el('div', {}, `Contact No. : ${c.phone}`) : null,
        c.email ? el('div', {}, `Email : ${c.email}`) : null,
        c.gstin ? el('div', {}, `GSTIN : ${c.gstin}`) : null),
      el('div', { class: 'q-title' }, 'QUOTATION'),
      el('div', { class: 'q-logo' }, c.logo ? el('img', { src: c.logo, alt: '' }) : null)),
    el('table', { class: 'q-meta' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Quote No.'), el('th', {}, 'Date.'), el('th', {}, 'Sales Person'))),
      el('tbody', {}, el('tr', {},
        el('td', {}, doc.quoteNo || ''), el('td', {}, U.fmtDate(doc.date)), el('td', {}, doc.salesPerson || '')))),
    el('table', { class: 'q-to' },
      el('thead', {}, el('tr', {}, el('th', {}, 'To'))),
      el('tbody', {}, el('tr', {}, el('td', {},
        el('strong', {}, doc.customer.name || ''),
        doc.customer.address ? el('div', { class: 'pre' }, doc.customer.address) : null,
        doc.customer.site ? el('div', {}, `Site : ${doc.customer.site}`) : null,
        doc.customer.phone ? el('div', {}, `Contact : ${doc.customer.phone}`) : null,
        doc.customer.email ? el('div', {}, doc.customer.email) : null)))));
}

function quoteTable() {
  return el('table', { class: 'q-table' },
    el('thead', {}, el('tr', {},
      el('th', { class: 'c-sl' }, 'Sales Line'),
      el('th', { class: 'c-det' }, 'Details'),
      el('th', { class: 'c-qty' }, 'Qty'),
      el('th', { class: 'c-up' }, 'Unit Price'),
      el('th', { class: 'c-tp' }, 'Total Price'))),
    el('tbody', {}));
}

function lineRow(line, i, doc, lib) {
  const { item, price } = line;
  const series = price.series;
  const colour = price.colour;
  const sol = price.sol;

  const svg = drawSVG(item, series, { colour: colour?.swatch, showPlan: true });

  const slCell = el('td', { class: 'c-sl' },
    el('div', { class: 'sl-no' }, `${i + 1} - ${item.label}`),
    el('div', { class: 'sl-size' }, `Size(MM) W = ${U.num(item.width).toFixed(2)}; H = ${U.num(item.height).toFixed(2)}`),
    el('div', { class: 'sl-type' }, describe(item)),
    el('div', { class: 'sl-draw', html: svg }),
    el('div', { class: 'sl-view' }, doc.viewLabel || 'View From Inside'),
    el('div', { class: 'sl-area' }, `${U.round(price.sqft, 2).toFixed(2)} Sqft.`));

  const rows = specRows(item, sol, lib, series, colour);
  const detCell = el('td', { class: 'c-det' },
    el('table', { class: 'spec' }, el('tbody', {},
      ...rows.map(([k, v]) => el('tr', {},
        el('td', { class: 'spec-k' }, k),
        el('td', { class: 'spec-v' + (k === 'Notes' ? ' strong' : '') }, v))))),
    doc.showBreakup ? breakup(price) : null);

  return el('tr', { class: 'q-row' }, slCell, detCell,
    el('td', { class: 'c-qty' }, String(price.qty)),
    el('td', { class: 'c-up' }, U.inr(price.unit)),
    el('td', { class: 'c-tp' }, U.inr(price.total)));
}

function specRows(item, sol, lib, series, colour) {
  const rows = [];
  rows.push(['Series', series?.name || '—']);

  const gz = glazingGroups(sol, item, lib);
  if (gz.length) {
    rows.push(['Glazing', gz.map((g) => `(${g.nos.join(',')}) ${g.glass.name}`).join('\n')]);
  }
  rows.push([`Profile Colour(${colour?.brand || 'Powder coat'} )`, colour?.name || '—']);

  const mg = meshGroups(sol, item, lib);
  rows.push(['Bug Mesh', mg.length ? mg.map((m) => `(${m.nos.join(',')}) ${m.mesh.name}`).join('\n') : 'No']);
  if (mg.length) rows.push(['Mesh Handle', 'Touch lock']);

  const hasLeaf = sol.panes.some((p) => ALL_FN[p.fn]?.sash && p.fn !== 'louver' && p.fn !== 'fan');
  if (hasLeaf) {
    rows.push(['Locking', item.locking || '—']);
    rows.push(['Handle Colour', item.handleColour || '—']);
  }
  rows.push(['Location', item.location || '']);
  rows.push(['Floor Number', item.floor || '']);
  rows.push(['Notes', item.notes || '']);
  return rows;
}

function breakup(price) {
  const b = price.breakdown;
  const rows = [
    ['Aluminium + fabrication', b.profile], ['Finish', b.finish], ['Glass', b.glass],
    ['Mesh', b.mesh], ['Hardware', b.hardware], ['Add-on', b.addons], ['Discount', -b.discount],
  ].filter(([, v]) => Math.abs(v) > 0.005);
  if (!rows.length) return null;
  return el('table', { class: 'spec breakup' }, el('tbody', {},
    el('tr', {}, el('td', { class: 'spec-k', colspan: 2 }, 'Cost break-up')),
    ...rows.map(([k, v]) => el('tr', {},
      el('td', { class: 'spec-k' }, k), el('td', { class: 'spec-v r' }, U.inr(v))))));
}

function totalsRow(q, doc) {
  const c = doc.charges || {};
  const rows = [
    ['Total Area', `${U.round(q.totalSqft, 3)} Sq.Ft.`],
    ['Total Windows', `${q.totalQty} Nos`],
    ['Avg. price per Sqft', `INR ${U.inr(q.avgPerSqft)}`],
    ['Basic Value', `INR ${U.inr(q.basic)}`],
  ];
  if (q.discount) rows.push([`Discount (${U.num(q.discountPct)}%)`, `- INR ${U.inr(q.discount)}`]);
  if (q.labour) {
    rows.push([`${c.labourLabel || 'Labour charges'} @ INR ${U.inr(q.labourRate)} / Sq.Ft.`,
      `INR ${U.inr(q.labour)}`]);
  }
  if (q.installation) rows.push(['Installation', `INR ${U.inr(q.installation)}`]);
  if (q.transport) rows.push(['Transportation Cost', `INR ${U.inr(q.transport)}`]);
  if (q.loading) rows.push(['Loading And Unloading', `INR ${U.inr(q.loading)}`]);
  if (q.other) rows.push([c.otherLabel || 'Other charges', `INR ${U.inr(q.other)}`]);
  if (q.gst) rows.push([`${c.gstLabel || 'GST'} @ ${U.num(q.gstPct)}%`, `INR ${U.inr(q.gst)}`]);
  if (Math.abs(q.roundOff) > 0.004) rows.push(['Round off', `INR ${U.inr(q.roundOff)}`]);

  return el('tr', { class: 'q-totals' },
    el('td', { colspan: 5 },
      el('table', { class: 'tot' }, el('tbody', {},
        ...rows.map(([k, v]) => el('tr', {}, el('td', {}, k + ' :'), el('td', { class: 'r' }, v))),
        el('tr', { class: 'grand' },
          el('td', {}, 'Total Project Cost :'),
          el('td', { class: 'r' }, `INR ${U.inr(q.grand)}`))))));
}

const bankFilled = (c) => !!(c.bankName || c.bankAccount || c.bankIfsc);

function bankBlock(c) {
  return el('div', { class: 'bank' },
    el('div', { class: 'bank-head' }, 'Bank Details'),
    el('table', {}, el('tbody', {},
      ...[['Account Name', c.bankAccountName || c.name], ['Bank Name', c.bankName],
        ['Account No.', c.bankAccount], ['IFSC Code', c.bankIfsc], ['Branch', c.bankBranch]]
        .filter(([, v]) => v)
        .map(([k, v]) => el('tr', {}, el('td', {}, k + ' :'), el('td', {}, v))))));
}

const signBlock = () => el('div', { class: 'sign' },
  el('p', { class: 'sign-note' },
    'I hereby accept the estimate as per the above mentioned price and specifications. I have read and understood the terms & conditions and agree to them.'),
  el('div', { class: 'sign-row' },
    el('div', {}, 'Authorized Signatory'),
    el('div', { class: 'r' }, 'Signature of Customer')));
