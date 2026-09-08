/*
 * Production paperwork.
 *
 * Each report is built once as plain data — columns, rows and totals — and
 * then rendered either as an A4 sheet to print or as a worksheet to export,
 * so the two can never disagree about what the job needs.
 *
 * Everything here comes from the same solve as the drawing, so the cut lengths
 * on the shop floor are the lengths that were drawn and priced.
 */

import * as U from './util.js';
import * as S from './store.js';
import { priceQuote, priceItem } from './pricing.js';
import { solve, seriesFor, cutList, metalSummary, describe } from './geometry.js';
import { isGlazed, ALL_FN, PROFILE_ROLES } from './catalog.js';

const N = U.num;

export const REPORTS = [
  { id: 'estimate', name: 'Estimate', note: 'Priced lines for the customer.' },
  { id: 'po', name: 'Aluminium purchase order', note: 'What to buy, by section and by bar.' },
  { id: 'glass', name: 'Glass cutting list', note: 'Every pane, at cut size.' },
  { id: 'profile', name: 'Aluminium cutting list', note: 'Every cut length, by profile.' },
  { id: 'hardware', name: 'Hardware list', note: 'Every fitting the job needs.' },
];

/** Walks the job once; every report is derived from this. */
function scan(doc, lib) {
  const rows = [];
  for (const item of doc.items) {
    const series = seriesFor(item, lib);
    const sol = solve(item, series);
    const qty = Math.max(1, Math.round(N(item.qty, 1)));
    rows.push({ item, series, sol, qty, price: priceItem(item, lib) });
  }
  return rows;
}

/* ------------------------------------------------------------------ */

export function estimate(doc, lib) {
  const q = priceQuote(doc, lib);
  const rows = q.lines.map((l, i) => {
    const colour = l.price.colour?.name || '';
    const glass = lib.glass.find((g) => g.id === l.item.glassId)?.name || '';
    return [i + 1, l.item.label, describe(l.item),
      N(l.item.width), N(l.item.height), U.round(l.price.sqft, 2),
      l.price.series?.name || '', glass, colour,
      l.item.location || '', l.item.floor || '',
      l.price.qty, U.round(l.price.unit, 2), U.round(l.price.total, 2)];
  });

  const totals = [];
  const add = (label, value) => totals.push([label, value]);
  add('Total area', `${U.round(q.totalSqft, 3)} Sq.Ft.`);
  add('Total windows', `${q.totalQty} Nos`);
  add('Avg. price per Sq.Ft', U.round(q.avgPerSqft, 2));
  add('Basic value', U.round(q.basic, 2));
  if (q.discount) add(`Discount (${N(q.discountPct)}%)`, -U.round(q.discount, 2));
  if (q.labour) add(`${doc.charges.labourLabel || 'Labour'} @ ${U.inr(q.labourRate)}/Sq.Ft`, U.round(q.labour, 2));
  if (q.installation) add('Installation', U.round(q.installation, 2));
  if (q.transport) add('Transportation', U.round(q.transport, 2));
  if (q.loading) add('Loading and unloading', U.round(q.loading, 2));
  if (q.other) add(doc.charges.otherLabel || 'Other charges', U.round(q.other, 2));
  if (q.gst) add(`${doc.charges.gstLabel || 'GST'} @ ${N(q.gstPct)}%`, U.round(q.gst, 2));
  if (Math.abs(q.roundOff) > 0.004) add('Round off', U.round(q.roundOff, 2));
  add('Total project cost', U.round(q.grand, 2));

  return {
    id: 'estimate',
    title: 'Estimate',
    columns: ['#', 'Mark', 'Type', 'Width mm', 'Height mm', 'Sq.ft', 'Series', 'Glazing',
      'Colour', 'Location', 'Floor', 'Qty', 'Unit price', 'Total price'],
    align: 'lllrrrlllllrrr',
    money: [12, 13],
    rows,
    totals,
  };
}

/* ---- what to buy ---- */

export function purchaseOrder(doc, lib) {
  const byProfile = new Map();
  for (const { item, series, sol, qty } of scan(doc, lib)) {
    for (const line of metalSummary(sol, item, series, lib).lines) {
      if (!line.profile) continue;
      const acc = byProfile.get(line.profile.id)
        || { p: line.profile, metres: 0, kg: 0, cost: 0, roles: new Set() };
      acc.metres += line.metres * qty;
      acc.kg += line.kg * qty;
      acc.cost += line.cost * qty;
      acc.roles.add(line.role);
      byProfile.set(line.profile.id, acc);
    }
  }

  const rows = [];
  let totalKg = 0, totalCost = 0, totalBars = 0;
  [...byProfile.values()]
    .sort((a, b) => (a.p.code || '').localeCompare(b.p.code || ''))
    .forEach((a, i) => {
      const barLen = N(a.p.barLength);
      const bars = barLen > 0 ? Math.ceil((a.metres * 1000) / barLen) : 0;
      const orderKg = barLen > 0 ? (bars * barLen / 1000) * N(a.p.kgPerM) : a.kg;
      totalKg += orderKg;
      totalCost += orderKg * N(a.p.ratePerKg);
      totalBars += bars;
      rows.push([i + 1, a.p.code || '', a.p.name || '',
        [...a.roles].map((r) => PROFILE_ROLES[r] || r).join(', '),
        U.round(a.metres, 2), barLen, bars,
        U.round(N(a.p.kgPerM), 3), U.round(orderKg, 2),
        U.round(N(a.p.ratePerKg), 2), U.round(orderKg * N(a.p.ratePerKg), 2)]);
    });

  return {
    id: 'po',
    title: 'Aluminium purchase order',
    subtitle: 'Ordered in whole bars — the metres column is what the job consumes.',
    columns: ['#', 'Code', 'Section', 'Used as', 'Metres needed', 'Bar mm', 'Bars to order',
      'kg / m', 'Order kg', '₹ / kg', 'Amount'],
    align: 'llllrrrrrrr',
    money: [10],
    rows,
    totals: [
      ['Bars to order', totalBars],
      ['Total weight', `${U.round(totalKg, 2)} kg`],
      ['Order value', U.round(totalCost, 2)],
    ],
  };
}

/* ---- glass, at cut size ---- */

export function glassList(doc, lib) {
  const rows = [];
  let totalPanes = 0, totalSqft = 0;
  const byType = new Map();

  for (const { item, sol, qty } of scan(doc, lib)) {
    const fallback = item.glassId || lib.glass[0]?.id;
    for (const p of sol.panes) {
      if (!isGlazed(p.fn)) continue;
      const g = lib.glass.find((x) => x.id === (p.glassId || fallback));
      const w = Math.round(p.glass.w);
      const h = Math.round(p.glass.h);
      const sqft = U.areaSqft(w, h) * qty;
      rows.push([item.label, p.no, p.tag || '', g?.name || '—', w, h, qty,
        U.round(U.areaSqft(w, h), 2), U.round(sqft, 2), item.location || '']);
      totalPanes += qty;
      totalSqft += sqft;
      const acc = byType.get(g?.id || '?') || { name: g?.name || '—', panes: 0, sqft: 0 };
      acc.panes += qty; acc.sqft += sqft;
      byType.set(g?.id || '?', acc);
    }
  }

  return {
    id: 'glass',
    title: 'Glass cutting list',
    subtitle: 'Cut sizes, inside the bead — not the opening size.',
    columns: ['Mark', 'Pane', 'Position', 'Glass', 'Cut width mm', 'Cut height mm',
      'Qty', 'Sq.ft each', 'Sq.ft total', 'Location'],
    align: 'llllrrrrrl',
    rows,
    totals: [
      ...[...byType.values()].map((t) => [t.name, `${t.panes} panes · ${U.round(t.sqft, 2)} sq.ft`]),
      ['Total panes', totalPanes],
      ['Total area', `${U.round(totalSqft, 2)} sq.ft`],
    ],
  };
}

/* ---- aluminium, cut length by cut length ---- */

export function profileList(doc, lib) {
  const rows = [];
  let totalPieces = 0, totalMm = 0;

  for (const { item, series, sol, qty } of scan(doc, lib)) {
    const assigned = series.sections || {};
    for (const c of cutList(sol, item)) {
      const prof = lib.profiles?.find((p) => p.id === assigned[c.role]);
      const pieces = c.count * qty;
      rows.push([item.label, prof?.code || '—', prof?.name || PROFILE_ROLES[c.role] || c.role,
        c.label, c.each, c.count, qty, pieces, c.total * qty]);
      totalPieces += pieces;
      totalMm += c.total * qty;
    }
  }

  // a saw list is easier to work from longest first, within each profile
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])) || b[4] - a[4]);

  return {
    id: 'profile',
    title: 'Aluminium cutting list',
    subtitle: 'Every piece to cut, by section. Lengths are finished sizes.',
    columns: ['Mark', 'Code', 'Section', 'Piece', 'Length mm', 'Per unit', 'Units', 'Pieces', 'Total mm'],
    align: 'llllrrrrr',
    rows,
    totals: [
      ['Total pieces', totalPieces],
      ['Total length', `${U.round(totalMm / 1000, 2)} m`],
    ],
  };
}

/* ---- fittings ---- */

export function hardwareList(doc, lib) {
  const byName = new Map();
  for (const { item, price, qty } of scan(doc, lib)) {
    for (const h of price.breakdown.hwLines) {
      const acc = byName.get(h.name) || { name: h.name, per: h.per, rate: h.rate, qty: 0, amount: 0, marks: new Set() };
      acc.qty += (h.per === 'sqft' ? h.qty : h.qty) * qty;
      acc.amount += h.amount * qty;
      acc.marks.add(item.label);
      byName.set(h.name, acc);
    }
  }

  const unit = { sash: 'per leaf', item: 'per window', sqft: 'per sq.ft' };
  const rows = [...byName.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((h, i) => [i + 1, h.name, unit[h.per] || h.per,
      U.round(h.qty, 2), U.round(h.rate, 2), U.round(h.amount, 2),
      [...h.marks].join(', ')]);

  const total = [...byName.values()].reduce((a, h) => a + h.amount, 0);
  return {
    id: 'hardware',
    title: 'Hardware list',
    subtitle: 'Counted from the opening type of every leaf in the job.',
    columns: ['#', 'Item', 'Charged', 'Qty', 'Rate ₹', 'Amount ₹', 'Used on'],
    align: 'lllrrrl',
    money: [4, 5],
    rows,
    totals: [['Hardware total', U.round(total, 2)]],
  };
}

/* ------------------------------------------------------------------ */

export function build(id, doc, lib) {
  switch (id) {
    case 'po': return purchaseOrder(doc, lib);
    case 'glass': return glassList(doc, lib);
    case 'profile': return profileList(doc, lib);
    case 'hardware': return hardwareList(doc, lib);
    default: return estimate(doc, lib);
  }
}

export const buildAll = (doc, lib) => REPORTS.map((r) => build(r.id, doc, lib));
