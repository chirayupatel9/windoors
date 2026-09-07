/* Tiny form-control helpers so the editor files stay about the domain,
 * not about DOM plumbing. */

import { el, num, $$ } from './util.js';
import { ICON } from './icons.js';

export function field(label, control, hint) {
  return el('label', { class: 'field' },
    el('span', { class: 'field-label' }, label),
    control,
    hint ? el('span', { class: 'field-hint' }, hint) : null);
}

export function textInput(value, onInput, attrs = {}) {
  return el('input', {
    type: 'text', value: value ?? '', class: 'inp', ...attrs,
    oninput: (e) => onInput(e.target.value),
  });
}

export function numInput(value, onInput, attrs = {}) {
  const input = el('input', {
    type: 'number', value: value ?? '', class: 'inp num', ...attrs,
    oninput: (e) => onInput(e.target.value === '' ? '' : num(e.target.value)),
  });
  return input;
}

export function areaInput(value, onInput, attrs = {}) {
  return el('textarea', {
    class: 'inp area', rows: attrs.rows || 3, ...attrs,
    oninput: (e) => onInput(e.target.value),
  }, value ?? '');
}

/** options: [{value,label,group?}] or [{value,label}] */
export function select(value, options, onChange, attrs = {}) {
  const sel = el('select', { class: 'inp', ...attrs, onchange: (e) => onChange(e.target.value) });
  const groups = new Map();
  for (const o of options) {
    const g = o.group || '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(o);
  }
  for (const [g, list] of groups) {
    const parent = g ? el('optgroup', { label: g }) : sel;
    for (const o of list) {
      parent.append(el('option', { value: o.value, selected: String(o.value) === String(value) }, o.label));
    }
    if (g) sel.append(parent);
  }
  return sel;
}

export function checkbox(checked, label, onChange) {
  return el('label', { class: 'check' },
    el('input', { type: 'checkbox', checked: !!checked, onchange: (e) => onChange(e.target.checked) }),
    el('span', {}, label));
}

export function button(label, onClick, attrs = {}) {
  return el('button', { type: 'button', class: 'btn', ...attrs, onclick: onClick }, label);
}

/** `glyph` is SVG markup from icons.js, or plain text for a caret. */
export function iconBtn(glyph, title, onClick, attrs = {}) {
  const b = el('button', { type: 'button', class: 'ibtn', title, 'aria-label': title, ...attrs, onclick: onClick });
  if (/^\s*</.test(String(glyph))) b.innerHTML = glyph; else b.textContent = glyph;
  return b;
}

/* --------------------------------------------------------------------
 * Panels.
 *
 * Every panel folds away, and stays folded until it is opened again. On a
 * screen with four or five of them stacked, being able to shut the ones you
 * are not working in is the difference between scrolling and not.
 * ------------------------------------------------------------------ */

const PANEL_KEY = 'windoors.panels';

function foldedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(PANEL_KEY) || '[]')); }
  catch (e) { return new Set(); }
}

function rememberFold(id, folded) {
  const set = foldedSet();
  if (folded) set.add(id); else set.delete(id);
  try { localStorage.setItem(PANEL_KEY, JSON.stringify([...set])); } catch (e) { /* not stored */ }
}

export const isFolded = (id) => foldedSet().has(id);

/** Folds or unfolds every panel on the page at once. */
export function foldAll(folded) {
  const set = foldedSet();
  for (const d of $$('details.panel')) {
    const id = d.dataset.panel;
    if (!id) continue;
    d.open = !folded;
    if (folded) set.add(id); else set.delete(id);
  }
  try { localStorage.setItem(PANEL_KEY, JSON.stringify([...set])); } catch (e) { /* not stored */ }
}

/**
 * @param {string|{title, actions?, id?, open?, class?}} head
 */
export function section(head, ...children) {
  const o = typeof head === 'string' ? { title: head } : (head || {});
  const id = o.id || (typeof o.title === 'string' ? o.title : 'panel');
  const open = o.open === false ? false : !isFolded(id);

  const summary = el('summary', { class: 'panel-title' },
    el('span', { class: 'panel-caret', html: ICON.chevron }),
    el('span', { class: 'panel-name' }, o.title || ''),
    (o.actions || []).length ? el('span', { class: 'spacer' }) : null,
    ...(o.actions || []));

  // a control in the header does its own job — it must not fold the panel
  summary.addEventListener('click', (e) => {
    if (e.target.closest('button, input, select, textarea, a, label')) e.preventDefault();
  });

  const det = el('details', { class: 'panel' + (o.class ? ' ' + o.class : ''), dataset: { panel: id } },
    summary,
    el('div', { class: 'panel-body' }, ...children));
  det.open = open;
  det.addEventListener('toggle', () => rememberFold(id, !det.open));
  return det;
}

export function row(...children) {
  return el('div', { class: 'row' }, ...children);
}

export function grid(cols, ...children) {
  return el('div', { class: 'grid', style: `--cols:${cols}` }, ...children);
}

let toastTimer;
export function toast(msg, kind = 'ok') {
  let box = document.getElementById('toast');
  if (!box) {
    box = el('div', { id: 'toast', class: 'toast' });
    document.body.append(box);
  }
  box.textContent = msg;
  box.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = 'toast'), 2600);
}

export function confirmDialog(message, onYes, yesLabel = 'Delete') {
  const wrap = el('div', { class: 'modal-back' });
  const close = () => wrap.remove();
  wrap.append(el('div', { class: 'modal' },
    el('p', { class: 'modal-msg' }, message),
    el('div', { class: 'modal-actions' },
      button('Cancel', close, { class: 'btn' }),
      button(yesLabel, () => { close(); onYes(); }, { class: 'btn danger' }))));
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.body.append(wrap);
}

export function modal(title, body, actions = []) {
  const wrap = el('div', { class: 'modal-back' });
  const close = () => wrap.remove();
  wrap.append(el('div', { class: 'modal wide' },
    el('h3', { class: 'modal-title' }, title),
    el('div', { class: 'modal-body' }, body),
    el('div', { class: 'modal-actions' },
      ...actions.map((a) => button(a.label, () => a.onClick(close), { class: a.class || 'btn' })),
      button('Close', close))));
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.body.append(wrap);
  return close;
}


/* --------------------------------------------------------------------
 * Keeping the caret where it was.
 *
 * A tab re-renders on every state change, which replaces the whole subtree —
 * including the field being typed into. Without this, the first keystroke
 * lands, focus falls to the body, and the rest of the word goes nowhere.
 *
 * The field is found again by its position in the rebuilt tree, checked
 * against what it was, and its caret and scroll restored. When the structure
 * genuinely changed — a row added, a tab switched — nothing matches and focus
 * is simply left alone.
 * ------------------------------------------------------------------ */

const pathOf = (root, node) => {
  const path = [];
  for (let n = node; n && n !== root; n = n.parentNode) {
    path.unshift([...n.parentNode.childNodes].indexOf(n));
  }
  return path;
};

const nodeAt = (root, path) => path.reduce((n, i) => n?.childNodes?.[i], root);

const identity = (el) =>
  [el.tagName, el.type || '', el.name || '', el.placeholder || '',
    el.getAttribute('aria-label') || '', el.className || ''].join('|');

/** Runs `render`, then puts the caret back if the same field is still there. */
export function preserveFocus(root, render) {
  const a = document.activeElement;
  const keep = a && a !== document.body && root.contains(a)
    ? { path: pathOf(root, a), id: identity(a), value: a.value,
        start: a.selectionStart, end: a.selectionEnd, scroll: a.scrollTop }
    : null;

  render();
  if (!keep) return;

  const node = nodeAt(root, keep.path);
  if (!node || node.nodeType !== 1 || identity(node) !== keep.id) return;

  node.focus({ preventScroll: true });
  /*
   * Show what is being typed, not what the model made of it. A width of "2"
   * is clamped to a buildable minimum the instant it is entered; writing that
   * back into the field mid-word would fight the person typing "2450". The
   * model already has the value — the field catches up on blur.
   */
  if (keep.value !== undefined && node.value !== keep.value) {
    try { node.value = keep.value; } catch (e) { /* not a value-bearing node */ }
  }
  restoreCaret(node, keep.start, keep.end);
  if (keep.scroll) node.scrollTop = keep.scroll;
}

/*
 * A number input exposes no selection API, so setSelectionRange throws on it
 * and the caret drops to the start — which sends the next digit to the front
 * of the number. Borrowing a text input's selection for an instant is the
 * usual way round it; the swap is not painted.
 */
function restoreCaret(node, start, end) {
  if (start != null) {
    try { node.setSelectionRange(start, end); return; } catch (e) { /* fall through */ }
  }
  if (node.tagName !== 'INPUT') return;
  const at = String(node.value ?? '').length;
  const type = node.getAttribute('type');
  try {
    node.type = 'text';
    node.setSelectionRange(at, at);
  } catch (e) {
    /* some types refuse either step; the caret simply stays where it is */
  } finally {
    if (type !== null) node.type = type;
  }
}
