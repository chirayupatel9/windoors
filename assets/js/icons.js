/*
 * Inline SVG icons. Drawn on a 16-unit grid with a 1.6 stroke so they sit at
 * the same weight as the UI type, and they inherit currentColor so a button's
 * own state colours them.
 */

const svg = (body, size = 16) =>
  `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" ` +
  `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ` +
  `stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICON = {
  trash: svg('<path d="M2.8 4.3h10.4M6.4 4.3V2.9h3.2v1.4M4.2 4.3l.6 8.4h6.4l.6-8.4M6.6 6.8v3.6M9.4 6.8v3.6"/>'),
  up: svg('<path d="M8 12.6V3.4M4.2 7.2 8 3.4l3.8 3.8"/>'),
  down: svg('<path d="M8 3.4v9.2M4.2 8.8 8 12.6l3.8-3.8"/>'),
  copy: svg('<rect x="5.4" y="5.4" width="7.8" height="7.8" rx="1.2"/><path d="M10.6 5.4V4.1a1.3 1.3 0 0 0-1.3-1.3H4.1a1.3 1.3 0 0 0-1.3 1.3v5.2a1.3 1.3 0 0 0 1.3 1.3h1.3"/>'),
  plus: svg('<path d="M8 3.6v8.8M3.6 8h8.8"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
  lock: svg('<rect x="3.4" y="7.2" width="9.2" height="6.4" rx="1.4"/><path d="M5.8 7.2V5.4a2.2 2.2 0 0 1 4.4 0v1.8"/>'),
  unlock: svg('<rect x="3.4" y="7.2" width="9.2" height="6.4" rx="1.4"/><path d="M5.8 7.2V5.4a2.2 2.2 0 0 1 4.2-.8"/>'),
  alert: svg('<path d="M8 2.6 14.4 13H1.6L8 2.6Z"/><path d="M8 6.6v3M8 11.4h.01"/>'),
  chevron: svg('<path d="M4.4 6.4 8 10l3.6-3.6"/>'),
  sun: svg('<circle cx="8" cy="8" r="3.1"/><path d="M8 1.4v1.5M8 13.1v1.5M2.9 2.9l1.1 1.1M12 12l1.1 1.1M1.4 8h1.5M13.1 8h1.5M2.9 13.1 4 12M12 4l1.1-1.1"/>'),
  moon: svg('<path d="M13.2 9.4A5.6 5.6 0 0 1 6.6 2.8a5.6 5.6 0 1 0 6.6 6.6Z"/>'),
  monitor: svg('<rect x="1.9" y="3" width="12.2" height="8.2" rx="1.2"/><path d="M5.6 13.6h4.8M8 11.2v2.4"/>'),
  fold: svg('<path d="M2.6 8h10.8M5.4 4.6 8 2.2l2.6 2.4M5.4 11.4 8 13.8l2.6-2.4"/>'),
  print: svg('<path d="M4.4 6.2V2.8h7.2v3.4"/><rect x="2.4" y="6.2" width="11.2" height="4.6" rx="1.2"/><path d="M4.4 10.2h7.2v3.2H4.4z"/>'),
};

/** Frame mark: an elevation with a mullion — the thing this tool draws. */
export const BRAND_MARK =
  '<svg viewBox="0 0 20 20" width="19" height="19" fill="none" stroke="currentColor" ' +
  'stroke-width="1.5" aria-hidden="true" focusable="false">' +
  '<rect x="2.6" y="2.6" width="14.8" height="14.8" rx="1"/>' +
  '<path d="M10 2.6v14.8M2.6 10h14.8" stroke-width="1.1"/></svg>';
