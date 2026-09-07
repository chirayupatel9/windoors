/*
 * Cost build-up for one line and for the whole quotation.
 *
 * Per item (per piece, before qty):
 *   profile   = series rate  x  billable sq.ft            (aluminium + fabrication)
 *   finish    = colour extra x  billable sq.ft            (powder coat / anodise)
 *   glass     = sum over glazed panes of glass rate x pane sq.ft
 *   mesh      = sum over mesh panes of mesh rate x pane sq.ft
 *   hardware  = per-leaf sets + per-item extras + per-sq.ft items
 *   + wastage %, - line discount %
 * A manual unit-rate override replaces the whole build-up when set.
 */

import * as U from './util.js';
import { solve, paneAreas, seriesFor, metalSummary } from './geometry.js';
import { ALL_FN, isGlazed } from './catalog.js';

const N = U.num;

/** Hardware auto-selected for a leaf when the user has not pinned a set. */
function autoHardware(fn) {
  if (fn === 'slide-mesh' || fn === 'mesh') return ['hw_mesh_handle'];
  if (fn?.startsWith('slide')) return ['hw_sld_touch'];
  if (fn?.startsWith('door')) return ['hw_door_lock'];
  if (fn === 'fan') return ['hw_fan_ring'];
  if (fn === 'louver') return [];
  if (fn?.startsWith('casement') || fn?.startsWith('tilt') || fn === 'top-hung' || fn === 'bottom-hung')
    return ['hw_cas_std'];
  return [];
}

export function priceItem(item, lib) {
  const series = seriesFor(item, lib);
  const colour = lib.colours.find((c) => c.id === item.colourId) || lib.colours[0];
  const sol = solve(item, series);
  const panes = paneAreas(sol);

  const sqft = U.areaSqft(sol.width, sol.height);
  const minSqft = N(series.minSqft, 0);
  const billSqft = Math.max(sqft, minSqft);

  /*
   * Two ways to cost the aluminium, chosen per series:
   *   sqft   - a flat rate per square foot, for a series you quote every day
   *   weight - the cut lengths from the drawing x kg/m x rate/kg, plus
   *            fabrication labour, for costing a section precisely
   */
  const byWeight = series.costing === 'weight';
  const metal = byWeight ? metalSummary(sol, item, series, lib) : null;
  const profile = byWeight
    ? metal.cost + N(series.labourPerSqft) * billSqft
    : N(series.rate) * billSqft;
  const finish = N(colour?.extra) * billSqft;

  const glassFallback = item.glassId || lib.glass[0]?.id;
  const meshFallback = item.meshId || lib.mesh[0]?.id;

  let glass = 0, mesh = 0, louverSqft = 0;
  const glassLines = [];
  for (const p of panes) {
    if (isGlazed(p.fn)) {
      const g = lib.glass.find((x) => x.id === (p.glassId || glassFallback));
      const cost = N(g?.rate) * p.sqft;
      glass += cost;
      glassLines.push({ no: p.no, name: g?.name || '—', sqft: p.sqft, rate: N(g?.rate), cost });
    } else if (p.fn === 'mesh' || p.fn === 'slide-mesh') {
      const m = lib.mesh.find((x) => x.id === (p.meshId || meshFallback));
      mesh += N(m?.rate) * p.sqft;
    } else if (p.fn === 'louver') {
      louverSqft += p.sqft;
    }
  }

  // hardware
  let hardware = 0;
  const hwLines = [];
  const addHw = (id, qty, sqftFor = 0) => {
    const h = lib.hardware.find((x) => x.id === id);
    if (!h) return;
    const amount = h.per === 'sqft' ? N(h.rate) * sqftFor : N(h.rate) * qty;
    if (!amount) return;
    hardware += amount;
    hwLines.push({ name: h.name, qty: h.per === 'sqft' ? U.round(sqftFor, 2) : qty, rate: N(h.rate), amount, per: h.per });
  };

  const pinned = item.hardwareIds;
  for (const p of panes) {
    if (!ALL_FN[p.fn]?.sash) continue;
    const ids = pinned?.length ? pinned : autoHardware(p.fn);
    for (const id of ids) {
      const h = lib.hardware.find((x) => x.id === id);
      if (h?.per === 'item') continue;
      addHw(id, 1, p.sqft);
    }
  }
  if (louverSqft > 0) addHw('hw_louver', 1, louverSqft);
  for (const id of item.extraHardwareIds || []) addHw(id, 1, billSqft);

  const subtotal = profile + finish + glass + mesh + hardware;
  const wastage = subtotal * (N(series.wastagePct) / 100);
  const addons = N(item.addonAmount);
  let unit = subtotal + wastage + addons;

  const discPct = N(item.discountPct);
  const discount = unit * (discPct / 100);
  unit -= discount;

  const overridden = item.unitPriceOverride !== null && item.unitPriceOverride !== undefined && item.unitPriceOverride !== '';
  if (overridden) unit = N(item.unitPriceOverride);

  const qty = Math.max(1, Math.round(N(item.qty, 1)));
  const total = unit * qty;

  return {
    series, colour, sol, panes, metal, byWeight,
    sqft, billSqft, minApplied: billSqft > sqft + 1e-9,
    breakdown: {
      profile, finish, glass, mesh, hardware, wastage, addons, discount,
      glassLines, hwLines,
      metalCost: metal ? metal.cost : 0,
      labour: byWeight ? N(series.labourPerSqft) * billSqft : 0,
    },
    unit, total, qty, overridden,
    ratePerSqft: sqft > 0 ? unit / sqft : 0,
    totalSqft: sqft * qty,
  };
}

export function priceQuote(doc, lib) {
  const lines = doc.items.map((it) => ({ item: it, price: priceItem(it, lib) }));
  const basic = lines.reduce((a, l) => a + l.price.total, 0);
  const totalSqft = lines.reduce((a, l) => a + l.price.totalSqft, 0);
  const totalQty = lines.reduce((a, l) => a + l.price.qty, 0);

  const c = doc.charges || {};
  const discountPct = N(c.discountPct);
  const discount = basic * (discountPct / 100);
  const afterDiscount = basic - discount;

  const installation = N(c.installation);
  const transport = N(c.transport);
  const loading = N(c.loading);
  const other = N(c.other);
  const subTotal = afterDiscount + installation + transport + loading + other;

  const gstPct = N(c.gstPct);
  const gst = subTotal * (gstPct / 100);
  const beforeRound = subTotal + gst;
  const grand = c.roundOff === false ? beforeRound : Math.round(beforeRound);
  const roundOff = grand - beforeRound;

  return {
    lines, basic, totalSqft, totalQty,
    discountPct, discount, afterDiscount,
    installation, transport, loading, other,
    subTotal, gstPct, gst, roundOff, grand,
    avgPerSqft: totalSqft > 0 ? afterDiscount / totalSqft : 0,
  };
}
