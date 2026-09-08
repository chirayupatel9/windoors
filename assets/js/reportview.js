/* The Reports tab: pick a report, read it on an A4 sheet, print it, or take
 * it into Excel. The sheet and the worksheet are built from the same report
 * data, so what is printed and what is exported cannot drift apart. */

import * as U from './util.js';
import * as UI from './ui.js';
import * as S from './store.js';
import * as R from './reports.js';
import { workbook, STYLE } from './xlsx.js';
import { download } from './exporters.js';

const { el } = U;

export function renderReportsTab(root) {
  const st = S.state;
  const id = R.REPORTS.some((r) => r.id === st.ui.report) ? st.ui.report : 'estimate';
  st.ui.report = id;

  const sheet = el('div', { class: 'sheet' });
  const wrap = el('div', { class: 'quote-wrap' }, sheet);
  const paint = () => {
    buildReportPages(sheet, R.build(id, st.doc, st.lib), st.doc, st.lib);
    fitSheet(wrap, sheet);
  };

  root.replaceChildren(el('div', { class: 'quote-view' },
    el('div', { class: 'chargesbar reportbar' },
      el('div', { class: 'reportpick' },
        ...R.REPORTS.map((r) => el('button', {
          type: 'button', class: 'segbtn' + (r.id === id ? ' on' : ''),
          onclick: () => S.update((s) => { s.ui.report = r.id; }),
        }, r.name))),
      el('div', { class: 'reportbar-side' },
        el('span', { class: 'note' }, R.REPORTS.find((r) => r.id === id)?.note || ''),
        UI.button('Excel', () => exportOne(id), { class: 'btn sm' }),
        UI.button('All reports as one workbook', () => exportAll(), { class: 'btn sm' }))),
    wrap));

  requestAnimationFrame(paint);
  const onResize = U.debounce(() => fitSheet(wrap, sheet), 120);
  window.addEventListener('resize', onResize);
  new MutationObserver((_, mo) => {
    if (!document.contains(wrap)) { window.removeEventListener('resize', onResize); mo.disconnect(); }
  }).observe(root, { childList: true });
}

const A4_PX = 794;
function fitSheet(wrap, sheet) {
  const cs = getComputedStyle(wrap);
  const room = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  sheet.style.zoom = room >= A4_PX ? '' : String(U.clamp(room / A4_PX, 0.25, 1));
}

/* ---- the printed sheet ---- */

function buildReportPages(host, rep, doc, lib) {
  host.replaceChildren();
  const pages = [];

  const newPage = () => {
    const inner = el('div', { class: 'page-inner' });
    const foot = el('div', { class: 'page-foot' },
      el('span', { class: 'foot-l' }, doc.company.gstin ? `GSTIN: ${doc.company.gstin}` : ''),
      el('span', { class: 'pg' }, ''),
      el('span', { class: 'foot-r' }, doc.company.footer || ''));
    const page = el('div', { class: 'page report' }, inner, foot);
    host.append(page);
    const p = { page, inner, foot };
    pages.push(p);
    return p;
  };

  let page = newPage();
  page.inner.append(reportHead(rep, doc));

  const table = reportTable(rep);
  page.inner.append(table);
  let tbody = table.tBodies[0];
  const over = () => page.inner.scrollHeight > page.inner.clientHeight + 1;

  const flow = (node) => {
    const first = !tbody.children.length;
    tbody.append(node);
    if (!over()) return;
    if (first) { page.page.classList.add('tall'); return; }
    node.remove();
    page = newPage();
    const t = reportTable(rep);      // the column heads repeat on every page
    page.inner.append(t);
    tbody = t.tBodies[0];
    tbody.append(node);
    if (over()) page.page.classList.add('tall');
  };

  rep.rows.forEach((row, i) => flow(dataRow(rep, row, i)));

  if (rep.totals?.length) {
    const box = el('div', { class: 'rep-totals' },
      el('table', {}, el('tbody', {},
        ...rep.totals.map(([k, v], i) => el('tr', { class: i === rep.totals.length - 1 ? 'grand' : '' },
          el('td', {}, k), el('td', { class: 'r' }, typeof v === 'number' ? U.inr(v) : String(v)))))));
    page.inner.append(box);
    if (over()) {
      box.remove();
      page = newPage();
      page.inner.append(box);
    }
  }

  pages.forEach((p, i) => { p.foot.querySelector('.pg').textContent = `${i + 1} of ${pages.length}`; });
}

function reportHead(rep, doc) {
  const c = doc.company;
  const cust = S.customerOf(doc);
  return el('div', { class: 'rep-head' },
    el('div', { class: 'rep-head-top' },
      el('div', { class: 'q-co' },
        el('div', { class: 'q-co-name' }, c.name || ''),
        el('div', { class: 'q-co-addr' }, c.address || ''),
        c.phone ? el('div', {}, `Contact No. : ${c.phone}`) : null),
      el('div', { class: 'rep-title' },
        el('div', { class: 'rep-title-main' }, rep.title),
        rep.subtitle ? el('div', { class: 'rep-sub' }, rep.subtitle) : null),
      el('div', { class: 'q-logo' }, c.logo ? el('img', { src: c.logo, alt: '' }) : null)),
    el('table', { class: 'q-meta' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Quote No.'), el('th', {}, 'Date.'), el('th', {}, 'Customer'), el('th', {}, 'Site'))),
      el('tbody', {}, el('tr', {},
        el('td', {}, doc.quoteNo || ''),
        el('td', {}, U.fmtDate(doc.date)),
        el('td', {}, cust?.name || ''),
        el('td', {}, cust?.site || '')))));
}

const alignOf = (rep, i) => (rep.align?.[i] === 'r' ? 'r' : '');

function reportTable(rep) {
  return el('table', { class: 'rep-table' },
    el('thead', {}, el('tr', {},
      ...rep.columns.map((c, i) => el('th', { class: alignOf(rep, i) }, c)))),
    el('tbody', {}));
}

function dataRow(rep, row, i) {
  return el('tr', { class: i % 2 ? 'alt' : '' },
    ...row.map((v, ci) => el('td', { class: alignOf(rep, ci) },
      typeof v === 'number'
        ? (rep.money?.includes(ci) ? U.inr(v) : U.mm(v))
        : String(v ?? ''))));
}

/* ---- Excel ---- */

function toSheet(rep) {
  const head = rep.columns.map((c) => ({ v: c, s: STYLE.header }));
  const body = rep.rows.map((row) => row.map((v, i) =>
    (typeof v === 'number'
      ? { v, s: rep.money?.includes(i) ? STYLE.money : STYLE.plain }
      : v)));
  const totals = (rep.totals || []).map(([k, v]) => {
    const line = new Array(rep.columns.length).fill('');
    line[0] = { v: k, s: STYLE.bold };
    line[1] = typeof v === 'number' ? { v, s: STYLE.boldMoney } : { v: String(v), s: STYLE.bold };
    return line;
  });
  const width = (i) => Math.min(38, Math.max(
    9, rep.columns[i].length + 2,
    ...rep.rows.slice(0, 120).map((r) => String(r[i] ?? '').length + 2)));
  return {
    name: rep.title,
    cols: rep.columns.map((_, i) => width(i)),
    rows: [head, ...body, [], ...totals],
  };
}

const fileName = (suffix) => {
  const doc = S.state.doc;
  const cust = S.customerOf(doc)?.name?.trim();
  const base = cust ? `${doc.quoteNo}_${cust}` : doc.quoteNo;
  return String(`${base}_${suffix}`).replace(/[^\w.-]+/g, '_').slice(0, 80) + '.xlsx';
};

async function exportOne(id) {
  const rep = R.build(id, S.state.doc, S.state.lib);
  const ok = await download(fileName(rep.title), workbook([toSheet(rep)]));
  if (ok) UI.toast(`${rep.title} exported`);
}

async function exportAll() {
  const sheets = R.buildAll(S.state.doc, S.state.lib).map(toSheet);
  const ok = await download(fileName('reports'), workbook(sheets));
  if (ok) UI.toast('All reports exported');
}

export { exportAll as exportAllReports };
