/*
 * Technical elevation renderer (SVG).
 *
 * Geometry arrives in millimetres; everything drawn here is converted to a
 * pixel canvas so line weights and text stay legible whatever the window size
 * — the same reason CAD sheets keep text height constant across scales.
 */

import * as U from './util.js';
import { solve } from './geometry.js';

const PX = {
  fit: [640, 520],   // target content box
  pad: 14,
  chainGap: 25,
  chainFirst: 16,
  font: 11,
  fontSm: 8.5,
  tag: 7.5,
  plan: 34,
  planGap: 16,
};

const C = {
  line: '#2a2f38',
  frameStroke: '#4a5058',
  glass: '#bfe3f2',
  glassEdge: '#7fa8bd',
  sheen: '#ffffff',
  dim: '#333a44',
  dash: '#666e7a',
  mesh: '#4c5a63',
  panel: '#d8d3c6',
  tagBg: '#ffffff',
};

let uidc = 0;

/**
 * @param {object} item      item definition
 * @param {object} series    profile series
 * @param {object} opts      { colour, caption, sqftCaption, showPlan, showNumbers }
 * @returns {string} SVG markup
 */
export function drawSVG(item, series, opts = {}) {
  const sol = solve(item, series);
  return render(sol, opts);
}

export function render(sol, opts = {}) {
  const o = {
    colour: '#8d9199',
    showPlan: true,
    showNumbers: true,
    showTags: true,
    caption: '',
    sqft: null,
    ...opts,
  };
  const uid = 'd' + (++uidc);
  const { width: W, height: H } = sol;

  const nX = sol.chainsX.length;
  const nY = sol.chainsY.length;
  const gutterL = PX.chainFirst + nY * PX.chainGap;
  const gutterB = PX.chainFirst + nX * PX.chainGap;
  // + room for the strip's OUT/IN labels, which sit outside the box
  const planH = o.showPlan && sol.plan ? PX.plan + PX.planGap + 14 : 0;
  const capH = o.caption || o.sqft != null ? 30 : 0;

  const s = Math.min(PX.fit[0] / W, PX.fit[1] / H);
  const cw = W * s, ch = H * s;
  let ox = gutterL + PX.pad;
  const oy = PX.pad;
  let svgW = ox + cw + PX.pad;
  const svgH = oy + ch + gutterB + planH + capH + PX.pad;

  // keep a narrow item wide enough that the caption does not overhang
  const minW = capH ? 156 : 0;
  if (svgW < minW) { ox += (minW - svgW) / 2; svgW = minW; }

  const X = (mm) => ox + mm * s;
  const Y = (mm) => oy + mm * s;
  const L = (mm) => mm * s;

  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(svgW)} ${r2(svgH)}" ` +
    `width="${r2(svgW)}" height="${r2(svgH)}" class="elev" font-family="Inter, Arial, Helvetica, sans-serif">`
  );
  out.push(defs(uid, o.colour));
  out.push(`<rect x="0" y="0" width="${r2(svgW)}" height="${r2(svgH)}" fill="#fff"/>`);

  /* ---- structure: frame + dividers ---- */
  out.push(`<g class="structure">`);
  for (const m of sol.members) {
    if (m.kind === 'frame') {
      out.push(rect(X(m.x), Y(m.y), L(m.w), L(m.h), `url(#g${uid})`, C.frameStroke, 1));
      // mitre lines
      const t = L(m.t);
      const x0 = X(0), y0 = Y(0), x1 = X(W), y1 = Y(H);
      const mit = [
        [x0, y0, x0 + t, y0 + t], [x1, y0, x1 - t, y0 + t],
        [x0, y1, x0 + t, y1 - t], [x1, y1, x1 - t, y1 - t],
      ];
      out.push(mit.map((m2) => line(...m2, C.frameStroke, 0.6)).join(''));
      out.push(rect(x0 + t, y0 + t, L(W) - 2 * t, L(H) - 2 * t, 'none', C.frameStroke, 0.8));
    } else {
      out.push(rect(X(m.x), Y(m.y), L(m.w), L(m.h), `url(#g${uid})`, C.frameStroke, 0.9));
    }
  }
  out.push(`</g>`);

  /* ---- panes ---- */
  const ordered = [...sol.panes].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const p of ordered) out.push(pane(p, { X, Y, L, uid, o, s }));

  /* ---- tags ---- */
  if (o.showTags) {
    for (const m of sol.members) {
      if (!m.label) continue;
      const cx = X(m.x + m.w / 2), cy = Y(m.y + m.h / 2);
      out.push(tagBox(cx, m.kind === 'transom' ? cy : Y(m.y) + 12, m.label));
    }
  }

  /* ---- dimension chains ---- */
  sol.chainsX.forEach((chain, i) => {
    const y = oy + ch + PX.chainFirst + i * PX.chainGap;
    out.push(chainX(chain, { X, Y, y, top: oy + ch, last: i === nX - 1 }));
  });
  sol.chainsY.forEach((chain, i) => {
    const x = ox - PX.chainFirst - i * PX.chainGap;
    out.push(chainY(chain, { X, Y, x, right: ox, last: i === nY - 1 }));
  });

  /* ---- plan section under sliding items ---- */
  if (o.showPlan && sol.plan) {
    const py = oy + ch + gutterB + PX.planGap;
    out.push(planStrip(sol.plan, { x: ox, y: py, w: cw, uid }));
  }

  /* ---- caption ---- */
  if (capH) {
    const cy = svgH - PX.pad - 16;
    const cx = ox + cw / 2;
    if (o.caption) out.push(text(cx, cy, o.caption, PX.font, C.dim, 'middle'));
    if (o.sqft != null) out.push(text(cx, cy + 13, `${U.round(o.sqft, 2).toFixed(2)} Sqft.`, PX.font, C.dim, 'middle'));
  }

  out.push('</svg>');
  return out.join('');
}

/* ------------------------------------------------------------------ */

function defs(uid, colour) {
  const dark = shade(colour, -0.24);
  const light = shade(colour, 0.3);
  return `<defs>
<linearGradient id="g${uid}" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${light}"/><stop offset="0.45" stop-color="${colour}"/><stop offset="1" stop-color="${dark}"/>
</linearGradient>
<linearGradient id="gl${uid}" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#d8f0fa"/><stop offset="0.55" stop-color="${C.glass}"/><stop offset="1" stop-color="#a9d4e8"/>
</linearGradient>
<pattern id="mesh${uid}" width="5" height="5" patternUnits="userSpaceOnUse">
  <path d="M0 0 L5 5 M5 0 L0 5" stroke="${C.mesh}" stroke-width="0.55" opacity="0.85"/>
</pattern>
<marker id="ar${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
  <path d="M0 0 L10 5 L0 10 z" fill="${C.dim}"/>
</marker>
<marker id="arS${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
  <path d="M0 1.5 L10 5 L0 8.5 z" fill="${C.line}"/>
</marker>
</defs>`;
}

function pane(p, ctx) {
  const { X, Y, L, uid, o } = ctx;
  const g = p.glass;
  const gx = X(g.x), gy = Y(g.y), gw = L(g.w), gh = L(g.h);
  const ox_ = X(p.x), oy_ = Y(p.y), ow = L(p.w), oh = L(p.h);
  const out = [];
  const leaf = p.kind === 'sash';

  // sash frame
  if (leaf && p.fn !== 'slide-mesh') {
    out.push(rect(ox_, oy_, ow, oh, `url(#g${uid})`, C.frameStroke, 0.9));
  }

  switch (p.fn) {
    case 'louver':
      out.push(rect(gx, gy, gw, gh, '#eef1f3', C.frameStroke, 0.7));
      for (let y = gy + 4; y < gy + gh - 1; y += 5.5) {
        out.push(line(gx + 1.5, y, gx + gw - 1.5, y, C.frameStroke, 0.85));
        out.push(line(gx + 1.5, y + 1.6, gx + gw - 1.5, y + 1.6, '#c7cdd3', 0.6));
      }
      break;

    case 'fan': {
      out.push(rect(gx, gy, gw, gh, '#f4f6f7', C.frameStroke, 0.7));
      const cx = gx + gw / 2, cy = gy + gh / 2;
      const r = Math.max(4, Math.min(gw, gh) / 2 - 3);
      out.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="#e3e8eb" stroke="${C.frameStroke}" stroke-width="0.9"/>`);
      for (let i = 0; i < 3; i++) {
        const a = (i * 120 * Math.PI) / 180;
        out.push(`<path d="M${r2(cx)} ${r2(cy)} A ${r2(r * 0.86)} ${r2(r * 0.86)} 0 0 1 ${r2(cx + r * 0.86 * Math.cos(a))} ${r2(cy + r * 0.86 * Math.sin(a))} Z" fill="#c9d1d6" stroke="${C.frameStroke}" stroke-width="0.5"/>`);
      }
      out.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r * 0.2)}" fill="${C.frameStroke}"/>`);
      break;
    }

    case 'mesh':
    case 'slide-mesh':
      out.push(rect(ox_, oy_, ow, oh, 'none', C.frameStroke, 1));
      out.push(rect(gx, gy, gw, gh, `url(#mesh${uid})`, C.frameStroke, 0.7));
      break;

    case 'panel':
      out.push(rect(gx, gy, gw, gh, C.panel, C.frameStroke, 0.8));
      out.push(rect(gx + 3, gy + 3, Math.max(1, gw - 6), Math.max(1, gh - 6), 'none', '#b6ae9c', 0.6));
      break;

    default: {
      // glazed
      out.push(rect(gx, gy, gw, gh, `url(#gl${uid})`, C.glassEdge, 0.8));
      if (gw > 12 && gh > 12) {
        out.push(`<path d="M${r2(gx)} ${r2(gy + gh)} L${r2(gx + gw * 0.55)} ${r2(gy)} L${r2(gx + gw * 0.82)} ${r2(gy)} L${r2(gx)} ${r2(gy + gh * 0.72)} Z" fill="${C.sheen}" opacity="0.28"/>`);
      }
      if (p.fn === 'grill') {
        for (let x = gx + 10; x < gx + gw - 4; x += 10) out.push(line(x, gy + 2, x, gy + gh - 2, '#5b6470', 0.9));
      }
      break;
    }
  }

  out.push(openingSymbol(p, { gx, gy, gw, gh, ox: ox_, oy: oy_, ow, oh, uid }));

  if (o.showNumbers && gw > 13 && gh > 13) {
    out.push(numberBadge(gx + gw / 2, gy + gh / 2, p.no));
  }
  if (o.showTags) {
    out.push(tagFor(p, { gx, gy, gw, gh, ox: ox_, oy: oy_, ow, oh }));
  }
  return out.join('');
}

/** Dashed opening symbol: the apex sits on the hinge side, as per ISO 11091. */
function openingSymbol(p, b) {
  const { gx, gy, gw, gh } = b;
  const d = (pts) => `<polyline points="${pts}" fill="none" stroke="${C.dash}" stroke-width="0.9" stroke-dasharray="4 3"/>`;
  const R = gx + gw, B = gy + gh;
  const midY = gy + gh / 2, midX = gx + gw / 2;
  const small = gw < 16 || gh < 16;
  if (small) return '';

  switch (p.fn) {
    case 'casement-l':
    case 'door-l':
      return d(`${R},${r2(gy)} ${r2(gx)},${r2(midY)} ${R},${r2(B)}`) + handle(gx + gw - 5, midY, 'v') +
        (p.fn === 'door-l' ? doorMark(gx, gy, gw, gh, 'l') : '');
    case 'casement-r':
    case 'door-r':
      return d(`${r2(gx)},${r2(gy)} ${R},${r2(midY)} ${r2(gx)},${r2(B)}`) + handle(gx + 5, midY, 'v') +
        (p.fn === 'door-r' ? doorMark(gx, gy, gw, gh, 'r') : '');
    case 'top-hung':
      return d(`${r2(gx)},${r2(B)} ${r2(midX)},${r2(gy)} ${R},${r2(B)}`) + handle(midX, B - 5, 'h');
    case 'bottom-hung':
      return d(`${r2(gx)},${r2(gy)} ${r2(midX)},${r2(B)} ${R},${r2(gy)}`) + handle(midX, gy + 5, 'h');
    case 'tilt-turn-l':
      return d(`${R},${r2(gy)} ${r2(gx)},${r2(midY)} ${R},${r2(B)}`) +
        d(`${r2(gx)},${r2(gy)} ${r2(midX)},${r2(B)} ${R},${r2(gy)}`) + handle(gx + gw - 5, midY, 'v');
    case 'tilt-turn-r':
      return d(`${r2(gx)},${r2(gy)} ${R},${r2(midY)} ${r2(gx)},${r2(B)}`) +
        d(`${r2(gx)},${r2(gy)} ${r2(midX)},${r2(B)} ${R},${r2(gy)}`) + handle(gx + 5, midY, 'v');
    case 'slide-l':
    case 'slide-r': {
      const dir = p.fn === 'slide-l' ? -1 : 1;
      const y = gy + gh / 2;
      const len = Math.min(gw * 0.55, 46);
      const x1 = midX - (dir * len) / 2, x2 = midX + (dir * len) / 2;
      return `<line x1="${r2(x1)}" y1="${r2(y)}" x2="${r2(x2)}" y2="${r2(y)}" stroke="${C.line}" stroke-width="1" marker-end="url(#arS${b.uid})"/>` +
        handle(dir === 1 ? gx + gw - 6 : gx + 6, y + 8, 'v');
    }
    default:
      return '';
  }
}

const doorMark = (gx, gy, gw, gh, side) =>
  `<rect x="${r2(side === 'l' ? gx + gw - 7 : gx + 2)}" y="${r2(gy + gh * 0.55)}" width="5" height="12" rx="1.5" fill="#31363d"/>`;

const handle = (x, y, dir) =>
  dir === 'v'
    ? `<rect x="${r2(x - 1.6)}" y="${r2(y - 6)}" width="3.2" height="12" rx="1.4" fill="#31363d"/>`
    : `<rect x="${r2(x - 6)}" y="${r2(y - 1.6)}" width="12" height="3.2" rx="1.4" fill="#31363d"/>`;

function numberBadge(cx, cy, n) {
  return `<g><circle cx="${r2(cx)}" cy="${r2(cy)}" r="6.2" fill="#fff" fill-opacity="0.9" stroke="${C.line}" stroke-width="0.7"/>` +
    text(cx, cy + 3, n, PX.fontSm, C.line, 'middle') + '</g>';
}

function tagFor(p, b) {
  if (!p.tag) return '';
  const isSlide = p.fn?.startsWith('slide');
  if (isSlide && p.fn !== 'slide-mesh') return tagBox(b.gx + b.gw / 2, b.gy + 7, p.tag);
  if (p.fn === 'slide-mesh') return tagBox(b.gx + b.gw / 2, b.gy + b.gh - 6, p.tag);
  if (p.tag === 'FAN') return tagBox(b.gx + b.gw / 2, b.gy - 4, 'FAN');
  return tagBox(b.gx + b.gw - 10, b.gy + b.gh - 6, p.tag);
}

function tagBox(cx, cy, label) {
  const w = 5.2 * String(label).length + 5;
  return `<g><rect x="${r2(cx - w / 2)}" y="${r2(cy - 5)}" width="${r2(w)}" height="10" rx="1.5" fill="${C.tagBg}" fill-opacity="0.92" stroke="${C.line}" stroke-width="0.55"/>` +
    text(cx, cy + 2.6, label, PX.tag, C.line, 'middle') + '</g>';
}

/* ---- dimension chains ---- */

function chainX(chain, ctx) {
  const { X, y, top, last } = ctx;
  const out = [];
  const w = last ? 1 : 0.75;
  for (const st of chain.stops) {
    out.push(line(X(st), top + 3, X(st), y + 4, '#98a0ab', 0.5));
  }
  for (const p of chain.parts) {
    const a = X(p.from), b = X(p.to);
    out.push(line(a, y, b, y, C.dim, w));
    out.push(arrowTick(a, y, 1), arrowTick(b, y, -1));
    out.push(text((a + b) / 2, y - 4, U.mm(p.value), last ? PX.font : PX.fontSm, C.dim, 'middle', last ? 600 : 400));
  }
  return out.join('');
}

function chainY(chain, ctx) {
  const { Y, x, right, last } = ctx;
  const out = [];
  const w = last ? 1 : 0.75;
  for (const st of chain.stops) {
    out.push(line(x - 4, Y(st), right - 3, Y(st), '#98a0ab', 0.5));
  }
  for (const p of chain.parts) {
    const a = Y(p.from), b = Y(p.to);
    out.push(`<line x1="${r2(x)}" y1="${r2(a)}" x2="${r2(x)}" y2="${r2(b)}" stroke="${C.dim}" stroke-width="${w}"/>`);
    out.push(arrowTickV(x, a, 1), arrowTickV(x, b, -1));
    const my = (a + b) / 2;
    out.push(`<text x="${r2(x - 4)}" y="${r2(my)}" transform="rotate(-90 ${r2(x - 4)} ${r2(my)})" text-anchor="middle" font-size="${last ? PX.font : PX.fontSm}" font-weight="${last ? 600 : 400}" fill="${C.dim}">${U.escapeHtml(U.mm(p.value))}</text>`);
  }
  return out.join('');
}

const arrowTick = (x, y, dir) =>
  `<path d="M${r2(x)} ${r2(y)} l${r2(dir * 5)} -2.4 l0 4.8 z" fill="${C.dim}"/>`;
const arrowTickV = (x, y, dir) =>
  `<path d="M${r2(x)} ${r2(y)} l-2.4 ${r2(dir * 5)} l4.8 0 z" fill="${C.dim}"/>`;

/* ---- plan section ---- */

function planStrip(plan, ctx) {
  const { x, y, w, uid } = ctx;
  const total = plan.tracks + plan.meshTrack;
  const h = PX.plan;
  const out = [];
  out.push(text(x + w / 2, y - 3, 'OUT', PX.fontSm, '#6a727d', 'middle'));
  out.push(rect(x, y, w, h, '#f2f4f6', C.frameStroke, 0.9));
  const lane = h / Math.max(1, total);
  for (let i = 0; i < total; i++) {
    const ly = y + i * lane;
    const isMesh = plan.meshTrack && i === 0;
    // each sash shown as a bar covering roughly its half/third of the run
    const share = w / plan.tracks;
    const bw = isMesh ? w / 2 : share * 1.02;
    const idx = isMesh ? (plan.meshSide === 'right' ? plan.tracks - 1 : 0) : total - 1 - i;
    const bx = isMesh
      ? (plan.meshSide === 'right' ? x + w - bw : x)
      : U.clamp(x + idx * share, x, x + w - bw);
    out.push(rect(bx, ly + lane * 0.18, bw, lane * 0.64, isMesh ? `url(#mesh${uid})` : '#dfe4e8', C.frameStroke, 0.7));
    out.push(line(x, ly, x + w, ly, '#c3c9cf', 0.4));
  }
  out.push(text(x + w / 2, y + h + 9, 'IN', PX.fontSm, '#6a727d', 'middle'));
  return out.join('');
}

/* ---- primitives ---- */

const r2 = (v) => Math.round(v * 100) / 100;

const rect = (x, y, w, h, fill, stroke, sw) =>
  `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(0, w))}" height="${r2(Math.max(0, h))}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

const line = (x1, y1, x2, y2, stroke, sw) =>
  `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${stroke}" stroke-width="${sw}"/>`;

const text = (x, y, t, size, fill, anchor = 'start', weight = 400) =>
  `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${U.escapeHtml(t)}</text>`;

/** Lightens (t>0) or darkens (t<0) a hex colour. */
export function shade(hex, t) {
  const h = String(hex || '#888').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '8');
  const n = parseInt(full.slice(0, 6), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    U.clamp(Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t)), 0, 255));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}
