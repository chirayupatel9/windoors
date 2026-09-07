/* Small shared helpers. No framework, no build step. */

export const SQFT_PER_MM2 = 1 / 92903.04;          // 1 sq.ft = 92903.04 mm^2
export const MM_PER_FT = 304.8;

export const uid = (p = 'id') =>
  p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

export const round = (v, dp = 2) => {
  const f = Math.pow(10, dp);
  return Math.round((v + Number.EPSILON) * f) / f;
};

/** mm^2 -> sq.ft */
export const mm2ToSqft = (mm2) => mm2 * SQFT_PER_MM2;
/** width x height in mm -> sq.ft */
export const areaSqft = (wMm, hMm) => mm2ToSqft(num(wMm) * num(hMm));

/** Indian digit grouping: 1234567.5 -> "12,34,567.50" */
export function inr(v, dp = 2) {
  const n = num(v);
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(dp);
  let [int, dec] = fixed.split('.');
  if (int.length > 3) {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3);
    int = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return (neg ? '-' : '') + int + (dec ? '.' + dec : '');
}

export const money = (v, dp = 2) => inr(v, dp);

/** Formats a mm value the way a shop drawing does: no decimals unless needed. */
export const mm = (v) => {
  const n = num(v);
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
};

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

export const todayISO = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ---------- DOM ---------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Deep clone that is safe for our plain-data state. */
export const clone = (o) =>
  typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o));

export function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Distributes `total` across `n` parts, keeping integers and exact sum. */
export function splitEven(total, n) {
  const base = Math.floor(total / n);
  const out = new Array(n).fill(base);
  let rem = total - base * n;
  for (let i = 0; rem > 0; i = (i + 1) % n, rem--) out[i] += 1;
  return out;
}

/** Scales a list of parts so that it sums exactly to `total` (keeps proportions). */
export function normaliseParts(parts, total) {
  const list = parts.map((p) => Math.max(1, num(p)));
  const sum = list.reduce((a, b) => a + b, 0);
  if (sum <= 0) return splitEven(total, list.length);
  const scaled = list.map((p) => (p / sum) * total);
  const ints = scaled.map((v) => Math.round(v));
  let diff = total - ints.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < ints.length * 4; i++) {
    const k = i % ints.length;
    const step = diff > 0 ? 1 : -1;
    if (ints[k] + step >= 1) { ints[k] += step; diff -= step; }
  }
  return ints;
}
