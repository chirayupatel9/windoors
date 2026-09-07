/* Tiny form-control helpers so the editor files stay about the domain,
 * not about DOM plumbing. */

import { el, num } from './util.js';

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

export function iconBtn(glyph, title, onClick, attrs = {}) {
  return el('button', { type: 'button', class: 'ibtn', title, 'aria-label': title, ...attrs, onclick: onClick }, glyph);
}

export function section(title, ...children) {
  return el('section', { class: 'panel' },
    title ? el('h3', { class: 'panel-title' }, title) : null,
    el('div', { class: 'panel-body' }, ...children));
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
