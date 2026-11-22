// [MODULE] dom | Tiny DOM helpers: element builder, Japanese-text spans, a word's reading with its accent (bold mora or a FLAT label with its explanation tip), toast, segmented control, labelled parts, list toolbar groups, titled list sections (buttons at the end of a heading), one-line field that takes a pasted block, confirm seam
// [IFACE] layer: presentation | in: tag names, props, children -> out: DOM nodes | crosses: [browser DOM]
// [GRAPH] needs: [] | feeds: [shell, kana-ui, words-ui, sentences-ui, review-ui, quiz-ui, kanji-ui, kanji-card, settings-ui] | group: presentation
// [STATE] stateless | persists: nothing | raises: nothing

/**
 * h(tag, props, ...children) builds an element. Text always goes in as text:
 * `text` sets textContent and string children become text nodes, so words the
 * learner typed can never be parsed as markup. `html` exists only for trusted
 * markup we generate ourselves (stroke-order SVGs from the build, pitch diagrams).
 *
 * Japanese text must carry lang="ja" -- on a phone set to another language,
 * kanji otherwise render in their Chinese shapes (直, 骨, 角 differ visibly).
 */

export function $(id) {
  return document.getElementById(id);
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  });
  append(el, children);
  return el;
}

function append(el, children) {
  children.flat(Infinity).forEach((child) => {
    if (child == null || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
}

/** A span (or other tag) of Japanese text. */
export function ja(text, className, tag = 'span') {
  return h(tag, { lang: 'ja', class: className, text });
}

/**
 * A reading with its accent (P23), from words.accentView: `marked`
 * ({before, mora, after}) puts the accent nucleus in bold; `flat` adds a FLAT
 * label whose tip explains it. The tip opens on mouse hover everywhere, and on
 * a tap only when `tappable` -- never inside a review card or a list row,
 * where the tap belongs to the card or the row.
 */
export function jaReading(text, { marked = null, flat = false, tappable = false } = {}, className, tag = 'span') {
  const body = marked ? [marked.before, h('b', { class: 'accent-mora' }, marked.mora), marked.after] : [text];
  return h(tag, { lang: 'ja', class: className }, body, flat ? flatLabel(tappable) : null);
}

function flatLabel(tappable) {
  const label = h('span', { class: 'accent-flat', lang: 'en' }, 'flat');
  withTip(label, () => [
    h('strong', null, 'Flat word (heiban)'),
    h('p', null, 'No kana stands out. The first one is a little lower, the rest stay level, and a particle after the word (が, を, に…) stays level too.'),
    h('p', null, 'Don’t push a peak anywhere. (In a word with a bold kana, that kana is the peak: the voice is high there and falls right after it.)')
  ], tappable);
  return label;
}

// One tip for the whole app, placed under (or above) whatever opened it.
let tipEl = null;
let tipOwner = null;
let tipPinned = false;

function tipNode() {
  if (tipEl) return tipEl;
  tipEl = h('div', { class: 'tip', id: 'tip', role: 'tooltip', hidden: true });
  document.body.append(tipEl);
  // A hover tip goes with any press; a tapped one with a press outside it and its label.
  document.addEventListener('pointerdown', (e) => {
    if (!tipOwner) return;
    if (!tipPinned || !(tipOwner.contains(e.target) || tipEl.contains(e.target))) hideTip();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  ['scroll', 'resize', 'popstate'].forEach((type) => window.addEventListener(type, hideTip, true));
  return tipEl;
}

function showTip(owner, content, pinned) {
  const tip = tipNode();
  tip.replaceChildren(...content());
  tip.hidden = false;
  tipOwner = owner;
  tipPinned = pinned;
  owner.setAttribute('aria-describedby', 'tip');
  if (owner.hasAttribute('aria-expanded')) owner.setAttribute('aria-expanded', 'true');
  const r = owner.getBoundingClientRect();
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
  const below = r.bottom + 8 + height <= window.innerHeight - 8;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - 8 - height)) + 'px';
}

export function hideTip() {
  if (!tipOwner) return;
  tipOwner.removeAttribute('aria-describedby');
  if (tipOwner.hasAttribute('aria-expanded')) tipOwner.setAttribute('aria-expanded', 'false');
  tipEl.hidden = true;
  tipOwner = null;
  tipPinned = false;
}

/** Hover (a mouse) shows `content()` under `owner`; when `tappable`, a tap or Enter pins it until a press elsewhere. */
function withTip(owner, content, tappable) {
  owner.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !tipPinned) showTip(owner, content, false); });
  owner.addEventListener('pointerleave', () => { if (tipOwner === owner && !tipPinned) hideTip(); });
  if (!tappable) return;
  Object.assign(owner, { tabIndex: 0 });
  owner.setAttribute('role', 'button');
  owner.setAttribute('aria-expanded', 'false');
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (tipOwner === owner && tipPinned) hideTip(); else showTip(owner, content, true);
  };
  owner.addEventListener('click', toggle);
  owner.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
}

export function button(label, onClick, className, extra) {
  return h('button', { type: 'button', class: className, onclick: onClick, ...extra }, label);
}

/** A segmented control; `onPick(value)` is called with the tapped value. */
export function segmented(options, current, onPick, label) {
  return h('div', { class: 'segmented', role: 'group', 'aria-label': label },
    options.map((opt) => {
      const value = typeof opt === 'object' ? opt.value : opt;
      const text = typeof opt === 'object' ? opt.label : String(opt);
      return h('button', {
        type: 'button',
        'aria-pressed': String(value === current),
        onclick: () => onPick(value)
      }, text);
    }));
}

/**
 * One labelled group of a list toolbar (`.filters`, app.css): its caption above the control.
 * With `forId` the caption is a real <label> for that input.
 */
export function filterGroup(caption, control, { forId, className } = {}) {
  return h('div', { class: 'filter' + (className ? ' ' + className : '') },
    h(forId ? 'label' : 'span', { class: 'filter-label', for: forId }, caption), control);
}

/**
 * A titled list section (`.list-group`, app.css): heading, count and a hairline, then the content.
 * `actions` (buttons) sit at the end of the heading's row, after the hairline.
 */
export function listGroup(title, count, content, { className, dataset, actions } = {}) {
  const head = h('h2', { class: 'group-head' }, title, h('span', { class: 'sub' }, String(count)));
  return h('section', { class: 'list-group' + (className ? ' ' + className : ''), dataset },
    actions ? h('div', { class: 'group-bar' }, head, h('div', { class: 'group-actions' }, actions)) : head, content);
}

/** A labelled block of a card or a review step (`.part`, app.css): the label, then any content. */
export function part(label, ...content) {
  return h('div', { class: 'part' }, h('div', { class: 'part-label' }, label), content);
}

/**
 * A textarea that takes one typed line and a pasted block (P20). Enter moves to `next` instead of
 * breaking the line, so a line break in the value can only have come from a paste, whichever way
 * it arrived: the context menu, Ctrl+V, or a phone keyboard's clipboard strip (which fires no
 * paste event, hence the `input` listener). Then `onBlock(value, previous)` runs with the value the
 * field held before the paste (taken at `beforeinput`, else the last value seen, as code may have
 * set it since); when it returns false (one line after all) the line breaks are dropped. Register
 * it before the field's other `input` listeners, so they see the result.
 */
export function pasteBlockField(field, next, onBlock) {
  let previous = field.value;
  field.setAttribute('enterkeyhint', 'next');
  field.addEventListener('focus', () => { previous = field.value; });
  field.addEventListener('beforeinput', (e) => {
    previous = field.value;
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    e.preventDefault();
    next.focus();
  });
  field.addEventListener('input', () => {
    if (/[\r\n]/.test(field.value) && !onBlock(field.value, previous)) {
      field.value = field.value.replace(/[\r\n]+/g, '').trim();
    }
    previous = field.value;
  });
}

/** The one place the app asks for confirmation, so tests can answer it. */
export function confirmAction(message) {
  return window.confirm(message);
}

export function notify(message) {
  window.alert(message);
}

let toastTimer = 0;
export function toast(message) {
  let el = $('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

export function formatDaysAgo(ts, now = Date.now()) {
  if (!ts) return 'never';
  const days = Math.floor((now - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return days + ' days ago';
}
